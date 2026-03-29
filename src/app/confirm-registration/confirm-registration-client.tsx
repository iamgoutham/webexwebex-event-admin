"use client";

import { useEffect, useMemo, useState } from "react";

export default function ConfirmRegistrationClient({
  siteKey,
}: {
  siteKey: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "success"; message: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const [token, setToken] = useState<string>("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      email.trim().length > 3 &&
      status.type !== "loading"
    );
  }, [email, status.type]);

  const resetForm = () => {
    setEmail("");
    setToken("");
    setStatus({ type: "idle" });
    setCaptchaKey((k) => k + 1);
    setCaptchaError(null);
  };

  const submit = async () => {
    setStatus({ type: "loading" });
    try {
      // Prefer the latest token directly from Turnstile if available.
      let captchaToken = token;
      if (typeof window !== "undefined" && (window as any).turnstile?.getResponse) {
        const resp = (window as any).turnstile.getResponse();
        if (typeof resp === "string" && resp.trim()) {
          captchaToken = resp.trim();
          setToken(captchaToken);
        }
      }

      const res = await fetch("/api/public/confirm-registration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          captchaToken,
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
          "If your email is registered, you will receive a confirmation email shortly.",
      });
      setEmail("");
      setToken("");
      setCaptchaKey((k) => k + 1);
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
            Enter your registration email address. If it matches a valid
            participant (or host):
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              If you are a participant we will email you a confirmation of your
              registration and your host contact details.
            </li>
            <li>
              If you are a host we will email you a confirmation and your
              participant details.
            </li>
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
              Send another confirmation email
            </button>
          </div>
        ) : null}

        <label className="block text-sm font-semibold text-[#3b1a1f]">
          Email address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status.type === "success"}
          className="mt-2 w-full rounded-xl border border-[#e5c18e] bg-white px-4 py-3 text-sm text-[#3b1a1f] placeholder:text-[#b08b6b] focus:border-[#d8792d] focus:outline-none focus:ring-1 focus:ring-[#d8792d]"
        />

        <div className="mt-4">
          {siteKey ? (
            <>
              <script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                async
                defer
              />
              <div
                key={captchaKey}
                className="cf-turnstile"
                data-sitekey={siteKey}
                data-callback="turnstileCallback"
                data-error-callback="turnstileErrorCallback"
              />
              <script
                dangerouslySetInnerHTML={{
                  __html: `
                    window.turnstileCallback = function (t) {
                      window.dispatchEvent(new CustomEvent('turnstile-token', { detail: t }));
                    };
                    window.turnstileErrorCallback = function (code) {
                      window.dispatchEvent(new CustomEvent('turnstile-error', { detail: code }));
                    };
                  `,
                }}
              />
            </>
          ) : (
            <p className="text-xs text-red-700">
              Captcha is not configured. Please try again later.
            </p>
          )}
        </div>

        <TurnstileTokenListener onToken={setToken} />
        <TurnstileErrorListener onError={setCaptchaError} />

        {status.type !== "success" && (
          <button
            type="button"
            onClick={submit}
            disabled={!siteKey || !canSubmit || !!captchaError}
            className="mt-4 rounded-full bg-[#d8792d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
          >
            {status.type === "loading" ? "Sending…" : "Email me confirmation"}
          </button>
        )}

        {status.type === "error" ? (
          <p className="mt-3 text-sm text-red-700">{status.message}</p>
        ) : null}

        {captchaError && (
          <p className="mt-2 text-xs text-red-700">
            The verification test could not be completed (error {captchaError}).
            Please reload the page and try again. If this keeps happening, try a
            different browser or network.
          </p>
        )}

        <p className="mt-4 text-xs text-[#8a5b44]">
          We only send event-related confirmation details. If your email is not
          registered, you won&apos;t receive anything.
        </p>
      </div>
    </div>
  );
}

function TurnstileTokenListener({ onToken }: { onToken: (t: string) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") onToken(detail);
    };
    window.addEventListener("turnstile-token", handler as EventListener);
    return () =>
      window.removeEventListener("turnstile-token", handler as EventListener);
  }, [onToken]);

  return null;
}

function TurnstileErrorListener({ onError }: { onError: (code: string | null) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") onError(detail);
      else onError("unknown");
    };
    window.addEventListener("turnstile-error", handler as EventListener);
    return () =>
      window.removeEventListener("turnstile-error", handler as EventListener);
  }, [onError]);

  return null;
}

