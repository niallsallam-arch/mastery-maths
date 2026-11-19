import type { Metadata } from "next";
import "@fontsource/lexend/400.css";
import "@fontsource/lexend/500.css";
import "@fontsource/lexend/600.css";
import "./globals.css";

export const metadata: Metadata = { title: "Mastery Maths", description: "Private maths mastery practice" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
