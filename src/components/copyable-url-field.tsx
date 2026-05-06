"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  /** In-app route or external URL for “Open” */
  href: string;
  /** Full URL copied to clipboard and shown in the field */
  copyText: string;
  /** Use `<a target="_blank">` instead of Next `Link` */
  external?: boolean;
};

function IconCopy({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconOpen({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#6b4e3d] transition hover:bg-[#fff4df] hover:text-[#8a2f2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d8792d]";

export default function CopyableUrlField({
  href,
  copyText,
  external = false,
}: Props) {
  const trimmed = copyText.trim();
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

  const openClass = `${iconBtn} bg-[#fdfaf3]`;

  const openControl = external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={openClass}
      title="Open in new tab"
      aria-label="Open in new tab"
    >
      <IconOpen className="h-4 w-4" />
    </a>
  ) : (
    <Link
      href={href}
      className={openClass}
      title="Open page"
      aria-label="Open page"
    >
      <IconOpen className="h-4 w-4" />
    </Link>
  );

  return (
    <div className="mt-2 w-full min-w-0 max-w-full">
      <div className="flex min-h-[2.25rem] items-stretch overflow-hidden rounded-lg border border-[#e5c18e] bg-white shadow-sm">
        <input
          readOnly
          value={trimmed}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.currentTarget.select()}
          aria-label="URL (select or use copy button)"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 font-mono text-[11px] leading-snug text-[#3b1a1f] outline-none focus:ring-0"
        />
        <div className="flex shrink-0 items-stretch divide-x divide-[#e5c18e] border-l border-[#e5c18e] bg-[#fdfaf3]">
          <button
            type="button"
            onClick={() => void copy()}
            className={`${iconBtn} bg-[#fdfaf3]`}
            aria-label={copied ? "Copied to clipboard" : "Copy link"}
          >
            {copied ? (
              <IconCheck className="h-4 w-4 text-[#2f6f4a]" />
            ) : (
              <IconCopy className="h-4 w-4" />
            )}
          </button>
          {openControl}
        </div>
      </div>
    </div>
  );
}
