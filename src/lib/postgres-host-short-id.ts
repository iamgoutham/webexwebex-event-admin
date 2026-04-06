import type { PrismaClient as PostgresPrismaClient } from "@/generated/postgres-client";

/**
 * Resolves Webex host unique short id from downstream Postgres (license host tables).
 * Tries mission (non-India) first, then vrindavan (India).
 */
export async function lookupHostUnqShortIdFromPostgres(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string | null> {
  const [nonIndia, india] = await Promise.all([
    postgres.$queryRaw<{ shortid: string | null }[]>`
      SELECT host_unq_shortid::text AS shortid
      FROM mission.webex_hosts_non_india
      WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
      LIMIT 1
    `,
    postgres.$queryRaw<{ shortid: string | null }[]>`
      SELECT host_unq_shortid::text AS shortid
      FROM vrindavan.webex_hosts_india
      WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
      LIMIT 1
    `,
  ]);
  const v =
    nonIndia[0]?.shortid?.trim() || india[0]?.shortid?.trim() || null;
  return v || null;
}
