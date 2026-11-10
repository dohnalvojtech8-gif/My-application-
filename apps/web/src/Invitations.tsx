import { useEffect, useState } from "react";
import { Copy, Link, RefreshCw, Ticket, UserCheck, X } from "lucide-react";
import "./invitations.css";

type Invitation = {
  id: string;
  code: string | null;
  username: string | null;
  status: "PENDING" | "ACTIVATED" | "EXPIRED" | "REVOKED";
  expires: string;
  activatedAt: string | null;
};
const labels = {
  PENDING: "Čeká na registraci",
  ACTIVATED: "Aktivováno",
  EXPIRED: "Platnost skončila",
  REVOKED: "Zrušeno",
};
const date = (value: string) =>
  new Date(value).toLocaleString("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
async function request(
  path = "",
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  const response = await fetch("/api/admin/invites" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response
    .json()
    .catch(() => ({
      error: "Požadavek se nepodařilo dokončit. Zkuste to za chvíli.",
    }));
  if (!response.ok) throw new Error(data.error);
  return data;
}

export function Invitations() {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [count, setCount] = useState(1),
    [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("ALL"),
    [revoking, setRevoking] = useState("");
  const link = new URL("/register", location.origin).href;
  async function load() {
    const list = await request();
    setInvites(list);
    setLoaded(true);
  }
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const list = await request();
        if (active) {
          setInvites(list);
          setLoaded(true);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Zkopírováno do schránky.");
    } catch {
      setError(
        "Prohlížeč nepovolil schránku. Označte a zkopírujte kód nebo odkaz ručně.",
      );
    }
  }
  const pending = invites.filter((i) => i.status === "PENDING");
  return (
    <article className="invitation-manager" aria-label="Správa pozvánek">
      <div className="invitation-heading">
        <div>
          <span className="invitation-eyebrow">
            SOUKROMÉ ÚČTY • POUZE VLASTNÍK
          </span>
          <h2>
            <Ticket size={23} /> Pozvánky pro nové uživatele
          </h2>
        </div>
        <button
          className="invitation-secondary"
          aria-label="Obnovit pozvánky"
          disabled={busy}
          onClick={() => void run(load)}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <p>
        Každý kód založí jeden samostatný uživatelský účet. Pozvaný zadá své
        nové jméno, heslo a kód; jeho finance zůstanou soukromé.
      </p>
      <div className="invitation-link">
        <label>
          Odkaz pro registraci
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <button onClick={() => void copy(link)}>
          <Link size={16} /> Kopírovat odkaz
        </button>
      </div>
      <form
        className="invitation-create"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const result = await request("", { count, hours });
            await load();
            setFilter("ALL");
            setNotice(
              `Vytvořeno pozvánek: ${result.count}. Každému člověku pošlete odkaz a jiný kód.`,
            );
          });
        }}
      >
        <label>
          Počet pozvánek
          <input
            type="number"
            min={1}
            max={50}
            required
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label>
          Platnost pozvánek
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={24}>24 hodin</option>
            <option value={72}>3 dny</option>
            <option value={168}>7 dní</option>
          </select>
        </label>
        <button disabled={busy}>
          {busy ? "Zpracovávám…" : "Vygenerovat pozvánky"}
        </button>
      </form>
      {error && (
        <p role="alert" className="invitation-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="invitation-notice">
          {notice}
        </p>
      )}
      <div className="invitation-toolbar">
        <label>
          Stav pozvánek
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Všechny pozvánky</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span>
          {pending.length} čeká ·{" "}
          {invites.filter((i) => i.status === "ACTIVATED").length} aktivováno
        </span>
        {pending.some((i) => i.code) && (
          <button
            className="invitation-secondary"
            onClick={() =>
              void copy(
                `Registrace: ${link}\nKaždý kód je určený pro jednoho člověka:\n` +
                  pending
                    .filter((i) => i.code)
                    .map((i) => `${i.code} · platí do ${date(i.expires)}`)
                    .join("\n"),
              )
            }
          >
            <Copy size={15} /> Kopírovat platné kódy
          </button>
        )}
      </div>
      {!loaded && !error && <p>Načítám pozvánky…</p>}
      {loaded &&
        !invites.some((i) => filter === "ALL" || i.status === filter) && (
          <p className="invitation-empty">
            V tomto přehledu zatím nejsou žádné pozvánky.
          </p>
        )}
      <div className="invitation-list">
        {invites
          .filter((i) => filter === "ALL" || i.status === filter)
          .map((i) => (
            <section
              className="invitation-row"
              key={i.id}
              data-status={i.status}
              aria-label={
                i.username ? `Pozvánka pro ${i.username}` : "Pozvánka"
              }
            >
              <div className="invitation-identity">
                <span className="invitation-icon">
                  {i.status === "ACTIVATED" ? (
                    <UserCheck size={22} />
                  ) : (
                    <Ticket size={22} />
                  )}
                </span>
                <div>
                  {i.status === "ACTIVATED" ? (
                    <strong className="invitation-username">
                      {i.username || "Uživatel starší pozvánky"}
                    </strong>
                  ) : i.code ? (
                    <code>{i.code}</code>
                  ) : (
                    <strong>Pozvánka {i.id.slice(0, 8)}</strong>
                  )}
                  <small>
                    {i.status === "ACTIVATED"
                      ? i.activatedAt
                        ? `Aktivováno ${date(i.activatedAt)}`
                        : "Aktivováno před zavedením přehledu"
                      : `Platnost do ${date(i.expires)}`}
                  </small>
                  {i.status === "PENDING" && !i.code && (
                    <small>
                      Starší kód nelze znovu zobrazit. Můžete vytvořit novou
                      pozvánku.
                    </small>
                  )}
                </div>
              </div>
              <span
                className={`invitation-status status-${i.status.toLowerCase()}`}
              >
                {labels[i.status]}
              </span>
              {i.status === "PENDING" && (
                <div className="invitation-actions">
                  {i.code && (
                    <button
                      className="invitation-secondary"
                      onClick={() =>
                        void copy(
                          `SYSTEMATIC MONEY\n${link}\nPozvánkový kód: ${i.code}\nPlatnost do ${date(i.expires)}\nZvolte si nové uživatelské jméno a heslo (alespoň 12 znaků).`,
                        )
                      }
                    >
                      <Copy size={15} /> Kopírovat pozvánku
                    </button>
                  )}
                  {revoking === i.id ? (
                    <>
                      <button
                        className="invitation-danger"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await request("/" + i.id, undefined, "DELETE");
                            setRevoking("");
                            await load();
                          })
                        }
                      >
                        Potvrdit zrušení
                      </button>
                      <button
                        className="invitation-secondary"
                        onClick={() => setRevoking("")}
                      >
                        Ponechat
                      </button>
                    </>
                  ) : (
                    <button
                      className="invitation-secondary"
                      disabled={busy}
                      onClick={() => setRevoking(i.id)}
                    >
                      <X size={15} /> Zrušit pozvánku
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
      </div>
      <p className="invitation-footnote">
        Stav se obnovuje každých 15 sekund. „Čeká na registraci“ znamená
        nevyužitý kód, nikoli sledování rozepsaného formuláře. Po aktivaci kód
        zmizí a nahradí jej uživatelské jméno.
      </p>
    </article>
  );
}
