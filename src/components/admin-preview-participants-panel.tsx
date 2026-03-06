"use client";

import { useState } from "react";
import MeetingExceptionRequest from "@/components/meeting-exception-request";

type AdminParticipantRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  center: string | null;
  state: string | null;
};

interface Props {
  previewUserId: string;
  previewUserLabel: string;
  currentAdminUserId: string;
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

  const canLoad = !!state && state.trim().length > 0;

  const load = async () => {
    if (!canLoad) {
      setRows([]);
      setSelectedIds([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        state: state!,
        limit: "500",
      });
      const res = await fetch(`/api/admin/participants?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load participants");
        setRows([]);
        setSelectedIds([]);
        return;
      }
      setRows((data.participants ?? []) as AdminParticipantRow[]);
      setSelectedIds([]);
    } catch {
      setError("Failed to load participants");
      setRows([]);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const allSelectableIds = rows.map((p) => p.id);
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
    const selectedEmails = rows
      .filter((p) => selectedIds.includes(p.id))
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
          Enter participant emails manually or select participants from this user&apos;s
          state to auto-fill the list.
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
              Participants in this user&apos;s state
            </p>
            <p className="mt-0.5 text-[11px] text-[#8a5b44]">
              State: <span className="font-medium">{state || "Unknown"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading || !canLoad}
            className="rounded-full border border-[#7a3b2a]/50 px-3 py-1.5 text-[11px] font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Loading…" : "Load participants"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[11px] text-red-700">{error}</p>
        )}
        {rows.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-[#e5c18e] bg-[#fff9ef]">
            <div className="max-h-64 overflow-y-auto p-2">
              <table className="w-full text-left text-[11px] text-[#6b4e3d]">
                <thead>
                  <tr className="border-b border-[#e5c18e] font-semibold text-[#3b1a1f]">
                    <th className="w-8 py-1.5 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-3 w-3 rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d]"
                      />
                    </th>
                    <th className="py-1.5 pr-3">Last, First</th>
                    <th className="py-1.5 pr-3">Center</th>
                    <th className="py-1.5">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const selected = selectedIds.includes(p.id);
                    const name =
                      p.lastName && p.firstName
                        ? `${p.lastName}, ${p.firstName}`
                        : p.firstName || p.lastName || p.email;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-[#e5c18e]/60 ${selected ? "bg-[#fbe9c6]/40" : ""}`}
                      >
                        <td className="py-1.5 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleId(p.id)}
                            className="h-3 w-3 rounded border-[#e5c18e] text-[#d8792d] focus:ring-[#d8792d]"
                          />
                        </td>
                        <td className="py-1.5 pr-3">{name}</td>
                        <td className="py-1.5 pr-3">{p.center || "—"}</td>
                        <td className="py-1.5">{p.email}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#e5c18e] px-3 py-1.5 text-[11px] text-[#8a5b44]">
              <span>
                {rows.length} participant{rows.length !== 1 ? "s" : ""} in this state
              </span>
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
        )}
        {canLoad && !loading && !error && rows.length === 0 && (
          <p className="mt-2 text-[11px] text-[#8a5b44]">
            No participants found for this state yet.
          </p>
        )}
      </div>
    </div>
  );
}

