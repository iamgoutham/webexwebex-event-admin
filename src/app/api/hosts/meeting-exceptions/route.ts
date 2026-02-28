import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { appendMeetingExceptionRows } from "@/lib/meeting-exceptions-sheet";

type Body = {
  meetingCmsxId: string;
  meetingTitle: string;
  participantEmails: string[];
};

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  const user = session.user;

  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const meetingCmsxId = payload.meetingCmsxId?.trim();
  const meetingTitle = payload.meetingTitle?.trim();
  const emailsRaw = payload.participantEmails ?? [];

  if (!meetingCmsxId || !meetingTitle) {
    return NextResponse.json(
      { error: "meetingCmsxId and meetingTitle are required" },
      { status: 400 },
    );
  }

  const normalizedEmails = Array.from(
    new Set(
      emailsRaw
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@")),
    ),
  );

  if (!normalizedEmails.length) {
    return NextResponse.json(
      { error: "At least one valid participant email is required" },
      { status: 400 },
    );
  }

  // Strict behavior: all emails must already exist in Participant.
  const participants = await prisma.participant.findMany({
    where: { email: { in: normalizedEmails } },
    select: { email: true },
  });
  const existingSet = new Set(participants.map((p) => p.email.toLowerCase()));
  const missing = normalizedEmails.filter((e) => !existingSet.has(e));

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error:
          "Some emails are not registered participants. Please correct them and try again.",
        missing,
      },
      { status: 400 },
    );
  }

  const timestamp = new Date().toISOString();
  const hostEmail = user.email ?? "";
  const hostUserId = user.id ?? "";

  const rows: string[][] = normalizedEmails.map((email) => [
    timestamp,
    hostEmail,
    hostUserId,
    meetingCmsxId,
    meetingTitle,
    email,
    "PENDING",
    "",
  ]);

  try {
    await appendMeetingExceptionRows(rows);
  } catch (err) {
    console.error("[meeting-exceptions] Failed to append to sheet:", err);
    return NextResponse.json(
      {
        error:
          "Failed to write to meeting exception list sheet. Please try again later.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: "Meeting exception requests recorded",
    requestedCount: normalizedEmails.length,
  });
}

