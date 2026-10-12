/**
 * Základné stavebné prvky rozhrania. Všetky obrazovky skladajú tieto kúsky,
 * aby tlačidlá, polia a hlášky vyzerali a správali sa všade rovnako.
 */
import { forwardRef, useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, WifiOff, X } from "lucide-react";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
export { cx };

// ------------------------------------------------------------------ Button
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary active:bg-primary-pressed",
  secondary: "bg-surface text-text active:bg-pressed",
  ghost: "bg-transparent text-text-2 active:bg-pressed",
  danger: "bg-danger-soft text-danger active:brightness-95",
  success: "bg-success text-white active:brightness-95",
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
        "inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-55",
        size === "lg" ? "min-h-14 px-5 text-base" : "min-h-11 px-4 text-[0.95rem]",
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
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 active:bg-pressed",
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
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-text-2">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          "min-h-12 rounded-[var(--radius-control)] border bg-elevated px-3.5 text-base text-text placeholder:text-text-3",
          "outline-none focus:border-primary focus:ring-2 focus:ring-primary/25",
          error ? "border-danger" : "border-line-strong/60",
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-danger">
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
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-[var(--radius-surface)] p-3.5", TONES[tone].box)}>
      {TONES[tone].icon}
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text-2">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div role="status" className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm font-medium text-warning">
      <WifiOff className="size-4" aria-hidden /> Si offline – zmeny sa neuložia, kým sa nepripojíš.
    </div>
  );
}

// ------------------------------------------------------------------ Stavové obrazovky
export function Spinner({ label = "Načítavam…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-text-3">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        {icon}
      </div>
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-xs text-text-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="p-4">
      <Banner
        tone="danger"
        title="Nepodarilo sa načítať údaje"
        action={
          onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              Skúsiť znova
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
export function PageHeader({ title, subtitle, trailing }: { title: string; subtitle?: ReactNode; trailing?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-5">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-text-2">{subtitle}</div>}
      </div>
      {trailing}
    </header>
  );
}

export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("px-4", className)}>
      {title && <h2 className="mb-2 px-1 text-sm font-semibold text-text-2">{title}</h2>}
      {children}
    </section>
  );
}

export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("divide-y divide-line overflow-hidden rounded-[var(--radius-surface)] bg-elevated shadow-sm", className)}>
      {children}
    </div>
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
      <div className="absolute inset-0 bg-black/40" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-modal)] bg-elevated pb-safe shadow-xl sm:rounded-[var(--radius-modal)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-elevated px-5 pb-2 pt-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {dismissible && (
            <IconButton label="Zavrieť" onClick={onClose} className="-mr-2">
              <X className="size-5" />
            </IconButton>
          )}
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
