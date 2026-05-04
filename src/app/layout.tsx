import type { Metadata, Viewport } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
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


export const metadata: Metadata = {
  title: "Speckula — Build the Right Product",
  description: "AI-powered decision intelligence for product teams.",
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
      <body suppressHydrationWarning className={`${sora.variable} ${plexMono.variable} font-sans min-h-screen bg-background antialiased`}>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          <ExportDialog />
        </AuthProvider>
      </body>
    </html>
  );
}
