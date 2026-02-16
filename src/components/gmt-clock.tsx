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
      <div className="flex flex-1 flex-row flex-nowrap items-center justify-center gap-3 px-4 sm:gap-4">
        <span className="whitespace-nowrap text-base font-medium text-white sm:text-4xl md:text-5xl lg:text-6xl">
          Chinmaya Gita Samarpanam- A Guinness World record attempt
        </span>
        <span
          className="shrink-0 font-mono text-base font-bold tabular-nums tracking-wide text-white sm:text-4xl md:text-5xl lg:text-6xl"
          aria-live="polite"
        >
          {gmtTime}
        </span>
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
