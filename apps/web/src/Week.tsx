import { useState } from "react";
const iso = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(d);
export function Week({
  date,
  onDate,
  entries,
}: {
  date: string;
  onDate: (d: string) => void;
  entries: any[];
}) {
  const [offset, setOffset] = useState(0);
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
  return (
    <article>
      <div className="month">
        <button
          aria-label="Předchozí týden"
          onClick={() => setOffset(offset - 1)}
        >
          ‹
        </button>
        <h2>Týdenní přehled</h2>
        <button aria-label="Další týden" onClick={() => setOffset(offset + 1)}>
          ›
        </button>
      </div>
      <div className="calendar">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const key = iso(d);
          return (
            <button
              key={key}
              className={key === date ? "selected" : i > 4 ? "weekend" : ""}
              onClick={() => onDate(key)}
            >
              <small>{["Po", "Út", "St", "Čt", "Pá", "So", "Ne"][i]}</small>
              <div>{d.getDate()}</div>
              {entries.some(
                (e) => e.date === key && e.item.kind === "INCOME",
              ) && <i className="green" />}
              {entries.some(
                (e) => e.date === key && e.item.kind === "EXPENSE",
              ) && <i className="red" />}
            </button>
          );
        })}
      </div>
    </article>
  );
}
