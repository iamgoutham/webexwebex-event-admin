import { prisma } from "@/lib/prisma";
import type { ParticipantSyncResult } from "./types";
import {
  fetchSheetCsv,
  findColumnIndex,
  formatAvailableColumns,
  parseCsv,
} from "./sheet-csv";

// ---------------------------------------------------------------------------
// Participant Sync — Reads participants from Google Sheets
// ---------------------------------------------------------------------------
//
// Configuration via env PARTICIPANT_MAP_LIST (JSON array):
//   [
//     { "sheet_id": "...", "email_column_name": "Email", "phone_column_name": "Phone Number (WhatsApp)" },
//     ...
//   ]
//
// Flow:
//   1. Parse PARTICIPANT_MAP_LIST from environment
//   2. For each sheet, fetch as CSV (Google Sheets gviz/tq?tqx=out:csv)
//   3. Parse CSV, find email and phone columns by name, upsert each row as Participant
//   4. All participants get tenantId: null (communications sent to all together)
//
// Triggered by the "Sync Participants" button on the admin dashboard.
// ---------------------------------------------------------------------------

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

export interface ParticipantSheetConfig {
  sheet_id: string;
  email_column_name: string;
  phone_column_name?: string;
  first_name_column_name?: string;
  last_name_column_name?: string;
  center_column_name?: string;
  state_column_name?: string;
}

/** Allow trailing commas in JSON (e.g. from copy-pasted JS). */
function stripTrailingCommas(json: string): string {
  return json
    .replace(/,\s*]/g, "]")
    .replace(/,\s*}/g, "}");
}

function getParticipantMapList(): ParticipantSheetConfig[] {
  const raw = process.env.PARTICIPANT_MAP_LIST;
  if (!raw?.trim()) return [];
  try {
    const normalized = stripTrailingCommas(raw.trim());
    const parsed = JSON.parse(normalized) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ParticipantSheetConfig =>
        item != null &&
        typeof item === "object" &&
        typeof (item as ParticipantSheetConfig).sheet_id === "string" &&
        typeof (item as ParticipantSheetConfig).email_column_name === "string",
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sync all participants from configured Google Sheets
// ---------------------------------------------------------------------------

/**
 * Sync participants from the participant_map_list Google Sheets.
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

  const mapList = getParticipantMapList();
  if (mapList.length === 0) {
    const raw = process.env.PARTICIPANT_MAP_LIST;
    if (!raw?.trim()) {
      result.errors.push(
        "PARTICIPANT_MAP_LIST is not set. Add it to .env as a JSON array of { sheet_id, email_column_name, ... }, then restart the server.",
      );
    } else {
      result.errors.push(
        "PARTICIPANT_MAP_LIST is invalid. Use valid JSON (no trailing commas). Each item must have sheet_id and email_column_name.",
      );
    }
    return result;
  }

  const tenantId = null; // All participants share the same list; no tenant scope.

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

      const headers = rows[0];
      const emailIdx = findColumnIndex(headers, [
        config.email_column_name,
        "email",
        "Email",
      ]);
      const phoneIdx = findColumnIndex(headers, [
        config.phone_column_name ?? "phone",
        "phone",
        "Phone",
      ]);
      const firstNameIdx = config.first_name_column_name
        ? findColumnIndex(headers, [
            config.first_name_column_name,
            "firstName",
            "First Name",
            "First name",
          ])
        : -1;
      const lastNameIdx = config.last_name_column_name
        ? findColumnIndex(headers, [
            config.last_name_column_name,
            "lastName",
            "Last Name",
            "Last name",
          ])
        : -1;
      const centerIdx = config.center_column_name
        ? findColumnIndex(headers, [
            config.center_column_name,
            "center",
            "Center",
          ])
        : -1;
      const stateIdx = config.state_column_name
        ? findColumnIndex(headers, [
            config.state_column_name,
            "state",
            "State",
          ])
        : -1;

      // Additional registrant email/phone columns per row (up to 8)
      const registrantEmailIdxs = [
        findColumnIndex(headers, ["Registrant 2 Email"]),
        findColumnIndex(headers, ["Registrant 3 Email"]),
        findColumnIndex(headers, ["Registrant 4 Email"]),
        findColumnIndex(headers, ["Registrant 5 Email"]),
        findColumnIndex(headers, ["Registrant 6 Email"]),
        findColumnIndex(headers, ["Registrant 7 Email"]),
        findColumnIndex(headers, ["Registrant 8 Email"]),
      ];
      const registrantPhoneIdxs = [
        findColumnIndex(headers, ["Registrant 2 Phone"]),
        findColumnIndex(headers, ["Registrant 3 Phone"]),
        findColumnIndex(headers, ["Registrant 4 Phone"]),
        findColumnIndex(headers, ["Registrant 5 Phone"]),
        findColumnIndex(headers, ["Registrant 6 Phone"]),
        findColumnIndex(headers, ["Registrant 7 Phone"]),
        findColumnIndex(headers, ["Registrant 8 Phone"]),
      ];

      if (emailIdx === -1) {
        result.errors.push(
          `Sheet ${config.sheet_id}: email column not found (tried "${config.email_column_name}"). Available columns: ${formatAvailableColumns(headers)}`,
        );
        continue;
      }

      for (const row of rows.slice(1)) {
        const firstName =
          firstNameIdx >= 0 ? row[firstNameIdx]?.trim() ?? null : null;
        const lastName =
          lastNameIdx >= 0 ? row[lastNameIdx]?.trim() ?? null : null;
        const center =
          centerIdx >= 0 ? row[centerIdx]?.trim() ?? null : null;
        const rawState =
          stateIdx >= 0 ? row[stateIdx]?.trim() ?? null : null;
        const state = normalizeUsState(rawState);

        type Registrant = { email: string; phone: string | null };
        const registrants: Registrant[] = [];
        const seenEmails = new Set<string>();

        // Primary registrant (row's main email/phone)
        const baseEmailRaw = row[emailIdx]?.trim().toLowerCase();
        if (
          baseEmailRaw &&
          baseEmailRaw !== "" &&
          baseEmailRaw !== "n/a"
        ) {
          const basePhone =
            phoneIdx >= 0 ? row[phoneIdx]?.trim() ?? null : null;
          registrants.push({ email: baseEmailRaw, phone: basePhone });
          seenEmails.add(baseEmailRaw);
        }

        // Registrant 2–8 emails/phones from the same row
        registrantEmailIdxs.forEach((emailIdx2, i) => {
          if (emailIdx2 < 0) return;
          const regEmailRaw = row[emailIdx2]?.trim().toLowerCase();
          if (
            !regEmailRaw ||
            regEmailRaw === "" ||
            regEmailRaw === "n/a"
          ) {
            return;
          }
          if (seenEmails.has(regEmailRaw)) {
            return;
          }
          const phoneIdx2 = registrantPhoneIdxs[i];
          const regPhone =
            phoneIdx2 >= 0 ? row[phoneIdx2]?.trim() ?? null : null;
          registrants.push({ email: regEmailRaw, phone: regPhone });
          seenEmails.add(regEmailRaw);
        });

        if (!registrants.length) {
          continue;
        }

        for (const { email, phone } of registrants) {
          try {
            const existing = await prisma.participant.findFirst({
              where: { email, tenantId },
              select: { id: true },
            });

            const participantData = {
              phone: phone || null,
              firstName: firstName || null,
              lastName: lastName || null,
              center: center || null,
              state: state || null,
            };

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
                  name: null,
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
      }
    } catch (err) {
      result.errors.push(
        `Sheet ${config.sheet_id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
