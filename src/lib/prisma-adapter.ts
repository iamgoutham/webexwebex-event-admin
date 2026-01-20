import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const normalizeDatabaseUrl = (url: string) => {
  if (url.startsWith("mysql://")) {
    return `mariadb://${url.slice("mysql://".length)}`;
  }
  return url;
};

export const createPrismaAdapter = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaMariaDb(normalizeDatabaseUrl(databaseUrl));
};
