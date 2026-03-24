import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Agent generator",
  description: "Salesforce GPTfy agent helper",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-glow" aria-hidden />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Nav />
          <main className="w-full max-w-[1680px] flex-1 mx-auto px-5 sm:px-8 lg:px-12 py-8 lg:py-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
