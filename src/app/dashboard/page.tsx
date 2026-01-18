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
    <div className="space-y-8 text-white">
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-white/70">
          You are signed in as {session.user.email}.
        </p>
        <div className="mt-4 grid gap-4 text-sm text-white/70 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Role
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {session.user.role}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Tenant
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {tenant?.name ?? "Unassigned"}
            </p>
            {tenant?.slug ? (
              <p className="text-xs text-white/60">{tenant.slug}</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Access
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              Webex OAuth
            </p>
            <p className="text-xs text-white/60">JWT session strategy</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
        <h2 className="text-lg font-semibold">Next steps</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/70">
          <li>Invite admins and hosts using the Users API.</li>
          <li>Create tenants via the SuperAdmin console.</li>
          <li>Generate presigned S3 uploads for assets.</li>
        </ul>
      </div>
    </div>
  );
}
