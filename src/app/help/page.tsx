import type { Metadata } from "next";
import Link from "next/link";
import HelpJoinLookup from "@/components/help-join-lookup";
import { loadFosterLinksFromPublic } from "@/lib/findameeting-fosterlinks";

export const metadata: Metadata = {
  title: "CGS SELF-HELPDESK – Chinmaya Gita Samarpanam",
  description:
    "Quick links for CGS Guinness record participants: meeting link, livestream, lyrics, instruction videos, and event-day instructions.",
};

const ORIGIN = "https://webex-usa.chinmayavrindavan.org";

export default async function HelpPage() {
  const fosterLinks = await loadFosterLinksFromPublic();
  const alternateLink = fosterLinks[0] ?? null;

  return (
    <div className="space-y-10 rounded-[32px] bg-[#fdf6e9] px-4 py-8 text-[#2b1f13] shadow-[0_30px_80px_rgba(58,25,15,0.15)] sm:px-6 sm:py-10 md:px-8">
      <p>
        <Link
          href="/"
          className="text-sm font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
        >
          ← Back to home
        </Link>
      </p>

      <section className="rounded-3xl border border-[#e7b474] bg-gradient-to-br from-[#f7e2b6] via-[#f3c16e] to-[#d8792d] p-6 text-[#3b1a1f] shadow-xl sm:p-8 md:p-10">
        <h1 className="text-center text-2xl font-semibold leading-tight md:text-3xl">
          Chinmaya Gita Samarpanam SELF - HELPDESK
        </h1>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-lg font-semibold text-[#3b1a1f]">Find your meeting</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Enter your WhatsApp number to find your assigned meeting link.
        </p>
        <HelpJoinLookup alternateLink={alternateLink} />
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-lg font-semibold text-[#3b1a1f]">Participant resources</h2>
        <div className="mt-4 space-y-6 text-sm text-[#6b4e3d]">
          <div>
            <h3 className="font-medium text-[#3b1a1f]">
              Participant pacer video via YouTube Livestream
            </h3>
            <a
              href="https://cmqr.in/youtubelive"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block break-all font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              https://cmqr.in/youtubelive
            </a>
          </div>
          <div>
            <h3 className="font-medium text-[#3b1a1f]">
              Participant event day instructions
            </h3>
            <Link
              href="/participant-instructions"
              className="mt-2 inline-block break-all font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              {ORIGIN}/participant-instructions
            </Link>
          </div>
          <div>
            <h3 className="font-medium text-[#3b1a1f]">📖 Keep Lyrics Ready</h3>
            <a
              href="https://tinyurl.com/ch15lyrics"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block break-all font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              https://tinyurl.com/ch15lyrics
            </a>
          </div>
          <div>
            <h3 className="font-medium text-[#3b1a1f]">
              Participant instruction video before joining the event
            </h3>
            <ul className="mt-3 list-none space-y-4">
          <li>
            <span className="font-medium text-[#3b1a1f]">
              Click here to watch in English:
            </span>{" "}
            <a
              href="https://youtu.be/uMpP_BwZ8qw"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block break-all text-sm font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              https://youtu.be/uMpP_BwZ8qw
            </a>
          </li>
          <li>
            <span className="font-medium text-[#3b1a1f]">
              Click here to watch in Hindi:
            </span>{" "}
            <a
              href="https://youtu.be/9Mo-gcWRLC8"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block break-all text-sm font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              https://youtu.be/9Mo-gcWRLC8
            </a>
          </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
