import { Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "@/components/providers/app-providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "AuraZone Admin",
  description: "Mobile-first PWA admin dashboard",
  applicationName: "AuraZone Admin",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AuraZone Admin",
  },
  icons: {
    icon: [
      { url: "/icons/web-app-manifest-192x192.png", type: "image/png" },
      { url: "/icons/web-app-manifest-512x512.png", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#FF6B6B",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} app-surface`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
