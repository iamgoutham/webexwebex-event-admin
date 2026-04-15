import Link from "next/link";

const shell = {
  instructions:
    "rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
  dashboard:
    "rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
} as const;

const stepNumClass =
  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]";

function NumberedItem({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className={stepNumClass} aria-hidden>
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function PacerPhoneWorkaroundSection({
  variant = "dashboard",
}: {
  variant?: keyof typeof shell;
}) {
  return (
    <section className={shell[variant]}>
      <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
        Event day
      </span>
      <h2 className="mt-4 text-xl font-semibold italic text-[#3b1a1f]">
        Workaround for a Host: Offloading Pacer Video to a Phone
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
        If your laptop is glitching, use your smartphone to play the video. This
        saves your computer&apos;s CPU.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
        This method can be used by a Host if they are unable to find a co-host
        to do the required steps.
      </p>

      <div className="mt-8 space-y-8 border-t border-[#e5c18e]/80 pt-8">
        <div>
          <h3 className="text-base font-semibold italic text-[#3b1a1f]">
            Step 1: Prepare the Phone
          </h3>
          <ul className="mt-4 list-none space-y-3 text-sm text-[#6b4e3d]">
            <NumberedItem n={1}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Download:
              </span>{" "}
              Save the{" "}
              <a
                href="/pacervideo.mp4"
                target="_blank"
                rel="noreferrer"
                className="italic font-medium text-[#8a2f2a] underline hover:text-[#3b1a1f]"
              >
                Host Pacer mp4
              </a>{" "}
              file from the{" "}
              <Link
                href="/dashboard"
                className="font-medium text-[#8a2f2a] underline hover:text-[#3b1a1f]"
              >
                Host Portal
              </Link>{" "}
              to your phone.
            </NumberedItem>
            <NumberedItem n={2}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Silence:
              </span>{" "}
              Enable <span className="italic">Do Not Disturb</span> (block all
              calls, texts, and notifications).
            </NumberedItem>
            <NumberedItem n={3}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Stay Awake:
              </span>{" "}
              Set your phone screen timeout to{" "}
              <span className="italic">Never</span> or 30 minutes.
            </NumberedItem>
          </ul>
        </div>

        <div>
          <h3 className="text-base font-semibold italic text-[#3b1a1f]">
            Step 2: Join the Meeting on the Phone
          </h3>
          <ul className="mt-4 list-none space-y-3 text-sm text-[#6b4e3d]">
            <NumberedItem n={1}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Join:
              </span>{" "}
              Open the Webex link and join the meeting from your phone.
            </NumberedItem>
            <NumberedItem n={2}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Kill Audio:
              </span>{" "}
              Tap the 3 dots (...) →{" "}
              <span className="italic">Change Audio Connection</span> →{" "}
              <span className="italic">Don&apos;t Connect Audio</span> (this
              prevents loud feedback).
            </NumberedItem>
            <NumberedItem n={3}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Share:
              </span>{" "}
              Tap <span className="italic">Share content</span> and select the
              Pacer video. Rotate your phone to{" "}
              <span className="italic">Landscape</span> (sideways).
            </NumberedItem>
          </ul>
        </div>

        <div>
          <h3 className="text-base font-semibold italic text-[#3b1a1f]">
            Step 3: Adjust the View on your Laptop
          </h3>
          <ul className="mt-4 list-none space-y-3 text-sm text-[#6b4e3d]">
            <NumberedItem n={1}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Remove Background:
              </span>{" "}
              Stop using the virtual pacer background on your laptop.
            </NumberedItem>
            <NumberedItem n={2}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Maximize:
              </span>{" "}
              Click the double arrow icon (
              <span className="italic">Maximize the shared content</span>) to
              move participants to the side.
            </NumberedItem>
            <NumberedItem n={3}>
              <span className="font-semibold text-[#3b1a1f] not-italic">
                Swap:
              </span>{" "}
              Click the double arrow again (
              <span className="italic">Swap video view</span>) to bring the{" "}
              <span className="italic">Grid View</span> (the participants) to
              the center of your laptop screen.
            </NumberedItem>
          </ul>
        </div>

        <div>
          <h3 className="text-base font-semibold italic text-[#3b1a1f]">
            Step 4: Lock Permissions
          </h3>
          <ul className="mt-4 list-none space-y-3 text-sm text-[#6b4e3d]">
            <NumberedItem n={1}>On the laptop, click the 3 dots (...).</NumberedItem>
            <NumberedItem n={2}>
              Go to <span className="italic">Meeting Options</span>.
            </NumberedItem>
            <NumberedItem n={3}>
              Uncheck everything except the &apos;Start Video&apos; and click{" "}
              <span className="italic">Apply</span>.
            </NumberedItem>
          </ul>
        </div>
      </div>
    </section>
  );
}
