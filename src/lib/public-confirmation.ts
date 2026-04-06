import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { sendEmail } from "@/lib/notifications/channels/email";
import type { PrismaClient as PostgresPrismaClient } from "@/generated/postgres-client";
import {
  fetchParticipantNamesForHostMeetingPair,
  loadHostMeetingParticipants,
  type HostMeetingParticipant,
} from "@/lib/host-meeting-participants";
import { displayParticipantListRow } from "@/lib/participant-display";
import {
  coerceDisplayableWebexJoinLink,
  fetchHostMapMeetingIdentities,
  type HostMapMeetingIdentity,
} from "@/lib/host-map-meeting-link";
import { getMeetingInfoForEmail } from "@/lib/license-site";
import { parseMeetingInfoJson } from "@/lib/meeting-invitees-from-sheet";
import type { SheetMeeting } from "@/lib/meeting-sheet-types";

export type { HostMeetingParticipant };

export type MeetingAssignment = {
  topic: string | null;
  link: string | null;
  meetingNumber: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Organizer / assigned host for this row */
  hostEmail: string | null;
  hostPhone: string | null;
  /**
   * When several registrants share this email, map-derived display name(s)
   * tied to this host + meeting.
   */
  participantNames?: string[];
};

export type ConfirmationLookupResult = {
  valid: boolean;
  email: string;
  isHost: boolean;
  isParticipant: boolean;
  displayName: string | null;
  meetings: MeetingAssignment[];
  /** Populated when {@link isHost}; emails/phones from participant tables. */
  hostMeetingParticipants: HostMeetingParticipant[];
};

function normMeetingNumber(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/\.0+$/, "");
  return s || null;
}

function meetingDedupeKey(m: MeetingAssignment): string {
  return [
    m.link ?? "",
    m.meetingNumber ?? "",
    m.startTime ?? "",
    m.topic ?? "",
    m.hostEmail ?? "",
  ].join("|");
}

function findSheetMeetingForIdentity(
  sheetMeetings: SheetMeeting[],
  identity: HostMapMeetingIdentity,
): SheetMeeting | null {
  const idNum = identity.meetingNumber;
  if (idNum) {
    for (const sm of sheetMeetings) {
      const sn = normMeetingNumber(sm.meetingNumber);
      if (sn && sn === idNum) return sm;
    }
  }
  const mapLink = coerceDisplayableWebexJoinLink(identity.link);
  if (mapLink) {
    const low = mapLink.toLowerCase();
    for (const sm of sheetMeetings) {
      const sl = coerceDisplayableWebexJoinLink(sm.webLink);
      if (sl && sl.toLowerCase() === low) return sm;
    }
  }
  return null;
}

function mapAndSheetToAssignment(
  identity: HostMapMeetingIdentity,
  sheet: SheetMeeting | null,
  hostEmail: string,
  hostPhone: string | null,
): MeetingAssignment {
  const mapLink = coerceDisplayableWebexJoinLink(identity.link);
  const sheetLink = sheet
    ? coerceDisplayableWebexJoinLink(sheet.webLink)
    : null;
  const link = mapLink ?? sheetLink ?? null;
  return {
    topic: sheet?.title?.trim() ?? null,
    link,
    meetingNumber: identity.meetingNumber ?? normMeetingNumber(sheet?.meetingNumber),
    startTime: sheet?.start?.trim() || null,
    endTime: sheet?.end?.trim() || null,
    hostEmail,
    hostPhone,
  };
}

function sheetMeetingToAssignment(
  sm: SheetMeeting,
  hostEmail: string | null,
  hostPhone: string | null,
): MeetingAssignment {
  return {
    topic: sm.title?.trim() ?? null,
    link: coerceDisplayableWebexJoinLink(sm.webLink),
    meetingNumber: normMeetingNumber(sm.meetingNumber),
    startTime: sm.start?.trim() || null,
    endTime: sm.end?.trim() || null,
    hostEmail,
    hostPhone,
  };
}

async function sheetOnlyHostContext(
  postgres: PostgresPrismaClient,
  confirmationEmail: string,
  isHost: boolean,
  mappedHostEmails: Set<string>,
): Promise<{ hostEmail: string | null; hostPhone: string | null }> {
  if (isHost) {
    const hostPhone = await lookupHostPhone(postgres, confirmationEmail);
    return { hostEmail: confirmationEmail, hostPhone };
  }
  if (mappedHostEmails.size === 1) {
    const [h] = [...mappedHostEmails];
    const hostPhone = await lookupHostPhone(postgres, h);
    return { hostEmail: h, hostPhone };
  }
  if (mappedHostEmails.size > 1) {
    const [h] = [...mappedHostEmails].sort();
    const hostPhone = await lookupHostPhone(postgres, h);
    return { hostEmail: h, hostPhone };
  }
  return { hostEmail: null, hostPhone: null };
}

async function lookupHostPhone(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string | null> {
  const [r1, r2] = await Promise.all([
    postgres.$queryRaw<{ phone: string | null }[]>`
      SELECT host_phone_no::text AS phone
      FROM mission.webex_hosts_non_india
      WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
        AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
      LIMIT 1
    `,
    postgres.$queryRaw<{ phone: string | null }[]>`
      SELECT host_phone_no::text AS phone
      FROM vrindavan.webex_hosts_india
      WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
        AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
      LIMIT 1
    `,
  ]);
  const p = r1[0]?.phone?.trim() || r2[0]?.phone?.trim();
  return p || null;
}

/**
 * Host emails tied to a participant via downstream map tables
 * (`mission.host_prtcpnt_map_nonindia_nu`, `mission.host_prtcpnt_map_crossregion`,
 * `vrindavan.host_prtcpnt_map_india`).
 * Column names follow existing mission/vrindavan conventions; alternate queries run if joins differ.
 */
async function collectHostEmailsFromParticipantMaps(
  postgres: PostgresPrismaClient,
  participantEmailLower: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  const q = participantEmailLower;

  const add = (rows: { host_email: string | null }[]) => {
    for (const r of rows) {
      const e = r.host_email?.trim().toLowerCase();
      if (e) out.add(e);
    }
  };

  // mission.host_prtcpnt_map_nonindia_nu → mission.webex_hosts_non_india
  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_nu m
      INNER JOIN mission.webex_hosts_non_india h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_nu join failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_nu m
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
        AND m.host_email_id IS NOT NULL
        AND btrim(m.host_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_nu host_email_id failed:",
      err,
    );
  }

  // mission.host_prtcpnt_map_crossregion → mission.webex_hosts_non_india (student / ind_* or prtcpnt_* columns)
  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_crossregion m
      INNER JOIN mission.webex_hosts_non_india h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch {
    try {
      const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
        SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
        FROM mission.host_prtcpnt_map_crossregion m
        INNER JOIN mission.webex_hosts_non_india h
          ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
           = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
         AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[confirm-registration] mission host_prtcpnt_map_crossregion join failed:",
        err,
      );
    }
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
        AND m.host_email_id IS NOT NULL
        AND btrim(m.host_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `;
    add(rows);
  } catch {
    try {
      const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
        SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
        FROM mission.host_prtcpnt_map_crossregion m
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
          AND m.host_email_id IS NOT NULL
          AND btrim(m.host_email_id::text) <> ''
          AND EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india h
            WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[confirm-registration] mission host_prtcpnt_map_crossregion host_email_id failed:",
        err,
      );
    }
  }

  // vrindavan.host_prtcpnt_map_india → vrindavan.webex_hosts_india
  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM vrindavan.host_prtcpnt_map_india m
      INNER JOIN vrindavan.webex_hosts_india h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch {
    try {
      const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
        SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
        FROM vrindavan.host_prtcpnt_map_india m
        INNER JOIN vrindavan.webex_hosts_india h
          ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
           = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
         AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[confirm-registration] vrindavan host_prtcpnt_map_india join failed:",
        err,
      );
    }
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM vrindavan.host_prtcpnt_map_india m
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
        AND m.host_email_id IS NOT NULL
        AND btrim(m.host_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM vrindavan.webex_hosts_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `;
    add(rows);
  } catch {
    try {
      const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
        SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
          AND m.host_email_id IS NOT NULL
          AND btrim(m.host_email_id::text) <> ''
          AND EXISTS (
            SELECT 1
            FROM vrindavan.webex_hosts_india h
            WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[confirm-registration] vrindavan host_prtcpnt_map_india host_email_id failed:",
        err,
      );
    }
  }

  return out;
}

export async function lookupConfirmation(emailRaw: string): Promise<ConfirmationLookupResult> {
  const email = emailRaw.trim().toLowerCase();
  const postgres = getPostgresPrisma();
  if (!postgres) {
    throw new Error("Downstream database is not configured.");
  }

  // Presence checks across curated participants + hosts + india students.
  const [hostNonIndia, hostIndia, nonIndiaRows, indiaRows, indiaStudentRows] =
    await Promise.all([
      postgres.$queryRaw<{ host_first_name: string | null; host_last_name: string | null }[]>`
        SELECT host_first_name, host_last_name
        FROM mission.webex_hosts_non_india
        WHERE lower(btrim(host_email_id::text)) = ${email}
          AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
        LIMIT 1
      `,
      postgres.$queryRaw<{ host_first_name: string | null; host_last_name: string | null; chinmaya_center_name: string | null }[]>`
        SELECT host_first_name, host_last_name, chinmaya_center_name
        FROM vrindavan.webex_hosts_india
        WHERE lower(btrim(host_email_id::text)) = ${email}
          AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
        LIMIT 1
      `,
      postgres.nonIndiaParticipant.findMany({
        where: { prtcpntEmailId: email },
        select: { prtcpntName: true },
      }),
      postgres.indiaParticipant.findMany({
        where: { indPrtcpntEmailId: email },
        select: { indPrtcpntName: true },
      }),
      postgres.$queryRaw<{ ind_prtcpnt_name: string | null }[]>`
        SELECT ind_prtcpnt_name
        FROM vrindavan.webex_participants_india_students
        WHERE lower(btrim(ind_prtcpnt_email_id::text)) = ${email}
      `,
    ]);

  const isHost = hostNonIndia.length > 0 || hostIndia.length > 0;
  const isParticipant = Boolean(
    nonIndiaRows.length > 0 ||
      indiaRows.length > 0 ||
      indiaStudentRows.length > 0,
  );

  const participantNameParts: string[] = [];
  for (const r of nonIndiaRows) {
    const n = r.prtcpntName?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of indiaRows) {
    const n = r.indPrtcpntName?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of indiaStudentRows) {
    const n = r.ind_prtcpnt_name?.trim();
    if (n) participantNameParts.push(n);
  }

  const hostNameFallback =
    hostNonIndia[0]?.host_first_name || hostNonIndia[0]?.host_last_name
      ? `${hostNonIndia[0]?.host_first_name ?? ""} ${hostNonIndia[0]?.host_last_name ?? ""}`.trim()
      : hostIndia[0]?.host_first_name || hostIndia[0]?.host_last_name
        ? `${hostIndia[0]?.host_first_name ?? ""} ${hostIndia[0]?.host_last_name ?? ""}`.trim()
        : null;

  const displayName =
    participantNameParts.length > 0
      ? participantNameParts.join("; ")
      : hostNameFallback;

  let mappedHostEmails = new Set<string>();
  try {
    if (isParticipant) {
      mappedHostEmails = await collectHostEmailsFromParticipantMaps(postgres, email);
    }
  } catch (err) {
    console.error("[confirm-registration] Participant host map lookup failed:", err);
  }

  const meetingInfoRaw = await getMeetingInfoForEmail(email);
  const sheetMeetings = meetingInfoRaw
    ? parseMeetingInfoJson(meetingInfoRaw) ?? []
    : [];

  const hostEmailsToQuery = new Set<string>();
  if (isHost) hostEmailsToQuery.add(email);
  for (const h of mappedHostEmails) hostEmailsToQuery.add(h);

  const collected: MeetingAssignment[] = [];

  try {
    const hostList = [...hostEmailsToQuery].sort();
    let anyMapIdentity = false;

    if (hostList.length > 0) {
      const [phones, identityLists] = await Promise.all([
        Promise.all(hostList.map((h) => lookupHostPhone(postgres, h))),
        Promise.all(
          hostList.map((h) => fetchHostMapMeetingIdentities(postgres, h)),
        ),
      ]);
      for (let i = 0; i < hostList.length; i++) {
        const H = hostList[i];
        const hostPhone = phones[i];
        const identities = identityLists[i];
        if (identities.length > 0) anyMapIdentity = true;
        for (const id of identities) {
          const sheetRow = findSheetMeetingForIdentity(sheetMeetings, id);
          collected.push(mapAndSheetToAssignment(id, sheetRow, H, hostPhone));
        }
      }
    }

    if (!anyMapIdentity && sheetMeetings.length > 0) {
      const { hostEmail, hostPhone } = await sheetOnlyHostContext(
        postgres,
        email,
        isHost,
        mappedHostEmails,
      );
      for (const sm of sheetMeetings) {
        collected.push(sheetMeetingToAssignment(sm, hostEmail, hostPhone));
      }
    }
  } catch (err) {
    console.error("[confirm-registration] Meeting lookup failed:", err);
  }

  const seen = new Set<string>();
  let meetings = collected.filter((m) => {
    const k = meetingDedupeKey(m);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  meetings.sort((a, b) => {
    const ta = a.startTime ?? "";
    const tb = b.startTime ?? "";
    return ta.localeCompare(tb);
  });

  if (isParticipant && meetings.length > 0) {
    meetings = await Promise.all(
      meetings.map(async (m) => {
        if (!m.hostEmail) {
          return m;
        }
        const participantNames = await fetchParticipantNamesForHostMeetingPair(
          postgres,
          email,
          m.hostEmail,
          m.meetingNumber,
          m.link,
        );
        if (participantNames.length === 0) {
          return m;
        }
        return { ...m, participantNames };
      }),
    );
  }

  let hostMeetingParticipants: HostMeetingParticipant[] = [];
  if (isHost) {
    try {
      hostMeetingParticipants = await loadHostMeetingParticipants(
        postgres,
        email,
      );
    } catch (err) {
      console.error(
        "[confirm-registration] Host meeting participants lookup failed:",
        err,
      );
    }
  }

  return {
    valid: isHost || isParticipant,
    email,
    isHost,
    isParticipant,
    displayName,
    meetings,
    hostMeetingParticipants,
  };
}

const CONFIRMATION_EMAIL_SUBJECT =
  "Registration confirmation — Chinmaya Gita Samarpanam 2026";

/**
 * Builds the exact subject and plain-text body used by
 * {@link sendConfirmationEmail} (and admin preview).
 */
export function buildConfirmationEmailContent(result: ConfirmationLookupResult): {
  subject: string;
  body: string;
} {
  const greetingName = result.displayName?.trim()
    ? ` ${result.displayName.trim()}`
    : "";

  const lines: string[] = [];
  lines.push(`Namaste${greetingName},`);
  lines.push("");
  lines.push("This email confirms your registration for Chinmaya Gita Samarpanam 2026.");
  lines.push("");
  lines.push(`Registered email: ${result.email}`);
  lines.push(
    `Status: ${result.isParticipant ? "Participant" : ""}${result.isParticipant && result.isHost ? " + " : ""}${result.isHost ? "Host" : ""}`,
  );
  lines.push("");

  if (result.isHost && !result.isParticipant) {
    lines.push(
      "Note: You are registered as a host, but we could not find a matching participant registration for this email.",
    );
    lines.push(
      "All hosts should also register as participants so they are counted correctly. Please make sure you (or your family members) have also registered as participants using this email.",
    );
    lines.push("");
  }

  if (result.meetings.length > 0) {
    lines.push("Your assigned meeting(s):");
    for (const m of result.meetings) {
      const title = m.topic ?? "Meeting";
      const number = m.meetingNumber ? ` (Meeting #: ${m.meetingNumber})` : "";
      lines.push(`- ${title}${number}`);
      if (m.participantNames && m.participantNames.length > 0) {
        lines.push(
          `  Registrant name(s) for this meeting: ${m.participantNames.join(", ")}`,
        );
      }
      if (m.link) {
        lines.push(`  Meeting link: ${m.link}`);
      }
      if (m.hostEmail) {
        lines.push(`  Host email: ${m.hostEmail}`);
      }
      if (m.hostPhone) {
        lines.push(`  Host phone: ${m.hostPhone}`);
      }
      if (m.startTime) {
        lines.push(`  Start: ${m.startTime}`);
      }
    }
  } else {
    lines.push("Meeting assignment: Not found yet (if you are a host, this may be assigned later).");
  }

  if (result.isHost) {
    lines.push("");
    lines.push("Participants in your meeting(s) (from registration records):");
    const parts = result.hostMeetingParticipants ?? [];
    if (parts.length === 0) {
      lines.push(
        "(No participants are linked to your host record in the assignment map yet.)",
      );
    } else {
      lines.push("  Email | Phone | Name");
      for (const p of parts) {
        const row = displayParticipantListRow(p);
        lines.push(`  ${row.email} | ${row.phone} | ${row.name}`);
      }
    }
  }

  lines.push("");
  lines.push("If you did not request this email, you can ignore it.");

  return {
    subject: CONFIRMATION_EMAIL_SUBJECT,
    body: lines.join("\n"),
  };
}

export async function sendConfirmationEmail(result: ConfirmationLookupResult) {
  const { subject, body } = buildConfirmationEmailContent(result);
  const sendResult = await sendEmail(result.email, subject, body);
  if (!sendResult.success) {
    throw new Error(sendResult.error ?? "Failed to send email.");
  }
}
