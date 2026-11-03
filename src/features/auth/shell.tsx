/**
 * Spoločný vzhľad obrazoviek mimo appky (prihlásenie, nové heslo, prvé spustenie, pozvánka) –
 * v štýle tém z mockupu (obal .bhm, triedy z src/mockup/mockup.css, rozloženie v adapt.css .auth-pg).
 */
import type { InputHTMLAttributes, ReactNode } from "react";
import { I } from "@/mockup/ui";
import { useTheme } from "@/theme/ThemeProvider";

export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const glass = useTheme().style === "glass";
  return (
    <>
      {glass && (
        // Fotky a sklo: rovnaké pozadie ako v appke (rozmazaná fotka trhu so závojom).
        <div className="bhm bhm-bg" aria-hidden>
          <div className="bgl">
            <div className="bgb pic-trh_p" />
            <div className="veil" />
          </div>
        </div>
      )}
      <div className="bhm auth-pg">
        <main className={`auth-wrap${wide ? " wide" : ""}`}>{children}</main>
      </div>
    </>
  );
}

/** Logo appky (košík v dlaždici hlavnej farby) a názov. */
export function AuthLogo() {
  return (
    <div className="auth-logo">
      <span className="auth-mark" aria-hidden>
        <I n="basket" />
      </span>
      <b>Basket Harmony</b>
    </div>
  );
}

/** Pole formulára: popis nad poľom, nápoveda alebo chyba pod ním. */
export function Field({ label, hint, error, trailing, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; trailing?: ReactNode }) {
  return (
    <label className={`fl auth-fl${error ? " bad" : ""}`}>
      <span>{label}</span>
      <span className="auth-in">
        <input {...input} aria-invalid={error ? true : undefined} />
        {trailing}
      </span>
      {error ? <small className="err">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** Hlásenie na obrazovke (chyba, úspech, upozornenie). */
export function Note({ tone, title, children }: { tone: "danger" | "ok" | "warn"; title?: string; children?: ReactNode }) {
  return (
    <div className={`auth-note ${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <I n={tone === "ok" ? "check-circle" : "warning-circle"} />
      <div>
        {title && <b>{title}</b>}
        {children && <span>{children}</span>}
      </div>
    </div>
  );
}
