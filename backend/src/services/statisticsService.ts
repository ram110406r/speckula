// Statistical analysis for experiments — computes lift, p-value approximation,
// confidence intervals, and whether a variant is statistically significant.

export interface VariantStats {
  id:             string;
  name:           string;
  isControl:      boolean;
  impressions:    number;
  conversions:    number;
  conversionRate: number;
  lift:           number | null;   // % lift vs control (null for control)
  pValue:         number | null;   // two-proportion z-test approximation
  significant:    boolean | null;
  ciLow:          number;          // 95% confidence interval lower bound
  ciHigh:         number;          // 95% confidence interval upper bound
}

// Normal CDF approximation (Abramowitz & Stegun 26.2.17).
const normCdf = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - 0.3989422804 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? cdf : 1 - cdf;
};

// Two-proportion z-test p-value (two-tailed).
const twoProportionPValue = (
  n1: number, k1: number,  // control: impressions, conversions
  n2: number, k2: number,  // variant: impressions, conversions
): number => {
  if (n1 === 0 || n2 === 0) return 1;

  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const pPool = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (se === 0) return p1 === p2 ? 1 : 0;

  const z = (p2 - p1) / se;
  return 2 * (1 - normCdf(Math.abs(z)));
};

// Wilson score interval for a proportion (95% CI, z=1.96).
const wilsonCI = (n: number, k: number): { low: number; high: number } => {
  if (n === 0) return { low: 0, high: 1 };
  const p = k / n;
  const z = 1.96;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half   = (z / (1 + z2 / n)) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
};

export interface RawVariant {
  id:          string;
  name:        string;
  isControl:   boolean;
  impressions: number;
  conversions: number;
}

export const analyseExperiment = (variants: RawVariant[]): VariantStats[] => {
  const control = variants.find((v) => v.isControl);
  const pControl = control && control.impressions > 0
    ? control.conversions / control.impressions
    : null;

  return variants.map((v) => {
    const rate = v.impressions > 0 ? v.conversions / v.impressions : 0;
    const ci   = wilsonCI(v.impressions, v.conversions);

    let lift:        number | null = null;
    let pValue:      number | null = null;
    let significant: boolean | null = null;

    if (!v.isControl && control && pControl !== null && pControl > 0) {
      lift   = ((rate - pControl) / pControl) * 100;
      pValue = twoProportionPValue(control.impressions, control.conversions, v.impressions, v.conversions);
      // Significant at α = 0.05, minimum 100 impressions per variant.
      significant = pValue < 0.05 && v.impressions >= 100 && control.impressions >= 100;
    }

    return {
      id:             v.id,
      name:           v.name,
      isControl:      v.isControl,
      impressions:    v.impressions,
      conversions:    v.conversions,
      conversionRate: rate,
      lift,
      pValue,
      significant,
      ciLow:  ci.low,
      ciHigh: ci.high,
    };
  });
};

// Determine overall experiment verdict from analysed variants.
export const experimentVerdict = (stats: VariantStats[]): string => {
  const winners = stats.filter((s) => !s.isControl && s.significant && (s.lift ?? 0) > 0);
  if (winners.length > 0) return 'winner_found';

  const losers = stats.filter((s) => !s.isControl && s.significant && (s.lift ?? 0) < 0);
  if (losers.length === stats.filter((s) => !s.isControl).length) return 'control_wins';

  const totalImpressions = stats.reduce((s, v) => s + v.impressions, 0);
  if (totalImpressions < 200) return 'needs_more_data';

  return 'inconclusive';
};
