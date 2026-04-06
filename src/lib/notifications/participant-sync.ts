import { prisma } from "@/lib/prisma";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import type { ParticipantSyncResult } from "./types";

// ---------------------------------------------------------------------------
// Participant Sync — Reads participants from downstream Postgres
// ---------------------------------------------------------------------------
//
// Sources (merged by email):
//   - mission.webex_hosts_non_india
//   - vrindavan.webex_hosts_india
//   - mission.webex_participants_non_india
//   - vrindavan.webex_participants_india
//   - vrindavan.webex_participants_india_students
// Host↔participant assignment maps (host roster / confirmation) also use
// mission.host_prtcpnt_map_crossregion — see host-meeting-participants.ts.
//
// All rows are projected into a common { email, phone, firstName, lastName,
// center, state } shape. Rows with the same email are merged: host first/last
// stay primary; participant / alternate full names go into Participant.name
// (semicolon-separated) so admin search finds registration names.
// Upserted into the local Participant table (MySQL) with tenantId: null.
//
// Debug: set PARTICIPANT_SYNC_DEBUG=1 to log the rows read from Postgres and
// the exact data inserted/updated per participant.
// ---------------------------------------------------------------------------

const DEBUG = process.env.PARTICIPANT_SYNC_DEBUG === "1";

const US_STATE_MAP: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

function normalizeUsState(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (lettersOnly.length === 2 && US_STATE_MAP[lettersOnly]) {
    return US_STATE_MAP[lettersOnly];
  }
  return trimmed;
}

type ParticipantSourceRow = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  center: string | null;
  state: string | null;
};

function combinedPrimaryName(
  first: string | null,
  last: string | null,
): string {
  return [first?.trim(), last?.trim()].filter(Boolean).join(" ").trim();
}

/**
 * Combine all Postgres sources for one email. Primary firstName/lastName favor
 * host-shaped rows (last name present); other distinct full names go to `name`.
 */
function mergeParticipantSourcesForEmail(
  sources: ParticipantSourceRow[],
): {
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  center: string | null;
  state: string | null;
} {
  let primaryFirst: string | null = null;
  let primaryLast: string | null = null;
  const extras: string[] = [];
  let phone: string | null = null;
  let center: string | null = null;
  let state: string | null = null;

  for (const row of sources) {
    phone = phone || row.phone?.trim() || null;
    center = center || row.center?.trim() || null;
    state = state || row.state?.trim() || null;

    const fn = row.firstName?.trim() || null;
    const ln = row.lastName?.trim() || null;

    if (ln) {
      if (!primaryFirst && !primaryLast) {
        primaryFirst = fn;
        primaryLast = ln;
      } else {
        const full = [fn, ln].filter(Boolean).join(" ").trim();
        const cur = combinedPrimaryName(primaryFirst, primaryLast);
        if (full && full.toLowerCase() !== cur.toLowerCase()) {
          extras.push(full);
        }
      }
    } else if (fn) {
      const cur = combinedPrimaryName(primaryFirst, primaryLast);
      if (cur && fn.toLowerCase() !== cur.toLowerCase()) {
        extras.push(fn);
      }
      if (!primaryFirst && !primaryLast) {
        primaryFirst = fn;
      }
    }
  }

  const seenExtra = new Set<string>();
  const uniqueExtras = extras.filter((e) => {
    const k = e.toLowerCase();
    if (seenExtra.has(k)) return false;
    seenExtra.add(k);
    return true;
  });

  return {
    phone,
    firstName: primaryFirst,
    lastName: primaryLast,
    name: uniqueExtras.length > 0 ? uniqueExtras.join("; ") : null,
    center,
    state,
  };
}

/**
 * Sync participants from downstream Postgres.
 * tenantId is ignored; all participants are stored with tenantId null.
 */
export async function syncParticipants(
  _tenantId?: string | null,
): Promise<ParticipantSyncResult> {
  const result: ParticipantSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const postgres = getPostgresPrisma();
  if (!postgres) {
    result.errors.push(
      "POSTGRES_URL is not configured; cannot sync participants from downstream Postgres.",
    );
    return result;
  }

  const tenantId = null; // All participants share the same list; no tenant scope.

  let rows: ParticipantSourceRow[] = [];

  try {
    // Hosts (non-India + India) treated as participants.
    const hostNonIndia =
      await postgres.$queryRaw<ParticipantSourceRow[]>`
        SELECT
          host_email_id      AS email,
          host_phone_no      AS phone,
          host_first_name    AS "firstName",
          host_last_name     AS "lastName",
          NULL::text         AS center,
          host_addr_state    AS state
        FROM mission.webex_hosts_non_india
        WHERE provisioned_status_ind = 'Y' AND webex_active_ind = 'Y'
      `;
    const hostIndia =
      await postgres.$queryRaw<ParticipantSourceRow[]>`
        SELECT
          host_email_id      AS email,
          host_phone_no      AS phone,
          host_first_name    AS "firstName",
          host_last_name     AS "lastName",
          chinmaya_center_name AS center,
          host_addr_state    AS state
        FROM vrindavan.webex_hosts_india
        WHERE provisioned_status_ind = 'Y' AND webex_active_ind = 'Y'
      `;

    // Non-India participants.
    const nonIndiaParticipants =
      await postgres.nonIndiaParticipant.findMany({
        select: {
          prtcpntEmailId: true,
          prtcpntPhoneNo: true,
          prtcpntName: true,
          prtcpntAddrState: true,
          chinmayaCenterName: true,
        },
      });
    const nonIndiaRows: ParticipantSourceRow[] = nonIndiaParticipants.map(
      (p) => ({
        email: p.prtcpntEmailId,
        phone: p.prtcpntPhoneNo,
        firstName: p.prtcpntName,
        lastName: null,
        center: p.chinmayaCenterName,
        state: p.prtcpntAddrState,
      }),
    );

    // India participants.
    const indiaParticipants = await postgres.indiaParticipant.findMany({
      select: {
        indPrtcpntEmailId: true,
        indPrtcpntPhoneNo: true,
        indPrtcpntName: true,
        indPrtcpntAddrState: true,
        indChinmayaCenterName: true,
      },
    });
    const indiaRows: ParticipantSourceRow[] = indiaParticipants.map((p) => ({
      email: p.indPrtcpntEmailId,
      phone: p.indPrtcpntPhoneNo,
      firstName: p.indPrtcpntName,
      lastName: null,
      center: p.indChinmayaCenterName,
      state: p.indPrtcpntAddrState,
    }));

    // India students (additional participant source)
    const indiaStudents =
      await postgres.$queryRaw<ParticipantSourceRow[]>`
        SELECT
          ind_prtcpnt_email_id   AS email,
          ind_prtcpnt_phone_no   AS phone,
          ind_prtcpnt_name       AS "firstName",
          NULL::text             AS "lastName",
          ind_chinmaya_center_name AS center,
          ind_prtcpnt_addr_state AS state
        FROM vrindavan.webex_participants_india_students
      `;

    rows = [
      ...hostNonIndia,
      ...hostIndia,
      ...nonIndiaRows,
      ...indiaRows,
      ...indiaStudents,
    ];

    if (DEBUG) {
      console.log("[participant-sync] Source counts:", {
        hostNonIndia: hostNonIndia.length,
        hostIndia: hostIndia.length,
        nonIndiaParticipants: nonIndiaRows.length,
        indiaParticipants: indiaRows.length,
        indiaStudents: indiaStudents.length,
        combinedRows: rows.length,
      });
    }
  } catch (err) {
    result.errors.push(
      `Failed to read participants from downstream Postgres: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return result;
  }

  if (DEBUG) {
    console.log(
      "[participant-sync] Total rows from Postgres (hosts + participants):",
      rows.length,
    );
  }

  const byEmail = new Map<string, ParticipantSourceRow[]>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!email || email === "n/a") continue;
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email)!.push(row);
  }

  if (DEBUG) {
    console.log("[participant-sync] Unique emails after grouping:", byEmail.size);
  }

  for (const [email, grouped] of byEmail) {
    const merged = mergeParticipantSourcesForEmail(grouped);
    const state = normalizeUsState(merged.state);
    const participantData = {
      phone: merged.phone?.trim() || null,
      firstName: merged.firstName?.trim() || null,
      lastName: merged.lastName?.trim() || null,
      name: merged.name?.trim() || null,
      center: merged.center?.trim() || null,
      state,
    };

    try {
      const existing = await prisma.participant.findFirst({
        where: { email, tenantId },
        select: { id: true },
      });

      if (DEBUG) {
        console.log("[participant-sync] Participant DB payload:", {
          email,
          ...(existing
            ? { action: "update", id: existing.id, data: participantData }
            : {
                action: "create",
                data: {
                  email,
                  tenantId,
                  optedOut: false,
                  ...participantData,
                },
              }),
        });
      }

      if (existing) {
        await prisma.participant.update({
          where: { id: existing.id },
          data: participantData,
        });
        result.updated++;
      } else {
        await prisma.participant.create({
          data: {
            email,
            tenantId,
            optedOut: false,
            ...participantData,
          },
        });
        result.created++;
      }
    } catch {
      result.skipped++;
    }
  }

  return result;
}
