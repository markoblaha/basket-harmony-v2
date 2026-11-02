/**
 * Možnosti zoznamu (⋯) – prenesené z mockupu 1:1 (prototyp/src/lists.jsx ListMenuSheet): premenovať,
 * zmeniť obchod, skopírovať ako text, odstrániť odškrtnuté, zmazať zoznam (s potvrdením a Vrátiť).
 * Obchod je v appke súčasťou názvu zoznamu („Lidl“, „Lidl · sobota“), preto zmena obchodu mení názov.
 */
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { I } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { Btn, STORES, StoreTile, storeKeyOf } from "@/mockup/kit";
import { useItems, useUpdateList, type ShoppingList } from "./api";
import { fmtQty } from "./ListParts";
import { listDay } from "./dates";

/** Názov zoznamu s iným obchodom: „Lidl · sobota“ → „Billa · sobota“, „Na víkend“ → „Billa · Na víkend“. */
export function withStoreName(name: string, store: string): string {
  const k = storeKeyOf(name);
  const old = k ? STORES[k]!.n : null;
  if (old && name.toLowerCase().startsWith(old.toLowerCase())) return `${store}${name.slice(old.length)}`.trim();
  return `${store} · ${name}`;
}

export function ListMenuSheet({ list, onClose, onDeleted, onClearDone }: { list: ShoppingList | null; onClose: () => void; onDeleted?: () => void; onClearDone?: () => void }) {
  const { household } = useHousehold();
  const toast = useToast();
  const update = useUpdateList(household.id);
  const items = useItems(list?.id);
  const [mode, setMode] = useState<null | "name" | "store" | "del">(null);
  const [name, setName] = useState("");
  useEffect(() => {
    if (list) {
      setMode(null);
      setName(list.name);
    }
  }, [list?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [last, setLast] = useState<ShoppingList | null>(list);
  if (list && list !== last) setLast(list);
  const l = list ?? last;
  if (!l) return null;

  const fail = (err: unknown) => toast.show(errorMessage(err), "error");
  const all = items.data ?? [];
  const open = all.filter((i) => i.status === "OPEN");
  const hasDone = all.some((i) => i.status !== "OPEN");
  const sk = storeKeyOf(l.name);
  const rename = (n: string, msg?: string) =>
    update.mutate({ id: l.id, patch: { name: n } }, { onSuccess: () => msg && toast.show(msg, "success"), onError: fail });

  const share = () => {
    const txt = `${l.name}\n${open.map((i) => `• ${i.name} – ${fmtQty(i.quantity, i.unit)}`).join("\n")}`;
    const ok = () => toast.show(t("lm.copied"), "success");
    const no = () => toast.show(t("lm.copyBlocked"), "error");
    try {
      void navigator.clipboard.writeText(txt).then(ok, no);
    } catch {
      no();
    }
  };
  const del = () => {
    onClose();
    update.mutate(
      { id: l.id, patch: { is_archived: true } },
      {
        onSuccess: () => {
          onDeleted?.();
          toast.show(t("ls.deleted", { name: l.name }), "info", { undo: () => update.mutate({ id: l.id, patch: { is_archived: false } }, { onError: fail }) });
        },
        onError: fail,
      },
    );
  };

  return (
    <Sheet open={!!list} onClose={onClose} label={t("li.options")}>
      <div className="sh-head">
        <div className="grow">
          <h2>{l.name}</h2>
          <div className="meta">
            {listDay(l)} · {tn("li.items", all.length)}
          </div>
        </div>
      </div>
      <div className="sh-body">
        {mode === "name" ? (
          <form
            className="fl row"
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (n && n !== l.name) rename(n);
              setMode(null);
            }}
          >
            <input id="ren" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label={t("lm.rename")} />
            <button type="submit" className="btn pri sm">
              {t("lm.save")}
            </button>
          </form>
        ) : mode === "store" ? (
          <div className="stgrid">
            {Object.keys(STORES).map((k) => (
              <button
                type="button"
                key={k}
                className={`stb${sk === k ? " on" : ""}`}
                onClick={() => {
                  if (sk !== k) rename(withStoreName(l.name, STORES[k]!.n), t("lm.storeSet", { store: STORES[k]!.n }));
                  setMode(null);
                }}
              >
                <StoreTile k={k} s={40} />
                <span>{STORES[k]!.n}</span>
              </button>
            ))}
          </div>
        ) : mode === "del" ? (
          <div className="confirm">
            <p>
              {t("lm.delQ", { name: l.name, items: tn("li.items", all.length) })}
              {l.is_private ? "" : ` ${t("lm.delOthers")}`}
            </p>
            <div className="sh-act">
              <Btn cls="soft" onClick={() => setMode(null)}>
                {t("lm.keep")}
              </Btn>
              <Btn cls="danger" onClick={del}>
                {t("li.delete")}
              </Btn>
            </div>
          </div>
        ) : (
          <div className="menu">
            <button type="button" onClick={() => setMode("name")}>
              <I n="pencil-simple" />
              {t("lm.rename")}
            </button>
            <button type="button" onClick={() => setMode("store")}>
              <I n="storefront" />
              {t("lm.store")}
              <span className="mv">{sk ? STORES[sk]!.n : t("lm.noStore")}</span>
            </button>
            <button type="button" onClick={share}>
              <I n="share-network" />
              {t("lm.copy")}
            </button>
            {onClearDone && (
              <button
                type="button"
                disabled={!hasDone}
                onClick={() => {
                  onClearDone();
                  onClose();
                }}
              >
                <I n="broom" />
                {t("lm.clearDone")}
              </button>
            )}
            <button type="button" className="dng" onClick={() => setMode("del")}>
              <I n="trash" />
              {t("lm.delete")}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
