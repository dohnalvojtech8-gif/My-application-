import { money } from "../../shared/finance";
import { WalletSelect } from "./Wallets";
import { useEffect, useState } from "react";
import { call } from "./Settings";
import { nativeWidgetSupport } from "./nativeWidgets";
const countries =
  "CZ DE SK AT PL HU LT LV EE FI SE DK NO IS IE FR ES PT IT BE NL LU GR CY MT SI HR BG RO LI GB CH".split(
    " ",
  );
const statusName: Record<string, string> = {
  PENDING: "Čeká na potvrzení",
  EXCHANGING: "Dokončuji připojení",
  ACTIVE: "Připojeno",
  FAILED: "Připojení se nezdařilo",
  REVOKING: "Odpojení u poskytovatele je nutné zopakovat",
  REVOKED: "Odpojeno",
};
export function BankSettings({
  data,
  refresh,
}: {
  data: any;
  refresh: () => unknown;
}) {
  const [state, setState] = useState<any>(null),
    [banks, setBanks] = useState<any[]>([]),
    [country, setCountry] = useState("CZ"),
    [psu, setPsu] = useState("personal"),
    [search, setSearch] = useState(""),
    [rows, setRows] = useState<any[]>([]),
    [filter, setFilter] = useState("NEW"),
    [targets, setTargets] = useState<Record<string, string>>({}),
    [next, setNext] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const [a, t] = await Promise.all([
      call("/banks"),
      call("/bank-transactions?state=" + filter),
    ]);
    setState(a);
    setRows(t.rows);
    setNext(t.next);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [filter]);
  async function run(fn: () => Promise<any>, reload = true) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      if (reload) {
        await load();
        await refresh();
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const targetId = (t: any) =>
    targets[t.id] ||
    t.account.walletId ||
    data.wallets.find((w: any) => w.isDefault)?.id;
  const targetCurrency = (t: any) =>
    data.wallets.find((w: any) => w.id === targetId(t))?.currency || "CZK";
  return (
    <details className="settings-group">
      <summary>
        <span>Bankovní účty</span>
        <small>
          Revolut a podporované české i evropské banky · pouze čtení
        </small>
      </summary>
      <article>
        <p role="status">{message}</p>
        {state && !state.configured ? (
          <p>
            Bankovní službu musí nejprve aktivovat provozovatel. Zatím není
            možné připojit skutečný účet.
          </p>
        ) : (
          <>
            {state?.mode === "sandbox" && (
              <p>
                <strong>
                  Testovací prostředí poskytovatele – nejde o skutečné bankovní
                  účty.
                </strong>
              </p>
            )}
            <p>
              Přístup potvrdíte u banky. Aplikace nepožaduje bankovní heslo a
              nemůže odesílat peníze. Nabídka závisí na zemi, typu účtu a
              dostupnosti poskytovatele.
            </p>
            <label>
              Země banky
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setBanks([]);
                }}
              >
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Typ bankovního účtu
              <select value={psu} onChange={(e) => setPsu(e.target.value)}>
                <option value="personal">Osobní</option>
                <option value="business">Firemní / Business</option>
              </select>
            </label>
            <button
              disabled={busy || !state?.configured}
              onClick={() =>
                void run(async () =>
                  setBanks(await call("/banks/catalog?country=" + country)),
                )
              }
            >
              Načíst dostupné banky
            </button>
            <label>
              Hledat banku
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Například Revolut"
              />
            </label>
            {banks
              .filter(
                (b) =>
                  b.psu_types.includes(psu) &&
                  b.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((b) => (
                <button
                  key={b.name}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await call("/banks/connect", {
                        bank: b.name,
                        country,
                        psuType: psu,
                      });
                      if (nativeWidgetSupport()) {
                        const { Browser } = await import("@capacitor/browser");
                        await Browser.open({ url: result.url });
                      } else location.assign(result.url);
                    })
                  }
                >
                  Připojit {b.name}
                </button>
              ))}
          </>
        )}
        {state?.connections.map((c: any) => (
          <section key={c.id} className="card">
            <h3>
              {c.bank} · {c.country}
            </h3>
            <p>
              {statusName[c.status] || c.status} ·{" "}
              {c.psuType === "business" ? "firemní" : "osobní"}
            </p>
            {c.validUntil && (
              <small>
                Souhlas do {new Date(c.validUntil).toLocaleString("cs-CZ")}
              </small>
            )}
            <p>
              {c.syncedAt
                ? "Poslední aktualizace: " +
                  new Date(c.syncedAt).toLocaleString("cs-CZ")
                : "Zatím bez aktualizace"}
            </p>
            {c.syncError && <p>{c.syncError}</p>}
            {c.accounts.map((a: any) => (
              <div key={a.id}>
                <strong>
                  {a.name} · {a.ibanMasked} · {a.currency}
                </strong>
                <label>
                  Propojený finanční účet
                  <select
                    value={a.walletId || ""}
                    disabled={busy}
                    onChange={(e) =>
                      void run(() =>
                        call(
                          "/bank-accounts/" + a.id + "/wallet",
                          { walletId: e.target.value || null },
                          "PATCH",
                        ),
                      )
                    }
                  >
                    <option value="">Bez přiřazení</option>
                    {(data.wallets || [])
                      .filter((w: any) => !w.archived)
                      .map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </label>
                {a.balances.map((b: any, n: number) => (
                  <p key={n}>
                    {b.name || b.balance_type}: {b.balance_amount.amount}{" "}
                    {b.balance_amount.currency}
                    {b.reference_date ? " · " + b.reference_date : ""}
                  </p>
                ))}
              </div>
            ))}
            {c.status === "ACTIVE" && (
              <button
                disabled={
                  busy ||
                  new Date(c.nextSyncAt) > new Date() ||
                  new Date(c.validUntil) < new Date()
                }
                onClick={() =>
                  void run(() => call("/banks/" + c.id + "/sync", {}))
                }
              >
                Aktualizovat účty
              </button>
            )}
            {c.status === "ACTIVE" && (
              <small>
                Další aktualizace od{" "}
                {new Date(c.nextSyncAt).toLocaleString("cs-CZ")}
              </small>
            )}
            {c.status !== "REVOKED" && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => call("/banks/" + c.id, undefined, "DELETE"))
                }
              >
                Odpojit přístup k {c.bank}
              </button>
            )}
          </section>
        ))}
        <h3>Načtené bankovní platby</h3>
        <p>
          Bankovní zůstatky jsou samostatný přehled. Do osobní evidence přidáte
          pouze vybrané zaúčtované platby, nebo je spárujete s již zadanými.
          Vlastní převody můžete vynechat. Cizí měny se automaticky nesčítají do
          Kč.
        </p>
        <label>
          Stav bankovních plateb
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="NEW">Ke kontrole</option>
            <option value="IMPORTED">Přidané do evidence</option>
            <option value="LINKED">Spárované</option>
            <option value="IGNORED">Vynechané</option>
          </select>
        </label>
        {!rows.length && <p>V tomto přehledu nejsou žádné platby.</p>}
        {rows.map((t) => (
          <section className="card" key={t.id}>
            <strong>
              {t.kind === "INCOME" ? "+" : "−"}
              {t.amount} {t.currency}
            </strong>
            <p>
              {t.date} · {t.account.name} · {t.account.ibanMasked}
            </p>
            <p>{t.description || "Bankovní platba"}</p>
            {t.state === "NEW" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Object.fromEntries(new FormData(e.currentTarget));
                  const action = (
                    e.nativeEvent as SubmitEvent
                  ).submitter?.getAttribute("value");
                  void run(() =>
                    call("/bank-transactions/" + t.id + "/resolve", {
                      action,
                      ...v,
                      itemId: v.itemId || undefined,
                      entryId: v.entryId || undefined,
                      convertedAmount: v.convertedAmount || undefined,
                      confirmUncertain: v.confirmUncertain === "on",
                    }),
                  );
                }}
              >
                <WalletSelect
                  wallets={data.wallets || []}
                  value={targetId(t)}
                  onChange={(id) => setTargets({ ...targets, [t.id]: id })}
                  label="Cílový účet importu"
                />
                <label>
                  Položka pro import
                  <select name="itemId">
                    <option value="">Vyberte položku</option>
                    {data.items
                      .filter((i: any) => !i.hidden && i.kind === t.kind)
                      .map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                  </select>
                </label>
                {t.currency !== targetCurrency(t) && (
                  <label>
                    Částka pro evidenci v {targetCurrency(t)}
                    <input
                      name="convertedAmount"
                      inputMode="decimal"
                      placeholder="Zadejte skutečnou hodnotu v cílové měně"
                    />
                  </label>
                )}
                <label>
                  Obchodník z bankovní platby
                  <input
                    name="merchant"
                    maxLength={120}
                    placeholder="Volitelné jméno obchodníka"
                  />
                </label>
                <label>
                  Již zadaná platba
                  <select name="entryId">
                    <option value="">
                      Vyberte existující platbu pro spárování
                    </option>
                    {data.entries
                      .filter(
                        (e: any) =>
                          e.status === "DONE" &&
                          e.item.kind === t.kind &&
                          e.walletId === targetId(t),
                      )
                      .slice(0, 500)
                      .map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.date} · {e.item.name} ·{" "}
                          {money(
                            e.amount,
                            data.wallets.find((w: any) => w.id === e.walletId)
                              ?.currency,
                          )}
                        </option>
                      ))}
                  </select>
                </label>
                {t.uncertain && (
                  <label>
                    <input type="checkbox" name="confirmUncertain" />
                    Banka neposkytla stálé ID. Ověřil/a jsem, že tuto platbu
                    nezaúčtuji podruhé.
                  </label>
                )}
                <button value="IMPORT" disabled={busy}>
                  Přidat do evidence
                </button>
                <button value="LINK" disabled={busy}>
                  Spárovat bez nového zápisu
                </button>
                <button value="IGNORE" disabled={busy}>
                  Vynechat platbu
                </button>
              </form>
            )}
          </section>
        ))}
        {next && (
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const t = await call(
                  "/bank-transactions?state=" +
                    filter +
                    "&cursor=" +
                    encodeURIComponent(next),
                );
                setRows(t.rows);
                setNext(t.next);
              }, false)
            }
          >
            Další stránka plateb
          </button>
        )}
      </article>
    </details>
  );
}
