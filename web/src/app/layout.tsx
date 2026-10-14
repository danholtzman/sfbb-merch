import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "SFBB Merchandise", description: "San Francisco Brass Band merchandise" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
