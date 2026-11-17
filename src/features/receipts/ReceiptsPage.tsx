/**
 * Bločky – prenesené z mockupu (prototyp/src/receipt.jsx Receipts): mesiace, bločky po dňoch so sumou dňa.
 * Navyše hore „Na kontrolu“ (čítajú sa, treba skontrolovať, nepodarilo sa) a v ⋯ výdavok bez bločku a výpis z banky.
 */
import { Fragment, useState } from "react";
import { useNavigate } from "react-router";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { formatDateTime, t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { I, IB, MkHeader, Seg, Back } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { StoreTile, eur, relDay, storeKeyOf } from "@/mockup/kit";
import { monthName, shiftMonth, thisMonth } from "@/features/analytics/period";
import { ManualExpenseSheet } from "./AddFlow";
import { needsAttention, useReceipts, type Receipt } from "./api";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (d: string) => formatDateTime(new Date(`${d}T00:00`), { day: "numeric", month: "numeric" });
const dayOf = (r: Receipt) => r.purchased_on ?? r.created_at.slice(0, 10);

export function ReceiptsPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const receipts = useReceipts(household.id);
  const m0 = thisMonth();
  const months = [m0, shiftMonth(m0, -1), shiftMonth(m0, -2)];
  const [mo, setMo] = useState(m0);
  const [menu, setMenu] = useState(false);
  const [manual, setManual] = useState(false);
  const all = receipts.data ?? [];
  const attention = all.filter(needsAttention);
  const rs = all.filter((r) => dayOf(r).startsWith(mo) && r.status !== "FAILED" && r.status !== "PROCESSING");
  const total = rs.reduce((a, r) => a + Number(r.total ?? 0), 0);
  const byDay = new Map<string, Receipt[]>();
  for (const r of rs) byDay.set(dayOf(r), [...(byDay.get(dayOf(r)) ?? []), r]);
  const status = (r: Receipt) =>
    r.status === "PROCESSING" ? t("rl.reading") : r.status === "FAILED" ? t("rl.failed") : r.status === "NEEDS_REVIEW" ? t("rl.check") : "";
  const row = (r: Receipt) => {
    const name = r.store_name ?? t("row.unknownStore");
    const s = status(r);
    return (
      <button type="button" key={r.id} className="row tap" onClick={() => navigate(`/receipts/${r.id}`)}>
        <StoreTile k={storeKeyOf(name)} n={name} s={40} />
        <div className="tx">
          <b>{name}</b>
          <span className="sub">
            {[r.purchased_time?.slice(0, 5), r.origin === "BANK" ? t("rl.bank") : r.origin === "MANUAL" ? t("rl.manual") : null].filter(Boolean).join(" · ")}
            {s && <span className="note">{s}</span>}
          </span>
        </div>
        <b className="amt">{r.total != null ? eur(Number(r.total)) : "–"}</b>
      </button>
    );
  };

  return (
    <div className="stack">
      <MkHeader
        title={t("mn.receipts")}
        back={<Back label={t("mn.title")} onClick={() => navigate(-1)} />}
        right={
          <>
            <IB n="camera" label={t("sp.photo")} onClick={() => navigate("/scan")} />
            <IB n="dots-three" label={t("rl.more")} onClick={() => setMenu(true)} />
          </>
        }
      >
        <Seg<string> items={months.map((m) => [m, cap(monthName(Number(m.slice(5))))])} value={mo} onChange={setMo} />
        <p className="meta">
          {tn("rl.receipts", rs.length)} · {t("rl.total", { sum: eur(total) })}
        </p>
      </MkHeader>
      <div className="bhm bhm-list">
        <div className="body">
          {attention.length > 0 && (
            <>
              <div className="group plain">
                <I n="warning-circle" />
                <span className="gl">{t("rl.attention")}</span>
                <span className="cnt">{attention.length}</span>
              </div>
              <div className={`lst${g ? " glass2" : ""}`}>{attention.map(row)}</div>
            </>
          )}
          {[...byDay.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([d, list]) => {
              const rel = relDay(d);
              return (
                <Fragment key={d}>
                  <div className="group plain">
                    <span className="gl">{rel === formatDateTime(new Date(`${d}T00:00`), { weekday: "short", day: "numeric", month: "numeric" }) ? short(d) : `${cap(rel)} · ${short(d)}`}</span>
                    <span className="cnt">{eur(list.reduce((a, r) => a + Number(r.total ?? 0), 0))}</span>
                  </div>
                  <div className={`lst${g ? " glass2" : ""}`}>{list.map(row)}</div>
                </Fragment>
              );
            })}
          {!rs.length && !receipts.isPending && (
            <div className="empty">
              <I n="receipt" />
              <b>{t("rl.empty")}</b>
            </div>
          )}
        </div>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} label={t("rl.more")}>
        <div className="sh-head">
          <h2>{t("mn.receipts")}</h2>
        </div>
        <div className="sh-body">
          <div className="menu">
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setManual(true);
              }}
            >
              <I n="pencil-simple" />
              {t("rl.manual2")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                navigate("/receipts/statement");
              }}
            >
              <I n="file-text" />
              {t("rl.statement")}
            </button>
          </div>
        </div>
      </Sheet>
      <ManualExpenseSheet open={manual} onClose={() => setManual(false)} householdId={household.id} />
    </div>
  );
}
