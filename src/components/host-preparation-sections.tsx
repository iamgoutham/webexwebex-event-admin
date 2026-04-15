/**
 * Host software setup, prep, and support (dashboard + landing if needed).
 */
export default function HostPreparationSections() {
  return (
    <>
      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
          Software Setup
        </span>
        <h2 className="mt-4 text-xl font-semibold">Prepare Your Tools</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              System Requirements
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Stable internet connection.</li>
              <li>Working microphone and camera.</li>
              <li>Laptop or Desktop computer. 21&quot; monitor recommended</li>
              <li>21&quot; monitor recommended</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              Install Webex Desktop App
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Download and install the Webex desktop app.</li>
              <li>Sign in with your host credentials.</li>
              <li>Set your meeting layout to the max value supported</li>
              <li>Verify audio and video settings.</li>
              <li>Add the pacer video as background.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              Install OBS Software
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Install OBS Studio on your system.</li>
              <li>Setup your capture,browser,text sources</li>
              <li>Set the output directory for recordings.</li>
              <li>Test recording before the event.</li>
              <li>Visually check the video to ensure guinness requirements.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
          Before You Log In
        </span>
        <h2 className="mt-4 text-xl font-semibold">
          Host Preparation - 10 Minutes
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              1. Review Essentials
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Understand your role as a Webex Host.</li>
              <li>Know when to start and stop recording.</li>
              <li>Review meeting flow for chanting.</li>
              <li>
                Hosts can access their meeting links directly via the Webex App
                once assigned, or through the online dashboard.
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              2. System Check
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Test microphone and camera.</li>
              <li>Use a headset if possible.</li>
              <li>Confirm stable internet connection.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#8a2f2a]">
              3. Dry Run
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
              <li>Start a test Webex meeting.</li>
              <li>Practice mute and unmute controls.</li>
              <li>Practice starting a recording.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8">
        <h2 className="text-xl font-semibold">Support</h2>
        <p className="mt-3 text-sm text-[#6b4e3d]">
          For technical support on WhatsApp or call:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#6b4e3d]">
          <li>Goutham Puppala: +1 908 625 6672</li>
          <li>Pramod Gadilkar: +1 732 318 5560</li>
          <li>Darshan Shah: +1 678 428 4718</li>
          <li>Madhu Sringeri: +1 669 254 8653</li>
          <li>Arun Ravisankar: +1 267 432 2292</li>
          <li>Keshav Iyer: +1 908 625 5846</li>
          <li>Venugopal Nagarajan: +1 508 340 2383</li>
        </ul>
      </section>
    </>
  );
}
