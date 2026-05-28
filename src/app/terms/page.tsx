import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of Speckula.",
};

// TODO(speckula): This is placeholder structure, NOT reviewed legal copy.
// Replace each section's body with text approved by counsel before launch.
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </Link>

        <div className="mt-4 mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Placeholder document — replace with legal-reviewed copy before launch.
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 28 May 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">1. Acceptance of terms</h2>
            <p>
              By accessing or using Speckula, you agree to be bound by these terms.
              If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">2. Use of the service</h2>
            <p>
              You may use Speckula only for lawful purposes and in accordance with
              these terms. You are responsible for the content you upload and for
              maintaining the confidentiality of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">3. Subscriptions & billing</h2>
            <p>
              Paid plans are billed in advance on a monthly or annual basis. You may
              cancel at any time; access continues until the end of the billing period.
              The free plan remains free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">4. Intellectual property</h2>
            <p>
              You retain ownership of the content you upload and the documents you
              generate. Speckula retains ownership of the software and service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">5. Limitation of liability</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; without warranties of any kind to the
              extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-2">6. Contact</h2>
            <p>
              Questions about these terms? Email{" "}
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
