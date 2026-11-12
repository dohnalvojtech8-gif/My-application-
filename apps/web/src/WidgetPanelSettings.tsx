import { money } from "../../shared/finance";
import { useEffect, useState } from "react";
import { call } from "./Settings";
type Panel = {
  incomeFirst: boolean;
  expenses: (string | null)[];
  incomes: (string | null)[];
};
export function WidgetPanelSettings({
  actions,
  items,
}: {
  actions: any[];
  items: any[];
}) {
  const [panel, setPanel] = useState<Panel>({
    incomeFirst: false,
    expenses: Array(5).fill(null),
    incomes: Array(5).fill(null),
  });
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    call("/widget-panel")
      .then(setPanel)
      .catch((e) => setMessage(e.message));
  }, [actions]);
  const rows = (
    panel.incomeFirst ? ["incomes", "expenses"] : ["expenses", "incomes"]
  ) as ("incomes" | "expenses")[];
  return (
    <section aria-label="Panel deseti plateb">
      <h3>Panel 5 výdajů + 5 příjmů</h3>
      <p>
        Vyberte přímé akce do jednotlivých pozic. Na iPhonu patří tento panel na
        plochu; na zamčenou obrazovku přidejte jednotlivá tlačítka. Android
        závisí na podpoře telefonu.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await call("/widget-panel", panel, "PUT");
            setMessage("Panel uložen. Obnovte widget na telefonu.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Pořadí řádků
          <select
            value={String(panel.incomeFirst)}
            onChange={(e) =>
              setPanel({ ...panel, incomeFirst: e.target.value === "true" })
            }
          >
            <option value="false">Výdaje nahoře, příjmy dole</option>
            <option value="true">Příjmy nahoře, výdaje dole</option>
          </select>
        </label>
        {rows.map((row) => (
          <fieldset key={row}>
            <legend>{row === "incomes" ? "Příjmy" : "Výdaje"}</legend>
            {panel[row].map((value, n) => (
              <label key={n}>
                {row === "incomes" ? "Příjem" : "Výdaj"} {n + 1}
                <select
                  value={value || ""}
                  onChange={(e) =>
                    setPanel({
                      ...panel,
                      [row]: panel[row].map((id, i) =>
                        i === n ? e.target.value || null : id,
                      ),
                    })
                  }
                >
                  <option value="">Prázdné místo</option>
                  {actions
                    .filter(
                      (a) =>
                        a.mode === "DIRECT" &&
                        items.some(
                          (i) =>
                            i.id === a.itemId &&
                            !i.hidden &&
                            i.kind ===
                              (row === "incomes" ? "INCOME" : "EXPENSE"),
                        ),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {money(a.amount, a.currency)}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </fieldset>
        ))}
        <div
          aria-label="Náhled panelu"
          style={{
            background: "#063047",
            borderRadius: 16,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          {rows.map((row) => (
            <div
              key={row}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,minmax(0,1fr))",
                gap: 5,
              }}
            >
              {panel[row].map((id, n) => {
                const a = actions.find((a) => a.id === id);
                return (
                  <div
                    key={n}
                    style={{
                      padding: "8px 2px",
                      textAlign: "center",
                      borderRadius: 8,
                      background: row === "incomes" ? "#baf5db" : "#ffdae1",
                      color: "#063047",
                      fontSize: 11,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {row === "incomes" ? "+" : "−"}
                    <br />
                    {a?.name || "Volné"}
                    <br />
                    {a ? `${money(a.amount, a.currency)}` : "—"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <button disabled={busy}>Uložit panel widgetu</button>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
