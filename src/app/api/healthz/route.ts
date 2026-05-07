import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ELB-safe liveness probe.
 * Returns 200 when the Next.js server can respond (no DB/network dependencies).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "webex-event-admin",
    },
    { status: 200 },
  );
}

