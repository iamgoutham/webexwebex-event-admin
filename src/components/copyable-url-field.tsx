"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  /** In-app route or external URL */
  href: string;
  /** Full URL copied to clipboard and shown as link text */
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

const iconBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#8a5b44] transition hover:bg-[#f5ead8]/90 hover:text-[#8a2f2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8792d]/40";

const linkClass =
  "break-all font-mono text-[11px] leading-relaxed text-[#3b1a1f] underline decoration-[#d4b896] underline-offset-[3px] hover:text-[#8a2f2a] hover:decoration-[#8a2f2a]/70";

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

  const link =
    external ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {trimmed}
      </a>
    ) : (
      <Link href={href} className={linkClass}>
        {trimmed}
      </Link>
    );

  return (
    <div className="mt-2 flex w-full min-w-0 max-w-full items-start gap-2 sm:items-center">
      <div className="min-w-0 flex-1 pt-0.5">{link}</div>
      <button
        type="button"
        onClick={() => void copy()}
        className={iconBtn}
        title={copied ? "Copied" : "Copy URL"}
        aria-label={copied ? "Copied to clipboard" : "Copy link"}
      >
        {copied ? (
          <IconCheck className="h-4 w-4 text-[#2f6f4a]" />
        ) : (
          <IconCopy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
