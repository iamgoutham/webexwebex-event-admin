import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/postgres-client";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { applyPublicJoinCors } from "@/lib/public-api-cors";
import { validateOptionalApiSecret } from "@/lib/public-api-secret";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .strict();

function normalizeDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function json(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const res = NextResponse.json(body, init);
  return applyPublicJoinCors(res, request);
}

function memberUpdateSecret(): string | undefined {
  return (
    process.env.MEMBER_UPDATE_API_SECRET?.trim() ||
    process.env.PUBLIC_JOIN_API_SECRET?.trim() ||
    process.env.EXTERNAL_API_KEY?.trim()
  );
}

/**
 * POST /api/public/member-update?phone=<digits>
 * Updates prtcpnt_name and/or prtcpnt_email_id on mission.participant_data_sheet_set
 * for rows whose prtcpnt_phone_no matches (full digits or last 10).
 *
 * Auth (when MEMBER_UPDATE_API_SECRET, PUBLIC_JOIN_API_SECRET, or EXTERNAL_API_KEY is set):
 *   Authorization: Bearer <secret> | X-Member-Update-Secret | X-Join-Secret
 */
export async function POST(request: NextRequest) {
  if (
    !validateOptionalApiSecret(request, memberUpdateSecret(), [
      "x-member-update-secret",
      "x-join-secret",
    ])
  ) {
    return json(
      request,
      {
        status: "error",
        message: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const phoneRaw =
    request.nextUrl.searchParams.get("phone")?.trim() ?? "";
  const digits = normalizeDigits(phoneRaw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";

  if (!phoneRaw || digits.length < 10) {
    return json(
      request,
      {
        status: "error",
        message: "Query parameter phone must contain at least 10 digits.",
      },
      { status: 400 },
    );
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    return json(
      request,
      {
        status: "error",
        message: "Downstream database is not configured.",
      },
      { status: 500 },
    );
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        request,
        {
          status: "error",
          message: "Invalid JSON body. Allowed fields: name (string), email (string).",
        },
        { status: 400 },
      );
    }
    parsedBody = parsed.data;
  } catch {
    return json(
      request,
      {
        status: "error",
        message: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  if (parsedBody.name === undefined && parsedBody.email === undefined) {
    return json(
      request,
      {
        status: "error",
        message: "Provide at least one of name or email.",
      },
      { status: 400 },
    );
  }

  const setParts: Prisma.Sql[] = [];
  if (parsedBody.name !== undefined) {
    setParts.push(Prisma.sql`prtcpnt_name = ${parsedBody.name.trim()}`);
  }
  if (parsedBody.email !== undefined) {
    setParts.push(
      Prisma.sql`prtcpnt_email_id = ${parsedBody.email.trim().toLowerCase()}`,
    );
  }

  try {
    const updated = await postgres.$executeRaw(Prisma.sql`
      UPDATE mission.participant_data_sheet_set
      SET ${Prisma.join(setParts, ", ")}
      WHERE (
        regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g') = ${digits}
        OR right(
          regexp_replace(btrim(COALESCE(prtcpnt_phone_no::text, '')), '[^0-9]', '', 'g'),
          10
        ) = ${last10}
      )
    `);

    const n = typeof updated === "bigint" ? Number(updated) : Number(updated);
    if (n === 0) {
      return json(
        request,
        {
          status: "error",
          message: "Member not found",
        },
        { status: 404 },
      );
    }

    return json(request, {
      status: "success",
      message: "Member updated successfully",
    });
  } catch (err) {
    return json(
      request,
      {
        status: "error",
        message:
          err instanceof Error ? err.message : "Update failed.",
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return applyPublicJoinCors(res, request);
}
