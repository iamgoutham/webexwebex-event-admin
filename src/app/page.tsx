import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

export default async function Home() {
  const session = await getServerAuthSession();
  const tenantConfig = await getTenantConfigFromHeaders();
  const providerId = tenantConfig?.providerId ?? "webex";

  return (
    <div className="space-y-10 rounded-[32px] bg-[#fdf6e9] px-8 py-10 text-[#2b1f13] shadow-[0_30px_80px_rgba(58,25,15,0.15)]">
      <section className="rounded-3xl border border-[#e7b474] bg-gradient-to-br from-[#f7e2b6] via-[#f3c16e] to-[#d8792d] p-10 text-[#3b1a1f] shadow-xl">
        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b86b2a] bg-white/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#8a2f2a]">
            Global Gita Chanting - Webex Host Portal
          </div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Welcome, Webex Hosts
          </h1>
          <p className="max-w-2xl text-base text-[#5b3b2b] md:text-lg">
            Thank you for supporting the Global Gita Chanting initiative. This
            portal will help you prepare, practice, and confidently host your
            Webex meeting on the event day.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <AuthButtons
              isAuthenticated={!!session?.user}
              variant="brand"
              providerId={providerId}
            />
            <a
              href="https://tinyurl.com/WebexCheatSheet"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#7a3b2a]/60 px-4 py-2 text-sm font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a]"
            >
              View Host Cheat Sheet
            </a>
            <Link
              href="/dashboard"
              className="rounded-full border border-[#7a3b2a]/60 px-4 py-2 text-sm font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a]"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-8 text-[#3b1a1f] shadow-md">
        <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
          Before You Log In
        </span>
        <h2 className="mt-4 text-xl font-semibold">
          Host Preparation - 10 Minutes
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              1. Review Essentials
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Understand your role as a Webex Host.</li>
              <li>Know when to start and stop recording.</li>
              <li>Review meeting flow for chanting.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              2. System Check
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Test microphone and camera.</li>
              <li>Use a headset if possible.</li>
              <li>Confirm stable internet connection.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              3. Dry Run
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Start a test Webex meeting.</li>
              <li>Practice mute and unmute controls.</li>
              <li>Practice starting a recording.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-8 text-[#3b1a1f] shadow-md">
        <h2 className="text-xl font-semibold">Quick Host Checklist</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              Before Meeting
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Sign in 15 minutes early.</li>
              <li>Start recording.</li>
              <li>Mute participants on entry.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              During Chanting
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Monitor audio quality.</li>
              <li>Disable chat if needed.</li>
              <li>Keep participants muted.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              After Meeting
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Stop recording properly.</li>
              <li>Save recording locally.</li>
              <li>Upload recording to cloud.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-8 text-[#3b1a1f] shadow-md">
        <h2 className="text-xl font-semibold">Helpful Links</h2>
        <div className="mt-4 grid gap-6 text-sm text-[#6b4e3d] md:grid-cols-2">
          <ul className="space-y-2">
            <li>
              <a
                href="https://tinyurl.com/WebexCheatSheet"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Webex Host Cheat Sheet
              </a>
            </li>
            <li>
              <a
                href="https://youtu.be/wxOrlHBKXYk"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Host Training Video
              </a>
            </li>
            <li>
              <a
                href="https://docs.google.com/document/d/1RKZ1pIlyvRnH3zkzIV3tm0F4ESxqr7L0B52tlhL1FQI/edit?tab=t.0"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Webex Host Detailed Guide
              </a>
            </li>
            <li>
              <span className="font-semibold text-[#3b1a1f]">
                Webex Test Meeting
              </span>
            </li>
            <li>
              <span className="font-semibold text-[#3b1a1f]">
                Troubleshooting FAQ
              </span>
            </li>
          </ul>
          <ul className="space-y-2">
            <li>Meeting link assigned after login.</li>
            <li>Recording required for verification.</li>
            <li>Follow event timing strictly.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-8 text-[#3b1a1f]">
        <h2 className="text-xl font-semibold">Event Countdown</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Global Gita Chanting Day
        </p>
        <p className="mt-1 text-sm text-[#6b4e3d]">
          Jan 30, 2026 | As per assigned time slot
        </p>
        <p className="mt-4 text-xs text-[#8a5b44]">
          Countdown timer placeholder
        </p>
      </section>
    </div>
  );
}
