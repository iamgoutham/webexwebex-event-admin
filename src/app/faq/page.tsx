import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Host FAQ – Chinmaya Gita Samarpanam",
  description:
    "Frequently asked questions for hosts of the CGS Webex sessions — setup, recording, and event logistics.",
};

const linkClass =
  "font-semibold text-[#8a2f2a] underline hover:text-[#5c2a2d]";

export default function FaqPage() {
  return (
    <div className="space-y-10 rounded-[32px] bg-[#fdf6e9] px-4 py-8 text-[#2b1f13] shadow-[0_30px_80px_rgba(58,25,15,0.15)] sm:px-6 sm:py-10 md:px-8">
      <section className="rounded-3xl border border-[#e7b474] bg-gradient-to-br from-[#f7e2b6] via-[#f3c16e] to-[#d8792d] p-6 text-[#3b1a1f] shadow-xl sm:p-8 md:p-10">
        <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
          Chinmaya Gita Samarpanam · Host Resources
        </span>
        <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-2 text-[#6b4e3d]">
          For hosts of the CGS Webex sessions — setup, recording, and event
          logistics.
        </p>
      </section>

      {/* Accessing Your Meeting */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          Accessing Your Meeting
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              When will I get my meeting link?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Final meetings will be assigned soon. Every host and participant
              will receive an email with their specific access link once
              assignments are completed.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Where can I find my assigned participants?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Log in to the{" "}
              <a
                href="https://webex-usa.chinmayavrindavan.org/dashboard/meetings"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Host Dashboard
              </a>
              . It shows your meeting link as well as the names, emails, and
              phone numbers of the participants assigned to your group.
            </div>
          </details>
        </div>
      </section>

      {/* Website & Documentation */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          Website &amp; Documentation
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Is there a website with all relevant host information?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Yes. Visit{" "}
              <a
                href="https://webex-usa.chinmayavrindavan.org"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                webex-usa.chinmayavrindavan.org
              </a>
              <br />
              or the short link:{" "}
              <a
                href="https://tinyurl.com/CgsHostPage"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                tinyurl.com/CgsHostPage
              </a>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Where can I find the technical setup guide?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Visit{" "}
              <a
                href="https://tinyurl.com/docWebexHostGuide"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                tinyurl.com/docWebexHostGuide
              </a>{" "}
              or go to the host website and look for <em>Webex Host Detailed
              Guide</em> under &quot;Helpful Links.&quot;
            </div>
          </details>
        </div>
      </section>

      {/* System & Technical Requirements */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          System &amp; Technical Requirements
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Can I use a tablet or mobile device as host?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              No. Hosts must use a laptop or desktop. Any working laptop or
              desktop is fine.
              <p className="mt-2 text-xs text-[#8a5b44]">
                Note: System capacity affects grid size. Visible participants
                may vary from 49 to 81 tiles depending on performance.
              </p>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              What two applications do I need to install?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              <strong>WebEx Desktop App</strong> and <strong>OBS Studio</strong>.
              <br />
              See the &quot;1. Introduction&quot; and &quot;2. Software
              Installation&quot; sections of the{" "}
              <a
                href="https://tinyurl.com/docWebexHostGuide"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Host Guide
              </a>
              .
              <p className="mt-2 text-xs text-[#8a5b44]">
                Note: Installation steps vary slightly between Mac and Windows.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* Webex Meeting & Layout */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          Webex Meeting &amp; Layout
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              I don&apos;t see scheduled meetings in my Webex app.
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Check Settings → Meetings and make sure the calendar is connected
              to <strong>Webex</strong>, not Google or another calendar.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Where do I find my laptop&apos;s max grid size capacity?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Refer to section &quot;3.1 WebEx Configuration&quot; in the{" "}
              <a
                href="https://tinyurl.com/docWebexHostGuide"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Host Guide
              </a>
              .
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Should the host stay in Grid mode?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Yes. Grid mode lets you capture the maximum number of participants
              in one page.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How can participants move the host/pacer video to center stage?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Ask participants to find the host video, click the{" "}
              <strong>three dots</strong> (⋯) in the top-right corner of that
              tile, and select <em>Move to Stage</em>.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How do I stop the screen from swapping between speakers?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Go to <strong>Layout → Stack Mode</strong> and disable{" "}
              <em>Active Speaker on Stage</em>.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Stack vs. Grid layout — which should I use?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Hosts</strong> must choose Grid layout.</li>
                <li><strong>Participants</strong> should choose Stack layout and
                move the Host tile to stage.</li>
              </ul>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Can participants lock their screen to see only the host?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Not on mobile devices. The active speaker/chanter will appear and
              disappear next to the host. This limitation does not apply to
              desktop participants.
            </div>
          </details>
        </div>
      </section>

      {/* Pacer Video */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          Pacer Video
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How do I download the pacer video?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Download the pacer video directly from the host portal:&nbsp;
              <a
                href="/pacervideo.mp4"
                className={linkClass}
              >
                pacervideo.mp4
              </a>
              .
              <p className="mt-2 text-xs text-[#8a5b44]">
                Save this file and configure it as your background pacer video in
                Webex as shown in the Host Guide.
              </p>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Can I pause the pacer video without restarting it?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              No, this is not possible. You cannot pause and resume from the same
              point.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How do I stop and restart the pacer video?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Use the <strong>Stop &amp; Restart</strong> button located next to
              the Mute button at the bottom of the screen.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How do we sync the start of the pacer video across all hosts?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              All hosts stop and restart the video simultaneously on cue.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              My pacer video won&apos;t start after downloading.
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Make sure:
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li>You downloaded the <strong>.mp4</strong> file</li>
                <li>It is properly selected as your virtual background</li>
                <li>Camera permissions are enabled</li>
              </ul>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              My camera keeps turning off and on. What should I do?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Possible causes: low bandwidth, system resource overload, or
              webcam driver issue.
              <br /><br />
              Try:
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li>Restarting Webex</li>
                <li>Closing other applications</li>
                <li>Reconnecting the camera</li>
              </ul>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              When the pacer window is running, the camera puts me at the center on a Mac. How do I avoid that?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              In the computer <strong>Settings → Bluetooth and Devices → Camera → AI Front Camera</strong>,
              there is a toggle for <strong>Automatic Framing</strong>. Turn it off to disable the AI
              feature that was adjusting the camera to keep you in the center.
            </div>
          </details>
        </div>
      </section>

      {/* OBS Setup & Recording */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          OBS Setup &amp; Recording
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              OBS is not capturing the Webex window.
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Refer to section &quot;3.2 OBS Studio…&quot; in the{" "}
              <a
                href="https://tinyurl.com/docWebexHostGuide"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Host Guide
              </a>
              .
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              I see a &quot;screen within screen&quot; (infinite mirror effect). Is
              this a problem?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              No, this is not an issue. To resolve the visual:
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li>Start recording</li>
                <li>Minimize OBS</li>
                <li>Keep Webex maximized</li>
              </ul>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Where is my OBS recording saved?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Two ways to find it:
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li>In OBS: <strong>Controls → Settings → Output → Recording Path</strong></li>
                <li>In OBS menu: <strong>File → Show Recordings</strong></li>
              </ul>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Should I enable &quot;Hide OBS from Capture&quot;?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              This option is only available on Mac.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How do I upload my recording?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Refer to section &quot;4.4 Upload…&quot; in the{" "}
              <a
                href="https://tinyurl.com/docWebexHostGuide"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Host Guide
              </a>
              .
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              Should Webex be started before OBS?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Order does not matter — as long as both are running before you click{" "}
              <em>Start Recording</em>.
            </div>
          </details>
        </div>
      </section>

      {/* Virtual Background & Webex Settings */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          Virtual Background &amp; Webex Settings
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How do I change my virtual background?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              In the Host Guide, search for section{" "}
              <strong>&quot;3.2 Host Self-View Setup for Chanting.&quot;</strong>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              I don&apos;t see virtual background options. Why?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              You may have joined via browser. Use the{" "}
              <strong>Webex Desktop Application</strong> — some options are not
              available in browser mode.
            </div>
          </details>
        </div>
      </section>

      {/* Group & Event Logistics */}
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a5b44]">
          Group &amp; Event Logistics
        </h2>
        <div className="mt-4 space-y-0 divide-y divide-[#e5c18e]">
          <details className="group py-3 first:pt-0">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              How do I see my participant list as a host?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Check the Participants panel in the Webex app during the meeting.
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              What is the expected output from hosts?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              <ul className="list-disc space-y-1 pl-5">
                <li>You have tested recording successfully.</li>
                <li>Your test recording has been uploaded to the portal for QA check.</li>
              </ul>
            </div>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-[#3b1a1f] hover:text-[#8a2f2a] [&::-webkit-details-marker]:hidden">
              What if I need technical help?
            </summary>
            <div className="mt-2 pl-0 text-sm text-[#6b4e3d]">
              Refer to Tech Support contacts listed at{" "}
              <a
                href="https://tinyurl.com/UsefulCgsInfo2"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                tinyurl.com/UsefulCgsInfo2
              </a>
              .<br />
              Regional tech support contacts are available.
            </div>
          </details>
        </div>
      </section>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] px-4 py-3 text-center text-xs text-[#8a5b44]">
        CGS Host FAQ · Updated Feb 2026
      </div>
    </div>
  );
}
