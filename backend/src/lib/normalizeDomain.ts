/**
 * Normalizes a URL or domain string to a bare lowercase hostname.
 *
 * Examples:
 *   "https://www.Linear.app/"  → "linear.app"
 *   "http://Notion.so/pricing" → "notion.so"
 *   "productboard.com"         → "productboard.com"
 */
export function normalizeDomain(input: string): string {
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProto);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return input
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase()
      .trim();
  }
}
