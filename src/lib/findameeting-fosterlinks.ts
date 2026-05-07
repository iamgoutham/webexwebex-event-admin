import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const FOSTER_FILE = "fosterlinks.txt";
const RR_COUNTER_FILE = join(
  process.cwd(),
  "data",
  "findameeting-foster-rr.txt",
);

/** Serialize round-robin file updates within this Node process. */
let rrMutex: Promise<void> = Promise.resolve();

async function withRoundRobinLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = rrMutex;
  let release!: () => void;
  rrMutex = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

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

/**
 * Next foster link index 0..linkCount-1 in global round-robin order.
 * Persists a monotonic counter in `data/findameeting-foster-rr.txt` (gitignored).
 * Multiple app instances each keep their own counter unless they share that file.
 */
export async function takeNextFosterRoundRobinIndex(
  linkCount: number,
): Promise<number> {
  if (linkCount <= 0) return 0;
  return withRoundRobinLock(async () => {
    try {
      await mkdir(join(process.cwd(), "data"), { recursive: true });
      let counter = 0;
      try {
        const raw = await readFile(RR_COUNTER_FILE, "utf8");
        const n = Number.parseInt(raw.trim(), 10);
        if (Number.isFinite(n) && n >= 0) counter = n;
      } catch {
        /* first run or missing file */
      }
      const index = counter % linkCount;
      await writeFile(RR_COUNTER_FILE, `${counter + 1}\n`, "utf8");
      return index;
    } catch {
      return Math.abs(Date.now() % linkCount);
    }
  });
}
