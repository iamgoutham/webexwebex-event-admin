"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Confetti from "./confetti";
import { certificateLookupAction, correctNameAction } from "./actions";
import type {
  CertificateCandidate,
  CertificateLookupMode,
} from "@/lib/certificate-lookup";

const SUPPORT_EMAIL = "cgs@chinmayavrindavan.org";
const SUPPORT_WHATSAPP = "+91 89768 84787";
/** wa.me needs the number in full international form with no spaces or plus. */
const SUPPORT_WHATSAPP_URL = "https://wa.me/918976884787";

/** Regeneration usually finishes in well under a second; poll briefly, then stop. */
const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 20;

/**
 * How to reach a human. Shown when a lookup finds nothing — a participant who
 * cannot remember either the number or the email they registered with has no way
 * forward on their own — and again at the foot of the page.
 */
function SupportContact({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-[#3b1a1f]">
        Can&apos;t find your registration? We can help.
      </p>
      <p className="text-sm text-[#6b4e3d]">
        अपना पंजीकरण नहीं मिल रहा? हमसे संपर्क करें।
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[#6b4e3d]">
        <li>
          Email / ईमेल:{" "}
          <a
            className="font-medium text-[#8a2f2a] underline underline-offset-2"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              "Gita Samarpanam certificate — cannot find my registration",
            )}`}
          >
            {SUPPORT_EMAIL}
          </a>
        </li>
        <li>
          WhatsApp / व्हाट्सएप:{" "}
          <a
            className="font-medium text-[#8a2f2a] underline underline-offset-2"
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            {SUPPORT_WHATSAPP}
          </a>
        </li>
      </ul>
      <p className="mt-2 text-xs text-[#6b4e3d]">
        Please include the name you registered with, so we can find you.
        <span className="mt-0.5 block">
          कृपया वह नाम बताएं जिससे आपने पंजीकरण किया था।
        </span>
      </p>
    </div>
  );
}

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
  const [savedCount, setSavedCount] = useState(0);

  const [pollsLeft, setPollsLeft] = useState(0);
  /** Latest searched contact, so the poller never races a newer search. */
  const searchRef = useRef({ mode: searchedMode, contact: searchedContact });
  searchRef.current = { mode: searchedMode, contact: searchedContact };

  const awaitingRegeneration = useMemo(
    () => candidates.some((c) => c.regenerationPending),
    [candidates],
  );

  const refresh = useCallback(async () => {
    const { mode: m, contact: c } = searchRef.current;
    if (!c) return;
    const data = await certificateLookupAction(m, c);
    // Ignore a response that arrived after the user searched for someone else.
    if (data.ok && searchRef.current.contact === c) setCandidates(data.candidates);
  }, []);

  // Poll while a regeneration is outstanding so the corrected certificate appears
  // without the participant having to search again.
  useEffect(() => {
    if (!awaitingRegeneration || pollsLeft <= 0) return;
    const timer = setTimeout(() => {
      setPollsLeft((n) => n - 1);
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [awaitingRegeneration, pollsLeft, refresh]);

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
    setSavedCount(0);
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
        searchRef.current = { mode, contact: value };
        // Someone returning to collect a corrected certificate should see it
        // appear without searching a third time.
        setPollsLeft(
          data.candidates.some((c) => c.regenerationPending) ? POLL_ATTEMPTS : 0,
        );
      } else {
        setCandidates([]);
        setError(data.error);
        setPollsLeft(0);
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
        setSavedCount(res.updated);
        setPollsLeft(POLL_ATTEMPTS);
      } else {
        setCorrectionError(res.error);
      }
    } finally {
      setSavingEntryId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-[#3b1a1f]">
      <Confetti />

      {/* The achievement first — the certificate is the proof of it. */}
      <div className="rounded-3xl border border-[#c9a227] bg-[#101f3c] p-6 text-[#fdf6e9] shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#e3c46a]">
          Officially Amazing
        </p>
        {/* Short on purpose: the paragraphs below carry the record title, the
            count and the thanks, so the heading only has to celebrate. */}
        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
          We did it together
        </h1>
        <p className="mt-3 text-sm text-[#d5dbea] md:text-base">
          On May 9th, 2026, Chinmaya Mission set a new Guinness World
          Record&trade; for{" "}
          <strong className="text-white">
            &ldquo;Most people chanting online simultaneously - 8277&rdquo;
          </strong>
        </p>
        <p className="mt-3 text-sm text-[#d5dbea] md:text-base">
          That historic day, nearly 32,000 devotees successfully logged in across
          hundreds of Webex meetings and chanted Chapter 15 of the Bhagavad Gita
          as one family!
        </p>
        <p className="mt-3 text-sm text-[#d5dbea] md:text-base">
          This record belongs to EACH ONE OF YOU who joined. Thank you for making
          history with us!
        </p>
        <p className="mt-3 text-sm text-[#d5dbea] md:text-base">
          🎉 Every participant can now download their official participation
          certificate with your name on it — just look yourself up below.
        </p>
        <p className="mt-3 text-sm text-[#b9c2d6]">
          9 मई 2026 को चिन्मय मिशन ने &ldquo;एक साथ ऑनलाइन जप करने वाले सबसे अधिक
          लोग — 8277&rdquo; का नया गिनीज़ विश्व रिकॉर्ड बनाया। यह रिकॉर्ड आप सभी का
          है — नीचे अपना प्रमाणपत्र प्राप्त करें।
        </p>
      </div>

      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h2 className="text-2xl font-semibold">
          Download your certificate
          <span className="mt-1 block text-base font-medium text-[#6b4e3d]">
            अपना प्रमाणपत्र डाउनलोड करें
          </span>
        </h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Look yourself up with your registered phone number — or your registered
          email if you don&apos;t remember the number — to generate a link to your
          PDF certificate.
        </p>
        <p className="mt-1 text-sm text-[#6b4e3d]">
          अपने पंजीकृत फ़ोन नंबर से खोजें — या यदि नंबर याद न हो तो अपने पंजीकृत
          ईमेल पते से।
        </p>

        {/* Sample of the certificate, so participants can see what they are
            collecting before they enter a phone number. It opens full size
            because the landscape artwork is small on a phone screen. */}
        <figure className="mt-5">
          <a
            href="/images/sample-certificate.png"
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d8792d]"
          >
            <Image
              src="/images/sample-certificate.png"
              alt="Sample Guinness World Records participation certificate, with the participant's name shown as 'Your Name'"
              width={1200}
              height={848}
              className="h-auto w-full rounded-xl border border-[#e5c18e] shadow-md transition hover:shadow-lg"
              priority
            />
          </a>
          <figcaption className="mt-2 text-center text-xs text-[#6b4e3d]">
            A sample certificate — yours will carry your registered name. Tap to
            view full size.
            <span className="mt-0.5 block">
              नमूना प्रमाणपत्र — पूरा आकार देखने के लिए टैप करें।
            </span>
          </figcaption>
        </figure>
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
              {m === "phone" ? "Phone number / फ़ोन नंबर" : "Email / ईमेल"}
            </button>
          ))}
        </div>

        <label
          htmlFor="certificate-contact"
          className="mt-4 block text-sm font-semibold text-[#3b1a1f]"
        >
          {mode === "phone"
            ? "Registered phone number / पंजीकृत फ़ोन नंबर"
            : "Registered email address / पंजीकृत ईमेल पता"}
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
          {status === "loading"
            ? "Searching..."
            : "Find my certificate / मेरा प्रमाणपत्र खोजें"}
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
            <p className="mt-1">
              इस {searchedMode === "phone" ? "फ़ोन नंबर" : "ईमेल पते"} के लिए कोई
              पंजीकरण नहीं मिला।
            </p>
            <p className="mt-2">
              {searchedMode === "phone"
                ? "If you registered with a different number, try searching by email address instead."
                : "If you registered with a different email, try searching by phone number instead."}
            </p>
            <p className="mt-1">
              {searchedMode === "phone"
                ? "यदि आपने किसी दूसरे नंबर से पंजीकरण किया था, तो ईमेल पते से खोजें।"
                : "यदि आपने किसी दूसरे ईमेल से पंजीकरण किया था, तो फ़ोन नंबर से खोजें।"}
            </p>
            <SupportContact className="mt-3 border-t border-[#f0e0c6] pt-3" />
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold text-[#3b1a1f]">
              {candidates.length === 1
                ? "We found your registration / आपका पंजीकरण मिला"
                : `We found ${candidates.length} registrations / ${candidates.length} पंजीकरण मिले`}
            </p>

            {/* Shown once the registration is found and before the download
                button, so it is read rather than scrolled past. */}
            <div className="rounded-xl border border-[#c9a227] bg-[#fff4df] p-4">
              <p className="text-sm font-semibold text-[#3b1a1f]">
                Your certificate is free — your support keeps this work going
              </p>
              <p className="mt-1 text-sm text-[#6b4e3d]">
                If the Gita Samarpanam meant something to you, please consider a
                contribution to Chinmaya Mission before you download.
              </p>
              <p className="mt-1 text-sm text-[#6b4e3d]">
                यदि गीता समर्पणम् आपके लिए विशेष रहा, तो कृपया डाउनलोड करने से पहले
                चिन्मय मिशन को सहयोग देने पर विचार करें।
              </p>
              {/* Two currencies, side by side: participants are spread across
                  India and the diaspora, and each gateway takes only its own. */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <a
                  href="https://www.chinmayamission.com/global/donation/chinmaya-gita-samarpanam"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[#8a2f2a] px-5 py-2.5 text-center text-sm font-semibold text-[#fff9ef] shadow-md transition hover:bg-[#722825]"
                >
                  Donate in ₹ (INR) / भारत से सहयोग करें
                </a>
                <a
                  href="https://cmw.chinmaya75.org/donations/cm-gita-samarpanam/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[#8a2f2a] px-5 py-2.5 text-center text-sm font-semibold text-[#fff9ef] shadow-md transition hover:bg-[#722825]"
                >
                  Donate in US$ / अमेरिका से सहयोग करें
                </a>
              </div>
            </div>

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
                  {/* The registration id is deliberately not shown. Ids look like
                      "128.00", and next to a name directly below a donation ask
                      one participant read it as an amount they owed. It is
                      internal, means nothing to them, and stays in the markup
                      only as the React key and the correction target. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-[#3b1a1f]">
                      {hasName ? (
                        candidate.name
                      ) : (
                        // Case 1: no name on record for this registration.
                        <span className="text-[#8b2d2d]">
                          No name on record / नाम दर्ज नहीं है
                        </span>
                      )}
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
                      <span className="font-semibold">
                        Name saved
                        {savedCount > 1
                          ? ` across all ${savedCount} of your registrations`
                          : ""}
                        .
                      </span>{" "}
                      Your certificate now has to be prepared again with the
                      corrected name, which takes a little time. Please come
                      back later and search again — the new certificate will be
                      ready for download here.
                      <span className="mt-1 block">
                        नाम सहेज लिया गया। नया प्रमाणपत्र तैयार होने में कुछ समय लगेगा —
                        कृपया बाद में दोबारा खोजें।
                      </span>
                    </p>
                  ) : null}

                  {candidate.regenStatus === "failed" ? (
                    <p className="mt-2 rounded-lg bg-[#fdecec] px-3 py-2 text-xs text-[#8b2d2d]">
                      <span className="font-semibold">
                        We could not prepare your corrected certificate.
                      </span>{" "}
                      Please email{" "}
                      <a
                        className="underline underline-offset-2"
                        href={`mailto:${SUPPORT_EMAIL}`}
                      >
                        {SUPPORT_EMAIL}
                      </a>{" "}
                      or WhatsApp{" "}
                      <a
                        className="underline underline-offset-2"
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {SUPPORT_WHATSAPP}
                      </a>{" "}
                      and we will sort it out for you.
                    </p>
                  ) : candidate.regenerationPending && !justSaved ? (
                    <p className="mt-2 rounded-lg bg-[#fff4df] px-3 py-2 text-xs text-[#8a5a2a]">
                      <span className="font-semibold">
                        Your corrected certificate is still being prepared.
                      </span>{" "}
                      This page will update on its own in a few moments — you can
                      also come back and search again later.
                      <span className="mt-1 block">
                        आपका सुधारा हुआ प्रमाणपत्र तैयार हो रहा है — कृपया थोड़ी देर
                        प्रतीक्षा करें।
                      </span>
                      {candidate.downloadUrl
                        ? " The copy below was made before your correction, so it still shows your earlier name."
                        : ""}
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
                        Download certificate (PDF) / प्रमाणपत्र डाउनलोड करें
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
                      <span className="mt-0.5 block">
                        इस पंजीकरण के लिए अभी प्रमाणपत्र उपलब्ध नहीं है।
                      </span>
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
                        </a>{" "}
                        or WhatsApp{" "}
                        <a
                          className="underline underline-offset-2"
                          href={SUPPORT_WHATSAPP_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {SUPPORT_WHATSAPP}
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
                          You can do this only once, so please check the
                          spelling carefully before saving. If you registered
                          more than once, all of your registrations are updated
                          together. Your certificate then has to be prepared
                          again with the new name, which takes a little time —
                          you will need to come back later to download it.
                          <span className="mt-1 block">
                            नाम केवल एक बार बदला जा सकता है। नया प्रमाणपत्र बनने में
                            कुछ समय लगेगा — कृपया बाद में आकर डाउनलोड करें।
                          </span>
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
                            {isSaving ? "Saving..." : "Save name / नाम सहेजें"}
                          </button>
                          <button
                            type="button"
                            onClick={resetCorrectionState}
                            disabled={isSaving}
                            className="rounded-full border border-[#e5c18e] px-4 py-1.5 text-xs font-semibold text-[#6b4e3d] transition hover:bg-[#fff4df]"
                          >
                            Cancel / रद्द करें
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
                          ? "This name is wrong — correct it (once) / यह नाम ग़लत है — इसे सुधारें (केवल एक बार)"
                          : "Add my name / मेरा नाम जोड़ें"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Placed after the form so it celebrates without pushing the search box
          further down a phone screen. */}
      <figure className="overflow-hidden rounded-2xl border border-[#e5c18e] bg-[#fff9ef] shadow-sm">
        <Image
          src="/images/msc-participants.jpg"
          alt="Chinmaya Mission members gathered outside the Chinmaya Amrit Mahotsav, holding the Guinness World Records certificate"
          width={1600}
          height={1067}
          sizes="(max-width: 768px) 100vw, 42rem"
          className="h-auto w-full"
        />
        <figcaption className="px-5 py-4 text-sm text-[#6b4e3d]">
          Receiving the GUINNESS WORLD RECORDS&trade; certificate at the Chinmaya
          Amrit Mahotsav — on behalf of every one of the 8,277 people who chanted
          together.
          <span className="mt-1 block">
            चिन्मय अमृत महोत्सव में गिनीज़ वर्ल्ड रिकॉर्ड्स प्रमाणपत्र प्राप्त करते
            हुए — उन सभी 8,277 प्रतिभागियों की ओर से।
          </span>
        </figcaption>
      </figure>

      {/* Always reachable, not only after a failed search. */}
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-6 shadow-sm">
        <SupportContact />
      </div>
    </div>
  );
}
