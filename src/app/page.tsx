import Image from "next/image";
import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";

export default async function Home() {
  const session = await getServerAuthSession();

  return (
    <div className="space-y-10 rounded-[32px] bg-[#fdf6e9] px-8 py-10 text-[#2b1f13] shadow-[0_30px_80px_rgba(58,25,15,0.15)]">
      <section className="rounded-3xl border border-[#e7b474] bg-gradient-to-br from-[#f7e2b6] via-[#f3c16e] to-[#d8792d] p-10 text-[#3b1a1f] shadow-xl">
        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b86b2a] bg-white/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#8a2f2a]">
            Webex Host Portal
          </div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Chinmaya Gita Samarpanam
          </h1>
          <p className="max-w-2xl text-base text-[#5b3b2b] md:text-lg">
            Welcome to host portal. You will find all resources needed to
            successfully host the guiness record breaking webex meet.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <AuthButtons isAuthenticated={!!session?.user} variant="brand" />
            <Link
              href="/dashboard"
              className="rounded-full border border-[#7a3b2a]/60 px-4 py-2 text-sm font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a]"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[#e5c18e] bg-[#fff9ef]">
          <Image
            src="https://drive.google.com/uc?export=view&id=1cHt_QAUd8deVzrpYeCFAlhbTjqP-ayOc"
            alt="Global Gita Chanting"
            fill
            sizes="(min-width: 1024px) 960px, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Webex Meeting Link",
            detail:
              "Each host manages a single meeting using the custom link provided here.",
          },
          {
            title: "Chant chapter 15. Instructions",
            detail:
              "Running the meeting and ensuring you follow the guiness rules is important.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md"
          >
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm text-[#6b4e3d]">{card.detail}</p>
          </div>
        ))}
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

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-8 text-[#3b1a1f]">
        <h2 className="text-xl font-semibold">Quick links</h2>
        <div className="mt-4 grid gap-3 text-sm text-[#6b4e3d] md:grid-cols-2">
          <Link href="/dashboard" className="hover:text-[#3b1a1f]">
            Dashboard overview
          </Link>
          <Link href="/dashboard/admin" className="hover:text-[#3b1a1f]">
            Admin controls
          </Link>
          <Link href="/dashboard/superadmin" className="hover:text-[#3b1a1f]">
            SuperAdmin console
          </Link>
          <Link href="/auth/signin" className="hover:text-[#3b1a1f]">
            Sign in with Webex
          </Link>
        </div>
      </section>
    </div>
  );
}
