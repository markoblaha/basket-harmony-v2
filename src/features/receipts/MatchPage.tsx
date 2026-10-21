import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { Empty, ScreenHeader, StoreBadge } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { dayLabel } from "@/features/lists/dates";
import { formatEuro, t, tn } from "@/i18n";
import { useAttachReceipt, useDismissMatch, useMatchCandidates, useReceipt } from "./api";
import { readErrorMessage } from "./format";

/**
 * A7 – „Patrí doklad k nákupu?“ (prototyp): doklad a navrhnutý nákup so zhodou,
 * čo sa zhoduje, čo je na zozname a nie na doklade a čo je na doklade navyše.
 * Áno, patrí sem / Iný nákup / Bez nákupu.
 */
export function MatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const receipt = useReceipt(id);
  const candidates = useMatchCandidates(id);
  const attach = useAttachReceipt();
  const dismiss = useDismissMatch();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [showHit, setShowHit] = useState(false);

  if (receipt.isPending || candidates.isPending) return <Spinner />;
  if (receipt.isError) return <ErrorState error={readErrorMessage(receipt.error)} onRetry={() => receipt.refetch()} />;
  if (candidates.isError) return <ErrorState error={readErrorMessage(candidates.error)} onRetry={() => candidates.refetch()} />;
  const found = receipt.data?.receipt;
  if (!found) return <Empty icon={Link2} title={t("match.receiptGone")} />;
  const r = found;
  const list = candidates.data;
  const c = list.find((x) => x.list_id === pickedId) ?? list[0];

  if (!c) {
    return (
      <div className="stack">
        <ScreenHeader title={t("match.title")} onBack={() => navigate(-1)} />
        <Empty
          icon={Link2}
          title={t("match.none")}
          text={t("match.noneText")}
          action={
            <button type="button" className="btn btn-soft" onClick={() => navigate(`/receipts/${r.id}`, { replace: true })}>
              {t("match.openReceipt")}
            </button>
          }
        />
      </div>
    );
  }

  const total = c.hit.length + c.missing.length;
  const store = r.store_name ?? t("row.receipt");

  async function yes() {
    try {
      await attach.mutateAsync({ receiptId: r.id, listId: c!.list_id });
      toast.show(t("trip.attached", { name: c!.name }), "success");
      navigate("/receipts", { replace: true });
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }
  async function none() {
    try {
      await dismiss.mutateAsync(r.id);
      toast.show(t("match.dismissed"));
      navigate("/receipts", { replace: true });
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <div className="stack">
      <ScreenHeader title={t("match.title")} sub={t("match.sub")} onBack={() => navigate(-1)} />
      <div className="stack g-16" style={{ padding: "0 16px" }}>
        <section className="card stack g-12" style={{ padding: 18 }}>
          <div className="row g-12">
            <StoreBadge name={store} />
            <span className="grow stack">
              <span className="t-sm t-2">{t("match.receipt")}</span>
              <span className="t-h num">
                {store} · {dayLabel(r.purchased_on ?? r.created_at)}
                {r.purchased_time ? ` ${r.purchased_time.slice(0, 5)}` : ""} · {formatEuro(Number(r.total ?? 0))}
              </span>
            </span>
          </div>
          <div className="row g-12">
            <StoreBadge name={c.name} />
            <span className="grow stack">
              <span className="t-sm t-2">{t("match.trip")}</span>
              <span className="t-h">
                {c.name} · {dayLabel(c.completed_at)}
              </span>
              <span className="t-xs t-2">{c.attached ? t("match.attachedNow") : t("match.withoutReceipt")}</span>
            </span>
          </div>
          <div className="row g-6 wrap">
            <span className={cx("badge num", c.score >= 0.7 ? "b-green" : c.score >= 0.4 ? "b-yellow" : "b-orange")}>
              {t("match.score", { pct: Math.round(c.score * 100) })}
            </span>
            <span className={cx("badge", c.store_match ? "b-gray" : "b-orange")}>{c.store_match ? t("match.storeOk") : t("match.storeOther")}</span>
            <span className={cx("badge", c.days === 0 ? "b-gray" : "b-yellow")}>{c.days === 0 ? t("match.dateOk") : tn("match.daysOff", c.days)}</span>
          </div>
        </section>

        <div className="cells">
          <button type="button" className="cell" onClick={() => setShowHit((v) => !v)} aria-expanded={showHit}>
            <span className="cat-ic sm" style={{ color: "var(--accent-text)" }}>
              <Check size={16} />
            </span>
            <span className="grow t-body fw-5">{t("match.hit", { n: c.hit.length, total })}</span>
            <ChevronDown size={18} className="chev" style={{ transform: showHit ? "rotate(180deg)" : "" }} />
          </button>
          {showHit &&
            c.hit.map((name) => (
              <div key={name} className="cell t-sm" style={{ paddingLeft: 56 }}>
                <span className="grow">{name}</span>
              </div>
            ))}
        </div>

        {c.missing.length > 0 && (
          <section className="stack g-8">
            <span className="section-title">{t("match.missing", { n: c.missing.length })}</span>
            <div className="cells">
              {c.missing.map((name) => (
                <div key={name} className="cell t-sm">
                  <span className="grow">{name}</span>
                  <span className="t-xs t-3">{t("match.missingTag")}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {c.extra.length > 0 && (
          <section className="stack g-8">
            <span className="section-title">{t("match.extra", { n: c.extra.length })}</span>
            <div className="cells">
              {c.extra.map((e, i) => (
                <div key={`${e.name}-${i}`} className="cell t-sm">
                  <span className="grow" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>
                    {e.name}
                  </span>
                  <span className="num t-2">{formatEuro(Number(e.line_total))}</span>
                </div>
              ))}
            </div>
            <span className="t-xs t-3" style={{ padding: "0 4px" }}>
              {t("match.extraNote")}
            </span>
          </section>
        )}

        {other && (
          <section className="stack g-8 anim-rise">
            <span className="section-title">{t("match.others")}</span>
            <div className="cells">
              {list.filter((x) => x.list_id !== c.list_id).length ? (
                list
                  .filter((x) => x.list_id !== c.list_id)
                  .map((x) => (
                    <button
                      key={x.list_id}
                      type="button"
                      className="cell"
                      onClick={() => {
                        setPickedId(x.list_id);
                        setOther(false);
                      }}
                    >
                      <StoreBadge name={x.name} size="sm" />
                      <span className="grow stack g-2">
                        <span className="t-body fw-5">
                          {x.name} · {dayLabel(x.completed_at)}
                        </span>
                        <span className="t-xs t-2 num">{t("match.score", { pct: Math.round(x.score * 100) })}</span>
                      </span>
                      <ChevronRight size={18} className="chev" />
                    </button>
                  ))
              ) : (
                <div className="cell t-sm t-2">{t("match.noOthers")}</div>
              )}
            </div>
          </section>
        )}
      </div>
      <div style={{ height: 230 }} />
      <div className="bottom-cta fixed inset-x-0 mx-auto max-w-2xl stack g-8" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <button type="button" className="btn btn-ink btn-block" disabled={attach.isPending || c.attached} onClick={() => void yes()}>
          <Check size={18} /> {t("match.yes")}
        </button>
        <div className="row g-8">
          <button type="button" className="btn btn-soft grow" onClick={() => setOther((v) => !v)}>
            {t("match.other")}
          </button>
          <button type="button" className="btn btn-soft grow" disabled={dismiss.isPending || !!r.list_id} onClick={() => void none()}>
            {t("match.noTrip")}
          </button>
        </div>
      </div>
    </div>
  );
}
