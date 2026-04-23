const shell = {
  instructions:
    "rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
  dashboard:
    "rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
} as const;

function CohostStepsContent() {
  return (
    <>
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
            Part 1 — Onboarding a co-host by the host
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
                <span className="font-medium text-[#3b1a1f]">Participants</span>{" "}
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
                <span className="font-medium text-[#3b1a1f]">Make co-host</span>
                .
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-base font-semibold tracking-tight text-[#3b1a1f]">
            Part 2 — Role of co-host: Managing the meeting
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
                On the host&apos;s video tile, open the menu (three dots) and
                select{" "}
                <span className="font-medium text-[#3b1a1f]">
                  Move host to Stage
                </span>
                .
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
                Set the layout to{" "}
                <span className="font-medium text-[#3b1a1f]">Stack mode</span>.
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
                Turn{" "}
                <span className="font-semibold text-[#8a2f2a]">off</span>{" "}
                <span className="font-medium text-[#3b1a1f]">
                  Show active speaker on stage
                </span>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                4
              </span>
              <span>
                Turn{" "}
                <span className="font-semibold text-[#8a2f2a]">on</span>{" "}
                <span className="font-medium text-[#3b1a1f]">
                  Synch my stage for everyone
                </span>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                5
              </span>
              <span>
                After meeting is locked by the host, co-host removes the
                participants immediately when the lobby notification pops up.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

function CollapsibleHeaderTeaser() {
  return (
    <>
      <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
        Event day
      </span>
      <h2 className="mt-4 text-xl font-semibold text-[#3b1a1f]">
        Webex co-host instructions
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
        Web conference management: host &amp; co-host guide. Follow these steps
        in Webex so the host and co-host can run the session smoothly.
      </p>
    </>
  );
}

export default function WebexCohostInstructionsSection({
  variant = "instructions",
}: {
  variant?: keyof typeof shell;
}) {
  if (variant === "dashboard") {
    return (
      <details
        className={`${shell.dashboard} open:[&_.cohost-expand]:hidden open:[&_.cohost-collapse]:inline open:[&_.cohost-toggle]:border-[#7a3b2a]/40 open:[&_.cohost-toggle]:bg-[#f7e2b6]`}
      >
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CollapsibleHeaderTeaser />
            </div>
            <span className="cohost-toggle shrink-0 rounded-full border border-[#c58d5d]/50 bg-[#fff9ef] px-3 py-1.5 text-xs font-semibold text-[#7a3b2a] transition">
              <span className="cohost-expand">Show details</span>
              <span className="cohost-collapse hidden">Hide</span>
            </span>
          </div>
        </summary>
        <div className="mt-6 border-t border-[#e5c18e]/60 pt-2">
          <CohostStepsContent />
        </div>
      </details>
    );
  }

  return (
    <section className={shell[variant]}>
      <CollapsibleHeaderTeaser />
      <CohostStepsContent />
    </section>
  );
}
