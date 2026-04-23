import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-guards";
import { ADMIN_ROLES } from "@/lib/rbac";
import {
  buildConfirmationEmailContent,
  lookupConfirmation,
  lookupConfirmationByPhone,
} from "@/lib/public-confirmation";

const bodySchema = z.object({
  lookupType: z.enum(["email", "phone"]).default("email"),
  query: z.string().min(3, "Enter at least 3 characters."),
});

const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, "");

function formatUpcomingSaturdayLabel(phoneDigits: string): string {
  const now = new Date();
  const nextSaturday = new Date(now);
  const daysUntilSaturday = ((6 - now.getDay() + 7) % 7) || 7;
  nextSaturday.setDate(now.getDate() + daysUntilSaturday);

  if (phoneDigits.startsWith("1")) {
    const month = nextSaturday.toLocaleString("en-US", {
      month: "long",
      timeZone: "America/New_York",
    });
    const day = nextSaturday.toLocaleString("en-US", {
      day: "numeric",
      timeZone: "America/New_York",
    });
    const year = nextSaturday.toLocaleString("en-US", {
      year: "numeric",
      timeZone: "America/New_York",
    });
    return `${month} ${day} ${year} 10AM EST`;
  }

  const month = nextSaturday.toLocaleString("en-US", {
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  const day = nextSaturday.toLocaleString("en-US", {
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const year = nextSaturday.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  return `${month} ${day} ${year} 7.30PM IST`;
}

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

  const lookupType = parsed.lookupType;
  const query = parsed.query.trim();

  if (lookupType === "phone") {
    const phoneDigits = normalizePhoneDigits(query);
    if (phoneDigits.length < 10) {
      return NextResponse.json(
        { error: "Enter a valid WhatsApp phone number." },
        { status: 400 },
      );
    }

    let lookup;
    try {
      lookup = await lookupConfirmationByPhone(phoneDigits);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[confirm-registration-preview] phone lookup failed:", err);
      return NextResponse.json(
        {
          error:
            "Could not look up registration data. Ensure Postgres is configured and reachable.",
          detail: process.env.NODE_ENV === "development" ? msg : undefined,
        },
        { status: 503 },
      );
    }

    if (!lookup) {
      return NextResponse.json({
        valid: false as const,
        lookupType: "phone" as const,
        query: phoneDigits,
        note:
          "This number is not registered as a participant or host. The public flow would return a generic success message and skip WhatsApp send.",
      });
    }

    const primaryMeeting =
      lookup.meetings.find((m) => m.link?.trim()) ?? lookup.meetings[0];
    const participantName = lookup.displayName?.split(";")[0]?.trim() || "Participant";
    const greetingFirstName =
      lookup.displayName?.trim().split(/\s+/)[0]?.trim() || participantName;
    const registeredEmail = lookup.email;
    const meetingNumber = primaryMeeting?.meetingNumber?.trim() || "TBD";
    const meetingLink = primaryMeeting?.link?.trim() || "Not available";
    const hostEmail = primaryMeeting?.hostEmail?.trim() || "Not available";
    const hostPhone = primaryMeeting?.hostPhone?.trim() || "Not available";
    const meetingStartSheet = primaryMeeting?.startTime?.trim() || "";
    const meetingStartSaturday = formatUpcomingSaturdayLabel(phoneDigits);

    const templateName = lookup.isHost ? "host_meeting_info" : "participant_meeting_info";
    const templateParams = lookup.isHost
      ? [
          greetingFirstName,
          registeredEmail,
          meetingNumber,
          meetingLink,
          hostEmail,
          meetingStartSheet || meetingStartSaturday,
          String((lookup.hostMeetingParticipants ?? []).length),
        ]
      : [
          participantName,
          registeredEmail,
          meetingNumber,
          meetingLink,
          hostEmail,
          hostPhone,
          meetingStartSaturday,
        ];

    return NextResponse.json({
      valid: true as const,
      lookupType: "phone" as const,
      query: phoneDigits,
      whatsappPreview: {
        templateName,
        templateParams,
      },
      lookup: {
        resolvedEmail: lookup.email,
        displayName: lookup.displayName,
        isHost: lookup.isHost,
        isParticipant: lookup.isParticipant,
        meetingsCount: lookup.meetings.length,
      },
    });
  }

  const email = query.toLowerCase();
  const emailValid = z.string().email().safeParse(email);
  if (!emailValid.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

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
      lookupType: "email" as const,
      query: email,
      email,
      note:
        "This address is not registered as a participant or host. The public confirmation flow would not send an email (it returns a generic success message only).",
    });
  }

  const { subject, body } = buildConfirmationEmailContent(lookup);

  return NextResponse.json({
    valid: true as const,
    lookupType: "email" as const,
    query: email,
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
