import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupConfirmation, sendConfirmationEmail } from "@/lib/public-confirmation";

const schema = z.object({
  email: z.string().email(),
});

const getApiKey = (request: Request) =>
  request.headers.get("x-api-key") ?? request.headers.get("X-API-Key");

// POST /api/external/confirm-registration — API-key protected
export async function POST(request: NextRequest) {
  const apiKey = process.env.EXTERNAL_API_KEY;
  if (!apiKey) {
    console.error("Missing EXTERNAL_API_KEY");
    process.exit(1);
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

