import {
  Prisma,
  type PrismaClient as PostgresPrismaClient,
} from "@/generated/postgres-client";
import { coerceDisplayableWebexJoinLink } from "@/lib/host-map-meeting-link";

export type JoinCandidate = {
  name: string;
  joinLink: string;
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

export async function lookupJoinCandidatesByPhone(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<JoinCandidate[]> {
  const digits = normalizeDigits(phoneRaw);
  if (digits.length < 10) return [];
  const last10 = digits.slice(-10);

  const all: JoinMapRow[] = [];

  try {
    const rows = await postgres.$queryRaw<JoinMapRow[]>(Prisma.sql`
      SELECT
        NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
        NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
        m.rec_create_tstmp AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_nonindia_nu m
      WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
    `);
    addRows(all, rows);
  } catch {
    // Optional table variations by environment.
  }

  try {
    const rows = await postgres.$queryRaw<JoinMapRow[]>(Prisma.sql`
      SELECT
        NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS name,
        NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
        m.rec_create_tstmp AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
    `);
    addRows(all, rows);
  } catch {
    // Optional table variations by environment.
  }

  try {
    const rows = await postgres.$queryRaw<JoinMapRow[]>(Prisma.sql`
      SELECT
        NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
        NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
        m.rec_create_tstmp AS rec_create_tstmp
      FROM mission.host_prtcpnt_map_crossregion m
      WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
    `);
    addRows(all, rows);
  } catch {
    // Optional table variations by environment.
  }

  try {
    const rows = await postgres.$queryRaw<JoinMapRow[]>(Prisma.sql`
      SELECT
        NULLIF(btrim(m.ind_prtcpnt_name::text), '') AS name,
        NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
        m.rec_create_tstmp AS rec_create_tstmp
      FROM vrindavan.host_prtcpnt_map_india m
      WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
    `);
    addRows(all, rows);
  } catch {
    // Optional table variations by environment.
  }

  try {
    const rows = await postgres.$queryRaw<JoinMapRow[]>(Prisma.sql`
      SELECT
        NULLIF(btrim(m.prtcpnt_name::text), '') AS name,
        NULLIF(btrim(m.webex_mtng_link::text), '') AS link,
        m.rec_create_tstmp AS rec_create_tstmp
      FROM vrindavan.host_prtcpnt_map_india m
      WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
    `);
    addRows(all, rows);
  } catch {
    // Optional table variations by environment.
  }

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
