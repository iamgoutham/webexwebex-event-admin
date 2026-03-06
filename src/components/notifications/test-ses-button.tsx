"use client";

import { useState, useEffect } from "react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; sent: number; total: number; message: string }
  | { status: "error"; message: string };

export default function TestSesButton() {
  const [config, setConfig] = useState<{
    configured: boolean;
    count: number;
    emails?: string[];
  } | null>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    fetch("/api/admin/broadcast/test-ses")
      .then((r) => r.json())
      .then((data) =>
        setConfig({
          configured: data.configured ?? false,
          count: data.count ?? 0,
          emails: data.emails,
        }),
      )
      .catch(() => setConfig({ configured: false, count: 0 }));
  }, []);

  const handleSend = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/admin/broadcast/test-ses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Send failed" });
        return;
      }
      setState({
        status: "success",
        sent: data.sent ?? 0,
        total: data.total ?? 0,
        message: data.message ?? "Test email(s) sent.",
      });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Send failed",
      });
    }
  };

  if (config === null) {
    return (
      <p className="text-sm text-[#6b4e3d]">Loading test group…</p>
    );
  }

  if (!config.configured) {
    return (
      <p className="text-sm text-[#6b4e3d]">
        Set <code className="rounded bg-[#e5c18e]/40 px-1">SES_TEST_GROUP_EMAILS</code> in .env
        (comma-separated emails), then restart the server, to use the test group.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#6b4e3d]">
        Test group has {config.count} address{config.count !== 1 ? "es" : ""}.
        {config.emails && config.emails.length <= 5 && (
          <span className="ml-1">({config.emails.join(", ")})</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={state.status === "loading"}
          className="rounded-lg border border-[#d8792d] bg-[#d8792d] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c26a25] disabled:opacity-50"
        >
          {state.status === "loading" ? "Sending…" : "Send test email"}
        </button>
        {state.status === "success" && (
          <span className="text-sm text-green-700">
            {state.message}
          </span>
        )}
        {state.status === "error" && (
          <span className="text-sm text-red-700">{state.message}</span>
        )}
      </div>
    </div>
  );
}
