import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, jsonError } from "@/lib/api-guards";

// ---------------------------------------------------------------------------
// GET /api/notifications — List notifications for current user
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { session, response } = await requireApiAuth();
  if (response) return response;
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);

  if (searchParams.get("countOnly") === "true") {
    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    });
    return NextResponse.json({ unreadCount });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const unreadOnly = searchParams.get("unread") === "true";

  const where = {
    userId: session.user.id,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        body: true,
        actionUrl: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ]);

  return NextResponse.json({
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications — Mark notifications as read
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireApiAuth();
  if (response) return response;
  if (!session) return jsonError("Unauthorized", 401);

  let body: { ids?: string[]; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (body.markAllRead) {
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ marked: result.count });
  }

  if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: body.ids },
        userId: session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ marked: result.count });
  }

  return jsonError("Provide ids[] or markAllRead: true", 400);
}
