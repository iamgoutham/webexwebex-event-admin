import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { ADMIN_ROLES } from "@/lib/rbac";

export default async function AdminDashboardPage() {
  const session = await requireRole(ADMIN_ROLES);

  const tenant = session.user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { id: true, name: true, slug: true },
      })
    : null;

  const users = tenant
    ? await prisma.user.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      })
    : [];

  const tenantSummaries =
    session.user.role === Role.SUPERADMIN
      ? await prisma.tenant.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, slug: true, _count: { select: { users: true } } },
        })
      : [];

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Manage tenant-scoped users, roles, and uploads.
        </p>
      </div>

      {session.user.role === Role.SUPERADMIN ? (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6">
          <h2 className="text-lg font-semibold">Tenant overview</h2>
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Use the Users API with a tenantId query parameter to drill into a
            tenant’s roster.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {tenantSummaries.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4"
              >
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-[#8a5b44]">{item.slug}</p>
                <p className="mt-2 text-xs text-[#8a5b44]">
                  Users: {item._count.users}
                </p>
              </div>
            ))}
            {!tenantSummaries.length ? (
              <p className="text-sm text-[#8a5b44]">No tenants available yet.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6">
          <h2 className="text-lg font-semibold">Tenant users</h2>
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Current tenant: {tenant?.name ?? "Unassigned"}
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5c18e] bg-white/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3d6a3] text-xs uppercase text-[#8a5b44]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-[#e5c18e]">
                    <td className="px-4 py-3">{user.name ?? "—"}</td>
                    <td className="px-4 py-3">{user.email ?? "—"}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">
                      {user.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-[#8a5b44]" colSpan={4}>
                      No users assigned yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
