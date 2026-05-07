import {
  loadFosterLinksFromPublic,
  takeNextFosterRoundRobinIndex,
} from "@/lib/findameeting-fosterlinks";
import { logFindameetingRequest } from "@/lib/findameeting-log";

export type FindameetingExecuteResult =
  | { success: true; link: string }
  | {
      success: false;
      status: number;
      error: string;
      hint?: string;
    };

/**
 * Find-a-meeting: require a non-empty phone (not format-checked or looked up in maps),
 * log it, then serve a round-robin foster link from `public/fosterlinks.txt`.
 * Used by the public API and the on-site server action (no token in the browser).
 */
export async function executeFindameetingLookup(
  phoneEntered: string,
): Promise<FindameetingExecuteResult> {
  const phone = phoneEntered.replace(/\r|\n|\t/g, " ").trim();
  if (!phone) {
    await logFindameetingRequest({
      phoneEntered: "",
      outcome: "missing_phone",
    });
    return {
      success: false,
      status: 400,
      error: "Enter your WhatsApp phone number.",
    };
  }

  const fosterLinks = await loadFosterLinksFromPublic();
  if (fosterLinks.length === 0) {
    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "no_foster_links",
      note: `phone=${phone}`,
    });
    return {
      success: false,
      status: 500,
      error:
        "Meeting links are not configured. Add lines to public/fosterlinks.txt.",
    };
  }

  const index = await takeNextFosterRoundRobinIndex(fosterLinks.length);
  const link = fosterLinks[index]!;
  await logFindameetingRequest({
    phoneEntered: phone,
    outcome: "success",
    note: `foster_index=${index}; phone=${phone}`,
  });
  return { success: true, link };
}
