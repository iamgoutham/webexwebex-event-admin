"use client";

import { useState, type ReactNode } from "react";

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

type Props = {
  href: string;
  /** String written to the clipboard (defaults to `href`) */
  copyText?: string;
  children: ReactNode;
};

export default function InlineExternalLinkWithCopy({
  href,
  copyText,
  children,
}: Props) {
  const toCopy = (copyText ?? href).trim();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-0.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[#8a2f2a] underline decoration-[#8a2f2a]/50 underline-offset-2 hover:text-[#5c2a2d]"
      >
        {children}
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="relative top-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#6b4e3d] transition hover:bg-[#f7e2b6]/60 hover:text-[#8a2f2a] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#d8792d] focus-visible:ring-offset-0"
        aria-label={copied ? "Copied to clipboard" : "Copy link to clipboard"}
      >
        {copied ? (
          <IconCheck className="h-3.5 w-3.5 text-[#2f6f4a]" />
        ) : (
          <IconCopy className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}
