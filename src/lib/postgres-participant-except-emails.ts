import { getPostgresPrisma } from "@/lib/prisma-postgres";

/**
 * Participant "except" rows in downstream Postgres are used to disable selection
 * in the UI when the participant email matches.
 */
export async function fetchEmailsInProcessedExceptTables(): Promise<Set<string>> {
  const pg = getPostgresPrisma();
  if (!pg) return new Set();

  try {
    const rows = await pg.$queryRaw<{ email: string | null }[]>`
      SELECT DISTINCT LOWER(TRIM(prtcpnt_email_id::text)) AS email
      FROM mission.webex_participants_non_india_except
      WHERE prtcpnt_email_id IS NOT NULL
        AND BTRIM(prtcpnt_email_id::text) <> ''
      UNION
      SELECT DISTINCT LOWER(TRIM(ind_prtcpnt_email_id::text)) AS email
      FROM vrindavan.webex_participants_india_except
      WHERE ind_prtcpnt_email_id IS NOT NULL
        AND BTRIM(ind_prtcpnt_email_id::text) <> ''
    `;

    return new Set(
      rows
        .map((r) => r.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    );
  } catch (err) {
    console.error(
      "[postgres-participant-except-emails] Failed to load except-table emails:",
      err,
    );
    return new Set();
  }
}
