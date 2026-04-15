import CopyableMeetingLink from "@/components/copyable-meeting-link";
import ParticipantLinks from "@/components/participant-links";
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
import {
  getHostDashboardMeetings,
  type MeetingAssignment,
} from "@/lib/public-confirmation";
import type { SheetMeeting } from "@/lib/meeting-sheet-types";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { loadHostMeetingParticipants } from "@/lib/host-meeting-participants";
import { requireAuth } from "@/lib/guards";
import { getMeetingInfoForEmail } from "@/lib/license-site";

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

function normMeetingNumberCell(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\.0+$/, "");
  return s || null;
}

/** Match sheet JSON row to a merged assignment (invitees / state). */
function sheetMeetingForAssignment(
  a: MeetingAssignment,
  sheetMeetings: SheetMeeting[],
): SheetMeeting | null {
  if (a.meetingNumber) {
    for (const sm of sheetMeetings) {
      const sn = normMeetingNumberCell(sm.meetingNumber);
      if (sn && sn === a.meetingNumber) return sm;
    }
  }
  const t = a.topic?.trim().toLowerCase();
  if (t) {
    for (const sm of sheetMeetings) {
      if (sm.title?.trim().toLowerCase() === t) return sm;
    }
  }
  return null;
}

type PageProps = {
  searchParams: Promise<{ debug?: string }>;
};

export default async function MeetingsPage({
  searchParams: _searchParams,
}: PageProps) {
  const session = await requireAuth();

  const meetingInfoRaw = session.user.email
    ? await getMeetingInfoForEmail(session.user.email)
    : null;

  let meetingsFromJson = meetingInfoRaw?.trim()
    ? parseMeetingInfoJson(meetingInfoRaw)
    : null;

  const postgres = getPostgresPrisma();
  let pendingRequests: { timestamp: string; participantEmail: string }[] = [];
  let hostMapInvitees: InviteeContact[] | null = null;
  let mapWebexLinks: string[] = [];
  let dashboardAssignments: MeetingAssignment[] | null = null;
  let sheetMeetingsForDashboard: SheetMeeting[] = [];
  if (postgres && session.user.email) {
    const hostEmailLower = session.user.email.toLowerCase();
    try {
      const dash = await getHostDashboardMeetings(postgres, hostEmailLower);
      sheetMeetingsForDashboard = dash.sheetMeetings;
      if (dash.assignments.length > 0) {
        dashboardAssignments = dash.assignments;
      }
    } catch {
      // Fall back to sheet JSON + coarse map links below
    }
    try {
      const rows = await postgres.$queryRaw<
        { timestamp: string | null; participantemail: string | null }[]
      >`
        SELECT
          timestamp,
          participantemail
        FROM mission.webex_participants_non_india_except_raw
        WHERE hostemailid = ${hostEmailLower} AND status = 'PENDING'
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
        hostEmailLower,
      );
      if (enriched.length > 0) {
        hostMapInvitees = enriched.map((p) => ({
          email: p.email,
          phone: p.phone?.trim() || undefined,
          name: p.name?.trim() || undefined,
        }));
      }
    } catch {
      // Sheet JSON invitees only per meeting when map load fails
    }

    try {
      mapWebexLinks = await fetchDistinctWebexLinksFromHostMaps(
        postgres,
        hostEmailLower,
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

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Meetings you are hosting
        </p>
      </div>

      {dashboardAssignments && dashboardAssignments.length > 0 ? (
        <div className="grid gap-4">
          {dashboardAssignments.map((assignment, index) => {
            const webLink = assignment.link ?? undefined;
            const mtid = getMtidFromWebLink(webLink);
            const sheetRow = sheetMeetingForAssignment(
              assignment,
              sheetMeetingsForDashboard,
            );
            const inviteesFromSheet = Array.isArray(sheetRow?.invitees)
              ? parseInvitees(sheetRow.invitees)
              : [];
            const invitees = mergeInviteesMapFirst(
              hostMapInvitees,
              inviteesFromSheet,
            );

            return (
              <div
                key={
                  assignment.meetingNumber ??
                  webLink ??
                  assignment.topic ??
                  index
                }
                className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {assignment.topic ?? "Untitled meeting"}
                    </h2>
                    {sheetRow?.state ? (
                      <p className="mt-1 text-xs capitalize text-[#8a5b44]">
                        {sheetRow.state}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-[#8a5b44]">
                    <p>
                      Start:{" "}
                      {formatDateTimeWithZones(
                        assignment.startTime ?? undefined,
                      )}
                    </p>
                    <p>
                      End:{" "}
                      {formatDateTimeWithZones(assignment.endTime ?? undefined)}
                    </p>
                  </div>
                </div>
                {invitees && invitees.length > 0 ? <ParticipantLinks invitees={invitees} /> : null}
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
                    {assignment.meetingNumber ? (
                      <span className="text-xs text-[#8a5b44]">
                        Meeting number: {assignment.meetingNumber}
                      </span>
                    ) : null}
                    {mtid ? (
                      <span className="text-xs text-[#8a5b44]">MTID: {mtid}</span>
                    ) : null}
                  </div>
                  {webLink ? <CopyableMeetingLink url={webLink} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : meetingsFromJson && meetingsFromJson.length > 0 ? (
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
                {invitees && invitees.length > 0 ? <ParticipantLinks invitees={invitees} /> : null}
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
                      <span className="text-xs text-[#8a5b44]">MTID: {mtid}</span>
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
            Your meeting
          </h2>
          <div className="mt-3 text-sm text-[#6b4e3d]">
            <MeetingInfoContent text={meetingInfoRaw.trim()} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 text-sm text-[#8a5b44]">
          No meeting info found. Please wait for the meeting to be assigned to
          you.
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 text-sm text-[#6b4e3d]">
          <h2 className="text-lg font-semibold text-[#3b1a1f]">
            Your pending meeting exception requests
          </h2>
          <p className="mt-1 text-xs text-[#8a5b44]">
            These requests are still marked as <span className="font-semibold">PENDING</span> in
            the exception list.
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

      <div className="rounded-2xl border border-dashed border-[#c9a882] bg-[#f5ead8] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#8a5b44]">
          Request participants to my meetings
        </h2>
        <p className="mt-2 text-sm text-[#8a5b44]">Disabled</p>
      </div>
    </div>
  );
}
