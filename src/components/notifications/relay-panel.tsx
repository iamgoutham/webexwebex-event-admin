"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// RelayPanel — Hosts copy pre-formatted messages and mark as forwarded
// ---------------------------------------------------------------------------

interface RelayMessage {
  id: string;
  title: string;
  body: string;
  target: string;
  createdAt: string;
  acknowledged: boolean;
  sender: { name: string | null } | null;
}

type RelayState =
  | { status: "loading" }
  | { status: "loaded"; messages: RelayMessage[] }
  | { status: "error"; message: string };

export default function RelayPanel() {
  const [state, setState] = useState<RelayState>({ status: "loading" });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/relay")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setState({
          status: "loaded",
          messages: data.relayMessages ?? [],
        });
      })
      .catch((err) => {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load",
        });
      });
  }, []);

  const copyMessage = async (msg: RelayMessage) => {
    const text = `*${msg.title}*\n\n${msg.body}\n\n— Gita Chanting Event`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 3000);
    }
  };

  const acknowledge = async (broadcastId: string) => {
    setAckingId(broadcastId);
    try {
      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastId }),
      });

      if (res.ok) {
        setState((prev) => {
          if (prev.status !== "loaded") return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === broadcastId ? { ...m, acknowledged: true } : m,
            ),
          };
        });
      }
    } catch {
      // Silent fail
    } finally {
      setAckingId(null);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-8 text-center text-sm text-[#8a5b44]">
        Loading relay messages...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
        {state.message}
      </div>
    );
  }

  if (state.messages.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-8 text-center text-sm text-[#8a5b44]">
        No relay messages at this time. Check back during the event.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.messages.map((msg) => (
        <div
          key={msg.id}
          className={`rounded-2xl border p-6 ${
            msg.acknowledged
              ? "border-green-300 bg-green-50"
              : "border-[#e5c18e] bg-[#fff4df]"
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#3b1a1f]">
                {msg.title}
              </h3>
              <p className="mt-1 text-xs text-[#8a5b44]">
                From: {msg.sender?.name ?? "Admin"} &bull;{" "}
                {new Date(msg.createdAt).toLocaleString()}
              </p>
            </div>
            {msg.acknowledged ? (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                Sent
              </span>
            ) : null}
          </div>

          {/* Message body — formatted for WhatsApp */}
          <div className="mt-4 rounded-xl border border-[#e5c18e] bg-white p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-[#3b1a1f]">
              {`*${msg.title}*\n\n${msg.body}\n\n— Gita Chanting Event`}
            </pre>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => copyMessage(msg)}
              className="rounded-full bg-[#3b1a1f] px-4 py-2 text-sm font-semibold text-[#fbe9c6] transition hover:bg-[#5c2a2d]"
            >
              {copiedId === msg.id ? "✓ Copied!" : "📋 Copy Message"}
            </button>

            {!msg.acknowledged ? (
              <button
                type="button"
                onClick={() => acknowledge(msg.id)}
                disabled={ackingId === msg.id}
                className="rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:opacity-40"
              >
                {ackingId === msg.id
                  ? "Recording..."
                  : "✅ Copied & Sent to Participants"}
              </button>
            ) : null}

            {/* WhatsApp deep link (mobile) */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`*${msg.title}*\n\n${msg.body}\n\n— Gita Chanting Event`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1DA851]"
            >
              💬 Open in WhatsApp
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
