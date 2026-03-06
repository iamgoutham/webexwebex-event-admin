import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");

const tenantSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).optional(),
});

export async function GET() {
  const { response } = await requireApiAuth([Role.SUPERADMIN]);
  if (response) {
    return response;
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ tenants });
}

export async function POST(request: Request) {
  const { response } = await requireApiAuth([Role.SUPERADMIN]);
  if (response) {
    return response;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = tenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const normalizedSlug = normalizeSlug(parsed.data.slug ?? parsed.data.name);
  if (!normalizedSlug) {
    return NextResponse.json(
      { error: "Slug is required" },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: parsed.data.name,
      slug: normalizedSlug,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ tenant }, { status: 201 });
}
