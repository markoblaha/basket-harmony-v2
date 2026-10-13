import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/toast";
import { t } from "@/i18n";
import {
  extractReceipt,
  isGlobalFailure,
  isNotAReceipt,
  isNotAReceiptError,
  isStale,
  uploadReceipt,
  type Receipt,
  type UploadOutcome,
} from "./api";
import { failureText, readErrorMessage } from "./format";

export type Progress = {
  total: number;
  done: number;
  counts: Record<UploadOutcome | "ERROR", number>;
  stopped?: boolean;
  /** Prečo sa dávka zastavila (veta pre človeka). */
  stopReason?: string;
};

/**
 * Jeden problémový doklad dávku nezastaví. Zastavíme ju len keď:
 *  - došiel kredit alebo je zlý kľúč (zastaví sa hneď, ďalšie doklady by zlyhali tiež), alebo
 *  - zlyhalo viac technických pokusov za sebou (výpadok služby alebo siete).
 */
const STOP_AFTER_FAILURES = 5;
const EMPTY_COUNTS = { NEW: 0, DUPLICATE: 0, OK: 0, NEEDS_REVIEW: 0, FAILED: 0, NOT_A_RECEIPT: 0, ERROR: 0 };
const outageText = () => t("batch.outage", { n: STOP_AFTER_FAILURES });

/** Spracovanie viacerých dokladov po jednom (nahratie + čítanie) so stavom pre lištu priebehu. */
export function useBatch(householdId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const [progress, setProgress] = useState<Progress | null>(null);
  const running = progress !== null && !progress.stopped && progress.done < progress.total;

  const publish = (state: Progress) => {
    setProgress({ ...state, counts: { ...state.counts } });
    qc.invalidateQueries({ queryKey: ["receipts"] });
  };

  /** Každá skupina súborov je jeden doklad (strany v poradí). Server číta jeden naraz, aby sme nepreťažili limity služby. */
  async function processGroups(groups: File[][]) {
    const state: Progress = { total: groups.length, done: 0, counts: { ...EMPTY_COUNTS } };
    setProgress({ ...state, counts: { ...state.counts } });
    let lastError: unknown = null;
    let streak = 0;
    for (const group of groups) {
      try {
        const outcome = await uploadReceipt(householdId, group);
        state.counts[outcome]++;
        if (outcome === "FAILED") streak++;
        else if (outcome !== "NOT_A_RECEIPT") streak = 0;
      } catch (err) {
        state.counts.ERROR++;
        lastError = err;
        streak++;
        if (err instanceof Error && isGlobalFailure(err.message)) {
          state.stopped = true;
          state.stopReason = failureText(err.message);
        }
      }
      state.done++;
      if (streak >= STOP_AFTER_FAILURES && state.done < state.total && !state.stopped) {
        state.stopped = true;
        state.stopReason = outageText();
      }
      publish(state);
      if (state.stopped) break;
    }
    if (lastError && !state.stopReason) toast.show(readErrorMessage(lastError), "error");
  }

  /** Znova prečíta doklady, ktoré skončili chybou alebo sa zasekli (fotky sú už nahraté). */
  async function retry(receipts: Receipt[]) {
    // Najprv tie, ktoré zlyhali technicky (kredit, preťaženie); súbory bez dokladu až nakoniec.
    const failed = receipts
      .filter((r) => r.status === "FAILED" || isStale(r))
      .sort((a, b) => Number(isNotAReceipt(a)) - Number(isNotAReceipt(b)));
    if (failed.length === 0) return;
    const state: Progress = { total: failed.length, done: 0, counts: { ...EMPTY_COUNTS } };
    setProgress({ ...state, counts: { ...state.counts } });
    let streak = 0;
    for (const r of failed) {
      try {
        const status = await extractReceipt(r.id);
        state.counts[status]++;
        streak = 0;
      } catch (err) {
        if (isNotAReceiptError(err)) {
          state.counts.NOT_A_RECEIPT++;
        } else {
          state.counts.FAILED++;
          streak++;
          const message = err instanceof Error ? err.message : "";
          if (isGlobalFailure(message)) {
            state.stopped = true;
            state.stopReason = failureText(message);
          }
        }
      }
      state.done++;
      if (streak >= STOP_AFTER_FAILURES && state.done < state.total && !state.stopped) {
        state.stopped = true;
        state.stopReason = outageText();
      }
      publish(state);
      if (state.stopped) break;
    }
  }

  return { progress, running, processGroups, retry, close: () => setProgress(null) };
}
