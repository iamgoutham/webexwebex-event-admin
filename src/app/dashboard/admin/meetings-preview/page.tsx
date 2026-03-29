import { Role } from "@prisma/client";
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

type SheetMeeting = {
  title?: string;
  start?: string;
  end?: string;
  state?: string;
  meetingNumber?: string;
  webLink?: string;
  invitees?: unknown[];
};

type MeetingInfoJson = {
  meetings?: SheetMeeting[];
};

function parseMeetingInfoJson(raw: string): SheetMeeting[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return null;
  try {
    const data = JSON.parse(trimmed) as MeetingInfoJson;
    const list = data?.meetings;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list;
  } catch {
    return null;
  }
}

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
  searchParams: Promise<{ email?: string }>;
};

export default async function MeetingsPreviewPage({ searchParams }: PageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const params = await searchParams;
  const email = params?.email?.trim();

  let meetingInfoRaw: string | null = null;
  let meetingsFromJson: SheetMeeting[] | null = null;
  let previewUser: { id: string; email: string | null; name: string | null; state: string | null } | null = null;

  if (email) {
    meetingInfoRaw = await getMeetingInfoForEmail(email);
    meetingsFromJson = meetingInfoRaw?.trim()
      ? parseMeetingInfoJson(meetingInfoRaw)
      : null;
    const normalizedEmail = email.toLowerCase().trim();
    previewUser = await prisma.host.findFirst({
      where: {
        email: normalizedEmail,
      },
      select: { id: true, email: true, name: true, state: true },
    });
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
                Requests created here are recorded as the preview user. Select participants from this user&apos;s
                state or enter emails manually.
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

          {meetingsFromJson ? (
            <div className="grid gap-4">
              {meetingsFromJson.map((meeting, index) => {
                const mtid = getMtidFromWebLink(meeting.webLink);
                const invitees = Array.isArray(meeting.invitees)
                  ? meeting.invitees
                  : null;
                return (
                  <div
                    key={meeting.meetingNumber ?? meeting.webLink ?? index}
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
                    {Array.isArray(invitees) && invitees.length > 0 ? (
                      <ParticipantLinks
                        invitees={
                          invitees as {
                            email?: string;
                            phone?: string;
                            name?: string;
                          }[]
                        }
                      />
                    ) : null}
                    <div className="mt-4 space-y-1">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {meeting.webLink ? (
                          <a
                            href={meeting.webLink}
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
                      {meeting.webLink ? (
                        <CopyableMeetingLink url={meeting.webLink} />
                      ) : null}
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
        </>
      )}
    </div>
  );
}
