import { Prisma, PrismaClient, Role } from "@prisma/client";
import { randomBytes } from "crypto";
import { createPrismaAdapter } from "../src/lib/prisma-adapter";

const prisma = new PrismaClient({
  adapter: createPrismaAdapter(),
});

const generateShortId = () => randomBytes(6).toString("hex");

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const ensureShortId = async (userId: string, current?: string | null) => {
  if (current) {
    return current;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shortId = generateShortId();
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

async function main() {
  const seedTenantEnabled = process.env.SEED_TENANT !== "false";
  const tenantName = process.env.SEED_TENANT_NAME ?? "Default Tenant";
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? "default";

  let tenantId: string | null = null;

  if (seedTenantEnabled) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: tenantSlug },
      update: { name: tenantName },
      create: { name: tenantName, slug: tenantSlug },
      select: { id: true },
    });
    tenantId = tenant.id;
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
      select: { id: true, shortId: true },
    });
    await ensureShortId(superAdmin.id, superAdmin.shortId);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (adminEmail && tenantId) {
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { name: process.env.SEED_ADMIN_NAME ?? "Tenant Admin" },
      create: {
        email: adminEmail,
        name: process.env.SEED_ADMIN_NAME ?? "Tenant Admin",
        role: Role.ADMIN,
        tenantId,
      },
      select: { id: true, shortId: true },
    });
    await ensureShortId(admin.id, admin.shortId);
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
