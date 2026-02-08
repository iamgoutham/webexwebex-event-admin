"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetDate: Date;
  label?: string;
  sublabel?: string;
  className?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function CountdownTimer({
  targetDate,
  label = "Event in",
  sublabel,
  className = "",
}: CountdownTimerProps) {
  const [diff, setDiff] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  } | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const ms = targetDate.getTime() - now.getTime();
      if (ms <= 0) {
        setDiff({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }
      const totalSeconds = Math.floor(ms / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setDiff({ days, hours, minutes, seconds, isPast: false });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (diff === null) return null;

  if (diff.isPast) {
    return (
      <div
        className={`rounded-2xl border border-[#b86b2a]/60 bg-white/30 p-4 text-center shadow-inner sm:p-6 ${className}`}
      >
        <p className="text-sm font-semibold text-[#8a2f2a]">{label}</p>
        {sublabel && (
          <p className="mt-1 text-xs text-[#6b4e3d]">{sublabel}</p>
        )}
        <p className="mt-3 text-lg font-bold text-[#3b1a1f]">
          Event has started
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[#b86b2a]/60 bg-white/30 p-4 text-center shadow-inner sm:p-6 ${className}`}
    >
      <p className="text-sm font-semibold text-[#8a2f2a]">{label}</p>
      {sublabel && (
        <p className="mt-1 text-xs text-[#6b4e3d]">{sublabel}</p>
      )}
      <div className="mt-4 flex justify-center gap-2 sm:gap-3">
        <div className="flex flex-col rounded-lg bg-[#3b1a1f]/10 px-2 py-2 sm:px-3 sm:py-3">
          <span className="text-xl font-bold tabular-nums text-[#3b1a1f] sm:text-2xl">
            {pad(diff.days)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#6b4e3d] sm:text-xs">
            Days
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-[#3b1a1f]/10 px-2 py-2 sm:px-3 sm:py-3">
          <span className="text-xl font-bold tabular-nums text-[#3b1a1f] sm:text-2xl">
            {pad(diff.hours)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#6b4e3d] sm:text-xs">
            Hrs
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-[#3b1a1f]/10 px-2 py-2 sm:px-3 sm:py-3">
          <span className="text-xl font-bold tabular-nums text-[#3b1a1f] sm:text-2xl">
            {pad(diff.minutes)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#6b4e3d] sm:text-xs">
            Min
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-[#3b1a1f]/10 px-2 py-2 sm:px-3 sm:py-3">
          <span className="text-xl font-bold tabular-nums text-[#3b1a1f] sm:text-2xl">
            {pad(diff.seconds)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#6b4e3d] sm:text-xs">
            Sec
          </span>
        </div>
      </div>
    </div>
  );
}
