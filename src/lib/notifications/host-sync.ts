import { prisma } from "@/lib/prisma";
import type { HostSyncResult } from "./types";
import {
  fetchSheetCsv,
  findColumnIndex,
  formatAvailableColumns,
  parseCsv,
} from "./sheet-csv";

// ---------------------------------------------------------------------------
// Host Sync — Reads hosts from Google Sheets (separate from User / portal logins)
// ---------------------------------------------------------------------------
//
// Configuration via env HOST_MAP_LIST (JSON array), same shape as PARTICIPANT_MAP_LIST:
//   [
//     { "sheet_id": "...", "email_column_name": "Email", "phone_column_name": "Phone" },
//     ... optionally "name_column_name": "Name"
//   ]
//
// All hosts get tenantId: null; messages sent to all as a group.
//
// Debug: set HOST_SYNC_DEBUG=1 to log sheet headers, column indices, extracted
// row values, and the exact data written to Host and Participant tables.
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

export interface HostSheetConfig {
  sheet_id: string;
  email_column_name: string;
  phone_column_name: string;
  name_column_name?: string;
  state_column_name?: string;
}

function stripTrailingCommas(json: string): string {
  return json.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
}

function getHostMapList(): HostSheetConfig[] {
  const raw = process.env.HOST_MAP_LIST;
  if (!raw?.trim()) return [];
  try {
    const normalized = stripTrailingCommas(raw.trim());
    const parsed = JSON.parse(normalized) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HostSheetConfig =>
        item != null &&
        typeof item === "object" &&
        typeof (item as HostSheetConfig).sheet_id === "string" &&
        typeof (item as HostSheetConfig).email_column_name === "string" &&
        typeof (item as HostSheetConfig).phone_column_name === "string",
    );
  } catch {
    return [];
  }
}

export async function syncHosts(_tenantId?: string | null): Promise<HostSyncResult> {
  const result: HostSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const mapList = getHostMapList();
  if (mapList.length === 0) {
    const raw = process.env.HOST_MAP_LIST;
    if (!raw?.trim()) {
      result.errors.push(
        "HOST_MAP_LIST is not set. Add it to .env as a JSON array of { sheet_id, email_column_name, phone_column_name } (optional: name_column_name), then restart the server.",
      );
    } else {
      result.errors.push(
        "HOST_MAP_LIST is invalid. Use valid JSON. Each item must have sheet_id, email_column_name, and phone_column_name.",
      );
    }
    return result;
  }

  const tenantId = null;

  for (const config of mapList) {
    try {
      const csv = await fetchSheetCsv(config.sheet_id);
      if (!csv) {
        result.errors.push(
          `Failed to fetch sheet ${config.sheet_id} (${config.email_column_name})`,
        );
        continue;
      }

      const rows = parseCsv(csv);
      if (rows.length < 2) continue;
      console.log(
        "[host-sync] Parsed rows from sheet",
        config.sheet_id,
        "- total rows (including header):",
        rows.length,
      );
      const headers = rows[0];
      const emailIdx = findColumnIndex(headers, [
        config.email_column_name,
        "email",
        "Email",
      ]);
      const phoneIdx = findColumnIndex(headers, [
        config.phone_column_name,
        "phone",
        "Phone",
      ]);
      const statusIdx = findColumnIndex(headers, ["Status"]);
      const webexActiveIdx = findColumnIndex(headers, ["Webex Active"]);
      const nameIdx =
        config.name_column_name != null && config.name_column_name !== ""
          ? findColumnIndex(headers, [config.name_column_name, "name", "Name"])
          : -1;
      const stateIdx =
        config.state_column_name != null && config.state_column_name !== ""
          ? findColumnIndex(headers, [
              config.state_column_name,
              "state",
              "State",
            ])
          : -1;

      if (DEBUG) {
        console.log("[host-sync] Sheet config:", {
          sheet_id: config.sheet_id,
          email_column_name: config.email_column_name,
          phone_column_name: config.phone_column_name,
          name_column_name: config.name_column_name ?? "(not set)",
          state_column_name: config.state_column_name ?? "(not set)",
        });
        console.log("[host-sync] Headers:", headers);
        console.log("[host-sync] Column indices:", {
          emailIdx,
          phoneIdx,
          statusIdx,
          webexActiveIdx,
          nameIdx,
          stateIdx,
        });
        console.log("[host-sync] Row count (including header):", rows.length);
      }

      if (emailIdx === -1) {
        result.errors.push(
          `Sheet ${config.sheet_id}: email column not found (tried "${config.email_column_name}"). Available columns: ${formatAvailableColumns(headers)}`,
        );
        continue;
      }
      if (statusIdx === -1 || webexActiveIdx === -1) {
        result.errors.push(
          `Sheet ${config.sheet_id}: required columns \"Status\" and/or \"Webex Active\" not found. Available columns: ${formatAvailableColumns(
            headers,
          )}`,
        );
        continue;
      }

      for (const row of rows.slice(1)) {
        const email = row[emailIdx]?.trim().toLowerCase();
        if (!email || email === "" || email === "n/a") continue;

        const statusRaw = row[statusIdx] ?? "";
        const webexActiveRaw = row[webexActiveIdx] ?? "";
        const status = statusRaw.trim().toUpperCase();
        const webexActive = webexActiveRaw.trim().toLowerCase();
        // Only import hosts that are provisioned and Webex-active
        if (status !== "PROVISIONED" || webexActive !== "yes") {
          result.skipped++;
          continue;
        }

        const phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() ?? null : null;
        const name = nameIdx >= 0 ? row[nameIdx]?.trim() ?? null : null;
        const rawState = stateIdx >= 0 ? row[stateIdx]?.trim() ?? null : null;
        const state = normalizeUsState(rawState);

        if (DEBUG && row.some((c) => c?.trim())) {
          console.log("[host-sync] Row read (raw row, extracted):", {
            rawRow: row,
            email,
            status,
            webexActive,
            extracted: {
              phone,
              name,
              rawState,
              state,
            },
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
              name: name ?? null,
              phone: phone ?? null,
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
              name: name ?? null,
              phone: phone ?? null,
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
    } catch (err) {
      result.errors.push(
        `Sheet ${config.sheet_id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
