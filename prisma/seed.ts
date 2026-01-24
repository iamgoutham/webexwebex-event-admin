import { Prisma, PrismaClient, Role } from "@prisma/client";
import { createPrismaAdapter } from "../src/lib/prisma-adapter";
import { generateShortId, generateShortIdFromEmail } from "../src/lib/short-id";

const prisma = new PrismaClient({
  adapter: createPrismaAdapter(),
});

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const ensureShortId = async (
  userId: string,
  email?: string | null,
  current?: string | null,
) => {
  if (current) {
    return current;
  }

  const baseShortId = email ? generateShortIdFromEmail(email) : null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shortId = baseShortId
      ? attempt === 0
        ? baseShortId
        : `${baseShortId}-${attempt}`
      : generateShortId();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { shortId },
        select: { shortId: true },
      });
      return updated.shortId;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to generate a unique shortId");
};

type WebexTenantSeed = {
  tenantSlug?: string;
  displayName?: string;
};

const parseWebexTenants = (): WebexTenantSeed[] => {
  const raw = process.env.WEBEX_TENANTS;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(Boolean) as WebexTenantSeed[];
  } catch {
    return [];
  }
};

async function main() {
  const seedTenantEnabled = process.env.SEED_TENANT !== "false";
  const tenantName = process.env.SEED_TENANT_NAME ?? "Default Tenant";
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? "default";

  let tenantId: string | null = null;
  let adminTenantId: string | null = null;

  if (seedTenantEnabled) {
    const webexTenants = parseWebexTenants().filter(
      (tenant) => tenant.tenantSlug,
    );

    if (webexTenants.length > 0) {
      for (const tenant of webexTenants) {
        const slug = tenant.tenantSlug?.trim();
        if (!slug) {
          continue;
        }
        const name = tenant.displayName?.trim() || slug;
        const record = await prisma.tenant.upsert({
          where: { slug },
          update: { name },
          create: { name, slug },
          select: { id: true, slug: true },
        });
        if (record.slug === tenantSlug) {
          adminTenantId = record.id;
        }
        if (!tenantId) {
          tenantId = record.id;
        }
      }
    } else {
      const tenant = await prisma.tenant.upsert({
        where: { slug: tenantSlug },
        update: { name: tenantName },
        create: { name: tenantName, slug: tenantSlug },
        select: { id: true },
      });
      tenantId = tenant.id;
      adminTenantId = tenant.id;
    }
  }

  const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL;
  if (superAdminEmail) {
    const superAdmin = await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: { name: process.env.SEED_SUPERADMIN_NAME ?? "SuperAdmin" },
      create: {
        email: superAdminEmail,
        name: process.env.SEED_SUPERADMIN_NAME ?? "SuperAdmin",
        role: Role.SUPERADMIN,
      },
      select: { id: true, shortId: true, email: true },
    });
    await ensureShortId(superAdmin.id, superAdmin.email, superAdmin.shortId);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const resolvedAdminTenantId = adminTenantId ?? tenantId;
  if (adminEmail && resolvedAdminTenantId) {
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { name: process.env.SEED_ADMIN_NAME ?? "Tenant Admin" },
      create: {
        email: adminEmail,
        name: process.env.SEED_ADMIN_NAME ?? "Tenant Admin",
        role: Role.ADMIN,
        tenant: {
          connect: { id: resolvedAdminTenantId },
        },
      },
      select: { id: true, shortId: true, email: true },
    });
    await ensureShortId(admin.id, admin.email, admin.shortId);
  } else if (adminEmail && !resolvedAdminTenantId) {
    console.warn("Skipping admin seed: tenant not found.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
