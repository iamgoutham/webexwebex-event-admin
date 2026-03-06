import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { appendMeetingExceptionRows } from "@/lib/meeting-exceptions-sheet";

// Simple test endpoint to verify Google Sheets / credentials / range.
// Writes a single clearly marked TEST row into the "meeting exception list" sheet.
export async function GET() {
  const session = await requireAuth();
  const user = session.user;

  const timestamp = new Date().toISOString();
  const hostEmail = user.email ?? "";
  const hostUserId = user.id ?? "";

  const rows: string[][] = [
    [
      timestamp,
      hostEmail || "test-host@example.com",
      hostUserId || "test-host-id",
      "TEST_CMS_ABCDE",
      "TEST Meeting – meeting-exceptions API connectivity check",
      hostEmail || "test-participant@example.com",
      "PENDING",
      "TEST ROW – safe to delete",
    ],
  ];

  try {
    await appendMeetingExceptionRows(rows);
  } catch (err) {
    console.error("[meeting-exceptions-test] Failed to append to sheet:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Failed to write TEST row to meeting exception list sheet. Check service account, sheet ID, and range.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Wrote a TEST row to the meeting exception list sheet. Verify it appears there.",
  });
}
