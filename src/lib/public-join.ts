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
    const joinLink = coerceDisplayableWebexJoinLink(row.link);
    if (!joinLink) continue;

    const name =
      row.name === null || row.name === undefined
        ? ""
        : String(row.name).trim();

    const recCreateTstmpMs =
      row.rec_create_tstmp instanceof Date
        ? row.rec_create_tstmp.getTime()
        : Number.MIN_SAFE_INTEGER;

    const dedupeKey =
      name.length > 0 ? name.toLowerCase() : `__link__${joinLink}`;

    const prev = deduped.get(dedupeKey);
    if (!prev || recCreateTstmpMs > prev.recCreateTstmpMs) {
      deduped.set(dedupeKey, { name, joinLink, recCreateTstmpMs });
    }
  }

  return [...deduped.values()]
    .sort((a, b) => {
      const ac = a.name || "\uFFFF";
      const bc = b.name || "\uFFFF";
      const byName = ac.localeCompare(bc);
      return byName !== 0 ? byName : a.joinLink.localeCompare(b.joinLink);
    })
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

/** Shared SQL fragments for participant_data_sheet_set phone lookups. */
function participantSheetPhoneLookupSources(
  digits: string,
  last10: string,
): Array<{ source: string; sql: Prisma.Sql }> {
  return [
    {
      source: "participant match: prtcpnt_phone_no (typed)",
      sql: Prisma.sql`
        SELECT
          COALESCE(NULLIF(btrim(s.prtcpnt_name::text), ''), '') AS name,
          NULLIF(btrim(s.webex_mtng_link::text), '') AS link,
          NULL::timestamp AS rec_create_tstmp,
          s.prtcpnt_phone_no::text AS matched_phone
        FROM mission.participant_data_sheet_set s
        WHERE ${phoneMatchSql("s.prtcpnt_phone_no", digits, last10)}
      `,
    },
    {
      source: "host match: host_phone_no (typed)",
      sql: Prisma.sql`
        SELECT
          COALESCE(NULLIF(btrim(s.host_name::text), ''), '') AS name,
          NULLIF(btrim(s.webex_mtng_link::text), '') AS link,
          NULL::timestamp AS rec_create_tstmp,
          s.host_phone_no::text AS matched_phone
        FROM mission.participant_data_sheet_set s
        WHERE ${phoneMatchSql("s.host_phone_no", digits, last10)}
      `,
    },
    {
      source: "participant match: json keys (prtcpnt_phone_no)",
      sql: Prisma.sql`
        SELECT
          COALESCE(
            NULLIF(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_name', to_jsonb(s)->>'participant_name')), ''),
            ''
          ) AS name,
          NULLIF(btrim(COALESCE(
            to_jsonb(s)->>'webex_mtng_link',
            to_jsonb(s)->>'webex_meeting_link'
          )), '') AS link,
          NULL::timestamp AS rec_create_tstmp,
          to_jsonb(s)->>'prtcpnt_phone_no' AS matched_phone
        FROM mission.participant_data_sheet_set s
        WHERE (
          regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      `,
    },
    {
      source: "host match: json keys (host_phone_no)",
      sql: Prisma.sql`
        SELECT
          COALESCE(NULLIF(btrim(to_jsonb(s)->>'host_name'), ''), '') AS name,
          NULLIF(btrim(COALESCE(
            to_jsonb(s)->>'webex_mtng_link',
            to_jsonb(s)->>'webex_meeting_link'
          )), '') AS link,
          NULL::timestamp AS rec_create_tstmp,
          to_jsonb(s)->>'host_phone_no' AS matched_phone
        FROM mission.participant_data_sheet_set s
        WHERE (
          regexp_replace(btrim(COALESCE(to_jsonb(s)->>'host_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(to_jsonb(s)->>'host_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
      `,
    },
  ];
}

async function runParticipantSheetPhoneSources(
  postgres: PostgresPrismaClient,
  digits: string,
  last10: string,
): Promise<{
  participantRows: JoinMapRow[];
  hostRows: JoinMapRow[];
  bySource: JoinLookupDebugRow[];
}> {
  const participantRows: JoinMapRow[] = [];
  const hostRows: JoinMapRow[] = [];
  const bySource: JoinLookupDebugRow[] = [];

  for (const source of participantSheetPhoneLookupSources(digits, last10)) {
    const result = await runJoinSourceQuery(postgres, source.source, source.sql);
    bySource.push(result.debug);
    if (source.source.toLowerCase().includes("host match")) {
      addRows(hostRows, result.rows);
    } else {
      addRows(participantRows, result.rows);
    }
  }

  return { participantRows, hostRows, bySource };
}

export type ParticipantSheetPhoneDebugSnapshot = {
  input: string;
  digits: string;
  last10: string;
  lookupEligible: boolean;
  jsonEvidence: {
    rowsMatchingParticipantPhoneColumn: number;
    rowsMatchingHostPhoneColumn: number;
    rowsMatchingEitherPhoneColumn: number;
    rowsSameRecordMatchBothPhoneColumns: number;
    rowsMatchingEitherPhoneButMissingBothLinkColumns: number;
  };
  sheetSources: JoinLookupDebugRow[];
  mergedRawRows: {
    participantSideRowCount: number;
    hostSideRowCount: number;
  };
  finalizedCandidates: JoinCandidate[];
  resolution: "host_precedence" | "participant_side" | "no_candidates";
  matchedRowSamples: Array<{
    prtcpnt_phone_raw: string | null;
    host_phone_raw: string | null;
    prtcpnt_digits: string | null;
    host_digits: string | null;
    prtcpnt_name: string | null;
    participant_name: string | null;
    host_name: string | null;
    host_email_id: string | null;
    webex_mtng_link_present: boolean;
    webex_meeting_link_present: boolean;
    coercedDisplayableJoinLink: string | null;
  }>;
};

/**
 * Debug-only: confirms whether normalized digits positively match participant vs host phones
 * in mission.participant_data_sheet_set using the same rules as lookup, plus SQL errors per source.
 */
export async function participantSheetPhoneDebugSnapshot(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<ParticipantSheetPhoneDebugSnapshot> {
  const input = phoneRaw.replace(/\r|\n|\t/g, " ").trim();
  const digits = normalizeDigits(input);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";
  const lookupEligible = digits.length >= 10;

  const empty: ParticipantSheetPhoneDebugSnapshot = {
    input,
    digits,
    last10,
    lookupEligible,
    jsonEvidence: {
      rowsMatchingParticipantPhoneColumn: 0,
      rowsMatchingHostPhoneColumn: 0,
      rowsMatchingEitherPhoneColumn: 0,
      rowsSameRecordMatchBothPhoneColumns: 0,
      rowsMatchingEitherPhoneButMissingBothLinkColumns: 0,
    },
    sheetSources: [],
    mergedRawRows: { participantSideRowCount: 0, hostSideRowCount: 0 },
    finalizedCandidates: [],
    resolution: "no_candidates",
    matchedRowSamples: [],
  };

  if (!lookupEligible) {
    return empty;
  }

  let jsonEvidence = empty.jsonEvidence;
  try {
    const agg = await postgres.$queryRaw<
      [
        {
          pr: number | bigint;
          ho: number | bigint;
          either: number | bigint;
          both: number | bigint;
          no_link: number | bigint;
        },
      ]
    >`
      WITH jr AS (
        SELECT to_jsonb(s) AS j
        FROM mission.participant_data_sheet_set s
      ),
      flagged AS (
        SELECT
          j,
          (regexp_replace(btrim(COALESCE(j->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
           OR right(
             regexp_replace(btrim(COALESCE(j->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'),
             10
           ) = ${last10}) AS pr_match,
          (regexp_replace(btrim(COALESCE(j->>'host_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
           OR right(
             regexp_replace(btrim(COALESCE(j->>'host_phone_no', '')), '[^0-9]', '', 'g'),
             10
           ) = ${last10}) AS ho_match,
          (
            COALESCE(NULLIF(btrim(COALESCE(j->>'webex_mtng_link', '')), ''), '') = ''
            AND COALESCE(NULLIF(btrim(COALESCE(j->>'webex_meeting_link', '')), ''), '') = ''
          ) AS missing_both_links
        FROM jr
      )
      SELECT
        COUNT(*) FILTER (WHERE pr_match)::bigint AS pr,
        COUNT(*) FILTER (WHERE ho_match)::bigint AS ho,
        COUNT(*) FILTER (WHERE pr_match OR ho_match)::bigint AS either,
        COUNT(*) FILTER (WHERE pr_match AND ho_match)::bigint AS both,
        COUNT(*) FILTER (WHERE (pr_match OR ho_match) AND missing_both_links)::bigint AS no_link
      FROM flagged
    `;
    const row = agg[0];
    if (row) {
      jsonEvidence = {
        rowsMatchingParticipantPhoneColumn: Number(row.pr),
        rowsMatchingHostPhoneColumn: Number(row.ho),
        rowsMatchingEitherPhoneColumn: Number(row.either),
        rowsSameRecordMatchBothPhoneColumns: Number(row.both),
        rowsMatchingEitherPhoneButMissingBothLinkColumns: Number(row.no_link),
      };
    }
  } catch {
    /* aggregate failed — leave zeros */
  }

  let sampleRowsRaw: Array<{
    prtcpnt_phone_raw: string | null;
    host_phone_raw: string | null;
    prtcpnt_digits: string | null;
    host_digits: string | null;
    prtcpnt_name: string | null;
    participant_name: string | null;
    host_name: string | null;
    host_email_id: string | null;
    webex_mtng_link_raw: string | null;
    webex_meeting_link_raw: string | null;
  }> = [];
  try {
    sampleRowsRaw = await postgres.$queryRaw`
      SELECT
        NULLIF(btrim(to_jsonb(s)->>'prtcpnt_phone_no'), '') AS prtcpnt_phone_raw,
        NULLIF(btrim(to_jsonb(s)->>'host_phone_no'), '') AS host_phone_raw,
        regexp_replace(
          btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'
        ) AS prtcpnt_digits,
        regexp_replace(
          btrim(COALESCE(to_jsonb(s)->>'host_phone_no', '')), '[^0-9]', '', 'g'
        ) AS host_digits,
        NULLIF(btrim(to_jsonb(s)->>'prtcpnt_name'), '') AS prtcpnt_name,
        NULLIF(btrim(to_jsonb(s)->>'participant_name'), '') AS participant_name,
        NULLIF(btrim(to_jsonb(s)->>'host_name'), '') AS host_name,
        NULLIF(btrim(to_jsonb(s)->>'host_email_id'), '') AS host_email_id,
        NULLIF(btrim(to_jsonb(s)->>'webex_mtng_link'), '') AS webex_mtng_link_raw,
        NULLIF(btrim(to_jsonb(s)->>'webex_meeting_link'), '') AS webex_meeting_link_raw
      FROM mission.participant_data_sheet_set s
      WHERE (
        regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
        OR right(
          regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'),
          10
        ) = ${last10}
        OR regexp_replace(btrim(COALESCE(to_jsonb(s)->>'host_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
        OR right(
          regexp_replace(btrim(COALESCE(to_jsonb(s)->>'host_phone_no', '')), '[^0-9]', '', 'g'),
          10
        ) = ${last10}
      )
      LIMIT 12
    `;
  } catch {
    sampleRowsRaw = [];
  }

  const matchedRowSamples =
    Array.isArray(sampleRowsRaw)
      ? sampleRowsRaw.map((r) => {
          const mergedLink =
            r.webex_mtng_link_raw?.trim() || r.webex_meeting_link_raw?.trim() || null;
          return {
            prtcpnt_phone_raw: r.prtcpnt_phone_raw?.trim() ?? null,
            host_phone_raw: r.host_phone_raw?.trim() ?? null,
            prtcpnt_digits:
              r.prtcpnt_digits && r.prtcpnt_digits.length > 0 ? r.prtcpnt_digits : null,
            host_digits: r.host_digits && r.host_digits.length > 0 ? r.host_digits : null,
            prtcpnt_name: r.prtcpnt_name ?? null,
            participant_name: r.participant_name ?? null,
            host_name: r.host_name ?? null,
            host_email_id: r.host_email_id ?? null,
            webex_mtng_link_present: Boolean(
              r.webex_mtng_link_raw && r.webex_mtng_link_raw.trim(),
            ),
            webex_meeting_link_present: Boolean(
              r.webex_meeting_link_raw && r.webex_meeting_link_raw.trim(),
            ),
            coercedDisplayableJoinLink: coerceDisplayableWebexJoinLink(mergedLink),
          };
        })
      : [];

  const { participantRows, hostRows, bySource } =
    await runParticipantSheetPhoneSources(postgres, digits, last10);

  const finalizedCandidates =
    hostRows.length > 0 ? finalizeCandidates(hostRows) : finalizeCandidates(participantRows);

  let resolution: ParticipantSheetPhoneDebugSnapshot["resolution"] = "no_candidates";
  if (finalizedCandidates.length === 0) {
    resolution = "no_candidates";
  } else if (hostRows.length > 0) {
    resolution = "host_precedence";
  } else {
    resolution = "participant_side";
  }

  return {
    input,
    digits,
    last10,
    lookupEligible,
    jsonEvidence,
    sheetSources: bySource,
    mergedRawRows: {
      participantSideRowCount: participantRows.length,
      hostSideRowCount: hostRows.length,
    },
    finalizedCandidates,
    resolution,
    matchedRowSamples,
  };
}

/**
 * Single-table lookup on mission.participant_data_sheet_set.
 * Matches both participant and host phone columns and chooses display fields
 * from the matched side.
 */
export async function lookupJoinCandidatesByPhoneFromParticipantSheetSet(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<JoinCandidate[]> {
  const digits = normalizeDigits(phoneRaw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";
  if (digits.length < 10) return [];

  const { participantRows, hostRows } = await runParticipantSheetPhoneSources(
    postgres,
    digits,
    last10,
  );

  // Precedence rule: if phone matches host-side fields, use host identity only.
  if (hostRows.length > 0) {
    return finalizeCandidates(hostRows);
  }
  return finalizeCandidates(participantRows);
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
