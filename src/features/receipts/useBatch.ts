import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/toast";
import { t } from "@/i18n";
import { isNotAReceipt, isStale, queueReceipt, uploadReceipt, type Receipt, type UploadOutcome } from "./api";
import { readErrorMessage } from "./format";

export type Progress = {
  total: number;
  done: number;
  counts: Record<UploadOutcome | "ERROR", number>;
  stopped?: boolean;
  /** Prečo sa dávka zastavila (veta pre človeka). */
  stopReason?: string;
};

/** Toľko neúspešných nahraní za sebou = pravdepodobne nejde internet; ďalej neskúšame. */
const STOP_AFTER_FAILURES = 3;
const EMPTY_COUNTS = { QUEUED: 0, DUPLICATE: 0, ERROR: 0 };

/**
 * Nahranie viacerých dokladov so stavom pre lištu priebehu.
 *
 * Aplikácia už na čítanie nečaká: každý doklad sa len nahrá a zaradí do fronty,
 * server ho prečíta na pozadí. Po dokončení nahrávania sa dá aplikácia zavrieť;
 * výsledky sa v zozname objavia samé (živá synchronizácia, pri ďalšom otvorení hneď).
 */
export function useBatch(householdId: string, listId?: string | null, onAttached?: () => void) {
  const qc = useQueryClient();
  const toast = useToast();
  const [progress, setProgress] = useState<Progress | null>(null);
  const running = progress !== null && !progress.stopped && progress.done < progress.total;

  const publish = (state: Progress) => {
    setProgress({ ...state, counts: { ...state.counts } });
    qc.invalidateQueries({ queryKey: ["receipts"] });
    qc.invalidateQueries({ queryKey: ["lists"] });
  };

  /** Každá skupina súborov je jeden doklad (strany v poradí). */
  async function processGroups(groups: File[][]) {
    const state: Progress = { total: groups.length, done: 0, counts: { ...EMPTY_COUNTS } };
    setProgress({ ...state, counts: { ...state.counts } });
    let lastError: unknown = null;
    let streak = 0;
    let attachTo = listId ?? null;
    for (const group of groups) {
      try {
        // K nákupu sa priradí iba prvý doklad dávky.
        const outcome = await uploadReceipt(householdId, group, attachTo);
        if (attachTo && outcome !== "DUPLICATE") {
          attachTo = null;
          onAttached?.();
        }
        state.counts[outcome]++;
        streak = 0;
      } catch (err) {
        state.counts.ERROR++;
        lastError = err;
        streak++;
      }
      state.done++;
      if (streak >= STOP_AFTER_FAILURES && state.done < state.total) {
        state.stopped = true;
        state.stopReason = t("batch.uploadFailing", { n: STOP_AFTER_FAILURES });
      }
      publish(state);
      if (state.stopped) break;
    }
    if (lastError && !state.stopReason) toast.show(readErrorMessage(lastError), "error");
  }

  /** Znova zaradí na čítanie doklady, ktoré skončili chybou alebo sa zasekli (súbory sú už nahraté). */
  async function retry(receipts: Receipt[]) {
    // Najprv tie, ktoré zlyhali technicky; súbory bez dokladu až nakoniec.
    const failed = receipts
      .filter((r) => r.status === "FAILED" || isStale(r))
      .sort((a, b) => Number(isNotAReceipt(a)) - Number(isNotAReceipt(b)));
    if (failed.length === 0) return;
    const state: Progress = { total: failed.length, done: 0, counts: { ...EMPTY_COUNTS } };
    setProgress({ ...state, counts: { ...state.counts } });
    for (const r of failed) {
      try {
        await queueReceipt(r.id);
        state.counts.QUEUED++;
      } catch (err) {
        state.counts.ERROR++;
        toast.show(readErrorMessage(err), "error");
      }
      state.done++;
      publish(state);
    }
  }

  return { progress, running, processGroups, retry, close: () => setProgress(null) };
}
