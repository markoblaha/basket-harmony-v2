/**
 * Spoločné prvky Analytiky podľa prototypu: hlavička s prepínačom častí a obdobím,
 * odznak zmeny, stĺpce po mesiacoch, riadok s pruhom podielu, stĺpce dní v týždni.
 */
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Search } from "lucide-react";
import { ScreenHeader, Seg } from "@/components/kit";
import { cx } from "@/components/ui";
import { formatDateTime, formatEuro, formatNumber, t, type Key } from "@/i18n";
import { PRESETS, todayIso, usePeriod, type Period } from "./period";

type Part = "overview" | "categories" | "stores" | "receipts";
const PARTS: { value: Part; label: Key; to: string }[] = [
  { value: "overview", label: "tab.overview", to: "/analytics" },
  { value: "categories", label: "an.categories", to: "/analytics/categories" },
  { value: "stores", label: "tab.stores", to: "/analytics/stores" },
  { value: "receipts", label: "tab.receipts", to: "/receipts" },
];

const PRESET_LABEL: Record<string, Key> = {
  month: "an.preset.month",
  last: "an.preset.last",
  q: "an.preset.q",
  year: "an.preset.year",
  custom: "an.preset.custom",
};

/** Podnadpis obdobia: „1. – 21. 10.“ alebo „celý mesiac“. */
function periodSub(p: Period): string {
  const today = todayIso();
  const to = p.to > today ? today : p.to;
  if (p.preset === "last") return t("an.wholeMonth");
  const f = formatDateTime(new Date(`${p.from}T12:00:00`), { day: "numeric", month: "numeric" });
  const e = formatDateTime(new Date(`${to}T12:00:00`), { day: "numeric", month: "numeric" });
  return `${f} – ${e}`;
}

export function PeriodChips() {
  const { period, setPreset, setCustom, setScope } = usePeriod();
  return (
    <div className="stack g-8" style={{ padding: "0 16px" }}>
      <div className="chips" role="radiogroup" aria-label={t("range.aria")}>
        {PRESETS.map((x) => (
          <button key={x} type="button" role="radio" aria-checked={period.preset === x} className={cx("chip", period.preset === x && "on")} onClick={() => setPreset(x)}>
            {t(PRESET_LABEL[x]!)}
          </button>
        ))}
        <button
          type="button"
          role="switch"
          aria-checked={period.scope === "everyday"}
          className={cx("chip", period.scope === "everyday" ? "on" : "soft")}
          onClick={() => setScope(period.scope === "everyday" ? "all" : "everyday")}
        >
          {t("scope.everyday")}
        </button>
      </div>
      {period.preset === "custom" && (
        <div className="row g-8">
          <label className="grow stack g-4">
            <span className="field-label">{t("an.from")}</span>
            <input className="input" type="date" value={period.from} max={todayIso()} onChange={(e) => e.target.value && setCustom(e.target.value, period.to)} />
          </label>
          <label className="grow stack g-4">
            <span className="field-label">{t("an.to")}</span>
            <input className="input" type="date" value={period.to} max={todayIso()} onChange={(e) => e.target.value && setCustom(period.from, e.target.value)} />
          </label>
        </div>
      )}
      <span className="t-xs t-3" style={{ padding: "0 4px" }}>
        <span className="first-letter:uppercase inline-block">{period.label}</span> · {periodSub(period)} · {t("an.compareNote")}
      </span>
    </div>
  );
}

/** Hlavička koreňových obrazoviek Analytiky: názov, lupa, prepínač častí a obdobie. */
export function AnalyticsTop({ part, period = true, right }: { part: Part; period?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  return (
    <>
      <ScreenHeader
        title={t("nav.analytics")}
        sticky={false}
        right={
          <>
            {right}
            <button type="button" className="ibtn" onClick={() => navigate(`/analytics/products${search}`)} aria-label={t("an.searchProduct")}>
              <Search size={21} />
            </button>
          </>
        }
      />
      <div style={{ padding: "0 16px 10px" }}>
        <Seg
          options={PARTS.map((p) => ({ value: p.value, label: t(p.label) }))}
          value={part}
          onChange={(v) => {
            const to = PARTS.find((p) => p.value === v)!.to;
            if (v !== part) navigate(`${to}${v === "receipts" ? "" : search}`, { replace: true });
          }}
        />
      </div>
      {period && (
        <div style={{ paddingBottom: 6 }}>
          <PeriodChips />
        </div>
      )}
    </>
  );
}

export function ChangeBadge({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  if (!before) return <span className="badge b-gray">{t("an.noCompare")}</span>;
  const pct = ((now - before) / before) * 100;
  const up = pct > 0;
  const good = invert ? up : !up;
  return (
    <span className={cx("badge num", Math.abs(pct) < 1 ? "b-gray" : good ? "b-green" : "b-orange")}>
      {up ? "+" : "−"}
      {formatNumber(Math.abs(pct), { maximumFractionDigits: 0 })} %
    </span>
  );
}

export type MonthBar = { key: string; label: string; total: number; partial?: boolean };

/** Stĺpce po mesiacoch so sumou nad stĺpcom; posledný je zvýraznený. */
export function MonthBars({ data, height = 120, onPick }: { data: MonthBar[]; height?: number; onPick?: (d: MonthBar) => void }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.total));
  const w = 300;
  const bw = Math.min(56, (w - (data.length - 1) * 16) / data.length);
  const gap = data.length > 1 ? (w - bw * data.length) / (data.length - 1) : 0;
  return (
    <svg viewBox={`0 0 ${w} ${height + 38}`} width="100%" role="img" aria-label={data.map((d) => `${d.label} ${formatEuro(d.total)}`).join(", ")}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.total / max) * height);
        const x = i * (bw + gap);
        const last = i === data.length - 1;
        return (
          <g key={d.key} onClick={onPick ? () => onPick(d) : undefined} style={onPick ? { cursor: "pointer" } : undefined}>
            <rect x={x} y={height + 14 - h} width={bw} height={h} rx="6" style={{ fill: last ? "var(--ink)" : "var(--chart-muted)" }} />
            <text x={x + bw / 2} y={height + 8 - h} textAnchor="middle" style={{ fill: "var(--text-2)", fontSize: 11, fontWeight: 600 }}>
              {formatNumber(Math.round(d.total), { maximumFractionDigits: 0 })} €
            </text>
            <text x={x + bw / 2} y={height + 32} textAnchor="middle" style={{ fill: "var(--text-2)", fontSize: 11.5 }}>
              {d.label}
              {d.partial ? "*" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Mesiace z databázy („2026-10“) na stĺpce s krátkym názvom mesiaca. */
export function toMonthBars(months: { month: string; amount: number }[], limit = 6): MonthBar[] {
  const cur = todayIso().slice(0, 7);
  return months.slice(-limit).map((m) => ({
    key: m.month,
    label: formatDateTime(new Date(`${m.month}-15T12:00:00`), { month: "short" }).replace(/\.$/, ""),
    total: m.amount,
    partial: m.month === cur,
  }));
}

/** Riadok s pruhom: názov vľavo, suma vpravo, pod tým pruh podielu. */
export function ShareRow({
  icon,
  title,
  sub,
  value,
  share,
  onClick,
  color,
}: {
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  value: ReactNode;
  share: number;
  onClick?: () => void;
  color?: string;
}) {
  const body = (
    <>
      {icon}
      <span className="grow stack g-6">
        <span className="row between g-8">
          <span className="t-body fw-5 ellipsis">{title}</span>
          <span className="t-body fw-6 num">{value}</span>
        </span>
        <span className="bar" style={{ height: 5 }}>
          <span style={{ width: `${Math.max(2, share * 100)}%`, background: color || "var(--ink)" }} />
        </span>
        {sub && <span className="t-xs t-2 num">{sub}</span>}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="cell" onClick={onClick} style={{ alignItems: "flex-start" }}>
      {body}
    </button>
  ) : (
    <div className="cell" style={{ alignItems: "flex-start" }}>
      {body}
    </div>
  );
}

/** Stĺpce podľa dňa v týždni (počet nákupov); databáza dáva pole po–ne. */
export function WeekdayBars({ wd }: { wd: number[] }) {
  const max = Math.max(1, ...wd);
  const W = 300;
  const H = 70;
  const bw = 28;
  const gap = (W - bw * 7) / 6;
  const names = Array.from({ length: 7 }, (_, i) => formatDateTime(new Date(Date.UTC(2024, 0, 1 + i, 12)), { weekday: "short" }).replace(/\.$/, ""));
  return (
    <svg viewBox={`0 0 ${W} ${H + 34}`} width="100%" role="img" aria-label={wd.map((n, i) => `${names[i]} ${n}`).join(", ")}>
      {wd.map((n, i) => {
        const h = n ? Math.max(4, (n / max) * H) : 2;
        const x = i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={H + 12 - h} width={bw} height={h} rx="5" style={{ fill: n === max && n > 0 ? "var(--ink)" : "var(--chart-muted)" }} />
            {n > 0 && (
              <text x={x + bw / 2} y={H + 6 - h} textAnchor="middle" style={{ fill: "var(--text-2)", fontSize: 11, fontWeight: 600 }}>
                {n}
              </text>
            )}
            <text x={x + bw / 2} y={H + 30} textAnchor="middle" style={{ fill: "var(--text-2)", fontSize: 11.5 }}>
              {names[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Percentuálny podiel ako celé číslo „23 %“. */
export const pct = (share: number) => `${formatNumber(share * 100, { maximumFractionDigits: 0 })} %`;
