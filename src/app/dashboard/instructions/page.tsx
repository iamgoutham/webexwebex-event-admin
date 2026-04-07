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
            src="/hostprotocol1.png?v=202603312"
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
          Event day Host checklist
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
          Chinmaya Gita Samarpanam — Webex host checklist for the day of the
          event (reference date: May 9, 2026). Trial sessions on April 25 and
          May 2 use the same format as the final session.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
          We record the chanting two times so there is a backup.
        </p>
        <a
          href="/WebexHostChecklist.pdf"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-medium text-[#8a2f2a] underline hover:text-[#3b1a1f]"
        >
          Open printable PDF
        </a>

        <div className="mt-6 border-t border-[#e5c18e]/80 pt-6">
          <h3 className="text-base font-semibold text-[#3b1a1f]">
            Start times (start chanting exactly at these times)
          </h3>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e5c18e] bg-[#fff9ef]">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm text-[#6b4e3d]">
              <thead>
                <tr className="border-b border-[#e5c18e] bg-[#fff1d6]">
                  <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                    &nbsp;
                  </th>
                  <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                    US EDT
                  </th>
                  <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                    US CDT
                  </th>
                  <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                    US PDT
                  </th>
                  <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                    India
                  </th>
                  <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                    GMT
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#e5c18e]/70">
                  <td className="px-3 py-2 font-medium text-[#3b1a1f]">
                    Chanting #1
                  </td>
                  <td className="px-3 py-2">10:15 am</td>
                  <td className="px-3 py-2">9:15 am</td>
                  <td className="px-3 py-2">7:15 am</td>
                  <td className="px-3 py-2">7:45 pm</td>
                  <td className="px-3 py-2">3:15 pm</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-[#3b1a1f]">
                    Chanting #2
                  </td>
                  <td className="px-3 py-2">10:35 am</td>
                  <td className="px-3 py-2">9:35 am</td>
                  <td className="px-3 py-2">7:35 am</td>
                  <td className="px-3 py-2">8:05 pm</td>
                  <td className="px-3 py-2">3:35 pm</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 border-t border-[#e5c18e]/80 pt-8">
          <h3 className="text-base font-semibold text-[#3b1a1f]">
            Webex host checklist
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
                Turn off all notifications, log in to the Webex app, and start
                your meeting.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                2
              </span>
              <span>Identify a co-host from your participants.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                3
              </span>
              <span>Guide the co-host through setup.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                4
              </span>
              <span>Ensure your layout is in grid mode.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                5
              </span>
              <span>
                Make sure all participant videos are on and faces are visible in
                the center of the video.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                6
              </span>
              <span>
                Check that every participant shows their full name on screen; if
                not, ask them to update their display name.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                7
              </span>
              <span>
                Ask everyone to unmute audio and lower speaker volume to avoid
                distraction.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                8
              </span>
              <span>
                Lock the meeting five minutes before chanting starts. For
                chanting #1, lock at 10:10 am EDT / 9:10 am CDT / 7:10 am PDT /
                7:40 pm IST.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                9
              </span>
              <span>
                Open the OBS app (setup ready), start recording just before
                chanting start time, then minimize OBS.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                10
              </span>
              <span>
                At chanting start time, click{" "}
                <span className="font-medium text-[#3b1a1f]">Stop Video</span>
                , then immediately{" "}
                <span className="font-medium text-[#3b1a1f]">Start Video</span>
                , so the pacer video restarts from the beginning.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                11
              </span>
              <span>
                After chanting, open OBS, stop recording, and minimize OBS.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                12
              </span>
              <span>
                Unlock the meeting after chanting #1 so anyone who missed it
                can join.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                13
              </span>
              <span>
                For chanting #2, lock at 10:30 am EDT / 9:30 am CDT / 7:30 am
                PDT / 8:00 pm IST.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                14
              </span>
              <span>Repeat steps 9–11 for chanting #2.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                15
              </span>
              <span>Thank participants and end the Webex meeting.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d8792d]/25 text-xs font-bold text-[#7a3b2a]"
                aria-hidden
              >
                16
              </span>
              <span>
                Upload the OBS recording to the host portal:{" "}
                <a
                  href="https://webex-usa.chinmayavrindavan.org/dashboard/uploads"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#8a2f2a] underline hover:text-[#3b1a1f]"
                >
                  webex-usa.chinmayavrindavan.org/dashboard/uploads
                </a>
                . Deadline: 1:00 pm EST / 12:00 pm CST / 10:00 am PST / 10:30
                pm IST.
              </span>
            </li>
          </ul>
        </div>
      </section>

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
                  <span className="font-medium text-[#3b1a1f]">
                    Stack mode
                  </span>
                  .
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
      </section>
    </div>
  );
}
