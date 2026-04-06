import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-guards";
import { ADMIN_ROLES } from "@/lib/rbac";
import {
  buildConfirmationEmailContent,
  lookupConfirmation,
} from "@/lib/public-confirmation";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

/**
 * Admin-only: preview the exact confirmation email body that would be sent for
 * a registered address (no email is sent). Does not send SES.
 */
export async function POST(request: Request) {
  const { response } = await requireApiAuth(ADMIN_ROLES);
  if (response) return response;

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join(" ")
        : "Invalid JSON body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const email = parsed.email.trim().toLowerCase();

  let lookup;
  try {
    lookup = await lookupConfirmation(email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[confirm-registration-preview] lookup failed:", err);
    return NextResponse.json(
      {
        error:
          "Could not look up registration data. Ensure Postgres is configured and reachable.",
        detail: process.env.NODE_ENV === "development" ? msg : undefined,
      },
      { status: 503 },
    );
  }

  if (!lookup.valid) {
    return NextResponse.json({
      valid: false as const,
      email,
      note:
        "This address is not registered as a participant or host. The public confirmation flow would not send an email (it returns a generic success message only).",
    });
  }

  const { subject, body } = buildConfirmationEmailContent(lookup);

  return NextResponse.json({
    valid: true as const,
    email,
    subject,
    body,
    lookup: {
      displayName: lookup.displayName,
      isHost: lookup.isHost,
      isParticipant: lookup.isParticipant,
      meetingsCount: lookup.meetings.length,
    },
    ...(lookup.isHost
      ? { hostMeetingParticipants: lookup.hostMeetingParticipants }
      : {}),
  });
}
