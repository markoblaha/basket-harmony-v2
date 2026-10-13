/**
 * Voľba vzhľadu (svetlá / tmavá / podľa systému) a jazyka.
 *
 * Náhľady tém sú malé „papierové“ ukážky aplikácie nakreslené pevnými farbami
 * z dizajnového systému – nemenia sa podľa aktuálnej témy, takže vždy ukazujú,
 * ako bude aplikácia vyzerať po výbere.
 */
import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { LOCALES, t, useLocale, type Key, type Locale } from "@/i18n";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";

const PALETTE = {
  light: { bg: "#f1ede5", card: "#fbf9f5", mute: "#cfc8bb", ink: "#1b1815", accent: "#d2401f" },
  dark: { bg: "#121110", card: "#24211e", mute: "#4a443e", ink: "#f1ece3", accent: "#ff6a45" },
} as const;

/** Miniatúra obrazovky: nadpis, tri riadky zoznamu (jeden odškrtnutý) a hlavné tlačidlo. */
function Mini({ mode }: { mode: "light" | "dark" }) {
  const c = PALETTE[mode];
  return (
    <div className="absolute inset-0 flex flex-col gap-[5px] p-2.5" style={{ background: c.bg }}>
      <i className="mb-0.5 block h-[6px] w-[46%] rounded-full" style={{ background: c.ink }} />
      {[false, true, false].map((done, i) => (
        <div key={i} className="flex h-[17px] items-center gap-[5px] rounded-[5px] px-[5px]" style={{ background: c.card }}>
          <span
            className="size-[7px] shrink-0 rounded-full"
            style={done ? { background: c.accent } : { boxShadow: `inset 0 0 0 1.5px ${c.mute}` }}
          />
          <i className="block h-[3px] flex-1 rounded-full" style={{ background: c.mute, opacity: done ? 0.55 : 1 }} />
        </div>
      ))}
      <i className="mt-auto block h-[15px] rounded-[6px]" style={{ background: c.accent }} />
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
  { id: "system", label: "more.appearance.system" },
];

export function ThemePicker() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <fieldset className="grid grid-cols-3 gap-3">
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
                  "relative block aspect-[4/5] overflow-hidden rounded-[0.875rem] border transition-[box-shadow,border-color]",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
                  checked ? "border-primary shadow-[0_0_0_2px_var(--primary)]" : "border-line-strong",
                )}
              >
                <ThemePreview theme={id} />
              </span>
              <span
                className={cx(
                  "flex items-center justify-center gap-1 text-sm font-semibold",
                  checked ? "text-text" : "text-text-2",
                )}
              >
                {checked && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
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
                "flex min-h-14 items-center justify-center gap-2.5 rounded-[var(--radius-surface)] border px-3 font-semibold transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
                checked ? "border-primary bg-primary text-on-primary" : "border-line bg-elevated text-text active:bg-pressed",
              )}
            >
              <span
                className={cx(
                  "grid h-6 min-w-8 place-items-center rounded-md px-1 text-[0.6875rem] font-extrabold tracking-wider",
                  checked ? "bg-on-primary/15" : "bg-surface text-text-2",
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
