import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executePublicJoinLookup } from "@/lib/public-join-lookup";
import { validateOptionalApiSecret } from "@/lib/public-api-secret";
import { applyPublicJoinCors } from "@/lib/public-api-cors";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(3),
});

function json(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const res = NextResponse.json(body, init);
  return applyPublicJoinCors(res, request);
}

function unauthorized(request: NextRequest): NextResponse {
  return json(
    request,
    {
      error: "Unauthorized.",
      hint:
        "Set Authorization: Bearer <token> or X-Join-Secret matching PUBLIC_JOIN_API_SECRET (or EXTERNAL_API_KEY).",
    },
    { status: 401 },
  );
}

async function handleJoin(
  request: NextRequest,
  phoneRaw: string,
  debug: boolean,
): Promise<NextResponse> {
  if (
    !validateOptionalApiSecret(
      request,
      process.env.PUBLIC_JOIN_API_SECRET || process.env.EXTERNAL_API_KEY,
      ["x-join-secret"],
    )
  ) {
    return unauthorized(request);
  }

  const parsed = schema.safeParse({ phone: phoneRaw.trim() });
  if (!parsed.success) {
    return json(
      request,
      debug
        ? { candidates: [], debug: { error: "invalid payload" } }
        : { candidates: [] },
    );
  }

  const result = await executePublicJoinLookup(parsed.data.phone, debug);
  if (!result.ok) {
    return json(request, result.body, { status: result.status });
  }
  return json(request, result.body);
}

// POST /api/public/join  Body: { "phone": "<whatsapp number>" }
// Optional: ?debug=1 or header X-Join-Debug: 1 for verbose payload.
export async function POST(request: NextRequest) {
  const debugEnabled =
    request.nextUrl.searchParams.get("debug") === "1" ||
    request.headers.get("x-join-debug") === "1";

  const body = await request.json().catch(() => null);
  const phone =
    body && typeof body === "object" && "phone" in body
      ? String((body as { phone?: unknown }).phone ?? "")
      : "";

  return handleJoin(request, phone, debugEnabled);
}

// GET /api/public/join?phone=...&debug=1
export async function GET(request: NextRequest) {
  const debugEnabled =
    request.nextUrl.searchParams.get("debug") === "1" ||
    request.headers.get("x-join-debug") === "1";
  const phone = request.nextUrl.searchParams.get("phone")?.trim() ?? "";

  if (!phone) {
    return json(
      request,
      {
        error: "Missing phone parameter.",
        hint: "Use ?phone=%2B15551234567 (optional &debug=1).",
      },
      { status: 400 },
    );
  }

  return handleJoin(request, phone, debugEnabled);
}

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return applyPublicJoinCors(res, request);
}
