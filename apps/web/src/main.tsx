import { currencies, currencySymbol } from "../../shared/currencies";
import { defaultDesign } from "../../shared/design";
import { applyDesign } from "./DesignSettings";
import { BudgetCards } from "./Budgets";
import {
  money as formatMoney,
  sum,
  net,
  today,
  newestFirst,
  type FinancialEntry,
  type FinancialWallet,
} from "../../shared/finance";
import { WalletSelect } from "./Wallets";
import { BankReturn, captureBankReturn } from "./BankReturn";
import { nativeWidgets, nativeWidgetSupport } from "./nativeWidgets";
import { DashboardChart } from "./DashboardChart";
import { itemStyle } from "./ItemEditor";
import {
  WalletCards,
  House,
  CalendarDays,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  UserRound,
  Menu,
  Plus,
  Minus,
  Pin,
} from "lucide-react";
import { ItemIcon } from "./ItemIcon";
import { Week } from "./Week";
import { Analytics } from "./Analytics";
import { Notifications } from "./Notifications";
import { Settings, Admin } from "./Settings";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import "./style.css";
import "./themes.css";
async function api(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({
    error:
      r.status === 429
        ? "Příliš mnoho pokusů. Vyčkejte několik minut."
        : "Server není dostupný. Zkuste to prosím znovu.",
  }));
  if (!r.ok) throw Object.assign(new Error(d.error), { status: r.status });
  return d;
}
const day = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(d);
type Item = { id: string; name: string; kind: string; color: string };
type Entry = FinancialEntry;
type Data = {
  user: { username: string; role: string; opening: string; preferences?: any };
  items: Item[];
  entries: Entry[];
  balance: string;
  balancesByCurrency: Record<string, string>;
  budgets: any[];
  wallets: FinancialWallet[];
  transfers: any[];
  series: any[];
};
const pendingBankReturn = captureBankReturn();
function App() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [walletId, setWalletId] = useState("ALL"),
    [displayCurrency, setDisplayCurrency] = useState("CZK"),
    [formWalletId, setFormWalletId] = useState(""),
    [focusSeries, setFocusSeries] = useState(false),
    [deleteEntry, setDeleteEntry] = useState(false),
    [confirmDate, setConfirmDate] = useState(day()),
    [menu, setMenu] = useState(false),
    [pinned, setPinned] = useState(false),
    [register, setRegister] = useState(location.pathname === "/register"),
    [open, setOpen] = useState<boolean | null>(null),
    [setupError, setSetupError] = useState(""),
    [authBusy, setAuthBusy] = useState(false),
    [authNotice, setAuthNotice] = useState(""),
    [form, setForm] = useState(
      ["INCOME", "EXPENSE"].includes(
        new URLSearchParams(location.search).get("quick") || "",
      )
        ? new URLSearchParams(location.search).get("quick")!
        : "",
    ),
    [date, setDate] = useState(
      new URLSearchParams(location.search).get("date") || day(),
    ),
    [month, setMonth] = useState(new Date()),
    [period, setPeriod] = useState("Měsíc"),
    [editingEntry, setEditingEntry] = useState<Entry | null>(null),
    [quickPreset, setQuickPreset] = useState<any>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("action");
    if (!data || !id) return;
    let active = true;
    api("/quick-actions")
      .then((actions) => {
        if (!active) return;
        const a = actions.find((x: any) => x.id === id);
        const item = data.items.find((i) => i.id === a?.itemId);
        if (!a || !item) {
          setError("Rychlá akce již není dostupná.");
          return;
        }
        setQuickPreset(a);
        setEditingEntry(null);
        setForm(item.kind);
        history.replaceState(null, "", location.pathname);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [!!data]);
  useEffect(() => {
    if (!data) return;
    let active = true;
    const sync = () => {
      if (document.visibilityState === "hidden") return;
      void api("/data")
        .then((next) => {
          if (active) setData(next);
        })
        .catch(() => {});
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    const timer = window.setInterval(sync, 60000);
    const listener = nativeWidgetSupport()
      ? NativeApp.addListener("appStateChange", ({ isActive }) => {
          if (isActive) sync();
        })
      : null;
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      void listener?.then((handle) => handle.remove());
    };
  }, [!!data]);
  useEffect(() => {
    if (!data || !pendingBankReturn) return;
    const payload = { ...pendingBankReturn };
    pendingBankReturn.code = "";
    if (!payload.code) return;
    void api("/banks/complete", payload)
      .then(() => {
        setPage(3);
      })
      .catch((e) => setError(e.message));
  }, [!!data]);
  useEffect(() => {
    const design = data?.user.preferences?.design;
    applyDesign(design);
    const media = matchMedia("(prefers-color-scheme: dark)"),
      change = () => applyDesign(design);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [JSON.stringify(data?.user.preferences?.design)]);
  useEffect(() => {
    if (!form || !data) return;
    const preferred =
      editingEntry?.walletId ||
      quickPreset?.walletId ||
      (walletId !== "ALL" ? walletId : "");
    setFormWalletId(
      preferred ||
        data.wallets.find((w) => !w.archived && w.currency === displayCurrency)
          ?.id ||
        data.wallets.find((w) => w.isDefault)?.id ||
        "",
    );
  }, [form, editingEntry?.id, quickPreset?.id, !!data]);
  const submitKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!form) return;
    setDeleteEntry(false);
    setConfirmDate(day());
    submitKey.current = crypto.randomUUID();
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector("[role=dialog]") as HTMLElement;
    const first = dialog?.querySelector("button,input,select") as HTMLElement;
    first?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setForm("");
      if (event.key === "Tab" && dialog) {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input,select",
          ),
        );
        const start = nodes[0],
          end = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === start) {
          event.preventDefault();
          end?.focus();
        } else if (!event.shiftKey && document.activeElement === end) {
          event.preventDefault();
          start?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [form, !!data]);
  const refresh = () =>
    api("/data")
      .then(setData)
      .catch((e) => {
        if (e.status === 401) setData(null);
        else setError(e.message);
      });
  async function checkSetup() {
    setSetupError("");
    setOpen(null);
    try {
      const d = await api("/setup");
      if (typeof d.open !== "boolean")
        throw Error("Server vrátil neplatný stav registrace.");
      setOpen(d.open);
      setRegister(d.open || location.pathname === "/register");
    } catch (e) {
      setSetupError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    void checkSetup();
  }, []);
  async function act(fn: () => Promise<unknown>) {
    try {
      setError("");
      await fn();
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    }
  }
  function submit(
    e: React.FormEvent<HTMLFormElement>,
    fn: (v: Record<string, string>) => Promise<unknown>,
  ) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    void act(() => fn(v));
  }
  const nav = ["Hlavní menu", "Kalendář", "Přehledy", "Nastavení", "Profil"];
  if (!data)
    return (
      <main className="login">
        <h1>
          <WalletCards size={34} />
          SYSTEMATIC MONEY
        </h1>
        <p>Vaše peníze. Váš přehled.</p>
        {open === null ? (
          <section aria-live="polite">
            {setupError ? (
              <>
                <h2>Aplikace není připravená</h2>
                <p role="alert">{setupError}</p>
                <button onClick={() => void checkSetup()}>Zkusit znovu</button>
              </>
            ) : (
              <p>Ověřuji možnost vytvoření účtu…</p>
            )}
          </section>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (authBusy) return;
              const v = Object.fromEntries(new FormData(e.currentTarget));
              setAuthBusy(true);
              setError("");
              setAuthNotice("");
              try {
                if (register) {
                  await api("/auth/register", v);
                  setRegister(false);
                  setOpen(false);
                  setAuthNotice("Účet byl vytvořen. Přihlašuji vás…");
                }
                await api("/auth/login", v);
                if (location.pathname === "/register")
                  history.replaceState(null, "", "/");
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setAuthBusy(false);
              }
            }}
          >
            <h2>
              {open
                ? "Vytvoření hlavního účtu"
                : register
                  ? "Registrace přes pozvánku"
                  : "Přihlášení"}
            </h2>
            {open && (
              <p>
                Aplikace zatím nemá vlastníka. Zvolte si nové jméno a heslo;
                tento účet získá roli OWNER.
              </p>
            )}
            {register && !open && (
              <p>
                Zvolte si nové uživatelské jméno a heslo a vložte kód od
                vlastníka. Vznikne váš vlastní prázdný účet se soukromými
                financemi.
              </p>
            )}
            {authNotice && <p role="status">{authNotice}</p>}
            <label>
              Uživatelské jméno
              <input
                name="username"
                minLength={3}
                maxLength={64}
                required
                autoComplete="username"
              />
              <small>
                Alespoň 3 znaky: písmena, číslice, pomlčka nebo podtržítko.
              </small>
            </label>
            <label>
              Heslo (alespoň 12 znaků)
              <input
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            {register && !open && (
              <label>
                Pozvánkový kód
                <input
                  name="invite"
                  required
                  maxLength={200}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="SM-…"
                />
              </label>
            )}
            <button disabled={authBusy}>
              {authBusy
                ? "Zpracovávám…"
                : open
                  ? "Vytvořit hlavní účet"
                  : register
                    ? "Registrovat"
                    : "Přihlásit se"}
            </button>
            {!open && (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => {
                  setRegister(!register);
                  history.replaceState(null, "", register ? "/" : "/register");
                  setError("");
                }}
              >
                {register
                  ? "Zpět k přihlášení"
                  : open
                    ? "Vytvořit hlavní účet"
                    : "Mám pozvánku"}
              </button>
            )}
            <p role="alert">{error}</p>
          </form>
        )}
      </main>
    );
  const wallets = data.wallets || [];
  const currency =
    wallets.find((w) => w.id === walletId)?.currency || displayCurrency;
  const money = (v: string | bigint | number) => formatMoney(v, currency);
  const currencyWallets = wallets.filter((w) => w.currency === currency);
  const design = { ...defaultDesign, ...data.user.preferences?.design };
  const formCurrency =
    wallets.find((w) => w.id === formWalletId)?.currency || currency;
  const selectedWallet = wallets.some((w) => w.id === walletId)
    ? walletId
    : "ALL";
  const scopedEntries = data.entries
    .filter(
      (e) =>
        currencyWallets.some((w) => w.id === e.walletId) &&
        (selectedWallet === "ALL" || e.walletId === selectedWallet),
    )
    .sort(newestFirst);
  const scopedBalance =
    selectedWallet === "ALL"
      ? data.balancesByCurrency?.[currency] || "0"
      : wallets.find((w) => w.id === selectedWallet)!.balance;
  const entries = scopedEntries.filter(
    (e) => e.date === date && e.status !== "SKIPPED",
  );
  const end = day();
  const start = new Date();
  if (period === "Týden")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === "Měsíc") start.setDate(1);
  if (period === "Rok") start.setMonth(0, 1);
  const filtered = scopedEntries.filter(
    (e) => period === "Vše" || (e.date >= day(start) && e.date <= end),
  );
  const total = (kind: string) =>
    sum(
      filtered.filter((e) => e.status === "DONE"),
      kind,
    );
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(month.getFullYear(), month.getMonth(), 1);
    d.setDate(1 - ((d.getDay() + 6) % 7) + i);
    return d;
  });
  return (
    <>
      <div className="edge" onMouseEnter={() => setMenu(true)} />
      <aside
        className={menu || pinned ? "shown" : ""}
        onMouseLeave={() => !pinned && setMenu(false)}
      >
        <h2>
          ◈ SYSTEMATIC
          <br /> MONEY
        </h2>
        {nav.map((n, i) => (
          <button
            className={page === i ? "active" : ""}
            key={n}
            onClick={() => {
              setPage(i);
              setMenu(false);
            }}
          >
            {React.createElement(
              [
                House,
                CalendarDays,
                ChartNoAxesCombined,
                SettingsIcon,
                UserRound,
              ][i],
              { size: 21 },
            )}{" "}
            {n}
          </button>
        ))}
        <button onClick={() => setPinned(!pinned)}>
          {pinned ? "Odepnout" : "Připnout"} panel
        </button>
      </aside>
      <main>
        <header>
          <button onClick={() => setMenu(!menu)} aria-label="Otevřít menu">
            {<Menu size={21} />}
          </button>
          <strong>
            <WalletCards size={28} color="#00aa9e" />
            SYSTEMATIC MONEY
          </strong>
          <span>{data.user.username}</span>
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              SYSTEMATIC MONEY / {nav[page].toUpperCase()}
            </span>
            <h1>{nav[page]}</h1>
            <p>
              {
                [
                  "Každá platba na svém místě. Váš den začíná přehledem.",
                  "Plánujte dopředu. Mějte přehled o každém dni.",
                  "Zjistěte, kam vaše peníze směřují.",
                  "Přizpůsobte si finance tak, jak vám vyhovuje.",
                  "Váš účet, přístup a zabezpečení.",
                ][page]
              }
            </p>
          </div>
          <span className="page-date">
            {new Date().toLocaleDateString("cs-CZ", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        {page < 3 && (
          <div className="account-scope">
            <WalletCards size={21} />
            <label>
              Zobrazený finanční účet
              <select
                value={selectedWallet}
                onChange={(e) => {
                  setWalletId(e.target.value);
                  const w = wallets.find((w) => w.id === e.target.value);
                  if (w) setDisplayCurrency(w.currency);
                }}
              >
                <option value="ALL">Všechny účty ve zvolené měně</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {w.currency}
                    {w.archived ? " (archivovaný)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Měna přehledu
              <select
                aria-label="Měna přehledu"
                value={currency}
                onChange={(e) => {
                  setDisplayCurrency(e.target.value);
                  setWalletId("ALL");
                }}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {selectedWallet === "ALL"
                ? currencyWallets.length + " účtů"
                : wallets.find((w) => w.id === selectedWallet)?.name}
              <b>{money(scopedBalance)}</b>
            </span>
          </div>
        )}
        {page < 3 && (
          <>
            {page < 2 && (
              <>
                <div className="period">
                  {["Den", "Týden", "Měsíc", "Rok", "Vše"].map((p) => (
                    <button
                      className={period === p ? "selected" : ""}
                      onClick={() => setPeriod(p)}
                      key={p}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="stats">
                  <article className="balance">
                    <small>Aktuální zůstatek</small>
                    <h2>{money(scopedBalance)}</h2>
                  </article>
                  <article className="income">
                    <small>Uskutečněné příjmy</small>
                    <h2>{money(total("INCOME"))}</h2>
                  </article>
                  <article className="expense">
                    <small>Uskutečněné výdaje</small>
                    <h2>{money(total("EXPENSE"))}</h2>
                  </article>
                </div>
                <div className="actions">
                  <button
                    className="income"
                    onClick={() => {
                      setEditingEntry(null);
                      setQuickPreset(null);
                      setForm("INCOME");
                    }}
                  >
                    {<Plus size={21} />} PŘÍJEM
                  </button>
                  <button
                    className="expense"
                    onClick={() => {
                      setEditingEntry(null);
                      setQuickPreset(null);
                      setForm("EXPENSE");
                    }}
                  >
                    {<Minus size={21} />} VÝDAJ
                  </button>
                </div>
                {page === 0 && (
                  <div className="dashboard-overview">
                    {design.showBudgets && (
                      <div>
                        <div className="chart-heading">
                          <h2>Rozpočty pod kontrolou</h2>
                          <button
                            onClick={() => {
                              setPage(3);
                              setTimeout(() => {
                                const el = document.getElementById(
                                  "budget-settings",
                                ) as HTMLDetailsElement;
                                if (el) {
                                  el.open = true;
                                  el.scrollIntoView({ block: "start" });
                                }
                              }, 0);
                            }}
                          >
                            Nastavit
                          </button>
                        </div>
                        <BudgetCards
                          wallets={currencyWallets.filter(
                            (w) =>
                              selectedWallet === "ALL" ||
                              w.id === selectedWallet,
                          )}
                          budgets={data.budgets || []}
                          entries={scopedEntries}
                        />
                      </div>
                    )}
                    {design.showUpcoming && (
                      <article className="upcoming-card">
                        <span className="eyebrow">CO VÁS ČEKÁ</span>
                        <h2>Nejbližší plánované platby</h2>
                        {!scopedEntries.some((e) => e.status === "PLANNED") && (
                          <p>Žádné čekající platby. Vše máte pod kontrolou.</p>
                        )}
                        {scopedEntries
                          .filter((e) => e.status === "PLANNED")
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .slice(0, 5)
                          .map((e) => (
                            <button
                              className="insight-payment"
                              key={e.id}
                              onClick={() => {
                                setEditingEntry(e);
                                setQuickPreset(null);
                                setForm(e.item.kind);
                              }}
                            >
                              <span>
                                <b>{e.item.name}</b>
                                <small>
                                  {e.date}{" "}
                                  {e.date < today() ? "· po termínu" : ""}
                                  {e.merchant ? " · " + e.merchant : ""}
                                </small>
                              </span>
                              <b
                                className={
                                  e.item.kind === "INCOME"
                                    ? "positive"
                                    : "negative"
                                }
                              >
                                {e.item.kind === "INCOME" ? "+" : "−"}
                                {money(e.amount)}
                              </b>
                            </button>
                          ))}
                      </article>
                    )}
                  </div>
                )}
                {page === 0 && design.showChart && (
                  <DashboardChart entries={scopedEntries} currency={currency} />
                )}
              </>
            )}
            {page === 2 ? (
              <Analytics
                data={data}
                currency={currency}
                period={period}
                setPeriod={setPeriod}
                walletId={selectedWallet}
                refresh={refresh}
                onEdit={(e) => {
                  setEditingEntry(e);
                  setQuickPreset(null);
                  setForm(e.item.kind);
                }}
                onManageSeries={() => {
                  setFocusSeries(true);
                  setPage(3);
                }}
              />
            ) : page === 0 ? (
              <Week date={date} onDate={setDate} entries={scopedEntries} />
            ) : (
              <article>
                <div className="month">
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
                    }
                  >
                    ‹
                  </button>
                  <h2>
                    {month.toLocaleDateString("cs-CZ", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
                    }
                  >
                    ›
                  </button>
                </div>
                <div className="calendar">
                  {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((n) => (
                    <b key={n}>{n}</b>
                  ))}
                  {cells.map((d, i) => (
                    <button
                      key={i}
                      className={
                        (i % 7 > 4 ? "weekend " : "") +
                        (day(d) === day() ? "today " : "") +
                        (day(d) === date ? "selected " : "") +
                        (d.getMonth() !== month.getMonth() ? "muted" : "")
                      }
                      onClick={() => setDate(day(d))}
                    >
                      {d.getDate()}
                      <div>
                        {scopedEntries.some(
                          (e) => e.date === day(d) && e.item.kind === "INCOME",
                        ) && <i className="green" />}
                        {scopedEntries.some(
                          (e) => e.date === day(d) && e.item.kind === "EXPENSE",
                        ) && <i className="red" />}
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            )}
            {page < 2 && (
              <article>
                <h2>
                  Platby ·{" "}
                  {new Date(date + "T12:00:00").toLocaleDateString("cs-CZ", {
                    day: "numeric",
                    month: "long",
                  })}
                </h2>
                <div className="stats">
                  <div className="income">
                    Příjmy{" "}
                    {money(
                      entries
                        .filter(
                          (e) =>
                            e.status === "DONE" && e.item.kind === "INCOME",
                        )
                        .reduce((n, e) => n + BigInt(e.amount), 0n),
                    )}
                  </div>
                  <div className="expense">
                    Výdaje{" "}
                    {money(
                      entries
                        .filter(
                          (e) =>
                            e.status === "DONE" && e.item.kind === "EXPENSE",
                        )
                        .reduce((n, e) => n + BigInt(e.amount), 0n),
                    )}
                  </div>
                  <div>
                    Rozdíl{" "}
                    {money(
                      entries
                        .filter((e) => e.status === "DONE")
                        .reduce(
                          (n, e) =>
                            n +
                            BigInt(e.amount) *
                              (e.item.kind === "INCOME" ? 1n : -1n),
                          0n,
                        ),
                    )}
                  </div>
                </div>
                {entries.length === 0 && (
                  <p>Pro tento den zatím nemáte žádné platby.</p>
                )}
                {entries.map((e) => (
                  <div className="entry" key={e.id}>
                    <span style={{ color: e.item.color }}>
                      <ItemIcon item={e.item} />
                    </span>
                    <div>
                      <strong>{e.item.name}</strong>
                      <small>
                        {e.status === "DONE" ? "Uskutečněno" : "Plánováno"} ·{" "}
                        {e.merchant ? e.merchant + " · " : ""}
                        {e.comment} ·{" "}
                        {wallets.find((w) => w.id === e.walletId)?.name}
                      </small>
                    </div>
                    <b
                      className={
                        e.item.kind === "INCOME" ? "income" : "expense"
                      }
                    >
                      {e.item.kind === "INCOME" ? "+" : "−"}
                      {money(e.amount)}
                    </b>
                    <button
                      onClick={() => {
                        setEditingEntry(e);
                        setForm(e.item.kind);
                      }}
                    >
                      Detail
                    </button>
                  </div>
                ))}
                {(data.transfers || [])
                  .filter(
                    (t) =>
                      t.date === date &&
                      currencyWallets.some(
                        (w) => w.id === t.fromId || w.id === t.toId,
                      ) &&
                      (selectedWallet === "ALL" ||
                        t.fromId === selectedWallet ||
                        t.toId === selectedWallet),
                  )
                  .map((t) => (
                    <div className="entry transfer-calendar" key={t.id}>
                      <span>⇄</span>
                      <div>
                        <strong>
                          {wallets.find((w) => w.id === t.fromId)?.name} →{" "}
                          {wallets.find((w) => w.id === t.toId)?.name}
                        </strong>
                        <small>
                          Převod mezi vlastními účty · mimo příjmy a výdaje
                        </small>
                      </div>
                      <b>
                        {formatMoney(
                          t.amount,
                          wallets.find((w) => w.id === t.fromId)?.currency,
                        )}{" "}
                        →{" "}
                        {formatMoney(
                          t.receivedAmount ?? t.amount,
                          wallets.find((w) => w.id === t.toId)?.currency,
                        )}
                      </b>
                    </div>
                  ))}
              </article>
            )}
          </>
        )}
        {page === 3 && (
          <>
            <Settings data={data} refresh={refresh} focusSeries={focusSeries} />
            <Notifications
              onDate={(d) => {
                setDate(d);
                setPage(1);
              }}
            />
          </>
        )}
        {page === 4 && (
          <>
            <article>
              <h2>{data.user.username}</h2>
              <p>Role: {data.user.role}</p>
              <button
                onClick={() =>
                  void act(async () => {
                    if (nativeWidgetSupport()) await nativeWidgets.disconnect();
                    return api("/logout", {});
                  })
                }
              >
                Odhlásit
              </button>
            </article>
            {data.user.role === "OWNER" && <Admin />}
          </>
        )}
      </main>
      <nav>
        {nav.map((n, i) => (
          <button
            key={n}
            className={page === i ? "selected" : ""}
            onClick={() => setPage(i)}
          >
            <span>
              {React.createElement(
                [
                  House,
                  CalendarDays,
                  ChartNoAxesCombined,
                  SettingsIcon,
                  UserRound,
                ][i],
                { size: 22, strokeWidth: 1.7 },
              )}
            </span>
            {n}
          </button>
        ))}
      </nav>
      {form && (
        <div className="overlay">
          <section role="dialog" aria-modal="true" aria-label="Nová platba">
            <button className="close" onClick={() => setForm("")}>
              × Zavřít
            </button>
            <h2>
              {editingEntry
                ? "Upravit platbu"
                : form === "INCOME"
                  ? "Nový příjem"
                  : "Nový výdaj"}
            </h2>
            <form
              onSubmit={(e) =>
                submit(e, async (v) => {
                  if (editingEntry)
                    await api("/entries/" + editingEntry.id, v, "PATCH");
                  else await api("/entries", { ...v, key: submitKey.current });
                  setForm("");
                })
              }
            >
              <WalletSelect
                wallets={wallets}
                value={formWalletId}
                onChange={setFormWalletId}
                include={editingEntry?.walletId}
              />
              <label>
                Datum
                <input
                  type="date"
                  name="date"
                  defaultValue={editingEntry?.date || date}
                  required
                />
              </label>
              <label>
                Položka
                <select
                  name="itemId"
                  defaultValue={editingEntry?.item.id || quickPreset?.itemId}
                  required
                  onChange={(e) => {
                    const item = data.items.find(
                      (i) => i.id === e.target.value,
                    ) as any;
                    const amount = e.currentTarget.form?.elements.namedItem(
                      "amount",
                    ) as HTMLInputElement;
                    if (amount && item?.defaultAmount)
                      amount.value = String(Number(item.defaultAmount) / 100);
                  }}
                >
                  {editingEntry &&
                    !data.items.some(
                      (i) =>
                        i.id === editingEntry.item.id && !(i as any).hidden,
                    ) && (
                      <option value={editingEntry.item.id}>
                        {editingEntry.item.name} (původní položka)
                      </option>
                    )}
                  {data.items
                    .filter((i) => i.kind === form && !(i as any).hidden)
                    .map((i) => (
                      <option value={i.id} key={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </label>
              {data.user.preferences?.[
                form === "INCOME" ? "incomeMode" : "expenseMode"
              ] === "grid" && (
                <div className="item-grid">
                  {data.items
                    .filter((i) => i.kind === form && !(i as any).hidden)
                    .map((i) => (
                      <button
                        type="button"
                        key={i.id}
                        style={itemStyle(i)}
                        onClick={(e) => {
                          const select =
                            e.currentTarget.form?.elements.namedItem(
                              "itemId",
                            ) as HTMLSelectElement;
                          if (select) select.value = i.id;
                          const amount =
                            e.currentTarget.form?.elements.namedItem(
                              "amount",
                            ) as HTMLInputElement;
                          if (amount && (i as any).defaultAmount)
                            amount.value = String(
                              Number((i as any).defaultAmount) / 100,
                            );
                        }}
                      >
                        <ItemIcon item={i} /> {i.name}
                      </button>
                    ))}
                </div>
              )}
              {!data.items.some((i) => i.kind === form) && (
                <p>Nejprve vytvořte položku v Nastavení.</p>
              )}
              <label>
                Částka ({formCurrency})
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={
                    editingEntry
                      ? String(Number(editingEntry.amount) / 100)
                      : quickPreset
                        ? String(Number(quickPreset.amount) / 100)
                        : Number(
                            (
                              data.items.find(
                                (i) => i.kind === form && !(i as any).hidden,
                              ) as any
                            )?.defaultAmount || 0,
                          ) / 100 || ""
                  }
                />
              </label>
              {form === "EXPENSE" && (
                <div className="actions">
                  {(
                    data.user.preferences?.quickAmounts || ["100", "200", "500"]
                  ).map((a: string) => (
                    <button
                      type="button"
                      key={a}
                      onClick={(e) => {
                        const input = e.currentTarget.form?.elements.namedItem(
                          "amount",
                        ) as HTMLInputElement;
                        if (input) input.value = a;
                      }}
                    >
                      {a} {currencySymbol(formCurrency)}
                    </button>
                  ))}
                </div>
              )}
              <label>
                Obchodník (nepovinné)
                <input
                  name="merchant"
                  maxLength={120}
                  list="merchant-choices"
                  defaultValue={
                    editingEntry?.merchant || quickPreset?.merchant || ""
                  }
                />
                <datalist id="merchant-choices">
                  {[
                    ...new Set(
                      data.entries.map((e) => e.merchant).filter(Boolean),
                    ),
                  ].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <label>
                Komentář
                <input
                  name="comment"
                  defaultValue={editingEntry?.comment || ""}
                  maxLength={1000}
                />
              </label>
              <button
                disabled={
                  !editingEntry && !data.items.some((i) => i.kind === form)
                }
              >
                Uložit
              </button>
            </form>
            {editingEntry?.status === "PLANNED" && (
              <div className="payment-confirm">
                <h3>Potvrdit uskutečnění</h3>
                <label>
                  Skutečné datum realizace
                  <input
                    type="date"
                    value={confirmDate}
                    max={day()}
                    onChange={(e) => setConfirmDate(e.target.value)}
                  />
                </label>
                <button
                  onClick={() =>
                    void act(async () => {
                      await api("/entries/" + editingEntry.id + "/confirm", {
                        date: confirmDate,
                      });
                      setForm("");
                    })
                  }
                >
                  Potvrdit platbu
                </button>
              </div>
            )}
            {editingEntry && (
              <div className="payment-delete">
                {deleteEntry ? (
                  <>
                    <p role="alert">
                      {editingEntry.seriesId
                        ? "Tento výskyt bude přeskočen. Ostatní opakování zůstanou."
                        : "Opravdu odstranit tuto platbu? Její částka se odebere ze součtů."}
                    </p>
                    <button onClick={() => setDeleteEntry(false)}>
                      Ponechat platbu
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        void act(async () => {
                          await api(
                            "/entries/" + editingEntry.id,
                            undefined,
                            "DELETE",
                          );
                          setForm("");
                        })
                      }
                    >
                      Potvrdit odstranění platby
                    </button>
                  </>
                ) : (
                  <button
                    className="danger-text"
                    onClick={() => setDeleteEntry(true)}
                  >
                    Odstranit platbu
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  location.pathname === "/bank/callback" ? <BankReturn /> : <App />,
);

if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(console.error);
import { App as NativeApp } from "@capacitor/app";
function openWidgetUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol === "systematicmoney:" && parsed.hostname === "bank") {
    const code = parsed.searchParams.get("code"),
      state = parsed.searchParams.get("state");
    if (code && code.length <= 2000 && state && /^[a-f0-9]{64}$/.test(state)) {
      void import("@capacitor/browser")
        .then(({ Browser }) => Browser.close())
        .catch(() => {});
      location.assign(
        "/?bankCode=" +
          encodeURIComponent(code) +
          "&bankState=" +
          encodeURIComponent(state),
      );
    }
    return;
  }
  if (parsed.protocol !== "systematicmoney:" || parsed.hostname !== "quick")
    return;
  const id = parsed.searchParams.get("action");
  const target =
    id && /^[a-f0-9-]{36}$/i.test(id)
      ? "/?action=" + encodeURIComponent(id)
      : "/?quick=" +
        (parsed.searchParams.get("kind") === "INCOME" ? "INCOME" : "EXPENSE");
  if (location.pathname + location.search !== target) location.assign(target);
}
NativeApp.addListener("appUrlOpen", ({ url }) => openWidgetUrl(url));
if (nativeWidgetSupport())
  NativeApp.getLaunchUrl().then((result) => {
    if (result?.url && sessionStorage.getItem("widget-launch") !== result.url) {
      sessionStorage.setItem("widget-launch", result.url);
      if (
        !new URLSearchParams(location.search).has("action") &&
        !new URLSearchParams(location.search).has("quick")
      )
        openWidgetUrl(result.url);
    }
  });
