import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPostgresPrisma } from "@/lib/prisma-postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: {
    app: "ok";
    mysql: "up" | "down";
    postgres: "up" | "down" | "disabled";
  } = {
    app: "ok",
    mysql: "down",
    postgres: "disabled",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.mysql = "up";
  } catch {
    checks.mysql = "down";
  }

  const postgres = getPostgresPrisma();
  if (postgres) {
    try {
      await postgres.$queryRawUnsafe("SELECT 1");
      checks.postgres = "up";
    } catch {
      checks.postgres = "down";
    }
  }

  const healthy = checks.mysql === "up";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}

