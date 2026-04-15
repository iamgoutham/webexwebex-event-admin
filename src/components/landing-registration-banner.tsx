import { getLandingRegistrationBannerMessage } from "@/lib/landing-banner-message";
import ScrollingRegistrationBannerClient from "@/components/scrolling-registration-banner-client";

/**
 * Message: env `LANDING_REGISTRATION_BANNER`, or file via
 * `LANDING_REGISTRATION_BANNER_FILE`, or `public/landing-registration-banner.txt`
 * (editable on the server without rebuilding).
 */
export default async function LandingRegistrationBanner() {
  const message = await getLandingRegistrationBannerMessage();
  if (!message) {
    return null;
  }

  return <ScrollingRegistrationBannerClient message={message} />;
}
