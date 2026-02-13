import ParticipantLinks from "@/components/participant-links";
import { requireAuth } from "@/lib/guards";
import {
  getLicenseSiteForEmail,
  getMeetingInfoForEmail,
} from "@/lib/license-site";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

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

const formatDateTime = (value?: string) => {
  if (!value) return "TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
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

export default async function MeetingsPage() {
  const session = await requireAuth();
  const tenantConfig = await getTenantConfigFromHeaders();
  const siteUrl = tenantConfig?.siteUrl ?? process.env.WEBEX_SITE_URL;
  const licenseSite = session.user.email
    ? await getLicenseSiteForEmail(session.user.email)
    : null;

  if (!siteUrl) {
    return (
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          WEBEX_SITE_URL is not configured. Add it to your environment.
        </p>
      </div>
    );
  }

  const normalizedSiteUrl = siteUrl.trim().toLowerCase();
  const normalizedLicenseSite = licenseSite?.trim().toLowerCase();

  if (normalizedLicenseSite && normalizedLicenseSite !== normalizedSiteUrl) {
    const redirectLink =
      normalizedLicenseSite === "chinmayamission.webex.com"
        ? "https://webex-usa.chinmayavrindavan.org"
        : normalizedLicenseSite === "chinmayavrindavan.webex.com"
        ? "https://webex-india.chinmayavrindavan.org"
        : normalizedLicenseSite === "cmsj.webex.com"
        ? "https://webex-intl.chinmayavrindavan.org"
        : null;

    return (
      <div className="space-y-6 text-[#3b1a1f]">
        <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Your license site does not match this tenant. Use the correct host
            to access your meetings.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 text-sm text-[#6b4e3d]">
          <p>
            License site: <span className="font-semibold">{licenseSite}</span>
          </p>
          <p>
            Tenant site: <span className="font-semibold">{siteUrl}</span>
          </p>
          {redirectLink ? (
            <a
              href={redirectLink}
              className="mt-4 inline-flex rounded-full border border-[#7a3b2a]/50 px-4 py-2 text-sm font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a]"
            >
              Go to correct host
            </a>
          ) : (
            <p className="mt-4 text-xs text-[#8a5b44]">
              No redirect host configured for this license site.
            </p>
          )}
        </div>
      </div>
    );
  }

  const meetingInfoRaw = session.user.email
    ? await getMeetingInfoForEmail(session.user.email)
    : null;

  const meetingsFromJson = meetingInfoRaw?.trim()
    ? parseMeetingInfoJson(meetingInfoRaw)
    : null;

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Meetings you are hosting
        </p>
      </div>

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
                    <p>Start: {formatDateTime(meeting.start)}</p>
                    <p>End: {formatDateTime(meeting.end)}</p>
                  </div>
                </div>
                {Array.isArray(invitees) && invitees.length > 0 ? (
                  <ParticipantLinks
                    invitees={
                      invitees as { email?: string; phone?: string; name?: string }[]
                    }
                  />
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
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
                    <span className="text-xs text-[#8a5b44]">MTID: {mtid}</span>
                  ) : null}
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
          No meeting info found for your email in the sheet. Ensure the
          &quot;Meeting Info&quot; column is set for your row in the license
          Google Sheet.
        </div>
      )}
    </div>
  );
}
