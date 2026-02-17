"use client";

import { useState } from "react";

type SyncResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type SyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: SyncResult }
  | { status: "error"; message: string };

export default function ParticipantSyncButton() {
  const [state, setState] = useState<SyncState>({ status: "idle" });

  const runSync = async () => {
    setState({ status: "loading" });

    try {
      const res = await fetch("/api/admin/participants/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Sync failed" }));
        setState({ status: "error", message: data.error ?? "Sync failed" });
        return;
      }

      const data = (await res.json()) as { result: SyncResult };
      setState({ status: "success", result: data.result });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Sync failed",
      });
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={runSync}
        disabled={state.status === "loading"}
        className="rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
      >
        {state.status === "loading"
          ? "Syncing participants..."
          : "Sync Participants from Google Sheets"}
      </button>

      {state.status === "error" ? (
        <p className="text-xs text-red-700">{state.message}</p>
      ) : null}

      {state.status === "success" ? (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-xs text-[#6b4e3d]">
          <p className="font-semibold text-[#3b1a1f]">
            Sync complete!
          </p>
          <p className="mt-2">
            Created: {state.result.created} &bull; Updated:{" "}
            {state.result.updated} &bull; Skipped: {state.result.skipped}
          </p>
          {state.result.errors.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-700">
                {state.result.errors.length} error(s)
              </summary>
              <ul className="mt-1 list-inside list-disc text-red-600">
                {state.result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {state.result.errors.length > 10 ? (
                  <li>...and {state.result.errors.length - 10} more</li>
                ) : null}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
