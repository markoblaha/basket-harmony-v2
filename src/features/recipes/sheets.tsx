/**
 * Panely receptov z mockupu (prototyp/src/recipes.jsx): Naplánovať (deň v týždni, voliteľne suroviny
 * do zoznamu) a Pridať suroviny (nový zoznam alebo existujúci, na ktorý deň). Kúpi sa len to,
 * čo pri recepte nie je označené „mám doma“. Zápis cez plan_recipes (pravidlá v databáze).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists } from "@/features/lists/api";
import { addDays, dayLabel, isoDay } from "@/features/lists/dates";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, t, tn } from "@/i18n";
import { E, I, Toggle } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { Btn, eur } from "@/mockup/kit";
import { useFavorites, usePlanRecipes, useRecipePlans, useRecipes, useSetPlanStatus } from "./api";
import { toListEntry } from "./logic";
import { art, recipeRows, useHave } from "./mk";
import { useEstimator } from "@/features/lists/estimate";
import type { Recipe } from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayName = (k: string) => cap(formatDateTime(new Date(`${k}T00:00`), { weekday: "long" }));

/** Najbližší otvorený zoznam (kam pridávať suroviny pri plánovaní). */
function useTarget(householdId: string) {
  const lists = useLists(householdId).data ?? [];
  return lists.filter((l) => !l.completed_at).sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999"))[0];
}

export function PlanSheet({ open, onClose, day, rid }: { open: boolean; onClose: () => void; day?: string | null; rid?: string }) {
  const { household } = useHousehold();
  const toast = useToast();
  const recipes = useRecipes(household.id);
  const favs = useFavorites(household.id).data ?? new Set<string>();
  const plans = useRecipePlans(household.id).data ?? [];
  const plan = usePlanRecipes(household.id);
  const setStatus = useSetPlanStatus(household.id);
  const est = useEstimator(household.id);
  const { isHome } = useHave();
  const target = useTarget(household.id);
  const [d, setD] = useState<string | null>(day ?? null);
  const [addIng, setAddIng] = useState(true);
  useEffect(() => {
    if (open) setD(day ?? null);
  }, [open, day]);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => ({ k: isoDay(addDays(today, i)), i }));
  const onDay = (k: string) => plans.find((p) => p.status === "PENDING" && p.planned_on === k);
  const cur = d ? onDay(d) : undefined;
  const r0 = rid ? recipes.find(rid) : undefined;
  const fail = (e: unknown) => toast.show(errorMessage(e), "error");

  const go = (r: Recipe) => {
    if (!d) return;
    const items = addIng && target ? recipeRows(r, r.portions, recipes.find, est, isHome).filter((x) => !x.home).map(toListEntry) : [];
    plan.mutate(
      { listId: items.length && target ? target.id : null, newList: null, items, recipes: [{ key: r.id, name: r.name, portions: r.portions, day: d }] },
      {
        onSuccess: () => {
          toast.show(t("rk.planned", { name: r.name, day: dayLabel(d) }) + (items.length ? ` · ${t("rk.plannedIng")}` : ""), "success");
          onClose();
        },
        onError: fail,
      },
    );
  };
  const list = [...recipes.all].sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)));

  return (
    <Sheet open={open} onClose={onClose} label={t("rk.planTitle")}>
      <div className="sh-head">
        <h2>{r0 ? t("rk.whenQ", { name: r0.name }) : d ? t("rk.dayQ", { day: dayName(d) }) : t("rk.planTitle")}</h2>
      </div>
      <div className="sh-body">
        {(rid || !day) && (
          <div className="chips wrap">
            {days.map((x) => (
              <button type="button" key={x.k} className={`chip plain${d === x.k ? " on" : ""}`} onClick={() => setD(x.k)}>
                {x.i === 0 ? t("rk.today") : x.i === 1 ? cap(t("date.tomorrow")) : dayName(x.k)}
                {onDay(x.k) ? " •" : ""}
              </button>
            ))}
          </div>
        )}
        {target && (
          <div className="tgrow">
            <span>{t("rk.addIngTo", { name: target.name })}</span>
            <Toggle on={addIng} onChange={setAddIng} label={t("rk.addIngAria")} />
          </div>
        )}
        {cur && !rid && (
          <div className="curp">
            <span>
              {t("rk.plannedNow")} <b>{cur.recipe_name}</b>
            </span>
            <button
              type="button"
              className="lnk dng"
              onClick={() =>
                setStatus.mutate(
                  { id: cur.id, status: "DISMISSED" },
                  {
                    onSuccess: () => {
                      toast.show(t("rk.unplanned"), "info", { undo: () => setStatus.mutate({ id: cur.id, status: "PENDING" }, { onError: fail }) });
                      onClose();
                    },
                    onError: fail,
                  },
                )
              }
            >
              {t("rk.remove")}
            </button>
          </div>
        )}
        {r0 ? (
          <Btn cls="pri full" disabled={!d || plan.isPending} onClick={() => go(r0)}>
            {d ? t("rk.planOn", { day: dayLabel(d) }) : t("rk.planBtn")}
          </Btn>
        ) : (
          <div className="plist">
            {list.map((r) => {
              const a = art(r);
              return (
                <button type="button" key={r.id} className="row tap" onClick={() => go(r)} disabled={!d || plan.isPending}>
                  <span className={`th${a.pic ? ` pic-${a.pic}` : ` bg-${a.bg}`}`}>{!a.pic && <E k={a.e} />}</span>
                  <div className="tx">
                    <b>{r.name}</b>
                    <span className="sub">
                      {t("rk.minutes", { min: r.minutes })}
                      {favs.has(r.id) ? ` · ${t("rk.favShort")}` : ""}
                    </span>
                  </div>
                  <I n="plus" w="bold" cls="chev" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Pridanie surovín receptu do zoznamu (nový „Nákup k receptu“ alebo existujúci) a voliteľne deň v pláne. */
export function AddRecipeSheet({ open, onClose, r, portions }: { open: boolean; onClose: () => void; r: Recipe; portions: number }) {
  const { household } = useHousehold();
  const toast = useToast();
  const navigate = useNavigate();
  const recipes = useRecipes(household.id);
  const lists = (useLists(household.id).data ?? []).filter((l) => !l.completed_at);
  const plan = usePlanRecipes(household.id);
  const est = useEstimator(household.id);
  const { isHome } = useHave();
  const [lid, setLid] = useState<string | null>(null);
  const [name, setName] = useState(t("rk.recipeList"));
  const [day, setDay] = useState<string | null>(null);
  const L = lists.find((l) => l.id === lid);
  const cand = recipeRows(r, portions, recipes.find, est, isHome).filter((x) => !x.home);
  const total = cand.reduce((a, x) => a + x.cost, 0);
  const title = name.trim() || t("rk.recipeList");
  const a = art(r);
  const today = new Date();

  const add = () => {
    plan.mutate(
      {
        listId: L?.id ?? null,
        newList: L ? null : { name: title, planned_for: day ?? isoDay(addDays(today, 1)), note: r.name },
        items: cand.map(toListEntry),
        recipes: [{ key: r.id, name: r.name, portions, day }],
      },
      {
        onSuccess: (res) => {
          onClose();
          navigate("/lists", { state: { highlight: res.list_id } });
          toast.show(
            L ? t("rk.addedTo", { items: tn("rk.ingredients", cand.length), name: L.name }) : t("rk.newListMade", { name: title, items: tn("rk.ingredients", cand.length) }),
            "success",
          );
        },
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );
  };
  const dayOpts: (number | null)[] = [null, 0, 1, 2];
  return (
    <Sheet open={open} onClose={onClose} label={t("rk.addIngTitle")} cls="nl">
      <div className="sh-head">
        <span className="th lg">
          <E k={a.e} s={40} />
        </span>
        <div className="grow">
          <h2>{r.name}</h2>
          <div className="meta">{t("rk.toBuy", { items: tn("rk.ingredients", cand.length), price: eur(total) })}</div>
        </div>
      </div>
      <div className="sh-body">
        <div>
          <span className="k">{t("rk.whereAdd")}</span>
          <div className="chips wrap">
            <button type="button" className={`chip plain${lid === null ? " on" : ""}`} onClick={() => setLid(null)}>
              <I n="plus" w="bold" />
              {t("rk.newList")}
            </button>
            {lists.map((l) => (
              <button type="button" key={l.id} className={`chip plain${lid === l.id ? " on" : ""}`} onClick={() => setLid(l.id)}>
                <span className="ell">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
        {lid === null && (
          <label className="fl">
            <span>{t("rk.listName")}</span>
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => e.key === "Enter" && cand.length && add()}
              enterKeyHint="done"
            />
          </label>
        )}
        <div>
          <span className="k">{t("rk.whichDay")}</span>
          <div className="days">
            {dayOpts.map((i) => {
              const k = i == null ? null : isoDay(addDays(today, i));
              return (
                <button type="button" key={String(i)} className={`chip plain${day === k ? " on" : ""}`} onClick={() => setDay(k)}>
                  {i == null ? t("rk.noDay") : i === 0 ? t("rk.today") : i === 1 ? cap(t("date.tomorrow")) : cap(t("nl.dayAfter"))}
                </button>
              );
            })}
          </div>
        </div>
        <p className="meta">{t("rk.buyNote")}</p>
      </div>
      <div className="sh-foot">
        {cand.length ? (
          <Btn cls="pri full" onClick={add} disabled={plan.isPending}>
            {L ? t("rk.addToBtn", { name: L.name }) : t("rk.createBtn", { name: title })}
          </Btn>
        ) : (
          <Btn cls="soft full" onClick={onClose}>
            {t("rk.allHome2")}
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Rýchly prehľad surovín (Ochutnávač – ťuk na „Doma máš X z Y“): čo treba kúpiť (množstvo na nákup a odhad ceny)
 * a čo máš doma. Len na nahliadnutie; „Pridať do nákupu“ otvorí bežný panel, „Upraviť v recepte“ celý recept.
 */
export function HaveSheet({ open, onClose, r, onBuy, onOpen }: { open: boolean; onClose: () => void; r: Recipe; onBuy: () => void; onOpen: () => void }) {
  const { household } = useHousehold();
  const recipes = useRecipes(household.id);
  const est = useEstimator(household.id);
  const { isHome } = useHave();
  const rows = recipeRows(r, r.portions, recipes.find, est, isHome);
  const buy = rows.filter((x) => !x.home);
  const home = rows.filter((x) => x.home);
  // Súčet len keď poznáme cenu všetkého, inak by „~2 €“ za 8 vecí klamal.
  const cost = buy.every((x) => x.cost > 0) ? buy.reduce((s, x) => s + x.cost, 0) : 0;
  const pct = rows.length ? Math.round((home.length / rows.length) * 100) : 0;
  return (
    <Sheet open={open} onClose={onClose} label={t("hv.title")} cls="hvsh">
      <div className="sh-head">
        <div className="grow">
          <h2>{r.name}</h2>
          <p className="meta">{tn("rk.portions", r.portions)}</p>
        </div>
      </div>
      <div className="sh-body">
        <div className="hv-sum" role="img" aria-label={t("tst.have", { have: home.length, all: rows.length })}>
          <div className="hv-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="hv-nums">
            <span>
              <b>{home.length}</b> / {rows.length} {t("hv.atHome")}
            </span>
            {buy.length > 0 ? (
              <span>
                {t("hv.toBuy", { n: buy.length })}
                {cost > 0 ? ` · ~${eur(cost)}` : ""}
              </span>
            ) : (
              <span className="ok">{t("hv.allHome")}</span>
            )}
          </div>
        </div>
        {buy.length > 0 && (
          <section className="hv-sec">
            <div className="bgh">{t("hv.buy")}</div>
            <ul className={`hv-tab${buy.some((x) => x.cost > 0) ? "" : " np"}`}>
              {buy.map((x) => (
                <li key={x.key}>
                  <E k={est.emoji(x.name, x.cat)} />
                  <b>{x.plan.name}</b>
                  <span className="hv-q">{[x.plan.buyLabel, x.staple ? t("rk.noHome") : ""].filter(Boolean).join(" · ")}</span>
                  <span className="hv-price">{x.cost > 0 ? `~${eur(x.cost)}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {home.length > 0 && (
          <section className="hv-sec">
            <div className="bgh">{t("hv.home")}</div>
            <div className="hv-chips">
              {home.map((x) => (
                <span key={x.key}>
                  <E k={est.emoji(x.name, x.cat)} />
                  {x.name}
                  <I n="check" w="bold" />
                </span>
              ))}
            </div>
          </section>
        )}
        <button type="button" className="hv-edit" onClick={onOpen}>
          {t("hv.edit")}
          <I n="caret-right" w="bold" />
        </button>
      </div>
      <div className="sh-foot">
        <div className="sh-act">
          <Btn cls="soft" onClick={onClose}>
            {t("hv.back")}
          </Btn>
          {buy.length > 0 && (
            <Btn cls="pri" onClick={onBuy}>
              <I n="basket" />
              {t("hv.add")}
            </Btn>
          )}
        </div>
      </div>
    </Sheet>
  );
}
