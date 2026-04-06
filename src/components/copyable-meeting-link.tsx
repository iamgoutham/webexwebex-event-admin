"use client";

import { useState } from "react";

export default function CopyableMeetingLink({ url }: { url: string }) {
  const trimmed = url.trim();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!trimmed) return null;

  return (
    <div className="mt-3 w-full min-w-0">
      <p className="text-xs font-medium text-[#8a5b44]">Meeting link</p>
      <div className="mt-1 flex flex-wrap items-stretch gap-2">
        <input
          readOnly
          value={trimmed}
          onFocus={(e) => e.target.select()}
          aria-label="Meeting link (select to copy)"
          className="min-w-0 flex-1 rounded-lg border border-[#e5c18e] bg-white px-3 py-2 font-mono text-[11px] leading-snug text-[#3b1a1f] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-[#7a3b2a]/50 bg-[#fff9ef] px-3 py-2 text-xs font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
