/**
 * Voľba vzhľadu ako v mockupe: téma (Teplá kuchyňa / Fotky a sklo) s náhľadmi a režim
 * (svetlý / tmavý / podľa systému), a jazyk.
 */
import { Seg as KitSeg } from "@/components/kit";
import { useToast } from "@/components/toast";
import { LOCALES, t, useLocale, type Key, type Locale } from "@/i18n";
import { E, I, Seg } from "@/mockup/ui";
import { useTheme, type ThemePreference, type ThemeStyle } from "@/theme/ThemeProvider";

const STYLES: { id: ThemeStyle; label: Key; sub: Key }[] = [
  { id: "warm", label: "more.appearance.warm", sub: "more.appearance.warmSub" },
  { id: "glass", label: "more.appearance.glass", sub: "more.appearance.glassSub" },
];

/** Výber témy a režimu presne ako v mockupe (prototyp/src/more.jsx ThemePicker + Vzhľad). */
export function ThemePicker({ name }: { name: string }) {
  const { preference, resolved, style, setPreference, setStyle } = useTheme();
  const toast = useToast();
  return (
    <div className="bhm bhm-inline">
      <div className="body" style={{ padding: 0, gap: 12 }}>
        <div className="tpick">
          {STYLES.map(({ id, label, sub }) => (
            <button
              type="button"
              key={id}
              className={`tp${style === id ? " on" : ""}`}
              aria-pressed={style === id}
              onClick={() => {
                setStyle(id);
                toast.show(t("more.appearance.picked", { name: t(label) }));
              }}
            >
              <span className={`tprev tp-${id === "warm" ? "w" : "g"}`}>
                {id === "warm" ? (
                  <>
                    <span className="pw-a">
                      {t("more.appearance.previewHello")}
                      <br />
                      <em>{name}</em>
                    </span>
                    <span className="pw-c">
                      <i />
                      <b />
                    </span>
                    <span className="pw-e">
                      <E k="pot" s={26} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="pg-p pic-gulas_p" />
                    <span className="pg-c">
                      <i />
                      <b />
                    </span>
                    <span className="pg-o" />
                  </>
                )}
              </span>
              <span className="tpt">
                <b>
                  {t(label)}
                  {style === id && <I n="check-circle" />}
                </b>
                <small>{t(sub)}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="h2 sm">{t("more.appearance.title")}</div>
        <Seg
          items={[
            ["light", t("more.appearance.light")],
            ["dark", t("more.appearance.dark")],
            ["system", t("more.appearance.system")],
          ]}
          value={preference}
          onChange={(v: ThemePreference) => setPreference(v)}
        />
        {preference === "system" && <p className="meta sm">{resolved === "dark" ? t("more.appearance.nowDark") : t("more.appearance.nowLight")}</p>}
      </div>
    </div>
  );
}

const LANGUAGE_LABEL: Record<Locale, Key> = { sk: "more.language.sk", en: "more.language.en" };

/** Jazyk: prepínač v riadku nastavení (Slovenčina | English). */
export function LanguagePicker({ style }: { style?: React.CSSProperties }) {
  const { locale, setLocale } = useLocale();
  return (
    <KitSeg
      style={{ width: 170, ...style }}
      options={LOCALES.map((code) => ({ value: code, label: t(LANGUAGE_LABEL[code]) }))}
      value={locale}
      onChange={(v) => setLocale(v)}
    />
  );
}
