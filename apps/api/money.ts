export function cents(value: string): bigint {
  if (!/^\d{1,12}([.,]\d{1,2})?$/.test(value))
    throw new Error("Neplatná částka");
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function balance(
  opening: bigint,
  entries: { amount: bigint; status: string; item: { kind: string } }[],
) {
  return entries
    .filter((e) => e.status === "DONE")
    .reduce(
      (n, e) => n + (e.item.kind === "INCOME" ? e.amount : -e.amount),
      opening,
    );
}
export function signedCents(value: string): bigint {
  return value.startsWith("-") ? -cents(value.slice(1)) : cents(value);
}
