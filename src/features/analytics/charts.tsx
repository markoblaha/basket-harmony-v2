/**
 * Grafy Výdavkov 2.0 – prenesené z náhľadu prototyp/vydavky-navrh.html (triedy an-* v styles/analytics-v2.css).
 * Čisté SVG bez knižnice: časová os (stĺpec = obdobie), priebeh mesiaca, vývoj ceny (schody po obchodoch)
 * a prstenec kategórií. Ťahom prsta po grafe sa číta hodnota; pri „obmedziť pohyb“ bez animácií.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatDateTime, formatNumber, t } from "@/i18n";
import { E } from "@/mockup/ui";
import { STORES } from "@/mockup/catalog";
import { eur, eur0, storeKeyOf } from "@/mockup/kit";
import { cat } from "./money";

const RM = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const dm = (iso: string) => formatDateTime(new Date(`${iso}T12:00:00`), { day: "numeric", month: "numeric" });
const n0 = (v: number) => formatNumber(Math.round(v));
/** Farba obchodu z dlaždíc appky; neznámy obchod sivý. */
export const storeColor = (name: string) => {
  const k = storeKeyOf(name);
  return k && STORES[k] ? STORES[k]!.c1 : "#9a9488";
};

/* ------------------------------------------------------------------ hladká krivka bez prekmitov */
function mono(p: [number, number][]): string {
  const n = p.length;
  const f = (x: number) => x.toFixed(1);
  if (n < 3) return p.map((q, i) => `${i ? "L" : "M"}${f(q[0])},${f(q[1])}`).join("");
  const dx: number[] = [], m: number[] = [], tg: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1]![0] - p[i]![0];
    m[i] = (p[i + 1]![1] - p[i]![1]) / dx[i]!;
  }
  tg[0] = m[0]!;
  tg[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) tg[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tg[i] = 0;
      tg[i + 1] = 0;
      continue;
    }
    const a = tg[i]! / m[i]!, b = tg[i + 1]! / m[i]!, s = a * a + b * b;
    if (s > 9) {
      const u = 3 / Math.sqrt(s);
      tg[i] = u * a * m[i]!;
      tg[i + 1] = u * b * m[i]!;
    }
  }
  let d = `M${f(p[0]![0])},${f(p[0]![1])}`;
  for (let i = 0; i < n - 1; i++)
    d += `C${f(p[i]![0] + dx[i]! / 3)},${f(p[i]![1] + (tg[i]! * dx[i]!) / 3)} ${f(p[i + 1]![0] - dx[i]! / 3)},${f(p[i + 1]![1] - (tg[i + 1]! * dx[i]!) / 3)} ${f(p[i + 1]![0])},${f(p[i + 1]![1])}`;
  return d;
}

/** Animácia len pri prvom vykreslení (pri zmene obdobia sa obsah plynulo vymení, neanimuje sa znova). */
function useGo() {
  const [go, setGo] = useState(!RM);
  useEffect(() => {
    const id = setTimeout(() => setGo(false), 1600);
    return () => clearTimeout(id);
  }, []);
  return go;
}

/* ------------------------------------------------------------------ čítanie hodnoty ťahom prsta */
type Pt = { x: number; y: number; tip: ReactNode };
function Plot({ w, pts, children, hint }: { w: number; pts: Pt[]; children: (cur: Pt | null) => ReactNode; hint?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState<Pt | null>(null);
  const [used, setUsed] = useState(false);
  const timer = useRef(0);
  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !pts.length) return;
    const x = ((clientX - r.left) / r.width) * w;
    let best = pts[0]!;
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    setCur(best);
    setUsed(true);
    clearTimeout(timer.current);
  };
  const leave = (ms: number) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCur(null), ms);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const pos = cur ? Math.min(88, Math.max(12, (cur.x / w) * 100)) : 50;
  return (
    <>
      <div
        ref={ref}
        className={`an-plot${cur ? " act" : ""}`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons ? pick(e.clientX) : undefined)}
        onPointerUp={() => leave(2200)}
        onPointerLeave={(e) => e.pointerType === "mouse" && leave(900)}
      >
        {children(cur)}
        <div className="an-tip" style={{ left: `${pos}%` }} aria-hidden>
          {cur?.tip}
        </div>
      </div>
      {hint && !used ? <div className="an-hint">{hint}</div> : null}
    </>
  );
}

/* ------------------------------------------------------------------ časová os */
export type TlItem = { key: string; label: string; v: number; ghost?: number; on?: boolean; cur?: boolean; onTap?: () => void; aria: string };

export function Timeline({ title, items, budget, legendTap }: { title: string; items: TlItem[]; budget?: number | null; legendTap?: string }) {
  const go = useGo();
  const sref = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...items.map((x) => Math.max(x.v, x.ghost ?? 0)), budget ?? 0);
  const sel = items.findIndex((x) => x.on);
  useEffect(() => {
    const s = sref.current;
    if (!s) return;
    const b = s.querySelector<HTMLElement>(".an-b.on");
    const left = b ? b.offsetLeft - (s.clientWidth - b.offsetWidth) / 2 : s.scrollWidth;
    s.scrollTo({ left, behavior: RM || go ? "auto" : "smooth" });
  }, [sel, items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const ghost = items.some((x) => x.ghost);
  return (
    <div className={`card glass2 an-tl${go ? " go" : ""}`}>
      <div className="an-ch an-tlh">
        <div className="k">{title}</div>
        <div className="an-lg">
          {legendTap ? <span>{legendTap}</span> : null}
          {budget ? (
            <span>
              <i className="d" />
              {t("mn.tlBudget", { budget: eur0(budget) })}
            </span>
          ) : null}
          {ghost ? (
            <span>
              <i className="g" />
              {t("mn.tlGhost")}
            </span>
          ) : null}
        </div>
      </div>
      <div className="an-tls" ref={sref}>
        <div className="an-tlt">
          {budget ? <div className="an-bud" style={{ ["--y" as string]: ((budget / max) * 100).toFixed(1) }} /> : null}
          {items.map((x, i) => {
            const style = { ["--h" as string]: `${((x.v / max) * 100).toFixed(1)}%`, ["--g" as string]: `${(((x.ghost ?? 0) / max) * 100).toFixed(1)}%`, ["--i" as string]: i };
            const body = (
              <>
                <span className="an-bw">
                  {x.ghost ? (
                    <>
                      <u />
                      {((x.ghost - x.v) / max) * 93 > 24 ? <b className="an-gl">~{n0(x.ghost)}</b> : null}
                    </>
                  ) : null}
                  <em>{x.v ? n0(x.v) : ""}</em>
                  <i />
                </span>
                <span className="an-bl">{x.label}</span>
              </>
            );
            return x.onTap ? (
              <button type="button" key={x.key} className={`an-b${x.on ? " on" : ""}${x.cur ? " cur" : ""}`} style={style} onClick={x.onTap} aria-label={x.aria} aria-pressed={!!x.on}>
                {body}
              </button>
            ) : (
              <button type="button" key={x.key} className={`an-b${x.on ? " on" : ""}${x.cur ? " cur" : ""}`} style={style} disabled aria-label={x.aria}>
                {body}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Stĺpce dní v týždni (bez posúvania). */
export function DaysCard({ items }: { items: { label: string; v: number; cur: boolean }[] }) {
  const go = useGo();
  const max = Math.max(1, ...items.map((x) => x.v));
  return (
    <div className={`card glass2 an-tl${go ? " go" : ""}`} style={{ gap: 8, paddingTop: 14 }}>
      <div className="k" style={{ padding: "0 6px" }}>
        {t("mn.daysTitle")}
      </div>
      <div className="an-tlt an-days">
        {items.map((x, i) => (
          <div key={x.label} className={`an-b${x.cur ? " on" : ""}`} style={{ ["--h" as string]: `${((x.v / max) * 100).toFixed(1)}%`, ["--g" as string]: "0%", ["--i" as string]: i }}>
            <span className="an-bw" style={{ height: 96 }}>
              <em>{x.v ? n0(x.v) : ""}</em>
              <i />
            </span>
            <span className="an-bl">{x.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ priebeh mesiaca */
export function PaceCard({
  from,
  days,
  daily,
  prevDaily,
  prevDays,
  partial,
  budget,
  total,
  monthName: mName,
  prevName,
  onBudget,
}: {
  from: string;
  days: number;
  /** Súčty dní tohto mesiaca (do dneška). */
  daily: number[];
  prevDaily: number[] | null;
  prevDays: number;
  partial: boolean;
  budget: number | null;
  total: number;
  monthName: string;
  prevName: string;
  onBudget: () => void;
}) {
  const go = useGo();
  const uid = useId().replace(/:/g, "");
  const W = 340, H = 176, L = 6, R = 6, T = 34, B = 22;
  const cum = (a: number[]) => {
    let s = 0;
    return a.map((v) => (s += v));
  };
  const now = cum(daily);
  const prev = prevDaily ? cum(prevDaily) : [];
  const el = now.length;
  const proj = partial && el >= 3 ? (now[el - 1]! / el) * days : null;
  const max = Math.max(1, ...now, ...prev, proj ?? 0, budget ?? 0) * 1.04;
  const X = (i: number) => L + (i / (Math.max(days, prevDays) - 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - v / max) * (H - T - B);
  const np = now.map((v, i) => [X(i), Y(v)] as [number, number]);
  const line = mono(np);
  const pts: Pt[] = now.map((v, i) => {
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + i);
    const day = daily[i] ?? 0;
    return {
      x: np[i]![0],
      y: np[i]![1],
      tip: (
        <>
          {formatDateTime(d, { day: "numeric", month: "numeric" })} · <b>{eur0(v)}</b>
          {day ? t("mn.paceTipDay", { day: eur0(day) }) : ""}
        </>
      ),
    };
  });
  const left = budget != null ? budget - total : null;
  const dleft = days - el;
  const st: [string, string, string][] = partial
    ? [
        [t("mn.paceEnd"), proj ? `~${eur0(proj)}` : "–", proj && budget && proj > budget ? "up" : ""],
        [t("mn.paceLeft"), left != null ? eur0(Math.max(0, left)) : "–", left != null && left < 0 ? "bad" : ""],
        [t("mn.pacePerDay"), left != null && left > 0 && dleft > 0 ? eur(left / dleft) : "–", ""],
      ]
    : [
        [t("mn.paceAvgDay"), eur(total / days), ""],
        [t("mn.paceBudget"), budget ? eur0(budget) : "–", ""],
        left == null ? [t("mn.paceTotal"), eur0(total), ""] : [left >= 0 ? t("mn.paceSaved") : t("mn.paceOver"), eur0(Math.abs(left)), left >= 0 ? "dn" : "bad"],
      ];
  return (
    <div className="card glass2">
      <div className="an-ch">
        <div className="k">{t("mn.pace")}</div>
        <div className="an-lg">
          <span>
            <i />
            {mName}
          </span>
          {prev.length ? (
            <span>
              <i className="d" />
              {prevName}
            </span>
          ) : null}
        </div>
      </div>
      <Plot w={W} pts={pts} hint={t("mn.paceHint")}>
        {(c) => (
          <svg className={`an-svg${go ? " go" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("mn.pace")}>
            <defs>
              <linearGradient id={`${uid}a`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ffcf5a" />
                <stop offset="1" stopColor="#ff7a3d" />
              </linearGradient>
              <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ff8a4a" stopOpacity=".42" />
                <stop offset="1" stopColor="#ff8a4a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line className="grid" x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} />
            {budget ? (
              <>
                <line className="bud" x1={L} x2={W - R} y1={Y(budget)} y2={Y(budget)} />
                <text x={W - R} y={Y(budget) - 6} textAnchor="end">
                  {t("mn.tlBudget", { budget: eur0(budget) })}
                </text>
              </>
            ) : null}
            <text x={L} y={H - 5}>
              1.
            </text>
            <text x={X(14)} y={H - 5} textAnchor="middle">
              15.
            </text>
            <text x={W - R} y={H - 5} textAnchor="end">
              {days}.
            </text>
            {prev.length ? <path className="prev" d={mono(prev.map((v, i) => [X(i), Y(v)]))} /> : null}
            {el ? <path className="ar" d={`${line}L${np[el - 1]![0].toFixed(1)},${Y(0)}L${np[0]![0].toFixed(1)},${Y(0)}Z`} fill={`url(#${uid}b)`} /> : null}
            {el ? <path className="ln" d={line} stroke={`url(#${uid}a)`} pathLength={1} /> : null}
            {proj && el ? (
              <>
                <path className="proj" d={`M${np[el - 1]![0].toFixed(1)},${np[el - 1]![1].toFixed(1)}L${X(days - 1).toFixed(1)},${Y(proj).toFixed(1)}`} />
                <circle className="proj" cx={X(days - 1)} cy={Y(proj)} r={3} fill="#ff9a5c" stroke="none" />
              </>
            ) : null}
            {el && partial ? (
              <>
                <circle className="an-end" cx={np[el - 1]![0]} cy={np[el - 1]![1]} r={6} fill="#ff7a3d" opacity={0.35} />
                <circle cx={np[el - 1]![0]} cy={np[el - 1]![1]} r={4.5} fill="#fff" stroke="#ff7a3d" strokeWidth={3} />
              </>
            ) : null}
            <g className="an-cur">
              <line x1={c?.x ?? 0} x2={c?.x ?? 0} y1={T - 6} y2={Y(0)} />
              <circle cx={c?.x ?? 0} cy={c?.y ?? 0} r={5.5} />
            </g>
          </svg>
        )}
      </Plot>
      <button type="button" className="an-st" onClick={onBudget}>
        {st.map((s) => (
          <div key={s[0]}>
            <span>{s[0]}</span>
            <b className={s[2]}>{s[1]}</b>
          </div>
        ))}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ vývoj ceny */
export type Series = { store: string; pts: { d: string; v: number; promo: boolean }[] };

/** Schodíková čiara za každý obchod (cena platí, kým ju ďalší nákup nezmení); akcia je zelený bod mimo čiary. */
export function PriceChart({ series, avg, fmt, title, note }: { series: Series[]; avg: number | null; fmt: (v: number) => string; title: string; note?: string }) {
  const go = useGo();
  const all = series.flatMap((s) => s.pts.map((q) => ({ ...q, s: s.store })));
  if (all.length < 2) return null;
  const W = 340, H = 180, L = 40, R = 8, T = 34, B = 22;
  const time = (d: string) => new Date(`${d}T12:00:00`).getTime();
  const t0 = Math.min(...all.map((q) => time(q.d))), t1 = Date.now();
  const vs = all.map((q) => q.v);
  const lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo || hi * 0.1) * 0.2;
  const X = (d: string) => L + 6 + ((time(d) - t0) / (t1 - t0 || 1)) * (W - L - R - 12);
  const Y = (v: number) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const dec = hi < 1 ? 3 : 2;
  const first = all.reduce((a, q) => (q.d < a ? q.d : a), all[0]!.d);
  const pts: Pt[] = [...all]
    .sort((a, b) => a.d.localeCompare(b.d))
    .map((q) => ({
      x: X(q.d),
      y: Y(q.v),
      tip: (
        <>
          {q.s} · {dm(q.d)} · <b>{fmt(q.v)}</b>
          {q.promo ? ` · ${t("mn.promoDot")}` : ""}
        </>
      ),
    }));
  return (
    <div className="card glass2">
      <div className="an-ch">
        <div className="k">{title}</div>
        {note ? (
          <div className="an-lg">
            <span>{note}</span>
          </div>
        ) : null}
      </div>
      <Plot w={W} pts={pts} hint={t("mn.chartHint")}>
        {(c) => (
          <svg className={`an-svg${go ? " go" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
            {[lo, hi]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((v) => (
                <g key={v}>
                  <line className="grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
                  <text x={L - 6} y={Y(v) + 4} textAnchor="end">
                    {formatNumber(v, { minimumFractionDigits: dec, maximumFractionDigits: dec })}
                  </text>
                </g>
              ))}
            {avg != null ? <line className="avg" x1={L} x2={W - R} y1={Y(avg)} y2={Y(avg)} /> : null}
            {series.map((s) => {
              const col = storeColor(s.store);
              const reg = s.pts.filter((q) => !q.promo);
              let d = "";
              if (reg.length) {
                d = `M${X(reg[0]!.d).toFixed(1)},${Y(reg[0]!.v).toFixed(1)}`;
                for (let i = 1; i < reg.length; i++) d += `H${X(reg[i]!.d).toFixed(1)}V${Y(reg[i]!.v).toFixed(1)}`;
                d += `H${(W - R).toFixed(1)}`;
              }
              return (
                <g key={s.store}>
                  {d ? <path className="sl" d={d} stroke={col} pathLength={1} /> : null}
                  {s.pts.map((q, i) => (
                    <circle key={i} className="pt" cx={X(q.d)} cy={Y(q.v)} r={q.promo ? 3 : 4} fill={q.promo ? "#3ddc84" : col} />
                  ))}
                </g>
              );
            })}
            <text x={L} y={H - 5}>
              {dm(first)}
            </text>
            <text x={W - R} y={H - 5} textAnchor="end">
              {t("mn.today")}
            </text>
            <g className="an-cur">
              <line x1={c?.x ?? 0} x2={c?.x ?? 0} y1={T - 6} y2={H - B} />
              <circle cx={c?.x ?? 0} cy={c?.y ?? 0} r={5.5} />
            </g>
          </svg>
        )}
      </Plot>
      <div className="an-lg">
        {series.map((s) => (
          <span key={s.store}>
            <i className="o" style={{ ["--c" as string]: storeColor(s.store) }} />
            {s.store}
          </span>
        ))}
        {avg != null ? (
          <span>
            <i className="d" />
            {t("mn.avgLine")}
          </span>
        ) : null}
        {all.some((q) => q.promo) ? (
          <span>
            <i className="o" style={{ ["--c" as string]: "#3ddc84" }} />
            {t("mn.promoDot")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ prstenec kategórií */
/** Ťuk na výsek ho zvýrazní, ťuk do stredu otvorí kategóriu (pri „Ostatné“ rozbalí zoznam). */
export function Donut({ rows, sel, onSel, onOpen }: { rows: { id: string; amount: number }[]; sel: string | null; onSel: (id: string | null) => void; onOpen: (id: string) => void }) {
  const go = useGo();
  const uid = useId().replace(/:/g, "");
  const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
  const R = 62, C = 2 * Math.PI * R;
  const top = rows.slice(0, 7), restV = rows.slice(7).reduce((a, r) => a + r.amount, 0);
  const segs = top.map((r) => ({ id: r.id, v: r.amount, col: cat(r.id).col, name: cat(r.id).name }));
  if (restV > 0.5) segs.push({ id: "_rest", v: restV, col: "rgb(150 150 150 / .5)", name: t("mn.dnRest") });
  let acc = 0;
  const cur = sel === "_rest" ? null : sel ? rows.find((r) => r.id === sel) : rows[0];
  return (
    <div className={`an-dn${sel ? " sel" : ""}`}>
      <svg viewBox="0 0 180 180" className={go ? "go" : ""}>
        <defs>
          <mask id={uid} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
            <circle className="an-sw" cx="90" cy="90" r={R} fill="none" stroke="#fff" strokeWidth="27" pathLength={1} transform="rotate(-90 90 90)" />
          </mask>
        </defs>
        <g transform="rotate(-90 90 90)" mask={`url(#${uid})`}>
          {segs.map((s) => {
            const fr = s.v / total, len = Math.max(1, fr * C - 3.5);
            const el = (
              <circle
                key={s.id}
                className={`an-sg${sel === s.id ? " on" : ""}`}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={s.col}
                strokeWidth="21"
                strokeDasharray={`${len.toFixed(1)} ${(C - len).toFixed(1)}`}
                strokeDashoffset={(-acc * C).toFixed(1)}
                tabIndex={0}
                role="button"
                aria-label={`${s.name} ${eur0(s.v)}`}
                onClick={() => onSel(sel === s.id ? null : s.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSel(sel === s.id ? null : s.id))}
              />
            );
            acc += fr;
            return el;
          })}
        </g>
      </svg>
      <button type="button" className="an-dc" onClick={() => onOpen(sel ?? rows[0]!.id)}>
        {sel === "_rest" ? (
          <>
            <E k="basket" s={34} />
            <b>{t("mn.dnRest")}</b>
            <span>
              {eur0(restV)} · {Math.round((restV / total) * 100)} %
            </span>
          </>
        ) : cur ? (
          <>
            <E k={cat(cur.id).e} s={36} />
            <b>{cat(cur.id).name}</b>
            <span>
              {eur0(cur.amount)} · {Math.round((cur.amount / total) * 100)} %
            </span>
            <small>{sel ? t("mn.dnOpen") : t("mn.dnTop")}</small>
          </>
        ) : null}
      </button>
    </div>
  );
}
