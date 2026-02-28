"use client";

import { useState, useEffect } from "react";

type HostOption = { id: string; email: string | null; name: string | null };

interface Props {
  meetingTitle: string;
  /** When true, show "Submit as host" dropdown and allow sending submitAsUserId */
  isAdmin?: boolean;
  /** Current user id; used as default "Submit as" and for API */
  currentUserId?: string;
}

// Match meeting titles containing CMS_XXXXX, CMSJ_XXXXX, or CMSI_XXXXX (5 chars)
const TITLE_PATTERN = /(CMS|CMSJ|CMSI)_.{5}/;

function extractCmsxId(title: string): string | null {
  const match = title.match(TITLE_PATTERN);
  return match ? match[0] : null;
}

export default function MeetingExceptionRequest({
  meetingTitle,
  isAdmin = false,
  currentUserId = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [hostOptions, setHostOptions] = useState<HostOption[]>([]);
  const [submitAsUserId, setSubmitAsUserId] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "success"; message: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const cmsxId = extractCmsxId(meetingTitle);

  useEffect(() => {
    if (!isAdmin || !open) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: { users?: HostOption[] }) => {
        const list = data?.users ?? [];
        setHostOptions(list);
        setSubmitAsUserId((prev) =>
          prev ? prev : currentUserId || list[0]?.id || "",
        );
      })
      .catch(() => setHostOptions([]));
  }, [isAdmin, open, currentUserId]);

  const handleSubmit = async () => {
    const raw = emails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!raw.length) {
      setStatus({
        type: "error",
        message: "Enter at least one email.",
      });
      return;
    }
    if (!cmsxId) {
      setStatus({
        type: "error",
        message: "Unable to detect CMSX_ id in meeting title.",
      });
      return;
    }

    setStatus({ type: "loading" });

    try {
      const body: Record<string, unknown> = {
        meetingCmsxId: cmsxId,
        meetingTitle,
        participantEmails: raw,
      };
      if (isAdmin && submitAsUserId && submitAsUserId !== currentUserId) {
        body.submitAsUserId = submitAsUserId;
      }
      const res = await fetch("/api/hosts/meeting-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data.error ??
          (data.missing
            ? `Some emails are not registered participants: ${data.missing.join(
                ", ",
              )}`
            : "Request failed");
        setStatus({ type: "error", message: msg });
        return;
      }

      setStatus({
        type: "success",
        message:
          data.message ??
          `Recorded ${data.requestedCount ?? raw.length} participant request(s).`,
      });
      setEmails("");
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  return (
    <div className="mt-3 w-full text-xs text-[#6b4e3d]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-[#7a3b2a]/50 px-3 py-1 text-xs font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a]"
      >
        {open ? "Close participant request" : "Request participants for this meeting"}
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-3">
          <p className="text-xs font-semibold text-[#3b1a1f]">
            Meeting: <span className="font-normal">{meetingTitle}</span>
          </p>
          {isAdmin && hostOptions.length > 0 && (
            <div className="mt-2">
              <label className="text-[11px] font-medium text-[#6b4e3d]">
                Submit as host
              </label>
              <select
                value={submitAsUserId}
                onChange={(e) => setSubmitAsUserId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#e5c18e] bg-white px-3 py-1.5 text-xs text-[#3b1a1f] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
              >
                <option value={currentUserId || ""}>
                  Me (current user)
                </option>
                {hostOptions
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <p className="mt-2 text-[11px] text-[#8a5b44]">
            Enter participant emails (they must already be registered). One per
            line or separated by commas.
          </p>
          <textarea
            className="mt-2 w-full rounded-xl border border-[#e5c18e] bg-white px-3 py-2 text-xs text-[#3b1a1f] placeholder:text-[#c4a882] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
            rows={3}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="participant1@example.com&#10;participant2@example.com"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status.type === "loading"}
              className="rounded-full bg-[#d8792d] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
            >
              {status.type === "loading" ? "Submitting..." : "Submit request"}
            </button>
            {status.type === "error" && (
              <span className="text-[11px] text-red-700">
                {status.message}
              </span>
            )}
            {status.type === "success" && (
              <span className="text-[11px] text-green-700">
                {status.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

