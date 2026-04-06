import type { SheetMeeting } from "@/lib/meeting-sheet-types";
import { normalizeSheetMeetingRow } from "@/lib/meeting-web-link";

export type InviteeContact = {
  email: string;
  phone?: string;
  name?: string;
};

export function parseMeetingInfoJson(raw: string): SheetMeeting[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return null;
  try {
    const data = JSON.parse(trimmed) as { meetings?: SheetMeeting[] };
    const list = data?.meetings;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.map((row) => normalizeSheetMeetingRow(row));
  } catch {
    return null;
  }
}

function inviteePhoneFromRecord(rec: Record<string, unknown>): string | undefined {
  const candidates = [
    rec.phone,
    rec.phoneNumber,
    rec.workPhone,
    rec.mobilePhone,
    rec.mobile,
    rec.tel,
    rec.workPhoneNumber,
    rec.displayPhone,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return undefined;
}

/** Map / Postgres invitees first; sheet rows only for emails not on the map. */
export function mergeInviteesMapFirst(
  mapList: InviteeContact[] | null,
  sheetList: InviteeContact[],
): InviteeContact[] | null {
  const fromMap = mapList ?? [];
  const seen = new Set(fromMap.map((p) => p.email.trim().toLowerCase()));
  const out: InviteeContact[] = [...fromMap];
  for (const s of sheetList) {
    const k = s.email.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out.length > 0 ? out : null;
}

export function parseInvitees(value: unknown): InviteeContact[] {
  if (!value) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return parseInvitees(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const out: InviteeContact[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const emailRaw = rec.email;
    if (typeof emailRaw !== "string" || !emailRaw.trim()) continue;
    const phoneRaw = inviteePhoneFromRecord(rec);
    const displayNameRaw = rec.displayName ?? rec.display_name;
    const nameRaw = rec.name;
    const displayName =
      typeof displayNameRaw === "string" && displayNameRaw.trim()
        ? displayNameRaw.trim()
        : typeof nameRaw === "string" && nameRaw.trim()
          ? nameRaw.trim()
          : undefined;
    out.push({
      email: emailRaw.trim().toLowerCase(),
      phone: phoneRaw,
      name: displayName,
    });
  }
  return out;
}
