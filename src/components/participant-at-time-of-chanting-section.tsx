/**
 * At the time of Chanting — bullet list (home + can be reused).
 */
export default function ParticipantAtTimeOfChantingSection() {
  return (
    <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
      <h2 className="text-xl font-semibold text-[#3b1a1f]">
        At the time of Chanting
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
        <li>Wait for the host&apos;s instructions.</li>
        <li>The host will display a background video highlighting the verse.</li>
        <li>Unmute your audio and lower your speaker volume.</li>
        <li>Follow the visual cue to begin chanting.</li>
        <li>Ensure lip movement is clearly visible.</li>
        <li>
          Joining hands (Namaskar pose) is allowed, as long as your hands do
          not cover your mouth — lip movement must be clearly visible for
          verification.
        </li>
        <li>
          During chanting, if you get dropped or go out of the meeting, do not
          try to join immediately. You can join back for the next recording
          session.
        </li>
      </ul>
    </section>
  );
}
