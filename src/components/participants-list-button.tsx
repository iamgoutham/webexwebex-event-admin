"use client";

import { useState } from "react";

type ParticipantRow = {
  id: string;
  email: string;
  name: string;
  center: string;
  state: string;
  /** When false, row is shown but cannot be selected (e.g. already on DB exception list). */
  pickable?: boolean;
  /** Why the row cannot be selected when `pickable` is false */
  nonPickableReason?: "host" | "except";
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
  const [search, setSearch] = useState("");
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
      setSearch("");
      setSelectedIds([]);
      setOpen(true);
    } catch {
      setError("Failed to load participants");
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const isRowPickable = (p: ParticipantRow) => p.pickable !== false;

  const toggleId = (id: string) => {
    const row = list.find((p) => p.id === id);
    if (row && !isRowPickable(row)) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const query = search.trim().toLowerCase();
  const filteredList =
    query === ""
      ? list
      : list.filter((p) => {
          const name = p.name?.toLowerCase() ?? "";
          const email = p.email?.toLowerCase() ?? "";
          return (
            name.includes(query) ||
            email.includes(query)
          );
        });

  const pickableFilteredIds = filteredList
    .filter((p) => isRowPickable(p))
    .map((p) => p.id);
  const allSelected =
    pickableFilteredIds.length > 0 &&
    pickableFilteredIds.every((id) => selectedIds.includes(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pickableFilteredIds);
    }
  };

  const handleAddSelected = () => {
    if (!onAddEmails) return;
    const selectedEmails = filteredList
      .filter((p) => selectedIds.includes(p.id) && isRowPickable(p))
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
          <div className="flex items-center justify-between gap-3 border-b border-[#e5c18e] px-3 py-2 text-[11px] text-[#8a5b44]">
            <p>
              {filteredList.length} participant
              {filteredList.length !== 1 ? "s" : ""} in your state
              {onAddEmails ? (
                <span className="ml-1 text-[#b08b6b]">
                  (greyed rows: also a host, or on the exception list — cannot be
                  selected)
                </span>
              ) : null}
            </p>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-48 rounded-full border border-[#e5c18e] bg-white px-2 py-1 text-[11px] text-[#3b1a1f] placeholder:text-[#b08b6b] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-3">
            <table className="w-full text-left text-xs text-[#6b4e3d]">
              <thead>
                <tr className="border-b border-[#e5c18e] font-semibold text-[#3b1a1f]">
                  {onAddEmails && (
                    <th className="w-8 py-2 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        disabled={pickableFilteredIds.length === 0}
                        onChange={toggleAll}
                        className="h-3 w-3 rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d] disabled:cursor-not-allowed"
                      />
                    </th>
                  )}
                  <th className="py-2 pr-3">Last name, First name</th>
                  <th className="py-2 pr-3">Center</th>
                  <th className="py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((p) => {
                  const pickable = isRowPickable(p);
                  const selected = selectedIds.includes(p.id);
                  const nonPickableTitle =
                    p.nonPickableReason === "host"
                      ? "Also registered as a host — cannot add here"
                      : p.nonPickableReason === "except"
                        ? "Already on participant exception list"
                        : "Cannot be selected";
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-[#e5c18e]/60 ${selected ? "bg-[#fbe9c6]/40" : ""} ${!pickable ? "opacity-55" : ""}`}
                    >
                      {onAddEmails && (
                        <td className="py-1.5 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!pickable}
                            title={pickable ? undefined : nonPickableTitle}
                            onChange={() => toggleId(p.id)}
                            className="h-3 w-3 rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d] disabled:cursor-not-allowed"
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
          <div className="flex items-center justify-end border-t border-[#e5c18e] px-3 py-2 text-[11px] text-[#8a5b44]">
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
