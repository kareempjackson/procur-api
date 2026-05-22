/**
 * Hard-coded FX rates (to USD) for admin reporting.
 *
 * These are used by the admin dashboard to roll up totals across mixed-currency
 * orders into a single USD reporting figure. They are **approximate** and only
 * suitable for internal dashboards — never use them to settle a transaction.
 *
 * When we add an FX service (or a `fx_rates` table the admin can edit), swap
 * `RATES_TO_USD` for a lookup against that source. The signature of
 * `convertToUsd` should stay the same so callers don't need to change.
 *
 * Rates as of 2026-05 — refresh periodically by hand or wire up a feed.
 */
const RATES_TO_USD: Record<string, number> = {
  USD: 1,
  XCD: 0.37, // Eastern Caribbean Dollar (fixed peg to USD at 2.70 XCD = 1 USD)
  TTD: 0.147, // Trinidad & Tobago Dollar
  BBD: 0.5, // Barbados Dollar (fixed peg)
  JMD: 0.0064, // Jamaican Dollar
  COP: 0.00024, // Colombian Peso
  DOP: 0.017, // Dominican Peso
  MXN: 0.055, // Mexican Peso
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
};

/**
 * Convert a monetary amount to USD using the static rate table above.
 * Unknown currencies are treated as USD with a console warning — the assumption
 * is that any new currency on the platform will get a rate added here.
 */
export function convertToUsd(
  amount: number | null | undefined,
  currency: string | null | undefined,
): number {
  const safe = Number.isFinite(amount) ? Number(amount) : 0;
  const code = (currency || 'USD').toUpperCase();
  const rate = RATES_TO_USD[code];
  if (rate === undefined) {
    // Log once per process so we notice missing rates without flooding logs.
    if (!warnedCurrencies.has(code)) {
      warnedCurrencies.add(code);
      console.warn(
        `[fx] No FX rate for currency "${code}" — treating as 1:1 with USD. Add a rate to common/utils/fx.ts.`,
      );
    }
    return safe;
  }
  return safe * rate;
}

const warnedCurrencies = new Set<string>();

/** Expose the rate table for places that want to display the conversion factor. */
export function getUsdRate(currency: string | null | undefined): number {
  const code = (currency || 'USD').toUpperCase();
  return RATES_TO_USD[code] ?? 1;
}
