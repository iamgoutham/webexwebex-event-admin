"use client";

import { useMemo, useState } from "react";
import {
  joinLookupAction,
  type JoinCandidate,
} from "./actions";

export default function JoinClient({
  alternateLink = null,
}: {
  alternateLink?: string | null;
}) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [candidates, setCandidates] = useState<JoinCandidate[]>([]);
  const [selectedName, setSelectedName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const canSearch = useMemo(
    () => phone.trim().length >= 7 && status !== "loading",
    [phone, status],
  );

  const selected = candidates.find((c) => c.name === selectedName) ?? null;

  const onSearch = async () => {
    if (!canSearch) return;
    setStatus("loading");
    setSelectedName("");
    setError(null);
    try {
      const data = await joinLookupAction(phone.trim());
      if (data.ok) {
        setCandidates(data.candidates);
      } else {
        setCandidates([]);
        setError(data.error);
      }
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Join your Webex meeting</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Enter your WhatsApp number to find your registered name and meeting
          link.
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
          className="mt-2 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-3 text-sm text-[#3b1a1f] placeholder:text-[#b08b6b] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={!canSearch}
          className="mt-4 rounded-full bg-[#d8792d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
        >
          {status === "loading" ? "Searching..." : "Find my meeting"}
        </button>

        {error ? (
          <p className="mt-4 text-sm text-[#8b2d2d]" role="alert">
            {error}
          </p>
        ) : null}

        {candidates.length > 0 ? (
          <div className="mt-6 rounded-xl border border-[#ead2ae] bg-white p-4">
            <p className="text-sm font-semibold text-[#3b1a1f]">
              Select your name to join your assigned meeting (अपनी निर्धारित मीटिंग में शामिल होने के लिए अपना नाम चुनें)
            </p>
            <div className="mt-3 space-y-2">
              {candidates.map((candidate) => (
                <label
                  key={candidate.name}
                  className="flex items-center gap-2 text-sm text-[#3b1a1f]"
                >
                  <input
                    type="radio"
                    name="join-name"
                    value={candidate.name}
                    checked={selectedName === candidate.name}
                    onChange={() => {
                      setSelectedName(candidate.name);
                      window.open(candidate.joinLink, "_blank", "noopener,noreferrer");
                    }}
                  />
                  <span>{candidate.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="mt-4 rounded-xl border border-[#b7e0c4] bg-[#eefaf2] p-4 text-sm text-[#1f6b4a]">
            <p className="font-semibold">Webex join link</p>
            <a
              href={selected.joinLink}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all underline underline-offset-2"
            >
              {selected.joinLink}
            </a>
          </div>
        ) : null}
      </div>

      {alternateLink ? (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#3b1a1f]">
            Alternate link
          </h2>
          <a
            href={alternateLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-sm font-medium text-[#8a2f2a] underline underline-offset-2"
          >
            {alternateLink}
          </a>
        </div>
      ) : null}
    </div>
  );
}
