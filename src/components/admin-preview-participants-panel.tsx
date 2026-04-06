"use client";

import { useRef, useState } from "react";
import MeetingExceptionRequest from "@/components/meeting-exception-request";

const PAGE_SIZE = 500;

type AdminParticipantRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  center: string | null;
  state: string | null;
  pickable?: boolean;
  nonPickableReason?: "host" | "except";
};

interface Props {
  previewUserId: string;
  previewUserLabel: string;
  currentAdminUserId: string;
  /** Host’s state (informational only; participant list loads from all states). */
  state: string | null;
}

export default function AdminPreviewParticipantsPanel({
  previewUserId,
  previewUserLabel,
  currentAdminUserId,
  state,
}: Props) {
  const [emails, setEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminParticipantRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const searchRef = useRef(search);
  searchRef.current = search;

  const fetchPage = async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(pageNum),
        markProcessedExceptPickability: "true",
      });
      const q = searchRef.current.trim();
      if (q) {
        params.set("search", q);
      }
      const res = await fetch(`/api/admin/participants?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load participants");
        setRows([]);
        setSelectedIds([]);
        setPage(1);
        setTotalPages(1);
        setTotal(0);
        return;
      }
      setRows((data.participants ?? []) as AdminParticipantRow[]);
      setSelectedIds([]);
      const pagination = data.pagination ?? {};
      setPage(pagination.page ?? pageNum);
      setTotalPages(pagination.totalPages ?? 1);
      setTotal(pagination.total ?? 0);
    } catch {
      setError("Failed to load participants");
      setRows([]);
      setSelectedIds([]);
      setPage(1);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const load = () => {
    void fetchPage(1);
  };

  const goPrev = () => {
    if (page <= 1 || loading) return;
    setSelectedIds([]);
    void fetchPage(page - 1);
  };

  const goNext = () => {
    if (page >= totalPages || loading) return;
    setSelectedIds([]);
    void fetchPage(page + 1);
  };

  const isRowPickable = (p: AdminParticipantRow) => p.pickable !== false;

  const toggleId = (id: string) => {
    const row = rows.find((p) => p.id === id);
    if (row && !isRowPickable(row)) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const pickableFilteredIds = rows
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
    const selectedEmails = rows
      .filter((p) => selectedIds.includes(p.id) && isRowPickable(p))
      .map((p) => p.email);
    if (!selectedEmails.length) return;

    const existing = emails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter(Boolean);
    const lower = new Set(existing.map((e) => e.toLowerCase()));
    const merged = [...existing];

    for (const e of selectedEmails) {
      const val = e.trim();
      if (!val) continue;
      const key = val.toLowerCase();
      if (!lower.has(key)) {
        lower.add(key);
        merged.push(val);
      }
    }

    setEmails(merged.join("\n"));
  };

  return (
    <div className="space-y-4 text-xs text-[#6b4e3d]">
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-3">
        <p className="text-xs font-semibold text-[#3b1a1f]">
          Request participants as{" "}
          <span className="font-medium">{previewUserLabel}</span>
        </p>
        <p className="mt-1 text-[11px] text-[#8a5b44]">
          Enter participant emails manually or load participants from the full roster (all
          states) to auto-fill the list.
        </p>
        <div className="mt-3">
          <MeetingExceptionRequest
            standalone
            isAdmin
            currentUserId={currentAdminUserId}
            previewUserId={previewUserId}
            previewUserLabel={previewUserLabel}
            emailsValue={emails}
            onEmailsChange={setEmails}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[#3b1a1f]">
              Participants (all states)
            </p>
            <p className="mt-0.5 text-[11px] text-[#8a5b44]">
              Preview user state:{" "}
              <span className="font-medium">{state?.trim() || "—"}</span>
              {" · "}
              {PAGE_SIZE} per page; optional search runs on the server when you load.
            </p>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, center, phone…"
              className="w-56 rounded-full border border-[#e5c18e] bg-white px-2 py-1 text-[11px] text-[#3b1a1f] placeholder:text-[#b08b6b] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full border border-[#7a3b2a]/50 px-3 py-1.5 text-[11px] font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Loading…" : "Load participants"}
            </button>
          </form>
        </div>
        {error && (
          <p className="mt-2 text-[11px] text-red-700">{error}</p>
        )}
        {rows.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-[#e5c18e] bg-[#fff9ef]">
            <div className="max-h-64 overflow-y-auto p-2">
              <p className="mb-2 text-[10px] text-[#8a5b44]">
                Greyed rows are also registered as hosts or are on the participant
                exception list in the database and cannot be selected.
              </p>
              <table className="w-full text-left text-[11px] text-[#6b4e3d]">
                <thead>
                  <tr className="border-b border-[#e5c18e] font-semibold text-[#3b1a1f]">
                    <th className="w-8 py-1.5 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        disabled={pickableFilteredIds.length === 0}
                        onChange={toggleAll}
                        className="h-3 w-3 rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d] disabled:cursor-not-allowed"
                      />
                    </th>
                    <th className="py-1.5 pr-3">Last, First</th>
                    <th className="py-1.5 pr-3">State</th>
                    <th className="py-1.5 pr-3">Center</th>
                    <th className="py-1.5">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const pickable = isRowPickable(p);
                    const selected = selectedIds.includes(p.id);
                    const name =
                      p.lastName && p.firstName
                        ? `${p.lastName}, ${p.firstName}`
                        : p.firstName || p.lastName || p.email;
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
                        <td className="py-1.5 pr-3">{name}</td>
                        <td className="py-1.5 pr-3">{p.state || "—"}</td>
                        <td className="py-1.5 pr-3">{p.center || "—"}</td>
                        <td className="py-1.5">{p.email}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e5c18e] px-3 py-1.5 text-[11px] text-[#8a5b44]">
              <span>
                Page {page} of {totalPages}
                {" · "}
                {total.toLocaleString()} total
                {" · "}
                {rows.length} on this page
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={loading || page <= 1}
                    onClick={goPrev}
                    className="rounded-full border border-[#7a3b2a]/50 px-2 py-1 font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={loading || page >= totalPages}
                    onClick={goNext}
                    className="rounded-full border border-[#7a3b2a]/50 px-2 py-1 font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedIds.length === 0}
                  className="rounded-full bg-[#d8792d] px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
                >
                  Add selected to request
                </button>
              </div>
            </div>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="mt-2 text-[11px] text-[#8a5b44]">
            Click &quot;Load participants&quot; to load the roster, or none are stored yet.
          </p>
        )}
      </div>
    </div>
  );
}

