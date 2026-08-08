import type { Metadata } from "next";
import CertificateClient from "./certificate-client";

export const dynamic = "force-dynamic";

const TITLE = "Download your certificate — Chinmaya Gita Samarpanam";
const DESCRIPTION =
  "Collect your GUINNESS WORLD RECORDS™ participation certificate. On 9 May 2026, 8,277 people chanted online simultaneously — the most ever.";

/**
 * This page is shared directly on WhatsApp, so it carries its own preview: the
 * sample certificate reads far better in a chat than the site logo.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    // Page-level openGraph replaces the layout's rather than merging into it,
    // so the site name is repeated here to keep it in the share preview.
    siteName: "Chinmaya Gita Samarpanam Website",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/images/sample-certificate.png",
        width: 1200,
        height: 848,
        alt: "Guinness World Records participation certificate",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/images/sample-certificate.png"],
  },
};

export default function CertificatePage() {
  return <CertificateClient />;
}
