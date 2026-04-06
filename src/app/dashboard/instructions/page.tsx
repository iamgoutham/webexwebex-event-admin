import Image from "next/image";
import { requireAuth } from "@/lib/guards";

export default async function InstructionsPage() {
  await requireAuth();

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Chanting day Instructions</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Review the host protocol, chanting flow, and on-screen guidelines
          before you begin the session.
        </p>
      </div>

      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[#e5c18e] bg-[#fff9ef]">
          <Image
            src="/hostprotocol1.png?v=20260331"
            alt="Host protocol"
            fill
            unoptimized
            sizes="(min-width: 1024px) 960px, 100vw"
            className="object-cover"
          />
        </div>
      </div>

      <section className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          Webex co-host instructions
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
          Web conference management: host &amp; co-host guide. Follow these steps
          in Webex so the host and co-host can run the session smoothly.
        </p>
        <a
          href="/CohostInstructions.pdf"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-medium text-[#8a2f2a] underline hover:text-[#3b1a1f]"
        >
          Open printable PDF
        </a>

        <div className="mt-8 space-y-8 border-t border-[#e5c18e]/80 pt-8">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-[#3b1a1f]">
              Part 1 — Onboarding a co-host (host)
            </h3>
            <ul className="mt-4 list-none space-y-3 text-sm text-[#6b4e3d]">
              <li className="flex gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                  aria-hidden
                >
                  1
                </span>
                <span>
                  <span className="font-semibold text-[#3b1a1f]">
                    Identify a co-host
                  </span>
                  — Find a participant who is on a laptop or desktop.
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                  aria-hidden
                >
                  2
                </span>
                <span>
                  <span className="font-semibold text-[#3b1a1f]">
                    Open the participant list
                  </span>
                  — Click the{" "}
                  <span className="font-medium text-[#3b1a1f]">
                    Participants
                  </span>{" "}
                  icon.
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                  aria-hidden
                >
                  3
                </span>
                <span>
                  <span className="font-semibold text-[#3b1a1f]">
                    Assign the role
                  </span>
                  — Locate the person&apos;s name, open the menu (three dots), and
                  choose{" "}
                  <span className="font-medium text-[#3b1a1f]">
                    Make co-host
                  </span>
                  .
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold tracking-tight text-[#3b1a1f]">
              Part 2 — Managing the conference (co-host)
            </h3>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-[#6b4e3d] marker:font-semibold marker:text-[#d8792d]">
              <li>
                On the host&apos;s video tile, open the menu (three dots) and
                select{" "}
                <span className="font-medium text-[#3b1a1f]">
                  Move host to Stage
                </span>
                .
              </li>
              <li>
                Set the layout to{" "}
                <span className="font-medium text-[#3b1a1f]">Stack mode</span>.
              </li>
              <li>
                Turn{" "}
                <span className="font-semibold text-[#8a2f2a]">off</span>{" "}
                <span className="font-medium text-[#3b1a1f]">
                  Show active speaker on stage
                </span>
                .
              </li>
              <li>
                Turn{" "}
                <span className="font-semibold text-[#8a2f2a]">on</span>{" "}
                <span className="font-medium text-[#3b1a1f]">
                  Synch my stage for everyone
                </span>
                .
              </li>
            </ol>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 text-sm text-[#6b4e3d] sm:p-8">
        <p>
          Ensure your meeting is opened early, confirm participant audio/video
          etiquette, and keep the chanting flow aligned with the official
          checklist.
        </p>
      </div>
    </div>
  );
}
