import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import LandingRegistrationBanner from "@/components/landing-registration-banner";
import ParticipantAtTimeOfChantingSection from "@/components/participant-at-time-of-chanting-section";
import ParticipantRequiredAndPreparationSections from "@/components/participant-required-and-prep-sections";
import { getServerAuthSession } from "@/lib/session";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

export default async function Home() {
  const session = await getServerAuthSession();
  const tenantConfig = await getTenantConfigFromHeaders();
  const providerId = tenantConfig?.providerId ?? "webex";

  return (
    <div className="space-y-10 rounded-[32px] bg-[#fdf6e9] px-4 py-8 text-[#2b1f13] shadow-[0_30px_80px_rgba(58,25,15,0.15)] sm:px-6 sm:py-10 md:px-8">
      <LandingRegistrationBanner />

      <section className="rounded-3xl border border-[#e7b474] bg-gradient-to-br from-[#f7e2b6] via-[#f3c16e] to-[#d8792d] p-6 text-[#3b1a1f] shadow-xl sm:p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="flex flex-1 flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b86b2a] bg-white/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#8a2f2a]">
              Chinmaya Gita Samarpanam
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
              Welcome
            </h1>

            {/* The record and the certificate are what visitors come for now, so
                they lead the hero instead of sitting in a section below it. */}
            <div className="rounded-2xl border border-[#c9a227] bg-[#101f3c] p-5 text-[#fdf6e9] shadow-lg sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#e3c46a]">
                Officially Amazing
              </p>
              <h2 className="mt-2 text-xl font-semibold md:text-2xl">
                We set a GUINNESS WORLD RECORDS&trade; title together
              </h2>
              <p className="mt-3 text-sm text-[#d5dbea] md:text-base">
                On 9 May 2026, <strong className="text-white">8,277 people</strong>{" "}
                chanted online simultaneously — the most ever — achieved by
                Chinmaya Mission. Your participation certificate is ready to
                download.
              </p>
              <p className="mt-2 text-sm text-[#b9c2d6]">
                9 मई 2026 को 8,277 लोगों ने एक साथ ऑनलाइन जप कर विश्व रिकॉर्ड बनाया।
                आपका प्रमाणपत्र तैयार है।
              </p>
              <Link
                href="/certificate"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#e3c46a] px-6 py-3 text-sm font-semibold text-[#101f3c] shadow-md transition hover:bg-[#f0d68b] sm:w-auto"
              >
                Download your certificate
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <AuthButtons
                isAuthenticated={!!session?.user}
                variant="brand"
                providerId={providerId}
              />
              <Link
                href="/dashboard"
                className="rounded-full border border-[#7a3b2a]/60 px-4 py-2 text-sm font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a]"
              >
                View dashboard
              </Link>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col items-center gap-4 md:ml-4 md:w-auto md:items-end">
            <Link
              href="/help"
              className="inline-flex w-full max-w-[min(100%,20rem)] items-center justify-center rounded-full bg-[#8a2f2a] px-5 py-2.5 text-sm font-semibold text-[#fff9ef] shadow-md transition hover:bg-[#722825] md:w-auto md:min-w-[11rem]"
            >
              CGS Helpdesk
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <div className="overflow-hidden rounded-xl border border-[#e5c18e] bg-[#1a1208]">
          <video
            className="max-h-[70vh] w-full object-contain"
            controls
            playsInline
            preload="metadata"
            aria-label="Participants information video"
          >
            <source src="/participants.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </section>

      <section className="text-[#3b1a1f]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
            <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
              Participants
            </span>
            <h2 className="mt-4 text-xl font-semibold">Participants</h2>
            <p className="mt-2 text-sm text-[#6b4e3d]">
              <Link
                href="/confirm-registration"
                className="font-semibold text-[#8a2f2a] underline hover:text-[#5c2a2d]"
              >
                Not sure if you are registered? Click here to verify.
              </Link>
            </p>
            <p className="mt-3 text-sm text-[#6b4e3d]">
              <Link
                href="/participant-instructions"
                className="font-semibold text-[#8a2f2a] underline hover:text-[#5c2a2d]"
              >
                Participant instructions
              </Link>
            </p>
            <p className="mt-3 text-sm text-[#6b4e3d]">
              <Link
                href="#helpful-links"
                className="font-semibold text-[#8a2f2a] underline hover:text-[#5c2a2d]"
              >
                Helpful links
              </Link>
            </p>
            <p className="mt-3 text-xs text-[#6b4e3d]">
              You will receive an email confirmation and your meeting assignment
              if one has been generated.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
            <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
              Hosts
            </span>
            <h2 className="mt-4 text-xl font-semibold">Hosts</h2>
            <p className="mt-2 text-sm text-[#6b4e3d]">
              Log in to manage your meeting, uploads, and participant details.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>
                <a
                  href="https://docs.google.com/document/d/1tD2dKN9SU7WnVPoYG7lCRAW8iWdCEhpi9_GvTGySBF0/edit?tab=t.0"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                >
                  Host Setup Instructions
                </a>
              </li>
              <li>
                <a
                  href="/hostsetuptutorial.mp4"
                  className="font-semibold text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                >
                  Host Setup Tutorial Video
                </a>
              </li>
              <li>
                <Link
                  href="/dashboard/meetings"
                  className="font-semibold text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                >
                  Host dashboard (meetings)
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="font-semibold text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                >
                  Troubleshooting FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <ParticipantRequiredAndPreparationSections />

      <ParticipantAtTimeOfChantingSection />

      <section
        id="helpful-links"
        className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8"
      >
        <h2 className="text-xl font-semibold">Helpful Links</h2>
        <div className="mt-4 grid gap-6 text-sm text-[#6b4e3d] sm:grid-cols-2 lg:grid-cols-3">
          <ul className="space-y-2">
            <li>
              <Link
                href="/help"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                CGS SELF-HELPDESK (participant quick links)
              </Link>
              <p className="mt-1 text-xs font-normal text-[#8a5b44]">
                Meeting link lookup, livestream, late host, and event-day
                instructions.
              </p>
            </li>
            <li>
              <a
                href="https://tinyurl.com/GitaChantingReg"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Register for the event as participant(Outside India)
              </a>
            </li>
            <li>
              <a
                href="https://tinyurl.com/CGSIndiaReg"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Register for the event as participant(India)
              </a>
            </li>
            <li>
              <a
                href="https://tinyurl.com/WebexHostReg"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Register for the event as Host(Outside India)
              </a>
            </li>
            <li>
              <a
                href="https://tinyurl.com/WebexHostIndia"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Register for the event as Host(India)
              </a>
            </li>
            <li>
              <a
                href="https://tinyurl.com/UsefulCgsInfoVer2"
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
                href="https://tinyurl.com/CGS-PracticeVideo"
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
              <a
                href="https://tinyurl.com/GitaSamarpanamLyrics"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Chapter 15 Lyrics
              </a>
            </li>
            <li>
              <Link
                href="/faq"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Troubleshooting FAQ
              </Link>
            </li>
            <li>
              <Link
                href="/confirm-registration"
                className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
              >
                Confirm registration (email)
              </Link>
              <p className="mt-1 text-xs font-normal text-[#8a5b44]">
                Not sure if you are registered? Use this link to receive a
                confirmation email with your role and meeting info.
              </p>
            </li>
          </ul>
          <div className="space-y-2">
            <ul className="space-y-2">
              <li>
                <a
                  href="https://webex-usa.chinmayavrindavan.org/dashboard/meetings"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#3b1a1f] hover:text-[#8a2f2a]"
                >
                  Host Dashboard
                </a>
                <p className="mt-1 text-xs font-normal text-[#8a5b44]">
                  View your assigned meeting link and participant contact details
                  (emails/phone numbers) here.
                </p>
              </li>
            </ul>
          </div>
        </div>
      </section>

    </div>
  );
}
