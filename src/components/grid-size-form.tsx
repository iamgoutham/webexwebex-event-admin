"use client";

import { useMemo, useState } from "react";

type GridSizeFormProps = {
  rows?: number | null;
  cols?: number | null;
  isSet?: boolean;
};

type FormState =
  | { status: "idle"; message?: string }
  | { status: "saving"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const OPTIONS = Array.from({ length: 5 }, (_, idx) => idx + 5);

export default function GridSizeForm({ rows, cols, isSet }: GridSizeFormProps) {
  const [selectedRows, setSelectedRows] = useState<number>(rows ?? 5);
  const [selectedCols, setSelectedCols] = useState<number>(cols ?? 5);
  const [state, setState] = useState<FormState>({ status: "idle" });

  const label = useMemo(
    () => `${selectedRows} x ${selectedCols}`,
    [selectedRows, selectedCols],
  );

  const saveGrid = async () => {
    setState({ status: "saving" });
    const response = await fetch("/api/profile/grid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: selectedRows, cols: selectedCols }),
    });

    if (!response.ok) {
      const message = await response
        .json()
        .then((data) => data?.error ?? "Unable to save grid size.")
        .catch(() => "Unable to save grid size.");
      setState({ status: "error", message });
      return;
    }

    setState({
      status: "saved",
      message: `Saved grid size ${label}.`,
    });
  };

  return (
    <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Video Grid Size</h2>
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Set the row and column layout shown in your Webex grid view.
          </p>
        </div>
        <div className="rounded-full border border-[#7a3b2a]/50 px-4 py-2 text-sm font-semibold text-[#3b1a1f]">
          {label}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          Rows
          <select
            value={selectedRows}
            onChange={(event) => setSelectedRows(Number(event.target.value))}
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          >
            {OPTIONS.map((value) => (
              <option key={`rows-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          Columns
          <select
            value={selectedCols}
            onChange={(event) => setSelectedCols(Number(event.target.value))}
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          >
            {OPTIONS.map((value) => (
              <option key={`cols-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={saveGrid}
          disabled={state.status === "saving"}
          className="rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
        >
          {state.status === "saving" ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-sm text-[#6b4e3d]">
        <p>
          {selectedRows} x {selectedCols} grid ={" "}
          <span className="font-semibold text-[#3b1a1f]">
            {selectedRows * selectedCols} participants
          </span>
        </p>
        <p className="mt-2 text-xs text-[#8a5b44]">
          Grid Size Status:{" "}
          {isSet ? (
            <span className="font-semibold text-emerald-700">Saved</span>
          ) : (
            <span className="font-semibold text-red-600">Not Set</span>
          )}
          . Default allocation is 25 participants if no grid size is set.
        </p>
      </div>

      {state.status === "error" ? (
        <p className="mt-3 text-xs text-red-700">{state.message}</p>
      ) : null}
      {state.status === "saved" ? (
        <p className="mt-3 text-xs text-emerald-700">{state.message}</p>
      ) : null}
    </div>
  );
}
