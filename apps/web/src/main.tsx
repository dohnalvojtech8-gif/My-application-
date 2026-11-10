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
import { Comparison } from "./Comparison";
import { ItemIcon } from "./ItemIcon";
import { Week } from "./Week";
import { Analytics } from "./Analytics";
import { Notifications } from "./Notifications";
import { Settings, Admin } from "./Settings";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import "./style.css";
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
  if (!r.ok) throw Error(d.error);
  return d;
}
const money = (n: string | number) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(
    Number(n) / 100,
  );
const day = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(d);
type Item = { id: string; name: string; kind: string; color: string };
type Entry = {
  id: string;
  amount: string;
  date: string;
  status: string;
  comment: string;
  item: Item;
};
type Data = {
  user: { username: string; role: string; opening: string; preferences?: any };
  items: Item[];
  entries: Entry[];
  balance: string;
};
function App() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [menu, setMenu] = useState(false),
    [pinned, setPinned] = useState(false),
    [register, setRegister] = useState(false),
    [open, setOpen] = useState<boolean | null>(null),
    [setupError, setSetupError] = useState(""),
    [authBusy, setAuthBusy] = useState(false),
    [authNotice, setAuthNotice] = useState(""),
    [form, setForm] = useState(
      new URLSearchParams(location.search).get("quick") === "EXPENSE"
        ? "EXPENSE"
        : "",
    ),
    [date, setDate] = useState(
      new URLSearchParams(location.search).get("date") || day(),
    ),
    [month, setMonth] = useState(new Date()),
    [period, setPeriod] = useState("Měsíc"),
    [invite, setInvite] = useState(""),
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
  const submitKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!form) return;
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
      .catch(() => setData(null));
  async function checkSetup() {
    setSetupError("");
    setOpen(null);
    try {
      const d = await api("/setup");
      if (typeof d.open !== "boolean")
        throw Error("Server vrátil neplatný stav registrace.");
      setOpen(d.open);
      setRegister(d.open);
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
                Pozvánka
                <input name="invite" required />
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
  const entries = data.entries.filter(
    (e) => e.date === date && e.status !== "SKIPPED",
  );
  const end = day();
  const start = new Date();
  if (period === "Týden")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === "Měsíc") start.setDate(1);
  if (period === "Rok") start.setMonth(0, 1);
  const filtered = data.entries.filter(
    (e) => period === "Vše" || (e.date >= day(start) && e.date <= end),
  );
  const total = (kind: string) =>
    filtered
      .filter((e) => e.status === "DONE" && e.item.kind === kind)
      .reduce((a, e) => a + Number(e.amount), 0);
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
                <h2>{money(data.balance)}</h2>
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
            {page === 0 && <DashboardChart entries={data.entries} />}
            {page === 2 ? (
              <>
                <Comparison entries={data.entries} period={period} />
                <Analytics
                  allEntries={data.entries}
                  entries={filtered}
                  opening={data.user.opening}
                />
                <article>
                  <h2>Příjmy a výdaje</h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={[
                        { name: "Příjmy", částka: total("INCOME") / 100 },
                        { name: "Výdaje", částka: total("EXPENSE") / 100 },
                      ]}
                    >
                      <XAxis dataKey="name" />
                      <Tooltip />
                      <Bar dataKey="částka" fill="#00b9b4" radius={8} />
                    </BarChart>
                  </ResponsiveContainer>
                  <button
                    onClick={() => {
                      const rows = [
                        "Datum;Položka;Haléře;Stav",
                        ...filtered.map((e) =>
                          [
                            e.date,
                            '"' +
                              e.item.name
                                .replace(/"/g, '""')
                                .replace(/^[=+@-]/, "'") +
                              '"',
                            e.amount,
                            e.status,
                          ].join(";"),
                        ),
                      ];
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(
                        new Blob(["\ufeff" + rows.join("\n")], {
                          type: "text/csv",
                        }),
                      );
                      a.download = "systematic-money.csv";
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    Export CSV
                  </button>
                </article>
              </>
            ) : page === 0 ? (
              <Week date={date} onDate={setDate} entries={data.entries} />
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
                        {data.entries.some(
                          (e) => e.date === day(d) && e.item.kind === "INCOME",
                        ) && <i className="green" />}
                        {data.entries.some(
                          (e) => e.date === day(d) && e.item.kind === "EXPENSE",
                        ) && <i className="red" />}
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            )}
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
                        (e) => e.status === "DONE" && e.item.kind === "INCOME",
                      )
                      .reduce((n, e) => n + Number(e.amount), 0),
                  )}
                </div>
                <div className="expense">
                  Výdaje{" "}
                  {money(
                    entries
                      .filter(
                        (e) => e.status === "DONE" && e.item.kind === "EXPENSE",
                      )
                      .reduce((n, e) => n + Number(e.amount), 0),
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
                          Number(e.amount) *
                            (e.item.kind === "INCOME" ? 1 : -1),
                        0,
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
                      {e.comment}
                    </small>
                  </div>
                  <b
                    className={e.item.kind === "INCOME" ? "income" : "expense"}
                  >
                    {e.item.kind === "INCOME" ? "+" : "−"}
                    {money(e.amount)}
                  </b>
                  {e.status === "PLANNED" && (
                    <button
                      onClick={() => {
                        const d = prompt(
                          "Skutečné datum realizace (YYYY-MM-DD)",
                          day(),
                        );
                        if (d)
                          void act(() =>
                            api("/entries/" + e.id + "/confirm", { date: d }),
                          );
                      }}
                    >
                      Potvrdit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingEntry(e);
                      setForm(e.item.kind);
                    }}
                  >
                    Upravit
                  </button>
                  <button
                    aria-label="Smazat platbu"
                    onClick={() => {
                      if (confirm("Smazat tuto platbu?"))
                        void act(() =>
                          api("/entries/" + e.id, undefined, "DELETE"),
                        );
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </article>
          </>
        )}
        {page === 3 && (
          <>
            <Settings data={data} refresh={refresh} />
            <Notifications
              onDate={(d) => {
                setDate(d);
                setPage(1);
              }}
            />
            <article>
              <h2>Počáteční zůstatek</h2>
              <form
                onSubmit={(e) => submit(e, (v) => api("/settings", v, "PUT"))}
              >
                <input
                  aria-label="Počáteční zůstatek"
                  name="opening"
                  defaultValue={Number(data.user.opening) / 100}
                />
                <button>Uložit</button>
              </form>
            </article>
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
              {data.user.role === "OWNER" && (
                <>
                  <h3>Správa přístupu</h3>
                  <button
                    onClick={() =>
                      void act(async () => {
                        const d = await api("/admin/invites", {});
                        setInvite(d.invite);
                      })
                    }
                  >
                    Vytvořit pozvánku na 24 hodin
                  </button>
                  {invite && <p className="token">{invite}</p>}
                </>
              )}
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
                Částka (Kč)
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
                      {a} Kč
                    </button>
                  ))}
                </div>
              )}
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
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(console.error);
import { App as NativeApp } from "@capacitor/app";
function openWidgetUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "systematicmoney:" || parsed.hostname !== "quick")
    return;
  const id = parsed.searchParams.get("action");
  const target =
    id && /^[a-f0-9-]{36}$/i.test(id)
      ? "/?action=" + encodeURIComponent(id)
      : "/?quick=EXPENSE";
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
