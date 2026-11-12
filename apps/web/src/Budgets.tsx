import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { budgetSummary, type BudgetConfig } from "../../shared/insights";
import {
  money,
  decimal,
  percentText,
  today,
  type FinancialEntry,
  type FinancialWallet,
} from "../../shared/finance";
import { call } from "./Settings";
const periods: Record<string, string> = {
  WEEKLY: "Týdenní",
  MONTHLY: "Měsíční",
  YEARLY: "Roční",
};
export function BudgetCards({
  wallets,
  budgets,
  entries,
  anchor = today(),
  charts = false,
}: {
  wallets: FinancialWallet[];
  budgets: BudgetConfig[];
  entries: FinancialEntry[];
  anchor?: string;
  charts?: boolean;
}) {
  const visible = budgets.filter((b) =>
    wallets.some((w) => w.id === b.walletId),
  );
  return (
    <div className="budget-grid">
      {!visible.length && (
        <p className="report-empty">
          Rozpočet zatím není nastavený. Přidejte ho v Nastavení → Rozpočty a
          limity.
        </p>
      )}
      {visible.map((b) => {
        const w = wallets.find((w) => w.id === b.walletId)!,
          s = budgetSummary(b, entries, anchor);
        return (
          <article
            key={b.walletId}
            className={"budget-card budget-" + s.status.toLowerCase()}
          >
            <div className="budget-heading">
              <h3>{w.name}</h3>
              <span className="status-chip">
                {!b.enabled
                  ? "Pozastaveno"
                  : s.status === "EXCEEDED"
                    ? "Překročeno"
                    : s.status === "WARNING"
                      ? "Blízko limitu"
                      : "V pořádku"}
              </span>
            </div>
            <small>
              {periods[b.period]} rozpočet · {s.from} – {s.to}
            </small>
            <strong>
              {money(s.spent, w.currency)}{" "}
              <small>
                {b.amount == null
                  ? "bez rozpočtu"
                  : "z " + money(b.amount, w.currency)}
              </small>
            </strong>
            {s.percent != null && (
              <>
                <progress
                  aria-label={"Čerpání rozpočtu " + w.name}
                  max={100}
                  value={Math.min(100, s.percent)}
                />
                <b>{percentText(s.percent)} vyčerpáno</b>
              </>
            )}
            <div className="budget-facts">
              {s.remaining != null && (
                <span>
                  {BigInt(s.remaining) < 0n ? "Překročení" : "Zbývá"}
                  <b>
                    {money(
                      BigInt(s.remaining) < 0n
                        ? -BigInt(s.remaining)
                        : s.remaining,
                      w.currency,
                    )}
                  </b>
                </span>
              )}
              <span>
                Plánované výdaje<b>{money(s.planned, w.currency)}</b>
              </span>
              {s.dailyAvailable != null && (
                <span>
                  Na den do konce období
                  <b>{money(s.dailyAvailable, w.currency)}</b>
                </span>
              )}
            </div>
            {b.paymentLimit != null && (
              <p>
                Limit jedné platby {money(b.paymentLimit, w.currency)} ·{" "}
                {s.overPayments} překročení
              </p>
            )}
            {s.remaining != null &&
              BigInt(s.planned) > BigInt(s.remaining) &&
              b.enabled && (
                <p className="budget-warning">
                  Po zaplacení plánu se rozpočet překročí.
                </p>
              )}
            {charts && b.amount != null && (
              <div className="budget-chart">
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart
                    data={s.timeline.map((p) => ({
                      ...p,
                      spent: Number(p.spent) / 100,
                    }))}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => d.slice(5)}
                      minTickGap={40}
                    />
                    <Tooltip
                      formatter={(v) =>
                        Number(v).toLocaleString("cs-CZ") + " " + w.currency
                      }
                    />
                    <ReferenceLine
                      ifOverflow="extendDomain"
                      y={Number(b.amount) / 100}
                      stroke="#e04b67"
                      label="Limit"
                    />
                    <Area
                      isAnimationActive={false}
                      dataKey="spent"
                      name="Vyčerpáno"
                      stroke="#00a99d"
                      fill="#00a99d22"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
export function Budgets({
  data,
  refresh,
}: {
  data: any;
  refresh: () => unknown;
}) {
  const [walletId, setWalletId] = useState(data.wallets[0]?.id || ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const w: FinancialWallet | undefined = data.wallets.find(
      (w: FinancialWallet) => w.id === walletId,
    ),
    b = data.budgets?.find((b: BudgetConfig) => b.walletId === walletId);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage("Rozpočet uložen.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="settings-group" id="budget-settings">
      <summary>
        <span>Rozpočty a limity</span>
        <small>Vlastní rozpočet a limit platby pro každý účet</small>
      </summary>
      <article>
        <p>
          Limity upozorňují na čerpání. Neblokují evidenci skutečně provedených
          plateb. Převody mezi vlastními účty se do výdajů nepočítají.
        </p>
        <label>
          Účet pro rozpočet
          <select
            value={walletId}
            onChange={(e) => {
              setWalletId(e.target.value);
              setMessage("");
            }}
          >
            {data.wallets.map((w: FinancialWallet) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.currency}
              </option>
            ))}
          </select>
        </label>
        {w && (
          <form
            key={walletId + JSON.stringify(b)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                call(
                  "/wallets/" + w.id + "/budget",
                  {
                    amount: f.get("amount") || null,
                    paymentLimit: f.get("paymentLimit") || null,
                    period: f.get("period"),
                    warningPercent: Number(f.get("warningPercent")),
                    enabled: f.has("enabled"),
                  },
                  "PUT",
                ),
              );
            }}
          >
            <div className="filters-grid">
              <label>
                Rozpočet ({w.currency})
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="Např. 15000"
                  defaultValue={b?.amount == null ? "" : decimal(b.amount)}
                />
              </label>
              <label>
                Období rozpočtu
                <select name="period" defaultValue={b?.period || "MONTHLY"}>
                  {Object.entries(periods).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Limit jedné platby ({w.currency})
                <input
                  name="paymentLimit"
                  inputMode="decimal"
                  defaultValue={
                    b?.paymentLimit == null ? "" : decimal(b.paymentLimit)
                  }
                />
              </label>
              <label>
                Upozornit od (%)
                <input
                  name="warningPercent"
                  type="number"
                  min={1}
                  max={100}
                  required
                  defaultValue={b?.warningPercent ?? 80}
                />
              </label>
            </div>
            <label className="inline-check">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={b?.enabled ?? true}
              />
              Sledovat rozpočet
            </label>
            <button className="primary" disabled={busy}>
              Uložit rozpočet
            </button>
            {b && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Odstranit rozpočet tohoto účtu? Platby zůstanou zachované.",
                    )
                  )
                    void run(() =>
                      call("/wallets/" + w.id + "/budget", undefined, "DELETE"),
                    );
                }}
              >
                Odstranit rozpočet
              </button>
            )}
          </form>
        )}
        <p role="status">{message}</p>
      </article>
      <BudgetCards
        wallets={data.wallets}
        budgets={data.budgets || []}
        entries={data.entries}
      />
    </details>
  );
}
