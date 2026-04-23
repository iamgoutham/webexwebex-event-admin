import ChantingStartTimesTable from "@/components/chanting-start-times-table";

const shell = {
  instructions:
    "rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
  dashboard:
    "rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
} as const;

export default function EventDayHostChecklistSection({
  variant = "instructions",
}: {
  variant?: keyof typeof shell;
}) {
  return (
    <section className={shell[variant]}>
      <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
        Event day
      </span>
      <h2 className="mt-4 text-xl font-bold leading-snug text-[#3b1a1f] sm:text-2xl">
        Event day Host Checklist (For Pacer Video as Virtual Background)
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
        Chinmaya Gita Samarpanam — event day host checklist for the day of the
        event (reference date: May 9, 2026). Trial sessions on April 25 and May
        2 use the same format as the final session.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#6b4e3d]">
        We record the chanting two times so there is a backup.
      </p>
      <a
        href="/webexHostdetailedchecklist.pdf"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex text-sm font-medium text-[#8a2f2a] underline hover:text-[#3b1a1f]"
      >
        Open Detailed Checklist
      </a>

      <div className="mt-6 border-t border-[#e5c18e]/80 pt-6">
        <ChantingStartTimesTable />
      </div>

      <div className="mt-8 border-t border-[#e5c18e]/80 pt-8">
        <ul className="list-none space-y-3 text-sm text-[#6b4e3d]">
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
              Lock the meeting and disable Participant privileges under Meeting
              Options. For chanting #1, lock at 10:10 am EDT / 9:10 am CDT / 7:10
              am PDT / 7:40 pm IST.
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
              <span className="font-medium text-[#3b1a1f]">Stop Video</span>, then
              immediately{" "}
              <span className="font-medium text-[#3b1a1f]">Start Video</span>, so
              the pacer video restarts from the beginning.
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
              Unlock the meeting after chanting #1 so anyone who missed it can
              join.
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
              For chanting #2, lock at 10:30 am EDT / 9:30 am CDT / 7:30 am PDT
              / 8:00 pm IST.
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
              . Deadline: 1:00 pm EST / 12:00 pm CST / 10:00 am PST / 10:30 pm
              IST.
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
