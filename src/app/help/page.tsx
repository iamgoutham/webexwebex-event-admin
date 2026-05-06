import type { Metadata } from "next";
import Link from "next/link";
import CopyableUrlField from "@/components/copyable-url-field";

export const metadata: Metadata = {
  title: "CGS SELF-HELPDESK – Chinmaya Gita Samarpanam",
  description:
    "Quick links for CGS Guinness record participants: meeting link, livestream, lyrics, instruction videos, and event-day instructions.",
};

const ORIGIN = "https://webex-usa.chinmayavrindavan.org";

export default function HelpPage() {
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
        <ol className="list-decimal space-y-6 pl-5 text-sm text-[#6b4e3d] marker:font-semibold marker:text-[#3b1a1f]">
          <li className="pl-1">
            <span className="font-medium text-[#3b1a1f]">
              Unable to find your event day meeting link?
            </span>{" "}
            Check here — use the copy icon or select the URL:
            <CopyableUrlField
              href="/join"
              copyText={`${ORIGIN}/join`}
            />
          </li>
          <li className="pl-1">
            <span className="font-medium text-[#3b1a1f]">
              On the day of the event, if your Host has not started your
              meeting on time?
            </span>{" "}
            Get a new meeting link here — use the copy icon or select the URL:
            <CopyableUrlField
              href="/findameeting"
              copyText={`${ORIGIN}/findameeting`}
            />
          </li>
          <li className="pl-1">
            <span className="font-medium text-[#3b1a1f]">
              Participant pacer video via YouTube Livestream:
            </span>{" "}
            Use the copy icon or select the URL:
            <CopyableUrlField
              href="https://cmqr.in/youtubelive"
              copyText="https://cmqr.in/youtubelive"
              external
            />
          </li>
          <li className="pl-1">
            <span className="font-medium text-[#3b1a1f]">
              Participant event day instructions:
            </span>{" "}
            Use the copy icon or select the URL:
            <CopyableUrlField
              href="/participant-instructions"
              copyText={`${ORIGIN}/participant-instructions`}
            />
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-lg font-semibold text-[#3b1a1f]">
          📖 Keep Lyrics Ready
        </h2>
        <p className="mt-3 text-sm text-[#6b4e3d]">
          Print or download lyrics in your language — use the copy icon or
          select the URL:
        </p>
        <CopyableUrlField
          href="https://tinyurl.com/ch15lyrics"
          copyText="https://tinyurl.com/ch15lyrics"
          external
        />
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-lg font-semibold text-[#3b1a1f]">
          Participant instruction video before joining the event
        </h2>
        <ul className="mt-4 list-none space-y-6 text-sm text-[#6b4e3d]">
          <li>
            <span className="font-medium text-[#3b1a1f]">
              Click here to watch in English:
            </span>{" "}
            use the copy icon or select the URL:
            <CopyableUrlField
              href="https://youtu.be/uMpP_BwZ8qw"
              copyText="https://youtu.be/uMpP_BwZ8qw"
              external
            />
          </li>
          <li>
            <span className="font-medium text-[#3b1a1f]">
              Click here to watch in Hindi:
            </span>{" "}
            use the copy icon or select the URL:
            <CopyableUrlField
              href="https://youtu.be/9Mo-gcWRLC8"
              copyText="https://youtu.be/9Mo-gcWRLC8"
              external
            />
          </li>
        </ul>
      </section>
    </div>
  );
}
