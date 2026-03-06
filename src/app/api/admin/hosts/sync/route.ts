import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiAuth } from "@/lib/api-guards";
import { syncHosts } from "@/lib/notifications/host-sync";

// ---------------------------------------------------------------------------
// POST /api/admin/hosts/sync — Sync hosts from Google Sheets
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

  let tenantId: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    tenantId = (body as { tenantId?: string }).tenantId ?? null;
  } catch {}

  console.log(
    `[host-sync] Initiated by ${session.user.email} — tenantId: ${tenantId ?? "ALL"}`,
  );

  const result = await syncHosts(tenantId);

  console.log(
    `[host-sync] Complete — created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}, errors: ${result.errors.length}`,
  );

  return NextResponse.json({
    message: "Host sync complete",
    result,
  });
}
