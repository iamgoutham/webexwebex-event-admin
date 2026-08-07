"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatUtcGmt(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

type TimeResponse = { unixMs: number };

export default function GmtClock() {
  const [gmtTime, setGmtTime] = useState<string>("--:--:--");
  const skewMsRef = useRef(0);
  const skewReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let tickId: ReturnType<typeof setInterval> | undefined;

    const applySkewFromSample = (serverUnixMs: number, clientMid: number) => {
      skewMsRef.current = serverUnixMs - clientMid;
      skewReadyRef.current = true;
    };

    const startTicking = () => {
      tickId = setInterval(() => {
        if (!skewReadyRef.current) return;
        setGmtTime(formatUtcGmt(Date.now() + skewMsRef.current));
      }, 1000);
    };

    const sync = async (): Promise<boolean> => {
      const t1 = Date.now();
      let res: Response;
      try {
        res = await fetch("/api/public/time", { cache: "no-store" });
      } catch {
        if (!cancelled) {
          skewReadyRef.current = false;
          setGmtTime("--:--:--");
        }
        return false;
      }
      const t2 = Date.now();
      if (!res.ok || cancelled) return false;
      let body: TimeResponse;
      try {
        body = (await res.json()) as TimeResponse;
      } catch {
        if (!cancelled) {
          skewReadyRef.current = false;
          setGmtTime("--:--:--");
        }
        return false;
      }
      if (typeof body.unixMs !== "number" || Number.isNaN(body.unixMs) || cancelled) {
        return false;
      }
      const clientMid = (t1 + t2) / 2;
      applySkewFromSample(body.unixMs, clientMid);
      setGmtTime(formatUtcGmt(Date.now() + skewMsRef.current));
      return true;
    };

    void sync().then((ok) => {
      if (!cancelled && ok) startTicking();
    });

    return () => {
      cancelled = true;
      if (tickId !== undefined) clearInterval(tickId);
    };
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
