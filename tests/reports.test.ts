import { it, expect } from "vitest";
import {
  sum,
  percentage,
  groupEntries,
  balanceTimeline,
  periodRange,
  previousRange,
  seriesForecast,
  money,
} from "../apps/shared/finance";
const row = (
  id: string,
  amount: string,
  kind = "EXPENSE",
  extra: any = {},
) => ({
  id,
  walletId: "one",
  itemId: "food",
  amount,
  date: "2026-11-10",
  status: "DONE",
  comment: "",
  item: { id: "food", name: "Jídlo", kind, color: "#ff0000" },
  ...extra,
});
it("částky a procentní podíly nepočítají desetinnou čárkou ani nulovým základem", () => {
  const rows = [row("1", "9007199254740993"), row("2", "10")];
  expect(sum(rows)).toBe(9007199254741003n);
  expect(groupEntries(rows)[0].amount).toBe(9007199254741003n);
  expect(percentage(2500n, 10000n)).toBe(25);
  expect(percentage(-500n, 1000n)).toBe(-50);
  expect(percentage(10n, 0n)).toBeNull();
  expect(money("12345")).toContain("123,45");
});
it("převody mění konkrétní účet, celkový zůstatek a statistiky příjmů/výdajů se nenafukují", () => {
  const wallets = [
    { id: "one", opening: "10000" },
    { id: "two", opening: "2000" },
  ] as any;
  const transfers = [
    { date: "2026-11-10", fromId: "one", toId: "two", amount: "3000" },
  ];
  expect(
    balanceTimeline(
      [],
      transfers,
      wallets,
      "ALL",
      "2026-11-01",
      "2026-11-30",
    ).at(-1)?.exact,
  ).toBe("12000");
  expect(
    balanceTimeline(
      [],
      transfers,
      wallets,
      "two",
      "2026-11-01",
      "2026-11-30",
    ).at(-1)?.exact,
  ).toBe("5000");
  expect(
    balanceTimeline(
      [row("e", "1000")],
      transfers,
      wallets,
      "one",
      "2026-11-11",
      "2026-11-30",
    ).at(-1)?.exact,
  ).toBe("6000");
});
it("období mají přesné hranice včetně přestupného února a stejně dlouhého srovnání", () => {
  expect(periodRange("Měsíc", "2024-02-18")).toEqual({
    from: "2024-02-01",
    to: "2024-02-29",
  });
  expect(periodRange("Týden", "2026-11-01")).toEqual({
    from: "2026-10-26",
    to: "2026-11-01",
  });
  expect(previousRange("2026-11-01", "2026-11-30")).toEqual({
    from: "2026-10-02",
    to: "2026-10-31",
    days: 30,
  });
});
it("výhled opakování respektuje přeskočení, skutečnou platbu i změněný jednotlivý výskyt", () => {
  const s = {
    id: "s",
    start: "2026-11-01",
    frequency: "WEEKLY",
    interval: 1,
    count: 4,
    amount: "1000",
    paused: false,
  };
  const entries = [
    row("paid", "1000", "EXPENSE", {
      seriesId: "s",
      occurrence: 0,
      date: "2026-11-01",
    }),
    row("skip", "1000", "EXPENSE", {
      seriesId: "s",
      occurrence: 1,
      date: "2026-11-08",
      status: "SKIPPED",
    }),
    row("edit", "1500", "EXPENSE", {
      seriesId: "s",
      occurrence: 2,
      date: "2026-11-16",
      status: "PLANNED",
    }),
  ];
  expect(seriesForecast(s, entries, "2026-11-01", "2026-11-30")).toEqual([
    { date: "2026-11-16", amount: 1500n, id: "edit" },
    { date: "2026-11-22", amount: 1000n, id: "" },
  ]);
  expect(
    seriesForecast({ ...s, paused: true }, entries, "2026-11-01", "2026-11-30"),
  ).toEqual([{ date: "2026-11-16", amount: 1500n, id: "edit" }]);
});
