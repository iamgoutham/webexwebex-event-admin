import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chinmaya Gita Samarpanam – Participant Instructions",
  description:
    "Participant instructions for the global record-breaking chanting event",
};

export default function ParticipantInstructionsPage() {
  return (
    <div className="space-y-10 rounded-[32px] bg-[#fdf6e9] px-4 py-8 text-[#2b1f13] shadow-[0_30px_80px_rgba(58,25,15,0.15)] sm:px-6 sm:py-10 md:px-8">
      {/* Header */}
      <section className="rounded-3xl border border-[#e7b474] bg-gradient-to-br from-[#f7e2b6] via-[#f3c16e] to-[#d8792d] p-6 text-[#3b1a1f] shadow-xl sm:p-8 md:p-10">
        <h1 className="text-center text-3xl font-semibold leading-tight md:text-4xl">
          ॐ Chinmaya Gita Samarpanam
        </h1>
        <div className="mt-6 rounded-2xl border border-[#b86b2a] bg-[#fff4df] px-4 py-3 text-center text-sm font-semibold text-[#3b1a1f]">
          Global Record-Breaking Gita Chanting Event
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          📩 Invitation & Access
        </h2>
        <div className="mt-4 space-y-2 text-sm text-[#6b4e3d]">
          <p>
            The participant will receive a Webex invitation{" "}
            <span className="font-semibold text-[#8a2f2a]">
              3 weeks prior to the May 9 event
            </span>
            .
          </p>
          <p>The invite will contain the meeting joining information.</p>
          <p>
            <span className="font-semibold text-[#8a2f2a]">
              Use the SAME meeting link
            </span>{" "}
            on all three days.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          📅 Required Participation (10:00 AM EST)
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>April 25 – Trial Meeting</li>
          <li>May 2 – Trial Meeting</li>
          <li>May 9 – Official Record-Breaking Event</li>
        </ul>
        <p className="mt-3 font-semibold text-[#8a2f2a]">
          All sessions begin at 10:00 AM EST.
        </p>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          🖥️ Before Chanting Begins
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>Join 10 minutes early.</li>
          <li>Center yourself clearly in the screen.</li>
          <li>Set your screen name correctly.</li>
          <li>Ensure your camera is ON.</li>
          <li>Sit in a well-lit location.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          🎥 During Chanting
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>Wait for the host&apos;s instructions.</li>
          <li>The host will display a background video highlighting the verse.</li>
          <li>Reduce your speaker volume.</li>
          <li>Follow the visual cue to begin chanting.</li>
          <li>Ensure lip movement is clearly visible.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          🔁 Recording Process
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>The host will record the chanting.</li>
          <li>Recording will stop after completion.</li>
          <li>
            The chanting and recording will be repeated{" "}
            <span className="font-semibold text-[#8a2f2a]">3 times</span> to
            capture the best version.
          </li>
        </ul>
      </section>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 text-center text-sm text-[#6b4e3d] sm:p-8">
        Thank you for being part of this historic global effort.
        <br />
        Your discipline and coordination make this possible.
      </div>
    </div>
  );
}
