"use client";

import { useState } from "react";

type PreviewOk = {
  valid: true;
  lookupType: "email";
  query: string;
  email: string;
  subject: string;
  body: string;
  lookup: {
    displayName: string | null;
    isHost: boolean;
    isParticipant: boolean;
    meetingsCount: number;
  };
};

type PreviewInvalid = {
  valid: false;
  lookupType: "email" | "phone";
  query: string;
  email?: string;
  note: string;
};

type PhonePreviewOk = {
  valid: true;
  lookupType: "phone";
  query: string;
  whatsappPreview: {
    templateName: "host_meeting_info" | "participant_meeting_info_v5";
    templateParams: string[];
    renderedMessage?: string;
  };
  lookup: {
    resolvedEmail: string;
    displayName: string | null;
    isHost: boolean;
    isParticipant: boolean;
    meetingsCount: number;
  };
};

type PreviewError = { error: string; detail?: string };

export default function ConfirmRegistrationEmailPreview() {
  const [lookupType, setLookupType] = useState<"email" | "phone">("email");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    PreviewOk | PhonePreviewOk | PreviewInvalid | PreviewError | null
  >(null);

  const runPreview = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/confirm-registration-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupType, query: query.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResult({
          error: (data as { error?: string }).error ?? "Preview failed.",
          detail: (data as { detail?: string }).detail,
        });
        return;
      }

      if ((data as PreviewInvalid).valid === false) {
        setResult(data as PreviewInvalid);
        return;
      }

      setResult(data as PreviewOk);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-[#e5c18e] bg-[#fff9ef] p-1">
        <button
          type="button"
          onClick={() => setLookupType("email")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            lookupType === "email"
              ? "bg-[#1f6b4a] text-white"
              : "text-[#6b4e3d] hover:bg-[#f3e3c3]"
          }`}
        >
          Email preview
        </button>
        <button
          type="button"
          onClick={() => setLookupType("phone")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            lookupType === "phone"
              ? "bg-[#1f6b4a] text-white"
              : "text-[#6b4e3d] hover:bg-[#f3e3c3]"
          }`}
        >
          WhatsApp by phone
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="confirm-preview-email" className="block text-xs font-semibold text-[#6b4e3d]">
            {lookupType === "email" ? "Email address" : "WhatsApp phone number"}
          </label>
          <input
            id="confirm-preview-email"
            type={lookupType === "email" ? "email" : "tel"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lookupType === "email" ? "user@example.com" : "+1 555 123 4567"}
            className="mt-1 w-full rounded-xl border border-[#e5c18e] bg-white/90 px-3 py-2 text-sm text-[#3b1a1f] outline-none ring-[#d8792d]/30 focus:ring-2"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={runPreview}
          disabled={loading || !query.trim()}
          className="rounded-full bg-[#1f6b4a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185238] disabled:cursor-not-allowed disabled:bg-[#1f6b4a]/40"
        >
          {loading ? "Loading…" : lookupType === "email" ? "Preview email" : "Preview WhatsApp"}
        </button>
      </div>

      {"error" in (result ?? {}) && result && "error" in result ? (
        <div className="rounded-xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-800">
          <p>{result.error}</p>
          {"detail" in result && result.detail ? (
            <p className="mt-1 font-mono text-xs text-red-700">{result.detail}</p>
          ) : null}
        </div>
      ) : null}

      {result && "valid" in result && result.valid === false ? (
        <div className="rounded-xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-sm text-[#6b4e3d]">
          <p className="font-semibold text-[#3b1a1f]">{result.query}</p>
          <p className="mt-2">{result.note}</p>
        </div>
      ) : null}

      {result && "valid" in result && result.valid === true && result.lookupType === "email" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#e5c18e] bg-white/80 p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-[#8a5b44]">Subject</p>
            <p className="mt-1 font-medium text-[#3b1a1f]">{result.subject}</p>
            <p className="mt-3 text-xs font-semibold uppercase text-[#8a5b44]">Lookup</p>
            <p className="mt-1 text-[#6b4e3d]">
              Participant: {result.lookup.isParticipant ? "yes" : "no"} · Host:{" "}
              {result.lookup.isHost ? "yes" : "no"} · Meetings:{" "}
              {result.lookup.meetingsCount}
              {result.lookup.displayName ? (
                <>
                  {" "}
                  · Name: {result.lookup.displayName}
                </>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[#8a5b44]">Body (plain text)</p>
            <pre className="mt-2 max-h-[min(480px,70vh)] overflow-auto whitespace-pre-wrap rounded-xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-left text-xs leading-relaxed text-[#3b1a1f]">
              {result.body}
            </pre>
          </div>
        </div>
      ) : null}

      {result && "valid" in result && result.valid === true && result.lookupType === "phone" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#e5c18e] bg-white/80 p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-[#8a5b44]">WhatsApp template</p>
            <p className="mt-1 font-medium text-[#3b1a1f]">{result.whatsappPreview.templateName}</p>
            <p className="mt-3 text-xs font-semibold uppercase text-[#8a5b44]">Lookup</p>
            <p className="mt-1 text-[#6b4e3d]">
              Participant: {result.lookup.isParticipant ? "yes" : "no"} · Host:{" "}
              {result.lookup.isHost ? "yes" : "no"} · Meetings: {result.lookup.meetingsCount}
              {result.lookup.displayName ? <> · Name: {result.lookup.displayName}</> : null}
              {" · "}Email: {result.lookup.resolvedEmail}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[#8a5b44]">
              Template parameters (in order)
            </p>
            <ol className="mt-2 list-decimal space-y-1 rounded-xl border border-[#e5c18e] bg-[#fff9ef] p-4 pl-8 text-xs text-[#3b1a1f]">
              {result.whatsappPreview.templateParams.map((value, index) => (
                <li key={`${index}-${value}`}>{value}</li>
              ))}
            </ol>
          </div>
          {result.whatsappPreview.renderedMessage ? (
            <div>
              <p className="text-xs font-semibold uppercase text-[#8a5b44]">
                Rendered WhatsApp message preview
              </p>
              <pre className="mt-2 max-h-[min(480px,70vh)] overflow-auto whitespace-pre-wrap rounded-xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-left text-xs leading-relaxed text-[#3b1a1f]">
                {result.whatsappPreview.renderedMessage}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
