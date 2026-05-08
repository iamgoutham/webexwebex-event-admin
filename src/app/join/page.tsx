import JoinClient from "./join-client";
import { loadFosterLinksFromPostgres } from "@/lib/findameeting-fosterlinks";

export default async function JoinPage() {
  const fosterLinks = await loadFosterLinksFromPostgres();
  const alternateLink = fosterLinks[0] ?? null;

  return <JoinClient alternateLink={alternateLink} />;
}
