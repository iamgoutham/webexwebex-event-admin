"use client";

import { useState } from "react";
import EventDayHostChecklistSection from "@/components/event-day-host-checklist-section";

const shell = {
  instructions:
    "rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
  dashboard:
    "rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8",
} as const;

type Variant = keyof typeof shell;

export default function EventDayHostChecklistTabs({
  variant = "instructions",
}: {
  variant?: Variant;
}) {
  const [tab, setTab] = useState<"mobile" | "youtube" | "virtual">("youtube");

  const tabBtn =
    "rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm";
  const tabInactive =
    "border-[#c58d5d]/50 bg-[#fff9ef] text-[#7a3b2a] hover:border-[#7a3b2a]/40";
  const tabActive =
    "border-[#7a3b2a] bg-[#f7e2b6] text-[#3b1a1f]";

  return (
    <section className={shell[variant]}>
      <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
        Event day
      </span>

      <div
        className="mt-4 flex flex-wrap gap-2 border-b border-[#e5c18e]/60 pb-4"
        role="tablist"
        aria-label="Host checklist type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "youtube"}
          id="event-day-tab-youtube"
          aria-controls="event-day-panel-youtube"
          className={`${tabBtn} ${tab === "youtube" ? tabActive : tabInactive}`}
          onClick={() => setTab("youtube")}
        >
          Pacer from Youtube Live
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "virtual"}
          id="event-day-tab-virtual"
          aria-controls="event-day-panel-virtual"
          className={`${tabBtn} ${tab === "virtual" ? tabActive : tabInactive}`}
          onClick={() => setTab("virtual")}
        >
          Pacer from Virtual Background
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mobile"}
          id="event-day-tab-mobile"
          aria-controls="event-day-panel-mobile"
          className={`${tabBtn} ${tab === "mobile" ? tabActive : tabInactive}`}
          onClick={() => setTab("mobile")}
        >
          Pacer from mobile device
        </button>
      </div>

      <div
        id="event-day-panel-mobile"
        role="tabpanel"
        aria-labelledby="event-day-tab-mobile"
        hidden={tab !== "mobile"}
      >
        <EventDayHostChecklistSection
          variant={variant}
          mode="mobile"
          embeddedTabPanel
        />
      </div>

      <div
        id="event-day-panel-virtual"
        role="tabpanel"
        aria-labelledby="event-day-tab-virtual"
        hidden={tab !== "virtual"}
      >
        <EventDayHostChecklistSection
          variant={variant}
          mode="virtual"
          showSharedIntro={false}
          embeddedTabPanel
        />
      </div>

      <div
        id="event-day-panel-youtube"
        role="tabpanel"
        aria-labelledby="event-day-tab-youtube"
        hidden={tab !== "youtube"}
      >
        <EventDayHostChecklistSection
          variant={variant}
          mode="youtube"
          embeddedTabPanel
        />
      </div>
    </section>
  );
}
