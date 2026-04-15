import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  lookupConfirmation,
  lookupConfirmationByPhone,
  sendConfirmationEmail,
} from "@/lib/public-confirmation";
import { sendWhatsAppTemplate } from "@/lib/notifications/channels/whatsapp";

const schema = z.object({
  lookupType: z.enum(["email", "phone"]),
  query: z.string().min(3),
  captchaToken: z.string().min(1),
});

const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, "");
const textParam = (value: string) => ({ type: "text", text: value });

async function verifyTurnstile(token: string, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured.");
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data = (await res.json().catch(() => null)) as
    | { success: boolean; "error-codes"?: string[] }
    | null;

  if (!data?.success) {
    const codes = data?.["error-codes"]?.join(", ") ?? "unknown";
    throw new Error(`Captcha verification failed (${codes}).`);
  }
}

// POST /api/public/confirm-registration
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  try {
    await verifyTurnstile(parsed.data.captchaToken, ip);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Captcha failed" },
      { status: 400 },
    );
  }

  if (parsed.data.lookupType === "email") {
    const email = parsed.data.query.trim().toLowerCase();
    const emailValid = z.string().email().safeParse(email);
    if (!emailValid.success) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    const lookup = await lookupConfirmation(email);
    if (!lookup.valid) {
      // Do not leak participant list; return generic success.
      return NextResponse.json({
        message:
          "If your email is registered, you will receive a confirmation email shortly.",
      });
    }

    await sendConfirmationEmail(lookup);
    return NextResponse.json({
      message: "Confirmation email sent.",
    });
  }

  const phoneDigits = normalizePhoneDigits(parsed.data.query);
  if (phoneDigits.length < 10) {
    return NextResponse.json(
      { error: "Enter a valid WhatsApp phone number." },
      { status: 400 },
    );
  }
  const phoneLookup = await lookupConfirmationByPhone(phoneDigits);
  if (!phoneLookup) {
    return NextResponse.json({
      message:
        "If your WhatsApp number is registered, you will receive meeting information shortly.",
    });
  }

  const primaryMeeting =
    phoneLookup.meetings.find((m) => m.link?.trim()) ?? phoneLookup.meetings[0];
  const participantName =
    phoneLookup.displayName?.split(";")[0]?.trim() || "Participant";
  const registeredEmail = phoneLookup.email;
  const meetingNumber = primaryMeeting?.meetingNumber?.trim() || "TBD";
  const meetingLink = primaryMeeting?.link?.trim() || "Not available";
  const hostEmail = primaryMeeting?.hostEmail?.trim() || "Not available";
  const hostPhone = primaryMeeting?.hostPhone?.trim() || "Not available";

  const whatsappSend = await sendWhatsAppTemplate(
    phoneDigits,
    "participant_meeting_info",
    "en_US",
    [
      {
        type: "body",
        parameters: [
          textParam(participantName),
          textParam(registeredEmail),
          textParam(meetingNumber),
          textParam(meetingLink),
          textParam(hostEmail),
          textParam(hostPhone),
        ],
      },
    ],
  );
  if (!whatsappSend.success) {
    return NextResponse.json(
      {
        error:
          whatsappSend.error ??
          "Unable to send WhatsApp message. Please try email search.",
      },
      { status: 502 },
    );
  }
  return NextResponse.json({
    message: "Meeting information sent on WhatsApp.",
  });
}

