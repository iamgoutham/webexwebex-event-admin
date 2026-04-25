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

  const sql = Prisma.sql`
    SELECT (
      EXISTS (
        SELECT 1
        FROM mission.host_prtcpnt_map_nonindia_nu m
        WHERE ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      )
      OR EXISTS (
        SELECT 1
        FROM mission.host_prtcpnt_map_crossregion m
        WHERE
          ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
          OR ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      )
      OR EXISTS (
        SELECT 1
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE
          ${phoneMatchSql("m.ind_prtcpnt_phone_no", digits, last10)}
          OR ${phoneMatchSql("m.prtcpnt_phone_no", digits, last10)}
      )
    )::boolean AS found
  `;

  try {
    const rows = await postgres.$queryRaw<[{ found: boolean }]>(sql);
    const found = Boolean(rows[0]?.found);
    return { ok: true, found };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "map lookup failed",
    };
  }
}
