"use client";

import { useState } from "react";

type ImportResult = {
  processed: number;
  updated: number;
  skippedInvalid: number;
  skippedNotFound: number;
  skippedUnauthorized: number;
};

type ImportState =
  | { status: "idle"; message?: string }
  | { status: "loading"; message?: string }
  | { status: "success"; message: string; result: ImportResult }
  | { status: "error"; message: string };

export default function GridImportButton() {
  const [state, setState] = useState<ImportState>({ status: "idle" });

  const runImport = async () => {
    setState({ status: "loading", message: "Importing grid sizes..." });
    const response = await fetch("/api/admin/import-grid-sizes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const message = await response
        .json()
        .then((data) => data?.error ?? "Import failed.")
        .catch(() => "Import failed.");
      setState({ status: "error", message });
      return;
    }

    const data = (await response.json()) as {
      message: string;
      result: ImportResult;
    };
    setState({
      status: "success",
      message: data.message ?? "Import completed.",
      result: data.result,
    });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={runImport}
        disabled={state.status === "loading"}
        className="rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
      >
        {state.status === "loading" ? "Importing..." : "Import video grid sizes"}
      </button>

      {state.status === "error" ? (
        <p className="text-xs text-red-700">{state.message}</p>
      ) : null}

      {state.status === "success" ? (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-xs text-[#6b4e3d]">
          <p className="font-semibold text-[#3b1a1f]">{state.message}</p>
          <p className="mt-2">
            Processed: {state.result.processed} • Updated:{" "}
            {state.result.updated}
          </p>
          <p>
            Skipped (invalid): {state.result.skippedInvalid} • Skipped (not
            found): {state.result.skippedNotFound} • Skipped (unauthorized):{" "}
            {state.result.skippedUnauthorized}
          </p>
        </div>
      ) : null}
    </div>
  );
}
