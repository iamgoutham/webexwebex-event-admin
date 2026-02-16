import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiAuth } from "@/lib/api-guards";
import { syncParticipants } from "@/lib/notifications/participant-sync";

// ---------------------------------------------------------------------------
// POST /api/admin/participants/sync — Sync participants from Webex via FastAPI
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: filter by tenant
  let tenantId: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    tenantId = (body as { tenantId?: string }).tenantId ?? null;
  } catch {
    // No body — sync all tenants
  }

  console.log(
    `[participant-sync] Initiated by ${session.user.email} — tenantId: ${tenantId ?? "ALL"}`,
  );

  const result = await syncParticipants(tenantId);

  console.log(
    `[participant-sync] Complete — created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}, errors: ${result.errors.length}`,
  );

  return NextResponse.json({
    message: "Participant sync complete",
    result,
  });
}
