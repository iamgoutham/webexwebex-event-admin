import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeFindameetingLookup } from "@/lib/findameeting-lookup";
import { validateOptionalApiSecret } from "@/lib/public-api-secret";
import { logFindameetingRequest } from "@/lib/findameeting-log";
import { applyPublicFindameetingCors } from "@/lib/public-api-cors";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(1),
});

function json(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const res = NextResponse.json(body, init);
  return applyPublicFindameetingCors(res, request);
}

async function runFindameetingLookup(
  request: NextRequest,
  phoneEntered: string,
): Promise<NextResponse> {
  const result = await executeFindameetingLookup(phoneEntered);
  if (result.success) {
    return json(request, { link: result.link });
  }
  return json(request, { error: result.error }, { status: result.status });
}

// POST /api/public/findameeting  Body: { "phone": "<whatsapp number>" }
// Requires Authorization: Bearer <FINDAMEETING_API_SECRET> when that env var is set.
export async function POST(request: NextRequest) {
  if (
    !validateOptionalApiSecret(
      request,
      process.env.FINDAMEETING_API_SECRET || process.env.EXTERNAL_API_KEY,
      ["x-findameeting-secret"],
    )
  ) {
    return json(
      request,
      {
        error: "Unauthorized.",
        hint:
          "Set Authorization: Bearer <token> or X-Findameeting-Secret matching FINDAMEETING_API_SECRET (or EXTERNAL_API_KEY).",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    await logFindameetingRequest({
      phoneEntered: "<invalid payload>",
      outcome: "invalid_payload",
    });
    return json(request, { error: "Please enter a phone number." }, { status: 400 });
  }

  const phoneEntered = parsed.data.phone.trim();
  return runFindameetingLookup(request, phoneEntered);
}

// GET /api/public/findameeting?phone=<whatsapp number>
export async function GET(request: NextRequest) {
  if (
    !validateOptionalApiSecret(
      request,
      process.env.FINDAMEETING_API_SECRET || process.env.EXTERNAL_API_KEY,
      ["x-findameeting-secret"],
    )
  ) {
    return json(
      request,
      {
        error: "Unauthorized.",
        hint:
          "Set Authorization: Bearer <token> or X-Findameeting-Secret matching FINDAMEETING_API_SECRET (or EXTERNAL_API_KEY).",
      },
      { status: 401 },
    );
  }

  const phoneEntered = request.nextUrl.searchParams.get("phone")?.trim() ?? "";
  if (!phoneEntered) {
    return json(
      request,
      {
        error: "Missing phone parameter.",
        hint: "Pass the WhatsApp number as a query string, e.g. ?phone=%2B15551234567",
      },
      { status: 400 },
    );
  }

  return runFindameetingLookup(request, phoneEntered);
}

// Browser preflight when using cross-origin fetch with Content-Type: application/json
export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return applyPublicFindameetingCors(res, request);
}
