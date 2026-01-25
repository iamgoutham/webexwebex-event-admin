import Image from "next/image";
import Link from "next/link";
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
              Short ID
            </p>
            <p className="mt-2 text-base font-semibold text-[#3b1a1f]">
              {session.user.shortId ?? "Pending"}
            </p>
            <p className="text-xs text-[#8a5b44]">
              Use this ID in your meeting recording
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-3">
        <Link
          href="/dashboard/meetings"
          className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md transition hover:border-[#c58d5d] hover:bg-[#fff1d6]"
        >
          <h2 className="text-lg font-semibold">Webex Meeting Link</h2>
          <p className="mt-3 text-sm text-[#6b4e3d]">
            Each host manages a single meeting using the custom link provided
            here.
          </p>
          <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-[#8a2f2a]">
            View meetings →
          </span>
        </Link>
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md">
          <h2 className="text-lg font-semibold">Chanting day Instructions</h2>
          <p className="mt-3 text-sm text-[#6b4e3d]">
            Review the event checklist, chanting flow, and on-screen guidelines
            before hosting.
          </p>
        </div>
        <Link
          href="/dashboard/uploads"
          className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md transition hover:border-[#c58d5d] hover:bg-[#fff1d6]"
        >
          <h2 className="text-lg font-semibold">Upload OBS meeting recording</h2>
          <p className="mt-3 text-sm text-[#6b4e3d]">
            Once meeting is complete upload the meeting recording here.
          </p>
          <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-[#8a2f2a]">
            Go to uploads →
          </span>
        </Link>
      </section>

      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[#e5c18e] bg-[#fff9ef]">
          <Image
            src="/hostprotocol.png"
            alt="Host protocol"
            fill
            sizes="(min-width: 1024px) 960px, 100vw"
            className="object-cover"
          />
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
