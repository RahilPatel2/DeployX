import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://deployx.app"),
  title: {
    default: "DeployX — Deploy your projects",
    template: "%s | DeployX",
  },
  description: "Ship code. Not infrastructure. Continuous automated deployment, real-time build streaming, and edge hosting on Cloudflare Pages.",
  applicationName: "DeployX",
  authors: [{ name: "DeployX Team" }],
  creator: "DeployX",
  publisher: "DeployX",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://deployx.app",
    title: "DeployX — Deploy your projects",
    description: "Ship code. Not infrastructure. Continuous automated deployment, real-time build streaming, and edge hosting.",
    siteName: "DeployX",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeployX — Deploy your projects",
    description: "Ship code. Not infrastructure. Continuous automated deployment, real-time build streaming, and edge hosting.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
