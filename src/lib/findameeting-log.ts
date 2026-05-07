import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { prisma } from "@/lib/prisma";

const LOG_PATHS = [
  join(process.cwd(), "data", "findameeting-phones.log"),
  join(process.cwd(), "logs", "findameeting-phones.log"),
  join(tmpdir(), "webex-event-admin-findameeting-phones.log"),
];

export type FindameetingLogOutcome =
  | "success"
  | "not_in_maps"
  | "invalid_payload"
  | "invalid_short_phone"
  | "missing_phone"
  | "no_foster_links"
  | "db_unconfigured"
  | "map_lookup_error";

/** Stable pseudonymous id for correlation — derived from normalized digits or trimmed input. */
function callerOpaqueId(phoneEntered: string): string {
  const trimmed = phoneEntered.replace(/\r|\n|\t/g, " ").trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  const key = digits.length > 0 ? digits : trimmed.slice(0, 64);
  return createHash("sha256")
    .update(key, "utf8")
    .digest("hex")
    .slice(0, 24);
}

async function appendLogLineToFile(line: string): Promise<boolean> {
  for (const filePath of LOG_PATHS) {
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, line, "utf8");
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function insertFindameetingDbRow(params: {
  callerHash: string;
  outcome: FindameetingLogOutcome;
  phoneRaw: string | null;
  note: string | null;
}): Promise<boolean> {
  try {
    const id = randomUUID();
    const hash = params.callerHash.slice(0, 32);
    const oc = params.outcome.slice(0, 64);
    const phone =
      params.phoneRaw !== null && params.phoneRaw !== undefined
        ? params.phoneRaw.slice(0, 255)
        : null;
    const note = params.note ? params.note.slice(0, 512) : null;

    await prisma.$executeRaw`
      INSERT INTO \`FindameetingAccessLog\` (\`id\`, \`callerHash\`, \`outcome\`, \`phoneRaw\`, \`note\`)
      VALUES (${id}, ${hash}, ${oc}, ${phone}, ${note})
    `;
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists find-a-meeting requests to:
 * 1) The first writable path under `data/`, `logs/`, or the OS temp directory
 * 2) MySQL table `FindameetingAccessLog` when the schema is migrated and DB is available
 *
 * Tab-separated file line: timestamp, callerHash, outcome, note.
 * Does not use console logging.
 */
export async function logFindameetingRequest(params: {
  phoneEntered: string;
  outcome: FindameetingLogOutcome;
  note?: string;
}): Promise<void> {
  const { phoneEntered, outcome, note } = params;
  const trimmedPhone = phoneEntered.replace(/\r|\n|\t/g, " ").trim();
  const callerId = callerOpaqueId(phoneEntered);
  const n = (note ?? "").replace(/\r|\n|\t/g, " ").slice(0, 200);
  const line = [new Date().toISOString(), callerId, outcome, n]
    .filter(Boolean)
    .join("\t");
  const full = `${line}\n`;

  await Promise.all([
    appendLogLineToFile(full),
    insertFindameetingDbRow({
      callerHash: callerId,
      outcome,
      phoneRaw: trimmedPhone.length > 0 ? trimmedPhone : null,
      note: n.length > 0 ? n : null,
    }),
  ]);
}
