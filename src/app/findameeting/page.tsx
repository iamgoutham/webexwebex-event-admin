import Link from "next/link";
import HelpJoinLookup from "@/components/help-join-lookup";
import { loadFosterLinksFromPostgres } from "@/lib/findameeting-fosterlinks";

export default async function FindameetingPage() {
  const fosterLinks = await loadFosterLinksFromPostgres();
  const alternateLink = fosterLinks[0] ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-[#3b1a1f]">
      <p>
        <Link
          href="/"
          className="text-sm font-medium text-[#8a2f2a] underline hover:text-[#5c2a2d]"
        >
          ← Back to home
        </Link>
      </p>
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Find your meeting</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Enter your WhatsApp number to find your assigned meeting link.
        </p>
      </div>
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 shadow-sm">
        <HelpJoinLookup alternateLink={alternateLink} />
      </div>
    </div>
  );
}
