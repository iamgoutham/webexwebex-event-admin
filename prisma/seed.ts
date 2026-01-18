import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

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
    await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: { name: process.env.SEED_SUPERADMIN_NAME ?? "SuperAdmin" },
      create: {
        email: superAdminEmail,
        name: process.env.SEED_SUPERADMIN_NAME ?? "SuperAdmin",
        role: Role.SUPERADMIN,
      },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (adminEmail && tenantId) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { name: process.env.SEED_ADMIN_NAME ?? "Tenant Admin" },
      create: {
        email: adminEmail,
        name: process.env.SEED_ADMIN_NAME ?? "Tenant Admin",
        role: Role.ADMIN,
        tenantId,
      },
    });
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
