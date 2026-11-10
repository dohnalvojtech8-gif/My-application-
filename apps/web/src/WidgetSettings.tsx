import { WidgetPanelSettings } from "./WidgetPanelSettings";
import { useEffect, useState } from "react";
import { Smartphone, Plus, Trash2, RefreshCw, ShieldCheck } from "lucide-react";
import { call } from "./Settings";
import { nativeWidgets, nativeWidgetSupport } from "./nativeWidgets";
export function WidgetSettings({ items }: { items: any[] }) {
  const [actions, setActions] = useState<any[]>([]),
    [devices, setDevices] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false);
  async function load() {
    const [a, d] = await Promise.all([
      call("/quick-actions"),
      call("/widget-devices"),
    ]);
    setActions(a);
    setDevices(d);
    if (nativeWidgetSupport())
      setConnected((await nativeWidgets.status()).connected);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="settings-group">
      <summary>
        <span>Widgety a rychlé akce</span>
        <small>
          Zůstatek, oblíbené položky a přednastavené platby na telefonu
        </small>
      </summary>
      <article>
        <p role="status">{message}</p>
        <p>
          Každý widget může používat vlastní položku a částku. Režim „Formulář“
          otevře předvyplněnou platbu; „Přímé uložení“ ji uloží po systémovém
          ověření telefonu.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            void run(async () => {
              await call("/quick-actions", {
                ...v,
                showBalance: v.showBalance === "on",
              });
              setMessage(
                "Rychlá akce uložena. Obnovte widget nebo upravte jeho výběr.",
              );
            });
          }}
        >
          <label>
            Název rychlé akce
            <input
              name="name"
              required
              maxLength={50}
              placeholder="Například ranní káva"
            />
          </label>
          <label>
            Položka pro widget
            <select name="itemId" required>
              {items
                .filter((i) => !i.hidden)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.favorite ? "★ " : ""}
                    {i.name} · {i.kind === "INCOME" ? "příjem" : "výdaj"}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Přednastavená částka
            <input name="amount" required inputMode="decimal" />
          </label>
          <label>
            Způsob uložení
            <select name="mode">
              <option value="FORM">Otevřít rychlý formulář</option>
              <option value="DIRECT">Přímé uložení jedním klepnutím</option>
            </select>
          </label>
          <label>
            <input type="checkbox" name="showBalance" />
            Zobrazovat zůstatek u Android widgetu této akce
          </label>
          <button disabled={busy || !items.length}>
            <Plus size={16} />
            Přidat rychlou akci
          </button>
        </form>
        {actions.map((a) => (
          <div className="entry" key={a.id}>
            <Smartphone size={18} />
            <div>
              <strong>{a.name}</strong>
              <small>
                {Number(a.amount) / 100} Kč ·{" "}
                {a.mode === "DIRECT" ? "přímé uložení" : "formulář"}
              </small>
            </div>
            <button
              disabled={busy}
              aria-label={"Smazat rychlou akci " + a.name}
              onClick={() =>
                void run(() =>
                  call("/quick-actions/" + a.id, undefined, "DELETE"),
                )
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <WidgetPanelSettings actions={actions} items={items} />
        <h3>Připojení telefonu</h3>
        {nativeWidgetSupport() ? (
          <>
            <p>
              <ShieldCheck size={18} />
              {connected
                ? "Toto zařízení je připojené."
                : "Připojte widgety k aktuálnímu účtu."}{" "}
              Oprávnění platí 30 dní a lze je kdykoli odebrat.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const v = Object.fromEntries(new FormData(form));
                void run(async () => {
                  const old = await nativeWidgets.status();
                  if (old.deviceId)
                    await call(
                      "/widget-devices/" + old.deviceId,
                      undefined,
                      "DELETE",
                    );
                  const d = await call("/widget-devices", {
                    name: v.name,
                    password: v.password,
                    showBalance: v.showBalance === "on",
                  });
                  try {
                    await nativeWidgets.connect({
                      origin: location.origin,
                      token: d.token,
                      deviceId: d.id,
                    });
                  } catch (err) {
                    await call("/widget-devices/" + d.id, undefined, "DELETE");
                    throw err;
                  }
                  form.reset();
                  setMessage(
                    "Telefon připojen. Přidejte widget na domovskou obrazovku a vyberte rychlou akci.",
                  );
                });
              }}
            >
              <label>
                Název zařízení
                <input
                  name="name"
                  defaultValue="Můj telefon"
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Potvrďte heslo účtu
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label>
                <input type="checkbox" name="showBalance" />
                Povolit widgetům číst můj zůstatek
              </label>
              <button disabled={busy}>
                {connected ? "Obnovit připojení" : "Připojit widgety"}
              </button>
            </form>
            {connected && (
              <>
                <button
                  disabled={busy}
                  onClick={() => void run(() => nativeWidgets.refresh())}
                >
                  <RefreshCw size={16} />
                  Obnovit widgety
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const d = await nativeWidgets.status();
                      if (d.deviceId)
                        await call(
                          "/widget-devices/" + d.deviceId,
                          undefined,
                          "DELETE",
                        );
                      await nativeWidgets.disconnect();
                    })
                  }
                >
                  Odpojit tento telefon
                </button>
              </>
            )}
          </>
        ) : (
          <p>
            Rychlé akce můžete připravit na webu. Připojení systémových widgetů
            se provádí v nativní aplikaci pro iOS nebo Android, nikoli v PWA.
          </p>
        )}
        {devices.map((d) => (
          <div className="entry" key={d.id}>
            <div>
              <strong>{d.name}</strong>
              <small>
                Platnost do {new Date(d.expiresAt).toLocaleDateString("cs-CZ")}{" "}
                · {d.showBalance ? "zůstatek povolen" : "zůstatek skrytý"}
              </small>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await call("/widget-devices/" + d.id, undefined, "DELETE");
                  if (
                    nativeWidgetSupport() &&
                    (await nativeWidgets.status()).deviceId === d.id
                  )
                    await nativeWidgets.disconnect();
                })
              }
            >
              Odebrat přístup
            </button>
          </div>
        ))}
        <p className="editor-help">
          Po úspěšném uložení se připraví další platba. Opakované odeslání
          původní akce nezaloží duplicitu. Ověření zajišťuje systém telefonu;
          iOS může použít Face ID nebo již odemčený stav. Na zamčené obrazovce
          iOS lze použít samostatný příjem, výdaj nebo přímou akci po ověření
          systému. Panel 5 + 5 patří na plochu. Heslo telefonu aplikace nikdy
          nečte.
        </p>
      </article>
    </details>
  );
}
