import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Search,
  Trash2,
  Copy,
  Check,
  X,
  Star,
  EyeOff,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Upload,
  Palette,
  Shapes,
  Settings2,
} from "lucide-react";
import { ItemIcon } from "./ItemIcon";
import { icons, labels } from "./icons";
import { call } from "./Settings";
import "./editor.css";
const swatches = [
  "#00b8ad",
  "#0284c7",
  "#1d4ed8",
  "#7c3aed",
  "#db2777",
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0f766e",
  "#334155",
  "#0b3047",
];
const presets = [
  {
    name: "Oceán",
    color: "#0891b2",
    background: "#e0f7fa",
    gradientEnd: "#b2ebf2",
  },
  {
    name: "Máta",
    color: "#059669",
    background: "#e6faf3",
    gradientEnd: "#9cf0db",
  },
  {
    name: "Levandule",
    color: "#7c3aed",
    background: "#f1ebff",
    gradientEnd: "#d8c6ff",
  },
  {
    name: "Korál",
    color: "#e11d48",
    background: "#fff0f3",
    gradientEnd: "#ffc3d0",
  },
  {
    name: "Půlnoc",
    color: "#00e4d0",
    background: "#07344b",
    gradientEnd: "#0b6171",
    text: "#ffffff",
  },
  {
    name: "Písek",
    color: "#b45309",
    background: "#fff7e8",
    gradientEnd: "#ffe0a8",
  },
];
function empty(kind: string) {
  return {
    name: "",
    kind,
    color: "#00a99d",
    defaultAmount: "0",
    favorite: false,
    important: false,
    hidden: false,
    position: 0,
    appearance: {
      icon: "Wallet",
      background: "#e9faf5",
      text: "#12364b",
      gradient: false,
      gradientEnd: "#a6ecdb",
      iconColor: "#00a99d",
      angle: 135,
      radius: "round",
      cardStyle: "filled",
    },
  };
}
export function itemStyle(i: any) {
  const a = i.appearance || {},
    outline = a.cardStyle === "outline",
    minimal = a.cardStyle === "minimal";
  return {
    background:
      outline || minimal
        ? "#ffffff"
        : a.gradient
          ? `linear-gradient(${a.angle ?? 135}deg,${a.background || "#edf8f6"},${a.gradientEnd || i.color})`
          : a.background || "#edf8f6",
    color: a.text || "#12364b",
    borderRadius: a.radius === "square" ? 8 : a.radius === "soft" ? 16 : 24,
    border: `${i.important ? 2 : 1}px solid ${i.important || outline ? i.color : "transparent"}`,
    boxShadow: i.important ? `0 8px 24px ${i.color}25` : undefined,
  };
}
function Card({ item, preview = false }: { item: any; preview?: boolean }) {
  return (
    <div
      className={"finance-item " + (preview ? "preview-card" : "")}
      style={itemStyle(item)}
    >
      <div className="item-top">
        <span className="item-symbol">
          <ItemIcon item={item} />
        </span>
        <span className="item-badges">
          {item.favorite && <Star size={15} fill="currentColor" />}
          {item.hidden && <EyeOff size={15} />}
        </span>
      </div>
      <strong>{item.name || "Název položky"}</strong>
      <div className="item-bottom">
        <span>
          {item.kind === "INCOME" ? "Příjem" : "Výdaj"}
          {item.important ? " · Důležité" : ""}
        </span>
        <b>
          {(Number(item.defaultAmount || 0) / 100).toLocaleString("cs-CZ", {
            minimumFractionDigits: 2,
          })}{" "}
          Kč
        </b>
      </div>
    </div>
  );
}
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="color-field">
      {label}
      <div>
        <input
          aria-label={label + " výběr"}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          aria-label={label + " HEX"}
          value={value}
          pattern="#[a-fA-F0-9]{6}"
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
        />
      </div>
    </label>
  );
}
export function ItemEditor({
  items,
  refresh,
}: {
  items: any[];
  refresh: () => unknown;
}) {
  const [kind, setKind] = useState("EXPENSE"),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState<any>(null),
    [amount, setAmount] = useState("0"),
    [tab, setTab] = useState("icon"),
    [library, setLibrary] = useState("brands"),
    [query, setQuery] = useState(""),
    [brands, setBrands] = useState<any[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [deleting, setDeleting] = useState<any>(null),
    [logoFile, setLogoFile] = useState<File | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      call("/brands?q=" + encodeURIComponent(query) + "&offset=" + page * 60)
        .then((d) => {
          if (!cancelled) {
            setBrands(d.items);
            setTotal(d.total);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, page, !!draft]);
  useEffect(() => {
    if (!draft) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const nodes = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input,select,[tabindex="0"]',
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      opener.current?.focus();
    };
  }, [!!draft]);
  const appearance = (patch: any) =>
    setDraft((d: any) => ({ ...d, appearance: { ...d.appearance, ...patch } }));
  function edit(item?: any) {
    opener.current = document.activeElement as HTMLElement;
    setDraft(item ? structuredClone(item) : empty(kind));
    setAmount(item ? String(Number(item.defaultAmount) / 100) : "0");
    setLogoFile(null);
    setError("");
    setQuery("");
    setPage(0);
    setTab("icon");
  }
  function close() {
    if (busy) return;
    if (confirm("Zavřít editor? Neuložené změny se zahodí.")) setDraft(null);
  }
  async function save() {
    if (!draft.name.trim()) {
      setError("Vyplňte název položky.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: draft.name.trim(),
        kind: draft.kind,
        color: draft.color,
        defaultAmount: amount.replace(",", "."),
        favorite: draft.favorite,
        important: draft.important,
        hidden: draft.hidden,
        position: draft.position,
        appearance: { ...draft.appearance },
      };
      if (logoFile) delete payload.appearance.logo;
      let saved = await call(
        draft.id ? "/items/" + draft.id : "/items",
        payload,
        draft.id ? "PATCH" : "POST",
      );
      const id = draft.id || saved.id;
      if (!draft.id) setDraft((d: any) => ({ ...d, id }));
      if (logoFile) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(Error("Obrázek nelze přečíst"));
          reader.readAsDataURL(logoFile);
        });
        await call("/items/" + id + "/logo", { data });
      }
      await refresh();
      setDraft(null);
      setNotice("Položka byla uložena.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await call("/items/" + deleting.id, undefined, "DELETE");
      await refresh();
      setDeleting(null);
      setNotice("Položka byla odstraněna. Historie plateb zůstala zachována.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reorder(i: any, delta: number) {
    const list = items
      .filter((x) => x.kind === kind)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    const index = list.findIndex((x) => x.id === i.id),
      other = index + delta;
    if (other < 0 || other >= list.length) return;
    [list[index], list[other]] = [list[other], list[index]];
    setBusy(true);
    try {
      for (let n = 0; n < list.length; n++) {
        const x = list[n];
        await call(
          "/items/" + x.id,
          {
            ...x,
            defaultAmount: String(Number(x.defaultAmount) / 100),
            position: n,
          },
          "PATCH",
        );
      }
      await refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter(
    (i) =>
      i.kind === kind && i.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="item-studio">
      <div className="studio-heading">
        <div>
          <span className="eyebrow">VAŠE FINANCE, VÁŠ STYL</span>
          <h2>Položky & vzhled</h2>
          <p>Vytvořte si přehled, ve kterém se vyznáte na první pohled.</p>
        </div>
        <button className="primary" onClick={() => edit()}>
          <Plus size={18} />
          Nová položka
        </button>
      </div>
      <div className="studio-toolbar">
        <div className="segmented">
          <button
            className={kind === "EXPENSE" ? "chosen" : ""}
            onClick={() => setKind("EXPENSE")}
          >
            Výdaje{" "}
            <span>{items.filter((i) => i.kind === "EXPENSE").length}</span>
          </button>
          <button
            className={kind === "INCOME" ? "chosen" : ""}
            onClick={() => setKind("INCOME")}
          >
            Příjmy{" "}
            <span>{items.filter((i) => i.kind === "INCOME").length}</span>
          </button>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Hledat položku"
            placeholder="Najít položku…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {notice && (
        <p className="studio-notice" role="status">
          {notice}
        </p>
      )}
      <div className="studio-grid">
        {visible.map((i) => (
          <div className="item-tile" key={i.id}>
            <button
              className="tile-open"
              onClick={() => edit(i)}
              aria-label={"Upravit " + i.name}
            >
              <Card item={i} />
            </button>
            <div className="tile-actions">
              <button
                aria-label={"Posunout " + i.name + " nahoru"}
                disabled={busy}
                onClick={() => void reorder(i, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                aria-label={"Posunout " + i.name + " dolů"}
                disabled={busy}
                onClick={() => void reorder(i, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                aria-label={"Duplikovat " + i.name}
                onClick={() =>
                  edit({ ...i, id: undefined, name: i.name + " – kopie" })
                }
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        ))}
        <button className="new-tile" onClick={() => edit()}>
          <span>
            <Plus size={26} />
          </span>
          <strong>Přidat {kind === "INCOME" ? "příjem" : "výdaj"}</strong>
          <small>Ikona, barvy a částka podle vás</small>
        </button>
      </div>
      {!visible.length && (
        <p className="empty-hint">
          {search
            ? "Žádná položka neodpovídá hledání."
            : "Začněte vlastní položkou. Platby budou přehledně rozdělené podle vašich potřeb."}
        </p>
      )}
      {draft && (
        <div className="studio-backdrop">
          <section
            className="studio-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            tabIndex={-1}
            ref={dialog}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            <div className="editor-head">
              <div>
                <span className="eyebrow">
                  {draft.kind === "INCOME"
                    ? "PŘÍJMOVÁ POLOŽKA"
                    : "VÝDAJOVÁ POLOŽKA"}
                </span>
                <h2 id="editor-title">
                  {draft.id ? "Upravit položku" : "Vytvořit položku"}
                </h2>
              </div>
              <button aria-label="Zavřít editor" onClick={close}>
                <X size={22} />
              </button>
            </div>
            <div className="editor-body">
              <div className="editor-controls">
                <div className="editor-basics">
                  <label>
                    Název položky
                    <input
                      autoComplete="off"
                      placeholder="Například Potraviny"
                      maxLength={80}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Výchozí částka <span>Kč</span>
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        const n = Number(e.target.value.replace(",", "."));
                        setDraft({
                          ...draft,
                          defaultAmount: Number.isFinite(n)
                            ? Math.round(n * 100)
                            : 0,
                        });
                      }}
                    />
                  </label>
                </div>
                <div
                  className="editor-tabs"
                  role="tablist"
                  aria-label="Část editoru"
                >
                  {[
                    ["icon", "Ikona & logo", Shapes],
                    ["style", "Barvy & karta", Palette],
                    ["options", "Chování", Settings2],
                  ].map(([id, label, Icon]: any) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      key={id}
                      onClick={() => setTab(id)}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </div>
                {tab === "icon" && (
                  <div className="editor-panel">
                    <div className="library-switch">
                      <button
                        className={library === "brands" ? "chosen" : ""}
                        onClick={() => {
                          setLibrary("brands");
                          setQuery("");
                        }}
                      >
                        Značky
                      </button>
                      <button
                        className={library === "icons" ? "chosen" : ""}
                        onClick={() => {
                          setLibrary("icons");
                          setQuery("");
                        }}
                      >
                        Univerzální
                      </button>
                      <button
                        className={library === "upload" ? "chosen" : ""}
                        onClick={() => setLibrary("upload")}
                      >
                        Vlastní obrázek
                      </button>
                    </div>
                    {library !== "upload" && (
                      <label className="search-box">
                        <Search size={18} />
                        <input
                          aria-label="Hledat ikonu nebo značku"
                          placeholder={
                            library === "brands"
                              ? "Hledat Netflix, Lidl, PayPal…"
                              : "Hledat jídlo, doprava, bydlení…"
                          }
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(0);
                          }}
                        />
                      </label>
                    )}
                    {library === "brands" && (
                      <>
                        <div className="library-caption">
                          <span>
                            {loading
                              ? "Načítám knihovnu…"
                              : total.toLocaleString("cs-CZ") + " značek"}
                          </span>
                          <small>Simple Icons</small>
                        </div>
                        <div className="logo-library">
                          {brands.map((b) => (
                            <button
                              key={b.slug}
                              className={
                                draft.appearance?.brand === b.slug
                                  ? "picked"
                                  : ""
                              }
                              title={b.name}
                              onClick={() => {
                                setLogoFile(null);
                                appearance({ brand: b.slug, logo: undefined });
                              }}
                            >
                              <img
                                src={"/api/brands/" + b.slug + "/icon"}
                                alt=""
                                loading="lazy"
                              />
                              <span>{b.name}</span>
                              {draft.appearance?.brand === b.slug && (
                                <Check className="picked-mark" size={12} />
                              )}
                            </button>
                          ))}
                        </div>
                        {!loading && !brands.length && (
                          <p>
                            Žádné značky nenalezeny. Zkuste jiný název nebo
                            vlastní obrázek.
                          </p>
                        )}
                        <div className="library-pages">
                          <button
                            disabled={!page || loading}
                            onClick={() => setPage(page - 1)}
                          >
                            Předchozí
                          </button>
                          <span>
                            {page + 1} / {Math.max(1, Math.ceil(total / 60))}
                          </span>
                          <button
                            disabled={(page + 1) * 60 >= total || loading}
                            onClick={() => setPage(page + 1)}
                          >
                            Další
                          </button>
                        </div>
                        <small className="license-note">
                          Loga pochází ze Simple Icons (CC0). Ochranné známky
                          patří vlastníkům; použití se řídí jejich pravidly.
                        </small>
                      </>
                    )}
                    {library === "icons" && (
                      <>
                        <p className="library-caption">
                          {Object.keys(icons).length} univerzálních ikon ·
                          Lucide (ISC)
                        </p>
                        <div className="logo-library">
                          {Object.entries(icons)
                            .filter(([key]) =>
                              (key + " " + labels[key])
                                .toLowerCase()
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .includes(
                                  query
                                    .toLowerCase()
                                    .normalize("NFD")
                                    .replace(/[\u0300-\u036f]/g, ""),
                                ),
                            )
                            .map(([key, Icon]) => (
                              <button
                                key={key}
                                className={
                                  draft.appearance?.icon === key &&
                                  !draft.appearance?.brand &&
                                  !draft.appearance?.logo
                                    ? "picked"
                                    : ""
                                }
                                title={labels[key]}
                                onClick={() => {
                                  setLogoFile(null);
                                  appearance({
                                    icon: key,
                                    brand: undefined,
                                    logo: undefined,
                                  });
                                }}
                              >
                                <Icon size={25} />
                                <span>{labels[key]?.split(" ")[0] || key}</span>
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                    {library === "upload" && (
                      <div className="upload-area">
                        <Upload size={34} />
                        <h3>Vaše vlastní logo</h3>
                        <p>PNG, JPG nebo WebP · nejvýše 600 kB</p>
                        <input
                          aria-label="Nahrát vlastní logo"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (
                              file.size > 600000 ||
                              ![
                                "image/png",
                                "image/jpeg",
                                "image/webp",
                              ].includes(file.type)
                            ) {
                              setError("Vyberte PNG, JPG nebo WebP do 600 kB.");
                              return;
                            }
                            setError("");
                            setLogoFile(file);
                            const reader = new FileReader();
                            reader.onload = () =>
                              appearance({
                                logo: String(reader.result),
                                brand: undefined,
                              });
                            reader.readAsDataURL(file);
                          }}
                        />
                        {draft.appearance?.logo && (
                          <button
                            onClick={() => {
                              setLogoFile(null);
                              appearance({ logo: undefined });
                            }}
                          >
                            <Trash2 size={16} />
                            Odstranit obrázek
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {tab === "style" && (
                  <div className="editor-panel">
                    <h3>Barevné styly</h3>
                    <div className="preset-grid">
                      {presets.map((p) => (
                        <button
                          key={p.name}
                          style={{
                            background: `linear-gradient(135deg,${p.background},${p.gradientEnd})`,
                            color: p.text || p.color,
                          }}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              color: p.color,
                              appearance: {
                                ...draft.appearance,
                                ...p,
                                iconColor: p.color,
                                text: p.text || "#12364b",
                                gradient: true,
                              },
                            })
                          }
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <div className="swatches">
                      {swatches.map((c) => (
                        <button
                          key={c}
                          aria-label={"Akcent " + c}
                          style={{ background: c }}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              color: c,
                              appearance: { ...draft.appearance, iconColor: c },
                            })
                          }
                        />
                      ))}
                    </div>
                    <div className="color-grid">
                      <ColorField
                        label="Akcent / rámeček"
                        value={draft.color}
                        onChange={(v) => setDraft({ ...draft, color: v })}
                      />
                      <ColorField
                        label="Pozadí"
                        value={draft.appearance.background || "#ffffff"}
                        onChange={(v) => appearance({ background: v })}
                      />
                      <ColorField
                        label="Text"
                        value={draft.appearance.text || "#12364b"}
                        onChange={(v) => appearance({ text: v })}
                      />
                      <ColorField
                        label="Univerzální ikona"
                        value={draft.appearance.iconColor || draft.color}
                        onChange={(v) => appearance({ iconColor: v })}
                      />
                    </div>
                    <label className="toggle-row">
                      <span>
                        <strong>Barevný gradient</strong>
                        <small>Plynulý přechod mezi dvěma barvami</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={!!draft.appearance.gradient}
                        onChange={(e) =>
                          appearance({ gradient: e.target.checked })
                        }
                      />
                    </label>
                    {draft.appearance.gradient && (
                      <div className="color-grid">
                        <ColorField
                          label="Druhá barva"
                          value={draft.appearance.gradientEnd || draft.color}
                          onChange={(v) => appearance({ gradientEnd: v })}
                        />
                        <label>
                          Směr gradientu · {draft.appearance.angle ?? 135}°
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={draft.appearance.angle ?? 135}
                            onChange={(e) =>
                              appearance({ angle: Number(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                    )}
                    <div className="color-grid">
                      <label>
                        Tvar karty
                        <select
                          value={draft.appearance.radius || "round"}
                          onChange={(e) =>
                            appearance({ radius: e.target.value })
                          }
                        >
                          <option value="round">Výrazně zaoblená</option>
                          <option value="soft">Jemně zaoblená</option>
                          <option value="square">Hranatá</option>
                        </select>
                      </label>
                      <label>
                        Provedení
                        <select
                          value={draft.appearance.cardStyle || "filled"}
                          onChange={(e) =>
                            appearance({ cardStyle: e.target.value })
                          }
                        >
                          <option value="filled">Barevná plocha</option>
                          <option value="outline">Barevný obrys</option>
                          <option value="minimal">Minimalistická</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
                {tab === "options" && (
                  <div className="editor-panel">
                    {[
                      [
                        "favorite",
                        "Oblíbená položka",
                        "Zobrazí se před ostatními položkami.",
                      ],
                      [
                        "important",
                        "Důležitá položka",
                        "Výraznější rámeček a barevné zvýraznění.",
                      ],
                      [
                        "hidden",
                        "Skrýt z výběru plateb",
                        "Položka zůstane v editoru i historii.",
                      ],
                    ].map(([key, title, description]) => (
                      <label className="toggle-row" key={key}>
                        <span>
                          <strong>{title}</strong>
                          <small>{description}</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={draft[key]}
                          onChange={(e) =>
                            setDraft({ ...draft, [key]: e.target.checked })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Pořadí
                      <input
                        type="number"
                        min={0}
                        value={draft.position}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            position: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <p className="editor-help">
                      Typ příjem/výdaj nelze po vytvoření změnit, aby zůstaly
                      výpočty historie správné.
                    </p>
                  </div>
                )}
              </div>
              <aside className="live-preview">
                <span className="eyebrow">
                  <span className="live-dot" />
                  ŽIVÝ NÁHLED
                </span>
                <h3>Takhle bude vypadat</h3>
                <Card item={draft} preview />
                <div className="preview-transaction">
                  <span className="item-symbol">
                    <ItemIcon item={draft} />
                  </span>
                  <div>
                    <strong>{draft.name || "Vaše položka"}</strong>
                    <small>Dnes · Uskutečněno</small>
                  </div>
                  <b
                    style={{
                      color: draft.kind === "INCOME" ? "#078631" : "#d52750",
                    }}
                  >
                    {draft.kind === "INCOME" ? "+" : "−"}{" "}
                    {Number(draft.defaultAmount || 0) / 100} Kč
                  </b>
                </div>
                <p>
                  Barvy a ikony se použijí ve výběru plateb. Uskutečněné
                  transakce si zachovají svůj původní název.
                </p>
              </aside>
            </div>
            <footer className="editor-footer">
              {draft.id && (
                <button
                  className="danger-text"
                  disabled={busy}
                  onClick={() => {
                    const item = draft;
                    setDraft(null);
                    setDeleting(item);
                  }}
                >
                  <Trash2 size={16} /> Odstranit položku
                </button>
              )}
              <div role="alert">
                {error || "Změny se projeví až po uložení."}
              </div>
              <button disabled={busy} onClick={close}>
                Zrušit
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void save()}
              >
                <Check size={18} />
                {busy ? "Ukládám…" : "Uložit položku"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {deleting && (
        <div className="studio-backdrop">
          <section
            className="delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <Trash2 size={30} />
            <h2 id="delete-title">Smazat „{deleting.name}“?</h2>
            <p>
              Položka zmizí z editoru a výběru nových plateb. Historie a již
              naplánované platby zůstanou zachovány. Opakování této položky se
              pozastaví.
            </p>
            <div>
              <button
                autoFocus
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Ponechat položku
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "Mažu…" : "Smazat položku"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
