// Insight-quality evaluation fixtures.
//
// Each fixture is a real page we expect SPECKULA to produce a useful insight
// for. The page TEXT is NOT stored here (fabricated content would make the
// eval meaningless) — instead the runner reads it from:
//
//     backend/src/eval/pages/<id>.txt
//
// Populate each file once with the real captured page text (copy from a
// capture, or the page's main content). Fixtures without populated content
// are skipped with a clear message.

export interface EvalFixture {
  id: string;
  name: string;
  pageType: string;        // matches the extension/worker pageType vocabulary
  sourceUrl: string;
  expectedOutcome: string; // what an experienced PM should expect the insight to surface
}

export const FIXTURES: EvalFixture[] = [
  {
    id: "linear-pricing",
    name: "Linear Pricing",
    pageType: "pricing",
    sourceUrl: "https://linear.app/pricing",
    expectedOutcome: "Detect the pricing strategy, market positioning, and the target customer (ICP) Linear is optimizing for.",
  },
  {
    id: "notion-enterprise",
    name: "Notion Enterprise",
    pageType: "landing",
    sourceUrl: "https://www.notion.so/product/enterprise",
    expectedOutcome: "Detect the enterprise go-to-market motion and security/compliance signals (SSO, SAML, SOC 2, admin controls).",
  },
  {
    id: "figma-pricing",
    name: "Figma Pricing",
    pageType: "pricing",
    sourceUrl: "https://www.figma.com/pricing/",
    expectedOutcome: "Detect packaging/tier changes and the competitive differentiators Figma leans on.",
  },
  {
    id: "stripe-product",
    name: "Stripe Product / Docs",
    pageType: "product",
    sourceUrl: "https://stripe.com/payments",
    expectedOutcome: "Detect product-expansion opportunities and where Stripe is widening its platform surface.",
  },
  {
    id: "competitor-blog",
    name: "Competitor Blog Post",
    pageType: "general",
    sourceUrl: "https://example.com/blog/competitor-post",
    expectedOutcome: "Extract market trends and forward-looking signals from the narrative (not just summarize the post).",
  },
];
