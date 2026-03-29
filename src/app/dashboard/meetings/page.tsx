import CopyableMeetingLink from "@/components/copyable-meeting-link";
import ParticipantLinks from "@/components/participant-links";
import { prisma } from "@/lib/prisma";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { requireAuth } from "@/lib/guards";
import { Prisma } from "@/generated/postgres-client";
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

type InviteeContact = {
  email: string;
  phone?: string;
  name?: string;
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

function meetingKey(
  meetingNumber?: string | null,
  title?: string | null,
) {
  return [
    (meetingNumber ?? "").trim().toLowerCase(),
    (title ?? "").trim().toLowerCase(),
  ].join("|");
}

function normalizeMeetingNumber(value?: string | null): string {
  return (value ?? "").trim();
}

function inviteePhoneFromRecord(rec: Record<string, unknown>): string | undefined {
  const candidates = [
    rec.phone,
    rec.phoneNumber,
    rec.workPhone,
    rec.mobilePhone,
    rec.mobile,
    rec.tel,
    rec.workPhoneNumber,
    rec.displayPhone,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return undefined;
}

function parseInvitees(value: unknown): InviteeContact[] {
  if (!value) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return parseInvitees(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const out: InviteeContact[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const emailRaw = rec.email;
    if (typeof emailRaw !== "string" || !emailRaw.trim()) continue;
    const phoneRaw = inviteePhoneFromRecord(rec);
    const displayNameRaw = rec.displayName ?? rec.display_name;
    const nameRaw = rec.name;
    const displayName =
      typeof displayNameRaw === "string" && displayNameRaw.trim()
        ? displayNameRaw.trim()
        : typeof nameRaw === "string" && nameRaw.trim()
          ? nameRaw.trim()
          : undefined;
    out.push({
      email: emailRaw.trim().toLowerCase(),
      phone: phoneRaw,
      name: displayName,
    });
  }
  return out;
}

/**
 * Combine Postgres/Webex (gchant) invitees with license-sheet JSON invitees.
 * Webex/gchant payloads are often capped (~30); the sheet usually has the full list.
 * Order: gchant rows first, then sheet-only emails. Duplicate emails merge phone/name.
 */
function mergeInviteeLists(
  fromGchant: InviteeContact[],
  fromSheet: InviteeContact[],
): InviteeContact[] {
  if (fromSheet.length === 0) return fromGchant;
  if (fromGchant.length === 0) return fromSheet;

  const byEmail = new Map<string, InviteeContact>();
  const order: string[] = [];

  const take = (p: InviteeContact) => {
    const e = p.email.trim().toLowerCase();
    const phone = p.phone?.trim() || undefined;
    const name = p.name?.trim() || undefined;
    const existing = byEmail.get(e);
    if (!existing) {
      byEmail.set(e, { email: e, phone, name });
      order.push(e);
      return;
    }
    byEmail.set(e, {
      email: e,
      phone: existing.phone || phone,
      name: existing.name || name,
    });
  };

  for (const p of fromGchant) take(p);
  for (const p of fromSheet) take(p);
  return order.map((e) => byEmail.get(e)!);
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
  searchParams: Promise<{ debug?: string }>;
};

export default async function MeetingsPage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const params = await searchParams;

  const meetingInfoRaw = session.user.email
    ? await getMeetingInfoForEmail(session.user.email)
    : null;

  const meetingsFromJson = meetingInfoRaw?.trim()
    ? parseMeetingInfoJson(meetingInfoRaw)
    : null;

  const lookupDebug = null;

  const postgres = getPostgresPrisma();
  let pendingRequests: { timestamp: string; participantEmail: string }[] = [];
  const inviteesByMeetingKey = new Map<string, InviteeContact[]>();
  const inviteesByMeetingNumber = new Map<string, InviteeContact[]>();
  if (postgres && session.user.email) {
    try {
      const [rows, gchantMission, gchantVrindavan] = await Promise.all([
        await postgres.$queryRaw<
          { timestamp: string | null; participantemail: string | null }[]
        >`
        SELECT
          timestamp,
          participantemail
        FROM mission.webex_participants_non_india_except_raw
        WHERE hostemailid = ${session.user.email.toLowerCase()} AND status = 'PENDING'
        ORDER BY timestamp DESC
        LIMIT 50
      `,
        postgres.$queryRaw<
          {
            topic: string | null;
            webex_mtng_no: bigint | null;
            webex_mtng_link: string | null;
            invitees: unknown;
          }[]
        >`
          SELECT topic, webex_mtng_no, webex_mtng_link, invitees
          FROM mission.gchant_mtng
          WHERE lower(btrim(organizer_email::text)) = ${session.user.email.toLowerCase()}
        `,
        postgres.$queryRaw<
          {
            topic: string | null;
            webex_mtng_no: bigint | null;
            webex_mtng_link: string | null;
            invitees: unknown;
          }[]
        >`
          SELECT topic, webex_mtng_no, webex_mtng_link, invitees
          FROM vrindavan.gchant_mtng
          WHERE lower(btrim(organizer_email::text)) = ${session.user.email.toLowerCase()}
        `,
      ]);
      pendingRequests = rows.map((r) => ({
        timestamp: r.timestamp ?? "",
        participantEmail: r.participantemail ?? "",
      }));

      const gchantRows = [...gchantMission, ...gchantVrindavan];
      const emails = new Set<string>();
      const parsedByRow = gchantRows.map((r) => {
        const invitees = parseInvitees(r.invitees);
        for (const p of invitees) emails.add(p.email);
        return { row: r, invitees };
      });

      const emailList = Array.from(emails);
      const phoneByEmail = new Map<string, string>();
      if (emailList.length > 0) {
        const [nonIndiaPhones, indiaPhones, indiaStudentPhones] = await Promise.all([
          postgres.$queryRaw<{ email: string | null; phone: string | null }[]>`
            SELECT
              lower(btrim(prtcpnt_email_id::text)) AS email,
              prtcpnt_phone_no::text AS phone
            FROM mission.webex_participants_non_india
            WHERE lower(btrim(prtcpnt_email_id::text)) IN (${Prisma.join(emailList)})
          `,
          postgres.$queryRaw<{ email: string | null; phone: string | null }[]>`
            SELECT
              lower(btrim(ind_prtcpnt_email_id::text)) AS email,
              ind_prtcpnt_phone_no::text AS phone
            FROM vrindavan.webex_participants_india
            WHERE lower(btrim(ind_prtcpnt_email_id::text)) IN (${Prisma.join(emailList)})
          `,
          postgres.$queryRaw<{ email: string | null; phone: string | null }[]>`
            SELECT
              lower(btrim(ind_prtcpnt_email_id::text)) AS email,
              ind_prtcpnt_phone_no::text AS phone
            FROM vrindavan.webex_participants_india_students
            WHERE lower(btrim(ind_prtcpnt_email_id::text)) IN (${Prisma.join(emailList)})
          `,
        ]);
        for (const r of [...nonIndiaPhones, ...indiaPhones, ...indiaStudentPhones]) {
          const e = r.email?.trim().toLowerCase();
          const p = r.phone?.trim();
          if (e && p && !phoneByEmail.has(e)) phoneByEmail.set(e, p);
        }

        const mysqlParticipants = await prisma.participant.findMany({
          where: { email: { in: emailList } },
          select: { email: true, phone: true },
        });
        for (const r of mysqlParticipants) {
          const e = r.email?.trim().toLowerCase();
          const p = r.phone?.trim();
          if (e && p && !phoneByEmail.has(e)) phoneByEmail.set(e, p);
        }
      }

      for (const item of parsedByRow) {
        const enrichedInvitees = item.invitees.map((p) => ({
          ...p,
          phone: phoneByEmail.get(p.email) ?? p.phone,
        }));
        const key = meetingKey(
          item.row.webex_mtng_no != null ? String(item.row.webex_mtng_no) : null,
          item.row.topic,
        );
        inviteesByMeetingKey.set(key, enrichedInvitees);

        const numKey = normalizeMeetingNumber(
          item.row.webex_mtng_no != null ? String(item.row.webex_mtng_no) : null,
        );
        if (numKey && !inviteesByMeetingNumber.has(numKey)) {
          inviteesByMeetingNumber.set(numKey, enrichedInvitees);
        }
      }
    } catch {
      // Ignore Postgres errors on the meetings page; core functionality should still work.
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

      {meetingsFromJson ? (
        <div className="grid gap-4">
          {meetingsFromJson.map((meeting, index) => {
            const mtid = getMtidFromWebLink(meeting.webLink);
            const inviteesFromGchant =
              inviteesByMeetingKey.get(
                meetingKey(meeting.meetingNumber, meeting.title),
              ) ??
              inviteesByMeetingNumber.get(normalizeMeetingNumber(meeting.meetingNumber));
            const inviteesFromSheet = Array.isArray(meeting.invitees)
              ? parseInvitees(meeting.invitees)
              : [];
            const inviteesRaw =
              inviteesFromGchant &&
              inviteesFromGchant.length > 0 &&
              inviteesFromSheet.length > 0
                ? mergeInviteeLists(inviteesFromGchant, inviteesFromSheet)
                : inviteesFromGchant && inviteesFromGchant.length > 0
                  ? inviteesFromGchant
                  : inviteesFromSheet.length > 0
                    ? inviteesFromSheet
                    : null;
            const invitees = inviteesRaw;

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
                {invitees && invitees.length > 0 ? <ParticipantLinks invitees={invitees} /> : null}
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
                      <span className="text-xs text-[#8a5b44]">MTID: {mtid}</span>
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
