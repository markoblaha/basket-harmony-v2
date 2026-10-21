/**
 * Voľba vzhľadu (svetlý / tmavý / farebný / podľa systému) a jazyka – ako v prototype (V1).
 *
 * Náhľady tém sú malé ukážky aplikácie nakreslené rolami z dizajnového systému
 * v pevnej téme (atribút data-theme-scope v styles.css) – nemenia sa podľa
 * aktuálnej témy, takže vždy ukazujú, ako bude aplikácia vyzerať po výbere.
 */
import { Seg } from "@/components/kit";
import { cx } from "@/components/ui";
import { LOCALES, t, useLocale, type Key, type Locale } from "@/i18n";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";

/** Miniatúra obrazovky (ako v prototype): nadpis, karta a hlavné tlačidlo vpravo dole. */
function Mini({ mode }: { mode: "light" | "dark" | "color" }) {
  return (
    <span
      data-theme-scope={mode}
      className="mr-mini"
      style={mode === "color" ? { background: "var(--mesh)" } : undefined}
      aria-hidden
    >
      <i className="mr-mini-ttl" />
      <i className="mr-mini-card" />
      <i className="mr-mini-btn" />
    </span>
  );
}

const THEMES: { id: ThemePreference; label: Key }[] = [
  { id: "light", label: "more.appearance.light" },
  { id: "dark", label: "more.appearance.dark" },
  { id: "color", label: "more.appearance.color" },
  { id: "system", label: "more.appearance.system" },
];

export function ThemePicker() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div className="card stack g-10" style={{ padding: 12 }}>
      <div className="row g-8" role="radiogroup" aria-label={t("more.appearance.title")}>
        {THEMES.map(({ id, label }) => {
          const on = preference === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              className="grow stack g-6"
              style={{ alignItems: "center" }}
              onClick={() => setPreference(id)}
            >
              <span className={cx("mr-theme", on && "on")}>
                {id === "system" ? (
                  <>
                    <Mini mode="light" />
                    <Mini mode="dark" />
                  </>
                ) : (
                  <Mini mode={id} />
                )}
              </span>
              <span className={cx("t-sm", on ? "fw-6" : "t-2")}>{t(label)}</span>
            </button>
          );
        })}
      </div>
      {preference === "system" && (
        <span className="t-xs t-3" style={{ padding: "0 4px" }}>
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
