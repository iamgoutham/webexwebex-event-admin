import Link from "next/link";
import { requireAuth } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getLicenseSiteForEmail } from "@/lib/license-site";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

type WebexMeeting = {
  id?: string;
  title?: string;
  agenda?: string;
  start?: string;
  end?: string;
  hostDisplayName?: string;
  hostEmail?: string;
  meetingNumber?: string;
  webLink?: string;
  meetingLink?: string;
};

type MeetingsResponse = {
  items?: WebexMeeting[];
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "TBD";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

export default async function MeetingsPage() {
  const session = await requireAuth();
  const tenantConfig = await getTenantConfigFromHeaders();
  const siteUrl = tenantConfig?.siteUrl ?? process.env.WEBEX_SITE_URL;
  const providerId = tenantConfig?.providerId ?? "webex";
  const licenseSite = session.user.email
    ? await getLicenseSiteForEmail(session.user.email)
    : null;

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: providerId },
    select: { access_token: true },
  });

  if (!siteUrl) {
    return (
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 text-[#3b1a1f] shadow-lg">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          WEBEX_SITE_URL is not configured. Add it to your environment to load
          meetings.
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
        <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
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

  if (!account?.access_token) {
    return (
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 text-[#3b1a1f] shadow-lg">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Your Webex account is not connected. Sign in again to refresh your
          Webex token.
        </p>
        <Link
          href="/auth/signin"
          className="mt-6 inline-flex rounded-full border border-[#7a3b2a]/50 px-4 py-2 text-sm font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a]"
        >
          Re-authenticate
        </Link>
      </div>
    );
  }

  const response = await fetch(
    `https://webexapis.com/v1/meetings?siteUrl=${encodeURIComponent(siteUrl)}`,
    {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: "application/json;charset=UTF-8",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    return (
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 text-[#3b1a1f] shadow-lg">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Unable to load meetings from Webex.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-xs text-[#7a2f24]">
          {JSON.stringify(errorBody, null, 2)}
        </pre>
      </div>
    );
  }

  const data = (await response.json()) as MeetingsResponse;
  const meetings = data.items ?? [];

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Meetings fetched from Webex site: {siteUrl}
        </p>
      </div>

      <div className="grid gap-4">
        {meetings.map((meeting) => (
          <div
            key={meeting.id ?? meeting.meetingNumber}
            className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {meeting.title ?? "Untitled meeting"}
                </h2>
                <p className="mt-1 text-xs text-[#8a5b44]">
                  Host: {meeting.hostDisplayName ?? meeting.hostEmail ?? "N/A"}
                </p>
              </div>
              <div className="text-right text-xs text-[#8a5b44]">
                <p>Start: {formatDateTime(meeting.start)}</p>
                <p>End: {formatDateTime(meeting.end)}</p>
              </div>
            </div>
            {meeting.agenda ? (
              <p className="mt-3 text-sm text-[#6b4e3d]">{meeting.agenda}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              {meeting.webLink || meeting.meetingLink ? (
                <a
                  href={meeting.webLink ?? meeting.meetingLink}
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
            </div>
          </div>
        ))}
        {!meetings.length ? (
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 text-sm text-[#8a5b44]">
            No meetings were returned from Webex yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
