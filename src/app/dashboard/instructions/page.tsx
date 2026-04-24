import Image from "next/image";
import { requireAuth } from "@/lib/guards";
import EventDayHostChecklistSection, {
  EventDaySharedIntroCard,
} from "@/components/event-day-host-checklist-section";

export default async function InstructionsPage() {
  await requireAuth();

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Chanting day Instructions</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Review the host protocol, chanting flow, and on-screen guidelines
          before you begin the session.
        </p>
      </div>

      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[#e5c18e] bg-[#fff9ef]">
          <Image
            src="/hostprotocol1.png?v=202603312"
            alt="Host protocol"
            fill
            unoptimized
            sizes="(min-width: 1024px) 960px, 100vw"
            className="object-cover"
          />
        </div>
      </div>

      <EventDaySharedIntroCard />

      <EventDayHostChecklistSection mode="mobile" />

      <EventDayHostChecklistSection mode="virtual" showSharedIntro={false} />
    </div>
  );
}
