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

/** Mission (non-India) vs Vrindavan (India) registration records — used for WhatsApp country codes. */
export type RegistrationRegion = "india" | "non_india" | "both";

export type ConfirmationLookupResult = {
  valid: boolean;
  email: string;
  isHost: boolean;
  isParticipant: boolean;
  displayName: string | null;
  meetings: MeetingAssignment[];
  /** Populated when {@link isHost}; emails/phones from participant tables. */
  hostMeetingParticipants: HostMeetingParticipant[];
  registrationRegion: RegistrationRegion;
};

export type ConfirmationLookupWithWhatsappDigits = ConfirmationLookupResult & {
  /** E.164-style digits only (no `+`), for WATI after country-code correction from {@link registrationRegion}. */
  whatsappDialDigits: string;
};

function normMeetingNumber(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/\.0+$/, "");
  return s || null;
}

function meetingDedupeKey(m: MeetingAssignment): string {
  return [
    m.meetingNumber ?? "",
    m.startTime ?? "",
    m.endTime ?? "",
    m.topic ?? "",
    m.hostEmail ?? "",
  ].join("|");
}

function meetingCompletenessScore(m: MeetingAssignment): number {
  return (
    (m.link ? 8 : 0) +
    (m.meetingNumber ? 4 : 0) +
    (m.topic ? 2 : 0) +
    (m.startTime ? 1 : 0) +
    (m.endTime ? 1 : 0)
  );
}

function dedupeMeetingsPreferLinked(
  meetings: MeetingAssignment[],
): MeetingAssignment[] {
  const byKey = new Map<string, MeetingAssignment>();
  for (const m of meetings) {
    const k = meetingDedupeKey(m);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, m);
      continue;
    }
    // Keep the richer variant when duplicate rows differ by hidden/missing link.
    if (meetingCompletenessScore(m) > meetingCompletenessScore(prev)) {
      byKey.set(k, m);
    }
  }
  return [...byKey.values()];
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

type GchantTopicIdentity = {
  meetingNumber: string | null;
  link: string | null;
  topic: string;
};

async function fetchHostGchantTopics(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<GchantTopicIdentity[]> {
  const rows = await postgres.$queryRaw<
    { mtng_no: unknown; link: string | null; topic: string | null }[]
  >`
    SELECT DISTINCT
      NULLIF(btrim(g.webex_mtng_no::text), '') AS mtng_no,
      NULLIF(btrim(g.webex_mtng_link::text), '') AS link,
      NULLIF(btrim(g.topic::text), '') AS topic
    FROM mission.gchant_mtng g
    WHERE lower(btrim(g.organizer_email::text)) = ${hostEmailLower}
    UNION
    SELECT DISTINCT
      NULLIF(btrim(g.webex_mtng_no::text), '') AS mtng_no,
      NULLIF(btrim(g.webex_mtng_link::text), '') AS link,
      NULLIF(btrim(g.topic::text), '') AS topic
    FROM vrindavan.gchant_mtng g
    WHERE lower(btrim(g.organizer_email::text)) = ${hostEmailLower}
  `;

  return rows
    .map((r) => ({
      meetingNumber: normMeetingNumber(r.mtng_no),
      link: coerceDisplayableWebexJoinLink(r.link),
      topic: r.topic?.trim() ?? "",
    }))
    .filter((r) => r.topic.length > 0 && (r.meetingNumber || r.link));
}

function topicFromGchant(
  identity: HostMapMeetingIdentity,
  gchantTopics: GchantTopicIdentity[],
): string | null {
  if (identity.meetingNumber) {
    const byNumber = gchantTopics.find(
      (r) => r.meetingNumber === identity.meetingNumber,
    );
    if (byNumber?.topic) return byNumber.topic;
  }
  const idLink = coerceDisplayableWebexJoinLink(identity.link)?.toLowerCase();
  if (idLink) {
    const byLink = gchantTopics.find(
      (r) => r.link?.toLowerCase() === idLink,
    );
    if (byLink?.topic) return byLink.topic;
  }
  return null;
}

function mapAndSheetToAssignment(
  identity: HostMapMeetingIdentity,
  sheet: SheetMeeting | null,
  gchantTopics: GchantTopicIdentity[],
  hostEmail: string,
  hostPhone: string | null,
): MeetingAssignment {
  const mapLink = coerceDisplayableWebexJoinLink(identity.link);
  const sheetLink = sheet
    ? coerceDisplayableWebexJoinLink(sheet.webLink)
    : null;
  const link = mapLink ?? sheetLink ?? null;
  const gchantTopic = topicFromGchant(identity, gchantTopics);
  return {
    topic: gchantTopic ?? sheet?.title?.trim() ?? null,
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

/**
 * Host dashboard: same meeting rows as confirm-registration — merges Postgres map
 * rows with Google Sheet "Meeting Info" JSON so map-supplied {@link HostMapMeetingIdentity.link}
 * is used when the sheet omits or masks the Webex URL (dashboard previously only applied
 * sheet `webLink` + a coarse map fallback).
 */
export async function getHostDashboardMeetings(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<{
  assignments: MeetingAssignment[];
  sheetMeetings: SheetMeeting[];
  meetingInfoRaw: string | null;
}> {
  const meetingInfoRaw = await getMeetingInfoForEmail(hostEmailLower);
  const sheetMeetings = meetingInfoRaw
    ? parseMeetingInfoJson(meetingInfoRaw) ?? []
    : [];

  const hostPhone = await lookupHostPhone(postgres, hostEmailLower);
  const identities = await fetchHostMapMeetingIdentities(
    postgres,
    hostEmailLower,
  );
  const gchantTopics = await fetchHostGchantTopics(postgres, hostEmailLower);

  const collected: MeetingAssignment[] = [];

  if (identities.length > 0) {
    for (const id of identities) {
      const sheetRow = findSheetMeetingForIdentity(sheetMeetings, id);
      collected.push(
        mapAndSheetToAssignment(
          id,
          sheetRow,
          gchantTopics,
          hostEmailLower,
          hostPhone,
        ),
      );
    }
  }

  if (identities.length === 0 && sheetMeetings.length > 0) {
    for (const sm of sheetMeetings) {
      collected.push(sheetMeetingToAssignment(sm, hostEmailLower, hostPhone));
    }
  }

  const assignments = dedupeMeetingsPreferLinked(collected);

  assignments.sort((a, b) => {
    const ta = a.startTime ?? "";
    const tb = b.startTime ?? "";
    return ta.localeCompare(tb);
  });

  return { assignments, sheetMeetings, meetingInfoRaw };
}

async function lookupHostPhone(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string | null> {
  const [r1, r2, r3, r4] = await Promise.all([
    postgres.$queryRaw<{ phone: string | null }[]>`
      SELECT host_phone_no::text AS phone
      FROM mission.webex_hosts_non_india
      WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
        AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
      LIMIT 1
    `,
    postgres.$queryRaw<{ phone: string | null }[]>`
      SELECT host_phone_no::text AS phone
      FROM mission.webex_hosts_non_india_gp
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
    (async (): Promise<{ phone: string | null }[]> => {
      try {
        return await postgres.$queryRaw<{ phone: string | null }[]>`
          SELECT host_phone_no::text AS phone
          FROM mission.webex_hosts_non_india_dattap
          WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
            AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
          LIMIT 1
        `;
      } catch {
        return [];
      }
    })(),
  ]);
  const p =
    r1[0]?.phone?.trim() ||
    r2[0]?.phone?.trim() ||
    r4[0]?.phone?.trim() ||
    r3[0]?.phone?.trim();
  return p || null;
}

/**
 * Host emails tied to a participant via downstream map tables
 * (`mission.host_prtcpnt_map_nonindia_nu`, `mission.host_prtcpnt_map_nonindia_gp`,
 * `mission.host_prtcpnt_map_nonindia_gp_overages`, `mission.host_prtcpnt_map_nonindia_nu_overages`,
 * `mission.host_prtcpnt_map_crossregion`, `vrindavan.host_prtcpnt_map_india`).
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
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
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

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_gp m
      INNER JOIN mission.webex_hosts_non_india_gp h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_gp join failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_gp m
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
        AND m.host_email_id IS NOT NULL
        AND btrim(m.host_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india_gp h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_gp host_email_id failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_gp_overages m
      INNER JOIN mission.webex_hosts_non_india_gp h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_gp_overages join failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_gp_overages m
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
        AND m.host_email_id IS NOT NULL
        AND btrim(m.host_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india_gp h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_gp_overages host_email_id failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_nu_overages m
      INNER JOIN mission.webex_hosts_non_india h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_nu_overages join failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_nu_overages m
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
      "[confirm-registration] mission host_prtcpnt_map_nonindia_nu_overages host_email_id failed:",
      err,
    );
  }

  // mission.host_prtcpnt_map_crossregion → mission.webex_hosts_non_india (student / ind_* or prtcpnt_* columns)
  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_crossregion m
      INNER JOIN mission.webex_hosts_non_india h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
      UNION
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_crossregion m
      INNER JOIN mission.webex_hosts_non_india_gp h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
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
          ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
           = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
        UNION
        SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
        FROM mission.host_prtcpnt_map_crossregion m
        INNER JOIN mission.webex_hosts_non_india_gp h
          ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
           = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
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
        AND (
          EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india h
            WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
          OR EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india_gp h
            WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
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
          AND (
            EXISTS (
              SELECT 1
              FROM mission.webex_hosts_non_india h
              WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
            )
            OR EXISTS (
              SELECT 1
              FROM mission.webex_hosts_non_india_gp h
              WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
            )
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
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
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
          ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
           = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
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

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM vrindavan.host_prtctpnt_map_india_overages m
      INNER JOIN vrindavan.webex_hosts_india h
        ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
       AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch {
    try {
      const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
        SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
        FROM vrindavan.host_prtctpnt_map_india_overages m
        INNER JOIN vrindavan.webex_hosts_india h
          ON lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
           = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
         AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[confirm-registration] vrindavan host_prtctpnt_map_india_overages join failed:",
        err,
      );
    }
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM vrindavan.host_prtctpnt_map_india_overages m
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
        FROM vrindavan.host_prtctpnt_map_india_overages m
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
        "[confirm-registration] vrindavan host_prtctpnt_map_india_overages host_email_id failed:",
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
  const [
    hostNonIndia,
    hostNonIndiaGp,
    hostNonIndiaDattap,
    hostIndia,
    nonIndiaRows,
    nonIndiaGpRows,
    nonIndiaGpOveragesRows,
    indiaRows,
    indiaOveragesRows,
    indiaStudentRows,
  ] = await Promise.all([
    postgres.$queryRaw<{ host_first_name: string | null; host_last_name: string | null }[]>`
      SELECT host_first_name, host_last_name
      FROM mission.webex_hosts_non_india
      WHERE lower(btrim(host_email_id::text)) = ${email}
        AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
      LIMIT 1
    `,
    (async (): Promise<
      { host_first_name: string | null; host_last_name: string | null }[]
    > => {
      try {
        return await postgres.$queryRaw<
          { host_first_name: string | null; host_last_name: string | null }[]
        >`
          SELECT host_first_name, host_last_name
          FROM mission.webex_hosts_non_india_gp
          WHERE lower(btrim(host_email_id::text)) = ${email}
            AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
          LIMIT 1
        `;
      } catch {
        return [];
      }
    })(),
    (async (): Promise<
      { host_first_name: string | null; host_last_name: string | null }[]
    > => {
      try {
        return await postgres.$queryRaw<
          { host_first_name: string | null; host_last_name: string | null }[]
        >`
          SELECT host_first_name, host_last_name
          FROM mission.webex_hosts_non_india_dattap
          WHERE lower(btrim(host_email_id::text)) = ${email}
            AND btrim(COALESCE(webex_active_ind::text, '')) = 'Y'
          LIMIT 1
        `;
      } catch {
        return [];
      }
    })(),
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
    (async (): Promise<{ prtcpnt_name: string | null }[]> => {
      try {
        return await postgres.$queryRaw<{ prtcpnt_name: string | null }[]>`
          SELECT prtcpnt_name::text AS prtcpnt_name
          FROM mission.webex_participants_non_india_gp
          WHERE lower(btrim(prtcpnt_email_id::text)) = ${email}
        `;
      } catch {
        return [];
      }
    })(),
    (async (): Promise<{ prtcpnt_name: string | null }[]> => {
      try {
        return await postgres.$queryRaw<{ prtcpnt_name: string | null }[]>`
          SELECT prtcpnt_name::text AS prtcpnt_name
          FROM mission.webex_participants_non_india_gp_overages
          WHERE lower(btrim(prtcpnt_email_id::text)) = ${email}
        `;
      } catch {
        return [];
      }
    })(),
    postgres.indiaParticipant.findMany({
      where: { indPrtcpntEmailId: email },
      select: { indPrtcpntName: true },
    }),
    (async (): Promise<{ ind_prtcpnt_name: string | null }[]> => {
      try {
        return await postgres.$queryRaw<{ ind_prtcpnt_name: string | null }[]>`
          SELECT ind_prtcpnt_name::text AS ind_prtcpnt_name
          FROM vrindavan.webex_participants_india_overages
          WHERE lower(btrim(ind_prtcpnt_email_id::text)) = ${email}
        `;
      } catch {
        try {
          return await postgres.$queryRaw<{ ind_prtcpnt_name: string | null }[]>`
            SELECT prtcpnt_name::text AS ind_prtcpnt_name
            FROM vrindavan.webex_participants_india_overages
            WHERE lower(btrim(prtcpnt_email_id::text)) = ${email}
          `;
        } catch {
          return [];
        }
      }
    })(),
    postgres.$queryRaw<{ ind_prtcpnt_name: string | null }[]>`
      SELECT ind_prtcpnt_name
      FROM vrindavan.webex_participants_india_students
      WHERE lower(btrim(ind_prtcpnt_email_id::text)) = ${email}
    `,
  ]);

  const isHost =
    hostNonIndia.length > 0 ||
    hostNonIndiaGp.length > 0 ||
    hostNonIndiaDattap.length > 0 ||
    hostIndia.length > 0;
  const isParticipant = Boolean(
    nonIndiaRows.length > 0 ||
      nonIndiaGpRows.length > 0 ||
      nonIndiaGpOveragesRows.length > 0 ||
      indiaRows.length > 0 ||
      indiaOveragesRows.length > 0 ||
      indiaStudentRows.length > 0,
  );

  const participantNameParts: string[] = [];
  for (const r of nonIndiaRows) {
    const n = r.prtcpntName?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of nonIndiaGpRows) {
    const n = r.prtcpnt_name?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of nonIndiaGpOveragesRows) {
    const n = r.prtcpnt_name?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of indiaRows) {
    const n = r.indPrtcpntName?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of indiaOveragesRows) {
    const n = r.ind_prtcpnt_name?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of indiaStudentRows) {
    const n = r.ind_prtcpnt_name?.trim();
    if (n) participantNameParts.push(n);
  }

  const hostRowNonIndia = hostNonIndia[0] ?? hostNonIndiaGp[0] ?? hostNonIndiaDattap[0];
  const hostNameFallback =
    hostRowNonIndia?.host_first_name || hostRowNonIndia?.host_last_name
      ? `${hostRowNonIndia?.host_first_name ?? ""} ${hostRowNonIndia?.host_last_name ?? ""}`.trim()
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
      const [phones, identityLists, gchantTopicLists] = await Promise.all([
        Promise.all(hostList.map((h) => lookupHostPhone(postgres, h))),
        Promise.all(
          hostList.map((h) => fetchHostMapMeetingIdentities(postgres, h)),
        ),
        Promise.all(hostList.map((h) => fetchHostGchantTopics(postgres, h))),
      ]);
      for (let i = 0; i < hostList.length; i++) {
        const H = hostList[i];
        const hostPhone = phones[i];
        const identities = identityLists[i];
        const gchantTopics = gchantTopicLists[i];
        if (identities.length > 0) anyMapIdentity = true;
        for (const id of identities) {
          const sheetRow = findSheetMeetingForIdentity(sheetMeetings, id);
          collected.push(
            mapAndSheetToAssignment(id, sheetRow, gchantTopics, H, hostPhone),
          );
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

  let meetings = dedupeMeetingsPreferLinked(collected);

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

  const hasIndiaPresence =
    hostIndia.length > 0 ||
    indiaRows.length > 0 ||
    indiaOveragesRows.length > 0 ||
    indiaStudentRows.length > 0;
  const hasNonIndiaPresence =
    hostNonIndia.length > 0 ||
    hostNonIndiaGp.length > 0 ||
    hostNonIndiaDattap.length > 0 ||
    nonIndiaRows.length > 0 ||
    nonIndiaGpRows.length > 0 ||
    nonIndiaGpOveragesRows.length > 0;

  let registrationRegion: RegistrationRegion;
  if (hasIndiaPresence && hasNonIndiaPresence) registrationRegion = "both";
  else if (hasIndiaPresence) registrationRegion = "india";
  else registrationRegion = "non_india";

  return {
    valid: isHost || isParticipant,
    email,
    isHost,
    isParticipant,
    displayName,
    meetings,
    hostMeetingParticipants,
    registrationRegion,
  };
}

const onlyDigits = (value: string) => value.replace(/[^0-9]/g, "");

/**
 * Normalize subscriber digits for WATI given mission (NANP +1) vs India (+91) registration.
 */
export function applyWhatsappCountryCode(
  digitsInput: string,
  country: "1" | "91",
): string {
  const d = onlyDigits(digitsInput);
  if (d.length < 10) return d;

  if (country === "91") {
    if (d.startsWith("91") && d.length >= 12) {
      const rest = d.slice(2);
      return /^[0-9]{10}$/.test(rest)
        ? `91${rest}`
        : `91${rest.slice(-10)}`;
    }
    const national =
      d.length >= 11 && d.startsWith("0") ? d.slice(-10) : d.slice(-10);
    return /^[0-9]{10}$/.test(national) ? `91${national}` : `91${d.slice(-10)}`;
  }

  if (d.length === 11 && d.startsWith("1")) return d;
  if (d.length === 10 && !d.startsWith("0")) return `1${d}`;
  const last10 = d.slice(-10);
  return `1${last10}`;
}

async function missionEmailPhoneMatched(
  postgres: PostgresPrismaClient,
  emailLower: string,
  digits: string,
  last10: string,
): Promise<boolean> {
  const probes: Array<Promise<{ c: bigint }[]>> = [
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM mission.webex_hosts_non_india
      WHERE lower(btrim(host_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM mission.webex_hosts_non_india_gp
      WHERE lower(btrim(host_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM mission.webex_hosts_non_india_dattap
      WHERE lower(btrim(host_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM mission.webex_participants_non_india_old
      WHERE lower(btrim(prtcpnt_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM mission.webex_participants_non_india_gp
      WHERE lower(btrim(prtcpnt_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM mission.webex_participants_non_india_gp_overages
      WHERE lower(btrim(prtcpnt_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM mission.webex_participants_non_india_old_raw
      WHERE lower(btrim(email::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(contact_phone__whatsapp_::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(contact_phone__whatsapp_::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
  ];

  for (const p of probes) {
    try {
      const rows = await p;
      if (Number(rows[0]?.c ?? 0) > 0) return true;
    } catch {
      // Optional table variants.
    }
  }
  return false;
}

async function indiaEmailPhoneMatched(
  postgres: PostgresPrismaClient,
  emailLower: string,
  digits: string,
  last10: string,
): Promise<boolean> {
  const probes: Array<Promise<{ c: bigint }[]>> = [
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM vrindavan.webex_hosts_india
      WHERE lower(btrim(host_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(host_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM vrindavan.webex_participants_india_overages
      WHERE lower(btrim(ind_prtcpnt_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(ind_prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(ind_prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM vrindavan.webex_participants_india_overages
      WHERE lower(btrim(prtcpnt_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
    postgres.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM vrindavan.webex_participants_india_students
      WHERE lower(btrim(ind_prtcpnt_email_id::text)) = ${emailLower}
        AND (
          regexp_replace(btrim(COALESCE(ind_prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(ind_prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      LIMIT 1
    `,
  ];

  for (const p of probes) {
    try {
      const rows = await p;
      if (Number(rows[0]?.c ?? 0) > 0) return true;
    } catch {
      // Optional schema / table variants per environment.
    }
  }
  return false;
}

async function resolveWhatsappDialDigitsForRegistration(
  postgres: PostgresPrismaClient,
  emailLower: string,
  submittedDigits: string,
  registrationRegion: RegistrationRegion,
): Promise<string> {
  const digits = onlyDigits(submittedDigits);
  if (digits.length < 10) return digits;
  const last10 = digits.slice(-10);

  let country: "1" | "91";
  if (registrationRegion === "india") {
    country = "91";
  } else if (registrationRegion === "non_india") {
    country = "1";
  } else {
    const [mission, india] = await Promise.all([
      missionEmailPhoneMatched(postgres, emailLower, digits, last10),
      indiaEmailPhoneMatched(postgres, emailLower, digits, last10),
    ]);
    if (india && !mission) country = "91";
    else if (mission && !india) country = "1";
    else if (india && mission) {
      country = /^[6-9]/.test(last10) ? "91" : "1";
    } else {
      country = /^[6-9]/.test(last10) ? "91" : "1";
    }
  }

  return applyWhatsappCountryCode(digits, country);
}

async function collectEmailsByPhone(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<string[]> {
  const digits = onlyDigits(phoneRaw);
  if (digits.length < 10) return [];
  const last10 = digits.slice(-10);
  const out = new Set<string>();

  const add = (rows: { email: string | null }[]) => {
    for (const r of rows) {
      const e = r.email?.trim().toLowerCase();
      if (e) out.add(e);
    }
  };

  const phoneMatchesSql = (columnSql: string) => `
    (
      regexp_replace(btrim(COALESCE(${columnSql}::text, '')), '[^0-9]', '', 'g') = '${digits}'
      OR right(regexp_replace(btrim(COALESCE(${columnSql}::text, '')), '[^0-9]', '', 'g'), 10) = '${last10}'
    )
  `;

  const run = async (query: string) => {
    try {
      const rows = await postgres.$queryRawUnsafe<{ email: string | null }[]>(query);
      add(rows);
    } catch {
      // Optional table variations by environment.
    }
  };

  await run(`
    SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
    FROM mission.webex_hosts_non_india
    WHERE ${phoneMatchesSql("host_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
    FROM mission.webex_hosts_non_india_gp
    WHERE ${phoneMatchesSql("host_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
    FROM mission.webex_hosts_non_india_dattap
    WHERE ${phoneMatchesSql("host_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
    FROM vrindavan.webex_hosts_india
    WHERE ${phoneMatchesSql("host_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(prtcpnt_email_id::text)) AS email
    FROM mission.webex_participants_non_india_old
    WHERE ${phoneMatchesSql("prtcpnt_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(prtcpnt_email_id::text)) AS email
    FROM mission.webex_participants_non_india_gp
    WHERE ${phoneMatchesSql("prtcpnt_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(prtcpnt_email_id::text)) AS email
    FROM mission.webex_participants_non_india_gp_overages
    WHERE ${phoneMatchesSql("prtcpnt_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(ind_prtcpnt_email_id::text)) AS email
    FROM vrindavan.webex_participants_india_overages
    WHERE ${phoneMatchesSql("ind_prtcpnt_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(prtcpnt_email_id::text)) AS email
    FROM vrindavan.webex_participants_india_overages
    WHERE ${phoneMatchesSql("prtcpnt_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(ind_prtcpnt_email_id::text)) AS email
    FROM vrindavan.webex_participants_india_students
    WHERE ${phoneMatchesSql("ind_prtcpnt_phone_no")}
  `);
  await run(`
    SELECT DISTINCT lower(btrim(email::text)) AS email
    FROM mission.webex_participants_non_india_old_raw
    WHERE ${phoneMatchesSql("contact_phone__whatsapp_")}
  `);
  return [...out].sort();
}

export async function lookupConfirmationByPhone(
  phoneRaw: string,
): Promise<ConfirmationLookupWithWhatsappDigits | null> {
  const postgres = getPostgresPrisma();
  if (!postgres) {
    throw new Error("Downstream database is not configured.");
  }
  const emails = await collectEmailsByPhone(postgres, phoneRaw);
  const inputDigits = onlyDigits(phoneRaw);
  for (const email of emails) {
    const result = await lookupConfirmation(email);
    if (result.valid) {
      const whatsappDialDigits = await resolveWhatsappDialDigitsForRegistration(
        postgres,
        email,
        inputDigits,
        result.registrationRegion,
      );
      return { ...result, whatsappDialDigits };
    }
  }
  return null;
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
