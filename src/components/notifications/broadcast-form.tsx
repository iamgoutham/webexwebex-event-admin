"use client";

import { useEffect, useState } from "react";

type BroadcastTarget =
  | "HOSTS_ONLY"
  | "PARTICIPANTS_ONLY"
  | "ALL"
  | "TEST_GROUP"
  | "DYNAMIC";

function parseEmailList(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return [...new Set(parts.filter((e) => emailRe.test(e)))];
}

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
  const [imageUrl, setImageUrl] = useState("");
  const [target, setTarget] = useState<BroadcastTarget>("ALL");
  const [tenantId, setTenantId] = useState<string>("");
  const [includeEmail, setIncludeEmail] = useState(true);
  const [includeInApp, setIncludeInApp] = useState(true);
  const [state, setState] = useState<BroadcastState>({ status: "idle" });
  const [dynamicModalOpen, setDynamicModalOpen] = useState(false);
  const [dynamicEmailInput, setDynamicEmailInput] = useState("");

  useEffect(() => {
    if (target === "DYNAMIC") {
      setIncludeEmail(true);
      setIncludeInApp(false);
    }
  }, [target]);

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

    if (target === "DYNAMIC") {
      setState({ status: "idle" });
      setDynamicModalOpen(true);
      return;
    }

    setState({ status: "loading" });

    // Special case: send ONLY to test group (SES_TEST_GROUP_EMAILS)
    if (target === "TEST_GROUP") {
      try {
        const res = await fetch("/api/admin/broadcast/test-ses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: title.trim(),
            body: body.trim(),
            imageUrl: imageUrl.trim() || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Send failed" }));
          setState({
            status: "error",
            message: data.error ?? "Send failed",
          });
          return;
        }

        const data = await res.json();
        setState({
          status: "success",
          message: data.message ?? "Test email sent to SES_TEST_GROUP_EMAILS",
          // No real broadcastId for test sends; label it clearly.
          broadcastId: "test-group",
        });
        setTitle("");
        setBody("");
        setImageUrl("");
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Send failed",
        });
      }
      return;
    }

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || null,
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
      setImageUrl("");
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Send failed",
      });
    }
  };

  const handleDynamicConfirm = async () => {
    const emails = parseEmailList(dynamicEmailInput);
    if (emails.length === 0) {
      setState({
        status: "error",
        message: "Enter at least one valid email (comma or newline separated)",
      });
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
          imageUrl: imageUrl.trim() || null,
          target: "DYNAMIC",
          channels: ["EMAIL"],
          tenantId: tenantId || null,
          dynamicEmails: emails,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Send failed" }));
        setState({ status: "error", message: data.error ?? "Send failed" });
        return;
      }

      const data = await res.json();
      setDynamicModalOpen(false);
      setDynamicEmailInput("");
      setState({
        status: "success",
        message: data.message ?? "Broadcast sent!",
        broadcastId: data.broadcastId,
      });
      setTitle("");
      setBody("");
      setImageUrl("");
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

      {/* Image URL (optional) — embed JPEG/image in email */}
      <div>
        <label
          htmlFor="broadcast-image-url"
          className="block text-sm font-semibold text-[#3b1a1f]"
        >
          Image URL <span className="font-normal text-[#8a5b44]">(optional)</span>
        </label>
        <input
          id="broadcast-image-url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://... or /image.jpg (from public folder)"
          className="mt-1 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-2.5 text-sm text-[#3b1a1f] placeholder:text-[#c4a882] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />
        <p className="mt-1 text-xs text-[#8a5b44]">
          Full URL (https://…) or path to an image in this app&apos;s public folder (e.g. <code className="rounded bg-[#e5c18e]/40 px-1">/logo.jpg</code>). Embedded at the bottom of the email.
        </p>
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
            <option value="DYNAMIC">Dynamic (custom email list)</option>
            <option value="TEST_GROUP">Test Group (SES_TEST_GROUP_EMAILS)</option>
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
              disabled={target === "DYNAMIC"}
              className="rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d] disabled:opacity-40"
            />
            Email
            {target === "DYNAMIC" ? (
              <span className="text-xs text-[#8a5b44]">(required)</span>
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#6b4e3d]">
            <input
              type="checkbox"
              checked={includeInApp}
              onChange={(e) => setIncludeInApp(e.target.checked)}
              disabled={
                target === "PARTICIPANTS_ONLY" ||
                target === "TEST_GROUP" ||
                target === "DYNAMIC"
              }
              className="rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d] disabled:opacity-40"
            />
            In-App{" "}
            {target === "PARTICIPANTS_ONLY" ? (
              <span className="text-xs text-[#8a5b44]">(hosts only)</span>
            ) : null}
            {target === "DYNAMIC" ? (
              <span className="text-xs text-[#8a5b44]">(not available)</span>
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

      {dynamicModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dynamic-broadcast-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-xl">
            <h3
              id="dynamic-broadcast-title"
              className="text-lg font-semibold text-[#3b1a1f]"
            >
              Dynamic group — recipient emails
            </h3>
            <p className="mt-2 text-sm text-[#6b4e3d]">
              Enter one email per line, or separate addresses with commas. Only
              valid addresses are sent.
            </p>
            <textarea
              value={dynamicEmailInput}
              onChange={(e) => setDynamicEmailInput(e.target.value)}
              rows={10}
              placeholder={"a@example.com\nb@example.com"}
              className="mt-4 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-3 font-mono text-sm text-[#3b1a1f] placeholder:text-[#c4a882] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
            />
            <p className="mt-2 text-xs text-[#8a5b44]">
              Parsed: {parseEmailList(dynamicEmailInput).length} valid email
              {parseEmailList(dynamicEmailInput).length === 1 ? "" : "s"}
            </p>
            {state.status === "error" ? (
              <p className="mt-2 text-xs text-red-700">{state.message}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (state.status === "loading") return;
                  setDynamicModalOpen(false);
                }}
                className="rounded-full border border-[#e5c18e] bg-white px-5 py-2 text-sm font-medium text-[#3b1a1f] hover:bg-[#fff9ef]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDynamicConfirm}
                disabled={state.status === "loading"}
                className="rounded-full bg-[#d8792d] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
              >
                {state.status === "loading" ? "Sending..." : "Send to list"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
