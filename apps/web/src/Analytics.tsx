import { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  ChartPie,
  ListFilter,
  CalendarClock,
  WalletCards,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  money,
  percentText,
  percentage,
  sum,
  net,
  groupEntries,
  flowTimeline,
  balanceTimeline,
  periodRange,
  previousRange,
  shiftDay,
  today,
  seriesForecast,
  csvCell,
  decimal,
  type FinancialEntry,
  type FinancialWallet,
} from "../../shared/finance";
import { Wallets } from "./Wallets";
import { ItemIcon } from "./ItemIcon";
import { call } from "./Settings";
import "./reports.css";
const statuses: Record<string, string> = {
  DONE: "Uskutečněno",
  PLANNED: "Plánováno",
  SKIPPED: "Přeskočeno",
};
const tabs = [
  ["summary", "Souhrn", ChartPie],
  ["categories", "Položky", ListFilter],
  ["recurring", "Trvalé platby", CalendarClock],
  ["transactions", "Transakce", ArrowLeftRight],
  ["wallets", "Účty", WalletCards],
] as const;
const chartMoney = (v: any) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(Number(v));
export function Analytics({
  data,
  period,
  setPeriod,
  walletId,
  onEdit,
  refresh,
  onManageSeries,
}: {
  data: any;
  period: string;
  setPeriod: (s: string) => void;
  walletId: string;
  onEdit: (e: FinancialEntry) => void;
  refresh: () => unknown;
  onManageSeries: () => void;
}) {
  const [tab, setTab] = useState("summary"),
    [anchor, setAnchor] = useState(today()),
    [customFrom, setCustomFrom] = useState(today().slice(0, 7) + "-01"),
    [customTo, setCustomTo] = useState(today()),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("ALL"),
    [status, setStatus] = useState("ALL"),
    [itemId, setItemId] = useState("ALL"),
    [onlyRegular, setOnlyRegular] = useState(false),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [limit, setLimit] = useState(5),
    [distribution, setDistribution] = useState("EXPENSE"),
    [sort, setSort] = useState("date"),
    [page, setPage] = useState(0),
    [seriesFilter, setSeriesFilter] = useState("ALL"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const all: FinancialEntry[] = data.entries,
    wallets: FinancialWallet[] = data.wallets || [];
  const scope = all.filter(
    (e) => walletId === "ALL" || e.walletId === walletId,
  );
  const range =
    period === "Vlastní"
      ? { from: customFrom, to: customTo }
      : periodRange(period, anchor);
  const invalid = !range.from || !range.to || range.from > range.to;
  const bounds = (s: string) =>
    /^\d+([.,]\d{1,2})?$/.test(s)
      ? BigInt(s.replace(",", ".").split(".")[0]) * 100n +
        BigInt((s.replace(",", ".").split(".")[1] || "").padEnd(2, "0"))
      : null;
  const low = bounds(min),
    high = bounds(max);
  const match = (e: FinancialEntry) =>
    (kind === "ALL" || e.item.kind === kind) &&
    (status === "ALL" || e.status === status) &&
    (itemId === "ALL" || (e.itemId || e.item.id) === itemId) &&
    (!onlyRegular || !!e.seriesId) &&
    (e.item.name + " " + e.comment)
      .toLocaleLowerCase("cs-CZ")
      .includes(query.toLocaleLowerCase("cs-CZ")) &&
    (low === null || BigInt(e.amount) >= low) &&
    (high === null || BigInt(e.amount) <= high);
  const filtered = invalid
    ? []
    : scope.filter(
        (e) => e.date >= range.from && e.date <= range.to && match(e),
      );
  const done = filtered.filter((e) => e.status === "DONE"),
    planned = filtered.filter((e) => e.status === "PLANNED");
  const income = sum(done, "INCOME"),
    expense = sum(done, "EXPENSE"),
    difference = income - expense;
  const compare =
    period === "Vše" || invalid ? null : previousRange(range.from, range.to);
  const previous = compare
    ? scope.filter(
        (e) =>
          e.status === "DONE" &&
          e.date >= compare.from &&
          e.date <= compare.to &&
          match(e),
      )
    : [];
  const currentBalance = wallets
    .filter((w) => walletId === "ALL" || w.id === walletId)
    .reduce((n, w) => n + BigInt(w.balance), 0n);
  const groups = groupEntries(done),
    chartGroups = groups.filter((g) => g.kind === distribution),
    totalDistribution = distribution === "INCOME" ? income : expense;
  const recurringExpense = sum(
    done.filter((e) => !!e.seriesId),
    "EXPENSE",
  );
  const dayCount =
    period === "Vše"
      ? new Set(done.map((e) => e.date)).size
      : invalid
        ? 0
        : Math.round(
            (Date.parse(range.to) - Date.parse(range.from)) / 86400000,
          ) + 1;
  const timeline = balanceTimeline(
    all,
    data.transfers || [],
    wallets,
    walletId,
    range.from,
    period === "Vše" ? today() : range.to,
  );
  const flows = flowTimeline(
    done,
    period === "Rok" || period === "Vše" ? "month" : "day",
  );
  const rows = [...filtered].sort((a, b) =>
    sort === "amount"
      ? BigInt(a.amount) > BigInt(b.amount)
        ? -1
        : BigInt(a.amount) < BigInt(b.amount)
          ? 1
          : 0
      : b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / 25)),
    safePage = Math.min(page, pageCount - 1);
  const itemChoices = [
    ...new Map(all.map((e) => [e.itemId || e.item.id, e.item])).values(),
  ];
  const after30 = shiftDay(today(), 29);
  const regular = (data.series || [])
    .filter(
      (s: any) =>
        (walletId === "ALL" || s.walletId === walletId) &&
        (kind === "ALL" || s.item?.kind === kind) &&
        (itemId === "ALL" || s.itemId === itemId) &&
        (s.item?.name || "")
          .toLocaleLowerCase("cs-CZ")
          .includes(query.toLocaleLowerCase("cs-CZ")),
    )
    .map((s: any) => ({
      ...s,
      forecast: seriesForecast(s, all, today(), after30),
      overdue: all.filter(
        (e) =>
          e.seriesId === s.id && e.status === "PLANNED" && e.date < today(),
      ),
    }));
  const regularTotal = (k: string) =>
    regular
      .filter((s: any) => s.item?.kind === k)
      .reduce(
        (n: bigint, s: any) =>
          n + s.forecast.reduce((a: bigint, f: any) => a + f.amount, 0n),
        0n,
      );
  const regularOverdue = regular.reduce(
    (n: bigint, s: any) =>
      n + sum(s.overdue.filter((e: any) => e.item.kind === "EXPENSE")),
    0n,
  );
  const regularShare = percentage(recurringExpense, expense);
  function reset() {
    setQuery("");
    setKind("ALL");
    setStatus("ALL");
    setItemId("ALL");
    setOnlyRegular(false);
    setMin("");
    setMax("");
    setPage(0);
  }
  function download() {
    const names = new Map(wallets.map((w) => [w.id, w.name]));
    const content = [
      [
        "Datum",
        "Účet",
        "Položka",
        "Typ",
        "Částka Kč",
        "Stav",
        "Opakovaná",
        "Komentář",
      ]
        .map(csvCell)
        .join(";"),
      ...rows.map((e) =>
        [
          e.date,
          names.get(e.walletId) || "",
          e.item.name,
          e.item.kind === "INCOME" ? "Příjem" : "Výdaj",
          decimal(e.amount),
          statuses[e.status],
          e.seriesId ? "Ano" : "Ne",
          e.comment,
        ]
          .map(csvCell)
          .join(";"),
      ),
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }),
    );
    a.download = "systematic-money-prehled.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function delta(value: bigint, old: bigint, expenses = false) {
    const d = value - old;
    return (
      <span
        className={
          "comparison-chip " +
          (d === 0n
            ? "neutral"
            : (expenses ? d < 0n : d > 0n)
              ? "positive"
              : "negative")
        }
      >
        {d > 0n ? "+" : ""}
        {money(d)}{" "}
        <span>
          ({old === 0n ? "bez základu" : percentText(percentage(d, old))})
        </span>
      </span>
    );
  }
  function breakdown() {
    return (
      <article className="report-card">
        <div className="report-title">
          <h3>Rozdělení {distribution === "INCOME" ? "příjmů" : "výdajů"}</h3>
          <div className="report-segment">
            <button
              className={distribution === "EXPENSE" ? "selected" : ""}
              onClick={() => setDistribution("EXPENSE")}
            >
              Výdaje
            </button>
            <button
              className={distribution === "INCOME" ? "selected" : ""}
              onClick={() => setDistribution("INCOME")}
            >
              Příjmy
            </button>
          </div>
        </div>
        {chartGroups.length ? (
          <>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={255}>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={chartGroups.map((g) => ({
                      ...g,
                      value: Number(g.amount) / 100,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={76}
                    outerRadius={112}
                    paddingAngle={2}
                  >
                    {chartGroups.map((g) => (
                      <Cell key={g.id} fill={g.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={chartMoney} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <small>CELKEM</small>
                <b>{money(totalDistribution)}</b>
              </div>
            </div>
            <div className="breakdown-list">
              {chartGroups.slice(0, limit).map((g) => (
                <button
                  key={g.id}
                  className="breakdown-row"
                  onClick={() => {
                    setItemId(g.id);
                    setPage(0);
                    setTab("transactions");
                  }}
                >
                  <i style={{ background: g.color }} />
                  <span>
                    {g.name}
                    <small>
                      {g.count} plateb · průměr{" "}
                      {money(g.amount / BigInt(g.count))}
                    </small>
                  </span>
                  <div>
                    <b>{money(g.amount)}</b>
                    <small>
                      {percentText(percentage(g.amount, totalDistribution))}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="report-empty">
            Pro tento výběr zatím nejsou uskutečněné platby.
          </p>
        )}
      </article>
    );
  }
  return (
    <div className="analytics-center">
      <div className="report-tabs" role="tablist" aria-label="Části přehledů">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            id={"report-tab-" + id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const index = tabs.findIndex((t) => t[0] === id);
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? tabs.length - 1
                    : (index +
                        (e.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              setTab(tabs[next][0]);
              document.getElementById("report-tab-" + tabs[next][0])?.focus();
            }}
            aria-selected={tab === id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      {tab !== "wallets" && (
        <section className="report-filters">
          <div className="report-title">
            <div className="period">
              {["Den", "Týden", "Měsíc", "Rok", "Vše", "Vlastní"].map((p) => (
                <button
                  key={p}
                  className={period === p ? "selected" : ""}
                  onClick={() => {
                    setPeriod(p);
                    setPage(0);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="report-buttons">
              <button
                onClick={download}
                aria-label="Export CSV zvoleného přehledu"
              >
                <Download size={17} /> CSV
              </button>
              <button onClick={() => window.print()}>PDF / tisk</button>
            </div>
          </div>
          {period === "Vlastní" ? (
            <div className="filter-dates">
              <label>
                Od data
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                Do data
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            </div>
          ) : (
            period !== "Vše" && (
              <label className="anchor-filter">
                Datum v období
                <input
                  type="date"
                  value={anchor}
                  onChange={(e) => {
                    if (e.target.value) setAnchor(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            )
          )}
          {invalid && (
            <p role="alert">
              Zadejte platné období. Konec nesmí předcházet začátku.
            </p>
          )}
          <details className="advanced-filters">
            <summary>
              <SlidersHorizontal size={17} /> Podrobnější filtry{" "}
              {query ||
              kind !== "ALL" ||
              status !== "ALL" ||
              itemId !== "ALL" ||
              onlyRegular ||
              min ||
              max
                ? "· aktivní"
                : ""}
            </summary>
            <div className="filters-grid">
              <label>
                Hledat platbu
                <input
                  placeholder="Název nebo komentář"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                Typ plateb
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="ALL">Příjmy i výdaje</option>
                  <option value="INCOME">Pouze příjmy</option>
                  <option value="EXPENSE">Pouze výdaje</option>
                </select>
              </label>
              <label>
                Stav plateb
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="ALL">Všechny stavy</option>
                  {Object.entries(statuses).map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Konkrétní položka
                <select
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="ALL">Všechny položky</option>
                  {itemChoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Částka od (Kč)
                <input
                  inputMode="decimal"
                  value={min}
                  onChange={(e) => {
                    setMin(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                Částka do (Kč)
                <input
                  inputMode="decimal"
                  value={max}
                  onChange={(e) => {
                    setMax(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={onlyRegular}
                  onChange={(e) => {
                    setOnlyRegular(e.target.checked);
                    setPage(0);
                  }}
                />{" "}
                Jen opakované platby
              </label>
              <button onClick={reset}>Vymazat filtry</button>
            </div>
            {((min && low === null) ||
              (max && high === null) ||
              (low !== null && high !== null && low > high)) && (
              <p role="alert">
                Zkontrolujte rozsah částek; neplatná hodnota se nepoužije.
              </p>
            )}
          </details>
          <p className="report-note">
            {period === "Vše"
              ? "Celá historie"
              : `${range.from} až ${range.to}`}{" "}
            ·{" "}
            {walletId === "ALL"
              ? "Všechny finanční účty"
              : wallets.find((w) => w.id === walletId)?.name}
            . Součty a podíly vycházejí z uskutečněných plateb. Převody mezi
            vlastními účty jsou oddělené.
          </p>
        </section>
      )}
      {(tab === "summary" ||
        tab === "categories" ||
        tab === "transactions") && (
        <>
          <div className="report-kpis">
            <article className="kpi-income">
              <span>
                <ArrowUpRight size={19} /> Příjmy
              </span>
              <strong>{money(income)}</strong>
              {compare && delta(income, sum(previous, "INCOME"))}
            </article>
            <article className="kpi-expense">
              <span>
                <ArrowDownRight size={19} /> Výdaje
              </span>
              <strong>{money(expense)}</strong>
              {compare && delta(expense, sum(previous, "EXPENSE"), true)}
            </article>
            <article className="kpi-net">
              <span>Čistý rozdíl</span>
              <strong className={difference < 0n ? "negative" : "positive"}>
                {money(difference)}
              </strong>
              <small>{done.length} uskutečněných plateb</small>
            </article>
            <article className="kpi-savings">
              <span>Podíl odložených příjmů</span>
              <strong>{percentText(percentage(difference, income))}</strong>
              <small>
                {income === 0n
                  ? "Bez příjmů nelze podíl určit"
                  : "(Příjmy − výdaje) / příjmy"}
              </small>
            </article>
          </div>
          {compare && (
            <p className="report-note">
              Změna vůči předchozímu stejně dlouhému období: {compare.from} až{" "}
              {compare.to}. Nulový základ se nezobrazuje jako 0% změna.
            </p>
          )}
        </>
      )}
      {tab === "summary" && (
        <>
          <div className="report-grid">
            <article className="report-card">
              <div className="report-title">
                <div>
                  <h3>Vývoj zůstatku</h3>
                  <p>
                    Aktuálně <b>{money(currentBalance)}</b>
                  </p>
                </div>
                <span className="report-badge">
                  {walletId === "ALL" ? "Všechny účty" : "Vybraný účet"}
                </span>
              </div>
              <p className="report-note">
                Zahrnuje počáteční zůstatek, všechny uskutečněné platby a
                převody vybraných účtů. Podrobné filtry plateb tento graf
                neomezují.
              </p>
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient
                      id="balanceFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#14b8a6"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor="#14b8a6"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e6edf2" />
                  <XAxis
                    dataKey="date"
                    minTickGap={45}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis width={65} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={chartMoney} />
                  <Area
                    isAnimationActive={false}
                    dataKey="Zůstatek"
                    type="stepAfter"
                    stroke="#0d9488"
                    fill="url(#balanceFill)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </article>
            {breakdown()}
          </div>
          <article className="report-card">
            <h3>Příjmy a výdaje v čase</h3>
            {flows.length ? (
              <ResponsiveContainer width="100%" height={285}>
                <BarChart data={flows}>
                  <CartesianGrid vertical={false} stroke="#e6edf2" />
                  <XAxis
                    dataKey="date"
                    minTickGap={30}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis width={65} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={chartMoney} />
                  <Legend />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Příjmy"
                    fill="#10b981"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Výdaje"
                    fill="#f43f5e"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="report-empty">
                Graf se naplní po první uskutečněné platbě v tomto období.
              </p>
            )}
          </article>
          <div className="report-insights">
            <article>
              <small>Průměrný denní výdaj</small>
              <strong>
                {money(dayCount ? expense / BigInt(dayCount) : 0n)}
              </strong>
              <p>
                {period === "Vše"
                  ? "Za dny s uskutečněnou platbou."
                  : "Za všechny kalendářní dny zvoleného období."}
              </p>
            </article>
            <article>
              <small>Pravidelné výdaje</small>
              <strong>{percentText(regularShare)}</strong>
              <div className="percentage-track">
                <i
                  style={{
                    width: Math.min(100, regularShare || 0) + "%",
                    background: "#8b5cf6",
                  }}
                />
              </div>
              <p>{money(recurringExpense)} z celkových výdajů.</p>
              <button onClick={() => setTab("recurring")}>
                Zobrazit trvalé platby
              </button>
            </article>
            <article>
              <small>Plánované platby v období</small>
              <strong>{planned.length}</strong>
              <p>
                <span className="positive">
                  Příjmy {money(sum(planned, "INCOME"))}
                </span>
                <br />
                <span className="negative">
                  Výdaje {money(sum(planned, "EXPENSE"))}
                </span>
              </p>
              <button
                onClick={() => {
                  setStatus("PLANNED");
                  setTab("transactions");
                  setPage(0);
                }}
              >
                Otevřít plánované platby
              </button>
            </article>
          </div>
        </>
      )}
      {tab === "categories" && (
        <>
          <div className="report-title">
            <h2>Podíly, četnost a nejvyšší platby</h2>
            <label>
              Počet TOP položek
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={5}>TOP 5</option>
                <option value={10}>TOP 10</option>
                <option value={1000}>Všechny položky</option>
              </select>
            </label>
          </div>
          <div className="report-grid">
            {breakdown()}
            <article className="report-card">
              <h3>Nejvyšší jednotlivé platby</h3>
              {[...done]
                .sort((a, b) => (BigInt(a.amount) > BigInt(b.amount) ? -1 : 1))
                .slice(0, 5)
                .map((e) => (
                  <button
                    className="breakdown-row"
                    key={e.id}
                    onClick={() => onEdit(e)}
                  >
                    <ItemIcon item={e.item} />
                    <span>
                      {e.item.name}
                      <small>
                        {e.date} ·{" "}
                        {wallets.find((w) => w.id === e.walletId)?.name}
                      </small>
                    </span>
                    <b
                      className={
                        e.item.kind === "INCOME" ? "positive" : "negative"
                      }
                    >
                      {e.item.kind === "INCOME" ? "+" : "−"}
                      {money(e.amount)}
                    </b>
                  </button>
                ))}
              {!done.length && <p>Žádné uskutečněné platby.</p>}
            </article>
          </div>
          <article className="report-card">
            <h3>Všechny položky podle objemu</h3>
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Položka</th>
                    <th>Celkem</th>
                    <th>Podíl v typu</th>
                    <th>Počet</th>
                    <th>Průměr</th>
                    <th>Nejvyšší</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.slice(0, limit).map((g) => (
                    <tr key={g.id}>
                      <td>
                        <button
                          className="table-link"
                          onClick={() => {
                            setItemId(g.id);
                            setTab("transactions");
                            setPage(0);
                          }}
                        >
                          <i
                            className="color-dot"
                            style={{ background: g.color }}
                          />
                          {g.name}
                          <small>
                            {g.kind === "INCOME" ? "Příjem" : "Výdaj"}
                          </small>
                        </button>
                      </td>
                      <td
                        className={
                          g.kind === "INCOME" ? "positive" : "negative"
                        }
                      >
                        {money(g.amount)}
                      </td>
                      <td>
                        {percentText(
                          percentage(
                            g.amount,
                            g.kind === "INCOME" ? income : expense,
                          ),
                        )}
                      </td>
                      <td>{g.count}×</td>
                      <td>{money(g.amount / BigInt(g.count))}</td>
                      <td>{money(g.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
      {tab === "recurring" && (
        <>
          <div className="report-title">
            <div>
              <h2>Trvalé a opakované platby</h2>
              <p>
                Výhled na příštích 30 dní: {today()} až {after30}. Zohledňuje
                potvrzené, přeskočené i jednotlivě upravené výskyty.
              </p>
            </div>
            <button className="primary" onClick={onManageSeries}>
              Spravovat opakování
            </button>
          </div>
          <p className="report-note">
            Výhled používá zvolený účet, typ, položku a hledání. Časové období
            výše se na pevný 30denní výhled nevztahuje. Jde o plán evidence,
            nikoli o zadání trvalého příkazu bance.
          </p>
          <div className="report-kpis">
            <article className="kpi-expense">
              <span>Plánované pravidelné výdaje</span>
              <strong>{money(regularTotal("EXPENSE"))}</strong>
              <small>Na příštích 30 dní</small>
            </article>
            <article className="kpi-income">
              <span>Plánované pravidelné příjmy</span>
              <strong>{money(regularTotal("INCOME"))}</strong>
              <small>Na příštích 30 dní</small>
            </article>
            <article className="kpi-net">
              <span>Po termínu · výdaje</span>
              <strong className="negative">{money(regularOverdue)}</strong>
              <small>Čekají na potvrzení</small>
            </article>
            <article>
              <span>Opakované série</span>
              <strong>{regular.length}</strong>
              <small>
                {regular.filter((s: any) => !s.paused).length} nepozastavených
              </small>
            </article>
          </div>
          <div className="report-title">
            <label>
              Zobrazit série
              <select
                value={seriesFilter}
                onChange={(e) => setSeriesFilter(e.target.value)}
              >
                <option value="ALL">Všechny série</option>
                <option value="ACTIVE">Nepozastavené</option>
                <option value="PAUSED">Pozastavené</option>
                <option value="OVERDUE">S platbou po termínu</option>
              </select>
            </label>
            <p role="status">{notice}</p>
          </div>
          <div className="recurring-grid">
            {regular
              .filter(
                (s: any) =>
                  seriesFilter === "ALL" ||
                  (seriesFilter === "PAUSED"
                    ? s.paused
                    : seriesFilter === "OVERDUE"
                      ? s.overdue.length
                      : !s.paused),
              )
              .map((s: any) => (
                <article className="recurring-card" key={s.id}>
                  <div className="report-title">
                    <div className="recurring-name">
                      <span style={{ color: s.item?.color }}>
                        {s.item && <ItemIcon item={s.item} />}
                      </span>
                      <div>
                        <h3>{s.item?.name || "Původní položka"}</h3>
                        <small>
                          {wallets.find((w) => w.id === s.walletId)?.name}
                        </small>
                      </div>
                    </div>
                    <span
                      className={
                        "status-pill " + (s.paused ? "paused" : "active-series")
                      }
                    >
                      {s.paused
                        ? "Pozastaveno"
                        : s.end && s.end < today()
                          ? "Ukončeno"
                          : "Aktivní"}
                    </span>
                  </div>
                  <strong
                    className={
                      s.item?.kind === "INCOME" ? "positive" : "negative"
                    }
                  >
                    {s.item?.kind === "INCOME" ? "+" : "−"}
                    {money(s.amount)}
                  </strong>
                  <p>
                    Každý {s.interval}.{" "}
                    {
                      (
                        {
                          DAILY: "den",
                          WEEKLY: "týden",
                          MONTHLY: "měsíc",
                          YEARLY: "rok",
                        } as any
                      )[s.frequency]
                    }{" "}
                    · od {s.start}
                    {s.end ? " do " + s.end : ""}
                    {s.count
                      ? " · " + s.count + " opakování"
                      : " · bez limitu počtu"}
                  </p>
                  <div className="recurring-facts">
                    <span>
                      Nejbližší v 30 dnech
                      <b>{s.forecast[0]?.date || "Žádná"}</b>
                    </span>
                    <span>
                      Celkem v 30 dnech
                      <b>
                        {money(
                          s.forecast.reduce(
                            (n: bigint, f: any) => n + f.amount,
                            0n,
                          ),
                        )}
                      </b>
                    </span>
                  </div>
                  {s.overdue.length > 0 && (
                    <p className="overdue-note">
                      {s.overdue.length} plateb po termínu čeká na potvrzení.
                    </p>
                  )}
                  <details>
                    <summary>Rozpis a stav plateb</summary>
                    {s.forecast.map((f: any, n: number) => (
                      <div className="schedule-row" key={f.id || n}>
                        <span>{f.date}</span>
                        <b>{money(f.amount)}</b>
                        {f.id && (
                          <button
                            onClick={() =>
                              onEdit(all.find((e) => e.id === f.id)!)
                            }
                          >
                            Detail
                          </button>
                        )}
                      </div>
                    ))}
                    {s.overdue.map((e: FinancialEntry) => (
                      <button
                        className="breakdown-row"
                        key={e.id}
                        onClick={() => onEdit(e)}
                      >
                        <span>Po termínu · {e.date}</span>
                        <b>{money(e.amount)}</b>
                      </button>
                    ))}
                    <p className="report-note">
                      Pozastavení zastaví generování nových výskytů. Již
                      naplánované platby zůstávají v evidenci.
                    </p>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setNotice("");
                        try {
                          await call(
                            "/series/" + s.id,
                            { paused: !s.paused },
                            "PATCH",
                          );
                          await refresh();
                        } catch (e) {
                          setNotice((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {s.paused
                        ? "Obnovit generování"
                        : "Pozastavit generování"}
                    </button>
                  </details>
                </article>
              ))}
          </div>
          {!regular.length && (
            <article className="report-empty">
              Zatím žádné opakované platby v tomto výběru. Nájem, výplatu nebo
              předplatné přidáte přes Spravovat opakování.
            </article>
          )}
        </>
      )}
      {tab === "transactions" && (
        <article className="report-card">
          <div className="report-title">
            <div>
              <h2>Transakce</h2>
              <p>
                {rows.length} plateb odpovídá filtrům
                {itemId !== "ALL" ? " · vybraná položka" : ""}
              </p>
            </div>
            <label>
              Řazení
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(0);
                }}
              >
                <option value="date">Od nejnovějších</option>
                <option value="amount">Od nejvyšší částky</option>
              </select>
            </label>
          </div>
          {itemId !== "ALL" && (
            <button onClick={() => setItemId("ALL")}>
              Zrušit filtr položky
            </button>
          )}
          <div className="report-transactions">
            {rows.slice(safePage * 25, safePage * 25 + 25).map((e) => (
              <button
                key={e.id}
                className="report-transaction"
                aria-label={"Detail platby " + e.item.name + " " + e.date}
                onClick={() => onEdit(e)}
              >
                <span
                  className="transaction-symbol"
                  style={{
                    background: e.item.color + "18",
                    color: e.item.color,
                  }}
                >
                  <ItemIcon item={e.item} />
                </span>
                <span>
                  <b>{e.item.name}</b>
                  <small>
                    {e.date} · {wallets.find((w) => w.id === e.walletId)?.name}
                    {e.seriesId ? " · opakovaná" : ""}
                  </small>
                  {e.comment && <small>{e.comment}</small>}
                </span>
                <div>
                  <b
                    className={
                      e.item.kind === "INCOME" ? "positive" : "negative"
                    }
                  >
                    {e.item.kind === "INCOME" ? "+" : "−"}
                    {money(e.amount)}
                  </b>
                  <small className={"status-pill " + e.status.toLowerCase()}>
                    {statuses[e.status]}
                    {e.status === "PLANNED" && e.date < today()
                      ? " · po termínu"
                      : ""}
                  </small>
                </div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {!rows.length && (
            <p className="report-empty">
              Žádné platby neodpovídají zvoleným filtrům.
            </p>
          )}
          <div className="report-pagination">
            <button
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label="Předchozí strana transakcí"
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {safePage + 1} / {pageCount}
            </span>
            <button
              disabled={safePage + 1 >= pageCount}
              onClick={() => setPage(safePage + 1)}
              aria-label="Další strana transakcí"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </article>
      )}
      {tab === "wallets" && <Wallets data={data} refresh={refresh} />}
    </div>
  );
}
