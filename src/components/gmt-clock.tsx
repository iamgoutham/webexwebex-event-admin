"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function GmtClock() {
  const [gmtTime, setGmtTime] = useState<string>("--:--:--");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setGmtTime(
        `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col bg-[#1a1a1a]">
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/90">
          GMT TIME
        </p>
        <p
          className="mt-3 font-mono text-6xl font-bold tabular-nums tracking-wide text-white sm:text-7xl md:text-8xl"
          aria-live="polite"
        >
          {gmtTime}
        </p>
        <p className="mt-12 text-xs font-medium uppercase tracking-[0.25em] text-white/90">
          COUNTDOWN
        </p>
        <p className="mt-3 font-mono text-4xl font-medium tabular-nums tracking-wide text-white/80 sm:text-5xl">
          ---- : ----
        </p>
      </div>

      <div className="absolute left-4 top-4">
        <Link
          href="/"
          className="text-sm text-white/70 underline-offset-2 hover:text-white hover:underline"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
