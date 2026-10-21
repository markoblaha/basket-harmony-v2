import { useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { BottomSheet, CatIcon, PersonAvatar, SheetHeader } from "@/components/kit";
import { useToast } from "@/components/toast";
import { cx } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatDateTime, t, tn, type Key } from "@/i18n";
import { useDecideRequest, useReplyRequest, type AdditionRequest } from "./api";
import { qtyLabel } from "./qty";

const REPLIES: Key[] = ["request.quick.ok", "request.quick.inCart", "request.quick.unavailable", "ls.reply.nextTime"];

const STATUS: Record<string, [Key, string]> = {
  PENDING: ["request.status.PENDING", "b-violet"],
  ACCEPTED: ["request.status.ACCEPTED", "b-green"],
  REJECTED: ["request.status.REJECTED", "b-red"],
  EXPIRED: ["request.status.EXPIRED", "b-gray"],
};

export function RequestStatus({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [null, "b-gray"];
  return (
    <span className={cx("badge", cls)}>
      {status === "PENDING" && <span className="live" style={{ width: 6, height: 6 }} />}
      {label ? t(label) : "?"}
    </span>
  );
}

type Group = { from: string; name: string; requests: AdditionRequest[] };

function groupByRequester(requests: AdditionRequest[], names: Map<string, string> | undefined): Group[] {
  const map = new Map<string, Group>();
  for (const r of requests) {
    const from = r.requested_by ?? "?";
    const g = map.get(from) ?? { from, name: names?.get(from) ?? t("household.fallbackName"), requests: [] };
    g.requests.push(r);
    map.set(from, g);
  }
  return [...map.values()];
}

/** Čakajúce žiadosti u nakupujúceho: fialová karta „Lucia chce pridať“ → panel N5. */
export function PendingRequests({ requests, names, listId }: { requests: AdditionRequest[]; names: Map<string, string> | undefined; listId: string }) {
  const [open, setOpen] = useState<Group | null>(null);
  const groups = groupByRequester(requests, names);
  if (!groups.length) return null;
  return (
    <section className="stack g-8">
      {groups.map((g) => (
        <button
          key={g.from}
          type="button"
          className="row g-12 anim-pop"
          style={{ padding: "12px 14px", borderRadius: 16, background: "var(--violet-soft)", color: "var(--violet)", textAlign: "left", minHeight: 56 }}
          onClick={() => setOpen(g)}
        >
          <PersonAvatar person={{ id: g.from, name: g.name }} size="sm" />
          <span className="grow stack g-2" style={{ minWidth: 0 }}>
            <span className="t-sm fw-6">{t("ls.wantsToAdd", { name: shortName(g.name) })}</span>
            <span className="t-sm ellipsis">{g.requests.map((r) => r.name).join(", ")}</span>
          </span>
          <span className="t-sm fw-6">{t("ls.decide")}</span>
        </button>
      ))}
      <RequestSheet group={open ? (groups.find((g) => g.from === open.from) ?? null) : null} listId={listId} onClose={() => setOpen(null)} />
    </section>
  );
}

/** N5 – žiadosť počas nákupu: pri každej položke Pridať / Nie, voliteľná odpoveď. */
function RequestSheet({ group, listId, onClose }: { group: Group | null; listId: string; onClose: () => void }) {
  return (
    <BottomSheet open={!!group} onClose={onClose} label={group ? t("ls.wantsToAdd", { name: shortName(group.name) }) : ""}>
      {group && <RequestBody key={group.from} group={group} listId={listId} onClose={onClose} />}
    </BottomSheet>
  );
}

function RequestBody({ group, listId, onClose }: { group: Group; listId: string; onClose: () => void }) {
  const decide = useDecideRequest(listId);
  const reply = useReplyRequest(listId);
  const toast = useToast();
  const [dec, setDec] = useState<Record<string, boolean>>(() => Object.fromEntries(group.requests.map((r) => [r.id, true])));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const acc = Object.values(dec).filter(Boolean).length;
  const at = formatDateTime(group.requests[0]!.created_at, { hour: "2-digit", minute: "2-digit" });

  async function submit() {
    setBusy(true);
    try {
      const msg = text.trim();
      for (const r of group.requests) {
        await decide.mutateAsync({ id: r.id, accept: dec[r.id] ?? true });
        if (msg) await reply.mutateAsync({ id: r.id, message: msg });
      }
      onClose();
      toast.show(acc === 0 ? t("request.outcome.REJECTED") : t("request.outcome.ACCEPTED"));
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader title={t("ls.wantsToAdd", { name: shortName(group.name) })} sub={`${t("ls.at", { time: at })} · ${tn("shop.itemCount", group.requests.length)}`} onClose={onClose} />
      <div className="sheet-body stack g-16">
        <div className="cells">
          {group.requests.map((r) => (
            <div key={r.id} className="cell">
              <CatIcon id={r.category_id} size="sm" />
              <span className="grow stack g-2" style={{ minWidth: 0 }}>
                <span className="t-body fw-5 ellipsis">{r.name}</span>
                <span className="t-sm t-2 num ellipsis">{[qtyLabel(r.quantity, r.unit), r.note].filter(Boolean).join(" · ")}</span>
              </span>
              <div className="seg" style={{ width: 150 }}>
                <button type="button" className={dec[r.id] ? "on" : ""} aria-pressed={dec[r.id]} onClick={() => setDec({ ...dec, [r.id]: true })}>
                  <Check size={15} />
                  {t("ls.add")}
                </button>
                <button type="button" className={!dec[r.id] ? "on" : ""} aria-pressed={!dec[r.id]} onClick={() => setDec({ ...dec, [r.id]: false })}>
                  <X size={15} />
                  {t("ls.no")}
                </button>
              </div>
            </div>
          ))}
        </div>
        <section className="stack g-8">
          <span className="field-label">
            <MessageSquare size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
            {t("ls.replyOptional")}
          </span>
          <div className="row wrap g-8">
            {REPLIES.map((k) => (
              <button key={k} type="button" className={cx("chip", text === t(k) && "on")} onClick={() => setText(text === t(k) ? "" : t(k))}>
                {t(k)}
              </button>
            ))}
          </div>
          <input className="input" placeholder={t("request.replyPlaceholder")} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        </section>
        <button type="button" className="btn btn-ink btn-lg btn-block" disabled={busy} onClick={() => void submit()}>
          {acc === group.requests.length ? t("request.add") : acc === 0 ? t("ls.reject") : t("ls.addSome", { n: acc, total: group.requests.length })}
        </button>
      </div>
    </>
  );
}

/** Moje žiadosti (u toho, kto sleduje nákup): stav každej a odpoveď nakupujúceho. */
export function MyRequests({ requests, shopperName }: { requests: AdditionRequest[]; shopperName: string }) {
  if (!requests.length) return null;
  return (
    <section className="stack g-8">
      <div className="section-head">
        <span className="section-title">{t("ls.myRequests")}</span>
      </div>
      <div className="cells">
        {requests.map((r) => (
          <div key={r.id} className="stack g-6" style={{ padding: "12px 14px" }}>
            <div className="row g-8">
              <span className="grow t-body fw-5 ellipsis">
                {r.name}
                <span className="t-2 fw-5"> · {qtyLabel(r.quantity, r.unit)}</span>
              </span>
              <RequestStatus status={r.status} />
            </div>
            {r.response_note && (
              <span
                className="t-sm"
                style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: "4px 14px 14px 14px", background: "var(--violet-soft)", color: "var(--violet)" }}
              >
                {shortName(shopperName)}: „{r.response_note}“
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
