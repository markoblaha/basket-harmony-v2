import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, cx } from "@/components/ui";
import { t, type Key } from "@/i18n";
import { usePeriod, type Range, type Scope } from "./period";

const TABS: { to: string; label: Key; end: boolean }[] = [
  { to: "/analytics", label: "tab.overview", end: true },
  { to: "/analytics/products", label: "tab.products", end: false },
  { to: "/analytics/stores", label: "tab.stores", end: false },
  // Doklady majú vlastnú stránku, ale v Analytike sú ako štvrtá záložka.
  { to: "/receipts", label: "tab.receipts", end: true },
];

/** Hlavička Analytiky so záložkami Prehľad / Produkty / Obchody / Doklady (aj na stránke Dokladov). */
export function AnalyticsTabs({ trailing, subtitle }: { trailing?: ReactNode; subtitle?: ReactNode }) {
  const { search } = usePeriod();
  return (
    <>
      <header className="flex min-h-14 items-center justify-between gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{t("nav.analytics")}</h1>
          {subtitle && <div className="mt-0.5 text-footnote text-text-2">{subtitle}</div>}
        </div>
        {trailing}
      </header>
      <nav aria-label={t("tab.aria")} className="px-4">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-sunken p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to === "/receipts" ? tab.to : `${tab.to}${search}`}
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  "flex min-h-10 items-center justify-center rounded-lg px-1 text-footnote font-strong transition-colors duration-200",
                  isActive ? "bg-elevated text-text shadow-card" : "text-text-2 active:bg-pressed",
                )
              }
            >
              {t(tab.label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

/** Rám Prehľadov: nadpis, tri časti a (okrem Produktov) výber obdobia. */
export function AnalyticsLayout() {
  const { pathname } = useLocation();
  const showPeriod = !pathname.startsWith("/analytics/products");
  return (
    <div className="pb-10">
      <AnalyticsTabs />
      {showPeriod && <PeriodBar />}
      <Outlet />
    </div>
  );
}

const RANGES: { id: Range; label: Key }[] = [
  { id: "month", label: "range.month" },
  { id: "3m", label: "range.3m" },
  { id: "year", label: "range.year" },
];

/** Výber obdobia: šípky medzi obdobiami, dĺžka obdobia a čo rátať (všetko / len potraviny a domácnosť). */
export function PeriodBar() {
  const { period, step, setRange, setScope } = usePeriod();
  return (
    <div className="sticky top-0 z-20 mt-3 bg-bg/95 px-4 pb-2 pt-1 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <IconButton label={t("period.prev")} onClick={() => step(-1)}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <p className="min-w-0 truncate text-center text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {period.label}
        </p>
        <IconButton label={t("period.next")} onClick={() => step(1)} disabled={period.isLatest} className="disabled:opacity-30">
          <ChevronRight className="size-5" />
        </IconButton>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Segmented value={period.range} options={RANGES.map((r) => ({ id: r.id, label: t(r.label) }))} onChange={setRange} label={t("range.aria")} />
        <Segmented<Scope>
          value={period.scope}
          options={[
            { id: "all", label: t("scope.all") },
            { id: "everyday", label: t("scope.everyday") },
          ]}
          onChange={setScope}
          label={t("scope.aria")}
        />
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "min-h-11 rounded-lg px-3 text-footnote font-strong transition-colors duration-200",
            value === o.id ? "bg-elevated text-text shadow-card" : "text-text-2 active:bg-pressed",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Späť: ak sme prišli z aplikácie, vráti sa presne tam; inak na zadanú stránku. */
export function BackHeader({ fallback, title }: { fallback: string; title?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <header className="flex items-center gap-1 px-2 pt-3">
      <button
        type="button"
        aria-label={t("common.back")}
        onClick={() => (location.key !== "default" ? navigate(-1) : navigate(fallback))}
        className="flex size-11 items-center justify-center rounded-full active:bg-pressed"
      >
        <ArrowLeft className="size-5" />
      </button>
      {title && <p className="min-w-0 truncate text-sm font-medium text-text-2">{title}</p>}
    </header>
  );
}
