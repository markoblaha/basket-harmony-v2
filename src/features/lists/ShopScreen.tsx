/**
 * Nákup v obchode, „Nákup dokončený?“ a sledovanie nákupu iného člena – prenesené z mockupu 1:1
 * (prototyp/src/shop.jsx Shop, FinishSheet, Follow). Pravidlá (kto smie nakupovať, žiadosti, koniec
 * nákupu) sú v databáze; tu sa len volajú (features/lists/api.ts).
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useToast } from "@/components/toast";
import { category, storeRouteOrder } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB, Toggle } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Sheet } from "@/mockup/Sheet";
import { CATS } from "@/mockup/catalog";
import { Av, Btn, StoreTile, eur, storeName } from "@/mockup/kit";
import {
  useDecideRequest,
  useDeleteItem,
  useEndShopping,
  useFinishShopping,
  useSetReceiptLater,
  useUpdateItem,
  type AdditionRequest,
  type Item,
  type Session,
  type ShoppingList,
} from "./api";
import type { Estimator } from "./estimate";
import { PriceLine, fmtQty } from "./ListParts";
import type { AddOutcome } from "./useSmartAdd";

const hhmm = (iso: string) => formatDateTime(iso, { hour: "numeric", minute: "2-digit" });
export function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t("sp.agoNow");
  if (m < 60) return t("sp.agoMin", { n: m });
  return t("sp.agoH", { n: Math.round(m / 60) });
}

/** Obrazovka počas nákupu ostane zapnutá (ak to prehliadač vie). */
function useWake() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let lock: { release: () => Promise<void>; addEventListener?: (e: string, f: () => void) => void } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<NonNullable<typeof lock>> } };
    const get = () =>
      nav.wakeLock
        ?.request("screen")
        .then((l) => {
          lock = l;
          setOn(true);
          l.addEventListener?.("release", () => setOn(false));
        })
        .catch(() => setOn(false));
    void get();
    const again = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, []);
  return on;
}

/** Ikona produktu, v ktorej sa pri odškrtnutí nakreslí fajka. */
function CkIcon({ em, on }: { em: string; on: boolean }) {
  return (
    <span className={`th ckth${on ? " on" : ""}`}>
      <E k={em} />
      <span className="ckov" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M6 12.5l4 4 8-9" />
        </svg>
      </span>
    </span>
  );
}

const qtyOf = (it: Item) => (it.quantity && it.quantity > 0 ? Number(it.quantity) : 1);
const SEEN_REQ = new Set<string>();

export function ShopScreen({
  list,
  items,
  session,
  names,
  householdId,
  storeKey,
  estimator,
  pending,
  onClosed,
}: {
  list: ShoppingList;
  items: Item[];
  session: Session;
  names?: Map<string, string>;
  householdId: string;
  storeKey: string | null;
  estimator: Estimator;
  pending: AdditionRequest[];
  onClosed: () => void;
}) {
  const g = useTheme().style === "glass";
  const gl = g ? " glass2" : "";
  const toast = useToast();
  const wake = useWake();
  const update = useUpdateItem(list.id);
  const decide = useDecideRequest(list.id);
  const end = useEndShopping(list.id);
  const fail = (err: unknown) => toast.show(errorMessage(err), "error");
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const [menu, setMenu] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  // Položky tohto nákupu: otvorené + kúpené / nemali od začiatku nákupu.
  const since = new Date(session.started_at).getTime();
  const inTrip = items.filter((i) => i.status === "OPEN" || new Date(i.purchased_at ?? 0).getTime() >= since);
  const na = inTrip.filter((i) => i.status === "UNAVAILABLE");
  const all = inTrip.filter((i) => i.status !== "UNAVAILABLE");
  const open = all.filter((i) => i.status === "OPEN");
  const done = all.filter((i) => i.status === "PURCHASED").sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? ""));
  const doneV = done.reduce((a, i) => a + (estimator.est(i, storeKey)?.v ?? 0), 0);
  const cats = useMemo(() => [...new Set(all.map((i) => i.category_id))].sort((a, b) => storeRouteOrder(a) - storeRouteOrder(b)), [all]);
  const curCat = cats.find((c) => open.some((i) => i.category_id === c));

  // Dielik pásika, ktorý práve pribudol, sa naplní s animáciou.
  const prevDone = useRef<number | null>(null);
  const lastFill = useRef(0);
  if (prevDone.current !== null && done.length > prevDone.current) lastFill.current = done.length;
  else if (prevDone.current !== null && done.length < prevDone.current) lastFill.current = 0;
  prevDone.current = done.length;

  // Odškrtnutie s animáciou: fajka → prečiarknutie → riadok sa zbalí → položka ide do košíka.
  // Druhé ťuknutie počas animácie ju zruší; pri odchode sa rozbehnuté odškrtnutia dokončia.
  const [pend, setPend] = useState<Record<string, "on" | "out">>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});
  const pendRef = useRef(pend);
  pendRef.current = pend;
  const buy = (id: string) => update.mutate({ id, patch: { status: "PURCHASED" } }, { onError: fail });
  const commit = (id: string) => {
    (timers.current[id] ?? []).forEach(clearTimeout);
    delete timers.current[id];
    buy(id);
    setPend((x) => {
      const y = { ...x };
      delete y[id];
      return y;
    });
  };
  useEffect(
    () => () => {
      for (const id of Object.keys(pendRef.current)) {
        (timers.current[id] ?? []).forEach(clearTimeout);
        buy(id);
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const toggle = (it: Item) => {
    if (it.status === "PURCHASED") return update.mutate({ id: it.id, patch: { status: "OPEN" } }, { onError: fail });
    if (pend[it.id]) {
      (timers.current[it.id] ?? []).forEach(clearTimeout);
      delete timers.current[it.id];
      setPend((x) => {
        const y = { ...x };
        delete y[it.id];
        return y;
      });
      return;
    }
    try {
      navigator.vibrate?.(12);
    } catch {
      /* bez vibrácie */
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPend((x) => ({ ...x, [it.id]: "on" }));
    timers.current[it.id] = [
      setTimeout(() => setPend((x) => (x[it.id] ? { ...x, [it.id]: "out" } : x)), reduce ? 250 : 750),
      setTimeout(() => commit(it.id), reduce ? 300 : 1120),
    ];
  };

  // Po poslednej položke sa samo ukáže „Nákup dokončený?“
  const prevOpen = useRef(open.length);
  useEffect(() => {
    const was = prevOpen.current;
    prevOpen.current = open.length;
    if (was > 0 && open.length === 0 && done.length) {
      const id = setTimeout(() => setFinishOpen(true), 650);
      return () => clearTimeout(id);
    }
  }, [open.length, done.length]);

  const close = () => {
    if (done.length) return setFinishOpen(true);
    end.mutate(session.id, { onSuccess: onClosed, onError: fail });
  };

  const who = (id: string | null) => (id ? (names?.get(id) ?? t("household.fallbackName")) : t("household.fallbackName"));
  const accept = (r: AdditionRequest, yes: boolean) =>
    decide.mutate(
      { id: r.id, accept: yes },
      {
        onSuccess: (o) =>
          toast.show(o === "EXPIRED" ? t("sp.reqGone") : yes ? t("sp.reqAdded", { name: who(r.requested_by) }) : t("sp.reqRejected", { name: who(r.requested_by) }), o === "EXPIRED" ? "info" : "success"),
        onError: fail,
      },
    );

  const n = all.length;
  return (
    <div className="bhm bhm-full">
      <div className="scr shop">
        {g && (
          <div className="bgl">
            <div className="bgb pic-trh_p" />
            <div className="veil" />
          </div>
        )}
        <div className="sc" onClick={() => menu && setMenu(null)}>
          <header className="nb shopnb">
            <div className="snb-row">
              <IB n="x" label={t("sp.close")} onClick={close} />
              <div className="grow snb-t">
                <div className="t1">{t("sp.youShop", { name: storeName(storeKey) ?? list.name })}</div>
                <div className="snb-s">{t("sp.sub", { time: hhmm(session.started_at), cart: eur(doneV), n: open.length })}</div>
              </div>
              {wake && (
                <span className="snb-wake" title={t("sp.wake")} aria-label={t("sp.wake")}>
                  <I n="sun" />
                </span>
              )}
              <HelpBtn screen="m-shop" />
            </div>
            <div className="snb-seg" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={done.length} aria-label={t("sp.progress", { done: done.length, n })}>
              <span className="segs" style={{ gap: n > 40 ? 1.5 : n > 20 ? 2 : 3 }}>
                {Array.from({ length: n }, (_, k) => (
                  <i key={k} className={k < done.length ? (k === done.length - 1 && lastFill.current === done.length ? "d n" : "d") : ""} />
                ))}
              </span>
              <b>
                {done.length}
                <small>/{n}</small>
              </b>
            </div>
          </header>
          <div className="body">
            {pending.map((r) => {
              const fresh = !SEEN_REQ.has(r.id);
              SEEN_REQ.add(r.id);
              const e = estimator.est({ name: r.name, quantity: r.quantity, unit: r.unit }, storeKey);
              return (
                <div key={r.id} className={`card req${gl}${fresh ? " new" : ""}`} role={fresh ? "alert" : undefined}>
                  <span className="req-av">
                    <Av id={r.requested_by ?? "?"} name={who(r.requested_by)} s={40} />
                  </span>
                  <div className="grow">
                    {fresh && (
                      <span className="reqnew">
                        <i />
                        {t("sp.newReq")}
                      </span>
                    )}
                    <div className="t1">
                      {who(r.requested_by)}: {r.name.toLowerCase()}
                    </div>
                    <div className="meta">
                      {fmtQty(r.quantity, r.unit)}
                      {e ? ` · ~${eur(e.v)}` : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                  <Btn cls={`pri sm${g ? " a" : ""}`} disabled={decide.isPending} onClick={() => accept(r, true)}>
                    {t("sp.add")}
                  </Btn>
                  <IB n="x" label={t("sp.reject")} cls="flat sm" onClick={() => accept(r, false)} />
                </div>
              );
            })}
            {cats.map((c) => {
              const its = open.filter((i) => i.category_id === c);
              if (!its.length) return null;
              const all2 = all.filter((i) => i.category_id === c);
              const cname = category(c).name;
              return (
                <Fragment key={c}>
                  <div className={`group${c === curCat ? " cur" : ""}`}>
                    <E k={CATS[c]?.e ?? "basket"} />
                    <span className="gl">{c === curCat ? t("sp.now", { name: cname }) : cname}</span>
                    <span className="cnt">
                      {all2.length - its.length} / {all2.length}
                    </span>
                  </div>
                  <div className={`lst big${gl}`}>
                    {its.map((it) => (
                      <div
                        key={it.id}
                        className={`row tap${pend[it.id] ? " ck" : ""}${pend[it.id] === "out" ? " ckout" : ""}`}
                        onClick={() => toggle(it)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenu(it.id);
                        }}
                        role="checkbox"
                        aria-checked={!!pend[it.id]}
                        aria-label={it.name}
                      >
                        <CkIcon em={estimator.emoji(it.name, it.category_id)} on={!!pend[it.id]} />
                        <div className="tx">
                          <b>
                            <span className="stk">{it.name}</span>
                          </b>
                          <span className="sub">
                            {fmtQty(qtyOf(it), it.unit)} · <PriceLine e={estimator.est(it, storeKey)} kinds={estimator.resolve(it.name)?.kinds ?? 1} listStore={storeKey} note={it.note} bare />
                          </span>
                        </div>
                        <button
                          type="button"
                          className="more"
                          aria-label={t("sp.more")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenu(menu === it.id ? null : it.id);
                          }}
                        >
                          <I n="dots-three-vertical" w="bold" />
                        </button>
                        {menu === it.id && (
                          <div className="rmenu" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                update.mutate({ id: it.id, patch: { status: "UNAVAILABLE" } }, { onError: fail });
                                setMenu(null);
                                toast.show(t("sp.naToast", { name: it.name }), "info", { undo: () => update.mutate({ id: it.id, patch: { status: "OPEN" } }, { onError: fail }) });
                              }}
                            >
                              <I n="prohibit" />
                              {t("sp.na")}
                            </button>
                            <button type="button" onClick={() => setMenu(null)}>
                              <I n="x" w="bold" />
                              {t("sp.cancel")}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Fragment>
              );
            })}
            {!open.length && (
              <div className={`card alldone${gl}`}>
                <E k="party" s={56} />
                <div>
                  <div className="ttl">{t("sp.allDone")}</div>
                  <div className="meta">
                    {tn("li.items", done.length)} · ~{eur(doneV)}
                  </div>
                </div>
              </div>
            )}
            {na.length > 0 && (
              <>
                <div className="group plain">
                  <I n="prohibit" />
                  <span className="gl">{t("sp.na")}</span>
                </div>
                <div className={`lst${gl}`}>
                  {na.map((it) => (
                    <div key={it.id} className="row done">
                      <span className="th">
                        <E k={estimator.emoji(it.name, it.category_id)} />
                      </span>
                      <div className="tx">
                        <b>{it.name}</b>
                        <span className="sub">{t("sp.naKeep")}</span>
                      </div>
                      <button type="button" className="qty" onClick={() => update.mutate({ id: it.id, patch: { status: "OPEN" } }, { onError: fail })} aria-label={t("sp.undoNa")}>
                        <I n="arrow-counter-clockwise" w="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {done.length > 0 && (
              <>
                <button type="button" className="group plain tgl-g" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
                  <I n="check-circle" />
                  <span className="gl">{t("sp.inCart", { n: done.length })}</span>
                  <I n={showDone ? "caret-up" : "caret-down"} w="bold" />
                </button>
                {showDone && (
                  <div className={`lst${gl}`}>
                    {done.map((it) => (
                      <div key={it.id} className="row done tap" onClick={() => toggle(it)} role="button" aria-label={t("sp.backFromCart", { name: it.name })}>
                        <CkIcon em={estimator.emoji(it.name, it.category_id)} on />
                        <div className="tx">
                          <b>{it.name}</b>
                          <span className="sub">{fmtQty(qtyOf(it), it.unit)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="dock solo">
          <Btn cls={`${open.length ? "soft" : "pri"} full big${g ? (open.length ? " gl" : " a") : ""}`} onClick={() => setFinishOpen(true)} disabled={!done.length}>
            {open.length ? (done.length ? t("sp.finishLeft", { n: open.length }) : t("sp.tickFirst")) : t("sp.finish")}
          </Btn>
        </div>
      </div>
      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        list={list}
        session={session}
        householdId={householdId}
        open_={open}
        naCount={na.length}
        done={done.length}
        n={n}
        doneV={doneV}
        pending={pending}
        who={who}
      />
    </div>
  );
}

/** „Nákup dokončený?“ – nekúpené nechať / odstrániť, bloček hneď alebo neskôr. */
function FinishSheet({
  open,
  onClose,
  list,
  session,
  householdId,
  open_: left,
  naCount,
  done,
  n,
  doneV,
  pending,
  who,
}: {
  open: boolean;
  onClose: () => void;
  list: ShoppingList;
  session: Session;
  householdId: string;
  open_: Item[];
  /** „Nemali“ – pri „nechať na budúce“ pokračujú v zozname spolu s nekúpenými. */
  naCount: number;
  done: number;
  n: number;
  doneV: number;
  pending: AdditionRequest[];
  who: (id: string | null) => string;
}) {
  const g = useTheme().style === "glass";
  const navigate = useNavigate();
  const toast = useToast();
  const finish = useFinishShopping(householdId, list.id);
  const later = useSetReceiptLater(householdId);
  const remove = useDeleteItem(list.id);
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);

  async function end(receipt: "photo" | "later") {
    if (busy) return;
    setBusy(true);
    try {
      // Kúpené ide do histórie. Nekúpené (aj „nemali“) pokračujú v zozname s rovnakým názvom (MOVE),
      // alebo – keď ich netreba – sa odstránia (ako ručné zmazanie položky).
      if (!keep) for (const i of left) await remove.mutateAsync(i.id);
      await finish.mutateAsync({ sessionId: session.id, unbought: keep ? "MOVE" : "KEEP" });
      if (receipt === "later") {
        await later.mutateAsync({ listId: list.id, later: true });
        navigate("/");
        toast.show(t("sp.savedLater"), "success");
      } else navigate(`/scan?nakup=${list.id}`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label={t("sp.finishQ")}>
      <div className="finish">
        <E k="bags" s={72} />
        <h2>{t("sp.finishQ")}</h2>
        <p className="meta">{t("sp.finishMeta", { done, n, amount: eur(doneV) })}</p>
        {pending.length > 0 && (
          <div className="callout">
            <I n="warning-circle" />
            <span>{tn("ls.pendingWarn", pending.length, { name: who(pending[0]!.requested_by) })}</span>
          </div>
        )}
        {left.length + naCount > 0 && (
          <div className="tgrow">
            <span>{t("sp.keepLeft", { n: left.length + naCount })}</span>
            <Toggle on={keep} onChange={setKeep} label={t("sp.keepAria")} />
          </div>
        )}
        <div className="callout">
          <I n="lightbulb" />
          <span>{t("sp.receiptTip")}</span>
        </div>
        <Btn cls={`pri full big${g ? " a" : ""}`} disabled={busy} onClick={() => void end("photo")}>
          <I n="camera" />
          {t("sp.photo")}
        </Btn>
        <Btn cls="soft full" disabled={busy} onClick={() => void end("later")}>
          {t("sp.notNow")}
        </Btn>
        <button type="button" className="lnk c fin-back" onClick={onClose}>
          <I n="arrow-counter-clockwise" w="bold" />
          {t("sp.backToShop")}
        </button>
      </div>
    </Sheet>
  );
}

/** Sledovanie nákupu iného člena: čo je už v košíku (naživo) a „Poprosiť o…“. */
export function FollowScreen({
  list,
  items,
  session,
  names,
  me,
  storeKey,
  estimator,
  onBack,
  onAsk,
}: {
  list: ShoppingList;
  items: Item[];
  session: Session;
  names?: Map<string, string>;
  me: string;
  storeKey: string | null;
  estimator: Estimator;
  onBack: () => void;
  onAsk: (input: { name: string; quantity: number | null; unit: string | null; quiet?: boolean }) => Promise<AddOutcome>;
}) {
  const g = useTheme().style === "glass";
  const toast = useToast();
  const [txt, setTxt] = useState("");
  const shopper = names?.get(session.shopper_id) ?? t("household.fallbackName");
  const since = new Date(session.started_at).getTime();
  const inTrip = items.filter((i) => i.status === "OPEN" || (i.status === "PURCHASED" && new Date(i.purchased_at ?? 0).getTime() >= since));
  const done = inTrip.filter((i) => i.status === "PURCHASED");
  const fin = inTrip.length > 0 && done.length === inTrip.length;
  const doneV = done.reduce((a, i) => a + (estimator.est(i, storeKey)?.v ?? 0), 0);
  const sorted = [...inTrip].sort((a, b) =>
    a.status === b.status ? (b.purchased_at ?? "").localeCompare(a.purchased_at ?? "") : a.status === "OPEN" ? -1 : 1,
  );
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = txt.trim();
    if (!v) return;
    setTxt("");
    const r = estimator.resolve(v);
    const o = await onAsk({ name: r?.label ?? v.charAt(0).toUpperCase() + v.slice(1), quantity: null, unit: null, quiet: true });
    if (o === "FAILED") setTxt(v);
    else toast.show(t("sp.asked"), "success");
  };
  return (
    <div className="bhm bhm-full">
      <div className="scr follow">
        {g && (
          <div className="bgl">
            <div className="bgb pic-trh_p" />
            <div className="veil" />
          </div>
        )}
        <div className="sc">
          <header className="nb">
            <IB n="caret-left" label={t("sp.back")} onClick={onBack} />
            <span className="nbt sh">{t("sp.shopping", { name: shopper })}</span>
            <HelpBtn screen="m-follow" />
          </header>
          <div className="body">
            <div className={`card ${g ? "glass2" : "live"}`}>
              <div className="rowc">
                <StoreTile k={storeKey} n={list.name} s={48} />
                <div className="grow">
                  <div className={g ? "t1" : "t"}>{storeName(storeKey) ?? list.name}</div>
                  <div className={g ? "t2" : "s"}>
                    {fin ? t("sp.done") : t("sp.since", { ago: ago(session.started_at) })} · <span className="nw">{t("sp.ofN", { done: done.length, n: inTrip.length })}</span>
                  </div>
                </div>
                <div className="ra">
                  <div className={g ? "num" : "sv"}>{eur(doneV)}</div>
                  <div className={g ? "t2" : "s"}>{t("sp.inCartK")}</div>
                </div>
              </div>
              {!fin && (
                <div className={g ? "bar" : "prog"}>
                  <i style={{ width: `${inTrip.length ? (done.length / inTrip.length) * 100 : 0}%` }} />
                </div>
              )}
            </div>
            <p className="hint c">{t("sp.live")}</p>
            <div className={`lst${g ? " glass2" : ""}`}>
              {sorted.map((it) => {
                const fresh = it.purchased_at && Date.now() - new Date(it.purchased_at).getTime() < 4000;
                return (
                  <div key={it.id} className={`row${it.status === "PURCHASED" ? " done" : ""}${fresh ? " flash" : ""}`}>
                    <span className="th">
                      <E k={estimator.emoji(it.name, it.category_id)} />
                    </span>
                    <div className="tx">
                      <b>{it.name}</b>
                      <span className="sub">
                        {fmtQty(qtyOf(it), it.unit)}
                        {it.status === "PURCHASED" && it.purchased_at ? ` · ${t("sp.inCartAgo", { ago: ago(it.purchased_at) })}` : it.added_by === me ? ` · ${t("sp.byYou")}` : ""}
                      </span>
                    </div>
                    {it.status === "PURCHASED" ? (
                      <span className="fstat" role="img" aria-label={t("sp.inCartAria")}>
                        <I n="check" w="bold" />
                      </span>
                    ) : (
                      <span className="fstat no" role="img" aria-label={t("sp.notYet")} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {!fin && (
          <div className="dock">
            <form className={`field${g ? " glass2" : ""}`} onSubmit={(e) => void send(e)}>
              <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={t("sp.askPh")} autoComplete="off" aria-label={t("sp.askAria")} maxLength={120} />
              <button type="submit" className="m" aria-label={t("sp.send")}>
                <I n="paper-plane-right" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
