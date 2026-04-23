"use client";

import { useMemo, useState } from "react";

export default function ConfirmRegistrationClient() {
  const [lookupType, setLookupType] = useState<"email" | "phone">("email");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "success"; message: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const canSubmit = useMemo(() => {
    return query.trim().length > 3 && status.type !== "loading";
  }, [query, status.type]);

  const resetForm = () => {
    setQuery("");
    setStatus({ type: "idle" });
  };

  const submit = async () => {
    setStatus({ type: "loading" });
    try {
      const res = await fetch("/api/public/confirm-registration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lookupType,
          query: query.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "error", message: data.error ?? "Request failed" });
        return;
      }
      setStatus({
        type: "success",
        message:
          data.message ??
          "If your registration is found, details will be sent shortly.",
      });
      setQuery("");
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Confirm your registration</h1>
        <div className="mt-2 space-y-3 text-sm text-[#6b4e3d]">
          <p>
            Search using your registration email or WhatsApp phone number. If
            it matches a valid participant (or host):
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Email search sends a confirmation email with your meeting and host
              details.
            </li>
            <li>Phone search sends a WhatsApp info message to that number.</li>
          </ul>
          <p>Your meeting link if available will also be included.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 shadow-sm">
        {status.type === "success" ? (
          <div className="rounded-xl border border-[#b7e0c4] bg-[#eefaf2] p-4 text-sm text-[#1f6b4a]">
            <p className="font-semibold">Request received</p>
            <p className="mt-1">{status.message}</p>
            <button
              type="button"
              onClick={resetForm}
              className="mt-3 rounded-full border border-[#1f6b4a]/40 px-3 py-1.5 text-xs font-semibold text-[#1f6b4a] hover:border-[#1f6b4a]"
            >
              Send another request
            </button>
          </div>
        ) : null}

        <label className="block text-sm font-semibold text-[#3b1a1f]">
          Search by
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLookupType("email")}
            disabled={status.type === "success"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              lookupType === "email"
                ? "bg-[#d8792d] text-white"
                : "border border-[#e5c18e] bg-white text-[#6b4e3d]"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setLookupType("phone")}
            disabled={status.type === "success"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              lookupType === "phone"
                ? "bg-[#d8792d] text-white"
                : "border border-[#e5c18e] bg-white text-[#6b4e3d]"
            }`}
          >
            WhatsApp phone
          </button>
        </div>
        <label className="mt-4 block text-sm font-semibold text-[#3b1a1f]">
          {lookupType === "email" ? "Email address" : "WhatsApp phone number"}
        </label>
        <input
          type={lookupType === "email" ? "email" : "tel"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            lookupType === "email" ? "you@example.com" : "+1 555 123 4567"
          }
          disabled={status.type === "success"}
          className="mt-2 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-3 text-sm text-[#3b1a1f] placeholder:text-[#b08b6b] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />

        {status.type !== "success" && (
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="mt-4 rounded-full bg-[#d8792d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
          >
            {status.type === "loading"
              ? "Sending..."
              : lookupType === "email"
                ? "Email me confirmation"
                : "Send WhatsApp info"}
          </button>
        )}

        {status.type === "error" ? (
          <p className="mt-3 text-sm text-red-700">{status.message}</p>
        ) : null}

        <p className="mt-4 text-xs text-[#8a5b44]">
          We only send event-related confirmation details. If your email/phone
          is not registered, you won&apos;t receive anything.
        </p>
      </div>
    </div>
  );
}
