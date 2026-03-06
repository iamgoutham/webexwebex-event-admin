import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import NotificationList from "@/components/notifications/notification-list";

export default async function NotificationsPage() {
  const session = await requireAuth();

  // Fetch initial notifications server-side
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      take: 20,
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
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ]);

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          {unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}.`
            : "You're all caught up!"}
        </p>
      </div>

      <NotificationList
        initialNotifications={JSON.parse(JSON.stringify(notifications))}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
