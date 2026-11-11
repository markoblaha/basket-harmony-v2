/**
 * História nákupov a detail nákupu – prenesené z mockupu (prototyp/src/lists.jsx History, HistList).
 * Zoznam ukončených nákupov so stavom bločku; detail: spolu, Odfotiť bloček, kúpené položky, Nakúpiť znova.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useReceipts, type Receipt } from "@/features/receipts/api";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { Back, E, I, MkHeader, Seg } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Btn, StoreTile, emojiFor, eur, relDay, storeKeyOf } from "@/mockup/kit";
import { useAddItem, useCreateList, useListStats, useLists, useTripItems, type ShoppingList } from "./api";
import { isoDay } from "./dates";
import { qtyLabel } from "./qty";

export function HistoryPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const lists = useLists(household.id);
  const stats = useListStats(household.id);
  const receipts = useReceipts(household.id);
  const g = useTheme().style === "glass";
  const filter = params.get("filter") === "missing" ? "missing" : "all";

  const trips = useMemo(
    () => (lists.data ?? []).filter((l) => l.completed_at).sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [lists.data],
  );
  const missing = trips.filter((l) => l.receipt_state === "LATER");
  const shown = filter === "missing" ? missing : trips;

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;

  return (
    <div className="stack">
      <MkHeader title={t("ls.history")} back={<Back label={t("nav.shopping")} onClick={() => navigate("/lists")} />} right={<HelpBtn screen="history" />}>
        <p className="meta">{t("hist.intro")}</p>
        {missing.length > 0 && (
          <Seg
            items={[
              ["all", t("ls.filterAll")],
              ["missing", `${t("ls.filterMissing")} · ${missing.length}`],
            ]}
            value={filter}
            onChange={(v) => setParams(v === "missing" ? { filter: "missing" } : {}, { replace: true })}
          />
        )}
        {!shown.length ? (
          <div className="empty">
            <E k="bags" s={64} />
            <b>{filter === "missing" ? t("ls.allHaveReceipt") : t("hist.emptyTitle")}</b>
            {filter !== "missing" && <p>{t("hist.emptyText")}</p>}
          </div>
        ) : (
          <div className={`lst${g ? " glass2" : ""}`}>
            {shown.map((l) => {
              const st = stats.data?.get(l.id);
              const receipt = l.receipt_id ? receipts.data?.find((r) => r.id === l.receipt_id) : undefined;
              const k = storeKeyOf(l.name);
              // Úseky sa nezalomia v strede („3 / položky“), zalomiť sa dá len medzi nimi.
              const sub = [relDay(l.completed_at!), tn("shop.itemCount", st?.bought ?? 0), receipt?.total != null ? eur(Number(receipt.total)) : ""]
                .filter(Boolean)
                .map((x) => x.replace(/ /g, "\u00a0"))
                .join("\u00a0· ");
              return (
                <button type="button" key={l.id} className="row tap" onClick={() => navigate(`/history/${l.id}`)}>
                  {k ? (
                    <StoreTile k={k} s={44} />
                  ) : (
                    <span className="th ic">
                      <I n="basket" />
                    </span>
                  )}
                  {/* Stav bločku pod názvom, nie vedľa neho – dlhý názov nákupu tak nie je odrezaný. */}
                  <div className="tx">
                    <b>{l.name}</b>
                    <span className="sub">{sub}</span>
                    <RcptPill list={l} receipt={receipt} />
                  </div>
                  <I n="caret-right" w="bold" cls="chev" />
                </button>
              );
            })}
          </div>
        )}
      </MkHeader>
      <div className="tab-space" />
    </div>
  );
}

/** Stav bločku pri nákupe: bloček ✓ · číta sa · chýba bloček · bez bločku. */
function RcptPill({ list, receipt }: { list: ShoppingList; receipt?: Receipt }) {
  if (list.receipt_state === "ATTACHED" && receipt?.status === "PROCESSING") return <span className="stat">{t("ls.reading")}</span>;
  if (list.receipt_state === "ATTACHED")
    return (
      <span className="stat ok">
        <I n="check" w="bold" />
        {t("hist.receipt")}
      </span>
    );
  if (list.receipt_state === "LATER") return <span className="stat warnp">{t("hist.missing")}</span>;
  return <span className="stat">{t("hist.noReceipt")}</span>;
}

export function HistoryDetailPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const lists = useLists(household.id);
  const receipts = useReceipts(household.id);
  const items = useTripItems(id);
  const create = useCreateList(household.id);
  const add = useAddItem();
  const g = useTheme().style === "glass";
  const [busy, setBusy] = useState(false);
  const list = (lists.data ?? []).find((l) => l.id === id);
  const back = <Back label={t("ls.history")} onClick={() => navigate("/history")} />;

  if (lists.isPending || items.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;
  if (items.isError) return <ErrorState error={errorMessage(items.error)} onRetry={() => items.refetch()} />;
  if (!list)
    return (
      <MkHeader title={t("ls.history")} back={back}>
        <div className="empty">
          <E k="bags" s={64} />
          <b>{t("hist.notFound")}</b>
        </div>
      </MkHeader>
    );

  const bought = (items.data ?? []).filter((i) => i.status === "PURCHASED");
  const receipt = list.receipt_id ? receipts.data?.find((r) => r.id === list.receipt_id) : undefined;
  const k = storeKeyOf(list.name);

  async function again() {
    if (busy || !list) return;
    setBusy(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const newId = await create.mutateAsync({ name: list.name, isPrivate: list.is_private, plannedFor: isoDay(tomorrow), note: null });
      for (const it of bought) await add.mutateAsync({ listId: newId, name: it.name, quantity: it.quantity, unit: it.unit, categoryId: it.category_id });
      toast.show(t("hist.againDone", { name: list.name, count: tn("shop.itemCount", bought.length) }), "success");
      navigate(`/lists/${newId}`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <MkHeader title={list.name} back={back}>
        <div className="meta">{t("hist.finishedOn", { day: relDay(list.completed_at!) })}</div>
        <div className={`card hsum${g ? " glass2" : ""}`}>
          <div className="rowc">
            {k && <StoreTile k={k} s={44} />}
            <div className="grow">
              <div className="k">{t("hist.total")}</div>
              <div className="price nw">{receipt?.total != null ? eur(Number(receipt.total)) : "–"}</div>
              <div className="meta sm">{tn("shop.itemCount", bought.length)}</div>
            </div>
            <RcptPill list={list} receipt={receipt} />
          </div>
          {list.receipt_state === "LATER" && (
            <Btn cls={`pri full${g ? " a" : ""}`} onClick={() => navigate(`/scan?nakup=${list.id}`)}>
              <I n="camera" />
              {t("hist.photo")}
            </Btn>
          )}
          {list.receipt_state === "ATTACHED" && list.receipt_id && (
            <Btn cls="soft full" onClick={() => navigate(`/receipts/${list.receipt_id}`)}>
              <I n="receipt" />
              {t("hist.showReceipt")}
            </Btn>
          )}
        </div>
        {bought.length > 0 && (
          <>
            <div className="h2 sm">{t("hist.bought")}</div>
            <div className={`lst${g ? " glass2" : ""}`}>
              {bought.map((it) => (
                <div key={it.id} className="row">
                  <span className="th ckth on">
                    <E k={emojiFor(it.name, it.category_id)} />
                    <span className="ckov" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M6 12.5l4 4 8-9" />
                      </svg>
                    </span>
                  </span>
                  <div className="tx">
                    <b>{it.name}</b>
                    <span className="sub">{qtyLabel(it.quantity, it.unit)}</span>
                  </div>
                </div>
              ))}
            </div>
            <Btn cls="soft full" onClick={() => void again()} disabled={busy}>
              <I n="arrow-counter-clockwise" w="bold" />
              {t("hist.again")}
            </Btn>
          </>
        )}
      </MkHeader>
      <div className="tab-space" />
    </div>
  );
}
