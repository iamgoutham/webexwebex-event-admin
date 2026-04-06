import GmtClock from "@/components/gmt-clock";

export const dynamic = "force-static";

export const metadata = {
  title: "GMT TIME",
  description: "Live GMT time",
};

export default function GmtClockPage() {
  return <GmtClock />;
}
