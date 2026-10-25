
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from 'next/font/google';
import "./globals.css";

const inter = Inter({subsets:['latin']})
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaskSpace",
  description:
    "The connected workspace where better, faster work happens.",
  icons: {
    icon: [
      {
        media: "(prefers-color-scheme: light)",
        url: "/logo.png",
      },
      {
        media: "(prefers-color-scheme: dark)",
        url: "/logo-dark.png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  )
}
