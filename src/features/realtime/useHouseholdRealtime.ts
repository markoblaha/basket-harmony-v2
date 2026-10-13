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
  shopping_list_items: [["items"], ["analytics", "hints"]],
  shopping_lists: [["lists"]],
  shopping_sessions: [["session"], ["requests"]],
  addition_requests: [["requests"], ["items"]],
  receipts: [["receipts"], ["receipt"], ["analytics"]],
  household_members: [["members"], ["profiles"], ["households"]],
};

export function useHouseholdRealtime(householdId: string): RealtimeStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    let wasLive = false;
    const channel = supabase.channel(`household:${householdId}`);
    for (const table of Object.keys(TABLE_KEYS)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` },
        () => {
          for (const queryKey of TABLE_KEYS[table]!) qc.invalidateQueries({ queryKey });
        },
      );
    }
    // Mazanie sa podľa domácnosti filtrovať nedá (zmazaný riadok už nemá obsah,
    // príde len jeho ID). Počúvame preto mazanie bez filtra a len obnovíme zoznam.
    for (const table of ["shopping_list_items", "shopping_lists", "receipts"]) {
      channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, () => {
        for (const queryKey of TABLE_KEYS[table]!) qc.invalidateQueries({ queryKey });
      });
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
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);

  return status;
}
