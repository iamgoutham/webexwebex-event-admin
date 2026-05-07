"use client";

import { useMemo, useState } from "react";
import { findMeetingLinkAction } from "./actions";

export default function FindameetingClient() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSearch = useMemo(
    () => phone.trim().length > 0 && status !== "loading",
    [phone, status],
  );

  const onSearch = async () => {
    if (!canSearch) return;
    setStatus("loading");
    setError(null);
    setLink(null);
    try {
      const data = await findMeetingLinkAction(phone.trim());
      if (data.ok) {
        setLink(data.link);
        return;
      }
      setError(data.error || "Something went wrong. Please try again.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Find a meeting</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Having trouble joining your session?
        </p>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          If your meeting has not started on time (7:30pm India / 10am ET ),
          please enter your WhatsApp number below to receive an alternate meeting
          link for the trial session.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 shadow-sm">
        <label className="block text-sm font-semibold text-[#3b1a1f]">
          WhatsApp phone number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 123 4567"
          required
          aria-required="true"
          className="mt-2 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-3 text-sm text-[#3b1a1f] placeholder:text-[#b08b6b] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={!canSearch}
          className="mt-4 rounded-full bg-[#d8792d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
        >
          {status === "loading" ? "Looking up…" : "Get meeting link"}
        </button>

        {error ? (
          <p className="mt-4 text-sm text-[#8b2d2d]" role="alert">
            {error}
          </p>
        ) : null}

        {link ? (
          <div className="mt-4 rounded-xl border border-[#b7e0c4] bg-[#eefaf2] p-4 text-sm text-[#1f6b4a]">
            <p className="font-semibold">Your link</p>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all underline underline-offset-2"
            >
              {link}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
