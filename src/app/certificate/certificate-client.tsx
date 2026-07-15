"use client";

import { useMemo, useState } from "react";
import {
  certificateLookupAction,
  type CertificateCandidate,
} from "./actions";

export default function CertificateClient() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [candidates, setCandidates] = useState<CertificateCandidate[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = useMemo(
    () => phone.trim().length >= 7 && status !== "loading",
    [phone, status],
  );

  const selected =
    candidates.find((c) => c.downloadUrl === selectedUrl) ?? null;

  const onSearch = async () => {
    if (!canSearch) return;
    setStatus("loading");
    setSelectedUrl("");
    setError(null);
    try {
      const data = await certificateLookupAction(phone.trim());
      if (data.ok) {
        setCandidates(data.candidates);
      } else {
        setCandidates([]);
        setError(data.error);
      }
    } finally {
      setSearched(true);
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Download your certificate</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Enter your registered phone number to generate a link to download your
          PDF certificate. The link stays valid for one week — if it expires,
          just come back and generate a new one.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 shadow-sm">
        <label className="block text-sm font-semibold text-[#3b1a1f]">
          Phone number
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
          {status === "loading" ? "Generating..." : "Generate download link"}
        </button>

        {error ? (
          <p className="mt-4 text-sm text-[#8b2d2d]" role="alert">
            {error}
          </p>
        ) : null}

        {searched && !error && candidates.length === 0 ? (
          <p className="mt-4 text-sm text-[#6b4e3d]">
            No certificate was found for this phone number. Please check the
            number you registered with.
          </p>
        ) : null}

        {candidates.length > 0 ? (
          <div className="mt-6 rounded-xl border border-[#ead2ae] bg-white p-4">
            <p className="text-sm font-semibold text-[#3b1a1f]">
              Select your name to download your certificate
            </p>
            <div className="mt-3 space-y-2">
              {candidates.map((candidate, idx) => (
                <label
                  key={`${candidate.downloadUrl}-${idx}`}
                  className="flex items-center gap-2 text-sm text-[#3b1a1f]"
                >
                  <input
                    type="radio"
                    name="certificate-name"
                    value={candidate.downloadUrl}
                    checked={selectedUrl === candidate.downloadUrl}
                    onChange={() => {
                      setSelectedUrl(candidate.downloadUrl);
                      window.open(
                        candidate.downloadUrl,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  />
                  <span>{candidate.name || "—"}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="mt-4 rounded-xl border border-[#b7e0c4] bg-[#eefaf2] p-4 text-sm text-[#1f6b4a]">
            <p className="font-semibold">Your certificate download link</p>
            <a
              href={selected.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all underline underline-offset-2"
            >
              Download certificate (PDF)
            </a>
            <p className="mt-2 text-xs text-[#3f7a5c]">
              This link expires on{" "}
              {new Date(selected.expiresAt).toLocaleString()}.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
