/**
 * Živá synchronizácia. Otvoríme JEDEN kanál pre celú domácnosť a počúvame
 * zmeny v databáze. Keď príde zmena, povieme aplikácii, ktoré údaje sú
 * zastarané – tá si ich hneď znova načíta.
 *
 * Prečo jeden kanál: viac kanálov = duplicitné správy a zbytočná záťaž.
 * Kanál sa zatvorí pri odchode z aplikácie alebo zmene domácnosti.
 * Po výpadku spojenia sa Supabase sám pripojí znova; po opätovnom pripojení
 * načítame všetko nanovo, lebo počas výpadku sme mohli zmeškať zmeny.
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type RealtimeStatus = "connecting" | "live" | "reconnecting";

const TABLE_KEYS: Record<string, string[][]> = {
  shopping_list_items: [["items"], ["analytics", "hints"], ["frequent"], ["list-stats"]],
  favorite_tiles: [["favorites"]],
  shopping_lists: [["lists"], ["list-stats"]],
  shopping_sessions: [["session"], ["requests"], ["hub-sessions"]],
  addition_requests: [["requests"], ["items"]],
  receipts: [["receipts"], ["receipt"], ["analytics"], ["lists"]],
  household_members: [["members"], ["profiles"], ["households"]],
  recipes: [["recipes"]],
  recipe_plans: [["recipe-plans"]],
};

/** Zmena riadku z živého kanála (pre upozornenia v appke). */
export type RowChange = { table: string; event: "INSERT" | "UPDATE" | "DELETE"; row: Record<string, unknown>; old: Record<string, unknown> };
const listeners = new Set<(c: RowChange) => void>();
/** Prihlásenie na zmeny z toho istého kanála (nevytvára nový). Vráti odhlásenie. */
export function onHouseholdChange(fn: (c: RowChange) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useHouseholdRealtime(householdId: string): RealtimeStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    let wasLive = false;
    // Zmeny chodia v dávkach (jedno +1 = viac správ, aj naša vlastná ozvena). Zbierame ich 250 ms
    // a obnovíme každé údaje raz; kým sa ukladá naša vlastná úprava, počkáme – inak by obrazovka
    // na chvíľu ukázala stav spred úpravy a „skákala“.
    const due = new Map<string, readonly unknown[]>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      if (qc.isMutating() > 0) {
        timer = setTimeout(flush, 300);
        return;
      }
      const keys = [...due.values()];
      due.clear();
      for (const queryKey of keys) qc.invalidateQueries({ queryKey });
    };
    const refresh = (keys: string[][]) => {
      for (const k of keys) due.set(k.join("|"), k);
      timer ??= setTimeout(flush, 250);
    };
    const channel = supabase.channel(`household:${householdId}`);
    for (const table of Object.keys(TABLE_KEYS)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` },
        (payload) => {
          refresh(TABLE_KEYS[table]!);
          const change: RowChange = {
            table,
            event: payload.eventType,
            row: (payload.new ?? {}) as Record<string, unknown>,
            old: (payload.old ?? {}) as Record<string, unknown>,
          };
          listeners.forEach((f) => f(change));
        },
      );
    }
    // Mazanie sa podľa domácnosti filtrovať nedá (zmazaný riadok už nemá obsah,
    // príde len jeho ID). Počúvame preto mazanie bez filtra a len obnovíme zoznam.
    for (const table of ["shopping_list_items", "shopping_lists", "receipts", "favorite_tiles", "recipes"]) {
      channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, () => refresh(TABLE_KEYS[table]!));
    }
    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        if (wasLive) qc.invalidateQueries(); // po výpadku: všetko nanovo
        wasLive = true;
        setStatus("live");
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        setStatus(wasLive ? "reconnecting" : "connecting");
      }
    });
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);

  return status;
}
