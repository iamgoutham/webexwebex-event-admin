import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";

export default async function SuperAdminDashboardPage() {
  await requireRole([Role.SUPERADMIN]);

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">SuperAdmin console</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Create tenants, seed admins, and audit cross-tenant activity.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tenants</h2>
          <span className="text-xs text-[#8a5b44]">
            Use the Tenants API to create new records.
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4"
            >
              <p className="text-sm font-semibold">{tenant.name}</p>
              <p className="text-xs text-[#8a5b44]">{tenant.slug}</p>
              <p className="mt-2 text-xs text-[#8a5b44]">
                Users: {tenant._count.users}
              </p>
              <p className="text-xs text-[#b0896a]">
                Created {tenant.createdAt.toLocaleDateString()}
              </p>
            </div>
          ))}
          {!tenants.length ? (
            <p className="text-sm text-[#8a5b44]">No tenants created yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
