import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomSheet, SheetHeader, Stepper, StoreBadge } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CATEGORIES } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatEuro, t } from "@/i18n";
import { useProduct, type PriceHint } from "@/features/analytics/api";
import { useDeleteItem, useUpdateItem, type Item } from "./api";
import { UNITS } from "./Composer";
import { countOf } from "./qty";
import { dayLabel } from "./dates";
import { useRestoreItem } from "./PlanList";

/** N3a – úprava položky (prototyp): názov, upresnenie, množstvo s jednotkou, kategória, ceny z bločkov. */
export function EditItemSheet({
  item,
  listId,
  onClose,
  addedBy,
  hint,
}: {
  item: Item | null;
  listId: string;
  onClose: () => void;
  addedBy?: string;
  hint?: PriceHint;
}) {
  return (
    <BottomSheet open={!!item} onClose={onClose} label={t("edit.title")}>
      {item && <Body key={item.id} item={item} listId={listId} onClose={onClose} addedBy={addedBy} hint={hint} />}
    </BottomSheet>
  );
}

function Body({ item, listId, onClose, addedBy, hint }: { item: Item; listId: string; onClose: () => void; addedBy?: string; hint?: PriceHint }) {
  const update = useUpdateItem(listId);
  const remove = useDeleteItem(listId);
  const toast = useToast();
  const restore = useRestoreItem();
  // Posledné nákupy toho istého produktu z bločkov (prototyp: do 5 riadkov).
  const product = useProduct(hint?.product_id);
  const history = (product.data?.purchases ?? []).slice(0, 5);
  const [name, setName] = useState(item.name);
  const [detail, setDetail] = useState(item.note ?? "");
  const [qty, setQ] = useState(countOf(item.quantity));
  const [unit, setU] = useState<string>(item.unit && item.unit !== "bal" ? item.unit : "ks");
  const [cat, setCat] = useState(item.category_id);

  // Panel sa hneď zavrie (odpojí) – preto čakáme na sľub, nie na callbacky mutate,
  // ktoré by sa po odpojení komponentu už nezavolali.
  function save() {
    update
      .mutateAsync({
        id: item.id,
        patch: { name: name.trim() || item.name, note: detail.trim() || null, quantity: qty, unit: unit === "ks" ? (item.unit === "bal" ? "bal" : null) : unit, category_id: cat },
      })
      .then(() => toast.show(t("ls.itemEdited")))
      .catch((err) => toast.show(errorMessage(err), "error"));
    onClose();
  }

  function destroy() {
    onClose();
    remove
      .mutateAsync(item.id)
      .then(() => toast.show(t("item.removed", { name: item.name }), "info", { undo: () => restore(item) }))
      .catch((err) => toast.show(errorMessage(err), "error"));
  }

  return (
    <>
      <SheetHeader title={t("edit.title")} sub={addedBy ? t("item.addedBy", { name: shortName(addedBy) }) : undefined} onClose={onClose} />
      <div className="sheet-body stack g-16">
        <div className="stack g-6">
          <span className="field-label">{t("edit.name")}</span>
          <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="stack g-6">
          <span className="field-label">{t("ls.detail")}</span>
          <input className="input" placeholder={t("ls.detailPlaceholder")} value={detail} maxLength={300} onChange={(e) => setDetail(e.target.value)} />
        </div>
        <div className="stack g-6">
          <span className="field-label">{t("edit.quantity")}</span>
          <div className="row g-8">
            <Stepper
              value={qty}
              onChange={setQ}
              min={unit === "ks" ? 1 : 0.1}
              step={unit === "g" || unit === "ml" ? 50 : unit === "ks" ? 1 : 0.1}
              unit={unit}
            />
            <div className="seg grow" style={{ gridAutoColumns: "1fr" }}>
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={unit === u ? "on" : ""}
                  onClick={() => {
                    setU(u);
                    if (u === "g" || u === "ml") setQ(Math.max(50, qty < 10 ? 250 : qty));
                    else if (qty >= 50) setQ(1);
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="stack g-6">
          <span className="field-label">{t("edit.category")}</span>
          <div className="chips" style={{ margin: 0, padding: "2px 0 4px" }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={cx("chip", cat === c.id && "on")} onClick={() => setCat(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <span className="t-xs t-3" style={{ padding: "0 4px" }}>
            {t("edit.categoryHint")}
          </span>
        </div>
        {hint && (
          <div className="stack g-6">
            <span className="field-label">{t("ls.pricesFromReceipts")}</span>
            <div className="cells">
              <div className="cell" style={{ minHeight: 48 }}>
                <span className="grow t-sm fw-5">{t("ls.estimateFor")}</span>
                <span className="t-body fw-6 num">~{formatEuro(hint.last_price)}</span>
              </div>
              {history.length > 0
                ? history.map((h) => (
                    <div key={h.item_id} className="cell" style={{ minHeight: 44 }}>
                      <StoreBadge name={h.store} size="sm" />
                      <span className="grow t-sm t-2 num">
                        {dayLabel(h.date)} · {h.store}
                      </span>
                      {h.discount > 0 && <span className="badge b-yellow">{t("ls.promo")}</span>}
                      <span className="t-sm fw-6 num">
                        {h.basis === "ks"
                          ? formatEuro(h.line_total / (h.quantity || 1))
                          : t("ls.perUnit", { price: formatEuro(h.paid_unit ?? h.line_total / (h.quantity || 1)), unit: h.basis })}
                      </span>
                    </div>
                  ))
                : (
                    <div className="cell" style={{ minHeight: 44 }}>
                      <StoreBadge name={hint.last_store} size="sm" />
                      <span className="grow t-sm t-2 num">
                        {dayLabel(hint.last_date)} · {hint.last_store}
                      </span>
                      <span className="t-sm fw-6 num">{formatEuro(hint.last_price)}</span>
                    </div>
                  )}
              {hint.cheapest_store && hint.cheapest_store !== hint.last_store && hint.cheapest_unit < hint.last_unit - 0.005 && (
                <div className="cell" style={{ minHeight: 44 }}>
                  <StoreBadge name={hint.cheapest_store} size="sm" />
                  <span className="grow t-sm t-2">{t("ls.cheaperAt", { store: hint.cheapest_store })}</span>
                  <span className="badge b-green">{t("ls.cheaper")}</span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="row g-8">
          <button type="button" className="btn btn-danger" onClick={destroy}>
            <Trash2 size={17} />
            {t("kit.remove")}
          </button>
          <button type="button" className="btn btn-ink grow" onClick={save}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </>
  );
}
