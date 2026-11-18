import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";

export const metadata: Metadata = {
  title: "SourceLens — Research Studio",
  description: "Compare claims across two sources. Find agreements, understand differences, and trace each finding to the original text.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
