import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, Lightbulb, MessageCircle, Mic, Pause, Play, RotateCcw, Send, Sun, Timer, X } from "lucide-react";
import { haptic } from "@/components/kit";
import { Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useSpeech } from "@/features/voice/useSpeech";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { askRecipe, useCookRecipe, useRecipes, type Chat } from "./api";
import { STEP_DETAILS } from "./catalog";
import { formatAmount, ingName, isWait, renderStep, scaleIngredients, stepIngredients } from "./logic";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const dur = (sec: number) =>
  sec >= 3600 ? t("rc.durH", { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60) }) : sec >= 60 ? t("rc.durM", { m: Math.floor(sec / 60), s: sec % 60 }) : t("rc.durS", { s: sec });

type TimerState = { step: number; left: number; running: boolean; rang: boolean };

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
export function CookPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const recipes = useRecipes(household.id);
  const cook = useCookRecipe(household.id);
  const r = recipes.find(id);
  const portions = Number(params.get("p")) || r?.portions || 4;
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [ask, setAsk] = useState(false);
  const [chat, setChat] = useState<Chat[]>([]);
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState("");
  const [more, setMore] = useState(false);
  const [t0] = useState(() => Date.now());
  const [, tick] = useState(0);
  const speech = useSpeech((said) => {
    speech.stop();
    setQ(said);
  });
  useWakeLock();
  useEffect(() => {
    const x = setInterval(() => tick((v) => v + 1), 1000);
    return () => clearInterval(x);
  }, []);
  const running = timer?.running;
  useEffect(() => {
    if (!running) return undefined;
    const x = setInterval(() => {
      setTimer((s) => {
        if (!s || !s.running) return s;
        if (s.left <= 1) return { ...s, left: 0, running: false, rang: true };
        return { ...s, left: s.left - 1 };
      });
    }, 1000);
    return () => clearInterval(x);
  }, [running]);
  const rangStep = timer?.rang ? timer.step : null;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    if (rangStep == null) return;
    haptic(200);
    toastRef.current.show(t("rc.timerDone", { n: rangStep + 1 }), "success");
  }, [rangStep]);

  if (!r) return recipes.isPending ? <Spinner /> : null;
  const close = () => navigate(-1);
  const scaled = scaleIngredients(r, portions);
  const step = r.steps[i]!;
  const ings = stepIngredients(step.text, scaled);
  const det = step.done || step.tip || step.more ? step : STEP_DETAILS[r.id]?.[i];
  const wait = isWait(step);
  const elapsed = Math.round((Date.now() - t0) / 1000);
  const last = i === r.steps.length - 1;
  const thisTimer = timer && timer.step === i ? timer : null;
  const suggestions = [...(r.qa ?? []).map((x) => x.q), t("rc.ask.q1"), t("rc.ask.q2")].slice(0, 3);

  const ask1 = async (text: string) => {
    const question = text.trim();
    if (!question || asking) return;
    setQ("");
    setAsking(true);
    // Pripravená odpoveď z receptu je hneď; inak sa pýtame Gemini.
    const known = r.qa?.find((x) => x.q === question);
    if (known) {
      setChat((c) => [...c, { q: question, a: known.a }]);
      setAsking(false);
      return;
    }
    try {
      const res = await askRecipe({ recipe: r, portions, step: i, question, history: chat });
      setChat((c) => [...c, { q: question, a: res.answer, off: res.off_topic }]);
    } catch (e) {
      setChat((c) => [...c, { q: question, a: errorMessage(e), off: true }]);
    } finally {
      setAsking(false);
    }
  };
  const startTimer = () => {
    const full = (step.timerMin ?? 0) * 60;
    if (thisTimer) setTimer({ ...thisTimer, running: !thisTimer.running || thisTimer.left === 0, left: thisTimer.left || full, rang: false });
    else setTimer({ step: i, left: full, running: true, rang: false });
    haptic();
  };
  const go = (d: number) => {
    setI(i + d);
    setAsk(false);
    setChat([]);
    setMore(false);
  };
  const finish = () => {
    cook.mutate(
      { key: r.id, name: r.name, portions, seconds: elapsed },
      {
        onSuccess: () => {
          toast.show(t("rc.cookedSaved"), "success");
          navigate("/recipes", { replace: true });
        },
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[45] mx-auto flex max-w-2xl flex-col pt-safe" style={{ background: "var(--bg)" }}>
      {done ? (
        <>
          <div className="row" style={{ padding: "8px 8px 0" }}>
            <span className="grow" />
            <button type="button" className="ibtn" onClick={close} aria-label={t("common.close")}>
              <X size={22} />
            </button>
          </div>
          <div className="grow stack g-12" style={{ padding: 24, textAlign: "center", alignItems: "center", justifyContent: "center" }}>
            <span className="ibtn" style={{ width: 72, height: 72, background: "var(--accent-soft)", color: "var(--accent-text)" }}>
              <Check size={34} />
            </span>
            <span className="t-big">{t("rc.enjoy")}</span>
            <span className="t-body t-2">
              {r.name} · {tn("rc.portions", portions)}
            </span>
            <div className="card stack g-4" style={{ padding: "12px 16px", marginTop: 8, minWidth: 240 }}>
              <span className="t-xs t-2 row g-4" style={{ justifyContent: "center" }}>
                <Clock size={13} /> {t("rc.cookTime")}
              </span>
              <span className="t-big num">{dur(elapsed)}</span>
              <span className="t-xs t-3">{t("rc.cookTimeNote", { n: r.minutes })}</span>
            </div>
          </div>
          <div className="stack g-8" style={{ padding: "0 16px calc(28px + env(safe-area-inset-bottom))" }}>
            <button type="button" className="btn btn-ink btn-lg btn-block" disabled={cook.isPending} onClick={finish}>
              <Check size={18} /> {t("rc.cooked")}
            </button>
            <button type="button" className="btn btn-soft btn-block" onClick={() => setDone(false)}>{t("rc.backToSteps")}</button>
          </div>
        </>
      ) : (
        <>
          <div className="row g-8" style={{ padding: "6px 8px 0 16px", minHeight: 56 }}>
            <span className="grow stack" style={{ minWidth: 0 }}>
              <span className="t-xs t-2 ellipsis">
                {r.name} · {tn("rc.portions", portions)}
              </span>
              <span className="t-h">
                {t("rc.stepOf", { i: i + 1, n: r.steps.length })}
                <span className="t-xs t-3 num fw-5" style={{ marginLeft: 8 }} title={t("rc.elapsedTitle")}>
                  <Clock size={11} style={{ verticalAlign: -1, display: "inline" }} /> {mmss(elapsed)}
                </span>
              </span>
            </span>
            <button type="button" className="ibtn" onClick={close} aria-label={t("rc.stopCooking")}>
              <X size={22} />
            </button>
          </div>
          <div className="rc-bars" style={{ padding: "0 16px" }}>
            {r.steps.map((_, k) => (
              <span key={k} className={cx(k <= i && "on")} />
            ))}
          </div>

          <div className="grow" style={{ overflowY: "auto" }}>
            <div key={i} className="stack g-20 anim-rise" style={{ padding: "24px 16px 16px" }}>
              <p className="rc-cook-text" style={{ margin: 0 }}>{renderStep(step.text, scaled)}</p>

              {det && (det.done || det.tip || det.more) && (
                <div className="stack g-8">
                  {det.done && (
                    <div className="rc-hint ok">
                      <Eye size={16} />
                      <span>
                        <b>{t("rc.howDone")}</b> {det.done}
                      </span>
                    </div>
                  )}
                  {det.tip && (
                    <div className="rc-hint tip">
                      <Lightbulb size={16} />
                      <span>
                        <b>{t("rc.tip")}</b> {det.tip}
                      </span>
                    </div>
                  )}
                  {det.more && (
                    <>
                      <button type="button" className="row g-4 t-sm fw-6" style={{ alignSelf: "flex-start", minHeight: 36, color: "var(--text-2)" }} onClick={() => setMore(!more)} aria-expanded={more}>
                        {t("rc.moreDetail")} <ChevronDown size={16} style={{ transform: more ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
                      </button>
                      {more && <p className="t-body t-2 anim-drop" style={{ margin: 0 }}>{det.more}</p>}
                    </>
                  )}
                </div>
              )}

              {ings.length > 0 && (
                <div className="cells">
                  {ings.map((x) => (
                    <div key={x.food} className="cell" style={{ minHeight: 48 }}>
                      <span className="grow t-body">{ingName(x)}</span>
                      <span className="t-body num fw-6">{formatAmount(x.qty, x.unit)}</span>
                    </div>
                  ))}
                </div>
              )}

              {wait && (
                <div className="card row g-12" style={{ padding: "14px 14px 14px 18px" }}>
                  <span className="grow stack">
                    <span className="t-xs t-2 row g-4">
                      <Timer size={13} /> {t("rc.timer")}
                    </span>
                    <span className="rc-timer">{mmss(thisTimer ? thisTimer.left : (step.timerMin ?? 0) * 60)}</span>
                  </span>
                  {thisTimer && (
                    <button type="button" className="ibtn soft" onClick={() => setTimer(null)} aria-label={t("rc.timerCancel")}>
                      <RotateCcw size={19} />
                    </button>
                  )}
                  <button type="button" className="btn btn-soft" onClick={startTimer}>
                    {thisTimer?.running ? (
                      <>
                        <Pause size={18} /> {t("rc.pause")}
                      </>
                    ) : (
                      <>
                        <Play size={18} /> {thisTimer?.left ? t("rc.resume") : t("rc.start")}
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="stack g-8">
                <button type="button" className="btn btn-line" style={{ alignSelf: "flex-start" }} onClick={() => setAsk(!ask)} aria-expanded={ask}>
                  <MessageCircle size={18} /> {t("rc.askTitle")}
                </button>
                {ask && (
                  <div className="card stack g-10 anim-drop" style={{ padding: 12 }}>
                    {chat.map((m, k) => (
                      <div key={k} className="stack g-6">
                        <span className="rc-bubble me">{m.q}</span>
                        <span className={cx("rc-bubble ai", m.off && "off")}>{m.a}</span>
                      </div>
                    ))}
                    {asking && <span className="rc-bubble ai pulse">…</span>}
                    <div className="row g-6 wrap">
                      {suggestions.map((x) => (
                        <button key={x} type="button" className="chip soft" style={{ minHeight: 32, fontSize: 13 }} onClick={() => void ask1(x)}>
                          {x}
                        </button>
                      ))}
                    </div>
                    <form className="row g-6" onSubmit={(e) => { e.preventDefault(); void ask1(q); }}>
                      <input className="input grow" style={{ minHeight: 44 }} placeholder={speech.interim || t("rc.askPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("rc.askAria")} />
                      {speech.supported && (
                        <button type="button" className={cx("ibtn soft", speech.listening && "pulse")} aria-label={t("rc.askVoice")} onClick={() => (speech.listening ? speech.stop() : speech.start())}>
                          <Mic size={19} />
                        </button>
                      )}
                      <button type="submit" className="ibtn" aria-label={t("rc.send")} disabled={!q.trim() || asking}>
                        <Send size={18} />
                      </button>
                    </form>
                    <span className="t-xs t-3">{t("rc.askNote")}</span>
                  </div>
                )}
              </div>
              <span className="t-xs t-3 row g-4">
                <Sun size={13} /> {t("rc.screenOn")}
              </span>
            </div>
          </div>

          {timer && !thisTimer && (
            <button
              type="button"
              className="row g-8 t-sm fw-6"
              onClick={() => setI(timer.step)}
              style={{ margin: "0 16px 8px", padding: "10px 14px", borderRadius: 14, background: timer.left ? "var(--sunken)" : "var(--accent-soft)", color: timer.left ? "var(--text)" : "var(--accent-text)" }}
            >
              <Timer size={16} /> {t("rc.stepN", { n: timer.step + 1 })}: <span className="num">{timer.left ? mmss(timer.left) : t("rc.timerFinished")}</span>
              {!timer.running && timer.left > 0 && <span className="t-2">· {t("rc.paused")}</span>}
              <span className="grow" /> <ChevronRight size={16} />
            </button>
          )}
          <div className="row g-8" style={{ padding: "8px 16px calc(26px + env(safe-area-inset-bottom))" }}>
            <button type="button" className="btn btn-soft btn-lg" disabled={i === 0} onClick={() => go(-1)} aria-label={t("rc.prevStep")}>
              <ChevronLeft size={20} /> {t("common.back")}
            </button>
            <button type="button" className="btn btn-ink btn-lg grow" onClick={() => (last ? setDone(true) : go(1))}>
              {last ? t("rc.done") : t("rc.nextStep")} {!last && <ChevronRight size={20} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
