/**
 * Potvrdenie pridania: „✓ Banány +3 ks · na zozname“ vyskočí cez hlavičku
 * a po 2,6 s samo zmizne. Je pripnuté k hornému okraju obrazovky (nie k zoznamu),
 * takže je vidieť, aj keď je zoznam schovaný pod dlaždicami. Pri rýchlom
 * pridávaní sa ukladá najviac 3 pod seba – nič sa neprehliadne.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cx } from "@/components/ui";

export type FeedEntry = { id: number; name: string; qty?: string; tail: string; out?: boolean };

const SHOW_MS = 2600;
const OUT_MS = 350;

export function useFeed() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const next = useRef(1);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const push = useCallback((entry: Omit<FeedEntry, "id" | "out">) => {
    const id = next.current++;
    setEntries((all) => [{ ...entry, id }, ...all].slice(0, 3));
    timers.current.push(
      window.setTimeout(() => setEntries((all) => all.map((e) => (e.id === id ? { ...e, out: true } : e))), SHOW_MS),
      window.setTimeout(() => setEntries((all) => all.filter((e) => e.id !== id)), SHOW_MS + OUT_MS),
    );
  }, []);
  return { entries, push };
}

export function AddFeed({ entries }: { entries: FeedEntry[] }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.875rem)] z-[55] flex flex-col items-center gap-1.5 px-4"
    >
      {entries.map((e, i) => (
        <div
          key={e.id}
          role="status"
          className={cx(
            "flex h-11 max-w-full items-center gap-2.5 rounded-[0.875rem] bg-primary pl-2 pr-1.5 text-sm font-semibold text-on-primary shadow-[0_12px_30px_rgb(0_0_0/0.28)] transition-[transform,opacity] duration-300",
            e.out ? "[animation:bh-out-up_.35s_ease_forwards]" : "animate-drop",
            i > 0 && !e.out && "scale-[0.94] opacity-75",
          )}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-[0.5625rem] bg-success text-on-primary">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          <span className="truncate">{e.name}</span>
          {e.qty && <span className="grid h-7 shrink-0 place-items-center rounded-lg bg-accent px-2 text-[0.8125rem] font-bold text-on-accent">+{e.qty}</span>}
          <span className="shrink-0 whitespace-nowrap pr-1.5 font-medium opacity-65">{e.tail}</span>
        </div>
      ))}
    </div>
  );
}
