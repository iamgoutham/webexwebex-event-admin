import { unstable_noStore as noStore } from "next/cache";
import { readFile } from "fs/promises";
import path from "path";

const DEFAULT_RELATIVE_FILE = path.join(
  "public",
  "landing-registration-banner.txt",
);

/**
 * Resolves landing banner copy without a rebuild:
 * 1. `LANDING_REGISTRATION_BANNER` — non-empty env string (wins over file).
 * 2. `LANDING_REGISTRATION_BANNER_FILE` — path to a UTF-8 text file (absolute or relative to cwd).
 * 3. `public/landing-registration-banner.txt` — edit this file on the server and refresh.
 *
 * Empty / missing content hides the banner. Uses `noStore()` so file edits show up on refresh.
 */
export async function getLandingRegistrationBannerMessage(): Promise<
  string | null
> {
  noStore();

  const envMsg = process.env.LANDING_REGISTRATION_BANNER?.trim();
  if (envMsg) {
    return envMsg;
  }

  const custom = process.env.LANDING_REGISTRATION_BANNER_FILE?.trim();
  const candidates: string[] = [];
  if (custom) {
    candidates.push(
      path.isAbsolute(custom)
        ? custom
        : path.join(process.cwd(), custom),
    );
  }
  candidates.push(path.join(process.cwd(), DEFAULT_RELATIVE_FILE));

  for (const filePath of candidates) {
    try {
      const text = (await readFile(filePath, "utf-8")).trim();
      if (text) {
        return text;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}
