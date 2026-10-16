import { useState } from "react";
import { Check, MessageSquare, Send } from "lucide-react";
import { Avatar, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { category } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { t, type Key } from "@/i18n";
import { useDecideRequest, useReplyRequest, type AdditionRequest } from "./api";
import { qtyLabel } from "./qty";

const QUICK: Key[] = ["request.quick.inCart", "request.quick.unavailable", "request.quick.similar", "request.quick.ok"];

const OUTCOME_TEXT = {
  ACCEPTED: "request.outcome.ACCEPTED",
  REJECTED: "request.outcome.REJECTED",
  EXPIRED: "request.outcome.EXPIRED",
} as const satisfies Record<string, Key>;

/**
 * Žiadosť o pridanie pre nakupujúceho: čo, koľko, poznámka, od koho.
 * Zahodiť · Odpovedať (rýchle odpovede alebo vlastný text) · Pridať do nákupu.
 * `tone="ink"` je tmavá karta, ktorá počas nákupu vyjde zhora.
 */
export function RequestCard({
  request,
  listId,
  who,
  tone = "paper",
  more = 0,
  className,
}: {
  request: AdditionRequest;
  listId: string;
  who: string;
  tone?: "paper" | "ink";
  more?: number;
  className?: string;
}) {
  const decide = useDecideRequest(listId);
  const reply = useReplyRequest(listId);
  const toast = useToast();
  const [replyOpen, setReplyOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const ink = tone === "ink";

  async function answer(accept: boolean) {
    setBusy(accept ? "yes" : "no");
    try {
      const outcome = await decide.mutateAsync({ id: request.id, accept });
      toast.show(t(OUTCOME_TEXT[outcome] ?? OUTCOME_TEXT.EXPIRED), outcome === "ACCEPTED" ? "success" : "info");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function send(message: string) {
    const msg = message.trim();
    if (!msg) return;
    try {
      await reply.mutateAsync({ id: request.id, message: msg });
      setReplyOpen(false);
      setText("");
      toast.show(t("request.sent", { message: msg }), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const qty = qtyLabel(request.quantity, request.unit);
  const cat = category(request.category_id);

  return (
    <div className={cx(ink ? "rounded-2xl bg-elevated p-4 shadow-raised" : "p-4", className)}>
      <div className="flex items-start gap-3">
        <Avatar name={who} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-footnote font-medium text-text-2">
            {ink && <span className="rounded-sm bg-person-soft px-2 py-px text-xs font-strong text-person">{t("mode.newRequest")}</span>}
            <span>
              {t("request.wants")} <b className="font-strong text-text">{who}</b>
            </span>
            {more > 0 && <span className="font-normal"> · {t("request.others", { n: more })}</span>}
          </p>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-lg font-semibold">{request.name}</span>
            <span className="shrink-0 text-base font-strong">{qty}</span>
          </div>
          <p className="mt-0.5 text-footnote text-text-2">
            {request.note ? `„${request.note}“ · ` : ""}
            {cat.name}
          </p>
          {request.response_note && (
            <p className="mt-2 inline-block rounded-xl rounded-br-sm bg-sunken px-3 py-2 text-footnote">
              {t("request.yourReply")} {request.response_note}
            </p>
          )}
        </div>
      </div>

      {replyOpen && (
        <div className="mt-3 flex flex-col gap-2 animate-rise">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(t(q))}
                className="h-11 shrink-0 rounded-full bg-sunken px-4 text-footnote font-strong active:bg-pressed"
              >
                {t(q)}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("request.replyPlaceholder")}
              aria-label={t("request.replyAria", { who })}
              maxLength={300}
              autoFocus
              className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong/60 bg-elevated px-3 text-sm outline-none placeholder:text-text-3 focus:border-primary"
            />
            <button
              type="submit"
              aria-label={t("request.send")}
              disabled={!text.trim() || reply.isPending}
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-on-primary disabled:opacity-40"
            >
              <Send className="size-[1.0625rem]" aria-hidden />
            </button>
          </form>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => answer(false)}
          className="h-11 rounded-xl bg-sunken px-4 text-sm font-strong text-danger active:bg-pressed disabled:opacity-50"
        >
          {t("request.dismiss")}
        </button>
        <button
          type="button"
          aria-label={t("request.reply")}
          aria-expanded={replyOpen}
          onClick={() => setReplyOpen((v) => !v)}
          className={cx("grid size-11 shrink-0 place-items-center rounded-xl bg-sunken text-text-2 active:bg-pressed", replyOpen && "bg-primary-soft text-primary")}
        >
          <MessageSquare className="size-[1.0625rem]" aria-hidden />
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => answer(true)}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-strong text-on-primary active:bg-primary-pressed disabled:opacity-50"
        >
          <Check className="size-4" strokeWidth={2.4} aria-hidden />
          {busy === "yes" ? t("request.adding") : t("request.add")}
        </button>
      </div>
    </div>
  );
}
