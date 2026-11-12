import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export function DashboardChart({
  entries,
  currency = "CZK",
}: {
  entries: any[];
  currency?: string;
}) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    const key =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const rows = entries.filter(
      (e) => e.status === "DONE" && e.date.startsWith(key),
    );
    return {
      name: d.toLocaleDateString("cs-CZ", { month: "short" }),
      příjmy: rows
        .filter((e) => e.item.kind === "INCOME")
        .reduce((n, e) => n + Number(e.amount) / 100, 0),
      výdaje: rows
        .filter((e) => e.item.kind === "EXPENSE")
        .reduce((n, e) => n + Number(e.amount) / 100, 0),
    };
  });
  return (
    <article className="dashboard-trend">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">PENÍZE V POHYBU</span>
          <h2>Přehled posledních měsíců</h2>
        </div>
        <div className="chart-legend">
          <span>
            <i />
            Příjmy
          </span>
          <span>
            <i />
            Výdaje
          </span>
        </div>
      </div>
      <div className="trend-canvas">
        {!months.some((m) => m.příjmy || m.výdaje) && (
          <div className="chart-empty">
            <strong>Váš příběh začíná první platbou</strong>
            <span>Po přidání příjmu nebo výdaje tu uvidíte vývoj financí.</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart
            data={months}
            margin={{ top: 15, right: 10, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00c2ac" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#00c2ac" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#edf1f4" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8d9ca8", fontSize: 11 }}
            />
            <Tooltip
              formatter={(v) =>
                Number(v).toLocaleString("cs-CZ") + " " + currency
              }
              contentStyle={{
                borderRadius: 14,
                border: "1px solid #e5edf0",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="příjmy"
              stroke="#00ac99"
              strokeWidth={2.5}
              fill="url(#incomeGradient)"
            />
            <Area
              type="monotone"
              dataKey="výdaje"
              stroke="#eb7990"
              strokeWidth={2}
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
