import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Copy, Pencil, Trash2 } from "lucide-react";
import { BottomSheet, Cell, SheetHeader } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { useAddItem, useCreateList, useItems, useLists, useUpdateList, type ShoppingList } from "./api";
import { addDays, isoDay, listDay } from "./dates";
import { ListSheet } from "./ListSheet";

/** N1A – akcie zoznamu (podržanie karty alebo ⋯ v zozname): otvoriť, upraviť, duplikovať, zmazať. */
export function ListActionsSheet({ list, onClose, onDeleted }: { list: ShoppingList | null; onClose: () => void; onDeleted?: () => void }) {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const toast = useToast();
  const lists = useLists(household.id);
  const items = useItems(list?.id);
  const create = useCreateList(household.id);
  const update = useUpdateList(household.id);
  const add = useAddItem();
  const [editing, setEditing] = useState<ShoppingList | null>(null);

  const open = (items.data ?? []).filter((i) => i.status === "OPEN");

  async function duplicate(l: ShoppingList) {
    onClose();
    try {
      const id = await create.mutateAsync({ name: l.name, isPrivate: l.is_private, plannedFor: isoDay(addDays(new Date(), 1)), note: l.note });
      for (const i of open) await add.mutateAsync({ listId: id, name: i.name, quantity: i.quantity, unit: i.unit, note: i.note, categoryId: i.category_id });
      toast.show(t("ls.duplicated", { name: l.name }), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function remove(l: ShoppingList) {
    onClose();
    try {
      await update.mutateAsync({ id: l.id, patch: { is_archived: true } });
      onDeleted?.();
      toast.show(t("lsheet.archived", { name: l.name }), "info", {
        undo: () =>
          update.mutate({ id: l.id, patch: { is_archived: false } }, { onError: (err) => toast.show(errorMessage(err), "error") }),
      });
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <>
      <BottomSheet open={!!list} onClose={onClose} label={list?.name ?? ""}>
        {list && (
          <>
            <SheetHeader title={list.name} sub={`${listDay(list)} · ${tn("shop.itemCount", open.length)}`} onClose={onClose} />
            <div className="sheet-body stack g-12">
              <div className="cells">
                <Cell
                  icon={<span className="cat-ic sm"><ArrowRight size={15} /></span>}
                  title={t("ls.openList")}
                  onClick={() => {
                    onClose();
                    navigate(`/lists/${list.id}`);
                  }}
                />
                <Cell
                  icon={<span className="cat-ic sm"><Pencil size={15} /></span>}
                  title={t("ls.editList")}
                  onClick={() => {
                    setEditing(list);
                    onClose();
                  }}
                />
                <Cell icon={<span className="cat-ic sm"><Copy size={15} /></span>} title={t("ls.duplicate")} onClick={() => void duplicate(list)} />
                <Cell
                  icon={
                    <span className="cat-ic sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
                      <Trash2 size={15} />
                    </span>
                  }
                  title={t("ls.delete")}
                  danger
                  chevron={false}
                  onClick={() => void remove(list)}
                />
              </div>
            </div>
          </>
        )}
      </BottomSheet>
      <ListSheet
        key={editing?.id ?? "none"}
        open={!!editing}
        onClose={() => setEditing(null)}
        householdId={household.id}
        householdName={household.name}
        me={me}
        lists={lists.data ?? []}
        list={editing}
      />
    </>
  );
}
