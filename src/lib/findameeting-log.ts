import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "data");
const LOG_FILE = join(LOG_DIR, "findameeting-phones.log");

export type FindameetingLogOutcome =
  | "success"
  | "not_in_maps"
  | "invalid_payload"
  | "invalid_short_phone"
  | "no_foster_links"
  | "db_unconfigured"
  | "map_lookup_error";

/**
 * Appends a tab-separated line. Safe to call on every request; falls back to console
 * if the host filesystem is read-only (e.g. some serverless).
 */
export async function logFindameetingRequest(params: {
  phoneEntered: string;
  outcome: FindameetingLogOutcome;
  note?: string;
}): Promise<void> {
  const { phoneEntered, outcome, note } = params;
  const safe = phoneEntered.replace(/\r|\n|\t/g, " ").slice(0, 120);
  const n = (note ?? "").replace(/\r|\n|\t/g, " ").slice(0, 200);
  const line = [new Date().toISOString(), safe, outcome, n].filter(Boolean).join("\t");
  const full = `${line}\n`;
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, full, "utf8");
  } catch (e) {
    console.error("[findameeting] log file write failed:", e);
    console.log("[findameeting]", line);
  }
}
