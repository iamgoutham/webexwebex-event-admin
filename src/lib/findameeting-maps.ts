import {
  Prisma,
  type PrismaClient as PostgresPrismaClient,
} from "@/generated/postgres-client";

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

/** Which participant phone columns exist on a map table (variants: ind_* vs prtcpnt_*). */
type MapPhoneColumns = {
  indPrtcpntPhoneNo: boolean;
  prtcpntPhoneNo: boolean;
};

const mapPhoneColumnCache = new Map<string, MapPhoneColumns>();

async function loadMapPhoneColumns(
  postgres: PostgresPrismaClient,
  schema: string,
  table: string,
): Promise<MapPhoneColumns> {
  const key = `${schema}.${table}`;
  const hit = mapPhoneColumnCache.get(key);
  if (hit) return hit;

  const rows = await postgres.$queryRaw<{ column_name: string }[]>(Prisma.sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ${schema}
      AND table_name = ${table}
      AND column_name IN ('ind_prtcpnt_phone_no', 'prtcpnt_phone_no')
  `);

  const names = new Set(
    rows.map((r) => r.column_name.toLowerCase()),
  );
  const cols: MapPhoneColumns = {
    indPrtcpntPhoneNo: names.has("ind_prtcpnt_phone_no"),
    prtcpntPhoneNo: names.has("prtcpnt_phone_no"),
  };
  mapPhoneColumnCache.set(key, cols);
  return cols;
}

/**
 * True if the phone appears in one of the host–participant map tables:
 * - mission.host_prtcpnt_map_nonindia_nu
 * - mission.host_prtcpnt_map_crossregion
 * - vrindavan.host_prtcpnt_map_india
 *
 * Same digit / last-10 matching rules as public join lookup.
 * Phone EXISTS queries use only columns reported by `information_schema` so
 * Prisma does not log failed raw SQL for missing `ind_*` / `prtcpnt_*` variants.
 */
export async function isPhoneInFindMeetingMaps(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<{ ok: true; found: boolean } | { ok: false; error: string }> {
  const digits = normalizeDigits(phoneRaw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";
  if (digits.length < 10) {
    return { ok: true, found: false };
  }

  const existsStrict = async (sql: Prisma.Sql): Promise<boolean> => {
    const rows = await postgres.$queryRaw<[{ x: boolean }]>(sql);
    return Boolean(rows[0]?.x);
  };

  try {
    const [nuCols, crossCols, indiaCols] = await Promise.all([
      loadMapPhoneColumns(
        postgres,
        "mission",
        "host_prtcpnt_map_nonindia_nu",
      ),
      loadMapPhoneColumns(
        postgres,
        "mission",
        "host_prtcpnt_map_crossregion",
      ),
      loadMapPhoneColumns(
        postgres,
        "vrindavan",
        "host_prtcpnt_map_india",
      ),
    ]);

    const checks: Promise<boolean>[] = [];

    if (nuCols.prtcpntPhoneNo) {
      checks.push(
        existsStrict(
          Prisma.sql`SELECT EXISTS (
            SELECT 1 FROM mission.host_prtcpnt_map_nonindia_nu m
            WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
          ) AS x`,
        ),
      );
    }

    if (crossCols.indPrtcpntPhoneNo) {
      checks.push(
        existsStrict(
          Prisma.sql`SELECT EXISTS (
            SELECT 1 FROM mission.host_prtcpnt_map_crossregion m
            WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
          ) AS x`,
        ),
      );
    }
    if (crossCols.prtcpntPhoneNo) {
      checks.push(
        existsStrict(
          Prisma.sql`SELECT EXISTS (
            SELECT 1 FROM mission.host_prtcpnt_map_crossregion m
            WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
          ) AS x`,
        ),
      );
    }

    if (indiaCols.indPrtcpntPhoneNo) {
      checks.push(
        existsStrict(
          Prisma.sql`SELECT EXISTS (
            SELECT 1 FROM vrindavan.host_prtcpnt_map_india m
            WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
          ) AS x`,
        ),
      );
    }
    if (indiaCols.prtcpntPhoneNo) {
      checks.push(
        existsStrict(
          Prisma.sql`SELECT EXISTS (
            SELECT 1 FROM vrindavan.host_prtcpnt_map_india m
            WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
          ) AS x`,
        ),
      );
    }

    if (checks.length === 0) {
      return { ok: true, found: false };
    }

    const results = await Promise.all(checks);
    const found = results.some(Boolean);
    return { ok: true, found };
  } catch (e) {
    const message = e instanceof Error ? e.message : "map lookup failed";
    console.error("[findameeting] map lookup failed:", message);
    return {
      ok: false,
      error: message,
    };
  }
}
