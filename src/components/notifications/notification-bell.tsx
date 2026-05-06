"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// NotificationBell — Bell icon with unread count badge + dropdown
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

type NotificationBellProps = {
  /** When true, skip EventSource to `/api/notifications/stream` (REST only). */
  sseDisabled?: boolean;
};

export default function NotificationBell({
  sseDisabled = false,
}: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  /** True after the user opens the bell once — SSE is started then and kept until unmount. */
  const sseStartedRef = useRef(false);

  const fetchUnreadCountOnly = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?countOnly=true");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent fail — non-critical
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent fail — non-critical
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (sseDisabled || eventSourceRef.current) return;

    const eventSource = new EventSource("/api/notifications/stream");
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;

        const notification: NotificationItem = {
          id: data.id,
          type: data.type,
          severity: data.severity,
          title: data.title,
          body: data.body,
          actionUrl: data.actionUrl,
          readAt: null,
          createdAt: data.createdAt ?? new Date().toISOString(),
        };

        setNotifications((prev) => [notification, ...prev.slice(0, 9)]);
        setUnreadCount((prev) => prev + 1);

        if (
          data.severity === "URGENT" ||
          data.severity === "CRITICAL"
        ) {
          setToast(notification);
          setTimeout(() => setToast(null), 8000);
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // EventSource will auto-reconnect
    };
  }, [sseDisabled]);

  // Badge only on load — one REST call, no SSE
  useEffect(() => {
    void fetchUnreadCountOnly();
  }, [fetchUnreadCountOnly]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark all as read
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

  // Mark single as read
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

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "border-l-red-500";
      case "URGENT":
        return "border-l-orange-500";
      case "WARNING":
        return "border-l-yellow-500";
      default:
        return "border-l-[#d8792d]";
    }
  };

  return (
    <>
      {/* Notification bell */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => {
            const opening = !isOpen;
            setIsOpen(opening);
            if (!opening) return;
            if (sseDisabled) {
              void fetchNotifications();
              return;
            }
            if (!sseStartedRef.current) {
              sseStartedRef.current = true;
              void fetchNotifications();
              connectSSE();
            }
          }}
          className="relative rounded-full p-1.5 text-[#fbe9c6]/70 transition hover:text-[#fbe9c6]"
          aria-label="Notifications"
        >
          {/* Bell SVG icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
            />
          </svg>

          {/* Unread badge */}
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#d8792d] px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>

        {/* Dropdown */}
        {isOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[#e5c18e] bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e5c18e] bg-[#fff4df] px-4 py-3">
              <span className="text-sm font-semibold text-[#3b1a1f]">
                Notifications
              </span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-[#d8792d] hover:underline"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[#8a5b44]">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.readAt) markRead(n.id);
                      if (n.actionUrl) window.open(n.actionUrl, "_self");
                    }}
                    className={`w-full border-b border-[#f0e0c0] border-l-4 px-4 py-3 text-left transition hover:bg-[#fff9ef] ${
                      severityColor(n.severity)
                    } ${!n.readAt ? "bg-[#fffaf0]" : "bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm ${
                          !n.readAt
                            ? "font-semibold text-[#3b1a1f]"
                            : "text-[#6b4e3d]"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.readAt ? (
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#d8792d]" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#8a5b44]">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-[#c4a882]">
                      {formatTime(n.createdAt)}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <a
              href="/dashboard/notifications"
              className="block border-t border-[#e5c18e] bg-[#fff4df] px-4 py-2.5 text-center text-xs font-medium text-[#d8792d] hover:underline"
            >
              View all notifications
            </a>
          </div>
        ) : null}
      </div>

      {/* Toast notification */}
      {toast ? (
        <div className="fixed right-6 top-20 z-[100] animate-in slide-in-from-right-full">
          <div className="w-80 rounded-2xl border border-[#e5c18e] bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#3b1a1f]">
                  {toast.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[#6b4e3d]">
                  {toast.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-[#8a5b44] hover:text-[#3b1a1f]"
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
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
