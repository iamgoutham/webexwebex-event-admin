import {
  Prisma,
  type PrismaClient as PostgresPrismaClient,
} from "@/generated/postgres-client";
import { coerceDisplayableWebexJoinLink } from "@/lib/host-map-meeting-link";
import { webexHostShortIdLookupCandidates } from "@/lib/short-id";

/** Participants mapped to this host in host↔participant map tables. */
export type HostMeetingParticipant = {
  email: string;
  phone: string | null;
  name: string | null;
};

/** One row from host↔participant map: email + name + phone as stored on the map. */
export type HostMapParticipantRef = {
  email: string;
  mapName: string | null;
  /** `prtcpnt_phone_no` / `ind_prtcpnt_phone_no` from the map row */
  mapPhone: string | null;
  /**
   * Earliest `rec_create_tstmp` among map rows for this email+name key (ms since epoch).
   * Used only to order the meetings roster; not shown in the UI.
   */
  recCreateTstmpMs: number | null;
};

function toRecCreateTstmpMs(
  value: Date | null | undefined,
): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function normalizeParticipantNameKey(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** When map has no name, any DB row for that email matches; otherwise names must match (normalized). */
function mapNameMatchesDb(
  mapName: string | null | undefined,
  dbName: string | null | undefined,
): boolean {
  const mk = normalizeParticipantNameKey(mapName);
  if (!mk) return true;
  return normalizeParticipantNameKey(dbName) === mk;
}

function formatParticipantPhone(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.replace(/\.0+$/, "");
}

function addMapRefPair(
  bucket: Map<string, HostMapParticipantRef>,
  email: string | null | undefined,
  mapNameRaw: string | null | undefined,
  mapPhoneRaw: string | null | undefined,
  recCreateTstmp: Date | null | undefined,
) {
  const e = email?.trim().toLowerCase();
  if (!e) return;
  const mapName = mapNameRaw?.trim() ? mapNameRaw.trim() : null;
  const mapPhone = formatParticipantPhone(mapPhoneRaw);
  const key = `${e}\0${normalizeParticipantNameKey(mapName)}`;
  const ms = toRecCreateTstmpMs(recCreateTstmp ?? null);
  const existing = bucket.get(key);
  if (!existing) {
    bucket.set(key, { email: e, mapName, mapPhone, recCreateTstmpMs: ms });
    return;
  }
  if (ms != null) {
    if (
      existing.recCreateTstmpMs == null ||
      ms < existing.recCreateTstmpMs
    ) {
      existing.recCreateTstmpMs = ms;
    }
  }
}

/**
 * Map rows use `host_unq_shortid` (no `host_lic_site`). Values may be stored with or
 * without a `CMSG_` / `CMS_` / `CMSI_` / `CMSJ_` prefix; we match using {@link webexHostShortIdLookupCandidates}
 * and SQL bare-id comparison.
 */
const PG_SHORT_ID_BARE_MATCH = Prisma.sql`
  lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
  = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
`;

type CrossregionMapRow = {
  email: string | null;
  map_name: string | null;
  map_phone: string | null;
  rec_create_tstmp: Date | null;
};

/**
 * mission.host_prtcpnt_map_crossregion — non-India hosts with India student (or
 * shared-schema) participants. Participant columns are often ind_* (student
 * tables); some builds use prtcpnt_* like host_prtcpnt_map_nonindia_nu.
 */
async function fetchCrossregionMapByShortWhere(
  postgres: PostgresPrismaClient,
  shortWhere: Prisma.Sql,
  hostEmailLower: string,
): Promise<CrossregionMapRow[]> {
  try {
    return await postgres.$queryRaw<CrossregionMapRow[]>(Prisma.sql`
      SELECT
        lower(btrim(m.ind_prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS map_name,
        NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '') AS map_phone,
        MIN(m.rec_create_tstmp) AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE (${shortWhere})
        AND m.ind_prtcpnt_email_id IS NOT NULL
        AND btrim(m.ind_prtcpnt_email_id::text) <> ''
        AND (
          EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
          OR EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india_gp h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
        )
      GROUP BY
        lower(btrim(m.ind_prtcpnt_email_id::text)),
        NULLIF(btrim(m.ind_prtcpnt_name::text), ''),
        NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '')
    `);
  } catch {
    return await postgres.$queryRaw<CrossregionMapRow[]>(Prisma.sql`
      SELECT
        lower(btrim(m.prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
        NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
        MIN(m.rec_create_tstmp) AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE (${shortWhere})
        AND m.prtcpnt_email_id IS NOT NULL
        AND btrim(m.prtcpnt_email_id::text) <> ''
        AND (
          EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
          OR EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india_gp h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
        )
      GROUP BY
        lower(btrim(m.prtcpnt_email_id::text)),
        NULLIF(btrim(m.prtcpnt_name::text), ''),
        NULLIF(btrim(m.prtcpnt_phone_no::text), '')
    `);
  }
}

async function fetchCrossregionMapByHostEmailId(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<CrossregionMapRow[]> {
  try {
    return await postgres.$queryRaw<CrossregionMapRow[]>`
      SELECT
        lower(btrim(m.ind_prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS map_name,
        NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '') AS map_phone,
        MIN(m.rec_create_tstmp) AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE lower(btrim(m.host_email_id::text)) = ${hostEmailLower}
        AND m.ind_prtcpnt_email_id IS NOT NULL
        AND btrim(m.ind_prtcpnt_email_id::text) <> ''
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
      GROUP BY
        lower(btrim(m.ind_prtcpnt_email_id::text)),
        NULLIF(btrim(m.ind_prtcpnt_name::text), ''),
        NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '')
    `;
  } catch {
    return await postgres.$queryRaw<CrossregionMapRow[]>`
      SELECT
        lower(btrim(m.prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
        NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
        MIN(m.rec_create_tstmp) AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE lower(btrim(m.host_email_id::text)) = ${hostEmailLower}
        AND m.prtcpnt_email_id IS NOT NULL
        AND btrim(m.prtcpnt_email_id::text) <> ''
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
      GROUP BY
        lower(btrim(m.prtcpnt_email_id::text)),
        NULLIF(btrim(m.prtcpnt_name::text), ''),
        NULLIF(btrim(m.prtcpnt_phone_no::text), '')
    `;
  }
}

async function fetchActiveNonIndiaHostShortIds(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string[]> {
  const [rowsNu, rowsGp] = await Promise.all([
    postgres.$queryRaw<{ sid: string }[]>`
      SELECT DISTINCT btrim(h.host_unq_shortid::text) AS sid
      FROM mission.webex_hosts_non_india h
      WHERE lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
        AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        AND btrim(COALESCE(h.host_unq_shortid::text, '')) <> ''
    `,
    postgres.$queryRaw<{ sid: string }[]>`
      SELECT DISTINCT btrim(h.host_unq_shortid::text) AS sid
      FROM mission.webex_hosts_non_india_gp h
      WHERE lower(btrim(h.host_email_id::text)) = ${hostEmailLower}
        AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        AND btrim(COALESCE(h.host_unq_shortid::text, '')) <> ''
    `,
  ]);
  const out = new Set<string>();
  for (const r of rowsNu) {
    const s = r.sid?.trim();
    if (s) out.add(s);
  }
  for (const r of rowsGp) {
    const s = r.sid?.trim();
    if (s) out.add(s);
  }
  return [...out];
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
 * Participant email + name from host↔participant map tables (mission / vrindavan).
 * Includes `mission.host_prtcpnt_map_crossregion` (non-India host ↔ student participants).
 * Primary path: map rows whose `host_unq_shortid` matches an active host for this email.
 * Fallback: map rows keyed by `host_email_id`.
 */
export async function collectParticipantRefsForHost(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<HostMapParticipantRef[]> {
  const bucket = new Map<string, HostMapParticipantRef>();
  const he = hostEmailLower;

  const [nonIndiaShortIds, indiaShortIds] = await Promise.all([
    fetchActiveNonIndiaHostShortIds(postgres, he),
    fetchActiveIndiaHostShortIds(postgres, he),
  ]);

  if (nonIndiaShortIds.length > 0) {
    const nonIndiaCandidateSet = new Set<string>();
    for (const sid of nonIndiaShortIds) {
      for (const c of webexHostShortIdLookupCandidates(sid)) {
        nonIndiaCandidateSet.add(c);
      }
    }
    const nonIndiaShortConds = [...nonIndiaCandidateSet].map(
      (c) => Prisma.sql`(btrim(m.host_unq_shortid::text) = ${c})`,
    );
    const nonIndiaShortWhere = Prisma.join(nonIndiaShortConds, " OR ");

    try {
      const rows = await postgres.$queryRaw<
        {
          email: string | null;
          map_name: string | null;
          map_phone: string | null;
          rec_create_tstmp: Date | null;
        }[]
      >(Prisma.sql`
        SELECT
          lower(btrim(m.prtcpnt_email_id::text)) AS email,
          NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
          NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
          MIN(m.rec_create_tstmp) AS rec_create_tstmp
        FROM mission.host_prtcpnt_map_nonindia_nu m
        WHERE (${nonIndiaShortWhere})
          AND m.prtcpnt_email_id IS NOT NULL
          AND btrim(m.prtcpnt_email_id::text) <> ''
          AND EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${he}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
        GROUP BY
          lower(btrim(m.prtcpnt_email_id::text)),
          NULLIF(btrim(m.prtcpnt_name::text), ''),
          NULLIF(btrim(m.prtcpnt_phone_no::text), '')
      `);
      for (const r of rows)
        addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
    } catch (err) {
      console.warn("[host-meeting-participants] mission map by full host id failed:", err);
    }

    try {
      const rows = await postgres.$queryRaw<
        {
          email: string | null;
          map_name: string | null;
          map_phone: string | null;
          rec_create_tstmp: Date | null;
        }[]
      >(Prisma.sql`
        SELECT
          lower(btrim(m.prtcpnt_email_id::text)) AS email,
          NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
          NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
          MIN(m.rec_create_tstmp) AS rec_create_tstmp
        FROM mission.host_prtcpnt_map_nonindia_gp m
        WHERE (${nonIndiaShortWhere})
          AND m.prtcpnt_email_id IS NOT NULL
          AND btrim(m.prtcpnt_email_id::text) <> ''
          AND EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india_gp h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${he}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
        GROUP BY
          lower(btrim(m.prtcpnt_email_id::text)),
          NULLIF(btrim(m.prtcpnt_name::text), ''),
          NULLIF(btrim(m.prtcpnt_phone_no::text), '')
      `);
      for (const r of rows)
        addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
    } catch (err) {
      console.warn(
        "[host-meeting-participants] mission host_prtcpnt_map_nonindia_gp by short id failed:",
        err,
      );
    }

    try {
      const crRows = await fetchCrossregionMapByShortWhere(
        postgres,
        nonIndiaShortWhere,
        he,
      );
      for (const r of crRows)
        addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
    } catch (err) {
      console.warn(
        "[host-meeting-participants] mission host_prtcpnt_map_crossregion by short id failed:",
        err,
      );
    }
  }

  if (indiaShortIds.length > 0) {
    const candidateSet = new Set<string>();
    for (const sid of indiaShortIds) {
      for (const c of webexHostShortIdLookupCandidates(sid)) {
        candidateSet.add(c);
      }
    }
    const shortConds = [...candidateSet].map(
      (c) => Prisma.sql`(btrim(m.host_unq_shortid::text) = ${c})`,
    );
    const shortWhere = Prisma.join(shortConds, " OR ");
    try {
      const rows = await postgres.$queryRaw<
        {
          email: string | null;
          map_name: string | null;
          map_phone: string | null;
          rec_create_tstmp: Date | null;
        }[]
      >(Prisma.sql`
        SELECT
          lower(btrim(m.ind_prtcpnt_email_id::text)) AS email,
          NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS map_name,
          NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '') AS map_phone,
          MIN(m.rec_create_tstmp) AS rec_create_tstmp
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE (${shortWhere})
          AND m.ind_prtcpnt_email_id IS NOT NULL
          AND btrim(m.ind_prtcpnt_email_id::text) <> ''
          AND EXISTS (
            SELECT 1
            FROM vrindavan.webex_hosts_india h
            WHERE ${PG_SHORT_ID_BARE_MATCH}
              AND lower(btrim(h.host_email_id::text)) = ${he}
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
        GROUP BY
          lower(btrim(m.ind_prtcpnt_email_id::text)),
          NULLIF(btrim(m.ind_prtcpnt_name::text), ''),
          NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '')
      `);
      for (const r of rows)
        addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
    } catch {
      try {
        const rows = await postgres.$queryRaw<
          {
            email: string | null;
            map_name: string | null;
            map_phone: string | null;
            rec_create_tstmp: Date | null;
          }[]
        >(Prisma.sql`
          SELECT
            lower(btrim(m.prtcpnt_email_id::text)) AS email,
            NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
            NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
            MIN(m.rec_create_tstmp) AS rec_create_tstmp
          FROM vrindavan.host_prtcpnt_map_india m
          WHERE (${shortWhere})
            AND m.prtcpnt_email_id IS NOT NULL
            AND btrim(m.prtcpnt_email_id::text) <> ''
            AND EXISTS (
              SELECT 1
              FROM vrindavan.webex_hosts_india h
              WHERE ${PG_SHORT_ID_BARE_MATCH}
                AND lower(btrim(h.host_email_id::text)) = ${he}
                AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
            )
          GROUP BY
            lower(btrim(m.prtcpnt_email_id::text)),
            NULLIF(btrim(m.prtcpnt_name::text), ''),
            NULLIF(btrim(m.prtcpnt_phone_no::text), '')
        `);
        for (const r of rows)
          addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
      } catch (err) {
        console.warn(
          "[host-meeting-participants] vrindavan map by short id (ind/prtcpnt) failed:",
          err,
        );
      }
    }
  }

  try {
    const rows = await postgres.$queryRaw<
      {
        email: string | null;
        map_name: string | null;
        map_phone: string | null;
        rec_create_tstmp: Date | null;
      }[]
    >`
      SELECT
        lower(btrim(m.prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
        NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
        MIN(m.rec_create_tstmp) AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_nonindia_nu m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND m.prtcpnt_email_id IS NOT NULL
        AND btrim(m.prtcpnt_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
      GROUP BY
        lower(btrim(m.prtcpnt_email_id::text)),
        NULLIF(btrim(m.prtcpnt_name::text), ''),
        NULLIF(btrim(m.prtcpnt_phone_no::text), '')
    `;
    for (const r of rows)
      addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
  } catch (err) {
    console.warn("[host-meeting-participants] mission host_email_id failed:", err);
  }

  try {
    const rows = await postgres.$queryRaw<
      {
        email: string | null;
        map_name: string | null;
        map_phone: string | null;
        rec_create_tstmp: Date | null;
      }[]
    >`
      SELECT
        lower(btrim(m.prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
        NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
        MIN(m.rec_create_tstmp) AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_nonindia_gp m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND m.prtcpnt_email_id IS NOT NULL
        AND btrim(m.prtcpnt_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM mission.webex_hosts_non_india_gp h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
      GROUP BY
        lower(btrim(m.prtcpnt_email_id::text)),
        NULLIF(btrim(m.prtcpnt_name::text), ''),
        NULLIF(btrim(m.prtcpnt_phone_no::text), '')
    `;
    for (const r of rows)
      addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
  } catch (err) {
    console.warn(
      "[host-meeting-participants] mission host_prtcpnt_map_nonindia_gp host_email_id failed:",
      err,
    );
  }

  try {
    const crRows = await fetchCrossregionMapByHostEmailId(postgres, he);
    for (const r of crRows)
      addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
  } catch (err) {
    console.warn(
      "[host-meeting-participants] mission host_prtcpnt_map_crossregion host_email_id failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<
      {
        email: string | null;
        map_name: string | null;
        map_phone: string | null;
        rec_create_tstmp: Date | null;
      }[]
    >`
      SELECT
        lower(btrim(m.ind_prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS map_name,
        NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '') AS map_phone,
        MIN(m.rec_create_tstmp) AS rec_create_tstmp
      FROM vrindavan.host_prtcpnt_map_india m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND m.ind_prtcpnt_email_id IS NOT NULL
        AND btrim(m.ind_prtcpnt_email_id::text) <> ''
        AND EXISTS (
          SELECT 1
          FROM vrindavan.webex_hosts_india h
          WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
        )
      GROUP BY
        lower(btrim(m.ind_prtcpnt_email_id::text)),
        NULLIF(btrim(m.ind_prtcpnt_name::text), ''),
        NULLIF(btrim(m.ind_prtcpnt_phone_no::text), '')
    `;
    for (const r of rows)
      addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
  } catch {
    try {
      const rows = await postgres.$queryRaw<
        {
          email: string | null;
          map_name: string | null;
          map_phone: string | null;
          rec_create_tstmp: Date | null;
        }[]
      >`
        SELECT
          lower(btrim(m.prtcpnt_email_id::text)) AS email,
          NULLIF(btrim(m.prtcpnt_name::text), '') AS map_name,
          NULLIF(btrim(m.prtcpnt_phone_no::text), '') AS map_phone,
          MIN(m.rec_create_tstmp) AS rec_create_tstmp
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE lower(btrim(m.host_email_id::text)) = ${he}
          AND m.prtcpnt_email_id IS NOT NULL
          AND btrim(m.prtcpnt_email_id::text) <> ''
          AND EXISTS (
            SELECT 1
            FROM vrindavan.webex_hosts_india h
            WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          )
        GROUP BY
          lower(btrim(m.prtcpnt_email_id::text)),
          NULLIF(btrim(m.prtcpnt_name::text), ''),
          NULLIF(btrim(m.prtcpnt_phone_no::text), '')
      `;
      for (const r of rows)
        addMapRefPair(bucket, r.email, r.map_name, r.map_phone, r.rec_create_tstmp);
    } catch (err) {
      console.warn(
        "[host-meeting-participants] vrindavan host_email_id (ind/prtcpnt) failed:",
        err,
      );
    }
  }

  return Array.from(bucket.values()).sort((a, b) => {
    const ta = a.recCreateTstmpMs ?? Number.MAX_SAFE_INTEGER;
    const tb = b.recCreateTstmpMs ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    const ce = a.email.localeCompare(b.email);
    if (ce !== 0) return ce;
    return (a.mapName ?? "").localeCompare(b.mapName ?? "");
  });
}

type NonIndiaRow = {
  prtcpntEmailId: string | null;
  prtcpntName: string | null;
  prtcpntPhoneNo: string | null;
};

type IndiaRow = {
  indPrtcpntEmailId: string | null;
  indPrtcpntName: string | null;
  indPrtcpntPhoneNo: string | null;
};

type StudentRow = { name: string | null; phone: string | null };

/** Rows included in host roster: not yet allotted their own Webex meeting, or flagged as host-participant. */
async function loadNonIndiaByEmail(
  postgres: PostgresPrismaClient,
  emails: string[],
): Promise<Map<string, NonIndiaRow[]>> {
  const m = new Map<string, NonIndiaRow[]>();
  if (emails.length === 0) return m;
  const rows = await postgres.nonIndiaParticipant.findMany({
    where: {
      prtcpntEmailId: { in: emails },
      OR: [
        { prtcpntHostAllotedInd: "N" },
        { prtcpntIsHostInd: "Y" },
      ],
    },
    select: {
      prtcpntEmailId: true,
      prtcpntName: true,
      prtcpntPhoneNo: true,
    },
  });
  for (const r of rows) {
    const e = r.prtcpntEmailId?.trim().toLowerCase();
    if (!e) continue;
    if (!m.has(e)) m.set(e, []);
    m.get(e)!.push(r);
  }
  try {
    const gpRows = await postgres.$queryRaw<
      {
        prtcpnt_email_id: string | null;
        prtcpnt_name: string | null;
        prtcpnt_phone_no: string | null;
      }[]
    >`
      SELECT
        lower(btrim(prtcpnt_email_id::text)) AS prtcpnt_email_id,
        prtcpnt_name::text AS prtcpnt_name,
        prtcpnt_phone_no::text AS prtcpnt_phone_no
      FROM mission.webex_participants_non_india_gp
      WHERE lower(btrim(prtcpnt_email_id::text)) IN (${Prisma.join(emails)})
        AND (
          btrim(COALESCE(prtcpnt_host_alloted_ind::text, '')) = 'N'
          OR btrim(COALESCE(prtcpnt_is_host_ind::text, '')) = 'Y'
        )
    `;
    for (const r of gpRows) {
      const e = r.prtcpnt_email_id?.trim().toLowerCase();
      if (!e) continue;
      if (!m.has(e)) m.set(e, []);
      m.get(e)!.push({
        prtcpntEmailId: e,
        prtcpntName: r.prtcpnt_name,
        prtcpntPhoneNo: r.prtcpnt_phone_no,
      });
    }
  } catch {
    // Optional table by environment.
  }
  return m;
}

async function loadIndiaByEmail(
  postgres: PostgresPrismaClient,
  emails: string[],
): Promise<Map<string, IndiaRow[]>> {
  const m = new Map<string, IndiaRow[]>();
  if (emails.length === 0) return m;
  const rows = await postgres.indiaParticipant.findMany({
    where: {
      indPrtcpntEmailId: { in: emails },
      OR: [
        { indPrtcpntHostAllotedInd: "N" },
        { indPrtcpntIsHostInd: "Y" },
      ],
    },
    select: {
      indPrtcpntEmailId: true,
      indPrtcpntName: true,
      indPrtcpntPhoneNo: true,
    },
  });
  for (const r of rows) {
    const e = r.indPrtcpntEmailId?.trim().toLowerCase();
    if (!e) continue;
    if (!m.has(e)) m.set(e, []);
    m.get(e)!.push(r);
  }
  return m;
}

async function loadStudentsByEmail(
  postgres: PostgresPrismaClient,
  emails: string[],
): Promise<Map<string, StudentRow[]>> {
  const m = new Map<string, StudentRow[]>();
  if (emails.length === 0) return m;
  const rows = await postgres.$queryRaw<
    { email: string; name: string | null; phone: string | null }[]
  >`
    SELECT
      lower(btrim(ind_prtcpnt_email_id::text)) AS email,
      ind_prtcpnt_name::text AS name,
      ind_prtcpnt_phone_no::text AS phone
    FROM vrindavan.webex_participants_india_students
    WHERE lower(btrim(ind_prtcpnt_email_id::text)) IN (${Prisma.join(emails)})
  `;
  for (const r of rows) {
    if (!m.has(r.email)) m.set(r.email, []);
    m.get(r.email)!.push({ name: r.name, phone: r.phone });
  }
  return m;
}

/**
 * For each map ref: **name and phone from the map row first**, then curated participant
 * tables (non-India / India / students) only to fill missing fields.
 */
export async function enrichHostMeetingParticipants(
  postgres: PostgresPrismaClient,
  refs: HostMapParticipantRef[],
): Promise<HostMeetingParticipant[]> {
  if (refs.length === 0) return [];

  const uniqueEmails = [...new Set(refs.map((r) => r.email))];

  const [nonIndiaByEmail, indiaByEmail, studentsByEmail] = await Promise.all([
    loadNonIndiaByEmail(postgres, uniqueEmails),
    loadIndiaByEmail(postgres, uniqueEmails),
    loadStudentsByEmail(postgres, uniqueEmails),
  ]);

  const out: HostMeetingParticipant[] = [];

  for (const ref of refs) {
    const mapName = ref.mapName?.trim() || null;
    const mapPhone = ref.mapPhone;

    const nonIndiaRows = nonIndiaByEmail.get(ref.email) ?? [];
    const nonIndiaHit = nonIndiaRows.find((r) =>
      mapNameMatchesDb(ref.mapName, r.prtcpntName),
    );
    if (nonIndiaHit) {
      const curatedName = nonIndiaHit.prtcpntName?.trim() || null;
      const curatedPhone = formatParticipantPhone(nonIndiaHit.prtcpntPhoneNo);
      out.push({
        email: ref.email,
        name: mapName || curatedName || null,
        phone: mapPhone || curatedPhone || null,
      });
      continue;
    }

    const indiaRows = indiaByEmail.get(ref.email) ?? [];
    const indiaHit = indiaRows.find((r) =>
      mapNameMatchesDb(ref.mapName, r.indPrtcpntName),
    );
    if (indiaHit) {
      const curatedName = indiaHit.indPrtcpntName?.trim() || null;
      const curatedPhone = formatParticipantPhone(indiaHit.indPrtcpntPhoneNo);
      out.push({
        email: ref.email,
        name: mapName || curatedName || null,
        phone: mapPhone || curatedPhone || null,
      });
      continue;
    }

    const studentRows = studentsByEmail.get(ref.email) ?? [];
    const studentHit = studentRows.find((r) => mapNameMatchesDb(ref.mapName, r.name));
    if (studentHit) {
      const curatedName = studentHit.name?.trim() || null;
      const curatedPhone = formatParticipantPhone(studentHit.phone);
      out.push({
        email: ref.email,
        name: mapName || curatedName || null,
        phone: mapPhone || curatedPhone || null,
      });
      continue;
    }

    out.push({
      email: ref.email,
      phone: mapPhone,
      name: mapName,
    });
  }

  return out;
}

/**
 * Host roster for map-enriched participant rows — same pipeline as confirm-registration /
 * {@link lookupConfirmation} for hosts.
 */
export async function loadHostMeetingParticipants(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<HostMeetingParticipant[]> {
  const refs = await collectParticipantRefsForHost(postgres, hostEmailLower);
  return enrichHostMeetingParticipants(postgres, refs);
}

function sqlMeetingMatch(
  meetingNumber: string | null,
  link: string | null,
): Prisma.Sql {
  if (!meetingNumber && !link) return Prisma.sql`TRUE`;
  const parts: Prisma.Sql[] = [];
  if (meetingNumber) {
    parts.push(
      Prisma.sql`regexp_replace(btrim(m.webex_mtng_no::text), '\.0+$', '', 'g') = ${meetingNumber}`,
    );
  }
  if (link) {
    parts.push(
      Prisma.sql`lower(btrim(m.webex_mtng_link::text)) = ${link.toLowerCase()}`,
    );
  }
  if (parts.length === 1) return parts[0]!;
  return Prisma.sql`(${Prisma.join(parts, " AND ")})`;
}

/**
 * Distinct participant display names from host↔participant map rows for this
 * registrant email + host + meeting (link / number). Used when one email has
 * several named registrations across meetings.
 *
 * If no rows match with meeting filters, falls back to all map rows for this
 * email + host (same meeting fields omitted).
 */
export async function fetchParticipantNamesForHostMeetingPair(
  postgres: PostgresPrismaClient,
  participantEmailLower: string,
  hostEmailLower: string,
  meetingNumber: string | null,
  linkRaw: string | null,
): Promise<string[]> {
  const link = coerceDisplayableWebexJoinLink(linkRaw);
  const bucket = new Set<string>();
  const add = (rows: { name: string | null }[]) => {
    for (const r of rows) {
      const n = r.name?.trim();
      if (n) bucket.add(n);
    }
  };

  const run = async (strict: boolean) => {
    const meetSql = strict
      ? sqlMeetingMatch(meetingNumber, link)
      : Prisma.sql`TRUE`;
    const p = participantEmailLower;
    const h = hostEmailLower;

    try {
      const rows = await postgres.$queryRaw<{ name: string | null }[]>`
        SELECT DISTINCT NULLIF(btrim(m.prtcpnt_name::text), '') AS name
        FROM mission.host_prtcpnt_map_nonindia_nu m
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${p}
          AND lower(btrim(m.host_email_id::text)) = ${h}
          AND EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india hh
            WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
          )
          AND ${meetSql}
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[host-meeting-participants] names nonindia_nu for meeting pair:",
        err,
      );
    }

    try {
      const rows = await postgres.$queryRaw<{ name: string | null }[]>`
        SELECT DISTINCT NULLIF(btrim(m.prtcpnt_name::text), '') AS name
        FROM mission.host_prtcpnt_map_nonindia_gp m
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${p}
          AND lower(btrim(m.host_email_id::text)) = ${h}
          AND EXISTS (
            SELECT 1
            FROM mission.webex_hosts_non_india_gp hh
            WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
          )
          AND ${meetSql}
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[host-meeting-participants] names nonindia_gp for meeting pair:",
        err,
      );
    }

    try {
      const rows = await postgres.$queryRaw<{ name: string | null }[]>`
        SELECT DISTINCT NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS name
        FROM mission.host_prtcpnt_map_crossregion m
        WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${p}
          AND lower(btrim(m.host_email_id::text)) = ${h}
          AND (
            EXISTS (
              SELECT 1
              FROM mission.webex_hosts_non_india hh
              WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
            )
            OR EXISTS (
              SELECT 1
              FROM mission.webex_hosts_non_india_gp hh
              WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
            )
          )
          AND ${meetSql}
      `;
      add(rows);
    } catch {
      try {
        const rows = await postgres.$queryRaw<{ name: string | null }[]>`
          SELECT DISTINCT NULLIF(btrim(m.prtcpnt_name::text), '') AS name
          FROM mission.host_prtcpnt_map_crossregion m
          WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${p}
            AND lower(btrim(m.host_email_id::text)) = ${h}
            AND (
              EXISTS (
                SELECT 1
                FROM mission.webex_hosts_non_india hh
                WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                  AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
              )
              OR EXISTS (
                SELECT 1
                FROM mission.webex_hosts_non_india_gp hh
                WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                  AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
              )
            )
            AND ${meetSql}
        `;
        add(rows);
      } catch (err) {
        console.warn(
          "[host-meeting-participants] names crossregion for meeting pair:",
          err,
        );
      }
    }

    try {
      const rows = await postgres.$queryRaw<{ name: string | null }[]>`
        SELECT DISTINCT NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS name
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${p}
          AND lower(btrim(m.host_email_id::text)) = ${h}
          AND EXISTS (
            SELECT 1
            FROM vrindavan.webex_hosts_india hh
            WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
              AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
          )
          AND ${meetSql}
      `;
      add(rows);
    } catch {
      try {
        const rows = await postgres.$queryRaw<{ name: string | null }[]>`
          SELECT DISTINCT NULLIF(btrim(m.prtcpnt_name::text), '') AS name
          FROM vrindavan.host_prtcpnt_map_india m
          WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${p}
            AND lower(btrim(m.host_email_id::text)) = ${h}
            AND EXISTS (
              SELECT 1
              FROM vrindavan.webex_hosts_india hh
              WHERE lower(btrim(hh.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                AND btrim(COALESCE(hh.webex_active_ind::text, '')) = 'Y'
            )
            AND ${meetSql}
        `;
        add(rows);
      } catch (err) {
        console.warn(
          "[host-meeting-participants] names india map for meeting pair (ind/prtcpnt):",
          err,
        );
      }
    }
  };

  await run(true);
  if (bucket.size === 0 && (meetingNumber || link)) {
    await run(false);
  }

  return [...bucket].sort((a, b) => a.localeCompare(b));
}
