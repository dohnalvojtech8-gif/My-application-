import {
  periodRange,
  previousRange,
  shiftDay,
  today,
  percentage,
  type FinancialEntry,
} from "./finance";
export const merchantKey = (name = "") =>
  name
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs");
export type BudgetConfig = {
  id?: string;
  walletId: string;
  amount: string | bigint | null;
  paymentLimit: string | bigint | null;
  period: string;
  warningPercent: number;
  enabled: boolean;
};
export function budgetSummary(
  b: BudgetConfig,
  entries: FinancialEntry[],
  anchor = today(),
) {
  const range = periodRange(
    b.period === "WEEKLY" ? "Týden" : b.period === "YEARLY" ? "Rok" : "Měsíc",
    anchor,
  );
  const expenses = entries.filter(
    (e) =>
      e.walletId === b.walletId &&
      e.item.kind === "EXPENSE" &&
      e.date >= range.from &&
      e.date <= range.to,
  );
  const done = expenses.filter((e) => e.status === "DONE");
  const spent = done.reduce((n, e) => n + BigInt(e.amount), 0n);
  const planned = expenses
    .filter((e) => e.status === "PLANNED")
    .reduce((n, e) => n + BigInt(e.amount), 0n);
  const limit = b.amount == null ? null : BigInt(b.amount);
  const paymentLimit = b.paymentLimit == null ? null : BigInt(b.paymentLimit);
  const overPayments =
    paymentLimit == null
      ? []
      : done.filter((e) => BigInt(e.amount) > paymentLimit);
  const remaining = limit == null ? null : limit - spent;
  const percent = limit == null ? null : percentage(spent, limit);
  const daysLeft = Math.max(
    0,
    previousRange(anchor > range.from ? anchor : range.from, range.to).days,
  );
  let cumulative = 0n;
  const byDay = new Map<string, bigint>();
  for (const e of done)
    byDay.set(e.date, (byDay.get(e.date) || 0n) + BigInt(e.amount));
  const timeline = [];
  for (
    let date = range.from;
    date <= (anchor < range.to ? anchor : range.to);
    date = shiftDay(date, 1)
  ) {
    cumulative += byDay.get(date) || 0n;
    timeline.push({
      date,
      spent: cumulative.toString(),
      limit: limit?.toString() ?? null,
    });
  }
  return {
    ...range,
    spent: spent.toString(),
    planned: planned.toString(),
    remaining: remaining?.toString() ?? null,
    percent,
    overPayments: overPayments.length,
    status: !b.enabled
      ? "PAUSED"
      : (remaining != null && remaining < 0n) || overPayments.length > 0
        ? "EXCEEDED"
        : percent != null && percent >= b.warningPercent
          ? "WARNING"
          : "OK",
    dailyAvailable:
      remaining == null || daysLeft <= 0
        ? null
        : (remaining > 0n ? remaining / BigInt(daysLeft) : 0n).toString(),
    timeline,
  };
}
export function merchantComparison(
  current: FinancialEntry[],
  previous: FinancialEntry[],
) {
  const groups = new Map<
    string,
    {
      key: string;
      name: string;
      current: bigint;
      previous: bigint;
      count: number;
    }
  >();
  for (const [rows, period] of [
    [current, "current"],
    [previous, "previous"],
  ] as const) {
    for (const e of rows.filter(
      (e) => e.status === "DONE" && e.item.kind === "EXPENSE",
    )) {
      const key = merchantKey(e.merchant),
        name = e.merchant?.trim() || "Neuvedený obchodník";
      const row = groups.get(key) || {
        key,
        name,
        current: 0n,
        previous: 0n,
        count: 0,
      };
      row[period] += BigInt(e.amount);
      if (period === "current") row.count++;
      groups.set(key, row);
    }
  }
  return [...groups.values()]
    .sort((a, b) =>
      a.current === b.current
        ? a.name.localeCompare(b.name)
        : a.current > b.current
          ? -1
          : 1,
    )
    .map((g) => ({
      ...g,
      delta: g.current - g.previous,
      percent:
        g.previous === 0n
          ? null
          : percentage(g.current - g.previous, g.previous),
      average: g.count ? g.current / BigInt(g.count) : 0n,
    }));
}
export function unusualExpenses(
  selected: FinancialEntry[],
  history: FinancialEntry[],
) {
  return selected
    .filter((e) => e.status === "DONE" && e.item.kind === "EXPENSE")
    .flatMap((e) => {
      const start = shiftDay(e.date, -90),
        key = merchantKey(e.merchant);
      const sample = history
        .filter(
          (p) =>
            p.id !== e.id &&
            p.status === "DONE" &&
            p.item.kind === "EXPENSE" &&
            p.date >= start &&
            p.date < e.date &&
            (key
              ? merchantKey(p.merchant) === key
              : (p.itemId || p.item.id) === (e.itemId || e.item.id)),
        )
        .map((p) => BigInt(p.amount))
        .sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
      if (sample.length < 5) return [];
      const middle = Math.floor(sample.length / 2),
        median =
          sample.length % 2
            ? sample[middle]
            : (sample[middle - 1] + sample[middle]) / 2n;
      return median > 0n && BigInt(e.amount) > median * 3n
        ? [
            {
              entry: e,
              median,
              count: sample.length,
              percent: percentage(BigInt(e.amount) - median, median),
            },
          ]
        : [];
    });
}
