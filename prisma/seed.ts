import { Prisma, PrismaClient, Role } from "@prisma/client";
import { createPrismaAdapter } from "../src/lib/prisma-adapter";
import { generateShortIdFromEmail } from "../src/lib/short-id";

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

  if (!email) {
    throw new Error("Email is required to derive shortId.");
  }

  const shortId = generateShortIdFromEmail(email);

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { shortId },
      select: { shortId: true },
    });
    return updated.shortId;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(`ShortId collision for email: ${email}`);
    }
    throw error;
  }
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

  // -------------------------------------------------------------------------
  // Seed notification templates
  // -------------------------------------------------------------------------
  const notificationTemplates = [
    {
      slug: "event-live",
      name: "Event is LIVE",
      title: "Event is LIVE — Join Now!",
      body: "The Gita Chanting event has started! Please join your assigned Webex meeting immediately. Your host is waiting for you.",
      type: "BROADCAST" as const,
      channels: ["EMAIL", "IN_APP"],
    },
    {
      slug: "reminder-30min",
      name: "30-Minute Reminder",
      title: "Event starts in 30 minutes",
      body: "The Gita Chanting event begins in 30 minutes. Please prepare your setup and join your Webex meeting on time.",
      type: "BROADCAST" as const,
      channels: ["EMAIL", "IN_APP"],
    },
    {
      slug: "host-checkin",
      name: "Host Check-in",
      title: "Host Check-in Required",
      body: "Please confirm you are ready to host your meeting. Log into the portal and check your meeting details. Report any issues immediately.",
      type: "BROADCAST" as const,
      channels: ["EMAIL", "IN_APP"],
    },
    {
      slug: "event-complete",
      name: "Event Complete",
      title: "Event Complete — Thank You!",
      body: "The Gita Chanting event has concluded. Thank you for your participation and dedication. Hari Om!",
      type: "BROADCAST" as const,
      channels: ["EMAIL", "IN_APP"],
    },
    {
      slug: "emergency-alert",
      name: "Emergency Alert",
      title: "Important Update — Please Read",
      body: "An important update regarding the event. Please check the portal for the latest information and follow any new instructions.",
      type: "BROADCAST" as const,
      channels: ["EMAIL", "IN_APP", "SMS"],
    },
    {
      slug: "host-relay",
      name: "Host Relay Message",
      title: "{{title}}",
      body: "{{body}}",
      type: "RELAY" as const,
      channels: ["IN_APP"],
    },
    {
      slug: "custom-broadcast",
      name: "Custom Broadcast",
      title: "{{title}}",
      body: "{{body}}",
      type: "BROADCAST" as const,
      channels: ["EMAIL", "IN_APP"],
    },
    {
      slug: "welcome-host",
      name: "Welcome Host",
      title: "Welcome to Gita Chanting Event!",
      body: "You have been registered as a host. Please log into the portal to view your meeting details and prepare for the event.",
      type: "SYSTEM" as const,
      channels: ["EMAIL", "IN_APP"],
    },
  ];

  for (const tmpl of notificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { slug: tmpl.slug },
      update: {
        name: tmpl.name,
        title: tmpl.title,
        body: tmpl.body,
        type: tmpl.type,
        channels: tmpl.channels,
      },
      create: {
        slug: tmpl.slug,
        name: tmpl.name,
        title: tmpl.title,
        body: tmpl.body,
        type: tmpl.type,
        channels: tmpl.channels,
      },
    });
  }

  console.log(`Seeded ${notificationTemplates.length} notification templates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
