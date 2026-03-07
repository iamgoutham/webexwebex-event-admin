import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/verify-email?email=...
 *
 * Public API: returns whether the given email is registered as a host and/or
 * participant (from Google Sheets sync). Protected by a shared secret.
 *
 * Auth: pass the secret in one of:
 *   - Header: Authorization: Bearer <VERIFY_EMAIL_SECRET>
 *   - Header: x-verify-email-secret: <VERIFY_EMAIL_SECRET>
 *
 * Response: { isHostOrParticipant: boolean, host: boolean, participant: boolean }
 */
export async function GET(request: Request) {
  const secret = process.env.VERIFY_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Verify email API is not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-verify-email-secret");
  const token =
    authHeader != null && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

  if (token !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("email");
  const email = raw?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "Missing or empty email query parameter" },
      { status: 400 },
    );
  }

  const normalized = email.toLowerCase().trim();

  const [hostExists, participantExists] = await Promise.all([
    prisma.host.findFirst({
      where: { email: normalized },
      select: { id: true },
    }),
    prisma.participant.findFirst({
      where: { email: normalized },
      select: { id: true },
    }),
  ]);

  const host = hostExists != null;
  const participant = participantExists != null;
  const isHostOrParticipant = host || participant;

  return NextResponse.json({
    isHostOrParticipant,
    host,
    participant,
  });
}
