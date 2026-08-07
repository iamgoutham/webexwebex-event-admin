"use client";

import { useMemo, useState } from "react";
import { certificateLookupAction, correctNameAction } from "./actions";
import type {
  CertificateCandidate,
  CertificateLookupMode,
} from "@/lib/certificate-lookup";

const SUPPORT_EMAIL = "cgs@chinmayavrindavan.org";

export default function CertificateClient() {
  const [mode, setMode] = useState<CertificateLookupMode>("phone");
  const [contact, setContact] = useState("");
  /** The contact the current results belong to — corrections must reuse it. */
  const [searchedContact, setSearchedContact] = useState("");
  const [searchedMode, setSearchedMode] = useState<CertificateLookupMode>("phone");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [candidates, setCandidates] = useState<CertificateCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Name-correction sub-form state, keyed by entryId.
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const canSearch = useMemo(() => {
    if (status === "loading") return false;
    const v = contact.trim();
    return mode === "email" ? v.includes("@") && v.length >= 5 : v.length >= 7;
  }, [contact, mode, status]);

  const resetCorrectionState = () => {
    setEditingEntryId(null);
    setDraftName("");
    setCorrectionError(null);
    setSavedEntryId(null);
  };

  const onSearch = async () => {
    if (!canSearch) return;
    setStatus("loading");
    setError(null);
    resetCorrectionState();
    const value = contact.trim();
    try {
      const data = await certificateLookupAction(mode, value);
      if (data.ok) {
        setCandidates(data.candidates);
        setSearchedContact(value);
        setSearchedMode(mode);
      } else {
        setCandidates([]);
        setError(data.error);
      }
    } finally {
      setSearched(true);
      setStatus("idle");
    }
  };

  const onSaveName = async (entryId: string) => {
    const name = draftName.trim();
    if (name.length < 2) {
      setCorrectionError("Enter your full name (at least 2 characters).");
      return;
    }
    setSavingEntryId(entryId);
    setCorrectionError(null);
    try {
      const res = await correctNameAction(
        searchedMode,
        searchedContact,
        entryId,
        name,
      );
      if (res.ok) {
        setCandidates(res.candidates);
        setEditingEntryId(null);
        setDraftName("");
        setSavedEntryId(entryId);
      } else {
        setCorrectionError(res.error);
      }
    } finally {
      setSavingEntryId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Download your certificate</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Look yourself up with your registered phone number — or your registered
          email if you don&apos;t remember the number — to generate a link to your
          PDF certificate. The link stays valid for one week; if it expires, come
          back and generate a new one.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 shadow-sm">
        {/* Case 3: look up by email when the phone number is forgotten. */}
        <div className="flex gap-2" role="group" aria-label="Search by">
          {(["phone", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setContact("");
                setError(null);
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                mode === m
                  ? "bg-[#d8792d] text-white"
                  : "border border-[#e5c18e] bg-white text-[#6b4e3d] hover:bg-[#fff4df]"
              }`}
            >
              {m === "phone" ? "Phone number" : "Email address"}
            </button>
          ))}
        </div>

        <label
          htmlFor="certificate-contact"
          className="mt-4 block text-sm font-semibold text-[#3b1a1f]"
        >
          {mode === "phone" ? "Registered phone number" : "Registered email address"}
        </label>
        <input
          id="certificate-contact"
          type={mode === "phone" ? "tel" : "email"}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          placeholder={mode === "phone" ? "+91 99807 28942" : "you@example.com"}
          className="mt-2 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-3 text-sm text-[#3b1a1f] placeholder:text-[#b08b6b] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={!canSearch}
          className="mt-4 rounded-full bg-[#d8792d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
        >
          {status === "loading" ? "Searching..." : "Find my certificate"}
        </button>

        {error ? (
          <p className="mt-4 text-sm text-[#8b2d2d]" role="alert">
            {error}
          </p>
        ) : null}

        {searched && !error && candidates.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#ead2ae] bg-white p-4 text-sm text-[#6b4e3d]">
            <p>
              No registration was found for that{" "}
              {searchedMode === "phone" ? "phone number" : "email address"}.
            </p>
            <p className="mt-2">
              {searchedMode === "phone"
                ? "If you registered with a different number, try searching by email address instead."
                : "If you registered with a different email, try searching by phone number instead."}{" "}
              Still stuck? Email{" "}
              <a
                className="underline underline-offset-2"
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold text-[#3b1a1f]">
              {candidates.length === 1
                ? "We found your registration"
                : `We found ${candidates.length} registrations`}
            </p>

            {candidates.map((candidate) => {
              const isEditing = editingEntryId === candidate.entryId;
              const isSaving = savingEntryId === candidate.entryId;
              const justSaved = savedEntryId === candidate.entryId;
              const hasName = candidate.name.trim().length > 0;

              return (
                <div
                  key={candidate.entryId}
                  className="rounded-xl border border-[#ead2ae] bg-white p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-[#3b1a1f]">
                      {hasName ? (
                        candidate.name
                      ) : (
                        // Case 1: no name on record for this registration.
                        <span className="text-[#8b2d2d]">
                          No name on record
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-xs text-[#b08b6b]">
                      {candidate.entryId}
                    </p>
                  </div>

                  {!hasName ? (
                    <p className="mt-1 text-xs text-[#6b4e3d]">
                      We don&apos;t have a name for this registration, so no
                      certificate could be printed. Add your name below and your
                      certificate will be prepared.
                    </p>
                  ) : null}

                  {justSaved ? (
                    <p className="mt-2 rounded-lg bg-[#eefaf2] px-3 py-2 text-xs text-[#1f6b4a]">
                      Name saved. Your certificate is being prepared with the
                      corrected name — please check back later to download it.
                    </p>
                  ) : null}

                  {candidate.regenerationPending && !justSaved ? (
                    <p className="mt-2 rounded-lg bg-[#fff4df] px-3 py-2 text-xs text-[#8a5a2a]">
                      Your certificate is being updated with your corrected name.
                      {candidate.downloadUrl
                        ? " The copy below still shows the earlier name."
                        : " Please check back later."}
                    </p>
                  ) : null}

                  {/* Download — only when a certificate has been generated. */}
                  {candidate.downloadUrl ? (
                    <div className="mt-3">
                      <a
                        href={candidate.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425]"
                      >
                        Download certificate (PDF)
                      </a>
                      {candidate.expiresAt ? (
                        <p className="mt-2 text-xs text-[#6b4e3d]">
                          This link expires on{" "}
                          {new Date(candidate.expiresAt).toLocaleString()}.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[#6b4e3d]">
                      No certificate is available for this registration yet.
                    </p>
                  )}

                  {/* Case 1 + 2: supply or correct the name, once. */}
                  <div className="mt-3 border-t border-[#f0e0c6] pt-3">
                    {candidate.nameChangeUsed ? (
                      <p className="text-xs text-[#6b4e3d]">
                        The one-time name change for this registration has
                        already been used. For any further correction, please
                        email{" "}
                        <a
                          className="underline underline-offset-2"
                          href={`mailto:${SUPPORT_EMAIL}`}
                        >
                          {SUPPORT_EMAIL}
                        </a>
                        .
                      </p>
                    ) : isEditing ? (
                      <div>
                        <label
                          htmlFor={`name-${candidate.entryId}`}
                          className="block text-xs font-semibold text-[#3b1a1f]"
                        >
                          Name as it should appear on the certificate
                        </label>
                        <input
                          id={`name-${candidate.entryId}`}
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          maxLength={100}
                          className="mt-1 w-full rounded-lg border border-[#e5c18e] bg-white px-3 py-2 text-sm focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
                        />
                        <p className="mt-1 text-xs text-[#8a5a2a]">
                          You can do this only once. Please check the spelling
                          carefully before saving.
                        </p>
                        {correctionError ? (
                          <p
                            className="mt-1 text-xs text-[#8b2d2d]"
                            role="alert"
                          >
                            {correctionError}
                          </p>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => onSaveName(candidate.entryId)}
                            disabled={isSaving}
                            className="rounded-full bg-[#d8792d] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
                          >
                            {isSaving ? "Saving..." : "Save name"}
                          </button>
                          <button
                            type="button"
                            onClick={resetCorrectionState}
                            disabled={isSaving}
                            className="rounded-full border border-[#e5c18e] px-4 py-1.5 text-xs font-semibold text-[#6b4e3d] transition hover:bg-[#fff4df]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntryId(candidate.entryId);
                          setDraftName(candidate.name);
                          setCorrectionError(null);
                          setSavedEntryId(null);
                        }}
                        className="text-xs font-semibold text-[#8a2f2a] underline underline-offset-2"
                      >
                        {hasName
                          ? "This name is wrong — correct it (once)"
                          : "Add my name"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
