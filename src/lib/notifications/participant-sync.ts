import { prisma } from "@/lib/prisma";
import type { ParticipantSyncResult } from "./types";

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

/** Timeout for Google Sheets fetch (2 minutes per sheet). */
const SHEET_FETCH_TIMEOUT_MS = 2 * 60 * 1000;

export interface ParticipantSheetConfig {
  sheet_id: string;
  email_column_name: string;
  phone_column_name: string;
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
        typeof (item as ParticipantSheetConfig).email_column_name === "string" &&
        typeof (item as ParticipantSheetConfig).phone_column_name === "string",
    );
  } catch {
    return [];
  }
}

/** Normalize for column matching: trim, lowercase, collapse spaces/underscores, unify apostrophes. */
const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'"); // curly/smart apostrophes → straight

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(current);
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) =>
    normalizedCandidates.includes(normalizeHeader(header)),
  );
}

async function fetchSheetCsv(sheetId: string): Promise<string | null> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SHEET_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
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
        "PARTICIPANT_MAP_LIST is not set. Add it to .env as a JSON array of { sheet_id, email_column_name, phone_column_name }, then restart the server.",
      );
    } else {
      result.errors.push(
        "PARTICIPANT_MAP_LIST is invalid. Use valid JSON (no trailing commas). Each item must have sheet_id, email_column_name, and phone_column_name.",
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
        config.phone_column_name,
        "phone",
        "Phone",
      ]);

      if (emailIdx === -1) {
        const available = headers
          .map((h, i) => (h?.trim() ? `"${String(h).replace(/"/g, '\\"')}"` : `(empty ${i})`))
          .join(", ");
        result.errors.push(
          `Sheet ${config.sheet_id}: email column not found (tried "${config.email_column_name}"). Available columns: ${available}`,
        );
        continue;
      }

      for (const row of rows.slice(1)) {
        const email = row[emailIdx]?.trim().toLowerCase();
        if (!email || email === "" || email === "n/a") continue;

        const phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() ?? null : null;

        try {
          const existing = await prisma.participant.findFirst({
            where: { email, tenantId },
            select: { id: true },
          });

          if (existing) {
            await prisma.participant.update({
              where: { id: existing.id },
              data: {
                phone: phone || null,
              },
            });
            result.updated++;
          } else {
            await prisma.participant.create({
              data: {
                email,
                name: null,
                phone: phone || null,
                tenantId,
                optedOut: false,
              },
            });
            result.created++;
          }
        } catch {
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
