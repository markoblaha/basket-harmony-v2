/**
 * Základné stavebné prvky rozhrania. Všetky obrazovky skladajú tieto kúsky,
 * aby tlačidlá, polia a hlášky vyzerali a správali sa všade rovnako.
 */
import { forwardRef, useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, WifiOff, X } from "lucide-react";
import { t } from "@/i18n";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
export { cx };

// ------------------------------------------------------------------ Button
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "md" | "lg";

/**
 * primary = jediná akcentová farba (hlavná akcia obrazovky), secondary = karta s jemným
 * okrajom, ghost = len text, danger = tónované červené, success = plný zelený odznak.
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary active:bg-primary-pressed",
  secondary: "bg-surface text-text shadow-[inset_0_0_0_1px_var(--line)] active:bg-pressed",
  ghost: "bg-transparent text-text-2 active:bg-pressed",
  danger: "bg-danger-soft text-danger active:brightness-95",
  success: "bg-success-solid text-on-success-solid active:brightness-95",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; block?: boolean }
>(function Button({ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-strong transition-[transform,background-color,opacity] duration-[120ms] active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "lg" ? "min-h-14 px-6 text-base" : "min-h-11 px-4 text-callout",
        block && "w-full",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-text-2 transition-colors active:bg-pressed",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Field
export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }
>(function TextField({ label, hint, error, className, ...rest }, ref) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-footnote font-medium text-text-2">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          "min-h-12 rounded-[var(--radius-control)] border bg-elevated px-4 text-base text-text placeholder:text-text-3",
          "outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary/20",
          error ? "border-danger" : "border-line-strong/60",
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-2 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

// ------------------------------------------------------------------ Banner
type Tone = "info" | "warning" | "danger" | "success";
const TONES: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-info-soft text-info", icon: <Info className="size-5 shrink-0" aria-hidden /> },
  warning: { box: "bg-warning-soft text-warning", icon: <AlertTriangle className="size-5 shrink-0" aria-hidden /> },
  danger: { box: "bg-danger-soft text-danger", icon: <AlertTriangle className="size-5 shrink-0" aria-hidden /> },
  success: { box: "bg-success-soft text-success", icon: <CheckCircle2 className="size-5 shrink-0" aria-hidden /> },
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-[var(--radius-surface)] p-4", TONES[tone].box)}>
      {TONES[tone].icon}
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text-2">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** Štítok testovacej verzie (zostavenej s testovacou databázou), aby sa nepomýlila s ostrou appkou. */
export function TestEnvBadge() {
  if (import.meta.env.MODE !== "staging") return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.25rem)] z-[70] flex justify-center"
    >
      <span className="rounded-full bg-warning-solid px-3 py-0.5 text-overline font-semibold uppercase text-on-warning-solid shadow-raised">
        {t("status.testEnv")}
      </span>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div role="status" className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm font-medium text-warning">
      <WifiOff className="size-4" aria-hidden /> {t("status.offline")}
    </div>
  );
}

// ------------------------------------------------------------------ Stavové obrazovky
export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-text-3">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

/** Prázdny stav: tichá ikona v zapustenom štvorci, nadpis a jedna veta. */
export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-sunken text-text-2 [&_svg]:size-6" aria-hidden>
        {icon}
      </div>
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-xs text-callout text-text-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="p-4">
      <Banner
        tone="danger"
        title={t("common.loadFailed")}
        action={
          onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          )
        }
      >
        {error}
      </Banner>
    </div>
  );
}

// ------------------------------------------------------------------ Page
export function PageHeader({
  title,
  subtitle,
  trailing,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Adresa, kam vedie šípka späť (podstránky sekcie Viac). */
  back?: string;
}) {
  return (
    <header className={cx("flex justify-between gap-3 px-4 pb-4 pt-6", back ? "items-center" : "items-start")}>
      {back && (
        <Link
          to={back}
          aria-label={t("common.back")}
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-text-2 active:bg-pressed"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-semibold">{title}</h1>
        {subtitle && <div className="mt-1 text-footnote text-text-2">{subtitle}</div>}
      </div>
      {trailing}
    </header>
  );
}

export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("px-4", className)}>
      {title && <SectionTitle>{title}</SectionTitle>}
      {children}
    </section>
  );
}

/** Nadpis sekcie: malé verzálky v tichom texte, voliteľne s počtom vpravo od textu. */
export function SectionTitle({ children, trailing, className }: { children: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <h2 className={cx("mb-3 flex min-h-5 items-center gap-2 px-1 text-overline font-semibold uppercase text-text-2", className)}>
      {children}
      {trailing}
    </h2>
  );
}

/** Iniciála človeka zo skupiny – farba person patrí len ľuďom; ja som tichý neutrálny štvorec. */
export function Avatar({ name, me, size = "md" }: { name: string; me?: boolean; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center font-semibold",
        size === "sm"
          ? "size-6 rounded-full text-overline"
          : size === "lg"
            ? "size-9 rounded-full text-sm"
            : size === "xl"
              ? "size-14 rounded-full text-xl"
              : "size-7 rounded-full text-xs",
        me ? "bg-inverse text-on-inverse" : "bg-person-solid text-on-person-solid",
      )}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("divide-y divide-line overflow-hidden rounded-[var(--radius-surface)] bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

/**
 * Riadok zoznamu nastavení: ikona, názov, hodnota vpravo a šípka, ak vedie ďalej.
 * Je odkaz (`to`), tlačidlo (`onClick`) alebo obyčajný riadok; vždy min. 56 px vysoký pre palec.
 */
export function Row({
  icon,
  label,
  value,
  to,
  onClick,
  tone = "default",
  chevron,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  tone?: "default" | "danger";
  /** Šípka vpravo; predvolene sa ukáže pri odkaze. */
  chevron?: boolean;
}) {
  const body = (
    <>
      {icon && (
        <span
          className={cx(
            "grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-5",
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-sunken text-text-2",
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-left font-strong">{label}</span>
      {value != null && <span className="max-w-[55%] shrink-0 truncate text-callout text-text-2">{value}</span>}
      {(chevron ?? !!to) && <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />}
    </>
  );
  const className = cx(
    "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-pressed",
    tone === "danger" && "text-danger",
  );
  if (to)
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

// ------------------------------------------------------------------ Sheet (spodné okno)
/**
 * Okno, ktoré vyjde zospodu obrazovky – na mobile sa ovláda palcom.
 * Zatvorí sa klepnutím mimo neho, tlačidlom X alebo klávesou Escape.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade bg-scrim" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90dvh] w-full max-w-lg animate-sheet overflow-y-auto rounded-t-[var(--radius-modal)] bg-elevated pb-safe shadow-overlay sm:rounded-[var(--radius-modal)]"
      >
        <div className="sticky top-0 z-10 bg-elevated px-6 pb-2 pt-2">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong/50" aria-hidden />
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{title}</h2>
          {dismissible && (
            <IconButton label={t("common.close")} onClick={onClose} className="-mr-2">
              <X className="size-5" />
            </IconButton>
          )}
          </div>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
