import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "GPTfy Agent Generator",
  description:
    "Connect Salesforce, validate GPTfy agentic metadata, and draft agent specs from your use case.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">
            {children}
          </main>
          <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted)]">
            OAuth tokens stay in an encrypted session cookie on this app — not your Salesforce
            password. Use a dedicated Connected App; review scopes before production.
          </footer>
        </div>
      </body>
    </html>
  );
}
