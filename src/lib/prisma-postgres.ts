/**
 * Postgres (downstream) Prisma client.
 * Only connected when POSTGRES_URL is set; otherwise getPostgresPrisma() returns null.
 * Generate client: pnpm run db:generate:postgres (or npx prisma generate --schema=prisma/schema-postgres.prisma)
 */

import { PrismaClient as PostgresPrismaClient } from "@/generated/postgres-client";

const globalForPostgres = globalThis as { postgresPrisma?: PostgresPrismaClient };

function createPostgresPrisma(): PostgresPrismaClient | null {
  if (!process.env.POSTGRES_URL) return null;
  const client =
    globalForPostgres.postgresPrisma ??
    new PostgresPrismaClient({
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
