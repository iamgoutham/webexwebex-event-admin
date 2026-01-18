import { randomBytes } from "crypto";

const SHORT_ID_BYTES = 6;

export const generateShortId = () => randomBytes(SHORT_ID_BYTES).toString("hex");
