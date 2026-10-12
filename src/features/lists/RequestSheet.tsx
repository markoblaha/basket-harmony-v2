import { useState } from "react";
import { Button, Sheet } from "@/components/ui";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { formatQuantity } from "@/lib/parseItem";
import { category } from "@/lib/categories";
import { useDecideRequest, type AdditionRequest } from "./api";

const OUTCOME_TEXT = {
  ACCEPTED: "Pridané do zoznamu",
  REJECTED: "Žiadosť odmietnutá",
  EXPIRED: "Žiadosť už neplatí – nákup medzičasom skončil.",
} as const;

/**
 * Okno pre nakupujúceho: "Cyril chce pridať: Olivový olej, 1 ks".
 * Ak príde viac žiadostí, ukazujú sa postupne (rad).
 */
export function RequestSheet({
  listId,
  pending,
  names,
}: {
  listId: string;
  pending: AdditionRequest[];
  names: Map<string, string> | undefined;
}) {
  const decide = useDecideRequest(listId);
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const current = pending[0];
  if (!current) return null;

  const who = (current.requested_by && names?.get(current.requested_by)) || "Člen domácnosti";
  const qty = formatQuantity(current.quantity, current.unit);
  const cat = category(current.category_id);

  async function answer(accept: boolean) {
    if (!current) return;
    setBusyId(current.id + accept);
    try {
      const outcome = await decide.mutateAsync({ id: current.id, accept });
      toast.show(OUTCOME_TEXT[outcome] ?? OUTCOME_TEXT.EXPIRED, outcome === "ACCEPTED" ? "success" : "info");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet open dismissible={false} onClose={() => undefined} title={`${who} chce pridať`}>
      <div className="flex flex-col gap-4">
        <div className="rounded-[var(--radius-surface)] bg-warning-soft p-4">
          <p className="text-2xl font-bold text-text">{current.name}</p>
          <p className="mt-1 text-text-2">
            {[qty, `${cat.emoji} ${cat.name}`, current.note].filter(Boolean).join(" · ")}
          </p>
        </div>
        {pending.length > 1 && <p className="text-sm text-text-2">Čakajú ešte ďalšie žiadosti: {pending.length - 1}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" loading={busyId === current.id + "false"} disabled={!!busyId} onClick={() => answer(false)}>
            Odmietnuť
          </Button>
          <Button variant="success" size="lg" loading={busyId === current.id + "true"} disabled={!!busyId} onClick={() => answer(true)}>
            Pridať
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
