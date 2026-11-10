import { useRef, useState, useEffect } from "react";
import {
  ArrowLeftRight,
  Plus,
  WalletCards,
  ChevronRight,
  Archive,
  X,
} from "lucide-react";
import { call } from "./Settings";
import {
  money,
  decimal,
  today,
  type FinancialWallet,
} from "../../shared/finance";
export const walletKinds: Record<string, string> = {
  BANK: "Běžný účet",
  CASH: "Hotovost",
  SAVINGS: "Spoření",
  OTHER: "Jiný účet",
};
export function WalletSelect({
  wallets,
  name = "walletId",
  label = "Finanční účet platby",
  value,
  onChange,
  defaultValue,
  include,
}: {
  wallets: FinancialWallet[];
  name?: string;
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  include?: string;
}) {
  return (
    <label>
      {label}
      <select
        name={name}
        aria-label={label}
        required
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        defaultValue={
          value === undefined
            ? defaultValue || wallets.find((w) => w.isDefault)?.id
            : undefined
        }
      >
        {wallets
          .filter((w) => !w.archived || w.id === include)
          .map((w) => (
            <option value={w.id} key={w.id}>
              {w.name}
              {w.archived ? " (archivovaný)" : ""}
            </option>
          ))}
      </select>
    </label>
  );
}
export function Wallets({
  data,
  refresh,
}: {
  data: any;
  refresh: () => unknown;
}) {
  const wallets: FinancialWallet[] = data.wallets || [];
  const [editing, setEditing] = useState<any>(null),
    [transfer, setTransfer] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [archived, setArchived] = useState(false);
  useEffect(() => {
    if (!editing && !transfer) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>(
      '.wallet-center [role="dialog"]',
    );
    const first = dialog?.querySelector<HTMLElement>("input,select,button");
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditing(null);
        setTransfer(false);
      }
      if (e.key === "Tab" && dialog) {
        const nodes = [
          ...dialog.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input,select",
          ),
        ];
        const start = nodes[0],
          end = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === start) {
          e.preventDefault();
          end?.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          start?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [!!editing, transfer]);
  const transferKey = useRef(crypto.randomUUID());
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wallet-center">
      <div className="report-title">
        <div>
          <span className="eyebrow">VAŠE PENÍZE NA JEDNOM MÍSTĚ</span>
          <h2>Finanční účty</h2>
          <p>
            Oddělené zůstatky, jeden společný přehled. Všechny účty jsou vedené
            v Kč.
          </p>
        </div>
        <div className="report-buttons">
          <button
            className="primary"
            onClick={() =>
              setEditing({
                name: "",
                kind: "BANK",
                color: "#0d9488",
                opening: "0",
              })
            }
          >
            <Plus size={18} /> Nový účet
          </button>
          <button
            disabled={wallets.filter((w) => !w.archived).length < 2}
            onClick={() => {
              transferKey.current = crypto.randomUUID();
              setTransfer(true);
            }}
          >
            <ArrowLeftRight size={18} /> Převod mezi účty
          </button>
        </div>
      </div>
      <p role="status">{message}</p>
      <div className="wallet-grid">
        {wallets
          .filter((w) => archived || !w.archived)
          .map((w) => (
            <article
              className="wallet-card"
              key={w.id}
              style={{ borderTopColor: w.color }}
            >
              <span
                className="wallet-symbol"
                style={{ background: w.color + "18", color: w.color }}
              >
                <WalletCards size={23} />
              </span>
              <div>
                <small>
                  {walletKinds[w.kind]}
                  {w.isDefault ? " · výchozí" : ""}
                  {w.archived ? " · archiv" : ""}
                </small>
                <h3>{w.name}</h3>
              </div>
              <strong>{money(w.balance)}</strong>
              <small>Počáteční zůstatek {money(w.opening)}</small>
              <button
                aria-label={"Detail účtu " + w.name}
                onClick={() => setEditing(w)}
              >
                Detail účtu <ChevronRight size={16} />
              </button>
            </article>
          ))}
      </div>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />{" "}
        Zobrazit archivované účty
      </label>
      <p className="report-note">
        Převod pouze přesouvá vlastní peníze. Nevytváří příjem ani výdaj a
        nemění celkový zůstatek. Archivované účty zůstávají v souhrnu a
        historii.
      </p>
      <article>
        <h3>Převody mezi vlastními účty</h3>
        {!(data.transfers || []).length ? (
          <p className="report-empty">
            Zatím žádné převody. Propojte své účty prvním přesunem peněz.
          </p>
        ) : (
          (data.transfers || []).map((t: any) => (
            <details className="transfer-detail" key={t.id}>
              <summary>
                <ArrowLeftRight size={18} />
                <span>
                  {wallets.find((w) => w.id === t.fromId)?.name} →{" "}
                  {wallets.find((w) => w.id === t.toId)?.name}
                  <small>{t.date}</small>
                </span>
                <b>{money(t.amount)}</b>
              </summary>
              <p>{t.comment || "Bez poznámky"}</p>
              <p>
                Odstranění vrátí částku na původní účet a odečte ji z cílového
                účtu.
              </p>
              <button
                className="danger-text"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Odstranit převod a vrátit jeho vliv na oba zůstatky?",
                    )
                  )
                    void run(() =>
                      call("/transfers/" + t.id, undefined, "DELETE"),
                    );
                }}
              >
                Odstranit tento převod
              </button>
            </details>
          ))
        )}
      </article>
      {editing && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              editing.id ? "Detail finančního účtu" : "Nový finanční účet"
            }
          >
            <button
              className="close"
              onClick={() => setEditing(null)}
              aria-label="Zavřít detail účtu"
            >
              <X size={18} />
            </button>
            <h2>{editing.id ? "Detail účtu" : "Nový účet"}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = Object.fromEntries(new FormData(e.currentTarget));
                void run(async () => {
                  await call(
                    "/wallets" + (editing.id ? "/" + editing.id : ""),
                    v,
                    editing.id ? "PATCH" : "POST",
                  );
                  setEditing(null);
                });
              }}
            >
              <label>
                Název účtu
                <input
                  name="name"
                  required
                  maxLength={60}
                  defaultValue={editing.name}
                  autoFocus
                />
              </label>
              <label>
                Typ účtu
                <select name="kind" defaultValue={editing.kind}>
                  {Object.entries(walletKinds).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Barva účtu
                <input name="color" type="color" defaultValue={editing.color} />
              </label>
              <label>
                Počáteční zůstatek účtu
                <input
                  name="opening"
                  inputMode="decimal"
                  required
                  defaultValue={decimal(editing.opening)}
                />
              </label>
              <p className="report-note">
                Počáteční zůstatek je stav před první evidovanou platbou. Změna
                upraví celkový zůstatek účtu.
              </p>
              <p role="alert">{message}</p>
              <button className="primary" disabled={busy}>
                Uložit účet
              </button>
            </form>
            {editing.id && !editing.isDefault && (
              <button
                className="danger-text"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      editing.archived
                        ? "Obnovit tento účet?"
                        : "Archivovat účet? Historie zůstane zachována, opakované platby se pozastaví.",
                    )
                  )
                    void run(async () => {
                      await call("/wallets/" + editing.id + "/archive", {
                        archived: !editing.archived,
                      });
                      setEditing(null);
                    });
                }}
              >
                <Archive size={17} />
                {editing.archived ? "Obnovit účet" : "Archivovat účet"}
              </button>
            )}
          </section>
        </div>
      )}
      {transfer && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Převod mezi účty"
          >
            <button
              className="close"
              onClick={() => setTransfer(false)}
              aria-label="Zavřít převod"
            >
              <X size={18} />
            </button>
            <h2>Převod mezi účty</h2>
            <p>Peníze se přesunou mezi vašimi účty v jedné operaci.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = Object.fromEntries(new FormData(e.currentTarget));
                void run(async () => {
                  await call("/transfers", { ...v, key: transferKey.current });
                  setTransfer(false);
                });
              }}
            >
              <WalletSelect wallets={wallets} name="fromId" label="Z účtu" />
              <WalletSelect
                wallets={wallets}
                name="toId"
                label="Na účet"
                defaultValue={wallets.filter((w) => !w.archived)[1]?.id}
              />
              <label>
                Částka převodu (Kč)
                <input name="amount" inputMode="decimal" required />
              </label>
              <label>
                Datum převodu
                <input
                  name="date"
                  type="date"
                  defaultValue={today()}
                  max={today()}
                  required
                />
              </label>
              <label>
                Poznámka
                <input name="comment" maxLength={500} />
              </label>
              <p role="alert">{message}</p>
              <button className="primary" disabled={busy}>
                Provést převod
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
