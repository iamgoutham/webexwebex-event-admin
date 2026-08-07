import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { executeCertificateLookup } from "@/lib/certificate-lookup";
import { validateOptionalApiSecret } from "@/lib/public-api-secret";
import { applyPublicJoinCors } from "@/lib/public-api-cors";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    phone: z.string().trim().min(3).optional(),
    email: z.string().trim().min(3).optional(),
  })
  .refine((v) => Boolean(v.phone) || Boolean(v.email), {
    message: "Provide phone or email.",
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
  emailRaw: string,
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

  const parsed = schema.safeParse({
    phone: phoneRaw.trim() || undefined,
    email: emailRaw.trim() || undefined,
  });
  if (!parsed.success) {
    return json(request, { candidates: [] });
  }

  // Phone takes precedence when both are supplied.
  const [mode, contact] = parsed.data.phone
    ? (["phone", parsed.data.phone] as const)
    : (["email", parsed.data.email!] as const);

  const result = await executeCertificateLookup(
    getPostgresPrisma(),
    mode,
    contact,
  );
  if (!result.ok) {
    return json(request, result.body, { status: result.status });
  }
  return json(request, result.body);
}

// POST /api/public/certificate  Body: { "phone": "<number>" } or { "email": "<email>" }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const read = (key: "phone" | "email") =>
    body && typeof body === "object" && key in body
      ? String((body as Record<string, unknown>)[key] ?? "")
      : "";
  return handleCertificate(request, read("phone"), read("email"));
}

// GET /api/public/certificate?phone=...  or  ?email=...
export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone")?.trim() ?? "";
  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  if (!phone && !email) {
    return json(
      request,
      {
        error: "Missing phone or email parameter.",
        hint: "Use ?phone=%2B15551234567 or ?email=you%40example.com.",
      },
      { status: 400 },
    );
  }
  return handleCertificate(request, phone, email);
}

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return applyPublicJoinCors(res, request);
}
