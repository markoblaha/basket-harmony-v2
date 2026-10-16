import { useState } from "react";
import { useNavigate } from "react-router";
import { Camera, Check, ChevronDown, Clock, RotateCcw } from "lucide-react";
import { Avatar, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatNumber, t } from "@/i18n";
import { useSetReceiptLater, type Item } from "./api";
import { qtyLabel } from "./qty";

export type ShopSummary = {
  listName: string;
  startedAt: string;
  endedAt: string;
  bought: Item[];
  unbought: Item[];
};

const time = (iso: string) => formatDateTime(iso, { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => formatDateTime(iso, { weekday: "long", day: "numeric", month: "numeric" });

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
      <main className="no-scrollbar flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-8">
        <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success [animation:bh-tile-in_.2s_ease-out_both]">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="26" style={{ animation: "bh-draw .45s ease .45s both" }} />
          </svg>
        </div>
        <h1 className="mt-4 text-3xl font-semibold [animation:bh-rise_.2s_ease-out_.05s_both]">
          {all ? t("done.allTitle") : t("done.title")}
        </h1>
        <p className="mt-2 text-callout text-text-2 [animation:bh-rise_.2s_ease-out_.05s_both]">
          {summary.listName} · {day(summary.endedAt)} · {time(summary.startedAt)} – {time(summary.endedAt)}
        </p>

        <div className="mt-6 flex rounded-2xl bg-surface shadow-card [animation:bh-rise_.2s_ease-out_.1s_both]">
          <Stat value={summary.bought.length} label={t("done.bought")} />
          <span className="my-3 w-px bg-line" aria-hidden />
          <Stat value={pieces} label={t("done.pieces")} />
          <span className="my-3 w-px bg-line" aria-hidden />
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1 py-3 text-center">
            <span className="flex">
              {people.slice(0, 3).map(([id], i) => (
                <span key={id} className={cx(i > 0 && "-ml-2 rounded-full ring-2 ring-surface")}>
                  <Avatar name={id === me ? (names?.get(me) ?? t("shop.me")) : (names?.get(id) ?? "?")} me={id === me} />
                </span>
              ))}
            </span>
            <span className="text-xs text-text-2">
              {people.map(([id, n]) => `${id === me ? t("done.you") : (names?.get(id) ?? t("done.memberFallback"))} ${n}`).join(" · ")}
            </span>
          </div>
        </div>

        {!all && (
          <div className="mt-3 rounded-2xl bg-warning-soft p-4 [animation:bh-rise_.2s_ease-out_.1s_both]">
            <p className="text-footnote font-strong text-warning">{t("done.unbought", { n: summary.unbought.length })}</p>
            <p className="mt-1 text-callout font-strong">{summary.unbought.map((i) => i.name).join(", ")}</p>
            <p className="mt-2 text-footnote text-text-2">{t("done.unboughtStay")}</p>
          </div>
        )}

        {summary.bought.length > 0 && (
          <div className="mt-3 rounded-2xl bg-surface px-4 shadow-card [animation:bh-rise_.2s_ease-out_.1s_both]">
            <button
              type="button"
              aria-expanded={showBought}
              onClick={() => setShowBought((v) => !v)}
              className="flex h-12 w-full items-center justify-between text-sm font-strong"
            >
              {t("done.whatBought")}
              <span className="flex items-center gap-1 text-text-2">
                {showBought ? t("done.hide") : t("done.show", { n: summary.bought.length })}
                <ChevronDown className={cx("size-4 transition-transform", showBought && "rotate-180")} aria-hidden />
              </span>
            </button>
            {showBought && (
              <ul className="pb-2">
                {summary.bought.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 border-t border-line py-2 text-sm">
                    <span className="truncate">{i.name}</span>
                    <span className="shrink-0 font-strong">{qtyLabel(i.quantity, i.unit)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 [animation:bh-rise_.2s_ease-out_.15s_both]">
          <button
            type="button"
            onClick={() => navigate(`/receipts?pridat=1&nakup=${listId}`)}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-base font-strong text-on-primary shadow-card transition-[transform,background-color] active:scale-[0.98] active:bg-primary-pressed"
          >
            <Camera className="size-[1.3125rem]" aria-hidden />
            {t("done.photo")}
          </button>
          {savedLater ? (
            <div role="status" className="mt-2 flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3 text-success animate-rise">
              <Check className="size-5 shrink-0" strokeWidth={2.4} aria-hidden />
              <p className="text-footnote">
                <b className="block text-callout font-strong">{t("done.laterDone")}</b>
                {t("done.laterDoneHint")}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={receiptLater}
              disabled={later.isPending}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-card active:bg-pressed disabled:opacity-60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-text-2" aria-hidden>
                <Clock className="size-[1.125rem]" />
              </span>
              <span className="min-w-0">
                <span className="block text-callout font-strong">{t("done.later")}</span>
                <span className="block text-footnote text-text-2">{t("done.laterHint")}</span>
              </span>
            </button>
          )}
          <p className="mx-1 mt-3 text-center text-footnote text-text-2">{t("done.photoHint")}</p>

          <button
            type="button"
            onClick={onReopen}
            disabled={reopening}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-card active:bg-pressed disabled:opacity-60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <RotateCcw className={cx("size-[1.125rem]", reopening && "animate-spin")} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-callout font-strong">{t("done.reopen")}</span>
              <span className="block text-footnote text-text-2">{t("done.reopenHint")}</span>
            </span>
          </button>
          <button type="button" onClick={onClose} className="mt-2 h-12 w-full rounded-xl text-callout font-strong text-text-2 active:bg-pressed">
            {t("done.close")}
          </button>
        </div>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 px-1 py-3 text-center">
      <b className="block text-2xl font-semibold">{formatNumber(value, { maximumFractionDigits: 2 })}</b>
      <span className="text-footnote text-text-2">{label}</span>
    </div>
  );
}
