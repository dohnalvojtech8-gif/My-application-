import { merchantComparison, unusualExpenses } from "../../shared/insights";
import { money, percentText, type FinancialEntry } from "../../shared/finance";
import { BudgetCards } from "./Budgets";
export function ExtraInsights({
  data,
  rows,
  previous,
  history,
  currency,
  walletId,
  anchor,
  canCompare,
  onEdit,
}: {
  data: any;
  rows: FinancialEntry[];
  previous: FinancialEntry[];
  history: FinancialEntry[];
  currency: string;
  walletId: string;
  anchor: string;
  canCompare: boolean;
  onEdit: (e: FinancialEntry) => void;
}) {
  const merchants = merchantComparison(rows, previous),
    unusual = unusualExpenses(rows, history);
  return (
    <div className="extra-insights">
      <article>
        <span className="eyebrow">1 / ROZPOČTY V ČASE</span>
        <h2>Jak čerpáte své rozpočty</h2>
        <p>
          Rozpočty vycházejí ze všech výdajů účtu ve vlastním týdnu, měsíci nebo
          roce podle zvoleného data. Filtry obchodníka, položek a částek je
          neomezují.
        </p>
        <BudgetCards
          wallets={data.wallets.filter(
            (w: any) =>
              w.currency === currency &&
              (walletId === "ALL" || w.id === walletId),
          )}
          budgets={data.budgets || []}
          entries={data.entries}
          anchor={anchor}
          charts
        />
      </article>
      <article>
        <span className="eyebrow">2 / NÁKUPY U OBCHODNÍKŮ</span>
        <h2>Kde nakupujete a jak se útrata mění</h2>
        <p>
          {canCompare
            ? "Porovnání se stejně dlouhým předchozím obdobím, se stejnými filtry."
            : "Pro porovnání zvolte konkrétní období místo celé historie."}{" "}
          Názvy obchodníků se slučují bez ohledu na velikost písmen a
          diakritiku.
        </p>
        {!merchants.length ? (
          <p className="report-empty">
            V tomto výběru nejsou žádné uskutečněné výdaje.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Obchodník</th>
                  <th>Nákupy</th>
                  <th>Útrata</th>
                  <th>Průměr</th>
                  <th>Předchozí</th>
                  <th>Změna</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.key}>
                    <td>{m.name}</td>
                    <td>{m.count}</td>
                    <td>{money(m.current, currency)}</td>
                    <td>{money(m.average, currency)}</td>
                    <td>{canCompare ? money(m.previous, currency) : "—"}</td>
                    <td className={m.delta > 0n ? "negative" : "positive"}>
                      {canCompare ? (
                        <>
                          {money(m.delta, currency)}
                          <small>
                            {m.percent == null
                              ? "Bez základu pro procenta"
                              : percentText(m.percent)}
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <article>
        <span className="eyebrow">3 / NEOBVYKLÉ VÝDAJE</span>
        <h2>Platby výrazně nad vaším obvyklým nákupem</h2>
        <p>
          Více než trojnásobek mediánu alespoň pěti dřívějších plateb za
          posledních 90 dní. Porovnáváme stejného obchodníka, nebo stejnou
          položku, pokud obchodník chybí. Jde o vodítko k vlastní kontrole.
        </p>
        {!unusual.length ? (
          <p className="report-empty">
            Žádné takové platby, nebo zatím není dost historie pro porovnání.
          </p>
        ) : (
          unusual.map(({ entry, median, count, percent }) => (
            <button
              key={entry.id}
              className="insight-payment"
              onClick={() => onEdit(entry)}
            >
              <span>
                <b>{entry.merchant || entry.item.name}</b>
                <small>
                  {entry.date} · {count} dřívějších nákupů
                </small>
              </span>
              <span>
                <b>{money(entry.amount, currency)}</b>
                <small>
                  Obvykle {money(median, currency)} · +{percentText(percent)}
                </small>
              </span>
            </button>
          ))
        )}
      </article>
    </div>
  );
}
