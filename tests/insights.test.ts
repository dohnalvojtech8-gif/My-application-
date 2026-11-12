import { it, expect } from "vitest";
import {
  budgetSummary,
  merchantComparison,
  unusualExpenses,
} from "../apps/shared/insights";
import {
  balanceTimeline,
  money,
  type FinancialEntry,
} from "../apps/shared/finance";
import { currencies } from "../apps/shared/currencies";
const row = (
  id: string,
  amount: string,
  date = "2026-11-10",
  extra: any = {},
): FinancialEntry => ({
  id,
  amount,
  date,
  walletId: "eur",
  itemId: "food",
  comment: "",
  status: "DONE",
  merchant: "  Žabka ",
  item: { id: "food", name: "Jídlo", kind: "EXPENSE", color: "#123456" },
  ...extra,
});
it("rozpočet odděluje skutečné a plánované výdaje, účty, příjmy i hranice období", () => {
  const budget = {
    walletId: "eur",
    amount: "10000",
    paymentLimit: "8000",
    period: "MONTHLY",
    warningPercent: 80,
    enabled: true,
  };
  const rows = [
    row("actual", "9000"),
    row("future", "3000", "2026-11-20", { status: "PLANNED" }),
    row("skip", "10000", "2026-11-10", { status: "SKIPPED" }),
    row("czk", "100000", "2026-11-10", { walletId: "czk" }),
    row("old", "1000", "2026-10-31"),
    row("income", "50000", "2026-11-10", { item: { kind: "INCOME" } }),
  ];
  const s = budgetSummary(budget, rows, "2026-11-10");
  expect(s).toMatchObject({
    spent: "9000",
    planned: "3000",
    remaining: "1000",
    percent: 90,
    overPayments: 1,
    status: "EXCEEDED",
    dailyAvailable: "47",
  });
  expect(s.timeline.at(-1)?.spent).toBe("9000");
  expect(
    budgetSummary({ ...budget, enabled: false }, rows, "2026-11-10").status,
  ).toBe("PAUSED");
  expect(
    budgetSummary({ ...budget, period: "WEEKLY" }, rows, "2026-11-10"),
  ).toMatchObject({ from: "2026-11-09", to: "2026-11-15", planned: "0" });
  expect(
    budgetSummary({ ...budget, period: "YEARLY" }, rows, "2026-11-10").spent,
  ).toBe("10000");
});
it("obchodníky slučuje bez diakritiky, srovnává přesné částky a nedělí nulou", () => {
  const result = merchantComparison(
    [
      row("1", "5000"),
      row("2", "2500", "2026-11-10", { merchant: "zABka" }),
      row("p", "1000", "2026-11-10", { status: "PLANNED" }),
      row("n", "2000", "2026-11-10", { merchant: "Nový" }),
    ],
    [row("old", "5000", "2026-10-10")],
  );
  expect(result[0]).toMatchObject({
    current: 7500n,
    previous: 5000n,
    count: 2,
    average: 3750n,
    delta: 2500n,
    percent: 50,
  });
  expect(result[1].percent).toBeNull();
});
it("neobvyklé platby vyžadují pět starších vzorků a nepoužijí budoucnost ani jiné obchodníky", () => {
  const history = [1, 2, 3, 4, 5].map((n) =>
    row(String(n), String(n * 100), "2026-11-0" + n),
  );
  const high = row("high", "1000"),
    ordinary = row("normal", "900");
  expect(unusualExpenses([high, ordinary], history)).toMatchObject([
    { entry: { id: "high" }, median: 300n, count: 5 },
  ]);
  expect(unusualExpenses([high], history.slice(1))).toEqual([]);
  expect(
    unusualExpenses(
      [high],
      history.map((e) => ({ ...e, merchant: "jiný" })),
    ),
  ).toEqual([]);
  expect(
    unusualExpenses(
      [high],
      history.map((e) => ({ ...e, date: "2026-11-11" })),
    ),
  ).toEqual([]);
});
it("převod různých měn má samostatnou odeslanou a přijatou částku", () => {
  const transfer = {
    date: "2026-11-10",
    fromId: "czk",
    toId: "eur",
    amount: "250000",
    receivedAmount: "10000",
  };
  expect(
    balanceTimeline(
      [],
      [transfer],
      [{ id: "eur", opening: "2000" }] as any,
      "ALL",
      "2026-11-01",
      "2026-11-30",
    ).at(-1)?.exact,
  ).toBe("12000");
  expect(
    balanceTimeline(
      [],
      [transfer],
      [{ id: "czk", opening: "300000" }] as any,
      "ALL",
      "2026-11-01",
      "2026-11-30",
    ).at(-1)?.exact,
  ).toBe("50000");
  expect(currencies).toHaveLength(10);
  for (const c of currencies)
    expect(money("12345", c.code)).toContain(c.symbol);
});
