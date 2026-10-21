import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronRight, House, Plus, ShoppingBasket, X } from "lucide-react";
import { BottomSheet, CatIcon, Empty, ScreenHeader, Seg, SheetHeader, Stepper, StoreBadge, haptic } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { useHubSessions, useListStats, useLists } from "@/features/lists/api";
import { listDay } from "@/features/lists/dates";
import { qtyLabel } from "@/features/lists/qty";
import { category, guessCategory, normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { parseItemInput } from "@/lib/parseItem";
import { shortName } from "@/lib/shortName";
import { t, tn } from "@/i18n";
import { usePlanRecipes, useRecipes } from "./api";
import { cart, useCart, type CartState } from "./cart";
import { Cover, NoTabScreen } from "./common";
import { buyPlan, formatAmount, mergeIngredients, recipeMeta, toListEntry, type Row } from "./logic";
import { NutritionSheet } from "./RecipePage";
import type { Recipe } from "./types";

const STORES = ["Lidl", "Kaufland", "Tesco", "Billa", "Teta"];
const markOf = (c: CartState, row: Row) => c.marks[row.key] ?? (row.staple ? "home" : "buy");
type Marked = { recipeId: string; portions: number; n: number; r: Recipe };

/** Riadky košíka + značky receptov (číslo a farba). */
function useCartRows() {
  const { household } = useHousehold();
  const recipes = useRecipes(household.id);
  const c = useCart(household.id);
  return useMemo(() => {
    const marked: Marked[] = c.items
      .map((x, i) => ({ ...x, n: i + 1, r: recipes.find(x.recipeId) }))
      .filter((x): x is Marked => !!x.r);
    const rows = mergeIngredients(marked, recipes.find);
    const buy = rows.filter((row) => markOf(c, row) === "buy");
    const home = rows.filter((row) => markOf(c, row) === "home");
    return { c, recipes: marked, rows, buy, home, extras: c.extras, all: recipes };
  }, [c, recipes]);
}

function Mark({ x }: { x: Marked }) {
  return (
    <span className="rc-mark num" style={{ "--h": x.r.hue } as React.CSSProperties} aria-label={x.r.name}>
      {x.n}
    </span>
  );
}

/** R5 – „Čo máš doma?“ Spojené suroviny všetkých receptov z košíka. */
export function CartPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const { c, recipes, rows, buy, home, extras } = useCartRows();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [extra, setExtra] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [target, setTarget] = useState(false);
  const [nutri, setNutri] = useState(false);
  const hid = household.id;

  const toggle = (row: Row) => {
    haptic();
    cart.update(hid, (s) => ({ ...s, marks: { ...s.marks, [row.key]: markOf(s, row) === "buy" ? "home" : "buy" } }));
  };
  const removeRecipe = (id: string) => {
    const before = cart.get(hid).items;
    cart.remove(hid, id);
    setEditing(null);
    toast.show(t("rc.removedFromCart"), "info", { undo: () => cart.update(hid, (s) => ({ ...s, items: before })) });
  };
  const addExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseItemInput(extra);
    if (!p.name) return;
    cart.update(hid, (s) => {
      // rovnaká vec znova = zvýš počet, nie nový riadok
      const unit = p.unit || "ks";
      const same = s.extras.find((x) => normalizeName(x.name) === normalizeName(p.name) && x.unit === unit);
      const extras = same
        ? s.extras.map((x) => (x === same ? { ...x, qty: x.qty + (p.quantity ?? 1) } : x))
        : [...s.extras, { id: crypto.randomUUID(), name: p.name, qty: p.quantity ?? 1, unit, cat: guessCategory(p.name) }];
      return { ...s, extras };
    });
    setExtra("");
  };

  if (!recipes.length) {
    return (
      <NoTabScreen>
        <div className="rc-full-scroll">
        <ScreenHeader onBack={() => navigate(-1)} title={t("rc.cartEmptyTitle")} />
        <Empty
          icon={ShoppingBasket}
          title={t("rc.cartEmpty")}
          text={t("rc.cartEmptyText")}
          action={<button type="button" className="btn btn-soft" onClick={() => navigate("/recipes")}>{t("rc.pickRecipes")}</button>}
        />
        </div>
      </NoTabScreen>
    );
  }

  const tiles = rows; // poradie podľa kategórií obchodu (mergeIngredients)
  const nBuy = buy.length + extras.length;
  const editX = recipes.find((y) => y.recipeId === editing);

  return (
    <NoTabScreen>
      <div className="rc-full-scroll">
      <ScreenHeader onBack={() => navigate(-1)} title={t("rc.whatAtHome")} sub={t("rc.step1", { what: `${tn("rc.ingFor", recipes.length)} · ${recipes.length}` })} />
      <div className="stack g-16" style={{ padding: "0 16px" }}>
        <span className="field-label" style={{ marginBottom: -8 }}>{t("rc.recipesInShop")}</span>
        <div className="row wrap g-8">
          {recipes.map((x) => (
            <button key={x.recipeId} type="button" className={cx("chip", editing === x.recipeId && "on")} onClick={() => setEditing(editing === x.recipeId ? null : x.recipeId)} aria-expanded={editing === x.recipeId}>
              <Mark x={x} /> {x.r.name} · <span className="num">{x.portions}</span>
            </button>
          ))}
          <button type="button" className="chip soft" onClick={() => setMore(true)}>
            <Plus size={15} /> {t("rc.addAnother")}
          </button>
        </div>
        {editX && (
          <div className="card row g-10 anim-drop" style={{ padding: "10px 12px" }}>
            <span className="grow stack">
              <span className="t-h">{editX.r.name}</span>
              <span className="t-sm t-2">{tn("rc.portions", editX.portions)}</span>
            </span>
            <Stepper value={editX.portions} min={1} onChange={(v) => cart.set(hid, editX.recipeId, v)} small />
            <button type="button" className="ibtn sm" onClick={() => removeRecipe(editX.recipeId)} aria-label={t("rc.removeRecipe")}>
              <X size={18} />
            </button>
          </div>
        )}

        <span className="t-body t-2">{t("rc.tapHome")}</span>
        <button type="button" className="row g-6 t-sm link" style={{ minHeight: 32, alignSelf: "flex-start" }} onClick={() => setNutri(true)}>
          {t("rc.n.ofRecipes")} <ChevronRight size={15} />
        </button>

        {/* Dlaždice idú za sebou bez medzier medzi kategóriami; kategória je len tichý štítok v dlaždici. */}
        <div className="rc-tiles">
          {tiles.map((row) => {
            const isHome = markOf(c, row) === "home";
            const plan = buyPlan(row);
            const marks = recipes.filter((x) => row.sources.some((src) => src.recipeId === x.recipeId));
            return (
              <div
                key={row.key}
                className={cx("rc-tile", isHome && "home")}
                role="button"
                tabIndex={0}
                aria-pressed={isHome}
                onClick={() => toggle(row)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(row))}
              >
                <span className="rc-tcat">
                  <CatIcon id={row.cat} size="sm" /> {category(row.cat).name}
                </span>
                <span className="rc-name">{row.name}</span>
                <span className="t-sm num">{formatAmount(row.qty, row.unit)}</span>
                <span className="grow" />
                <span className="row g-6">
                  {isHome ? (
                    <span className="rc-state">
                      <House size={13} /> {t("rc.haveHome")}
                    </span>
                  ) : (
                    <span className="rc-state t-accent">
                      <ShoppingBasket size={13} /> {t("rc.buy", { what: plan.buyLabel })}
                    </span>
                  )}
                  <span className="grow" />
                  <button
                    type="button"
                    className="rc-marks"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetail(row.key);
                    }}
                    aria-label={t("rc.fromWhich", { name: row.name })}
                  >
                    {marks.map((x) => (
                      <Mark key={x.recipeId} x={x} />
                    ))}
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        <section className="stack g-8">
          {extras.length > 0 && (
            <>
              <span className="section-title">{t("rc.extras")}</span>
              <div className="cells">
                {extras.map((x) => (
                  <div key={x.id} className="cell" style={{ minHeight: 48 }}>
                    <CatIcon id={x.cat} size="sm" />
                    <span className="grow t-body">{x.name}</span>
                    <span className="t-sm t-2 num">{qtyLabel(x.qty, x.unit)}</span>
                    <button type="button" className="ibtn sm" aria-label={t("rc.removeExtra", { name: x.name })} onClick={() => cart.update(hid, (s) => ({ ...s, extras: s.extras.filter((y) => y.id !== x.id) }))}>
                      <X size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {adding ? (
            <form className="row g-8 anim-drop" onSubmit={addExtra}>
              <input className="input grow" autoFocus placeholder={t("rc.extraPlaceholder")} value={extra} onChange={(e) => setExtra(e.target.value)} aria-label={t("rc.extraAria")} />
              <button type="submit" className="btn btn-soft" disabled={!extra.trim()}>{t("rc.add")}</button>
            </form>
          ) : (
            <button type="button" className="btn btn-line btn-block" onClick={() => setAdding(true)}>
              <Plus size={18} /> {t("rc.addExtras")}
            </button>
          )}
        </section>
      </div>
      <div style={{ height: 150 }} />
      </div>
      <div className="bottom-cta no-tab">
        <div className="stack g-6">
          <span className="t-xs t-2" style={{ textAlign: "center" }}>{t("rc.homeCount", { n: home.length })}</span>
          <button type="button" className="btn btn-ink btn-lg btn-block" disabled={!nBuy} onClick={() => setTarget(true)}>
            {t("rc.nextToList", { what: tn("shop.itemCount", nBuy) })} <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <SourcesSheet rowKey={detail} onClose={() => setDetail(null)} />
      <AddRecipeSheet open={more} onClose={() => setMore(false)} />
      <TargetSheet open={target} onClose={() => setTarget(false)} />
      <NutritionSheet open={nutri} onClose={() => setNutri(false)} cartMode />
    </NoTabScreen>
  );
}

/* ================================================================== R5D – z ktorých receptov je surovina */
function SourcesSheet({ rowKey, onClose }: { rowKey: string | null; onClose: () => void }) {
  const { recipes, rows } = useCartRows();
  const row = rows.find((r) => r.key === rowKey);
  const plan = row ? buyPlan(row) : null;
  return (
    <BottomSheet open={!!row} onClose={onClose} label={row?.name ?? ""}>
      {row && plan && (
        <>
          <SheetHeader title={row.name} sub={t("rc.total", { qty: formatAmount(row.qty, row.unit) })} onClose={onClose} />
          <div className="sheet-body stack g-12">
            <div className="cells">
              {row.sources.map((src, i) => {
                const x = recipes.find((y) => y.recipeId === src.recipeId);
                return (
                  <div key={i} className="cell" style={{ minHeight: 48 }}>
                    {x && <Mark x={x} />}
                    <span className="grow stack">
                      <span className="t-body">{src.recipeName}</span>
                      {src.note && <span className="t-xs t-3">{src.note}</span>}
                    </span>
                    <span className="t-body num fw-6">{formatAmount(src.qty, src.unit)}</span>
                  </div>
                );
              })}
            </div>
            <span className="t-sm t-2">
              {t("rc.toShop", { name: plan.name, what: plan.buyLabel })}
              {plan.detail ? ` (${plan.detail})` : ""}
            </span>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

/* ================================================================== R6 – kam pridať nákup */
function nextSaturday() {
  const d = new Date();
  for (let i = 1; i <= 7; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if (x.getDay() === 6) return x;
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 4);
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function TargetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const me = useUserId();
  const { recipes, buy, home, extras } = useCartRows();
  const lists = useLists(household.id);
  const stats = useListStats(household.id);
  const sessions = useHubSessions(household.id);
  const profiles = useProfiles().data;
  const plan = usePlanRecipes(household.id);
  const names = recipes.map((x) => x.r.name);
  const openLists = (lists.data ?? []).filter((l) => !l.is_archived && !l.completed_at);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const joined = names.join(", ");
  // Pri každom otvorení navrhni názov podľa receptov v nákupe.
  useEffect(() => {
    if (open) setName(joined);
  }, [open, joined]);
  const [store, setStore] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(iso(new Date()));
  const [picked, setTarget] = useState<string | null>(null);
  const target = picked ?? openLists[0]?.id ?? null;

  const entries = [...buy.map(toListEntry), ...extras.map((x) => ({ name: x.name, quantity: x.qty, unit: x.unit, category_id: x.cat, note: "" }))];
  const sess = target ? sessions.data?.find((s) => s.list_id === target) : undefined;
  const viaRequest = mode === "existing" && !!sess && sess.shopper_id !== me;

  const finish = () => {
    // Názov zoznamu v aplikácii je obchod; vlastný názov (recepty) ide do poznámky.
    const title = name.trim() || names.join(", ");
    const newList = mode === "new" ? { name: (store ?? title).slice(0, 60), planned_for: date, note: store ? title : "" } : null;
    plan.mutate(
      {
        listId: mode === "existing" ? target : null,
        newList,
        items: entries,
        recipes: recipes.map((x) => ({ key: x.recipeId, name: x.r.name, portions: x.portions })),
      },
      {
        onSuccess: (res) => {
          cart.clear(household.id);
          onClose();
          toast.show(
            res.requests ? t("rc.sentRequests", { what: tn("shop.itemCount", res.requests) }) : mode === "new" ? t("rc.listCreated", { what: tn("shop.itemCount", res.items) }) : t("rc.addedTo", { what: tn("shop.itemCount", res.items) }),
            "success",
          );
          // späť na prehľad zoznamov – nový (doplnený) zoznam sa krátko rozsvieti
          navigate("/", { replace: true, state: { highlight: res.list_id } });
        },
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );
  };

  const sat = nextSaturday();
  const today = new Date();
  const days: [string | null, string][] = [
    [iso(today), t("rc.today")],
    [iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), t("rc.tomorrow")],
    [iso(sat), t("rc.saturday", { day: `${sat.getDate()}. ${sat.getMonth() + 1}.` })],
    [null, t("rc.noDay")],
  ];

  return (
    <BottomSheet open={open} onClose={onClose} label={t("rc.whereTo")}>
      <SheetHeader title={t("rc.whereTo")} sub={t("rc.step2", { buy: tn("shop.itemCount", entries.length), home: home.length })} onClose={onClose} />
      <div className="sheet-body stack g-16">
        <Seg options={[{ value: "new", label: t("rc.newList") }, { value: "existing", label: t("rc.existingList") }]} value={mode} onChange={setMode} />
        {mode === "new" ? (
          <>
            <div className="stack g-6">
              <label className="field-label" htmlFor="r6-name">{t("rc.name")}</label>
              <input id="r6-name" className="input" value={name} maxLength={300} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="stack g-6">
              <span className="field-label">{t("rc.store")}</span>
              <div className="chips">
                <button type="button" className={cx("chip", store === null && "on")} onClick={() => setStore(null)}>{t("rc.dontKnow")}</button>
                {STORES.map((s) => (
                  <button key={s} type="button" className={cx("chip", store === s && "on")} onClick={() => setStore(s)}>
                    <StoreBadge name={s} size="sm" /> {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="stack g-6">
              <span className="field-label">{t("rc.when")}</span>
              <div className="chips">
                {days.map(([d, l]) => (
                  <button key={l} type="button" className={cx("chip", date === d && "on")} onClick={() => setDate(d)}>{l}</button>
                ))}
              </div>
            </div>
          </>
        ) : openLists.length ? (
          <div className="cells">
            {openLists.map((l) => {
              const ss = sessions.data?.find((s) => s.list_id === l.id);
              return (
                <button key={l.id} type="button" className="cell" onClick={() => setTarget(l.id)} aria-pressed={target === l.id}>
                  <StoreBadge name={l.name} />
                  <span className="grow stack g-2" style={{ minWidth: 0 }}>
                    <span className="t-body fw-6 ellipsis">{l.name}</span>
                    <span className="t-sm t-2">{listDay(l)} · {tn("shop.itemCount", stats.data?.get(l.id)?.open ?? 0)}</span>
                    {ss && <span className="badge b-violet" style={{ alignSelf: "flex-start" }}>{t("ls.someoneShops", { name: shortName(profiles?.get(ss.shopper_id) ?? "") })}</span>}
                  </span>
                  {target === l.id && <Check size={20} />}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="t-sm t-2">{t("rc.noOpenList")}</span>
        )}
        {viaRequest && <span className="t-sm t-violet">{t("rc.viaRequest")}</span>}
        <button type="button" className="btn btn-ink btn-lg btn-block" disabled={plan.isPending || (mode === "existing" && !target)} onClick={finish}>
          {mode === "new" ? t("rc.createList") : viaRequest ? t("rc.sendRequest") : t("rc.addToList")}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ================================================================== R5P – pridať ďalší recept do nákupu */
function AddRecipeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household } = useHousehold();
  const toast = useToast();
  const { c, all } = useCartRows();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Recipe | null>(null);
  const [portions, setPortions] = useState(4);
  const chosen = new Set(c.items.map((x) => x.recipeId));
  const list = all.all.filter((r) => !chosen.has(r.id) && (!q || normalizeName(r.name).includes(normalizeName(q))));
  const close = () => {
    setPick(null);
    setQ("");
    onClose();
  };
  const add = () => {
    if (!pick) return;
    cart.set(household.id, pick.id, portions);
    haptic();
    toast.show(t("rc.addedMerged", { name: pick.name }));
    close();
  };
  return (
    <BottomSheet open={open} onClose={close} label={t("rc.addAnother")}>
      {pick ? (
        <>
          <SheetHeader title={pick.name} sub={t("rc.howManyPortions")} onClose={close} />
          <div className="sheet-body stack g-16">
            <div className="row g-8">
              <div className="row g-6 grow">
                {[2, 4, 6, 8].map((n) => (
                  <button key={n} type="button" className={cx("chip lg num", portions === n && "on")} onClick={() => setPortions(n)}>{n}</button>
                ))}
              </div>
              <Stepper value={portions} min={1} onChange={setPortions} />
            </div>
            <div className="row g-8">
              <button type="button" className="btn btn-line" onClick={() => setPick(null)}>{t("common.back")}</button>
              <button type="button" className="btn btn-ink btn-lg grow" onClick={add}>
                <Plus size={18} /> {t("rc.addToShop")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <SheetHeader title={t("rc.addAnother")} sub={t("rc.addAnotherSub")} onClose={close} />
          <div className="sheet-body stack g-12">
            <input className="input" placeholder={t("rc.searchRecipe")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("rc.searchRecipe")} />
            <div className="cells">
              {list.slice(0, 30).map((r) => (
                <button key={r.id} type="button" className="cell" onClick={() => { setPick(r); setPortions(r.portions || 4); }}>
                  <Cover recipe={r} size="sm" />
                  <span className="grow stack g-2" style={{ minWidth: 0 }}>
                    <span className="t-body fw-6 ellipsis">{r.name}</span>
                    <span className="t-sm t-2">{recipeMeta(r)}</span>
                  </span>
                  <Plus size={18} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
