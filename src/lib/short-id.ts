import { randomBytes } from "crypto";

const SHORT_ID_BYTES = 6;

export const generateShortId = () => randomBytes(SHORT_ID_BYTES).toString("hex");

export const generateShortIdFromEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};
