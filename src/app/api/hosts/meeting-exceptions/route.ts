import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { appendMeetingExceptionRows } from "@/lib/meeting-exceptions-sheet";
import { isRoleAllowed } from "@/lib/rbac";
import { ADMIN_ROLES } from "@/lib/rbac";
import { hasTenantAccess } from "@/lib/rbac";

type Body = {
  meetingCmsxId: string;
  meetingTitle: string;
  participantEmails: string[];
  submitAsUserId?: string;
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
  const submitAsUserId = payload.submitAsUserId?.trim();

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

  // Resolve host identity: admins may submit as another user.
  let hostEmail = user.email ?? "";
  let hostUserId = user.id ?? "";
  if (
    submitAsUserId &&
    submitAsUserId !== user.id &&
    isRoleAllowed(user.role, ADMIN_ROLES)
  ) {
    const targetUser = await prisma.user.findUnique({
      where: { id: submitAsUserId },
      select: { id: true, email: true, tenantId: true },
    });
    if (!targetUser) {
      return NextResponse.json(
        { error: "Selected host user not found." },
        { status: 400 },
      );
    }
    if (
      !hasTenantAccess(
        user.role as Role,
        user.tenantId,
        targetUser.tenantId ?? null,
      )
    ) {
      return NextResponse.json(
        { error: "You cannot submit as a user from another tenant." },
        { status: 403 },
      );
    }
    hostEmail = targetUser.email ?? "";
    hostUserId = targetUser.id;
  }

  const timestamp = new Date().toISOString();

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

