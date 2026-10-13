import { useState } from "react";
import { useNavigate } from "react-router";
import { Camera, Check, ChevronDown, Clock, RotateCcw } from "lucide-react";
import { Avatar, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { useSetReceiptLater, type Item } from "./api";
import { qtyLabel } from "./qty";

export type ShopSummary = {
  listName: string;
  startedAt: string;
  endedAt: string;
  bought: Item[];
  unbought: Item[];
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "numeric" });

/**
 * Nákup dokončený. Pokojný súhrn (bez „robotického“ písma), hlavná akcia
 * je odfotiť bloček – z neho sa doplnia ceny. Ak niečo chýba, „Vrátiť sa k nákupu“
 * nákup znova otvorí a nič sa nestratí.
 */
export function DoneScreen({
  listId,
  householdId,
  summary,
  names,
  me,
  onReopen,
  reopening,
  onClose,
}: {
  listId: string;
  householdId: string;
  summary: ShopSummary;
  names: Map<string, string> | undefined;
  me: string;
  onReopen: () => void;
  reopening: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [showBought, setShowBought] = useState(false);
  const later = useSetReceiptLater(householdId);
  const toast = useToast();
  const [savedLater, setSavedLater] = useState(false);

  async function receiptLater() {
    try {
      await later.mutateAsync({ listId, later: true });
      setSavedLater(true);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }
  const pieces = summary.bought.reduce((sum, i) => sum + (i.quantity && (!i.unit || i.unit === "ks") ? Number(i.quantity) : 1), 0);

  // Kto čo pridal – „Ty 5 · Lucia 2“
  const byWho = new Map<string, number>();
  for (const i of [...summary.bought, ...summary.unbought]) {
    const key = !i.added_by || i.added_by === me ? me : i.added_by;
    byWho.set(key, (byWho.get(key) ?? 0) + 1);
  }
  const people = [...byWho.entries()].sort(([a], [b]) => (a === me ? -1 : b === me ? 1 : 0));

  const all = summary.unbought.length === 0;

  return (
    <div className="fixed inset-0 z-[46] mx-auto flex max-w-2xl flex-col bg-bg pt-safe animate-rise">
      <main className="no-scrollbar flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-7">
        <div className="grid size-[4.75rem] place-items-center rounded-3xl bg-accent-soft text-accent [animation:bh-tile-in_.5s_cubic-bezier(.2,.9,.3,1.4)_.1s_both]">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="26" style={{ animation: "bh-draw .45s ease .45s both" }} />
          </svg>
        </div>
        <h1 className="mt-4.5 text-[2.125rem] font-extrabold leading-[1.05] tracking-[-0.035em] [animation:bh-rise_.5s_ease_.25s_both]">
          {all ? "Nakúpené. Všetko je v košíku." : "Nákup ukončený."}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-text-2 [animation:bh-rise_.5s_ease_.25s_both]">
          {summary.listName} · {day(summary.endedAt)} · {time(summary.startedAt)} – {time(summary.endedAt)}
        </p>

        <div className="mt-5 flex rounded-[1.125rem] border border-line bg-elevated [animation:bh-rise_.5s_ease_.4s_both]">
          <Stat value={summary.bought.length} label="kúpených" />
          <span className="my-3 w-px bg-line" aria-hidden />
          <Stat value={pieces} label="kusov" />
          <span className="my-3 w-px bg-line" aria-hidden />
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1 py-3 text-center">
            <span className="flex">
              {people.slice(0, 3).map(([id], i) => (
                <span key={id} className={cx(i > 0 && "-ml-2 rounded-lg ring-2 ring-elevated")}>
                  <Avatar name={id === me ? (names?.get(me) ?? "Ja") : (names?.get(id) ?? "?")} me={id === me} />
                </span>
              ))}
            </span>
            <span className="text-xs text-text-2">
              {people.map(([id, n]) => `${id === me ? "Ty" : (names?.get(id) ?? "Člen")} ${n}`).join(" · ")}
            </span>
          </div>
        </div>

        {!all && (
          <div className="mt-2.5 rounded-[1.125rem] border border-line bg-elevated p-3.5 [animation:bh-rise_.5s_ease_.4s_both]">
            <p className="text-[0.8125rem] font-bold text-accent">Nekúpené · {summary.unbought.length}</p>
            <p className="mt-1 text-[0.9375rem] font-semibold">{summary.unbought.map((i) => i.name).join(", ")}</p>
            <p className="mt-2 border-t border-dashed border-line pt-2 text-[0.8125rem] text-text-2">Ostávajú na zozname na ďalší nákup.</p>
          </div>
        )}

        {summary.bought.length > 0 && (
          <div className="mt-2.5 rounded-[1.125rem] border border-line bg-elevated px-3.5 [animation:bh-rise_.5s_ease_.4s_both]">
            <button
              type="button"
              aria-expanded={showBought}
              onClick={() => setShowBought((v) => !v)}
              className="flex h-12 w-full items-center justify-between text-sm font-semibold"
            >
              Čo ste kúpili
              <span className="flex items-center gap-1 text-text-2">
                {showBought ? "skryť" : `zobraziť ${summary.bought.length}`}
                <ChevronDown className={cx("size-4 transition-transform", showBought && "rotate-180")} aria-hidden />
              </span>
            </button>
            {showBought && (
              <ul className="pb-2">
                {summary.bought.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 border-t border-dashed border-line py-2 text-sm">
                    <span className="truncate">{i.name}</span>
                    <span className="shrink-0 font-bold">{qtyLabel(i.quantity, i.unit)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 [animation:bh-rise_.5s_ease_.55s_both]">
          <button
            type="button"
            onClick={() => navigate(`/receipts?pridat=1&nakup=${listId}`)}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-accent text-base font-bold text-on-accent active:scale-[0.98]"
          >
            <Camera className="size-[1.3125rem]" aria-hidden />
            Odfotiť doklad teraz
          </button>
          {savedLater ? (
            <div role="status" className="mt-2 flex items-center gap-3 rounded-2xl bg-success-soft px-3.5 py-3 text-success animate-rise">
              <Check className="size-5 shrink-0" strokeWidth={2.8} aria-hidden />
              <p className="text-[0.8125rem] leading-snug">
                <b className="block text-[0.9375rem]">Doklad doplníš neskôr</b>
                Nákup je v Histórii s označením „Doplniť doklad“. Ak bloček nahráš v Bločkoch, priradí sa sem sám.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={receiptLater}
              disabled={later.isPending}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-line bg-elevated px-3.5 py-3 text-left active:bg-pressed disabled:opacity-60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-surface" aria-hidden>
                <Clock className="size-[1.125rem]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-bold">Doklad odfotím neskôr</span>
                <span className="block text-[0.8125rem] text-text-2">Pripomenieme ti ho v Histórii nákupov</span>
              </span>
            </button>
          )}
          <p className="mx-1 mt-2.5 text-center text-[0.8125rem] leading-snug text-text-2">Z dokladu sa doplnia ceny a nákup sa započíta do Prehľadov.</p>

          <button
            type="button"
            onClick={onReopen}
            disabled={reopening}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-primary px-3.5 py-3 text-left disabled:opacity-60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-primary text-on-primary">
              <RotateCcw className={cx("size-[1.125rem]", reopening && "animate-spin")} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.9375rem] font-bold">Vrátiť sa k nákupu</span>
              <span className="block text-[0.8125rem] text-text-2">Niečo ste zabudli? Nákup sa znova otvorí.</span>
            </span>
          </button>
          <button type="button" onClick={onClose} className="mt-1.5 h-12 w-full rounded-xl text-[0.9375rem] font-semibold text-text-2 active:bg-pressed">
            Hotovo
          </button>
        </div>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 px-1 py-3 text-center">
      <b className="block text-2xl font-extrabold tracking-[-0.02em]">{value.toLocaleString("sk-SK", { maximumFractionDigits: 2 })}</b>
      <span className="text-[0.8125rem] text-text-2">{label}</span>
    </div>
  );
}
