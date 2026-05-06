import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#e5c18e] bg-[#fdf6e9] text-[#6b4e3d]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href="/help"
            className="font-semibold text-[#8a2f2a] underline hover:text-[#5c2a2d]"
          >
            CGS SELF-HELPDESK
          </Link>
          <span className="hidden text-[#c4a574] sm:inline" aria-hidden>
            ·
          </span>
          <Link href="/faq" className="hover:text-[#3b1a1f]">
            Host FAQ
          </Link>
          <Link href="/participant-instructions" className="hover:text-[#3b1a1f]">
            Participant instructions
          </Link>
        </nav>
        <p className="text-xs text-[#8a5b44]">
          Chinmaya Gita Samarpanam · participant quick links and support
        </p>
      </div>
    </footer>
  );
}
