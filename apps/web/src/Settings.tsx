import { ItemIcon } from "./ItemIcon";
import { Brands } from "./Brands";
import { useEffect, useState } from "react";
export async function call(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
}
export function Settings({
  data,
  refresh,
}: {
  data: any;
  refresh: () => unknown;
}) {
  const [series, setSeries] = useState<any[]>([]),
    [seriesEditing, setSeriesEditing] = useState<any>(null),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [prefs, setPrefs] = useState({
      ...{
        incomeMode: "list",
        expenseMode: "grid",
        quickAmounts: ["100", "200", "500"],
        leadDays: 1,
        quietStart: 22,
        quietEnd: 7,
        notifications: false,
      },
      ...data.user.preferences,
    });
  const load = () => call("/series").then(setSeries);
  useEffect(() => {
    load();
  }, []);
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await refresh();
      await load();
      setMessage("Uloženo");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <p role="status">{message}</p>
      <article>
        <h2>Editor položek</h2>
        <div className="item-grid">
          {data.items.map((i: any) => (
            <button
              key={i.id}
              onClick={() => setEditing(i)}
              style={{
                background: i.appearance?.background || "#f3f7fa",
                color: i.color,
                border: i.important ? "2px solid currentColor" : undefined,
              }}
            >
              <ItemIcon item={i} /> {i.name}
              {i.favorite ? " ★" : ""}
              {i.hidden ? " (skryté)" : ""}
            </button>
          ))}
        </div>
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                call(
                  "/items/" + editing.id,
                  {
                    name: editing.name,
                    kind: editing.kind,
                    color: editing.color,
                    hidden: editing.hidden,
                    favorite: editing.favorite,
                    important: editing.important,
                    position: editing.position,
                    defaultAmount: String(
                      Number(editing.defaultAmount || 0) / 100,
                    ),
                    appearance: editing.appearance,
                  },
                  "PATCH",
                ),
              );
            }}
          >
            <label>
              Název
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Výchozí částka
              <input
                inputMode="decimal"
                value={Number(editing.defaultAmount || 0) / 100}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    defaultAmount: Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </label>
            <label>
              Pořadí
              <input
                type="number"
                min={0}
                value={editing.position || 0}
                onChange={(e) =>
                  setEditing({ ...editing, position: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Vlastní logo (PNG, JPEG, WebP; max. 600 kB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 600000) {
                    setMessage("Obrázek je příliš velký");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () =>
                    void run(() =>
                      call("/items/" + editing.id + "/logo", {
                        data: String(reader.result).split(",")[1],
                      }),
                    );
                  reader.readAsDataURL(f);
                }}
              />
            </label>
            <label>
              Barva HEX
              <input
                value={editing.color}
                pattern="#[0-9a-fA-F]{6}"
                onChange={(e) =>
                  setEditing({ ...editing, color: e.target.value })
                }
              />
              <input
                type="color"
                value={editing.color}
                onChange={(e) =>
                  setEditing({ ...editing, color: e.target.value })
                }
              />
            </label>
            <label>
              Ikona
              <select
                value={editing.appearance?.icon || "◈"}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    appearance: { ...editing.appearance, icon: e.target.value },
                  })
                }
              >
                {["◈", "⌂", "🛒", "🚗", "💼", "☕", "♥", "✈", "☎", "⚡"].map(
                  (i) => (
                    <option key={i}>{i}</option>
                  ),
                )}
              </select>
            </label>
            <Brands
              onSelect={(b) =>
                setEditing({
                  ...editing,
                  appearance: { ...editing.appearance, brand: b.slug },
                  color: b.color,
                })
              }
            />
            <label>
              Barva textu
              <input
                type="color"
                value={editing.appearance?.text || editing.color}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    appearance: { ...editing.appearance, text: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Pozadí
              <input
                type="color"
                value={editing.appearance?.background || "#ffffff"}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    appearance: {
                      ...editing.appearance,
                      background: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={editing.appearance?.gradient || false}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    appearance: {
                      ...editing.appearance,
                      gradient: e.target.checked,
                    },
                  })
                }
              />
              Gradient
            </label>
            {["favorite", "important", "hidden"].map((k, i) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={editing[k]}
                  onChange={(e) =>
                    setEditing({ ...editing, [k]: e.target.checked })
                  }
                />
                {["Oblíbená", "Důležitá", "Skrytá"][i]}
              </label>
            ))}
            <div
              className="preview"
              style={{
                color: editing.appearance?.text || editing.color,
                background: editing.appearance?.gradient
                  ? `linear-gradient(135deg, ${editing.appearance.background || "#ffffff"}, ${editing.color})`
                  : editing.appearance?.background,
                border: editing.important
                  ? "3px solid currentColor"
                  : undefined,
              }}
            >
              <ItemIcon item={editing} /> {editing.name}
            </div>
            <button>Uložit změny</button>
          </form>
        )}
      </article>
      <article>
        <h2>Výběr položek a rychlé částky</h2>
        {["incomeMode", "expenseMode"].map((k, i) => (
          <label key={k}>
            {i ? "Výdaje" : "Příjmy"}
            <select
              value={prefs[k]}
              onChange={(e) => setPrefs({ ...prefs, [k]: e.target.value })}
            >
              <option value="list">Seznam</option>
              <option value="grid">Mřížka</option>
            </select>
          </label>
        ))}
        <label>
          Rychlé částky oddělené mezerou
          <input
            value={prefs.quickAmounts.join(" ")}
            onChange={(e) =>
              setPrefs({ ...prefs, quickAmounts: e.target.value.split(" ") })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={prefs.notifications}
            onChange={(e) =>
              setPrefs({ ...prefs, notifications: e.target.checked })
            }
          />
          Upozornění na platby
        </label>
        <label>
          Předstih ve dnech
          <input
            type="number"
            min={0}
            max={30}
            value={prefs.leadDays}
            onChange={(e) =>
              setPrefs({ ...prefs, leadDays: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Noční klid od
          <input
            type="number"
            min={0}
            max={23}
            value={prefs.quietStart}
            onChange={(e) =>
              setPrefs({ ...prefs, quietStart: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Noční klid do
          <input
            type="number"
            min={0}
            max={23}
            value={prefs.quietEnd}
            onChange={(e) =>
              setPrefs({ ...prefs, quietEnd: Number(e.target.value) })
            }
          />
        </label>
        <button
          onClick={() => void run(() => call("/preferences", prefs, "PUT"))}
        >
          Uložit preference
        </button>
      </article>
      <article>
        <h2>Opakované platby</h2>
        <form
          key={seriesEditing?.id || "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            void run(async () => {
              await call(
                seriesEditing ? "/series/" + seriesEditing.id : "/series",
                {
                  ...v,
                  interval: Number(v.interval),
                  count: v.count ? Number(v.count) : null,
                  end: v.end || null,
                },
                seriesEditing ? "PUT" : "POST",
              );
              setSeriesEditing(null);
              await call("/series/generate", {
                horizon: new Date(Date.now() + 366 * 86400000)
                  .toISOString()
                  .slice(0, 10),
              });
            });
          }}
        >
          <label>
            Položka
            <select name="itemId" required defaultValue={seriesEditing?.itemId}>
              {data.items.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Částka
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={
                seriesEditing ? Number(seriesEditing.amount) / 100 : undefined
              }
            />
          </label>
          <label>
            Od
            <input
              type="date"
              name="start"
              defaultValue={seriesEditing?.start}
              required
            />
          </label>
          <label>
            Do (nepovinné)
            <input type="date" name="end" defaultValue={seriesEditing?.end} />
          </label>
          <label>
            Frekvence
            <select name="frequency" defaultValue={seriesEditing?.frequency}>
              <option value="DAILY">Denně</option>
              <option value="WEEKLY">Týdně</option>
              <option value="MONTHLY">Měsíčně</option>
              <option value="YEARLY">Ročně</option>
            </select>
          </label>
          <label>
            Každých
            <input
              type="number"
              name="interval"
              min={1}
              max={365}
              defaultValue={seriesEditing?.interval || 1}
            />
          </label>
          <label>
            Počet (prázdné = bez konce)
            <input
              type="number"
              name="count"
              min={1}
              defaultValue={seriesEditing?.count}
            />
          </label>
          <button>
            {seriesEditing ? "Uložit celou sérii" : "Vytvořit opakování"}
          </button>
          {seriesEditing && (
            <button type="button" onClick={() => setSeriesEditing(null)}>
              Zrušit úpravu
            </button>
          )}
        </form>
        {series.map((s) => (
          <div className="entry" key={s.id}>
            <span>
              {data.items.find((i: any) => i.id === s.itemId)?.name} · {s.start}{" "}
              · {s.frequency}
            </span>
            <button
              onClick={() =>
                void run(() =>
                  call("/series/" + s.id, { paused: !s.paused }, "PATCH"),
                )
              }
            >
              {s.paused ? "Obnovit" : "Pozastavit generování"}
            </button>
            <button onClick={() => setSeriesEditing(s)}>Upravit sérii</button>
          </div>
        ))}
      </article>
      <article>
        <h2>Záloha a zabezpečení</h2>
        <a href="/api/backup" download>
          Stáhnout JSON zálohu
        </a>
        <label>
          Obnovit transakce a položky do prázdného účtu
          <input
            type="file"
            accept="application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (
                file &&
                confirm("Obnovit finance ze zálohy? Pouze pro prázdný účet.")
              )
                void run(async () =>
                  call("/restore", JSON.parse(await file.text())),
                );
            }}
          />
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              call(
                "/password",
                Object.fromEntries(new FormData(e.currentTarget)),
              ),
            );
          }}
        >
          <label>
            Současné heslo
            <input type="password" name="current" required />
          </label>
          <label>
            Nové heslo
            <input type="password" name="password" minLength={12} required />
          </label>
          <button>Změnit heslo a odhlásit zařízení</button>
        </form>
      </article>
    </>
  );
}
export function Admin() {
  const [users, setUsers] = useState<any[]>([]),
    [invites, setInvites] = useState<any[]>([]),
    [error, setError] = useState("");
  const load = async () => {
    try {
      setUsers(await call("/admin/users"));
      setInvites(await call("/admin/invites"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <article>
      <h2>Uživatelé a pozvánky</h2>
      <p role="alert">{error}</p>
      {users.map((u) => (
        <div className="entry" key={u.id}>
          <span>
            {u.username} · {u.role}
          </span>
          {u.role !== "OWNER" && (
            <button
              onClick={async () => {
                try {
                  await call("/admin/users/" + u.id + "/block", {
                    blocked: !u.blocked,
                  });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {u.blocked ? "Odblokovat" : "Blokovat"}
            </button>
          )}
        </div>
      ))}
      {invites.map((i) => (
        <div className="entry" key={i.token}>
          <span>
            {i.used ? "Použitá" : "Nepoužitá"} ·{" "}
            {new Date(i.expires).toLocaleString("cs")}
          </span>
          <button
            onClick={async () => {
              try {
                await call("/admin/invites/" + i.token, undefined, "DELETE");
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Zrušit
          </button>
        </div>
      ))}
    </article>
  );
}
