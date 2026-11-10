import { occurrence } from "../api/recurrence";
export type FinancialEntry = {
  id: string;
  walletId: string;
  amount: string;
  date: string;
  status: string;
  comment: string;
  itemId?: string;
  item: { id: string; name: string; kind: string; color: string };
  seriesId?: string | null;
  occurrence?: number | null;
};
export type FinancialWallet = {
  id: string;
  name: string;
  kind: string;
  color: string;
  currency: string;
  opening: string;
  balance: string;
  archived: boolean;
  isDefault: boolean;
};
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(
    new Date(),
  );
export function money(value: string | bigint | number): string {
  const n = BigInt(value),
    absolute = n < 0n ? -n : n;
  return `${n < 0n ? "−" : ""}${new Intl.NumberFormat("cs-CZ").format(absolute / 100n)},${String(absolute % 100n).padStart(2, "0")} Kč`;
}
export function decimal(value: string | bigint) {
  const n = BigInt(value),
    abs = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}
export const sum = (rows: FinancialEntry[], kind?: string) =>
  rows.reduce(
    (n, e) => n + (!kind || e.item.kind === kind ? BigInt(e.amount) : 0n),
    0n,
  );
export const net = (rows: FinancialEntry[]) =>
  sum(rows, "INCOME") - sum(rows, "EXPENSE");
export function percentage(part: bigint, total: bigint): number | null {
  if (total === 0n) return null;
  const divisor = total < 0n ? -total : total;
  const numerator = (part < 0n ? -part : part) * 1000n;
  const scaled =
    ((numerator + divisor / 2n) / divisor) * (part < 0n ? -1n : 1n);
  return Number(scaled) / 10;
}
export const percentText = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(n) +
      " %";
export function shiftDay(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function periodRange(
  period: string,
  anchor = today(),
): { from: string; to: string } {
  const d = new Date(anchor + "T12:00:00Z");
  if (period === "Vše") return { from: "0001-01-01", to: "9999-12-31" };
  if (period === "Týden") {
    const from = shiftDay(anchor, -((d.getUTCDay() + 6) % 7));
    return { from, to: shiftDay(from, 6) };
  }
  if (period === "Měsíc") {
    const from = anchor.slice(0, 7) + "-01";
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
    return { from, to: d.toISOString().slice(0, 10) };
  }
  if (period === "Rok")
    return {
      from: anchor.slice(0, 4) + "-01-01",
      to: anchor.slice(0, 4) + "-12-31",
    };
  return { from: anchor, to: anchor };
}
export function previousRange(from: string, to: string) {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  return { from: shiftDay(from, -days), to: shiftDay(from, -1), days };
}
export function groupEntries(rows: FinancialEntry[]) {
  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      color: string;
      kind: string;
      amount: bigint;
      count: number;
      max: bigint;
    }
  >();
  for (const e of rows) {
    const id = e.itemId || e.item.id;
    const g = grouped.get(id) || {
      id,
      name: e.item.name,
      color: e.item.color,
      kind: e.item.kind,
      amount: 0n,
      count: 0,
      max: 0n,
    };
    const a = BigInt(e.amount);
    g.amount += a;
    g.count++;
    if (a > g.max) g.max = a;
    grouped.set(id, g);
  }
  return [...grouped.values()].sort((a, b) =>
    a.amount > b.amount
      ? -1
      : a.amount < b.amount
        ? 1
        : a.name.localeCompare(b.name),
  );
}
export function flowTimeline(
  rows: FinancialEntry[],
  granularity: "day" | "month" = "day",
) {
  const days = new Map<
    string,
    { date: string; income: bigint; expense: bigint }
  >();
  for (const e of rows) {
    const date = e.date.slice(0, granularity === "month" ? 7 : 10);
    const d = days.get(date) || { date, income: 0n, expense: 0n };
    if (e.item.kind === "INCOME") d.income += BigInt(e.amount);
    else d.expense += BigInt(e.amount);
    days.set(date, d);
  }
  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      Příjmy: Number(d.income) / 100,
      Výdaje: Number(d.expense) / 100,
    }));
}
export function balanceTimeline(
  entries: FinancialEntry[],
  transfers: any[],
  wallets: FinancialWallet[],
  walletId: string,
  from: string,
  to: string,
) {
  const selected = wallets.filter(
    (w) => walletId === "ALL" || w.id === walletId,
  );
  const ids = new Set(selected.map((w) => w.id));
  let running = selected.reduce((n, w) => n + BigInt(w.opening), 0n);
  const changes = new Map<string, bigint>();
  for (const e of entries)
    if (e.status === "DONE" && ids.has(e.walletId))
      changes.set(
        e.date,
        (changes.get(e.date) || 0n) +
          (e.item.kind === "INCOME" ? BigInt(e.amount) : -BigInt(e.amount)),
      );
  for (const t of transfers) {
    const delta =
      (ids.has(t.toId) ? BigInt(t.amount) : 0n) -
      (ids.has(t.fromId) ? BigInt(t.amount) : 0n);
    changes.set(t.date, (changes.get(t.date) || 0n) + delta);
  }
  const rows: { date: string; Zůstatek: number; exact: string }[] = [];
  for (const [date, change] of [...changes.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (date < from) running += change;
    else if (date <= to) {
      if (!rows.length)
        rows.push({
          date: from,
          Zůstatek: Number(running) / 100,
          exact: running.toString(),
        });
      running += change;
      rows.push({
        date,
        Zůstatek: Number(running) / 100,
        exact: running.toString(),
      });
    }
  }
  if (!rows.length)
    rows.push({
      date: from === "0001-01-01" ? today() : from,
      Zůstatek: Number(running) / 100,
      exact: running.toString(),
    });
  return rows;
}
// An existing occurrence always wins, including skipped or rescheduled occurrences.
export function seriesForecast(
  series: any,
  entries: FinancialEntry[],
  from: string,
  to: string,
) {
  const existing = entries.filter((e) => e.seriesId === series.id),
    known = new Set(existing.map((e) => e.occurrence));
  const result = existing
    .filter((e) => e.status === "PLANNED" && e.date >= from && e.date <= to)
    .map((e) => ({ date: e.date, amount: BigInt(e.amount), id: e.id }));
  if (!series.paused)
    for (let index = 0; index < (series.count ?? 10000); index++) {
      const date = occurrence(
        series.start,
        series.frequency,
        series.interval,
        index,
      );
      if (date > to || (series.end && date > series.end)) break;
      if (date >= from && !known.has(index))
        result.push({ date, amount: BigInt(series.amount), id: "" });
    }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function csvCell(value: string) {
  return '"' + value.replace(/^[=+@\-\t\r]/, "'").replaceAll('"', '""') + '"';
}
