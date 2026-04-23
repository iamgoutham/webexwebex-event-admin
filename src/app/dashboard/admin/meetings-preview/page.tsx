import CopyableMeetingLink from "@/components/copyable-meeting-link";
import ParticipantLinks from "@/components/participant-links";
import AdminPreviewParticipantsPanel from "@/components/admin-preview-participants-panel";
import { requireRole } from "@/lib/guards";
import { ADMIN_ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  getMeetingInfoForEmail,
  getMeetingInfoLookupDebug,
} from "@/lib/license-site";
import { loadHostMeetingParticipants } from "@/lib/host-meeting-participants";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import type { SheetMeeting } from "@/lib/meeting-sheet-types";
import {
  mergeInviteesMapFirst,
  parseInvitees,
  parseMeetingInfoJson,
  type InviteeContact,
} from "@/lib/meeting-invitees-from-sheet";
import { extractWebexJoinUrlFromText } from "@/lib/meeting-web-link";
import {
  effectiveHostMeetingWebLink,
  fetchDistinctWebexLinksFromHostMaps,
} from "@/lib/host-map-meeting-link";

const formatDateTimeWithZones = (value?: string) => {
  if (!value) return "TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const utc = parsed.toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
  const et = parsed.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
  const ist = parsed.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
  return `UTC: ${utc} | ET: ${et} | IST: ${ist}`;
};

function getMtidFromWebLink(webLink?: string): string | null {
  if (!webLink?.trim()) return null;
  try {
    const url = new URL(webLink);
    return url.searchParams.get("MTID") ?? null;
  } catch {
    return null;
  }
}

const URL_REGEX = /https?:\/\/[^\s<>\[\]()]+/gi;

function MeetingInfoContent({ text }: { text: string }) {
  const segments: { type: "url" | "text"; value: string }[] = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_REGEX.source, "gi");
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd) {
      segments.push({ type: "text", value: text.slice(lastEnd, m.index) });
    }
    segments.push({ type: "url", value: m[0] });
    lastEnd = re.lastIndex;
  }
  if (lastEnd < text.length) {
    segments.push({ type: "text", value: text.slice(lastEnd) });
  }
  if (segments.length === 0 && text) {
    segments.push({ type: "text", value: text });
  }
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.type === "url" ? (
          <a
            key={i}
            href={seg.value}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#3b1a1f] underline hover:text-[#8a2f2a]"
          >
            {seg.value}
          </a>
        ) : (
          seg.value
        )
      )}
    </span>
  );
}

type PageProps = {
  searchParams: Promise<{ email?: string; debug?: string }>;
};

/** Why `parseMeetingInfoJson` returned null (for admin debug panel). */
function explainParseFailure(raw: string): string {
  const t = raw.trim();
  if (!t) return "meeting_info_empty";
  if (t[0] !== "{" && t[0] !== "[") return "meeting_info_not_json_object_or_array";
  try {
    const data = JSON.parse(t) as { meetings?: unknown };
    const list = data?.meetings;
    if (!Array.isArray(list)) return "json_missing_meetings_array";
    if (list.length === 0) return "meetings_array_empty";
    return "unknown";
  } catch {
    return "json_parse_error";
  }
}

export default async function MeetingsPreviewPage({ searchParams }: PageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const params = await searchParams;
  const email = params?.email?.trim();
  const debugPreview =
    params?.debug === "1" ||
    params?.debug === "true" ||
    process.env.MEETINGS_PREVIEW_DEBUG === "1";

  let meetingInfoRaw: string | null = null;
  let meetingsFromJson: SheetMeeting[] | null = null;
  let previewUser: { id: string; email: string | null; name: string | null; state: string | null } | null = null;

  let hostMapInvitees: InviteeContact[] | null = null;
  let mapWebexLinks: string[] = [];
  let mapParticipantCount: number | null = null;
  let mapLoadError: string | null = null;
  let pendingRequests: { timestamp: string; participantEmail: string }[] = [];
  let sheetLookupDebug: Awaited<
    ReturnType<typeof getMeetingInfoLookupDebug>
  > | null = null;
  let debugSnapshot: Record<string, unknown> | null = null;

  if (email) {
    meetingInfoRaw = await getMeetingInfoForEmail(email);
    meetingsFromJson = meetingInfoRaw?.trim()
      ? parseMeetingInfoJson(meetingInfoRaw)
      : null;
    const sheetMeetingsParsedCount = meetingsFromJson?.length ?? 0;
    const normalizedEmail = email.toLowerCase().trim();
    previewUser = await prisma.host.findFirst({
      where: {
        email: normalizedEmail,
      },
      select: { id: true, email: true, name: true, state: true },
    });

    const postgres = getPostgresPrisma();
    if (postgres) {
      try {
        const rows = await postgres.$queryRaw<
          { timestamp: string | null; participantemail: string | null }[]
        >`
          SELECT
            timestamp,
            participantemail
          FROM mission.webex_participants_non_india_except_raw
          WHERE hostemailid = ${normalizedEmail} AND status = 'PENDING'
          ORDER BY timestamp DESC
          LIMIT 50
        `;
        pendingRequests = rows.map((r) => ({
          timestamp: r.timestamp ?? "",
          participantEmail: r.participantemail ?? "",
        }));
      } catch {
        // Pending-requests table optional; do not block map participant load.
      }

      try {
        const enriched = await loadHostMeetingParticipants(
          postgres,
          normalizedEmail,
        );
        mapParticipantCount = enriched.length;
        if (enriched.length > 0) {
          hostMapInvitees = enriched.map((p) => ({
            email: p.email,
            phone: p.phone?.trim() || undefined,
            name: p.name?.trim() || undefined,
          }));
        }
      } catch (err) {
        mapLoadError =
          err instanceof Error ? err.message : String(err);
      }

      try {
        mapWebexLinks = await fetchDistinctWebexLinksFromHostMaps(
          postgres,
          normalizedEmail,
        );
      } catch {
        // map link column optional per environment
      }

      if (
        (!meetingsFromJson || meetingsFromJson.length === 0) &&
        hostMapInvitees &&
        hostMapInvitees.length > 0
      ) {
        meetingsFromJson = [
          {
            title: "Participants (from host–participant map)",
            webLink:
              effectiveHostMeetingWebLink(
                extractWebexJoinUrlFromText(meetingInfoRaw),
                mapWebexLinks,
                1,
              ) ?? undefined,
          },
        ];
      }
    }

    if (debugPreview) {
      sheetLookupDebug = await getMeetingInfoLookupDebug(email);
      const payload = {
        tag: "[meetings-preview]",
        previewEmail: normalizedEmail,
        meetingInfoRawChars: meetingInfoRaw?.length ?? 0,
        meetingsFromSheetJsonCount: sheetMeetingsParsedCount,
        meetingsRenderedCount: meetingsFromJson?.length ?? 0,
        parseFailureHint:
          meetingsFromJson || !meetingInfoRaw?.trim()
            ? null
            : explainParseFailure(meetingInfoRaw),
        postgresConfigured: Boolean(postgres),
        mapParticipantCount,
        mapWebexLinksDistinctCount: mapWebexLinks.length,
        hostMapInviteesCount: hostMapInvitees?.length ?? 0,
        mapLoadError,
        pendingRequestsCount: pendingRequests.length,
        mysqlHostRow: Boolean(previewUser),
        sheet1: sheetLookupDebug?.sheet1,
        sheet2: sheetLookupDebug?.sheet2,
        sheet3: sheetLookupDebug?.sheet3,
        note:
          "Parity with /dashboard/meetings: sheet JSON meetings, Postgres host–participant map merged per meeting (map first), Webex link fallback from map webex_mtng_link, synthetic card when sheet has no meetings but map has participants, pending exception requests for the preview email.",
      };
      debugSnapshot = payload;
      console.log(JSON.stringify(payload));
    }
  }

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Meetings preview (as user)</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          See the meetings page as it would appear for a given user email.
          Enter the email below to preview their meetings and participant list.
        </p>

        <form
          method="GET"
          className="mt-6 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[#6b4e3d]">
              User email
            </span>
            <input
              type="email"
              name="email"
              defaultValue={email ?? ""}
              placeholder="user@example.com"
              className="rounded-lg border border-[#e5c18e] bg-white px-3 py-2 text-sm text-[#3b1a1f] placeholder:text-[#8a5b44] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c26a25]"
          >
            Preview
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#6b4e3d]">
            <input
              type="checkbox"
              name="debug"
              value="1"
              defaultChecked={debugPreview}
              className="rounded border-[#e5c18e]"
            />
            Debug (server log + panel below)
          </label>
        </form>
      </div>

      {!email ? (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 text-sm text-[#8a5b44]">
          Enter an email above and click Preview to see that user&apos;s
          meetings.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-sm text-[#6b4e3d]">
            <span className="font-semibold">Previewing as:</span> {email}
          </div>

          {previewUser ? (
            <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
              <h2 className="text-lg font-semibold text-[#3b1a1f]">
                Request participants to this user&apos;s meetings
              </h2>
              <p className="mt-1 text-sm text-[#6b4e3d]">
                Requests created here are recorded as the preview user. Load participants from the full roster (all
                states) or enter emails manually.
              </p>
              <div className="mt-4">
                <AdminPreviewParticipantsPanel
                  previewUserId={previewUser.id}
                  previewUserLabel={
                    previewUser.name || previewUser.email || email || ""
                  }
                  currentAdminUserId={session.user.id ?? ""}
                  state={previewUser.state ?? null}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-4 text-[11px] text-[#8a5b44]">
              Request participants is available only when the previewed email belongs to a registered host.
            </div>
          )}

          {meetingsFromJson && meetingsFromJson.length > 0 ? (
            <div className="grid gap-4">
              {meetingsFromJson.map((meeting, index) => {
                const webLink = effectiveHostMeetingWebLink(
                  meeting.webLink,
                  mapWebexLinks,
                  meetingsFromJson!.length,
                );
                const mtid = getMtidFromWebLink(webLink);
                const inviteesFromSheet = Array.isArray(meeting.invitees)
                  ? parseInvitees(meeting.invitees)
                  : [];
                const invitees = mergeInviteesMapFirst(
                  hostMapInvitees,
                  inviteesFromSheet,
                );
                return (
                  <div
                    key={meeting.meetingNumber ?? webLink ?? index}
                    className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold">
                          {meeting.title ?? "Untitled meeting"}
                        </h2>
                        {meeting.state ? (
                          <p className="mt-1 text-xs capitalize text-[#8a5b44]">
                            {meeting.state}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-[#8a5b44]">
                        <p>Start: {formatDateTimeWithZones(meeting.start)}</p>
                        <p>End: {formatDateTimeWithZones(meeting.end)}</p>
                      </div>
                    </div>
                    {invitees && invitees.length > 0 ? (
                      <ParticipantLinks invitees={invitees} />
                    ) : null}
                    <div className="mt-4 space-y-1">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {webLink ? (
                          <a
                            href={webLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[#7a3b2a]/50 px-3 py-1 text-xs font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a]"
                          >
                            Open meeting
                          </a>
                        ) : null}
                        {meeting.meetingNumber ? (
                          <span className="text-xs text-[#8a5b44]">
                            Meeting number: {meeting.meetingNumber}
                          </span>
                        ) : null}
                        {mtid ? (
                          <span className="text-xs text-[#8a5b44]">
                            MTID: {mtid}
                          </span>
                        ) : null}
                      </div>
                      {webLink ? <CopyableMeetingLink url={webLink} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : meetingInfoRaw?.trim() ? (
            <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#3b1a1f]">
                Meeting info (raw)
              </h2>
              <div className="mt-3 text-sm text-[#6b4e3d]">
                <MeetingInfoContent text={meetingInfoRaw.trim()} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 text-sm text-[#8a5b44]">
              No meetings created. Please wait for admin to create the meetings and assign participants.
            </div>
          )}

          {pendingRequests.length > 0 && (
            <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 text-sm text-[#6b4e3d]">
              <h2 className="text-lg font-semibold text-[#3b1a1f]">
                Pending meeting exception requests (preview user)
              </h2>
              <p className="mt-1 text-xs text-[#8a5b44]">
                These requests are still marked as{" "}
                <span className="font-semibold">PENDING</span> in the exception
                list for this email.
              </p>
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-[#e5c18e] bg-[#fffdf7]">
                <table className="w-full text-left text-xs text-[#6b4e3d]">
                  <thead>
                    <tr className="border-b border-[#e5c18e] bg-[#fff4df] text-[#3b1a1f]">
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Participant email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((r, idx) => (
                      <tr
                        key={`${r.timestamp}-${r.participantEmail}-${idx}`}
                        className="border-b border-[#e5c18e]/60"
                      >
                        <td className="px-3 py-1.5">
                          {r.timestamp
                            ? new Date(r.timestamp).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-1.5">{r.participantEmail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {debugSnapshot ? (
            <details className="rounded-2xl border border-dashed border-[#c9a882] bg-[#f5ead8] p-4 text-xs text-[#3b1a1f]">
              <summary className="cursor-pointer font-semibold text-[#8a5b44]">
                Meetings preview debug (server)
              </summary>
              <p className="mt-2 text-[11px] text-[#6b4e3d]">
                Same payload is printed to the server log as one JSON line tagged{" "}
                <code className="rounded bg-[#fff4df] px-1">[meetings-preview]</code>.
                Set <code className="rounded bg-[#fff4df] px-1">MEETINGS_PREVIEW_DEBUG=1</code> to
                log without using the checkbox.
              </p>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                {JSON.stringify(debugSnapshot, null, 2)}
              </pre>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
