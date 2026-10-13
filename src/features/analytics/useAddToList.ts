import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useAddItem, useLists } from "@/features/lists/api";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";

/** Pridanie produktu z Prehľadov do (prvého) nákupného zoznamu. Pravidlá rieši databáza (add_item). */
export function useAddToList() {
  const { household } = useHousehold();
  const lists = useLists(household.id);
  const add = useAddItem();
  const toast = useToast();
  const list = lists.data?.[0];

  async function addToList(name: string, categoryId?: string) {
    if (!list) {
      toast.show(t("addtolist.noList"), "error");
      return;
    }
    try {
      const res = await add.mutateAsync({ listId: list.id, name, categoryId: categoryId ?? null });
      toast.show(res.kind === "REQUEST" ? t("addtolist.request") : t("addtolist.added", { name: list.name }), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }
  return { addToList, pending: add.isPending, listName: list?.name };
}
