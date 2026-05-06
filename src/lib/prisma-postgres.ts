/**
 * Postgres (downstream) Prisma client.
 * Only connected when POSTGRES_URL is set; otherwise getPostgresPrisma() returns null.
 * Generate client: pnpm run db:generate:postgres (or npx prisma generate --config=prisma.postgres.config.ts)
 *
 * TLS: if you see `self-signed certificate in certificate chain`, either point
 * `POSTGRES_SSL_CA_PATH` at the RDS/proxy CA bundle, or set `POSTGRES_TLS_INSECURE=1`
 * (dev only — disables certificate verification for the Pool).
 */

import fs from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PostgresPrismaClient } from "@/generated/postgres-client";

const globalForPostgres = globalThis as {
  postgresPrisma?: PostgresPrismaClient;
};

function buildPostgresPoolSsl():
  | { rejectUnauthorized: boolean; ca?: string }
  | undefined {
  const caPath = process.env.POSTGRES_SSL_CA_PATH?.trim();
  if (caPath) {
    try {
      const ca = fs.readFileSync(caPath, "utf8");
      return { rejectUnauthorized: true, ca };
    } catch (e) {
      console.error(
        "[postgres] POSTGRES_SSL_CA_PATH could not be read:",
        caPath,
        e,
      );
    }
  }

  const insecure =
    process.env.POSTGRES_TLS_INSECURE === "1" ||
    process.env.POSTGRES_TLS_INSECURE?.toLowerCase() === "true";
  const rejectUnauthorizedEnv =
    process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED?.toLowerCase();
  const relaxReject =
    insecure ||
    rejectUnauthorizedEnv === "0" ||
    rejectUnauthorizedEnv === "false";

  if (relaxReject) {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

function createPostgresPrisma(): PostgresPrismaClient | null {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;

  if (globalForPostgres.postgresPrisma) {
    return globalForPostgres.postgresPrisma;
  }

  const ssl = buildPostgresPoolSsl();
  const pool = new Pool(
    ssl ? { connectionString: url, ssl } : { connectionString: url },
  );
  const adapter = new PrismaPg(pool);

  const client = new PostgresPrismaClient({
    adapter,
    log: ["error", "warn"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPostgres.postgresPrisma = client;
  }

  return client;
}

export function getPostgresPrisma(): PostgresPrismaClient | null {
  return createPostgresPrisma();
}
