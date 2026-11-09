const iso = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(d);
const money = (n: number) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(
    n / 100,
  );
export function Comparison({
  entries,
  period,
}: {
  entries: any[];
  period: string;
}) {
  if (period === "Vše") return null;
  const current = new Date(),
    start = new Date(current),
    previous = new Date(current);
  if (period === "Den") {
    previous.setDate(previous.getDate() - 1);
  }
  if (period === "Týden") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    previous.setTime(start.getTime());
    previous.setDate(previous.getDate() - 7);
  }
  if (period === "Měsíc") {
    start.setDate(1);
    previous.setDate(1);
    previous.setMonth(previous.getMonth() - 1);
  }
  if (period === "Rok") {
    start.setMonth(0, 1);
    previous.setMonth(0, 1);
    previous.setFullYear(previous.getFullYear() - 1);
  }
  const currentEnd = new Date(start);
  if (period === "Den") currentEnd.setDate(currentEnd.getDate() + 1);
  if (period === "Týden") currentEnd.setDate(currentEnd.getDate() + 7);
  if (period === "Měsíc") currentEnd.setMonth(currentEnd.getMonth() + 1);
  if (period === "Rok") currentEnd.setFullYear(currentEnd.getFullYear() + 1);
  const sum = (from: string, to: string, kind: string) =>
    entries
      .filter(
        (e) =>
          e.status === "DONE" &&
          e.item.kind === kind &&
          e.date >= from &&
          e.date < to,
      )
      .reduce((a, e) => a + Number(e.amount), 0);
  return (
    <article>
      <h2>Porovnání s předchozím obdobím</h2>
      <small>
        Aktuální kalendářní období oproti celému předchozímu období.
      </small>
      {["INCOME", "EXPENSE"].map((k) => {
        const now = sum(iso(start), iso(currentEnd), k),
          before = sum(iso(previous), iso(start), k),
          difference = now - before;
        return (
          <div className="entry" key={k}>
            <b>{k === "INCOME" ? "Příjmy" : "Výdaje"}</b>
            <span>{money(difference)}</span>
            <span>
              {before
                ? ((difference / before) * 100).toFixed(1) + " %"
                : "Procento nelze určit (předchozí období 0)"}
            </span>
          </div>
        );
      })}
    </article>
  );
}
