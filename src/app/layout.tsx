import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Webex Event Admin",
  description: "Multi-tenant admin console for Webex events",
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
        <div className="min-h-screen bg-[#f9f1e1] text-[#2b1f13]">
          <SiteHeader />
          <main className="mx-auto mt-4 w-full max-w-6xl px-4 py-8 sm:mt-6 sm:px-6 sm:py-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
