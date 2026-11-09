import { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
const money = (n: number) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(
    n / 100,
  );
export function Analytics({
  entries,
  allEntries,
  opening,
}: {
  entries: any[];
  allEntries: any[];
  opening: string;
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("ALL"),
    [status, setStatus] = useState("ALL"),
    [limit, setLimit] = useState(5);
  const rows = entries.filter(
    (e) =>
      (kind === "ALL" || e.item.kind === kind) &&
      (status === "ALL" || e.status === status) &&
      (e.item.name + " " + e.comment)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const done = rows.filter((e) => e.status === "DONE");
  const grouped = Object.values(
    done.reduce((a: any, e: any) => {
      const k = e.item.id;
      a[k] ??= {
        name: e.item.name,
        value: 0,
        count: 0,
        color: e.item.color,
        kind: e.item.kind,
      };
      a[k].value += Number(e.amount);
      a[k].count++;
      return a;
    }, {}),
  ) as any[];
  grouped.sort((a, b) => b.value - a.value);
  let running = Number(opening);
  const timeline = [...allEntries]
    .filter((e) => e.status === "DONE")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      running += Number(e.amount) * (e.item.kind === "INCOME" ? 1 : -1);
      return { date: e.date, balance: running / 100 };
    });
  const expense = grouped.filter((g) => g.kind === "EXPENSE");
  return (
    <>
      <article>
        <h2>Vývoj zůstatku</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={timeline}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              dataKey="balance"
              name="Zůstatek Kč"
              stroke="#00b9ae"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </article>
      <article>
        <h2>Rozdělení výdajů</h2>
        {expense.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={expense}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={100}
              >
                {expense.map((e) => (
                  <Cell key={e.name} fill={e.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => money(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p>Žádné uskutečněné výdaje.</p>
        )}
        <h3>TOP {limit} položek</h3>
        <select
          aria-label="Počet TOP položek"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={5}>TOP 5</option>
          <option value={10}>TOP 10</option>
        </select>
        {grouped.slice(0, limit).map((g) => (
          <div key={g.name} className="entry">
            <strong>{g.name}</strong>
            <span>
              {g.count}× · průměr {money(g.value / g.count)}
            </span>
            <b>{money(g.value)}</b>
          </div>
        ))}
      </article>
      <article>
        <h2>Transakce</h2>
        <label>
          Hledat
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Položka nebo komentář"
          />
        </label>
        <select
          aria-label="Typ transakcí"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="ALL">Příjmy i výdaje</option>
          <option value="INCOME">Příjmy</option>
          <option value="EXPENSE">Výdaje</option>
        </select>
        <select
          aria-label="Stav transakcí"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">Všechny stavy</option>
          <option value="DONE">Uskutečněné</option>
          <option value="PLANNED">Plánované</option>
          <option value="SKIPPED">Přeskočené</option>
        </select>
        <button onClick={() => window.print()}>Tisk / uložit PDF</button>
        <p>
          Plánováno:{" "}
          {money(
            rows
              .filter((e) => e.status === "PLANNED")
              .reduce((a, e) => a + Number(e.amount), 0),
          )}
        </p>
        <h3>Nejvyšší platby</h3>
        {[...done]
          .sort((a, b) => Number(b.amount) - Number(a.amount))
          .slice(0, 5)
          .map((e) => (
            <div className="entry" key={e.id}>
              {e.item.name} · {e.date}
              <b>{money(Number(e.amount))}</b>
            </div>
          ))}
        {rows.map((e) => (
          <div className="entry" key={e.id}>
            <span>{e.date}</span>
            <strong>{e.item.name}</strong>
            <span>
              {e.status === "DONE"
                ? "Uskutečněno"
                : e.status === "PLANNED"
                  ? "Plánováno"
                  : "Přeskočeno"}
            </span>
            <b>{money(Number(e.amount))}</b>
          </div>
        ))}
      </article>
    </>
  );
}
