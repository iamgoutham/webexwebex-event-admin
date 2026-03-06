import { NextRequest, NextResponse } from "next/server";
import { DeliveryChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, jsonError } from "@/lib/api-guards";

// ---------------------------------------------------------------------------
// GET /api/notifications/preferences — Get current user's notification prefs
// ---------------------------------------------------------------------------

export async function GET() {
  const { session, response } = await requireApiAuth();
  if (response) return response;
  if (!session) return jsonError("Unauthorized", 401);

  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
    select: {
      channel: true,
      enabled: true,
    },
  });

  // Build a map with defaults (all enabled)
  const allChannels = Object.values(DeliveryChannel);
  const prefMap: Record<string, boolean> = {};
  for (const ch of allChannels) {
    prefMap[ch] = true; // default enabled
  }
  for (const p of preferences) {
    prefMap[p.channel] = p.enabled;
  }

  return NextResponse.json({ preferences: prefMap });
}

// ---------------------------------------------------------------------------
// PUT /api/notifications/preferences — Update notification preferences
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const { session, response } = await requireApiAuth();
  if (response) return response;
  if (!session) return jsonError("Unauthorized", 401);

  let body: { preferences: Record<string, boolean> };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const validChannels = new Set(Object.values(DeliveryChannel));
  const updates: Array<{ channel: DeliveryChannel; enabled: boolean }> = [];

  for (const [channel, enabled] of Object.entries(body.preferences ?? {})) {
    if (validChannels.has(channel as DeliveryChannel)) {
      updates.push({
        channel: channel as DeliveryChannel,
        enabled: Boolean(enabled),
      });
    }
  }

  // Upsert each preference
  for (const update of updates) {
    const existing = await prisma.notificationPreference.findFirst({
      where: { userId: session.user.id, channel: update.channel },
    });

    if (existing) {
      await prisma.notificationPreference.update({
        where: { id: existing.id },
        data: { enabled: update.enabled },
      });
    } else {
      await prisma.notificationPreference.create({
        data: {
          userId: session.user.id,
          channel: update.channel,
          enabled: update.enabled,
        },
      });
    }
  }

  return NextResponse.json({ message: "Preferences updated", updates });
}
