import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  lookupConfirmation,
  lookupConfirmationByPhone,
  sendConfirmationEmail,
} from "@/lib/public-confirmation";

const emailSchema = z.object({
  lookupType: z.literal("email").optional(),
  email: z.string().email(),
});
const phoneSchema = z.object({
  lookupType: z.literal("phone").optional(),
  phone: z.string().min(3),
});
const schema = z.union([emailSchema, phoneSchema]);
const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, "");

const getApiKey = (request: Request) =>
  request.headers.get("x-api-key") ?? request.headers.get("X-API-Key");

// POST /api/external/confirm-registration — API-key protected
export async function POST(request: NextRequest) {
  const apiKey = process.env.EXTERNAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "External API key is not configured on server." },
      { status: 500 },
    );
  }

  const provided = getApiKey(request);
  if (!provided || provided !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if ("email" in parsed.data) {
    const lookup = await lookupConfirmation(parsed.data.email);
    if (!lookup.valid) {
      return NextResponse.json({
        message:
          "If the email is registered, a confirmation email will be sent.",
      });
    }

    await sendConfirmationEmail(lookup);
    return NextResponse.json({ message: "Confirmation email sent." });
  }

  const phoneDigits = normalizePhoneDigits(parsed.data.phone);
  if (phoneDigits.length < 10) {
    return NextResponse.json(
      { error: "Enter a valid WhatsApp phone number." },
      { status: 400 },
    );
  }

  const lookup = await lookupConfirmationByPhone(phoneDigits);
  if (!lookup?.valid) {
    return NextResponse.json({
      valid: false,
      message: "No registered participant/host found for this phone number.",
    });
  }

  return NextResponse.json({
    valid: true,
    email: lookup.email,
    isHost: lookup.isHost,
    isParticipant: lookup.isParticipant,
    displayName: lookup.displayName,
    meetings: lookup.meetings,
    hostMeetingParticipants: lookup.hostMeetingParticipants,
  });
}

