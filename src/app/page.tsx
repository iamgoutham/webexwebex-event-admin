import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";

export default async function Home() {
  const session = await getServerAuthSession();

  return (
    <div className="space-y-12">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-black p-10 text-white shadow-xl">
        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
            Production-ready Webex Admin
          </div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Secure, multi-tenant event administration for Webex customers.
          </h1>
          <p className="max-w-2xl text-base text-white/70 md:text-lg">
            OAuth-backed access control, tenant-scoped RBAC, and AWS S3 presigned
            uploads are ready out of the box. Deploy behind Apache on EC2 with
            Prisma + MySQL.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <AuthButtons isAuthenticated={!!session?.user} />
            <Link
              href="/dashboard"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Webex OAuth",
            detail:
              "Custom OAuth provider, secure session handling, and tenant-aware profile storage.",
          },
          {
            title: "RBAC Guardrails",
            detail:
              "Host by default, tenant Admin, and global SuperAdmin roles with API + UI enforcement.",
          },
          {
            title: "S3 Presigned Uploads",
            detail:
              "Scoped uploads per tenant using AWS SDK v3 and short-lived presigned URLs.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white shadow-lg"
          >
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm text-white/70">{card.detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-950 p-8 text-white">
        <h2 className="text-xl font-semibold">Quick links</h2>
        <div className="mt-4 grid gap-3 text-sm text-white/70 md:grid-cols-2">
          <Link href="/dashboard" className="hover:text-white">
            Dashboard overview
          </Link>
          <Link href="/dashboard/admin" className="hover:text-white">
            Admin controls
          </Link>
          <Link href="/dashboard/superadmin" className="hover:text-white">
            SuperAdmin console
          </Link>
          <Link href="/auth/signin" className="hover:text-white">
            Sign in with Webex
          </Link>
        </div>
      </section>
    </div>
  );
}
