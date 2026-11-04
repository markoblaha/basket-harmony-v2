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
import { haptic } from "@/components/kit";
import { useCookRecipe, useRecipes } from "./api";
import { STEP_DETAILS } from "./catalog";
import { StepChips } from "./book";
import type { Step } from "./types";
import { formatAmount, ingName, renderStep, scaleIngredients, stepIngredients } from "./logic";
import { bookAmount, duration } from "./book";
import { stepFoods } from "./kniha";
import { FOODS } from "./foods";
import { art } from "./mk";

const COOK_HINT = "bh.cookHint";
const reduced = () => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
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
 * Kroky sa dajú meniť aj ťuknutím na ľavú (späť) / pravú (ďalej) časť obrazovky, potiahnutím prstom (krok ide za
 * prstom) a klávesmi ← →. Na poslednom kroku ťah ani ťuk nič neukončí – na to je tlačidlo Hotovo.
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
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem(COOK_HINT);
    } catch {
      return false;
    }
  });
  const stepEl = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; on: boolean } | null>(null);
  const swiped = useRef(false);
  const count = r?.steps.length || 1;

  /** Ďalší / predchádzajúci krok. Za koncom krok len pruží (ťah ani ťuk nikdy neukončí varenie). */
  const move = (d: 1 | -1, gesture = false) => {
    if (gesture && hint) {
      setHint(false);
      try {
        localStorage.setItem(COOK_HINT, "1");
      } catch {
        /* bez úložiska – nevadí */
      }
    }
    const n = i + d;
    if (n < 0 || n >= count) {
      if (!reduced()) stepEl.current?.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-d * 16}px)` }, { transform: "translateX(0)" }], { duration: 280, easing: "ease-out" });
      return;
    }
    setDir(d);
    setShowIng(false);
    setI(n);
    haptic(8);
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  // Klávesy (počítač, klávesnica pri tablete): ← → a medzerník.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") moveRef.current(1, true);
      else if (e.key === "ArrowLeft") moveRef.current(-1, true);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
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
  // Recept z knihy má podrobnosti priamo v kroku; staršie recepty ich majú v STEP_DETAILS.
  const det: Pick<Step, "done" | "tip" | "more" | "warn"> | undefined = r.book || st.done || st.tip || st.more ? st : STEP_DETAILS[r.id]?.[i];
  const end = timers[i];
  const left = end ? Math.max(0, (end - Date.now()) / 1000) : null;
  // Suroviny tohto kroku s množstvom (kniha: podľa slov v texte, inak podľa {odkazov}).
  const stepIngs = r.book ? stepFoods(st, scaled) : stepIngredients(st.text, scaled);
  // Koľko času ešte zostáva: bežiace časovače podľa skutočnosti, ostatné kroky podľa receptu.
  const remain = steps.slice(i).reduce((sum, s2, k) => {
    const e2 = timers[i + k];
    return sum + (e2 ? Math.max(0, (e2 - Date.now()) / 60000) : (s2.timerMin ?? 0));
  }, 0);
  const nextStep = steps[i + 1];
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
        {remain >= 1 && <div className="ck-left">{t("ck.left", { time: duration(Math.ceil(remain)) })}</div>}
        {running.map(([k, e]) => (
          <button
            type="button"
            key={k}
            className="runt"
            onClick={() => {
              setDir(+k > i ? 1 : -1);
              setI(+k);
            }}
          >
            <I n="timer" />
            {t("ck.stepTimer", { n: +k + 1, time: mmss((e! - Date.now()) / 1000) })}
          </button>
        ))}
        <div
          className={`cbody${showIng ? "" : " swipe"}`}
          onPointerDown={(e) => {
            if (showIng || (e.pointerType === "mouse" && e.button !== 0)) return;
            drag.current = { x: e.clientX, y: e.clientY, t: Date.now(), on: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (!d.on) {
              if (Math.abs(dx) < 10) return;
              if (Math.abs(dy) > Math.abs(dx)) {
                drag.current = null;
                return;
              }
              d.on = true;
            }
            const el = stepEl.current;
            if (!el) return;
            // Krok ide za prstom; na začiatku a na konci len s odporom.
            const edge = (dx > 0 && i === 0) || (dx < 0 && i >= count - 1);
            const x = edge ? dx * 0.25 : dx * 0.85;
            el.style.transition = "none";
            el.style.transform = `translateX(${x}px)`;
            el.style.opacity = String(1 - Math.min(0.45, Math.abs(x) / 700));
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d?.on) return;
            swiped.current = true;
            const dx = e.clientX - d.x;
            const el = stepEl.current;
            const fast = Math.abs(dx) > 30 && Date.now() - d.t < 250;
            const to = dx < 0 ? 1 : -1;
            if ((Math.abs(dx) > 70 || fast) && i + to >= 0 && i + to < count) {
              if (el) {
                el.style.transition = "none";
                el.style.transform = "";
                el.style.opacity = "";
              }
              move(to, true);
              return;
            }
            if (el) {
              el.style.transition = "transform .22s ease-out, opacity .22s";
              el.style.transform = "";
              el.style.opacity = "";
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
            const el = stepEl.current;
            if (el) {
              el.style.transition = "transform .22s ease-out, opacity .22s";
              el.style.transform = "";
              el.style.opacity = "";
            }
          }}
          onClick={(e) => {
            // Ťuk: ľavá tretina = späť, inde = ďalej (ako príbehy). Tlačidlá (časovač) majú prednosť.
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            if (showIng || (e.target as HTMLElement).closest("button, a, input, [role=button]")) return;
            const box = e.currentTarget.getBoundingClientRect();
            move((e.clientX - box.left) / box.width < 0.35 ? -1 : 1, true);
          }}
        >
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
            <div key={i} ref={stepEl} className={`ckst${dir > 0 ? " in-next" : dir < 0 ? " in-prev" : ""}`}>
              <span className="stn">{i + 1}</span>
              <p className="stx">{renderStep(st.text, scaled)}</p>
              {st.heat && <StepChips st={{ heat: st.heat }} />}
              {stepIngs.length > 0 && (
                <div className="ck-ing" aria-label={t("ck.forStep")}>
                  {stepIngs.map((x, k) => {
                    const name = x.label || ingName(x);
                    return (
                      <span key={`${x.ref ?? x.food}${k}`}>
                        <E k={FOODS[x.food]?.free ? "water" : est.emoji(FOODS[x.food]?.name ?? name, FOODS[x.food]?.cat)} />
                        <b>{name}</b>
                        <small>{r.book ? bookAmount(x) : formatAmount(x.qty, x.unit)}</small>
                      </span>
                    );
                  })}
                </div>
              )}
              {det && (det.done || det.tip || det.more || det.warn) && (
                <div className="cbox">
                  {det.warn && (
                    <div className="sbx pz">
                      <I n="warning" />
                      <span>
                        <b>{t("ck.warn")}</b> {det.warn}
                      </span>
                    </div>
                  )}
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
                    <span className="tring" style={{ ["--p" as string]: String(Math.max(0, Math.min(1, (left ?? 0) / Math.max(1, (st.timerMin ?? 1) * 60)))) }}>
                      <I n={left === 0 ? "check" : "pause"} w={left === 0 ? "bold" : "fill"} />
                    </span>
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
              {nextStep && (
                <button type="button" className="ck-peek" onClick={() => move(1)}>
                  <small>{t("ck.nextLabel")}</small>
                  <span className="pk-tx">{renderStep(nextStep.text, scaled)}</span>
                  <I n="caret-right" w="bold" />
                </button>
              )}
            </div>
          )}
          {hint && !showIng && steps.length > 1 && (
            <p className="ck-hint">
              <I n="hand-swipe-left" />
              {t("ck.swipeHint")}
            </p>
          )}
        </div>
        <div className="cfoot">
          <Btn cls={`soft${g ? " gl" : ""}`} onClick={() => move(-1)} disabled={i === 0}>
            <I n="caret-left" w="bold" />
            {t("common.back")}
          </Btn>
          {!last ? (
            <Btn
              cls={`pri grow${g ? " a" : ""}`}
              onClick={() => move(1)}
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
