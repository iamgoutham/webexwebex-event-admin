import type { MeetingAssignment } from "@/lib/public-confirmation";
import type { SheetMeeting } from "@/lib/meeting-sheet-types";

export function normMeetingNumberCell(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\.0+$/, "");
  return s || null;
}

/** Match sheet JSON row to a merged assignment (invitees / state). */
export function sheetMeetingForAssignment(
  a: MeetingAssignment,
  sheetMeetings: SheetMeeting[],
): SheetMeeting | null {
  if (a.meetingNumber) {
    for (const sm of sheetMeetings) {
      const sn = normMeetingNumberCell(sm.meetingNumber);
      if (sn && sn === a.meetingNumber) return sm;
    }
  }
  const t = a.topic?.trim().toLowerCase();
  if (t) {
    for (const sm of sheetMeetings) {
      if (sm.title?.trim().toLowerCase() === t) return sm;
    }
  }
  return null;
}
