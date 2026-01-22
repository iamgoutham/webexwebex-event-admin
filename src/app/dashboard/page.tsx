import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";

export default async function DashboardPage() {
  const session = await requireAuth();
  const tenant = session.user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { name: true, slug: true },
      })
    : null;

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          You are signed in as {session.user.email}.
        </p>
        <div className="mt-4 grid gap-4 text-sm text-[#6b4e3d] md:grid-cols-3">
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9b6b4f]">
              Role
            </p>
            <p className="mt-2 text-base font-semibold text-[#3b1a1f]">
              {session.user.role}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9b6b4f]">
              Tenant
            </p>
            <p className="mt-2 text-base font-semibold text-[#3b1a1f]">
              {tenant?.name ?? "Unassigned"}
            </p>
            {tenant?.slug ? (
              <p className="text-xs text-[#8a5b44]">{tenant.slug}</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9b6b4f]">
              Access
            </p>
            <p className="mt-2 text-base font-semibold text-[#3b1a1f]">
              Webex OAuth
            </p>
            <p className="text-xs text-[#8a5b44]">JWT session strategy</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6">
        <h2 className="text-lg font-semibold">Next steps</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>Invite admins and hosts using the Users API.</li>
          <li>Create tenants via the SuperAdmin console.</li>
          <li>Generate presigned S3 uploads for assets.</li>
        </ul>
      </div>
    </div>
  );
}
