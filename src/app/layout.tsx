import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader from "@/components/site-header";
import Providers from "@/app/providers";
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
        className={`${geistSans.variable} ${geistMono.variable} bg-black text-white antialiased`}
      >
        <Providers>
          <div className="min-h-screen bg-black text-white">
            <SiteHeader />
            <main className="mx-auto w-full max-w-6xl px-6 py-10">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
