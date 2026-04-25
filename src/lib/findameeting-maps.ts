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

/**
 * True if the phone appears in one of the host–participant map tables:
 * - mission.host_prtcpnt_map_nonindia_nu
 * - mission.host_prtcpnt_map_crossregion
 * - vrindavan.host_prtcpnt_map_india
 *
 * Same digit / last-10 matching rules as public join lookup.
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

  // One simple EXISTS per query — same shape as `public-join` (nested OR in one
  // Prisma.sql was failing at runtime for some drivers / generated SQL).
  const exists = async (sql: Prisma.Sql): Promise<boolean> => {
    const rows = await postgres.$queryRaw<[{ x: boolean }]>(sql);
    return Boolean(rows[0]?.x);
  };

  try {
    const [
      nonIndiaNu,
      crossInd,
      crossPrt,
      indiaInd,
      indiaPrt,
    ] = await Promise.all([
      exists(
        Prisma.sql`SELECT EXISTS (
          SELECT 1 FROM mission.host_prtcpnt_map_nonindia_nu m
          WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
        ) AS x`,
      ),
      exists(
        Prisma.sql`SELECT EXISTS (
          SELECT 1 FROM mission.host_prtcpnt_map_crossregion m
          WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
        ) AS x`,
      ),
      exists(
        Prisma.sql`SELECT EXISTS (
          SELECT 1 FROM mission.host_prtcpnt_map_crossregion m
          WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
        ) AS x`,
      ),
      exists(
        Prisma.sql`SELECT EXISTS (
          SELECT 1 FROM vrindavan.host_prtcpnt_map_india m
          WHERE ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
        ) AS x`,
      ),
      exists(
        Prisma.sql`SELECT EXISTS (
          SELECT 1 FROM vrindavan.host_prtcpnt_map_india m
          WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
        ) AS x`,
      ),
    ]);

    const found =
      nonIndiaNu || crossInd || crossPrt || indiaInd || indiaPrt;
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
