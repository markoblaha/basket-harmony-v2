import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, Check, Minus, Plus, Trash2 } from "lucide-react";
import { Empty, ScreenHeader, Stepper } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { t, tn, type Key } from "@/i18n";
import { useSaveRecipe, type RecipeDraft } from "./api";
import { clearDraft, loadDraft } from "./cart";
import { AiBadge } from "./common";
import { formatAmount, ingName, renderStep } from "./logic";

const CATS = ["hlavne", "cestoviny", "polievky", "sladke", "ranajky", "salaty"] as const;
const stepFor = (unit: string) => (unit === "g" || unit === "ml" ? 50 : 1);
const hint = (u: string) => (u === "#qty" ? t("rc.check.qtyMissing") : u);

/** R3B – kontrola prečítaného receptu (alebo návrhu AI) pred uložením. Neisté miesta sú žlté. */
export function CheckPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveRecipe(household.id);
  const stored = useRef(loadDraft()).current;
  const [draft, setDraft] = useState<RecipeDraft | null>(() => (stored ? structuredClone(stored.recipe) : null));
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  if (!draft || !stored) {
    return (
      <div className="stack">
        <ScreenHeader onBack={() => navigate("/recipes")} title={t("rc.checkTitle")} />
        <Empty title={t("rc.checkGone")} action={<button type="button" className="btn btn-soft" onClick={() => navigate("/recipes")}>{t("rc.backToRecipes")}</button>} />
      </div>
    );
  }

  const pending = [
    ...draft.ingredients.map((x, i) => (x.uncertain ? `i${i}` : null)),
    ...draft.steps.map((x, i) => (x.uncertain ? `s${i}` : null)),
  ].filter((x): x is string => !!x);

  const edit = (fn: (d: RecipeDraft) => void) =>
    setDraft((d) => {
      const n = structuredClone(d!);
      fn(n);
      return n;
    });
  const resolveIng = (i: number, patch: Partial<RecipeDraft["ingredients"][number]> = {}) => edit((d) => { Object.assign(d.ingredients[i]!, patch, { uncertain: null }); });
  const resolveStep = (i: number, patch: Partial<RecipeDraft["steps"][number]> = {}) => edit((d) => { Object.assign(d.steps[i]!, patch, { uncertain: null }); });
  const next = () => refs.current[pending[0]!]?.scrollIntoView({ behavior: "smooth", block: "center" });

  const doSave = () => {
    if (!draft.name.trim()) return;
    save.mutate(draft, {
      onSuccess: (id) => {
        clearDraft();
        toast.show(t("rc.saved"), "success");
        navigate(`/recipes/r/${id}`, { replace: true });
      },
      onError: (e) => toast.show(errorMessage(e), "error"),
    });
  };

  const sub = stored.from === "ai" ? t("rc.fromAi") : t(`rc.from.${stored.from}` as Key);

  return (
    <div className="stack">
      <ScreenHeader onBack={() => navigate(-1)} title={t("rc.checkTitle")} sub={sub} right={draft.ai ? <AiBadge /> : undefined} />
      <div className="rc-check-wrap" style={{ top: 56 }}>
        <div className={cx("rc-check", !pending.length && "done")}>
          {pending.length ? <AlertTriangle size={18} /> : <Check size={18} />}
          <span className="grow">{pending.length ? tn("rc.toCheck", pending.length) : t("rc.allChecked")}</span>
          {pending.length > 0 && (
            <button type="button" className="btn btn-sm" style={{ background: "var(--surface)", color: "var(--text)" }} onClick={next}>
              {t("rc.next")}
            </button>
          )}
        </div>
      </div>

      <div className="stack g-20" style={{ padding: "8px 16px 0" }}>
        <div className="stack g-6">
          <label className="field-label" htmlFor="rc-name">{t("rc.name")}</label>
          <input id="rc-name" className="input" value={draft.name} maxLength={120} onChange={(e) => edit((d) => { d.name = e.target.value; })} />
        </div>
        <div className="row g-12">
          <div className="stack g-6 grow">
            <span className="field-label">{t("rc.portionsLabel")}</span>
            <Stepper value={draft.portions} min={1} onChange={(v) => edit((d) => { d.portions = v; })} />
          </div>
          <div className="stack g-6 grow">
            <span className="field-label">{t("rc.timeLabel")}</span>
            <Stepper value={draft.minutes} min={5} step={5} onChange={(v) => edit((d) => { d.minutes = v; })} />
          </div>
        </div>
        <div className="stack g-6">
          <span className="field-label">{t("rc.categoryLabel")}</span>
          <div className="chips">
            {CATS.map((c) => (
              <button key={c} type="button" className={cx("chip", draft.category === c && "on")} onClick={() => edit((d) => { d.category = c; })}>
                {t(`rc.cat.${c}`)}
              </button>
            ))}
          </div>
        </div>

        <section className="stack g-8">
          <span className="section-title">{t("rc.ingredients")}</span>
          <div className="stack g-6">
            {draft.ingredients.map((ing, i) => (
              <div key={`${ing.food}-${i}`} ref={(el) => { refs.current[`i${i}`] = el; }} className={ing.uncertain ? "rc-unsure stack g-8" : "card"} style={{ padding: "10px 12px" }}>
                <div className="row g-10">
                  <span className="grow t-body fw-5" style={{ minWidth: 0 }}>{ingName(ing)}</span>
                  {ing.unit === "hrst" ? (
                    <span className="t-body num">{formatAmount(ing.qty, ing.unit)}</span>
                  ) : (
                    <span className="row g-4">
                      <button type="button" className="ibtn sm" aria-label={t("kit.less")} onClick={() => edit((d) => { const x = d.ingredients[i]!; x.qty = Math.max(stepFor(x.unit) === 50 ? 10 : 0.5, x.qty - stepFor(x.unit)); })}>
                        <Minus size={16} />
                      </button>
                      <span className="t-body num fw-6" style={{ minWidth: 72, textAlign: "center" }}>{formatAmount(ing.qty, ing.unit)}</span>
                      <button type="button" className="ibtn sm" aria-label={t("kit.more")} onClick={() => edit((d) => { d.ingredients[i]!.qty += stepFor(d.ingredients[i]!.unit); })}>
                        <Plus size={16} />
                      </button>
                    </span>
                  )}
                  <button type="button" className="ibtn sm" aria-label={t("rc.removeIngredient", { name: ingName(ing) })} onClick={() => edit((d) => { d.ingredients.splice(i, 1); })}>
                    <Trash2 size={16} />
                  </button>
                </div>
                {ing.uncertain && (
                  <>
                    <span className="hint">{hint(ing.uncertain)}</span>
                    <div className="row wrap g-8">
                      <button type="button" className="chip" onClick={() => resolveIng(i)}>
                        {t("rc.check.ok", { qty: formatAmount(ing.qty, ing.unit) })}
                      </button>
                      {ing.unit === "hrst" && (
                        <button type="button" className="chip" onClick={() => resolveIng(i, { qty: 15, unit: "g" })}>
                          {t("rc.check.about15g")}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="stack g-8">
          <span className="section-title">{t("rc.steps")}</span>
          <div className="stack g-6">
            {draft.steps.map((st, i) => (
              <div key={i} ref={(el) => { refs.current[`s${i}`] = el; }} className={st.uncertain ? "rc-unsure stack g-8" : "card stack g-8"} style={{ padding: "10px 12px" }}>
                <div className="row g-10" style={{ alignItems: "flex-start" }}>
                  <span className="badge b-gray num" style={{ marginTop: 2 }}>{i + 1}</span>
                  <textarea
                    className="grow t-body"
                    style={{ resize: "none", minHeight: 44, background: "transparent" }}
                    rows={3}
                    value={renderStep(st.text, draft.ingredients)}
                    onChange={(e) => edit((d) => { d.steps[i]!.text = e.target.value; })}
                    aria-label={t("rc.stepN", { n: i + 1 })}
                  />
                </div>
                {st.uncertain && (
                  <>
                    <span className="hint">{hint(st.uncertain)}</span>
                    <div className="row wrap g-8">
                      <button type="button" className="chip" onClick={() => resolveStep(i)}>{t("rc.check.keep")}</button>
                      {[10, 15, 20, 25, 30].map((m) => (
                        <button key={m} type="button" className={cx("chip", st.timerMin === m && "on")} onClick={() => resolveStep(i, { timerMin: m, wait: true })}>
                          {t("rc.timerN", { n: m })}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {!st.uncertain && st.timerMin ? <span className="t-xs t-2">{t("rc.timerN", { n: st.timerMin })}</span> : null}
              </div>
            ))}
          </div>
        </section>
        <span className="t-xs t-3">{t("rc.sourceNote", { source: draft.source || sub })}</span>
      </div>
      <div style={{ height: 120 }} />
      <div className="bottom-cta fixed inset-x-0 mx-auto max-w-2xl" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <button type="button" className="btn btn-ink btn-lg btn-block" disabled={save.isPending || !draft.name.trim() || !draft.ingredients.length} onClick={doSave}>
          {pending.length ? t("rc.saveWithPending", { n: pending.length }) : t("rc.saveRecipe")}
        </button>
      </div>
    </div>
  );
}
