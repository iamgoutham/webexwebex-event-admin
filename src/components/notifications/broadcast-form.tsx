"use client";

import { useState } from "react";

type BroadcastTarget = "HOSTS_ONLY" | "PARTICIPANTS_ONLY" | "ALL";

type BroadcastState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string; broadcastId: string }
  | { status: "error"; message: string };

interface TenantOption {
  id: string;
  name: string;
}

export default function BroadcastForm({
  tenants,
}: {
  tenants: TenantOption[];
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<BroadcastTarget>("ALL");
  const [tenantId, setTenantId] = useState<string>("");
  const [includeEmail, setIncludeEmail] = useState(true);
  const [includeInApp, setIncludeInApp] = useState(true);
  const [state, setState] = useState<BroadcastState>({ status: "idle" });

  const channels: string[] = [];
  if (includeEmail) channels.push("EMAIL");
  if (includeInApp) channels.push("IN_APP");

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setState({ status: "error", message: "Title and body are required" });
      return;
    }
    if (channels.length === 0) {
      setState({ status: "error", message: "Select at least one channel" });
      return;
    }

    setState({ status: "loading" });

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          target,
          channels,
          tenantId: tenantId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Send failed" }));
        setState({ status: "error", message: data.error ?? "Send failed" });
        return;
      }

      const data = await res.json();
      setState({
        status: "success",
        message: data.message ?? "Broadcast sent!",
        broadcastId: data.broadcastId,
      });
      setTitle("");
      setBody("");
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Send failed",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label
          htmlFor="broadcast-title"
          className="block text-sm font-semibold text-[#3b1a1f]"
        >
          Subject / Title
        </label>
        <input
          id="broadcast-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Event is LIVE — Join your meeting now!"
          className="mt-1 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-2.5 text-sm text-[#3b1a1f] placeholder:text-[#c4a882] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />
      </div>

      {/* Body */}
      <div>
        <label
          htmlFor="broadcast-body"
          className="block text-sm font-semibold text-[#3b1a1f]"
        >
          Message Body
        </label>
        <textarea
          id="broadcast-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Write your message here..."
          className="mt-1 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-2.5 text-sm text-[#3b1a1f] placeholder:text-[#c4a882] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />
      </div>

      {/* Target + Scope */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="broadcast-target"
            className="block text-sm font-semibold text-[#3b1a1f]"
          >
            Send To
          </label>
          <select
            id="broadcast-target"
            value={target}
            onChange={(e) => setTarget(e.target.value as BroadcastTarget)}
            className="mt-1 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-2.5 text-sm text-[#3b1a1f] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
          >
            <option value="ALL">Everyone (Hosts + Participants)</option>
            <option value="HOSTS_ONLY">Hosts Only</option>
            <option value="PARTICIPANTS_ONLY">Participants Only</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="broadcast-tenant"
            className="block text-sm font-semibold text-[#3b1a1f]"
          >
            Scope
          </label>
          <select
            id="broadcast-tenant"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-2.5 text-sm text-[#3b1a1f] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
          >
            <option value="">All Tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Channels */}
      <div>
        <span className="block text-sm font-semibold text-[#3b1a1f]">
          Channels
        </span>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-[#6b4e3d]">
            <input
              type="checkbox"
              checked={includeEmail}
              onChange={(e) => setIncludeEmail(e.target.checked)}
              className="rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d]"
            />
            Email
          </label>
          <label className="flex items-center gap-2 text-sm text-[#6b4e3d]">
            <input
              type="checkbox"
              checked={includeInApp}
              onChange={(e) => setIncludeInApp(e.target.checked)}
              disabled={target === "PARTICIPANTS_ONLY"}
              className="rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d] disabled:opacity-40"
            />
            In-App{" "}
            {target === "PARTICIPANTS_ONLY" ? (
              <span className="text-xs text-[#8a5b44]">(hosts only)</span>
            ) : null}
          </label>
        </div>
      </div>

      {/* Send button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSend}
          disabled={state.status === "loading"}
          className="rounded-full bg-[#d8792d] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
        >
          {state.status === "loading" ? "Sending..." : "Send Broadcast"}
        </button>

        {state.status === "error" ? (
          <p className="text-xs text-red-700">{state.message}</p>
        ) : null}
      </div>

      {/* Success */}
      {state.status === "success" ? (
        <div className="rounded-2xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">{state.message}</p>
          <p className="mt-1 text-xs text-green-600">
            Broadcast ID: {state.broadcastId}
          </p>
        </div>
      ) : null}
    </div>
  );
}
