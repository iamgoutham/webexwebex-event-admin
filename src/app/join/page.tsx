import JoinClient from "./join-client";
import { loadFosterLinksFromPublic } from "@/lib/findameeting-fosterlinks";

export default async function JoinPage() {
  const fosterLinks = await loadFosterLinksFromPublic();
  const alternateLink = fosterLinks[0] ?? null;

  return <JoinClient alternateLink={alternateLink} />;
}
