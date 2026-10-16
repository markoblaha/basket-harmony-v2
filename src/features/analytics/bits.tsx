/** Spoločné kúsky Prehľadov: farby kategórií a obchodov, zmena oproti minulosti, karty. */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { cx } from "@/components/ui";
import { CategoryGlyph } from "@/components/CategoryIcon";
import { category } from "@/lib/categories";
import { formatNumber, t } from "@/i18n";
import { unitLabel as pieceUnit } from "@/lib/parseItem";
import { formatMoney, storeHue } from "@/features/receipts/format";
import type { Basis } from "./api";

/** Názov obchodu; databáza pre doklad bez obchodu vracia slovenský text, preto ho preložíme tu. */
export const storeLabel = (name: string | null | undefined) => (!name || name === "Neznámy obchod" ? t("row.unknownStore") : name);

/** Farba kategórie v grafoch: tlmená, rovnaká svetlosť pre všetky odtiene, čitateľná v oboch témach. */
export const categoryColor = (hue: number) => `oklch(0.66 0.09 ${hue})`;

/** Kategória vrátane dvoch "účtovných" riadkov, ktoré nie sú tovar. */
export function categoryInfo(id: string): { id: string; name: string; color: string; hint?: string } {
  if (id === "_unassigned") {
    return {
      id,
      name: t("pseudo.unassigned"),
      color: "var(--line-strong)",
      hint: t("pseudo.unassignedHint"),
    };
  }
  if (id === "_receipt_discount") {
    return {
      id,
      name: t("pseudo.receiptDiscount"),
      color: "var(--success)",
      hint: t("pseudo.receiptDiscountHint"),
    };
  }
  const c = category(id);
  return { id: c.id, name: c.name, color: categoryColor(c.hue) };
}

/** Farba obchodu: podľa poradia (dobre odlíšiteľné farby v jednom grafe) alebo podľa názvu. */
const STORE_HUES = [255, 155, 35, 330, 95, 200, 60, 290];
export const storeColor = (key: number | string | null | undefined) =>
  `oklch(0.64 0.11 ${typeof key === "number" ? STORE_HUES[key % STORE_HUES.length] : storeHue(key)})`;

export const unitLabel = (basis: Basis) => (basis === "kg" ? t("basis.kg") : basis === "l" ? t("basis.l") : t("basis.ks"));

export function sizeLabel(value: number | null, unit: "g" | "ml" | "ks" | null): string | null {
  if (!value || !unit) return null;
  const fmt = (n: number) => formatNumber(n, { maximumFractionDigits: 2 });
  if (unit === "g") return value >= 1000 ? `${fmt(value / 1000)} kg` : `${fmt(value)} g`;
  if (unit === "ml") return value >= 1000 ? `${fmt(value / 1000)} l` : `${fmt(value)} ml`;
  return `${fmt(value)} ${pieceUnit("ks")}`;
}

export const percent = (ratio: number) =>
  t("fmt.percent", { value: `${ratio > 0 ? "+" : ratio < 0 ? "−" : ""}${formatNumber(Math.abs(Math.round(ratio * 100)))}` });

/**
 * Zmena oproti predchádzajúcemu obdobiu. Pri výdavkoch je nárast "zlý" (oranžová),
 * pokles "dobrý" (zelená). Malé čísla nemajú zmysel v percentách – ukážeme len rozdiel.
 */
export function Delta({
  now,
  before,
  className,
  invert,
  compact,
}: {
  now: number;
  before: number;
  className?: string;
  invert?: boolean;
  /** Len percentá (do úzkych riadkov). */
  compact?: boolean;
}) {
  const diff = now - before;
  if (Math.abs(diff) < 0.5 || before <= 0) {
    if (before <= 0 && now > 0) return null;
    return <span className={cx("whitespace-nowrap text-sm text-text-3", className)}>{t("delta.none")}</span>;
  }
  const up = diff > 0;
  const bad = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  const showPercent = before >= 5;
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold", bad ? "text-warning" : "text-success", className)}>
      <Icon className="size-4" aria-hidden />
      {showPercent ? percent(diff / before) : compact ? `${up ? "+" : "−"}${formatMoney(Math.abs(diff))}` : ""}
      <span className={cx("font-normal opacity-80", compact && "hidden")}>
        {showPercent ? " · " : ""}
        {up ? "+" : "−"}
        {formatMoney(Math.abs(diff))}
      </span>
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-[var(--radius-surface)] bg-surface p-4 shadow-card", className)}>{children}</div>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary">
      {children} <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

/** Riadok s farebným pásom podielu: kategória, obchod. Celý je odkaz do detailu. */
export function ShareRow({
  to,
  icon,
  title,
  subtitle,
  amount,
  share,
  color,
  prev,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  amount: number;
  share: number;
  color: string;
  prev?: number;
}) {
  return (
    <Link to={to} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-pressed">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium">{title}</p>
          <p className="shrink-0 font-semibold tabular-nums">{formatMoney(amount)}</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, share * 100))}%`, background: color }} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-text-3">
          <span className="truncate">{subtitle}</span>
          {prev !== undefined && <Delta now={amount} before={prev} className="!text-xs" compact />}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}

/** Ikona kategórie v štvorci jemne tónovanom farbou kategórie (rovnaká farba ako v grafe). */
export function CategoryBadge({ id, color }: { id: string; color: string }) {
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-lg"
      style={{
        background: `color-mix(in oklch, var(--sunken), ${color} 24%)`,
        color: `color-mix(in oklch, var(--text), ${color} 30%)`,
      }}
    >
      <CategoryGlyph id={id} className="size-5" />
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-text-3">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="truncate text-xs text-text-3">{hint}</p>}
    </div>
  );
}
