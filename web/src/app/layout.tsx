import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "SFBB Merchandise", description: "San Francisco Brass Band merchandise", icons: { icon: [
  { url: "/brand/favicon-light.png", type: "image/png", sizes: "288x288", media: "(prefers-color-scheme: light)" },
  { url: "/brand/favicon-dark.png", type: "image/png", sizes: "288x288", media: "(prefers-color-scheme: dark)" },
] } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
