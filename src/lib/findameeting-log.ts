import { createHash } from "node:crypto";
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

/** Stable pseudonymous id for logs — digits-only when present, else trimmed input (never plaintext phone in files). */
function callerOpaqueId(phoneEntered: string): string {
  const trimmed = phoneEntered.replace(/\r|\n|\t/g, " ").trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  const key = digits.length > 0 ? digits : trimmed.slice(0, 64);
  return createHash("sha256")
    .update(key, "utf8")
    .digest("hex")
    .slice(0, 24);
}

/**
 * Appends a tab-separated line (timestamp, opaque caller id, outcome, note).
 * Phone numbers are not written — only a short SHA-256 prefix of normalized digits.
 * Falls back to console if the host filesystem is read-only (e.g. some serverless).
 */
export async function logFindameetingRequest(params: {
  phoneEntered: string;
  outcome: FindameetingLogOutcome;
  note?: string;
}): Promise<void> {
  const { phoneEntered, outcome, note } = params;
  const callerId = callerOpaqueId(phoneEntered);
  const n = (note ?? "").replace(/\r|\n|\t/g, " ").slice(0, 200);
  const line = [new Date().toISOString(), callerId, outcome, n].filter(Boolean).join("\t");
  const full = `${line}\n`;
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, full, "utf8");
  } catch (e) {
    console.error("[findameeting] log file write failed:", e);
    console.log("[findameeting]", line);
  }
}
