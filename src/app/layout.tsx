import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, DM_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { ExportDialog } from "@/components/ui/export-dialog";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});


export const metadata: Metadata = {
  title: "Speckula — Build the Right Product",
  description: "AI-powered decision intelligence for product teams.",
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
      </head>
      <body suppressHydrationWarning className={`${inter.variable} ${playfair.variable} ${dmMono.variable} font-sans min-h-screen bg-background antialiased`}>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          <ExportDialog />
        </AuthProvider>
      </body>
    </html>
  );
}
