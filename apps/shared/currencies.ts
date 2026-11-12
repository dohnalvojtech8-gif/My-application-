export const currencyCodes = [
  "CZK",
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "PLN",
  "HUF",
  "SEK",
  "NOK",
  "DKK",
] as const;
export type Currency = (typeof currencyCodes)[number];
export const currencies: { code: Currency; name: string; symbol: string }[] = [
  { code: "CZK", name: "Česká koruna", symbol: "Kč" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "USD", name: "Americký dolar", symbol: "USD" },
  { code: "GBP", name: "Britská libra", symbol: "GBP" },
  { code: "CHF", name: "Švýcarský frank", symbol: "CHF" },
  { code: "PLN", name: "Polský zlotý", symbol: "PLN" },
  { code: "HUF", name: "Maďarský forint", symbol: "HUF" },
  { code: "SEK", name: "Švédská koruna", symbol: "SEK" },
  { code: "NOK", name: "Norská koruna", symbol: "NOK" },
  { code: "DKK", name: "Dánská koruna", symbol: "DKK" },
];
export const currencySymbol = (code: string) =>
  currencies.find((c) => c.code === code)?.symbol || code;
export const validCurrency = (code: string): code is Currency =>
  (currencyCodes as readonly string[]).includes(code);
