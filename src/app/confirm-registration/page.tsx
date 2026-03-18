import ConfirmRegistrationClient from "./confirm-registration-client";

export default function ConfirmRegistrationPage() {
  // Read at request-time (server component), not build-time.
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  return <ConfirmRegistrationClient siteKey={siteKey} />;
}

