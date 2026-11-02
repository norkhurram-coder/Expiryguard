import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExpiryGuard – Smart Pharmacy Stock & Expiry Management",
  description: "Sell safe stock. Lose less to expiry.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
