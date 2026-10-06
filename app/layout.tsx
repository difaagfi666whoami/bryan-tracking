import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Morning Start - Bryan Bestradda",
  description: "Bryan Bestradda's read-only 90 working day morning operations tracker.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
