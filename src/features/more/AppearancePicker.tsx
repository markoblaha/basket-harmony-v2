/**
 * Voľba vzhľadu ako v mockupe: téma (Teplá kuchyňa / Fotky a sklo) a režim (svetlý / tmavý / podľa systému),
 * a jazyk.
 *
 * Náhľady tém sú malé ukážky aplikácie nakreslené rolami z dizajnového systému v pevnej téme
 * (atribút data-theme-scope v styles.css) – vždy ukazujú, ako bude appka vyzerať po výbere
 * v práve zobrazenom režime.
 */
import { Seg } from "@/components/kit";
import { cx } from "@/components/ui";
import { LOCALES, t, useLocale, type Key, type Locale } from "@/i18n";
import { useTheme, type ThemePreference, type ThemeStyle } from "@/theme/ThemeProvider";

/** Miniatúra obrazovky: nadpis, karta a hlavné tlačidlo vpravo dole. */
function Mini({ scope }: { scope: string }) {
  return (
    <span data-theme-scope={scope} className="mr-mini" aria-hidden>
      <i className="mr-mini-ttl" />
      <i className="mr-mini-card" />
      <i className="mr-mini-btn" />
    </span>
  );
}

const STYLES: { id: ThemeStyle; label: Key; sub: Key }[] = [
  { id: "warm", label: "more.appearance.warm", sub: "more.appearance.warmSub" },
  { id: "glass", label: "more.appearance.glass", sub: "more.appearance.glassSub" },
];

const MODES: { id: ThemePreference; label: Key }[] = [
  { id: "light", label: "more.appearance.light" },
  { id: "dark", label: "more.appearance.dark" },
  { id: "system", label: "more.appearance.system" },
];

export function ThemePicker() {
  const { preference, resolved, style, setPreference, setStyle } = useTheme();
  return (
    <div className="card stack g-12" style={{ padding: 12 }}>
      <div className="mr-styles" role="radiogroup" aria-label={t("more.appearance.theme")}>
        {STYLES.map(({ id, label, sub }) => {
          const on = style === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} className="stack g-6" style={{ textAlign: "left" }} onClick={() => setStyle(id)}>
              <span className={cx("mr-theme", on && "on")}>
                <Mini scope={`${id}-${resolved}`} />
              </span>
              <span className={cx("t-body", on ? "fw-6" : "fw-5")}>{t(label)}</span>
              <span className="t-sm t-2">{t(sub)}</span>
            </button>
          );
        })}
      </div>
      <Seg
        options={MODES.map((m) => ({ value: m.id, label: t(m.label) }))}
        value={preference}
        onChange={(v) => setPreference(v)}
      />
      {preference === "system" && (
        <span className="t-sm t-2" style={{ padding: "0 4px" }}>
          {resolved === "dark" ? t("more.appearance.nowDark") : t("more.appearance.nowLight")}
        </span>
      )}
    </div>
  );
}

const LANGUAGE_LABEL: Record<Locale, Key> = { sk: "more.language.sk", en: "more.language.en" };

/** Jazyk: prepínač v riadku nastavení (Slovenčina | English). */
export function LanguagePicker({ style }: { style?: React.CSSProperties }) {
  const { locale, setLocale } = useLocale();
  return (
    <Seg
      style={{ width: 170, ...style }}
      options={LOCALES.map((code) => ({ value: code, label: t(LANGUAGE_LABEL[code]) }))}
      value={locale}
      onChange={(v) => setLocale(v)}
    />
  );
}
