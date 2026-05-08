import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeFindameetingLookup } from "@/lib/findameeting-lookup";
import { validateOptionalApiSecret } from "@/lib/public-api-secret";
import { logFindameetingRequest } from "@/lib/findameeting-log";
import { applyPublicFindameetingCors } from "@/lib/public-api-cors";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().optional().default(""),
  /** When true, response includes participant-sheet diagnostics (counts, samples, SQL source errors). */
  debug: z.boolean().optional().default(false),
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
  debugRequested: boolean,
): Promise<NextResponse> {
  const result = await executeFindameetingLookup(phoneEntered, {
    debug: debugRequested,
  });
  if (result.success) {
    const payload: Record<string, unknown> = {
      link: result.link,
      fosterLink: result.fosterLink,
    };
    if (result.debug) payload.debug = result.debug;
    return json(request, payload);
  }
  const payload: Record<string, unknown> = { error: result.error };
  if (result.debug) payload.debug = result.debug;
  return json(request, payload, { status: result.status });
}

// POST /api/public/findameeting  Body: { "phone": "<required; not format-validated>" }
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
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    await logFindameetingRequest({
      phoneEntered: "<invalid payload>",
      outcome: "invalid_payload",
    });
    return json(request, { error: "Invalid JSON body." }, { status: 400 });
  }

  const phoneEntered = parsed.data.phone.trim();
  const debugRequested = parsed.data.debug;
  return runFindameetingLookup(request, phoneEntered, debugRequested);
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

  const phoneEntered =
    request.nextUrl.searchParams.get("phone")?.trim() ?? "";

  const d = request.nextUrl.searchParams.get("debug")?.toLowerCase()?.trim();
  const debugRequested = d === "1" || d === "true" || d === "yes";

  return runFindameetingLookup(request, phoneEntered, debugRequested);
}

// Browser preflight when using cross-origin fetch with Content-Type: application/json
export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return applyPublicFindameetingCors(res, request);
}
