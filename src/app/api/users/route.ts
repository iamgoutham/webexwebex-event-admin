import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";
import { ADMIN_ROLES, hasTenantAccess } from "@/lib/rbac";

const userSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email(),
  role: z.nativeEnum(Role).optional(),
  tenantId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const { session, response } = await requireApiAuth(ADMIN_ROLES);
  if (response) {
    return response;
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedTenantId = url.searchParams.get("tenantId");

  const tenantId =
    session.user.role === Role.SUPERADMIN
      ? requestedTenantId
      : session.user.tenantId;

  // For SUPERADMIN without an explicit tenantId, return all users.
  // For ADMIN, we require tenantId on the session; if missing, it's a config error.
  const where: Record<string, unknown> = {};
  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (!hasTenantAccess(session.user.role, session.user.tenantId, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { session, response } = await requireApiAuth(ADMIN_ROLES);
  if (response) {
    return response;
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const desiredRole = parsed.data.role ?? Role.HOST;
  let targetTenantId = parsed.data.tenantId ?? null;

  if (desiredRole === Role.SUPERADMIN) {
    targetTenantId = null;
  }

  if (session.user.role === Role.ADMIN) {
    if (desiredRole === Role.SUPERADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    targetTenantId = session.user.tenantId;
  }

  if (!targetTenantId && desiredRole !== Role.SUPERADMIN) {
    return NextResponse.json(
      { error: "Tenant is required" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    if (
      session.user.role === Role.ADMIN &&
      (existing.role === Role.SUPERADMIN ||
        existing.tenantId !== targetTenantId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { email: parsed.data.email },
      data: {
        name: parsed.data.name ?? existing.name,
        role: desiredRole,
        ...(targetTenantId
          ? {
              tenant: {
                connect: { id: targetTenantId },
              },
            }
          : {
              tenant: {
                disconnect: true,
              },
            }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
      },
    });

    return NextResponse.json({ user: updated });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name ?? null,
      email: parsed.data.email,
      role: desiredRole,
      ...(targetTenantId
        ? {
            tenant: {
              connect: { id: targetTenantId },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
