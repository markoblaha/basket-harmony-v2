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
    <div className={cx(ink ? "rounded-[1.375rem] bg-primary p-3.5 text-on-primary shadow-[0_22px_50px_rgb(0_0_0/0.4)]" : "p-3.5", className)}>
      <div className="flex items-start gap-2.5">
        <Avatar name={who} size="lg" />
        <div className="min-w-0 flex-1">
          <p className={cx("text-[0.8125rem] font-semibold", ink ? "opacity-70" : "text-text-2")}>
            {t("request.wants")} <b className={ink ? "" : "text-text"}>{who}</b>
            {more > 0 && <span className="font-normal"> · {t("request.others", { n: more })}</span>}
          </p>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-lg font-extrabold leading-tight tracking-[-0.01em]">{request.name}</span>
            <span className="shrink-0 text-base font-bold">{qty}</span>
          </div>
          <p className={cx("mt-0.5 text-[0.8125rem]", ink ? "opacity-65" : "text-text-2")}>
            {request.note ? `„${request.note}“ · ` : ""}
            {cat.name}
          </p>
          {request.response_note && (
            <p className={cx("mt-1.5 inline-block rounded-xl rounded-br-sm px-2.5 py-1.5 text-[0.8125rem]", ink ? "bg-on-primary/12" : "bg-surface")}>
              {t("request.yourReply")} {request.response_note}
            </p>
          )}
        </div>
      </div>

      {replyOpen && (
        <div className="mt-3 flex flex-col gap-2 [animation:bh-rise_.3s_ease]">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(t(q))}
                className={cx(
                  "h-[2.125rem] shrink-0 rounded-[0.5625rem] border px-2.5 text-[0.8125rem] font-semibold",
                  ink ? "border-on-primary/20 bg-on-primary/8" : "border-line bg-elevated",
                )}
              >
                {t(q)}
              </button>
            ))}
          </div>
          <form
            className="flex gap-1.5"
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
              className={cx(
                "h-[2.625rem] min-w-0 flex-1 rounded-[0.6875rem] border px-3 text-sm outline-none",
                ink ? "border-on-primary/20 bg-on-primary/8 placeholder:text-on-primary/50" : "border-line bg-elevated placeholder:text-text-3 focus:border-primary",
              )}
            />
            <button
              type="submit"
              aria-label={t("request.send")}
              disabled={!text.trim() || reply.isPending}
              className={cx("grid h-[2.625rem] w-11 shrink-0 place-items-center rounded-[0.6875rem] disabled:opacity-40", ink ? "bg-on-primary text-primary" : "bg-primary text-on-primary")}
            >
              <Send className="size-[1.0625rem]" aria-hidden />
            </button>
          </form>
        </div>
      )}

      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => answer(false)}
          className={cx(
            "h-11 rounded-xl border px-3.5 text-sm font-bold disabled:opacity-50",
            ink ? "border-on-primary/20 text-accent" : "border-line bg-elevated text-danger",
          )}
        >
          {t("request.dismiss")}
        </button>
        <button
          type="button"
          aria-label={t("request.reply")}
          aria-expanded={replyOpen}
          onClick={() => setReplyOpen((v) => !v)}
          className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", ink ? "border-on-primary/20" : "border-line bg-elevated", replyOpen && "ring-2 ring-accent")}
        >
          <MessageSquare className="size-[1.0625rem]" aria-hidden />
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => answer(true)}
          className={cx(
            "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold disabled:opacity-50",
            ink ? "bg-on-primary text-primary" : "bg-primary text-on-primary",
          )}
        >
          <Check className="size-4" strokeWidth={2.8} aria-hidden />
          {busy === "yes" ? t("request.adding") : t("request.add")}
        </button>
      </div>
    </div>
  );
}
