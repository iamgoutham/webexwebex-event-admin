"use client";

import { useState } from "react";

type AdminParticipantRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  center: string | null;
  state: string | null;
};

const STATE_OPTIONS = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "District of Columbia",
];

export default function AdminParticipantsByState() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminParticipantRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadForState = async (state: string, pageParam = 1) => {
    if (!state) {
      setRows([]);
      setPage(1);
      setTotalPages(1);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        state,
        limit: "100",
        page: String(pageParam),
      });
      const res = await fetch(`/api/admin/participants?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load participants");
        setRows([]);
        return;
      }
      setRows((data.participants ?? []) as AdminParticipantRow[]);
      const pagination = data.pagination ?? {};
      setPage(pagination.page ?? pageParam);
      setTotalPages(pagination.totalPages ?? 1);
      setTotal(pagination.total ?? (data.participants?.length ?? 0));
    } catch {
      setError("Failed to load participants");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    setSelectedState(value);
    setPage(1);
    setTotalPages(1);
    setTotal(0);
    void loadForState(value, 1);
  };

  return (
    <div className="space-y-3 text-sm text-[#6b4e3d]">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[#3b1a1f]">
          State
        </label>
        <select
          value={selectedState}
          onChange={(e) => handleChange(e.target.value)}
          className="min-w-[12rem] rounded-lg border border-[#e5c18e] bg-white px-3 py-1.5 text-sm text-[#3b1a1f] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        >
          <option value="">Select a state…</option>
          {STATE_OPTIONS.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        {loading && (
          <span className="text-xs text-[#8a5b44]">Loading…</span>
        )}
        {error && (
          <span className="text-xs text-red-700">{error}</span>
        )}
      </div>

      {selectedState && !loading && !error && (
        <p className="text-xs text-[#8a5b44]">
          Showing participants for <span className="font-semibold">{selectedState}</span>
          {total ? ` (${total.toLocaleString()} total)` : " — none found"}
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#e5c18e] bg-white/80">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs text-[#6b4e3d]">
              <thead className="bg-[#f3d6a3] text-[11px] uppercase text-[#8a5b44]">
                <tr>
                  <th className="px-4 py-2">Last, First</th>
                  <th className="px-4 py-2">Center</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const name =
                    p.lastName && p.firstName
                      ? `${p.lastName}, ${p.firstName}`
                      : p.firstName || p.lastName || p.email;
                  return (
                    <tr key={p.id} className="border-t border-[#e5c18e]/70">
                      <td className="px-4 py-2">{name}</td>
                      <td className="px-4 py-2">{p.center || "—"}</td>
                      <td className="px-4 py-2">{p.state || "—"}</td>
                      <td className="px-4 py-2">{p.email}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#e5c18e] px-4 py-2 text-xs text-[#8a5b44]">
              <button
                type="button"
                onClick={() => void loadForState(selectedState, page - 1)}
                disabled={page <= 1 || loading}
                className="rounded-full border border-[#e5c18e] px-3 py-1 text-[11px] font-medium text-[#3b1a1f] disabled:opacity-60"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => void loadForState(selectedState, page + 1)}
                disabled={page >= totalPages || loading}
                className="rounded-full border border-[#e5c18e] px-3 py-1 text-[11px] font-medium text-[#3b1a1f] disabled:opacity-60"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

