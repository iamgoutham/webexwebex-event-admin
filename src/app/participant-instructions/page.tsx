import type { Metadata } from "next";
import Image from "next/image";

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
          <p className="mt-3 text-sm text-[#3b1a1f]">
            <strong>Participants:</strong>{" "}
            Not sure if you are registered?{" "}
            <a
              href="/confirm-registration"
              className="text-[#8a2f2a] underline hover:text-[#5c2a2d]"
            >
              Click here to verify.
            </a>{" "}
            You will receive an email confirmation and your meeting assignment if
            one has been generated.
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
          🖥️ Pre-Session Preparation
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>Join 10 minutes early.</li>
          <li>Sit in a comfortable position.</li>
          <li>Center yourself clearly in the screen.</li>
          <li>Set your screen name correctly.</li>
          <li>Ensure your camera is ON.</li>
          <li>
            Sit in a well-lit location. Ensure light is focused on your face with
            no light source behind you. Do not sit with your back to a window —
            this will darken your face on camera.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          📷 Camera Setup
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>
            Be closer to the camera so your full face is visible, especially your
            lips.
          </li>
          <li>
            Adjust your camera so your face is not covered by the name display
            in your self-view window.
          </li>
          <li>Blur your background or set a background image.</li>
          <li className="list-none pl-0">
            <span className="text-[#8a5b44] italic">
              Organizers are preparing a recommended background image — stay
              tuned.
            </span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          Examples of Valid & Invalid Camera Setups
        </h2>
        <div className="mt-4 space-y-6">
          {[
            {
              disqualified: {
                text: "Hazy/blurry camera",
                src: "/images/disqualified-hazy-camera.png",
              },
              qualified: {
                text: "Clear, close-up face",
                src: "/images/qualified-participant-good-setup-1.png",
              },
            },
            {
              disqualified: {
                text: "Bad background / camera tracking issue",
                src: "/images/disqualified-bad-background-camera-tracking-issue.png",
              },
              qualified: {
                text: "Blurred or virtual background",
                src: "/images/qualified-participant-good-setup-2.png",
              },
            },
            {
              disqualified: {
                text: "Display name covering face",
                src: "/images/disqualified-display-name-blocking-face.png",
              },
              qualified: {
                text: "Name display not obscuring face",
                src: "/images/qualified-participant-good-setup-3.png",
              },
            },
            {
              disqualified: {
                text: "Face too far / too small",
                src: "/images/disqualified-face-quite-far-and-small.png",
              },
              qualified: {
                text: "Face fills most of the frame",
                src: "/images/qualified-participant-good-setup-4.png",
              },
            },
            {
              disqualified: {
                text: "Namaskar/hands covering mouth",
                src: "/images/disqualified-namaskar-blocking-mouth.png",
              },
              qualified: {
                text: "Hands visible but not blocking mouth",
                src: "/images/qualified-participant-good-setup-1.png",
              },
            },
            {
              disqualified: {
                text: "Face turned away from camera",
                src: "/images/disqualified-face-away-from-camera.png",
              },
              qualified: {
                text: "Face directly toward camera",
                src: "/images/qualified-participant-good-setup-2.png",
              },
            },
            {
              disqualified: {
                text: "Half dark face (backlit)",
                src: "/images/disqualified-half-dark-face.png",
              },
              qualified: {
                text: "Well-lit face",
                src: "/images/qualified-participant-good-setup-3.png",
              },
            },
          ].map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2"
            >
              <div className="flex flex-col gap-2 rounded-xl border-2 border-red-300 bg-red-50/80 p-3 text-red-800">
                <span className="font-semibold">❌ Disqualified</span>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#fff4df]">
                  <Image
                    src={row.disqualified.src}
                    alt={row.disqualified.text}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <p className="text-[#6b4e3d]">{row.disqualified.text}</p>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border-2 border-green-600/40 bg-green-50/80 p-3 text-green-800">
                <span className="font-semibold">✅ Qualified</span>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#fff4df]">
                  <Image
                    src={row.qualified.src}
                    alt={row.qualified.text}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <p className="text-[#6b4e3d]">{row.qualified.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold text-[#3b1a1f]">
          🎥 During Chanting
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>
            Move the host to the Webex Stage view so you can clearly see the
            lyrics displayed in the host&apos;s background.
            <figure className="mt-3 max-w-md">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-[#e5c18e] bg-[#fff9ef]">
                <Image
                  src="/images/host-self-view-chanting-background-setup.png"
                  alt="Host self-view example with chanting background setup"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 28rem"
                />
              </div>
              <figcaption className="mt-1 text-xs text-[#8a5b44]">
                Example: host on Stage with lyrics in background
              </figcaption>
            </figure>
          </li>
          <li>Wait for the host&apos;s instructions.</li>
          <li>The host will display a background video highlighting the verse.</li>
          <li>
            Unmute your mic and lower your machine&apos;s speaker volume to 5.
          </li>
          <li>Follow the visual cue to begin chanting.</li>
          <li>Ensure lip movement is clearly visible.</li>
          <li>
            Joining hands (Namaskar pose) is allowed, as long as your hands do
            not cover your mouth — lip movement must be clearly visible for
            verification.
          </li>
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
