/**
 * Jednoduché grafy kreslené priamo (SVG), bez veľkej knižnice: sú malé, rýchle,
 * vyzerajú ako zvyšok aplikácie (aj v tmavom režime) a ovládajú sa ťuknutím.
 * Každý graf má aj textový popis pre čítačku obrazovky.
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { cx } from "@/components/ui";
import { formatMoney } from "@/features/receipts/format";
import { daysBetween } from "./period";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}.`;
};
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/** Kumulatívne výdavky v období: plná čiara = teraz, prerušovaná = predchádzajúce obdobie k rovnakému dňu. */
export function CumulativeChart({
  from,
  to,
  prevFrom,
  daily,
  prevDaily,
  untilToday,
}: {
  from: string;
  to: string;
  prevFrom: string;
  daily: { d: string; a: number }[];
  prevDaily: { d: string; a: number }[];
  /** Obdobie prebieha: čiara končí dnešným dňom. */
  untilToday: string | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const days = daysBetween(from, to) + 1;
  const lastIndex = untilToday ? Math.min(days - 1, daysBetween(from, untilToday)) : days - 1;

  const cumulate = (list: { d: string; a: number }[], start: string, len: number) => {
    const per = new Array<number>(len).fill(0);
    for (const x of list) {
      const i = daysBetween(start, x.d);
      if (i >= 0 && i < len) per[i]! += x.a;
    }
    let sum = 0;
    return per.map((v) => (sum += v));
  };
  const cur = cumulate(daily, from, days).slice(0, lastIndex + 1);
  const prev = cumulate(prevDaily, prevFrom, days);
  const max = Math.max(1, ...cur, ...prev) * 1.08;

  const h = 160;
  const padTop = 12;
  const padBottom = 22;
  const w = Math.max(width, 1);
  const x = (i: number) => (days <= 1 ? 0 : (i / (days - 1)) * (w - 4) + 2);
  const y = (v: number) => padTop + (1 - v / max) * (h - padTop - padBottom);
  const line = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = cur.length > 0 ? `${line(cur)} L${x(cur.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z` : "";

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - 2) / (w - 4)) * (days - 1));
    setHover(Math.max(0, Math.min(days - 1, i)));
  };

  const hi = hover;
  const tip =
    hi !== null
      ? {
          date: addDays(from, hi),
          cur: hi <= lastIndex ? cur[hi] : null,
          prev: prev[hi] ?? null,
        }
      : null;
  const summary = `Výdavky k ${shortDate(addDays(from, lastIndex))}: ${formatMoney(cur.at(-1) ?? 0)}, v predchádzajúcom období k rovnakému dňu ${formatMoney(prev[lastIndex] ?? 0)}.`;

  return (
    <div
      ref={ref}
      className="relative touch-pan-y select-none"
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={summary}
    >
      {width > 0 && (
        <svg width={w} height={h} className="block overflow-visible" aria-hidden>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={0} x2={w} y1={y(max * f)} y2={y(max * f)} className="stroke-line" strokeWidth={1} />
          ))}
          <line x1={0} x2={w} y1={y(0)} y2={y(0)} className="stroke-line-strong/50" strokeWidth={1} />
          <path d={line(prev)} fill="none" className="stroke-text-3" strokeWidth={1.75} strokeDasharray="4 4" />
          {area && <path d={area} className="fill-primary/12" />}
          {cur.length > 0 && (
            <path d={line(cur)} fill="none" className="stroke-primary" strokeWidth={2.75} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {cur.length > 0 && <circle cx={x(cur.length - 1)} cy={y(cur.at(-1)!)} r={4.5} className="fill-primary stroke-elevated" strokeWidth={2} />}
          {hi !== null && (
            <>
              <line x1={x(hi)} x2={x(hi)} y1={padTop - 6} y2={y(0)} className="stroke-text-3" strokeWidth={1} />
              {tip?.cur != null && <circle cx={x(hi)} cy={y(tip.cur)} r={4} className="fill-primary" />}
              {tip?.prev != null && <circle cx={x(hi)} cy={y(tip.prev)} r={3.5} className="fill-text-3" />}
            </>
          )}
          <text x={2} y={h - 4} className="fill-text-3 text-[11px]">
            {shortDate(from)}
          </text>
          <text x={w - 2} y={h - 4} textAnchor="end" className="fill-text-3 text-[11px]">
            {shortDate(to)}
          </text>
        </svg>
      )}
      {tip && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 text-xs text-bg shadow-lg"
          style={{ left: Math.min(Math.max(x(hi!), 70), w - 70) }}
        >
          <p className="font-semibold">{shortDate(tip.date)}</p>
          {tip.cur != null && <p>Teraz: {formatMoney(tip.cur)}</p>}
          {tip.prev != null && <p className="opacity-75">Predtým: {formatMoney(tip.prev)}</p>}
        </div>
      )}
    </div>
  );
}

/** Stĺpcový graf (mesiace, dni v týždni). Klepnutím na stĺpec sa vyberie. */
export function BarChart({
  data,
  activeKey,
  onSelect,
  height = 140,
  formatValue = formatMoney,
  label,
}: {
  data: { key: string; label: string; value: number }[];
  activeKey?: string | null;
  onSelect?: (key: string) => void;
  height?: number;
  formatValue?: (v: number) => string;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const active = data.find((d) => d.key === activeKey);
  return (
    <div role="group" aria-label={label}>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => {
          const isActive = d.key === activeKey;
          const pct = d.value > 0 ? Math.max(3, (d.value / max) * 100) : 0;
          return (
            <button
              key={d.key}
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(d.key)}
              aria-label={`${d.label}: ${formatValue(d.value)}`}
              aria-pressed={isActive}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <span
                className={cx(
                  "block w-full rounded-t-md transition-[height,background-color] duration-300",
                  isActive ? "bg-primary" : "bg-primary/25 group-active:bg-primary/40",
                  d.value === 0 && "bg-line",
                )}
                style={{ height: d.value > 0 ? `${pct}%` : 3 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d) => (
          <span
            key={d.key}
            className={cx("min-w-0 flex-1 truncate text-center text-[11px]", d.key === activeKey ? "font-semibold text-text" : "text-text-3")}
          >
            {d.label}
          </span>
        ))}
      </div>
      {active && (
        <p className="mt-2 text-center text-sm text-text-2">
          {active.label}: <span className="font-semibold tabular-nums text-text">{formatValue(active.value)}</span>
        </p>
      )}
    </div>
  );
}

/** Jeden vodorovný pás rozdelený podľa podielov (napr. kategórie). */
export function ShareBar({ segments, label }: { segments: { id: string; value: number; color: string }[]; label: string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;
  return (
    <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={label}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span key={s.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
    </div>
  );
}

export type PricePoint = { key: string; date: string; shelf: number; paid: number; store: string; color: string };

/**
 * Cena produktu v čase: bodka = cena na regáli (za jednotku), farba = obchod.
 * Pri akcii je pod ňou menšia bodka so zaplatenou cenou, spojená čiarkou.
 */
export function PriceChart({ points, unitLabel }: { points: PricePoint[]; unitLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [points.length]);
  if (points.length === 0) return null;
  const h = 170;
  const padTop = 14;
  const padBottom = 24;
  const padX = 14;
  const w = Math.max(width, 1);
  const times = points.map((p) => Date.parse(p.date));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const values = points.flatMap((p) => [p.shelf, p.paid]);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const spread = Math.max(vMax - vMin, vMax * 0.1, 0.05);
  const lo = Math.max(0, vMin - spread * 0.25);
  const hi = vMax + spread * 0.25;
  const x = (t: number) => (tMax === tMin ? w / 2 : padX + ((t - tMin) / (tMax - tMin)) * (w - 2 * padX));
  const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * (h - padTop - padBottom);
  const avg = points.reduce((s, p) => s + p.shelf, 0) / points.length;
  const sel = points.find((p) => p.key === selected);

  return (
    <div ref={ref} className="relative select-none" role="img" aria-label={`Cena v čase, priemer ${formatMoney(avg)} ${unitLabel}`}>
      {width > 0 && (
        <svg width={w} height={h} className="block overflow-visible">
          <line x1={0} x2={w} y1={y(avg)} y2={y(avg)} className="stroke-text-3" strokeDasharray="3 4" strokeWidth={1} />
          <text x={w} y={y(avg) - 5} textAnchor="end" className="fill-text-3 text-[11px]">
            priemer {formatMoney(avg)}
          </text>
          {points.map((p) => {
            const px = x(Date.parse(p.date));
            const promo = p.paid < p.shelf - 0.005;
            const isSel = p.key === selected;
            return (
              <g key={p.key} onClick={() => setSelected(isSel ? null : p.key)} className="cursor-pointer">
                <rect x={px - 14} y={0} width={28} height={h - padBottom} fill="transparent" />
                {promo && <line x1={px} x2={px} y1={y(p.shelf)} y2={y(p.paid)} stroke={p.color} strokeWidth={2} strokeDasharray="2 2" />}
                {promo && <circle cx={px} cy={y(p.paid)} r={3.5} fill={p.color} />}
                <circle
                  cx={px}
                  cy={y(p.shelf)}
                  r={isSel ? 8 : 6}
                  fill={promo ? "var(--color-elevated)" : p.color}
                  stroke={p.color}
                  strokeWidth={promo ? 2.5 : 2}
                />
              </g>
            );
          })}
          <text x={padX} y={h - 5} className="fill-text-3 text-[11px]">
            {shortDate(new Date(tMin).toISOString().slice(0, 10))}
          </text>
          <text x={w - padX} y={h - 5} textAnchor="end" className="fill-text-3 text-[11px]">
            {shortDate(new Date(tMax).toISOString().slice(0, 10))}
          </text>
        </svg>
      )}
      {sel && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 text-xs text-bg shadow-lg"
          style={{ left: Math.min(Math.max(x(Date.parse(sel.date)), 80), w - 80), top: 0 }}
        >
          <p className="font-semibold">
            {shortDate(sel.date)} · {sel.store}
          </p>
          <p>
            {formatMoney(sel.shelf)} {unitLabel}
            {sel.paid < sel.shelf - 0.005 ? ` · v akcii ${formatMoney(sel.paid)}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
