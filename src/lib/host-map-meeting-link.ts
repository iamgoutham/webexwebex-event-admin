import {
  Prisma,
  type PrismaClient as PostgresPrismaClient,
} from "@/generated/postgres-client";
import { webexHostShortIdLookupCandidates } from "@/lib/short-id";

/**
 * Meeting fields from host↔participant map (`webex_mtng_link`, `webex_mtng_no`).
 */

const PG_SHORT_ID_BARE_MATCH = Prisma.sql`
  lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
  = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMS|CMSI|CMSJ)_', '', 'i'))
`;

export type HostMapMeetingIdentity = {
  link: string | null;
  meetingNumber: string | null;
  hostEmailLower: string;
};

function normMeetingNumber(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/\.0+$/, "");
  return s || null;
}

/** Dataverse / portal masked column text — not a join URL. */
function isDataverseHiddenLinkPlaceholder(value: string | null | undefined): boolean {
  const t = value?.trim().toLowerCase() ?? "";
  return t === "the value is hidden by portal";
}

function addMeetingIdentities(
  bucket: Map<string, HostMapMeetingIdentity>,
  rows: { link: string | null; mtng_no: unknown }[],
  hostEmailLower: string,
) {
  for (const r of rows) {
    const linkRaw = r.link?.trim();
    const link =
      linkRaw && !isDataverseHiddenLinkPlaceholder(linkRaw) ? linkRaw : null;
    const meetingNumber = normMeetingNumber(r.mtng_no);
    if (!link && !meetingNumber) continue;
    const k = `${hostEmailLower}|${link?.toLowerCase() ?? ""}|${meetingNumber ?? ""}`;
    if (!bucket.has(k)) {
      bucket.set(k, { link, meetingNumber, hostEmailLower });
    }
  }
}

async function fetchActiveNonIndiaHostShortIds(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string[]> {
  const rows = await postgres.$queryRaw<{ sid: string }[]>`
    SELECT DISTINCT btrim(h.host_unq_shortid::text) AS sid
    FROM mission.webex_hosts_non_india h
    WHERE lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
      AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      AND btrim(COALESCE(h.host_unq_shortid::text, '')) <> ''
  `;
  return rows.map((r) => r.sid);
}

async function fetchActiveIndiaHostShortIds(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string[]> {
  const rows = await postgres.$queryRaw<{ sid: string }[]>`
    SELECT DISTINCT btrim(h.host_unq_shortid::text) AS sid
    FROM vrindavan.webex_hosts_india h
    WHERE lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
      AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
      AND btrim(COALESCE(h.host_unq_shortid::text, '')) <> ''
  `;
  return rows.map((r) => r.sid);
}

/**
 * Distinct meeting link + number pairs from map rows for this organizer host email.
 */
export async function fetchHostMapMeetingIdentities(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<HostMapMeetingIdentity[]> {
  const bucket = new Map<string, HostMapMeetingIdentity>();
  const he = hostEmailLower;

  const sel = Prisma.sql`
    SELECT DISTINCT
      NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
      NULLIF(btrim(m.webex_mtng_no::text), '') AS mtng_no
  `;

  try {
    const rows = await postgres.$queryRaw<{ link: string | null; mtng_no: unknown }[]>(Prisma.sql`
      ${sel}
      FROM mission.host_prtcpnt_map_nonindia_nu m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `);
    addMeetingIdentities(bucket, rows, he);
  } catch (err) {
    console.warn(
      "[host-map-meeting-link] mission.host_prtcpnt_map_nonindia_nu by host_email_id:",
      err,
    );
  }

  const nonIndiaSids = await fetchActiveNonIndiaHostShortIds(postgres, he);
  if (nonIndiaSids.length > 0) {
    const candidateSet = new Set<string>();
    for (const sid of nonIndiaSids) {
      for (const c of webexHostShortIdLookupCandidates(sid)) {
        candidateSet.add(c);
      }
    }
    const shortConds = [...candidateSet].map(
      (c) => Prisma.sql`(btrim(m.host_unq_shortid::text) = ${c})`,
    );
    const shortWhere = Prisma.join(shortConds, " OR ");
    try {
      const rows = await postgres.$queryRaw<{ link: string | null; mtng_no: unknown }[]>(Prisma.sql`
        ${sel}
        FROM mission.host_prtcpnt_map_nonindia_nu m
        WHERE (${shortWhere})
          AND EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${he}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
      `);
      addMeetingIdentities(bucket, rows, he);
    } catch (err) {
      console.warn(
        "[host-map-meeting-link] mission.host_prtcpnt_map_nonindia_nu by short id:",
        err,
      );
    }

    try {
      const rows = await postgres.$queryRaw<{ link: string | null; mtng_no: unknown }[]>(Prisma.sql`
        ${sel}
        FROM mission.host_prtcpnt_map_crossregion m
        WHERE (${shortWhere})
          AND EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${he}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
      `);
      addMeetingIdentities(bucket, rows, he);
    } catch (err) {
      console.warn(
        "[host-map-meeting-link] mission.host_prtcpnt_map_crossregion by short id:",
        err,
      );
    }
  }

  try {
    const rows = await postgres.$queryRaw<{ link: string | null; mtng_no: unknown }[]>(Prisma.sql`
      ${sel}
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `);
    addMeetingIdentities(bucket, rows, he);
  } catch (err) {
    console.warn(
      "[host-map-meeting-link] mission.host_prtcpnt_map_crossregion by host_email_id:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ link: string | null; mtng_no: unknown }[]>(Prisma.sql`
      ${sel}
      FROM vrindavan.host_prtcpnt_map_india m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND EXISTS (
          SELECT 1
          FROM vrindavan.webex_hosts_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
    `);
    addMeetingIdentities(bucket, rows, he);
  } catch (err) {
    console.warn(
      "[host-map-meeting-link] vrindavan.host_prtcpnt_map_india by host_email_id:",
      err,
    );
  }

  const indiaSids = await fetchActiveIndiaHostShortIds(postgres, he);
  if (indiaSids.length > 0) {
    const candidateSet = new Set<string>();
    for (const sid of indiaSids) {
      for (const c of webexHostShortIdLookupCandidates(sid)) {
        candidateSet.add(c);
      }
    }
    const shortConds = [...candidateSet].map(
      (c) => Prisma.sql`(btrim(m.host_unq_shortid::text) = ${c})`,
    );
    const shortWhere = Prisma.join(shortConds, " OR ");
    try {
      const rows = await postgres.$queryRaw<{ link: string | null; mtng_no: unknown }[]>(Prisma.sql`
        ${sel}
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE (${shortWhere})
          AND EXISTS (
            SELECT 1
            FROM vrindavan.webex_hosts_india h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${he}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
      `);
      addMeetingIdentities(bucket, rows, he);
    } catch (err) {
      console.warn(
        "[host-map-meeting-link] vrindavan.host_prtcpnt_map_india by short id:",
        err,
      );
    }
  }

  return [...bucket.values()];
}

/** Distinct displayable Webex URLs for dashboard fallbacks. */
export async function fetchDistinctWebexLinksFromHostMaps(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string[]> {
  const ids = await fetchHostMapMeetingIdentities(postgres, hostEmailLower);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const L = id.link?.trim();
    if (!L) continue;
    const k = L.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(L);
  }
  return out;
}

/** Sheet cells sometimes hold placeholders ("TBD", "hidden by portal") — not join URLs. */
function looksLikeWebexJoinUrl(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s) && /webex\.com/i.test(s);
}

/** Use for confirmation email / API: null unless value is a real https Webex join URL. */
export function coerceDisplayableWebexJoinLink(
  value: string | null | undefined,
): string | null {
  const s = value?.trim();
  if (!s) return null;
  if (isDataverseHiddenLinkPlaceholder(s)) return null;
  if (!looksLikeWebexJoinUrl(s)) return null;
  return s;
}

/**
 * Sheet / JSON `webLink` wins when it looks like a real Webex join URL; otherwise
 * use map `webex_mtng_link` values (single distinct link, or first when one card).
 */
export function effectiveHostMeetingWebLink(
  sheetWebLink: string | undefined | null,
  mapLinks: string[],
  totalMeetingCards: number,
): string | undefined {
  const s = sheetWebLink?.trim();
  if (s && looksLikeWebexJoinUrl(s)) return s;
  if (mapLinks.length === 1) return mapLinks[0];
  if (totalMeetingCards === 1 && mapLinks.length > 0) return mapLinks[0];
  return undefined;
}
