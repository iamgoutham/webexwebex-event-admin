"use client";

import { useEffect, useState } from "react";

interface Broadcast {
  id: string;
  target: string;
  title: string;
  body: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
  sender: { name: string | null; email: string | null } | null;
  tenant: { name: string } | null;
}

export default function BroadcastHistory() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/broadcast?limit=10")
      .then((res) => res.json())
      .then((data) => {
        setBroadcasts(data.broadcasts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-[#8a5b44]">Loading broadcast history...</p>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <p className="text-sm text-[#8a5b44]">No broadcasts sent yet.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e5c18e] bg-white/70">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#f3d6a3] text-xs uppercase text-[#8a5b44]">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Target</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Sent</th>
            <th className="px-4 py-3">Failed</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Sender</th>
          </tr>
        </thead>
        <tbody>
          {broadcasts.map((b) => (
            <tr key={b.id} className="border-t border-[#e5c18e]">
              <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                {b.title}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    b.target === "ALL"
                      ? "bg-purple-100 text-purple-700"
                      : b.target === "HOSTS_ONLY"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {b.target === "HOSTS_ONLY"
                    ? "Hosts"
                    : b.target === "PARTICIPANTS_ONLY"
                      ? "Participants"
                      : "All"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    b.status === "SENT"
                      ? "bg-green-100 text-green-700"
                      : b.status === "SENDING"
                        ? "bg-yellow-100 text-yellow-700"
                        : b.status === "FAILED"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {b.status}
                </span>
              </td>
              <td className="px-4 py-3 text-green-700">
                {b.sentCount}
              </td>
              <td className="px-4 py-3 text-red-600">
                {b.failedCount}
              </td>
              <td className="px-4 py-3 text-xs text-[#8a5b44]">
                {b.sentAt
                  ? new Date(b.sentAt).toLocaleString()
                  : new Date(b.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-xs text-[#8a5b44]">
                {b.sender?.name ?? b.sender?.email ?? "System"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
