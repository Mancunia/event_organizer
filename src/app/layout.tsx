import type { Metadata } from "next";
import { Kaushan_Script, Poppins } from "next/font/google";
import "./globals.css";

const script = Kaushan_Script({ variable: "--font-kaushan", subsets: ["latin"], weight: "400" });
const sans = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Event Invitations",
  description: "Personal event invitations with secure, device-bound passes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${script.variable} ${sans.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
