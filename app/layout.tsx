import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Train Meet",
  description:
    "Pick two UK stations and find which stations are reachable directly from both — your one-change meeting points.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
