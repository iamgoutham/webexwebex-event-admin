import { PrismaClient } from "@prisma/client";
import { createPrismaAdapter } from "@/lib/prisma-adapter";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
  prismaAdapter?: ReturnType<typeof createPrismaAdapter>;
};

const prismaAdapter =
  globalForPrisma.prismaAdapter ?? createPrismaAdapter();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: prismaAdapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaAdapter = prismaAdapter;
}
