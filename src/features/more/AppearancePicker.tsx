/**
 * Voľba vzhľadu (svetlá / tmavá / farebná / podľa systému) a jazyka.
 *
 * Náhľady tém sú malé ukážky aplikácie nakreslené rolami z dizajnového systému
 * v pevnej téme (atribút data-theme-scope v styles.css) – nemenia sa podľa
 * aktuálnej témy, takže vždy ukazujú, ako bude aplikácia vyzerať po výbere.
 */
import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { LOCALES, t, useLocale, type Key, type Locale } from "@/i18n";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";

/** Miniatúra obrazovky: nadpis, tri riadky zoznamu (jeden odškrtnutý) a hlavné tlačidlo. */
function Mini({ mode }: { mode: "light" | "dark" | "color" }) {
  return (
    <div data-theme-scope={mode} className="absolute inset-0 flex flex-col gap-[5px] bg-bg p-3" style={mode === "color" ? { background: "var(--mesh)" } : undefined}>
      <i className="mb-0.5 block h-[6px] w-[46%] rounded-full bg-text" />
      {[false, true, false].map((done, i) => (
        <div key={i} className="flex h-[17px] items-center gap-[5px] rounded-[5px] bg-surface px-[5px]">
          <span className={cx("size-[7px] shrink-0 rounded-[2px]", done ? "bg-accent" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]")} />
          <i className={cx("block h-[3px] flex-1 rounded-full bg-line-strong", done && "opacity-50")} />
        </div>
      ))}
      <i className="mt-auto block h-[15px] rounded-[6px] bg-primary" />
    </div>
  );
}

function ThemePreview({ theme }: { theme: ThemePreference }) {
  if (theme === "system") {
    return (
      <>
        <Mini mode="light" />
        {/* Tmavá polovica vpravo dole: „podľa zariadenia“ je buď jedno, alebo druhé. */}
        <div className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
          <Mini mode="dark" />
        </div>
      </>
    );
  }
  return <Mini mode={theme} />;
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
    <div>
      <fieldset className="grid grid-cols-4 gap-2.5">
        <legend className="sr-only">{t("more.appearance.title")}</legend>
        {THEMES.map(({ id, label }) => {
          const checked = preference === id;
          return (
            <label key={id} className="flex cursor-pointer flex-col gap-2">
              <input
                type="radio"
                name="theme"
                value={id}
                checked={checked}
                onChange={() => setPreference(id)}
                className="peer sr-only"
              />
              <span
                className={cx(
                  "relative block aspect-[4/5] overflow-hidden rounded-xl border transition-[box-shadow,border-color] duration-200",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
                  checked ? "border-primary shadow-[0_0_0_2px_var(--primary)]" : "border-line-strong",
                )}
              >
                <ThemePreview theme={id} />
              </span>
              <span
                className={cx(
                  "flex min-h-6 items-center justify-center gap-1 text-center text-footnote font-strong",
                  checked ? "text-text" : "text-text-2",
                )}
              >
                {checked && <Check className="size-3.5" strokeWidth={2.4} aria-hidden />}
                {t(label)}
              </span>
            </label>
          );
        })}
      </fieldset>
      {preference === "system" && (
        <p className="mt-3 px-0.5 text-sm text-text-3">
          {resolved === "dark" ? t("more.appearance.nowDark") : t("more.appearance.nowLight")}
        </p>
      )}
    </div>
  );
}

const LANGUAGE_LABEL: Record<Locale, Key> = { sk: "more.language.sk", en: "more.language.en" };

export function LanguagePicker() {
  const { locale, setLocale } = useLocale();
  return (
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="sr-only">{t("more.language.title")}</legend>
      {LOCALES.map((code) => {
        const checked = locale === code;
        return (
          <label key={code} className="cursor-pointer">
            <input
              type="radio"
              name="language"
              value={code}
              checked={checked}
              onChange={() => setLocale(code)}
              className="peer sr-only"
            />
            <span
              className={cx(
                "flex min-h-14 items-center justify-center gap-3 rounded-[var(--radius-surface)] border px-3 font-strong transition-colors duration-200",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
                checked ? "border-transparent bg-primary-soft text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]" : "border-transparent bg-surface text-text shadow-card active:bg-pressed",
              )}
            >
              <span
                className={cx(
                  "grid h-6 min-w-8 place-items-center rounded-sm px-1 text-xs font-semibold tracking-wider",
                  checked ? "bg-primary text-on-primary" : "bg-sunken text-text-2",
                )}
                aria-hidden
              >
                {code.toUpperCase()}
              </span>
              {t(LANGUAGE_LABEL[code])}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
