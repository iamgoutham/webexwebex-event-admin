import { prisma } from "@/lib/prisma";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import type { HostSyncResult } from "./types";

// ---------------------------------------------------------------------------
// Host Sync — Reads hosts from downstream Postgres (mission + vrindavan)
// ---------------------------------------------------------------------------
//
// Sources:
//   - mission.webex_hosts_non_india
//   - mission.webex_hosts_non_india_gp
//   - mission.webex_hosts_non_india_dattap
//   - vrindavan.webex_hosts_india
//
// Both tables are projected into a common { email, phone, name, state } shape
// and then upserted into the local Host + Participant tables (MySQL).
// All synced hosts get tenantId: null.
//
// Debug: set HOST_SYNC_DEBUG=1 to log the rows read from Postgres and the
// exact data written to Host and Participant tables.
// ---------------------------------------------------------------------------

const DEBUG = process.env.HOST_SYNC_DEBUG === "1";

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

export async function syncHosts(_tenantId?: string | null): Promise<HostSyncResult> {
  const result: HostSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const postgres = getPostgresPrisma();
  if (!postgres) {
    result.errors.push(
      "POSTGRES_URL is not configured; cannot sync hosts from downstream Postgres.",
    );
    return result;
  }

  type HostRow = {
    email: string | null;
    phone: string | null;
    name: string | null;
    state: string | null;
  };

  const tenantId = null;

  const rows: HostRow[] = [];
  const pushRows = (label: string, batch: HostRow[]) => {
    rows.push(...batch);
    if (DEBUG) {
      console.log(`[host-sync] ${label}:`, batch.length);
    }
  };

  try {
    const batch =
      await postgres.$queryRaw<HostRow[]>`
        SELECT
          host_email_id      AS email,
          host_phone_no      AS phone,
          (host_first_name || ' ' || host_last_name) AS name,
          host_addr_state    AS state
        FROM mission.webex_hosts_non_india
        WHERE provisioned_status_ind = 'Y' AND webex_active_ind = 'Y'
      `;
    pushRows("mission.webex_hosts_non_india", batch);
  } catch (err) {
    result.errors.push(
      `[host-sync] mission.webex_hosts_non_india: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  try {
    const batch =
      await postgres.$queryRaw<HostRow[]>`
        SELECT
          host_email_id      AS email,
          host_phone_no      AS phone,
          (host_first_name || ' ' || host_last_name) AS name,
          host_addr_state    AS state
        FROM mission.webex_hosts_non_india_gp
        WHERE provisioned_status_ind = 'Y' AND webex_active_ind = 'Y'
      `;
    pushRows("mission.webex_hosts_non_india_gp", batch);
  } catch (err) {
    result.errors.push(
      `[host-sync] mission.webex_hosts_non_india_gp: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  try {
    const batch =
      await postgres.$queryRaw<HostRow[]>`
        SELECT
          host_email_id      AS email,
          host_phone_no      AS phone,
          (host_first_name || ' ' || host_last_name) AS name,
          host_addr_state    AS state
        FROM mission.webex_hosts_non_india_dattap
        WHERE provisioned_status_ind = 'Y' AND webex_active_ind = 'Y'
      `;
    pushRows("mission.webex_hosts_non_india_dattap", batch);
  } catch (err) {
    result.errors.push(
      `[host-sync] mission.webex_hosts_non_india_dattap: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  try {
    const india =
      await postgres.$queryRaw<HostRow[]>`
        SELECT
          host_email_id      AS email,
          host_phone_no      AS phone,
          (host_first_name || ' ' || host_last_name) AS name,
          host_addr_state    AS state
        FROM vrindavan.webex_hosts_india
        WHERE provisioned_status_ind = 'Y' AND webex_active_ind = 'Y'
      `;
    pushRows("vrindavan.webex_hosts_india", india);
  } catch (err) {
    result.errors.push(
      `[host-sync] vrindavan.webex_hosts_india: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (rows.length === 0 && result.errors.length > 0) {
    return result;
  }

  /** Same email in multiple source tables → one upsert; first source in list wins field values. */
  const byEmail = new Map<string, HostRow>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!email || email === "n/a") continue;
    if (!byEmail.has(email)) byEmail.set(email, row);
  }
  const dedupedRows = [...byEmail.values()];

  if (DEBUG) {
    console.log(
      "[host-sync] Total rows from Postgres (hosts, deduped by email):",
      dedupedRows.length,
    );
  }

  for (const row of dedupedRows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!email || email === "n/a") {
      result.skipped++;
      continue;
    }

    const phone = row.phone?.trim() || null;
    const name = row.name?.trim() || null;
    const state = normalizeUsState(row.state);

    if (DEBUG) {
      console.log("[host-sync] Row read (Postgres, extracted):", {
        email,
        extracted: { name, phone, state },
      });
    }

    try {
      const existing = await prisma.host.findFirst({
        where: { email, tenantId },
        select: { id: true },
      });

      if (existing) {
        const data: any = {
          phone: phone ?? undefined,
          name: name ?? undefined,
        };
        if (state != null) {
          data.state = state;
        }

        if (DEBUG) {
          console.log("[host-sync] Host DB payload:", {
            email,
            action: "update",
            id: existing.id,
            data,
          });
        }

        await prisma.host.update({
          where: { id: existing.id },
          data,
        });
        result.updated++;
      } else {
        const data: any = {
          email,
          name,
          phone,
          tenantId,
          optedOut: false,
        };
        if (state != null) {
          data.state = state;
        }

        if (DEBUG) {
          console.log("[host-sync] Host DB payload:", {
            email,
            action: "create",
            data,
          });
        }

        await prisma.host.create({ data });
        result.created++;
      }
    } catch {
      result.skipped++;
      continue;
    }

    // Ensure every host is also present in the Participant table
    try {
      const existingParticipant = await prisma.participant.findFirst({
        where: { email, tenantId },
        select: { id: true, optedOut: true },
      });

      if (existingParticipant) {
        if (DEBUG) {
          console.log("[host-sync] Participant DB payload:", {
            email,
            action: "update",
            id: existingParticipant.id,
            data: {
              name: name ?? undefined,
              phone: phone ?? undefined,
            },
          });
        }

        await prisma.participant.update({
          where: { id: existingParticipant.id },
          data: {
            // Do not reset optedOut; only refresh metadata.
            name: name ?? undefined,
            phone: phone ?? undefined,
          },
        });
      } else {
        const data = {
          email,
          name,
          phone,
          tenantId,
          optedOut: false,
        };

        if (DEBUG) {
          console.log("[host-sync] Participant DB payload:", {
            email,
            action: "create",
            data,
          });
        }

        await prisma.participant.create({
          data,
        });
      }
    } catch {
      // If participant upsert fails, count as skipped but continue syncing others.
      result.skipped++;
    }
  }

  return result;
}
