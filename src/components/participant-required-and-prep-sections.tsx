import ChantingStartTimesTable from "@/components/chanting-start-times-table";

/**
 * Required Participation + Pre-Session Preparation (shared: landing + participant-instructions).
 */
export default function ParticipantRequiredAndPreparationSections() {
  return (
    <>
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          📅 Required Participation (10:00 AM EST/7.30 PM IST)
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>April 25 – Trial Meeting(Mandatory)</li>
          <li>May 2 – Trial Meeting(Mandatory)</li>
          <li>May 9 – Official Guinness Record-Breaking Event</li>
        </ul>
        <p className="mt-3 font-semibold text-[#8a2f2a]">
          All sessions begin at 10:00 AM EST/7.30 PM IST. Chanting will be done
          two times
        </p>
        <div className="mt-6 border-t border-[#e5c18e]/80 pt-6">
          <ChantingStartTimesTable />
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          🖥️ Pre-Session Preparation
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>Join 10 minutes early.</li>
          <li>Center yourself clearly in the screen with Video ON.</li>
          <li>
            Sit in a comfortable position with no external and surrounding
            distractions.
          </li>
          <li>Set your display name correctly.</li>
          <li>
            Participants can keep a print copy of the Chapter 15 lyrics and keep
            it handy.
          </li>
          <li>Ensure your Audio is ON and speaker volume lowered.</li>
          <li>
            Sit in a well-lit location. Ensure light is focused on your face with
            no light source behind you. Do not sit with your back to a window —
            this will darken your face on camera.
          </li>
        </ul>
        <div className="mt-6 space-y-2 border-t border-[#e5c18e]/80 pt-6 text-sm text-[#6b4e3d]">
          <p>
            <span className="font-semibold text-[#3b1a1f]">
              For General Question and Concerns:
            </span>{" "}
            <a
              href="mailto:cgs@chinmayavrindavan.org"
              className="font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              cgs@chinmayavrindavan.org
            </a>
          </p>
          <p>
            <span className="font-semibold text-[#3b1a1f]">
              For technical issues and Setup Issues:
            </span>{" "}
            <a
              href="mailto:cgs-tech@chinmayavrindavan.org"
              className="font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              cgs-tech@chinmayavrindavan.org
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
