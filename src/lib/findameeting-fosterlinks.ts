import { readFile } from "fs/promises";
import { join } from "path";

const FOSTER_FILE = "fosterlinks.txt";

/** One URL (or any text) per line; # starts a comment; blank lines ignored. */
export async function loadFosterLinksFromPublic(): Promise<string[]> {
  const path = join(process.cwd(), "public", FOSTER_FILE);
  const raw = await readFile(path, "utf8").catch(() => "");
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .map((l) => {
      const i = l.indexOf("#");
      return i === -1 ? l.trim() : l.slice(0, i).trim();
    })
    .filter((l) => l.length > 0);
}

/** Pick a 0..n-1 index deterministically from the normalized digit string. */
export function selectFosterIndex(digits: string, count: number): number {
  if (count <= 0) return 0;
  let h = 0;
  for (let i = 0; i < digits.length; i += 1) {
    h = (h * 33 + digits.charCodeAt(i)) >>> 0;
  }
  return h % count;
}
