/**
 * Spoločné časti Výdavkov z mockupu (prototyp/src/money.jsx, receipt.jsx): obdobie Týždeň / mesiac / Rok,
 * prstenec kategórií, riadky kategórií, chýbajúce bločky, graf ceny v čase a mesačný rozpočet.
 * Všetky čísla počíta databáza (analytics_*), tu sa len zobrazia.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useListStats, useLists, useSetReceiptLater } from "@/features/lists/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, t, tn } from "@/i18n";
import { E, I, IB } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { CATS } from "@/mockup/catalog";
import { Btn, StoreTile, eur, eur0, storeKeyOf } from "@/mockup/kit";
import { useSetBudget } from "./api";
import { categoryInfo } from "./bits";
import { computePeriod, customPeriod, monthName, shiftMonth, thisMonth, todayIso, type Period } from "./period";

/* ------------------------------------------------------------------ obdobie */
export type Per = "week" | "month" | "year";
const addIso = (iso: string, d: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};
/** Obdobie posunuté o `off` dozadu (0 = aktuálne, −1 = predchádzajúce…). */
export function periodOf(per: Per, off = 0): Period {
  if (per === "week") {
    const to = addIso(todayIso(), 7 * off);
    return customPeriod(addIso(to, -6), to, "all");
  }
  if (per === "year") return computePeriod("year", `${Number(thisMonth().slice(0, 4)) + off}${thisMonth().slice(4)}`, "all", "year");
  return computePeriod("month", shiftMonth(thisMonth(), off), "all", "month");
}
const query = (per: Per, off: number) => {
  const q = new URLSearchParams();
  if (per !== "month") q.set("per", per);
  if (off) q.set("o", String(off));
  const s = q.toString();
  return s ? `?${s}` : "";
};
/**
 * Obdobie je v adrese (?per=week|month|year a ?o=−1 o koľko dozadu) – platí aj na detailoch a Späť ho zachová.
 * go(−1) = predchádzajúce obdobie, go(1) = späť k novšiemu (najďalej po aktuálne).
 */
export function usePer() {
  const [params, setParams] = useSearchParams();
  const v = params.get("per");
  const per: Per = v === "week" || v === "year" ? v : "month";
  const o = Number(params.get("o"));
  const off = Number.isInteger(o) && o < 0 ? o : 0;
  const show = (p: Per, to = 0) => {
    const next = new URLSearchParams(params);
    if (p === "month") next.delete("per");
    else next.set("per", p);
    if (to < 0) next.set("o", String(to));
    else next.delete("o");
    setParams(next, { replace: true });
  };
  return {
    per,
    off,
    set: (p: Per) => show(p, 0),
    go: (d: number) => show(per, Math.min(0, off + d)),
    show,
    period: periodOf(per, off),
    title: perTitle(per, off),
    prevTitle: prevTitle(per, off),
    qs: query(per, off),
  };
}
const dm = (iso: string) => formatDateTime(`${iso}T12:00:00`, { day: "numeric", month: "numeric" });
/** Názov obdobia: „November“, „December 2025“, „Týždeň“ / „26. 10. – 1. 11.“, „Rok 2025“. */
export function perTitle(per: Per, off = 0) {
  const p = periodOf(per, off);
  if (per === "week") return off ? `${dm(p.from)} – ${dm(p.to)}` : t("mn.week");
  if (per === "year") return t("mn.yearN", { y: p.from.slice(0, 4) });
  const m = cap(monthName(Number(p.month.slice(5))));
  return p.month.slice(0, 4) === thisMonth().slice(0, 4) ? m : `${m} ${p.month.slice(0, 4)}`;
}
/** Názov obdobia, s ktorým sa porovnáva. */
export function prevTitle(per: Per, off = 0) {
  const p = periodOf(per, off);
  if (per === "month") return monthName(Number(p.prevFrom.slice(5, 7)));
  if (per === "year") return p.prevFrom.slice(0, 4);
  return off ? t("mn.weekBefore") : t("mn.prevWeek");
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ kategórie */
export function cat(id: string) {
  const c = CATS[id];
  const info = categoryInfo(id);
  return { id, name: info.name, e: c?.e ?? "basket", col: c?.col ?? info.color };
}

export function Donut({ cats, center, sub, size = 132 }: { cats: { id: string; amount: number }[]; center: string; sub: string; size?: number }) {
  const top = cats.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const sum = top.reduce((a, c) => a + c.amount, 0) || 1;
  let acc = 0;
  const stops = top.slice(0, 6).map((c) => {
    const a = acc;
    acc += (c.amount / sum) * 100;
    return `${cat(c.id).col} ${a.toFixed(2)}% ${acc.toFixed(2)}%`;
  });
  stops.push(`var(--card2) ${acc.toFixed(2)}% 100%`);
  return (
    <div className="donut" style={{ width: size, height: size, background: `conic-gradient(${stops.join(",")})` }}>
      <span>
        <b>{center}</b>
        <small>{sub}</small>
      </span>
    </div>
  );
}

export function CatRows({ cats, onOpen, limit = 6, g }: { cats: { id: string; amount: number }[]; onOpen: (id: string) => void; limit?: number; g: boolean }) {
  const [all, setAll] = useState(false);
  const top = cats.filter((c) => c.amount > 0.5).sort((a, b) => b.amount - a.amount);
  const max = top[0]?.amount ?? 1;
  return (
    <>
      <div className={`card cats${g ? " glass2" : ""}`}>
        {(all ? top : top.slice(0, limit)).map((x) => {
          const c = cat(x.id);
          return (
            <button type="button" key={x.id} className="cat" onClick={() => onOpen(x.id)}>
              <span className="tile" style={{ "--tc": c.col } as React.CSSProperties}>
                <E k={c.e} />
              </span>
              <div className="g1">
                <div className="cr">
                  <span>{c.name}</span>
                  <em>{eur(x.amount)}</em>
                </div>
                <div className="ln">
                  <i style={{ width: `${Math.max(3, (x.amount / max) * 100)}%`, background: c.col }} />
                </div>
              </div>
              <I n="caret-right" w="bold" cls="chev" />
            </button>
          );
        })}
      </div>
      {top.length > limit && (
        <button type="button" className="lnk c" onClick={() => setAll(!all)}>
          {all ? t("mn.lessCats") : t("mn.allCats", { n: top.length })}
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ chýbajúce bločky */
const MONTH_MS = 30 * 86_400_000;
export function MissingReceipts({ compact, g }: { compact?: boolean; g: boolean }) {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const lists = useLists(household.id).data ?? [];
  const stats = useListStats(household.id).data;
  const later = useSetReceiptLater(household.id);
  const now = Date.now();
  const ms = lists
    .filter((l) => l.completed_at && l.receipt_state === "LATER" && now - new Date(l.completed_at).getTime() <= MONTH_MS)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!));
  if (!ms.length) return null;
  const list = compact ? ms.slice(0, 1) : ms;
  const drop = (id: string) =>
    later.mutate(
      { listId: id, later: false },
      {
        onSuccess: () => toast.show(t("mn.noReceipt"), "info", { undo: () => later.mutate({ listId: id, later: true }) }),
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );
  return (
    <div className={`card mrc${g ? " glass2" : ""}`} role="region" aria-label={t("mn.missingAria")}>
      <div className="mrc-h">
        <span className="mrc-i">
          <I n="receipt" />
          <b>{ms.length}</b>
        </span>
        <div className="grow">
          <div className="t1">{ms.length === 1 ? t("mn.missingOne") : t("mn.missingN", { n: ms.length })}</div>
          <div className="meta sm">{t("mn.missingS")}</div>
        </div>
      </div>
      {list.map((l) => {
        const k = storeKeyOf(l.name);
        const n = stats?.get(l.id)?.bought ?? 0;
        return (
          <div key={l.id} className="mrc-r">
            {k ? (
              <StoreTile k={k} s={36} />
            ) : (
              <span className="th ic">
                <I n="basket" />
              </span>
            )}
            <div className="grow">
              <b>{l.name}</b>
              <span className="sub">
                {formatDateTime(l.completed_at!, { day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" })}
                {n ? ` · ${tn("li.items", n)}` : ""}
              </span>
            </div>
            {!compact && <IB n="x" cls="flat sm" label={t("mn.noReceiptAria", { name: l.name })} onClick={() => drop(l.id)} />}
            {/* Len ikona fotoaparátu – názov nákupu tak má miesto (hlavička karty hovorí „Odfoť ho“). */}
            <IB n="camera" w="fill" cls="tone" label={`${t("mn.photo")}: ${l.name}`} onClick={() => navigate(`/scan?nakup=${l.id}`)} />
          </div>
        );
      })}
      {compact && ms.length > 1 && <div className="meta sm">{t("mn.moreInMoney")}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ graf ceny */
const PAL = ["#3d7ccf", "#e09a2e", "#c0507a", "#2fa36b", "#8a6fd1", "#6b7280"];
export const storeColors = (h: { s: string }[]) => {
  const m: Record<string, string> = {};
  for (const x of h) if (!(x.s in m)) m[x.s] = PAL[Object.keys(m).length % PAL.length]!;
  return m;
};
const short = (d: string) => formatDateTime(new Date(`${d}T00:00`), { day: "numeric", month: "numeric" });
export function PriceChart({ h }: { h: { d: string; s: string; p: number }[] }) {
  if (!h.length) return null;
  const SC = storeColors(h);
  const W = 330, H = 150, L = 34, R = 10, T = 14, B = 26;
  const xs = h.map((x) => new Date(x.d).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1;
  const ps = h.map((x) => x.p);
  const lo = Math.min(...ps) * 0.85, hi = Math.max(...ps) * 1.08;
  const X = (v: number) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const path = h.map((x, i) => `${i ? "L" : "M"}${X(new Date(x.d).getTime()).toFixed(1)},${Y(x.p).toFixed(1)}`).join(" ");
  return (
    <svg className="pchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("mn.priceChart")}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" className="axl">
            {v.toFixed(2).replace(".", ",")}
          </text>
        </g>
      ))}
      <path d={path} className="pl" fill="none" />
      {h.map((x, i) => (
        <circle key={i} cx={X(new Date(x.d).getTime())} cy={Y(x.p)} r={i === h.length - 1 ? 5.5 : 4} fill={SC[x.s]} className="pt" />
      ))}
      <text x={L} y={H - 6} className="axl">
        {short(h[0]!.d)}
      </text>
      <text x={W - R} y={H - 6} textAnchor="end" className="axl">
        {short(h[h.length - 1]!.d)}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ rozpočet */
export function BudgetSheet({ open, onClose, budget, spent }: { open: boolean; onClose: () => void; budget: number | null; spent: number }) {
  const { household } = useHousehold();
  const toast = useToast();
  const save = useSetBudget(household.id);
  const [v, setV] = useState(budget ?? 800);
  return (
    <Sheet open={open} onClose={onClose} label={t("mn.budgetTitle")}>
      <div className="sh-head">
        <h2>{t("mn.budgetTitle")}</h2>
      </div>
      <div className="sh-body">
        <div className="bigv">{eur0(v)}</div>
        <input type="range" min={300} max={2000} step={50} value={v} onChange={(e) => setV(+e.target.value)} aria-label={t("mn.budgetTitle")} />
        <div className="chips wrap c">
          {[600, 800, 1000, 1200].map((x) => (
            <button type="button" key={x} className={`chip plain${v === x ? " on" : ""}`} onClick={() => setV(x)}>
              {eur0(x)}
            </button>
          ))}
        </div>
        <p className="meta c">{t("mn.budgetSpent", { spent: eur(spent), pct: Math.round((spent / v) * 100) })}</p>
        <Btn
          cls="pri full"
          disabled={save.isPending}
          onClick={() =>
            save.mutate([{ categoryId: null, amount: v }], {
              onSuccess: () => {
                toast.show(t("mn.budgetSaved"), "success");
                onClose();
              },
              onError: (e) => toast.show(errorMessage(e), "error"),
            })
          }
        >
          {t("lm.save")}
        </Btn>
        {budget != null && (
          <button
            type="button"
            className="lnk c"
            onClick={() =>
              save.mutate([{ categoryId: null, amount: null }], {
                onSuccess: () => {
                  toast.show(t("mn.budgetRemoved"));
                  onClose();
                },
                onError: (e) => toast.show(errorMessage(e), "error"),
              })
            }
          >
            {t("mn.budgetNone")}
          </button>
        )}
      </div>
    </Sheet>
  );
}
