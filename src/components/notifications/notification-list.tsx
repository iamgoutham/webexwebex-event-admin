"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Full notification list with filtering and mark-as-read
// ---------------------------------------------------------------------------

interface NotificationItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationList({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialNotifications.length === 20);

  const fetchMore = async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "20",
      });
      if (filter === "unread") params.set("unread", "true");

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      const newNotifications = data.notifications ?? [];
      setNotifications((prev) => [...prev, ...newNotifications]);
      setPage(nextPage);
      setHasMore(newNotifications.length === 20);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
      );
    } catch {
      // Silent fail
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
    } catch {
      // Silent fail
    }
  };

  const handleFilterChange = async (newFilter: "all" | "unread") => {
    setFilter(newFilter);
    setPage(1);
    setLoading(true);

    try {
      const params = new URLSearchParams({ page: "1", limit: "20" });
      if (newFilter === "unread") params.set("unread", "true");

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setHasMore((data.notifications ?? []).length === 20);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  const severityBadge = (severity: string) => {
    const map: Record<string, string> = {
      CRITICAL: "bg-red-100 text-red-700",
      URGENT: "bg-orange-100 text-orange-700",
      WARNING: "bg-yellow-100 text-yellow-700",
      INFO: "bg-blue-100 text-blue-700",
    };
    return map[severity] ?? "bg-gray-100 text-gray-700";
  };

  const filtered =
    filter === "unread"
      ? notifications.filter((n) => !n.readAt)
      : notifications;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleFilterChange("all")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === "all"
                ? "bg-[#3b1a1f] text-[#fbe9c6]"
                : "bg-[#fff4df] text-[#6b4e3d] hover:bg-[#f7e2b6]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("unread")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === "unread"
                ? "bg-[#3b1a1f] text-[#fbe9c6]"
                : "bg-[#fff4df] text-[#6b4e3d] hover:bg-[#f7e2b6]"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-full bg-[#d8792d] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#b86425]"
          >
            Mark all as read
          </button>
        ) : null}
      </div>

      {/* Notification items */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-8 text-center text-sm text-[#8a5b44]">
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border border-[#e5c18e] p-4 transition ${
                !n.readAt ? "bg-[#fffaf0]" : "bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${severityBadge(n.severity)}`}
                    >
                      {n.severity}
                    </span>
                    <span className="text-[10px] text-[#c4a882]">
                      {formatDate(n.createdAt)}
                    </span>
                    {!n.readAt ? (
                      <span className="h-2 w-2 rounded-full bg-[#d8792d]" />
                    ) : null}
                  </div>
                  <h3
                    className={`mt-1 text-sm ${
                      !n.readAt
                        ? "font-semibold text-[#3b1a1f]"
                        : "text-[#6b4e3d]"
                    }`}
                  >
                    {n.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#8a5b44]">
                    {n.body}
                  </p>
                  {n.actionUrl ? (
                    <a
                      href={n.actionUrl}
                      className="mt-2 inline-block text-xs font-medium text-[#d8792d] hover:underline"
                    >
                      View details &rarr;
                    </a>
                  ) : null}
                </div>

                {!n.readAt ? (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="mt-1 flex-shrink-0 text-xs text-[#8a5b44] hover:text-[#3b1a1f]"
                    title="Mark as read"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore ? (
        <div className="text-center">
          <button
            type="button"
            onClick={fetchMore}
            disabled={loading}
            className="rounded-full bg-[#fff4df] px-6 py-2 text-sm font-medium text-[#6b4e3d] transition hover:bg-[#f7e2b6] disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
