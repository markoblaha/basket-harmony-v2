import { useState, type FormEvent } from "react";
import { Archive, Check, Plus } from "lucide-react";
import { Button, Group, Sheet, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useCreateList, useUpdateList, type ShoppingList } from "./api";

/** Prepínanie medzi zoznamami, nový zoznam, premenovanie a archivácia. */
export function ListsSheet({
  open,
  onClose,
  householdId,
  lists,
  currentId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  lists: ShoppingList[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const create = useCreateList(householdId);
  const update = useUpdateList(householdId);
  const toast = useToast();
  const current = lists.find((l) => l.id === currentId);
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState(current?.name ?? "");

  async function createList(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const id = await create.mutateAsync(newName.trim());
      setNewName("");
      onSelect(id);
      onClose();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function saveRename(e: FormEvent) {
    e.preventDefault();
    if (!current || !rename.trim()) return;
    try {
      await update.mutateAsync({ id: current.id, patch: { name: rename.trim() } });
      toast.show(t("lists.renamed"), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function archive() {
    if (!current) return;
    try {
      await update.mutateAsync({ id: current.id, patch: { is_archived: true } });
      const next = lists.find((l) => l.id !== current.id);
      if (next) onSelect(next.id);
      onClose();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("lists.title")}>
      <div className="flex flex-col gap-5">
        <Group>
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                onSelect(l.id);
                onClose();
              }}
              className={cx("flex min-h-14 w-full items-center justify-between px-4 text-left active:bg-pressed", l.id === currentId && "font-semibold")}
            >
              {l.name}
              {l.id === currentId && <Check className="size-5 text-primary" aria-label={t("lists.selected")} />}
            </button>
          ))}
        </Group>

        <form onSubmit={createList} className="flex items-end gap-2">
          <TextField className="flex-1" label={t("lists.newLabel")} placeholder={t("lists.newPlaceholder")} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
          <Button type="submit" className="mb-0.5 min-h-12" loading={create.isPending} disabled={!newName.trim()}>
            <Plus className="size-4" aria-hidden /> {t("lists.add")}
          </Button>
        </form>

        {current && (
          <form onSubmit={saveRename} className="flex items-end gap-2">
            <TextField className="flex-1" label={t("lists.renameLabel")} value={rename} onChange={(e) => setRename(e.target.value)} maxLength={60} />
            <Button type="submit" variant="secondary" className="mb-0.5 min-h-12" disabled={!rename.trim() || rename.trim() === current.name}>
              {t("common.save")}
            </Button>
          </form>
        )}

        {current && lists.length > 1 && (
          <Button variant="ghost" onClick={archive}>
            <Archive className="size-4" aria-hidden /> {t("lists.archive", { name: current.name })}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
