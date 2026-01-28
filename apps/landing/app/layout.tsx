import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SierraMCP - AI for Your Business Systems, No Engineering Required",
  description:
    "Connect QuickBooks, Shopify, and more to Slack. Ask questions in plain English, get instant answers. Deploy in days, not months.",
  openGraph: {
    title: "SierraMCP - AI Where Your Teams Already Work",
    description: "Making AI accessible—no engineering required.",
    type: "website",
    url: "https://www.sierramcp.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "SierraMCP - AI Where Your Teams Already Work",
    description: "Making AI accessible—no engineering required.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
