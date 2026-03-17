/**
 * Postgres (downstream) Prisma client.
 * Only connected when POSTGRES_URL is set; otherwise getPostgresPrisma() returns null.
 * Generate client: pnpm run db:generate:postgres (or npx prisma generate --config=prisma.postgres.config.ts)
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PostgresPrismaClient } from "@/generated/postgres-client";

const globalForPostgres = globalThis as {
  postgresPrisma?: PostgresPrismaClient;
};

function createPostgresPrisma(): PostgresPrismaClient | null {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;

  if (globalForPostgres.postgresPrisma) {
    return globalForPostgres.postgresPrisma;
  }

  const pool = new Pool({ connectionString: url });
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
