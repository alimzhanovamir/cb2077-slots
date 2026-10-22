import type { Currency } from "@cb2077/shared";

const formatters = new Map<number, Intl.NumberFormat>();

/** Formats integer cents for display, e.g. `1250` → `€$ 12.50`. The only cents → text conversion. */
export function formatMoney(cents: number, currency: Currency): string {
  let formatter = formatters.get(currency.decimals);

  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    });

    formatters.set(currency.decimals, formatter);
  }

  return `${currency.symbol} ${formatter.format(cents / 10 ** currency.decimals)}`;
}
