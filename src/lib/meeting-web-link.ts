import type { SheetMeeting } from "@/lib/meeting-sheet-types";

/** First Webex join URL in free text (sheet cell, notes, or non-JSON meeting info). */
export function extractWebexJoinUrlFromText(
  text: string | null | undefined,
): string | undefined {
  if (!text?.trim()) return undefined;
  const re = /https?:\/\/[^\s<>"']*webex\.com[^\s<>"']*/gi;
  const m = re.exec(text);
  if (!m) return undefined;
  return m[0].replace(/[.,;)\]}>]+$/, "");
}

function pickUrlString(r: Record<string, unknown>): string | undefined {
  const keys = [
    "webLink",
    "web_link",
    "meetingLink",
    "meeting_url",
    "joinUrl",
    "join_url",
    "meetingUrl",
    "url",
  ] as const;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Merge common alternate column/API keys into `webLink` so UI and copy-link
 * work when the sheet uses snake_case or another name.
 */
export function normalizeSheetMeetingRow(row: unknown): SheetMeeting {
  if (!row || typeof row !== "object") return {};
  const r = row as Record<string, unknown>;
  const merged = { ...r } as SheetMeeting;
  const url = pickUrlString(r);
  if (url && !(merged.webLink && merged.webLink.trim())) {
    merged.webLink = url;
  }
  return merged;
}
