import { useEffect, useState } from "react";
import { defaultDesign, type Design } from "../../shared/design";
import { call } from "./Settings";
export function applyDesign(input?: Partial<Design>) {
  const d = { ...defaultDesign, ...input },
    root = document.documentElement;
  root.dataset.theme =
    d.theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : d.theme;
  root.dataset.density = d.density;
  root.dataset.motion = d.reducedMotion ? "reduced" : "full";
  root.style.setProperty("--accent", d.accent);
  const rgb = [1, 3, 5].map((i) => parseInt(d.accent.slice(i, i + 2), 16));
  root.style.setProperty(
    "--on-accent",
    (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 155
      ? "#08283b"
      : "#ffffff",
  );
  root.style.setProperty(
    "--card-radius",
    d.radius === "square" ? "6px" : d.radius === "soft" ? "14px" : "24px",
  );
  root.style.setProperty(
    "--sidebar",
    d.sidebar === "plum"
      ? "#38204f"
      : d.sidebar === "teal"
        ? "#064d4d"
        : "#00344f",
  );
  root.style.setProperty("--app-font", d.fontSize + "%");
}
export function DesignSettings({
  saved,
  refresh,
}: {
  saved?: Partial<Design>;
  refresh: () => unknown;
}) {
  const [design, setDesign] = useState<Design>({ ...defaultDesign, ...saved }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setDesign({ ...defaultDesign, ...saved });
  }, [JSON.stringify(saved)]);
  useEffect(() => {
    applyDesign(design);
    return () => applyDesign(saved);
  }, [design, saved]);
  function change(key: keyof Design, value: any) {
    setDesign((d) => ({ ...d, [key]: value }));
    setMessage("Náhled změn. Pro zachování zvolte Uložit vzhled.");
  }
  return (
    <details className="settings-group">
      <summary>
        <span>Vzhled a ovládací panel</span>
        <small>Motiv, barvy, velikost textu a obsah hlavní stránky</small>
      </summary>
      <article>
        <div className="filters-grid">
          <label>
            Motiv
            <select
              value={design.theme}
              onChange={(e) => change("theme", e.target.value)}
            >
              <option value="light">Světlý</option>
              <option value="dark">Tmavý</option>
              <option value="system">Podle zařízení</option>
            </select>
          </label>
          <label>
            Barva akcentu
            <input
              type="color"
              value={design.accent}
              onChange={(e) => change("accent", e.target.value)}
            />
          </label>
          <label>
            Barva HEX
            <input
              pattern="#[0-9a-fA-F]{6}"
              maxLength={7}
              key={design.accent}
              defaultValue={design.accent}
              onBlur={(e) => {
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                  change("accent", e.target.value);
              }}
            />
          </label>
          <label>
            Boční panel
            <select
              value={design.sidebar}
              onChange={(e) => change("sidebar", e.target.value)}
            >
              <option value="navy">Námořní modrá</option>
              <option value="teal">Petrolejová</option>
              <option value="plum">Švestková</option>
            </select>
          </label>
          <label>
            Rohy karet
            <select
              value={design.radius}
              onChange={(e) => change("radius", e.target.value)}
            >
              <option value="round">Zaoblené</option>
              <option value="soft">Jemné</option>
              <option value="square">Hranaté</option>
            </select>
          </label>
          <label>
            Rozestupy
            <select
              value={design.density}
              onChange={(e) => change("density", e.target.value)}
            >
              <option value="comfortable">Vzdušné</option>
              <option value="compact">Kompaktní</option>
            </select>
          </label>
          <label>
            Velikost textu
            <select
              value={design.fontSize}
              onChange={(e) => change("fontSize", Number(e.target.value))}
            >
              {[90, 100, 110, 120].map((n) => (
                <option key={n} value={n}>
                  {n} %
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="accent-swatches">
          {[
            "#00a99d",
            "#1475cb",
            "#7655c6",
            "#cd477b",
            "#b96c0a",
            "#397a49",
          ].map((c) => (
            <button
              key={c}
              type="button"
              aria-label={"Akcent " + c}
              style={{ background: c }}
              onClick={() => change("accent", c)}
            />
          ))}
        </div>
        {(
          [
            ["reducedMotion", "Omezit animace"],
            ["showChart", "Zobrazit graf na hlavní stránce"],
            ["showBudgets", "Zobrazit rozpočty na hlavní stránce"],
            ["showUpcoming", "Zobrazit blížící se platby"],
          ] as const
        ).map(([k, n]) => (
          <label className="inline-check" key={k}>
            <input
              type="checkbox"
              checked={design[k]}
              onChange={(e) => change(k, e.target.checked)}
            />
            {n}
          </label>
        ))}
        <div className="report-buttons">
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await call("/preferences/design", design, "PUT");
                await refresh();
                setMessage("Vzhled uložen.");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Uložit vzhled
          </button>
          <button
            onClick={() => {
              setDesign({ ...defaultDesign, ...saved });
              setMessage("Změny zrušeny.");
            }}
          >
            Zrušit změny
          </button>
          <button
            onClick={() => {
              setDesign(defaultDesign);
              setMessage("Výchozí vzhled v náhledu. Pro zachování jej uložte.");
            }}
          >
            Výchozí vzhled
          </button>
        </div>
        <p role="status">{message}</p>
      </article>
    </details>
  );
}
