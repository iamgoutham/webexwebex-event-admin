"use client";

import { useState } from "react";

type ParticipantRow = {
  id: string;
  email: string;
  name: string;
  center: string;
  state: string;
};

interface Props {
  /** Optional callback to push selected emails into an external request form. */
  onAddEmails?: (emails: string[]) => void;
}

export default function ParticipantsListButton({ onAddEmails }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<ParticipantRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = async () => {
    if (list.length > 0 && open && !onAddEmails) {
      setOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hosts/participants");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load participants");
        setList([]);
        return;
      }
      setList(data.participants ?? []);
      setSelectedIds([]);
      setOpen(true);
    } catch {
      setError("Failed to load participants");
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const allSelectableIds = list.map((p) => p.id);
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedIds.includes(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allSelectableIds);
    }
  };

  const handleAddSelected = () => {
    if (!onAddEmails) return;
    const selectedEmails = list
      .filter((p) => selectedIds.includes(p.id))
      .map((p) => p.email);
    if (selectedEmails.length === 0) return;
    onAddEmails(selectedEmails);
  };

  return (
    <div className={`flex flex-wrap items-start gap-3 ${open && list.length > 0 ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="rounded-full border border-[#7a3b2a]/50 px-3 py-1.5 text-xs font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a] disabled:opacity-70"
      >
        {loading
          ? "Loading…"
          : open && !onAddEmails
            ? "Hide participants (Last name, First name, Center, State)"
            : "Show participants (Last name, First name, Center, State)"}
      </button>
      {error && (
        <span className="text-[11px] text-red-700">{error}</span>
      )}
      {open && list.length > 0 && (
        <div className="mt-3 w-full overflow-hidden rounded-xl border border-[#e5c18e] bg-[#fff9ef]">
          <div className="max-h-80 overflow-y-auto p-3">
            <table className="w-full text-left text-xs text-[#6b4e3d]">
              <thead>
                <tr className="border-b border-[#e5c18e] font-semibold text-[#3b1a1f]">
                  {onAddEmails && (
                    <th className="w-8 py-2 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-3 w-3 rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d]"
                      />
                    </th>
                  )}
                  <th className="py-2 pr-3">Last name, First name</th>
                  <th className="py-2 pr-3">Center</th>
                  <th className="py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const selected = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-[#e5c18e]/60 ${selected ? "bg-[#fbe9c6]/40" : ""}`}
                    >
                      {onAddEmails && (
                        <td className="py-1.5 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleId(p.id)}
                            className="h-3 w-3 rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d]"
                          />
                        </td>
                      )}
                      <td className="py-1.5 pr-3">{p.name}</td>
                      <td className="py-1.5 pr-3">{p.center}</td>
                      <td className="py-1.5">{p.state || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#e5c18e] px-3 py-2 text-[11px] text-[#8a5b44]">
            <p>
              {list.length} participant{list.length !== 1 ? "s" : ""} in your state
            </p>
            {onAddEmails && (
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={selectedIds.length === 0}
                className="rounded-full bg-[#d8792d] px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
              >
                Add selected to request
              </button>
            )}
          </div>
        </div>
      )}
      {open && list.length === 0 && !error && !loading && (
        <p className="mt-2 text-xs text-[#8a5b44]">
          No participants in your state.
        </p>
      )}
    </div>
  );
}
