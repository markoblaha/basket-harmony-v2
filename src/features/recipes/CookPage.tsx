import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useEstimator } from "@/features/lists/estimate";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Btn } from "@/mockup/kit";
import { useCookRecipe, useRecipes } from "./api";
import { STEP_DETAILS } from "./catalog";
import { formatAmount, ingName, renderStep, scaleIngredients } from "./logic";
import { art } from "./mk";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Obrazovka ostane zapnutá, kým sa varí (ak to prehliadač vie). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const get = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    void get();
    const again = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

/** R7 – varenie krok po kroku (celá obrazovka). Časovač beží ďalej aj pri prechode na iný krok. */

/**
 * Varenie krok po kroku – prenesené z mockupu 1:1 (prototyp/src/recipes.jsx Cook): bodky krokov, veľký text kroku,
 * „Hotové je, keď / Tip“, časovač pri kroku (aj viac naraz – bežiace sa ukážu hore), suroviny, Späť / Ďalší krok / Hotovo.
 * Obrazovka počas varenia nezhasne. Hotovo zapíše uvarenie (cook_recipe).
 */
export function CookPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const g = useTheme().style === "glass";
  const recipes = useRecipes(household.id);
  const cook = useCookRecipe(household.id);
  const est = useEstimator(household.id);
  const r = recipes.find(id);
  const portions = Number(params.get("p")) || r?.portions || 4;
  const [i, setI] = useState(0);
  const [timers, setTimers] = useState<Record<number, number | null>>({});
  const [showIng, setShowIng] = useState(false);
  const [t0] = useState(() => Date.now());
  const [, tick] = useState(0);
  const fired = useRef<Record<number, boolean>>({});
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useWakeLock();
  const anyTimer = Object.values(timers).some(Boolean);
  useEffect(() => {
    if (!anyTimer) return;
    const x = setInterval(() => {
      tick((v) => v + 1);
      for (const [k, end] of Object.entries(timers)) {
        if (end && Date.now() >= end && !fired.current[+k]) {
          fired.current[+k] = true;
          toastRef.current.show(t("rc.timerDone", { n: +k + 1 }), "success");
          try {
            navigator.vibrate?.([200, 100, 200]);
          } catch {
            /* bez vibrácie */
          }
        }
      }
    }, 1000);
    return () => clearInterval(x);
  }, [anyTimer, timers]);

  if (!r) return recipes.isPending ? <Spinner /> : null;
  const a = art(r);
  const steps = r.steps.length ? r.steps : [{ text: t("ck.noSteps") }];
  const st = steps[Math.min(i, steps.length - 1)]!;
  const scaled = scaleIngredients(r, portions);
  const det = st.done || st.tip || st.more ? st : STEP_DETAILS[r.id]?.[i];
  const end = timers[i];
  const left = end ? Math.max(0, (end - Date.now()) / 1000) : null;
  const running = Object.entries(timers).filter(([k, e]) => e && e > Date.now() && +k !== i);
  const last = i >= steps.length - 1;
  const finish = () =>
    cook.mutate(
      { key: r.id, name: r.name, portions, seconds: Math.round((Date.now() - t0) / 1000) },
      {
        onSuccess: () => {
          toast.show(t("ck.enjoy"), "success");
          navigate(-1);
        },
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );

  return (
    <div className="bhm bhm-full">
      <div className="scr cook">
        {g && a.pic && (
          <div className="bgl">
            <div className={`bgb pic-${a.pic}`} />
            <div className="veil dk" />
          </div>
        )}
        <header className="nb">
          <IB n="x" label={t("ck.close")} cls={g ? "glass2" : ""} onClick={() => navigate(-1)} />
          <span className="nbt sh">{t("rc.stepOf", { i: i + 1, n: steps.length })}</span>
          <div className="nbr">
            <HelpBtn screen="m-cook" cls={g ? "glass2" : ""} />
            <IB n="list" label={t("rc.ingredients")} cls={g ? "glass2" : ""} onClick={() => setShowIng(!showIng)} />
          </div>
        </header>
        <div className="dots">
          {steps.map((_, k) => (
            <i key={k} className={k < i ? "d" : k === i ? "c" : ""} />
          ))}
        </div>
        {running.map(([k, e]) => (
          <button type="button" key={k} className="runt" onClick={() => setI(+k)}>
            <I n="timer" />
            {t("ck.stepTimer", { n: +k + 1, time: mmss((e! - Date.now()) / 1000) })}
          </button>
        ))}
        <div className="cbody">
          {showIng ? (
            <div className={`lst${g ? " glass2" : ""}`}>
              {scaled.map((x, k) => (
                <div className="row" key={k}>
                  <span className="th">
                    <E k={est.emoji(ingName(x))} />
                  </span>
                  <div className="tx">
                    <b>{ingName(x)}</b>
                    <span className="sub">{formatAmount(x.qty, x.unit)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <span className="stn">{i + 1}</span>
              <p className="stx">{renderStep(st.text, scaled)}</p>
              {det && (
                <div className="cbox">
                  {det.done && (
                    <div className="sbx ok">
                      <I n="check-circle" />
                      <span>
                        <b>{t("ck.doneWhen")}</b> {det.done}
                      </span>
                    </div>
                  )}
                  {det.tip && (
                    <div className="sbx tip">
                      <I n="lightbulb" />
                      <span>
                        <b>{t("ck.tip")}</b> {det.tip}
                      </span>
                    </div>
                  )}
                  {det.more && (
                    <div className="sbx more">
                      <I n="info" />
                      <span>{det.more}</span>
                    </div>
                  )}
                </div>
              )}
              {!!st.timerMin &&
                (end ? (
                  <button type="button" className={`timer on${left === 0 ? " fin" : ""}`} onClick={() => setTimers((x) => ({ ...x, [i]: null }))}>
                    <I n={left === 0 ? "check" : "pause"} w={left === 0 ? "bold" : "fill"} />
                    <b>{left === 0 ? t("ck.ready") : mmss(left ?? 0)}</b>
                    <span>{left === 0 ? t("ck.timeUp") : t("ck.stop")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="timer"
                    onClick={() => {
                      fired.current[i] = false;
                      setTimers((x) => ({ ...x, [i]: Date.now() + (st.timerMin ?? 0) * 60000 }));
                    }}
                  >
                    <I n="timer" />
                    <b>{t("rk.minutes", { min: st.timerMin })}</b>
                    <span>{t("ck.start")}</span>
                  </button>
                ))}
            </>
          )}
        </div>
        <div className="cfoot">
          <Btn cls={`soft${g ? " gl" : ""}`} onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            <I n="caret-left" w="bold" />
            {t("common.back")}
          </Btn>
          {!last ? (
            <Btn
              cls={`pri grow${g ? " a" : ""}`}
              onClick={() => {
                setShowIng(false);
                setI(i + 1);
              }}
            >
              {t("ck.next")}
              <I n="caret-right" w="bold" />
            </Btn>
          ) : (
            <Btn cls={`pri grow${g ? " a" : ""}`} onClick={finish} disabled={cook.isPending}>
              <I n="check" w="bold" />
              {t("sp.done")}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
