/**
 * Obrazovka zoznamu – prenesená z mockupu 1:1 (prototyp/src/lists.jsx ListScreen): hlavička so Späť,
 * ľuďmi a ⋯, veľký názov s obchodom a dňom, karta „Odhad nákupu“ s tlačidlom Nakupovať, položky
 * (potiahnutie +1/−1, ťuk na množstvo = − / +, ťuk na riadok = detail), skupiny receptov, „V košíku“
 * a dole pole na pridávanie. Nákup, žiadosti a sledovanie rieši ShoppingPage.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useSetting } from "@/lib/settings";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB, Back, useScrolled } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Avatars, Btn, eur, eur0, relDay, storeName } from "@/mockup/kit";
import { art as recipeArtOf } from "@/features/recipes/mk";
import { openVoice } from "@/features/voice/open";
import type { RecipePlan } from "@/features/recipes/api";
import { useDeleteItem, useUpdateItem, type Item, type ShoppingList } from "./api";
import { listTotals, useEstimator } from "./estimate";
import { StoreCompareTip } from "./StoreCompare";
import { Composer, ItemRow, ItemSheet, PriceLine, useRestoreItem } from "./ListParts";
import { ListMenuSheet } from "./ListMenuSheet";
import type { AddOutcome } from "./useSmartAdd";

type SmartAdd = (input: { name: string; quantity?: number | null; unit?: string | null; note?: string | null; categoryId?: string | null }) => Promise<AddOutcome>;

export function ListView({
  list,
  items,
  householdId,
  me,
  names,
  people,
  storeKey,
  recipePlans,
  active,
  someoneElse,
  iAmShopping,
  shopperName,
  startPending,
  onShop,
  onWatch,
  elsewhere,
  requestsTop,
  itemsState,
  itemsError,
  smartAdd,
  landed,
  otherLists,
}: {
  list: ShoppingList;
  items: Item[];
  householdId: string;
  me: string;
  names?: Map<string, string>;
  people: { id: string; name: string }[];
  storeKey: string | null;
  recipePlans: RecipePlan[];
  active: boolean;
  someoneElse: boolean;
  iAmShopping: boolean;
  shopperName: string | null;
  startPending: boolean;
  onShop: () => void;
  onWatch: () => void;
  elsewhere: { id: string; name: string } | null;
  requestsTop: ReactNode;
  itemsState: "loading" | "error" | "ok";
  itemsError: ReactNode;
  smartAdd: SmartAdd;
  landed: { id: string; n: number } | null;
  otherLists: ShoppingList[];
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const scrolled = useScrolled();
  const g = useTheme().style === "glass";
  const gl = g ? " glass2" : "";
  const estimator = useEstimator(householdId);
  const [showEstimate] = useSetting("estimate");
  const update = useUpdateItem(list.id);
  const remove = useDeleteItem(list.id);
  const restore = useRestoreItem();
  const fail = useCallback((err: unknown) => toast.show(errorMessage(err), "error"), [toast]);

  // Ťuk na množstvo ukáže − / + na 6 s (mockup).
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (!sel) return;
    const tm = setTimeout(() => setSel(null), 6000);
    return () => clearTimeout(tm);
  }, [sel, items]);
  const [sheet, setSheet] = useState<{ id: string; open: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Pole pri písaní sa drží nad klávesnicou; spodný okraj zoznamu podľa výšky doku.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("kb-typing", typing);
    return () => document.body.classList.remove("kb-typing");
  }, [typing]);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(170);
  useEffect(() => {
    const el = dockRef.current?.querySelector(".dock") as HTMLElement | null;
    if (!el || typeof ResizeObserver === "undefined") return;
    // okno pridávania (celá obrazovka) výšku doku nemení – zoznam pod ním neposkočí
    const ro = new ResizeObserver(() => !el.classList.contains("addwin") && setDockH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Riadok, do ktorého dopadlo pridanie, krátko zasvieti.
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!landed) return;
    setFlash(landed.id);
    const tm = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(tm);
  }, [landed]);

  // Odškrtnuté položky sa odstránia až po chvíli – dovtedy sa dá Vrátiť.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const pendingDel = useRef<{ ids: string[]; tm: ReturnType<typeof setTimeout> } | null>(null);
  const flushDel = useCallback(() => {
    const p = pendingDel.current;
    if (!p) return;
    clearTimeout(p.tm);
    pendingDel.current = null;
    for (const id of p.ids) remove.mutate(id, { onError: fail });
  }, [remove, fail]);
  useEffect(() => () => flushDel(), [flushDel]);

  const open = items.filter((i) => i.status === "OPEN");
  const done = items.filter((i) => i.status !== "OPEN" && !hidden.has(i.id)).sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? ""));

  // Suroviny receptov: poznámka „na Guláš“ (rc.forRecipe) → skupina s receptom.
  const groupOf = useMemo(() => {
    const m = new Map<string, { label: string; plan: RecipePlan; note: string | null }>();
    for (const it of open) {
      if (!it.note) continue;
      const hit = recipePlans.filter((p) => it.note!.includes(p.recipe_name));
      if (!hit.length) continue;
      const label = hit.map((p) => p.recipe_name).join(", ");
      const tag = t("rc.forRecipe", { names: label });
      const rest = it.note.includes(tag) ? it.note.replace(tag, "").replace(/^\s*·\s*|\s*·\s*$/g, "").trim() : it.note;
      m.set(it.id, { label, plan: hit[0]!, note: rest || null });
    }
    return m;
  }, [open, recipePlans]);
  const loose = open.filter((i) => !groupOf.has(i.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups = new Map<string, { plan: RecipePlan; items: Item[] }>();
  for (const it of open) {
    const g = groupOf.get(it.id);
    if (!g) continue;
    const x = groups.get(g.label) ?? { plan: g.plan, items: [] };
    x.items.push(it);
    groups.set(g.label, x);
  }

  const tot = listTotals(open, estimator.est, storeKey);
  const labelOf = (it: Item) => it.name;
  const byOf = (it: Item) => (it.added_by && it.added_by !== me ? { id: it.added_by, name: names?.get(it.added_by) ?? "?" } : undefined);
  const kindsOf = (it: Item) => estimator.resolve(it.name)?.kinds ?? 1;

  const setQty = (it: Item, quantity: number) => update.mutate({ id: it.id, patch: { quantity } }, { onError: fail });
  const del = (it: Item) => {
    remove.mutate(it.id, { onError: fail });
    toast.show(t("li.deleted", { name: it.name }), "info", { undo: () => void restore(it) });
  };
  const clearDone = () => {
    flushDel();
    const ids = done.map((i) => i.id);
    setHidden((h) => new Set([...h, ...ids]));
    pendingDel.current = { ids, tm: setTimeout(flushDel, 5200) };
    toast.show(t("li.doneCleared"), "info", {
      undo: () => {
        if (pendingDel.current) clearTimeout(pendingDel.current.tm);
        pendingDel.current = null;
        setHidden((h) => new Set([...h].filter((x) => !ids.includes(x))));
      },
    });
  };

  const row = (it: Item, note: string | null) => (
    <ItemRow
      key={it.id}
      it={it}
      label={labelOf(it)}
      em={estimator.emoji(it.name, it.category_id)}
      e={showEstimate ? estimator.est(it, storeKey) : null}
      kinds={kindsOf(it)}
      listStore={storeKey}
      note={note}
      by={byOf(it)}
      sel={sel === it.id}
      setSel={setSel}
      flash={flash === it.id}
      onQty={(q) => setQty(it, q)}
      onDelete={() => del(it)}
      onOpen={() => setSheet({ id: it.id, open: true })}
    />
  );

  const day = list.planned_for ? relDay(list.planned_for) : t("trip.noDay");
  const sn = storeName(storeKey);
  const meta = [sn && sn !== list.name ? sn : null, day].filter(Boolean).join(" · ") + (list.is_private ? ` · ${t("li.onlyMe")}` : "");
  const sheetItem = sheet ? (items.find((i) => i.id === sheet.id) ?? null) : null;
  const avatars = list.is_private ? people.filter((p) => p.id === me) : people;

  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={t("nav.lists")} onClick={() => navigate("/lists")} />
            <span className="nbt">{list.name}</span>
            <div className="nbr">
              <Avatars people={avatars.slice(0, 3)} sm />
              <HelpBtn screen="list" />
              <IB n="dots-three" label={t("li.options")} onClick={() => setMenuOpen(true)} />
            </div>
          </header>
        </div>
      </div>
      <div className="bhm bhm-list" onClick={() => sel && setSel(null)}>
        <div className="body" style={{ paddingBottom: dockH + 24 }}>
          <div className="lhead">
            <div className="grow">
              <h1 className="lt">{list.name}</h1>
              <div className="meta">{meta}</div>
            </div>
          </div>
          {someoneElse && (
            <div className="callout">
              <span className="live" />
              <span>{t("ls.requestBanner", { name: shopperName ?? "" })}</span>
            </div>
          )}
          {requestsTop}
          <div className={`card est${gl}`}>
            <div className="grow estc">
              <div className="k">{t("li.estimate")}</div>
              <div className="price nw">{showEstimate && tot.priced ? `~${eur0(tot.v)}` : "–"}</div>
              <div className="estm">
                {showEstimate && tot.priced ? <span className="nw">{t("li.range", { range: Math.floor(tot.lo) === Math.ceil(tot.hi) ? eur0(tot.v) : `${Math.floor(tot.lo)} – ${Math.ceil(tot.hi)} €` })}</span> : null}
                {showEstimate && tot.n > 0 && <span className="nw sm">{tot.priced === tot.n ? t("li.allPriced") : t("li.priced", { priced: tot.priced, n: tot.n })}</span>}
              </div>
            </div>
            {someoneElse ? (
              <Btn cls="pri sm" onClick={onWatch}>
                <span className="live" />
                {t("ls.watchShort")}
              </Btn>
            ) : elsewhere ? (
              <Btn cls="soft sm" onClick={() => navigate(`/lists/${elsewhere.id}`)} label={t("ls.finishFirst", { name: elsewhere.name })}>
                <I n="basket" />
                {t("ls.otherTrip")}
              </Btn>
            ) : (
              <Btn cls={`pri sm${g ? " a" : ""}`} onClick={onShop} disabled={startPending || (!iAmShopping && !open.length)}>
                <I n="basket" />
                {iAmShopping ? t("ls.continueShort") : t("li.shop")}
              </Btn>
            )}
          </div>
          {showEstimate && !iAmShopping && <StoreCompareTip items={open} estimator={estimator} storeKey={storeKey} gl={gl} />}

          {itemsState === "loading" ? null : itemsState === "error" ? (
            itemsError
          ) : (
            <>
              {!open.length && !done.length && (
                <div className="empty">
                  <E k="basket" s={64} />
                  <b>{t("li.empty")}</b>
                  <p>{t("li.emptyText")}</p>
                </div>
              )}
              {loose.length > 0 && <div className={`lst${gl}`}>{loose.map((it) => row(it, it.note))}</div>}
              {[...groups.entries()].map(([label, { plan, items: gi }]) => {
                const art = recipeArtOf({ id: plan.recipe_key, name: plan.recipe_name });
                const gs = gi.reduce((a, i) => a + (estimator.est(i, storeKey)?.v ?? 0), 0);
                return (
                  <Fragment key={label}>
                    <button type="button" className="group" onClick={() => navigate(`/recipes/r/${encodeURIComponent(plan.recipe_key)}`)}>
                      {g && art.pic ? <span className={`gth pic-${art.pic}`} /> : <E k={art.e} />}
                      <span className="gl">{label}</span>
                      {showEstimate && gs > 0 && <span className="tag">~{eur(gs)}</span>}
                    </button>
                    <div className={`lst${gl}`}>{gi.map((it) => row(it, groupOf.get(it.id)?.note ?? null))}</div>
                  </Fragment>
                );
              })}
              {done.length > 0 && (
                <>
                  <div className="group plain">
                    <I n="check-circle" />
                    <span className="gl">{t("li.inCart")}</span>
                    {!active && (
                      <button type="button" className="tag lnk" onClick={clearDone}>
                        {t("li.clearDone")}
                      </button>
                    )}
                  </div>
                  <div className={`lst done-lst${gl}`}>
                    {done.map((it) => (
                      <div className="row done" key={it.id}>
                        <span className="th">
                          <E k={estimator.emoji(it.name, it.category_id)} />
                        </span>
                        <div className="tx">
                          <b>{it.name}</b>
                          {it.status === "UNAVAILABLE" ? (
                            <span className="sub">
                              <span className="note">{t("li.unavailable")}</span>
                            </span>
                          ) : (
                            <PriceLine e={showEstimate ? estimator.est(it, storeKey) : null} kinds={kindsOf(it)} listStore={storeKey} />
                          )}
                        </div>
                        {!active && (
                          <button
                            type="button"
                            className="qty"
                            onClick={() => update.mutate({ id: it.id, patch: { status: "OPEN" } }, { onError: fail })}
                            aria-label={t("li.putBack")}
                          >
                            <I n="arrow-counter-clockwise" w="bold" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bhm bhm-dock" ref={dockRef}>
        <Composer
          key={list.id}
          householdId={householdId}
          items={items}
          estimator={estimator}
          listStore={storeKey}
          glass={g}
          requestMode={someoneElse}
          typing={typing}
          onTyping={setTyping}
          onAdd={(x) => smartAdd(x)}
          // počas písania je otvorené okno pridávania – zoznam pod ním sa neposúva (nič neposkočí)
          onAdded={() => !typing && window.scrollTo({ top: 0, behavior: "smooth" })}
          onVoice={() => openVoice(list.id)}
          title={list.name}
        />
      </div>

      <ItemSheet
        open={!!sheet?.open && !!sheetItem}
        item={sheetItem}
        label={sheetItem?.name ?? ""}
        note={sheetItem ? (groupOf.has(sheetItem.id) ? (groupOf.get(sheetItem.id)?.note ?? null) : sheetItem.note) : null}
        householdId={householdId}
        estimator={estimator}
        listStore={storeKey}
        otherLists={otherLists}
        addedBy={sheetItem?.added_by && sheetItem.added_by !== me ? names?.get(sheetItem.added_by) : undefined}
        onClose={() => {
          setSheet((s) => (s ? { ...s, open: false } : s));
          setTimeout(() => setSheet((s) => (s && !s.open ? null : s)), 300);
        }}
      />
      <ListMenuSheet list={menuOpen ? list : null} onClose={() => setMenuOpen(false)} onDeleted={() => navigate("/lists")} onClearDone={clearDone} />
    </>
  );
}
