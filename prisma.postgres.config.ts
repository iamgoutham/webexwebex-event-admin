import { defineConfig, env } from "prisma/config";

// Postgres (downstream) Prisma config.
// Uses prisma/schema-postgres.prisma and POSTGRES_URL for the datasource URL.
export default defineConfig({
  schema: "prisma/schema-postgres.prisma",
  datasource: {
    url: env("POSTGRES_URL"),
  },
  // No migrations configured here yet; when you are ready to manage
  // Postgres schema with Prisma Migrate, you can add a `migrations.path`.
});


