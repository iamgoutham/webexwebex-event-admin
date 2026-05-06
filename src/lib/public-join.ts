import {
  Prisma,
  type PrismaClient as PostgresPrismaClient,
} from "@/generated/postgres-client";
import { coerceDisplayableWebexJoinLink } from "@/lib/host-map-meeting-link";

export type JoinCandidate = {
  name: string;
  joinLink: string;
};

export type JoinLookupDebugRow = {
  source: string;
  rows: number;
  samplePhones: string[];
  sampleNames: string[];
  error: string | null;
};

export type JoinLookupDebug = {
  input: string;
  digits: string;
  last10: string;
  bySource: JoinLookupDebugRow[];
  totalRawRows: number;
  totalCandidates: number;
};

type JoinMapRow = {
  name: string | null;
  link: string | null;
  rec_create_tstmp: Date | null;
};

const normalizeDigits = (value: string) => value.replace(/[^0-9]/g, "");

function phoneMatchSql(
  columnName: string,
  digits: string,
  last10: string,
): Prisma.Sql {
  const column = Prisma.raw(columnName);
  const normalized = Prisma.sql`regexp_replace(btrim(COALESCE(${column}::text, '')), '[^0-9]', '', 'g')`;
  return Prisma.sql`(${normalized} = ${digits} OR right(${normalized}, 10) = ${last10})`;
}

function addRows(
  bucket: JoinMapRow[],
  rows: JoinMapRow[],
) {
  for (const row of rows) bucket.push(row);
}

type JoinMapDebugSqlRow = JoinMapRow & {
  matched_phone: string | null;
};

async function runJoinSourceQuery(
  postgres: PostgresPrismaClient,
  source: string,
  sql: Prisma.Sql,
): Promise<{ rows: JoinMapDebugSqlRow[]; debug: JoinLookupDebugRow }> {
  try {
    const rows = await postgres.$queryRaw<JoinMapDebugSqlRow[]>(sql);
    return {
      rows,
      debug: {
        source,
        rows: rows.length,
        samplePhones: rows
          .map((r) => r.matched_phone?.trim())
          .filter((v): v is string => Boolean(v))
          .slice(0, 5),
        sampleNames: rows
          .map((r) => r.name?.trim())
          .filter((v): v is string => Boolean(v))
          .slice(0, 5),
        error: null,
      },
    };
  } catch (err) {
    return {
      rows: [],
      debug: {
        source,
        rows: 0,
        samplePhones: [],
        sampleNames: [],
        error: err instanceof Error ? err.message : "query failed",
      },
    };
  }
}

function finalizeCandidates(all: JoinMapRow[]): JoinCandidate[] {
  const deduped = new Map<
    string,
    { name: string; joinLink: string; recCreateTstmpMs: number }
  >();

  for (const row of all) {
    const name = row.name?.trim();
    if (!name) continue;
    const joinLink = coerceDisplayableWebexJoinLink(row.link);
    if (!joinLink) continue;
    const recCreateTstmpMs =
      row.rec_create_tstmp instanceof Date
        ? row.rec_create_tstmp.getTime()
        : Number.MIN_SAFE_INTEGER;
    const key = name.toLowerCase();
    const prev = deduped.get(key);
    if (!prev || recCreateTstmpMs > prev.recCreateTstmpMs) {
      deduped.set(key, { name, joinLink, recCreateTstmpMs });
    }
  }

  return [...deduped.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, joinLink }) => ({ name, joinLink }));
}

export async function lookupJoinCandidatesByPhoneWithDebug(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<{ candidates: JoinCandidate[]; debug: JoinLookupDebug }> {
  const digits = normalizeDigits(phoneRaw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";
  const debugRows: JoinLookupDebugRow[] = [];
  if (digits.length < 10) {
    return {
      candidates: [],
      debug: {
        input: phoneRaw,
        digits,
        last10,
        bySource: [
          {
            source: "input-validation",
            rows: 0,
            samplePhones: [],
            sampleNames: [],
            error: "phone has fewer than 10 digits after normalization",
          },
        ],
        totalRawRows: 0,
        totalCandidates: 0,
      },
    };
  }

  const all: JoinMapRow[] = [];

  const sources: Array<{ source: string; sql: Prisma.Sql }> = [
    {
      source: "mission.host_prtcpnt_map_nonindia_nu.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM mission.host_prtcpnt_map_nonindia_nu m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "mission.host_prtcpnt_map_nonindia_gp.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM mission.host_prtcpnt_map_nonindia_gp m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "mission.host_prtcpnt_map_nonindia_gp_overages.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM mission.host_prtcpnt_map_nonindia_gp_overages m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "mission.host_prtcpnt_map_nonindia_nu_overages.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM mission.host_prtcpnt_map_nonindia_nu_overages m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "mission.host_prtcpnt_map_nonindia_dattap.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM mission.host_prtcpnt_map_nonindia_dattap m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "mission.host_prtcpnt_map_crossregion.ind_prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.ind_prtcpnt_phone_no::text AS matched_phone
        FROM mission.host_prtcpnt_map_crossregion m
        WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "mission.host_prtcpnt_map_crossregion.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM mission.host_prtcpnt_map_crossregion m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "vrindavan.host_prtcpnt_map_india.ind_prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.ind_prtcpnt_phone_no::text AS matched_phone
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "vrindavan.host_prtcpnt_map_india.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "vrindavan.host_prtctpnt_map_india_overages.ind_prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.ind_prtcpnt_phone_no::text AS matched_phone
        FROM vrindavan.host_prtctpnt_map_india_overages m
        WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "vrindavan.host_prtctpnt_map_india_overages.prtcpnt_phone_no",
      sql: Prisma.sql`
        SELECT
          NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
          NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
          m.rec_create_tstmp AS rec_create_tstmp,
          m.prtcpnt_phone_no::text AS matched_phone
        FROM vrindavan.host_prtctpnt_map_india_overages m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      `,
    },
  ];

  for (const source of sources) {
    const result = await runJoinSourceQuery(postgres, source.source, source.sql);
    debugRows.push(result.debug);
    addRows(all, result.rows);
  }

  const candidates = finalizeCandidates(all);
  return {
    candidates,
    debug: {
      input: phoneRaw,
      digits,
      last10,
      bySource: debugRows,
      totalRawRows: all.length,
      totalCandidates: candidates.length,
    },
  };
}

export async function lookupJoinCandidatesByPhone(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<JoinCandidate[]> {
  const { candidates } = await lookupJoinCandidatesByPhoneWithDebug(
    postgres,
    phoneRaw,
  );
  return candidates;
}

/**
 * True if `phoneRaw` matches `host_phone_no` on an active-style host row
 * (same digit / last-10 rules as participant map join lookup).
 * Used when a number is not in host–participant maps but may be a host.
 */
export async function isPhoneMatchedInWebexHostTables(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<boolean> {
  const digits = normalizeDigits(phoneRaw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";
  if (digits.length < 10) return false;

  const existsHostPhone = async (sql: Prisma.Sql): Promise<boolean> => {
    try {
      const rows = await postgres.$queryRaw<[{ x: boolean }]>(sql);
      return Boolean(rows[0]?.x);
    } catch {
      return false;
    }
  };

  const [nonIndia, india] = await Promise.all([
    existsHostPhone(
      Prisma.sql`SELECT EXISTS (
        SELECT 1 FROM mission.webex_hosts_non_india h
        WHERE ${phoneMatchSql("h.host_phone_no", digits, last10)}
      ) AS x`,
    ),
    existsHostPhone(
      Prisma.sql`SELECT EXISTS (
        SELECT 1 FROM vrindavan.webex_hosts_india h
        WHERE ${phoneMatchSql("h.host_phone_no", digits, last10)}
      ) AS x`,
    ),
  ]);

  return nonIndia || india;
}
