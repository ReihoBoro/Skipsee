import type { Metadata } from "next";
import { Outfit, Pacifico } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://skipsee.com'),
  title: {
    default: "Skipsee - Random Video Chat",
    template: "%s | Skipsee"
  },
  description: "Meet strangers instantly on Skipsee, the best free random video chat alternative.",
  openGraph: {
    title: "Skipsee - Random Video Chat",
    description: "Meet strangers instantly. No login required.",
    url: 'https://skipsee.com',
    siteName: 'Skipsee',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Skipsee - Cam Chat with Strangers",
    description: "Free random video chat app. Meet new people now.",
  },
  icons: {
    icon: '/logo (1).svg',
  },
};

import CapacitorInit from "@/components/CapacitorInit";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className={`${outfit.variable} ${pacifico.variable} antialiased`}>
        <CapacitorInit />
        {children}
      </body>
    </html>
  );
}
