"use client";

import { useState } from "react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string };

type Props = {
  clientName: string;
  label?: string;
};

export default function UpdateMeetingSheetButton({ clientName, label }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const buttonLabel = label ?? `Update host meeting info (${clientName})`;

  const runUpdate = async () => {
    setState({ status: "loading" });
    const response = await fetch("/api/admin/update-meeting-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: clientName }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setState({
        status: "error",
        message: (data as { error?: string }).error ?? "Update failed.",
      });
      return;
    }

    setState({
      status: "success",
      message: (data as { message?: string }).message ?? "Meeting info updated in sheet.",
    });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={runUpdate}
        disabled={state.status === "loading"}
        className="rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
      >
        {state.status === "loading" ? "Updating…" : buttonLabel}
      </button>

      {state.status === "error" ? (
        <p className="text-xs text-red-700">{state.message}</p>
      ) : null}

      {state.status === "success" ? (
        <p className="text-xs text-[#6b4e3d]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
