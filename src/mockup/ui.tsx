/**
 * Stavebné prvky prenesené z mockupu 1:1 (prototyp/src/ui.jsx). Štýly sú v src/mockup/mockup.css
 * (vygenerované z prototyp/css) a platia len vo vnútri obalu <div className="bhm">.
 * Texty idú cez t(), dáta z features/*\/api.ts.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAuth, useUserId } from "@/features/auth/AuthProvider";
import { useProfiles } from "@/features/household/api";
import { t } from "@/i18n";
import { ICONS } from "./icons";

/** Ikona Phosphor. w = fill | bold | regular (ako v mockupe). */
export function I({ n, w = "fill", s, cls = "" }: { n: string; w?: "fill" | "bold" | "regular"; s?: number; cls?: string }) {
  const svg = ICONS[w === "fill" ? n : `${n}:${w}`] ?? ICONS[n] ?? "";
  return (
    <span className={`ico ${cls}`} style={s ? { width: s, height: s } : undefined} aria-hidden="true">
      <svg viewBox="0 0 256 256" dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}

/** 3D emoji (Fluent) – obrázok z public/mk/em. */
export function E({ k, s, cls = "" }: { k: string; s?: number; cls?: string }) {
  return <span className={`em em-${k} ${cls}`} style={s ? { width: s, height: s } : undefined} aria-hidden="true" />;
}

/** Okrúhle tlačidlo s ikonou v hlavičke. */
export function IB({ n, w = "bold", onClick, label, cls = "" }: { n: string; w?: "fill" | "bold" | "regular"; onClick?: () => void; label: string; cls?: string }) {
  return (
    <button type="button" className={`ib ${cls}`} onClick={onClick} aria-label={label}>
      <I n={n} w={w} />
    </button>
  );
}

/** Prepínač ako v mockupe (Svetlý / Tmavý / Podľa systému). */
export function Seg<V extends string>({ items, value, onChange }: { items: [V, string][]; value: V; onChange: (v: V) => void }) {
  return (
    <div className="seg" role="tablist">
      {items.map(([k, l]) => (
        <button type="button" role="tab" aria-selected={value === k} key={k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Profil a nastavenia – rovnaké miesto na každej hlavnej záložke (začiatočné písmeno mena). */
export function MeBtn() {
  const navigate = useNavigate();
  const me = useUserId();
  const { user } = useAuth();
  const profiles = useProfiles();
  const name = profiles.data?.get(me) || user?.email?.split("@")[0] || "?";
  return (
    <button type="button" className="mebtn" onClick={() => navigate("/more")} aria-label={t("nav.me")}>
      {name.trim().charAt(0).toUpperCase()}
    </button>
  );
}

/** Späť s názvom predchádzajúcej obrazovky (štandard iOS). */
export function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="back" onClick={onClick} aria-label={`${t("common.back")}: ${label}`}>
      <I n="caret-left" w="bold" />
      <span>{label}</span>
    </button>
  );
}

/** Pri posúvaní stránky: hlavička dostane sklo a v strede sa ukáže malý nadpis (ako .sc.scrolled v mockupe). */
function useScrolled() {
  const [on, setOn] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const f = () => setOn(window.scrollY > 8);
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return on;
}

/**
 * Hlavička obrazovky z mockupu: vľavo avatar (koreňová obrazovka) alebo Späť, v strede malý nadpis
 * (ukáže sa pri posúvaní), vpravo tlačidlá; pod tým veľký nadpis. Lepí sa hore pri posúvaní.
 */
export function MkHeader({ title, back, right, children, style, bodyClass = "" }: { title: string; back?: ReactNode; right?: ReactNode; children?: ReactNode; style?: CSSProperties; bodyClass?: string }) {
  const scrolled = useScrolled();
  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            {back ?? <MeBtn />}
            <span className="nbt">{title}</span>
            {right ? <div className="nbr">{right}</div> : <span className="ibs" />}
          </header>
        </div>
      </div>
      <div className="bhm bhm-title" style={style}>
        <div className={`body ${bodyClass}`}>
          <h1 className="lt">{title}</h1>
          {children}
        </div>
      </div>
    </>
  );
}
