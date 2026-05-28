import type { Metadata, Viewport } from "next";
import { Sora, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { ExportDialog } from "@/components/ui/export-dialog";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
});

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
});


// TODO(speckula): add a real 1200×630 OG image at /public/og-image.png and
// point openGraph.images / twitter.images at it. Falling back to the square
// logo for now so link previews aren't blank.
const SITE_URL = "https://speckula.ai";
const SITE_DESCRIPTION =
  "Speckula turns raw customer transcripts into shippable PRDs in minutes. AI insight extraction, prioritized tasks, and a decision engine for product teams. Free plan, no credit card.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Speckula — Build the Right Product",
    template: "%s · Speckula",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Speckula",
  keywords: [
    "product management", "AI PRD generator", "customer insights",
    "product requirements document", "decision intelligence", "product teams",
  ],
  authors: [{ name: "Speckula" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Speckula",
    title: "Speckula — Build the Right Product",
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Speckula" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Speckula — Build the Right Product",
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "500x500" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)",  color: "#14101F" },
  ],
};

// JSON-LD structured data — helps search engines understand the product + pricing.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Speckula",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  offers: [
    { "@type": "Offer", name: "Starter", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "23", priceCurrency: "USD" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline theme-init runs before any JS so the correct dark/light class
            is applied immediately, preventing FOUC. Placed in <head> of a Server
            Component so React 19 never sees it as a "script in component tree". */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const stored = localStorage.getItem('Speckula-theme');
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', stored ? stored === 'dark' : systemDark);
              } catch (_) {}
            })();`,
          }}
        />
        {/* Scroll-reveal elements ([data-animate]) start at opacity-0 and are
            revealed by an IntersectionObserver. When JS is disabled the observer
            never runs, so force them visible — otherwise the page renders blank. */}
        <noscript>
          <style>{`[data-animate]{opacity:1 !important;transform:none !important;}`}</style>
        </noscript>
        {/* JSON-LD structured data for the product. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning className={`${sora.variable} ${plexMono.variable} ${instrumentSerif.variable} font-sans min-h-screen bg-background antialiased`}>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          <ExportDialog />
        </AuthProvider>
      </body>
    </html>
  );
}
