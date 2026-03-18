import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupConfirmation, sendConfirmationEmail } from "@/lib/public-confirmation";

const schema = z.object({
  email: z.string().email(),
  captchaToken: z.string().min(1),
});

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

  const lookup = await lookupConfirmation(parsed.data.email);
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

