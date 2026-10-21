/**
 * Stavebné prvky obrazoviek prenesených z prototypu (triedy sú v src/design.css).
 * Hlavička, spodný panel, riadok, prepínač, počítadlo, avatary, odznak obchodu.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import { CategoryGlyph } from "./CategoryIcon";
import { cx } from "./ui";
import { formatNumber, t } from "@/i18n";

type Hue = CSSProperties & { "--h": number };

/** Stabilný odtieň z textu (meno človeka, názov obchodu). */
export function hueOf(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** Známe obchody majú odtieň ako v prototype, ostatné odvodený z názvu. */
const STORE_HUES: Record<string, number> = { lidl: 220, kaufland: 0, tesco: 205, billa: 45, dm: 330, teta: 150 };
export function storeHue(name: string): number {
  const k = name.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return STORE_HUES[k] ?? hueOf(k || "?");
}

/* ------------------------------------------------------------------ hlavička obrazovky */
export function ScreenHeader({
  title,
  sub,
  onBack,
  right,
  onTitle,
  titleLabel,
  children,
  className,
  sticky = true,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  onTitle?: () => void;
  titleLabel?: string;
  children?: ReactNode;
  className?: string;
  /** Hlavička ostáva hore pri posúvaní (predvolene áno). */
  sticky?: boolean;
}) {
  const Title = onTitle ? "button" : "div";
  return (
    <header className={cx("hdr", sticky && "sticky top-0 z-20", onBack && "with-back", className)}>
      {onBack && (
        <button type="button" className="ibtn" onClick={onBack} aria-label={t("common.back")}>
          <ChevronLeft size={24} />
        </button>
      )}
      <Title
        {...(onTitle ? { type: "button" as const, onClick: onTitle, "aria-label": titleLabel } : {})}
        className="grow stack"
        style={{ textAlign: "left", minWidth: 0 }}
      >
        {sub && <span className="sub ellipsis">{sub}</span>}
        {title && <span className="ttl ellipsis">{title}</span>}
        {children}
      </Title>
      {right}
    </header>
  );
}

/* ------------------------------------------------------------------ spodný panel */
export function BottomSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim fixed" onClick={onClose} aria-hidden />
      <div className="sheet fixed mx-auto max-w-2xl pb-safe" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

export function SheetHeader({ title, sub, right, onClose }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-hdr">
      <div className="grow stack">
        <span className="t-title">{title}</span>
        {sub && <span className="t-sm t-2">{sub}</span>}
      </div>
      {right}
      <button type="button" className="ibtn soft sm" onClick={onClose} aria-label={t("common.close")}>
        <X size={18} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ ľudia, obchody, kategórie */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "")).toUpperCase();
}

export type Person = { id: string; name: string };

export function PersonAvatar({ person, size = "" }: { person: Person; size?: "" | "sm" | "lg" | "xs" }) {
  return (
    <span className={cx("avatar", size)} style={{ "--h": hueOf(person.id) } as Hue} title={person.name} aria-hidden>
      {initials(person.name)}
    </span>
  );
}

export function Avatars({ people, max = 3, size = "sm" }: { people: Person[]; max?: number; size?: "" | "sm" | "xs" }) {
  const shown = people.slice(0, max);
  return (
    <span className="avatars" aria-hidden>
      {shown.map((p) => (
        <PersonAvatar key={p.id} person={p} size={size} />
      ))}
      {people.length > max && (
        <span className={cx("avatar", size)} style={{ "--h": 0 } as Hue}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function StoreBadge({ name, size = "" }: { name: string; size?: "" | "sm" | "lg" }) {
  return (
    <span className={cx("store", size)} style={{ "--h": storeHue(name) } as Hue} aria-hidden>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function CatIcon({ id, size = "" }: { id: string; size?: "" | "sm" }) {
  return (
    <span className={cx("cat-ic", size)} aria-hidden>
      <CategoryGlyph id={id} className={size === "sm" ? "size-[15px]" : "size-[18px]"} />
    </span>
  );
}

/* ------------------------------------------------------------------ drobné ovládacie prvky */
export function Seg<V extends string>({
  options,
  value,
  onChange,
  style,
  className,
}: {
  options: { value: V; label: ReactNode; icon?: ReactNode }[];
  value: V;
  onChange: (v: V) => void;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={cx("seg", className)} role="tablist" style={style}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={cx("switch", on && "on")}
      style={disabled ? { opacity: 0.45 } : undefined}
      onClick={() => onChange(!on)}
    />
  );
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** − hodnota + ; pri minime sa mínus zmení na kôš (ak je onRemove). */
export function Stepper({
  value,
  onChange,
  min = 1,
  step = 1,
  unit,
  onRemove,
  small,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  unit?: string | null;
  onRemove?: () => void;
  small?: boolean;
}) {
  const atMin = value <= min + 1e-9;
  const btn = small ? { height: 38, width: 36 } : undefined;
  return (
    <div className="stepper" style={small ? { height: 38 } : undefined}>
      <button
        type="button"
        aria-label={atMin && onRemove ? t("kit.remove") : t("kit.less")}
        onClick={() => (atMin && onRemove ? onRemove() : onChange(Math.max(min, round(value - step))))}
        style={btn}
      >
        {atMin && onRemove ? <Trash2 size={17} color="var(--red)" /> : <Minus size={17} />}
      </button>
      <span className="val">
        {formatNumber(value, { maximumFractionDigits: 2 })}
        {unit && unit !== "ks" ? ` ${unit}` : ""}
      </span>
      <button type="button" aria-label={t("kit.more")} onClick={() => onChange(round(value + step))} style={btn}>
        <Plus size={17} />
      </button>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon?: LucideIcon; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="stack center g-10" style={{ padding: "40px 24px", textAlign: "center" }}>
      {Icon && (
        <span className="cat-ic" style={{ width: 56, height: 56, borderRadius: 18 }}>
          <Icon size={26} strokeWidth={1.7} />
        </span>
      )}
      <span className="t-h">{title}</span>
      {text && (
        <span className="t-sm t-2" style={{ maxWidth: 260 }}>
          {text}
        </span>
      )}
      {action}
    </div>
  );
}

export function Cell({
  icon,
  title,
  sub,
  right,
  onClick,
  chevron = !!onClick,
  danger,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {icon}
      <span className="grow stack g-2">
        <span className={cx("t-body fw-5", danger && "t-red")}>{title}</span>
        {sub && <span className="t-sm t-2">{sub}</span>}
      </span>
      {right}
      {chevron && <ChevronRight size={18} className="chev" />}
    </>
  );
  return onClick ? (
    <button type="button" className={cx("cell", className)} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cx("cell", className)}>{body}</div>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

/** Krátka vibrácia (ak ju telefón podporuje). */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* nepodporované */
  }
}

/** Podržanie prstom (500 ms) zavolá onLong, krátky ťuk onTap. */
export function useLongPress({ onLong, onTap, ms = 500 }: { onLong?: () => void; onTap?: () => void; ms?: number }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    onPointerDown(e: React.PointerEvent) {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        haptic(20);
        onLong?.();
      }, ms);
    },
    onPointerMove(e: React.PointerEvent) {
      if (start.current && (Math.abs(e.clientX - start.current.x) > 10 || Math.abs(e.clientY - start.current.y) > 10)) {
        clearTimeout(timer.current);
        start.current = null;
      }
    },
    onPointerUp() {
      clearTimeout(timer.current);
      if (!fired.current && start.current) onTap?.();
      start.current = null;
    },
    onPointerLeave() {
      clearTimeout(timer.current);
    },
    onPointerCancel() {
      clearTimeout(timer.current);
      start.current = null;
    },
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
    },
    onKeyDown(e: React.KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onTap?.();
      }
    },
  };
}
