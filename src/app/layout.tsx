import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Absolute base for share previews. WhatsApp and other scrapers cannot resolve
 * relative image paths, and previews should point at one canonical host whichever
 * domain the page was opened on, so this is fixed rather than read per request.
 */
const SITE_URL = new URL("https://webex-usa.chinmayavrindavan.org");

const SITE_NAME = "Chinmaya Gita Samarpanam";
const SITE_DESCRIPTION =
  "Chinmaya Gita Samarpanam — chanting information, meeting links, and participation certificates for participants and hosts.";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: "/CMW-lamp-logo-1.png", width: 500, height: 500 }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/CMW-lamp-logo-1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#f9f1e1] text-[#2b1f13] antialiased`}
      >
        <div className="flex min-h-screen flex-col bg-[#f9f1e1] text-[#2b1f13]">
          <SiteHeader />
          <main className="mx-auto mt-4 w-full max-w-6xl flex-1 px-4 py-8 sm:mt-6 sm:px-6 sm:py-10">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
