import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Social Media Platform - Connect, Share, and Discover",
  description: "A premium, state-of-the-art social media platform featuring real-time feeds, direct messaging, live presence tracking, and rich media sharing.",
  keywords: ["social media", "real-time", "chat", "feed", "connect", "messaging"],
  authors: [{ name: "Social Media Team" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-light-bg text-foreground dark:bg-dark-bg transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
