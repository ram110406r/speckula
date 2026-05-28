import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Speckula collects, uses, and protects your data.",
};

// TODO(speckula): This is placeholder structure, NOT reviewed legal copy.
// Replace each section's body with text approved by counsel before launch.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </Link>

        <div className="mt-4 mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Placeholder document — replace with legal-reviewed copy before launch.
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 28 May 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">1. Data we collect</h2>
            <p>
              Speckula collects account information you provide (name, email), the
              content you upload for analysis (transcripts, documents), and usage
              telemetry needed to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">2. How we use your data</h2>
            <p>
              We use your data to provide insight extraction, generate documents,
              and improve reliability. Your uploaded content is never used to train
              AI models — ours or any third party&apos;s.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">3. Storage & security</h2>
            <p>
              Data is encrypted in transit and at rest. EU data residency is
              available on request for eligible plans.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">4. Your rights</h2>
            <p>
              You may request access, correction, export, or deletion of your data
              at any time by contacting{" "}
              <a href="mailto:support@speckula.ai" className="text-foreground underline underline-offset-2">
                support@speckula.ai
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">5. Contact</h2>
            <p>
              Questions about this policy? Email{" "}
              <a href="mailto:support@speckula.ai" className="text-foreground underline underline-offset-2">
                support@speckula.ai
              </a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
