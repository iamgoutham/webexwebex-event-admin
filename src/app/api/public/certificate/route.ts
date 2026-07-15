import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { executeCertificateLookup } from "@/lib/certificate-lookup";
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

async function handleCertificate(
  request: NextRequest,
  phoneRaw: string,
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
    return json(request, { candidates: [] });
  }

  const result = await executeCertificateLookup(
    getPostgresPrisma(),
    parsed.data.phone,
  );
  if (!result.ok) {
    return json(request, result.body, { status: result.status });
  }
  return json(request, result.body);
}

// POST /api/public/certificate  Body: { "phone": "<number>" }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone =
    body && typeof body === "object" && "phone" in body
      ? String((body as { phone?: unknown }).phone ?? "")
      : "";
  return handleCertificate(request, phone);
}

// GET /api/public/certificate?phone=...
export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone")?.trim() ?? "";
  if (!phone) {
    return json(
      request,
      {
        error: "Missing phone parameter.",
        hint: "Use ?phone=%2B15551234567.",
      },
      { status: 400 },
    );
  }
  return handleCertificate(request, phone);
}

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return applyPublicJoinCors(res, request);
}
