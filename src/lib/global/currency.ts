export const CURRENCIES = { XOF: 0, EUR: 2, USD: 2, GBP: 2, NGN: 2, GHS: 2, JPY: 0 } as const;
export type Currency = keyof typeof CURRENCIES;
export type Money = { amountMinor: number; currency: Currency };
export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}
export function assertMoney(money: Money): void {
  if (!isCurrency(money.currency) || !Number.isSafeInteger(money.amountMinor)) throw new Error("INVALID_MONEY");
}
export function formatMoney(money: Money, locale: string): string {
  assertMoney(money);
  const digits = CURRENCIES[money.currency];
  return new Intl.NumberFormat(locale, { style: "currency", currency: money.currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(money.amountMinor / 10 ** digits);
}
