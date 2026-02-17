import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import CountdownTimer from "@/components/countdown-timer";
import { getServerAuthSession } from "@/lib/session";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

export default async function Home() {
  const session = await getServerAuthSession();
  const tenantConfig = await getTenantConfigFromHeaders();
  const providerId = tenantConfig?.providerId ?? "webex";

  return (
    <div className="space-y-10 rounded-[32px] bg-[#fdf6e9] px-4 py-8 text-[#2b1f13] shadow-[0_30px_80px_rgba(58,25,15,0.15)] sm:px-6 sm:py-10 md:px-8">
      <section className="rounded-3xl border border-[#e7b474] bg-gradient-to-br from-[#f7e2b6] via-[#f3c16e] to-[#d8792d] p-6 text-[#3b1a1f] shadow-xl sm:p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="flex flex-1 flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b86b2a] bg-white/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#8a2f2a]">
              Global Gita Chanting - Webex Host Portal
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
              Welcome, Webex Hosts
            </h1>
            <p className="max-w-2xl text-base text-[#5b3b2b] md:text-lg">
              Thank you for supporting the Global Gita Chanting initiative. This
              portal will help you prepare, practice, and confidently host your
              Webex meeting on the event day.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
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
          <div className="flex shrink-0 md:ml-4">
            <CountdownTimer
              targetDate={new Date("2026-05-09T00:00:00Z")}
              label="Event Countdown"
              sublabel="Global Gita Chanting Day — May 9th, 2026"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
          Software Setup
        </span>
        <h2 className="mt-4 text-xl font-semibold">Prepare Your Tools</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              System Requirements
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Stable internet connection.</li>
              <li>Working microphone and camera.</li>
              <li>Laptop or Desktop computer. 21" monitor recommended</li>
              <li>21" monitor recommended</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              Install Webex Desktop App
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Download and install the Webex desktop app.</li>
              <li>Sign in with your host credentials.</li>
              <li>Set your meeting layout to the max value supported</li>
              <li>Verify audio and video settings.</li>
              <li>Add the pacer video as background.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              Install OBS Software
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Install OBS Studio on your system.</li>
              <li>Setup your capture,browser,text sources</li>
              <li>Set the output directory for recordings.</li>
              <li>Test recording before the event.</li>
              <li>Visually check the video to ensure guinness requirements.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
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

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
       <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
         Event day 
       </span>
        <h2 className="text-xl font-semibold">Quick Host Checklist</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              Before Meeting
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Sign in 15 minutes early.</li>
              <li>Start recording.</li>
              <li>Ask participants on entry to reduce their speaker volume to 5%.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              During Chanting
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Start the pacer video by restarting video.</li>
              <li>Monitor audio quality.</li>
              <li>Disable chat if needed.</li>
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

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold">Helpful Links</h2>
        <div className="mt-4 grid gap-6 text-sm text-[#6b4e3d] sm:grid-cols-2">
          <ul className="space-y-2">
            <li>
              <a
                href="https://tinyurl.com/GitaChantingReg"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Register for the event
              </a>
            </li>
            <li>
              <a
                href="https://tinyurl.com/UsefulCgsInfo"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Useful Event Info
              </a>
            </li>
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
                Gita chanting Practice Video
              </a>
            </li>
          </ul>
          <ul className="space-y-2">
            <li>
              <a
                href="/pacervideo.mp4"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Host background pacer video
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
                Troubleshooting FAQ
              </span>
            </li>
            <li className="pt-2 text-[#6b4e3d]">Meeting link assigned after login.</li>
            <li className="text-[#6b4e3d]">Recording required for verification.</li>
            <li className="text-[#6b4e3d]">Follow event timing strictly.</li>
          </ul>
        </div>
      </section>

    </div>
  );
}
