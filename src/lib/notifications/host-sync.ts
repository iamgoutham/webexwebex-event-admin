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
// ---------------------------------------------------------------------------

export interface HostSheetConfig {
  sheet_id: string;
  email_column_name: string;
  phone_column_name: string;
  name_column_name?: string;
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

        try {
          const existing = await prisma.host.findFirst({
            where: { email, tenantId },
            select: { id: true },
          });

          if (existing) {
            await prisma.host.update({
              where: { id: existing.id },
              data: {
                phone: phone ?? undefined,
                name: name ?? undefined,
              },
            });
            result.updated++;
          } else {
            await prisma.host.create({
              data: {
                email,
                name: name ?? null,
                phone: phone ?? null,
                tenantId,
                optedOut: false,
              },
            });
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
            await prisma.participant.update({
              where: { id: existingParticipant.id },
              data: {
                // Do not reset optedOut; only refresh metadata.
                name: name ?? undefined,
                phone: phone ?? undefined,
              },
            });
          } else {
            await prisma.participant.create({
              data: {
                email,
                name: name ?? null,
                phone: phone ?? null,
                tenantId,
                optedOut: false,
              },
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
