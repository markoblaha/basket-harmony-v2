/**
 * Dáta pre hlasový nákup: rozbor vety cez AI (so zálohou), predajne domácnosti
 * a uloženie nadiktovaného zoznamu do Nákupu.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { guessCategory, normalizeName } from "@/lib/categories";
import { listKeys } from "@/features/lists/api";
import { countOf, isCountable, qtyLabel, sameProduct } from "@/features/lists/qty";
import { VOICE_UNITS, type VoiceOp, type VoiceUnit } from "./parse";

/** Položka rozdiktovaného zoznamu (žije v prehliadači, kým nedáš Hotovo). */
export type DraftItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: VoiceUnit | null;
  categoryId: string | null;
  status: "ok" | "needs_qty" | "unclear";
  suggestions: string[];
};

const DEFAULT_STORES = ["Lidl", "Kaufland", "Billa", "Tesco", "Terno", "Coop Jednota"];

/** Predajne, kam domácnosť chodí najčastejšie (podľa bločkov), doplnené o bežné reťazce. */
export function useKnownStores(householdId: string) {
  return useQuery({
    queryKey: ["voice-stores", householdId],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("receipts")
        .select("store_name")
        .eq("household_id", householdId)
        .not("store_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const counts = new Map<string, { name: string; n: number }>();
      for (const r of data as { store_name: string | null }[]) {
        const name = (r.store_name ?? "").trim();
        if (!name) continue;
        // „LIDL SK v.o.s.“ aj „Lidl“ → jedna predajňa s pekným názvom zo zoznamu bežných reťazcov.
        const known = DEFAULT_STORES.find((s) => normalizeName(name).startsWith(normalizeName(s).split(" ")[0]!));
        const label = known ?? name.split(/\s+/).slice(0, 2).join(" ");
        const key = normalizeName(label);
        const e = counts.get(key) ?? { name: label, n: 0 };
        e.n++;
        counts.set(key, e);
      }
      const top = [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.name);
      return [...new Set([...top, ...DEFAULT_STORES])].slice(0, 6);
    },
    placeholderData: DEFAULT_STORES,
  });
}

type ServerOp = {
  op: "add" | "change" | "remove" | "done";
  name: string | null;
  target: string | null;
  quantity: number | null;
  unit: string | null;
  delta: number | null;
  category_id: string | null;
  status: "ok" | "needs_qty" | "unclear";
  suggestions: string[];
};

const asUnit = (u: string | null): VoiceUnit | null => (VOICE_UNITS.includes(u as VoiceUnit) ? (u as VoiceUnit) : null);

function fromServer(ops: ServerOp[]): VoiceOp[] {
  const out: VoiceOp[] = [];
  for (const o of ops) {
    if (o.op === "done") out.push({ op: "done" });
    else if (o.op === "remove" && o.target) out.push({ op: "remove", target: o.target });
    else if (o.op === "change" && o.target)
      out.push({ op: "change", target: o.target, quantity: o.quantity, unit: asUnit(o.unit), delta: o.delta, name: o.name });
    else if (o.op === "add" && o.name)
      out.push({
        op: "add",
        name: o.name,
        quantity: o.quantity,
        unit: asUnit(o.unit) ?? (o.quantity && o.quantity % 1 === 0 ? "ks" : null),
        categoryId: o.category_id,
        status: o.status,
        suggestions: o.suggestions ?? [],
      });
  }
  return out;
}

/**
 * Veta → operácie od AI (rozumie skloňovaniu, delí vety bez čiarok, pozná tovar na váhu).
 * Vráti null, ak neodpovie do 6 s alebo zlyhá – vtedy ostane okamžitý lokálny rozbor.
 */
export async function interpretAI(text: string, items: DraftItem[], target: string | null): Promise<VoiceOp[] | null> {
  try {
    const call = supabase.functions.invoke("parse-voice", {
      body: { text, target, items: items.map((i) => ({ name: i.name, qty: i.quantity ? qtyLabel(i.quantity, i.unit) : "-" })) },
    });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 6000));
    const { data, error } = await Promise.race([call, timeout]);
    if (error || !Array.isArray(data?.ops)) return null;
    const ops = fromServer(data.ops as ServerOp[]);
    return ops.length ? ops : null;
  } catch {
    return null;
  }
}

export type SaveResult = { listId: string; added: number; merged: number; requests: number; created: boolean };

/**
 * Hotovo → zoznam v Nákupe, presne ako keby ho niekto vyklikal:
 * zoznam s názvom predajne (existujúci sa použije, nový sa vytvorí), položky cez
 * add_item (pravidlá – napr. žiadosť, keď práve nakupuje niekto iný – rozhodne databáza).
 * Rovnaký kusový produkt, ktorý už v zozname je, sa iba navýši.
 */
export function useSaveVoiceList(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ store, listId: target, date, items }: { store: string; listId: string | null; date: string; items: DraftItem[] }): Promise<SaveResult> => {
      let listId = target ?? undefined;
      if (!listId) {
        // Rozpracovaný nákup v tej istej predajni na ten istý deň sa použije, inak vznikne nový zoznam.
        const lists = await supabase
          .from("shopping_lists")
          .select("id, name, planned_for")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .is("completed_at", null);
        if (lists.error) throw lists.error;
        listId = lists.data.find((l) => normalizeName(l.name) === normalizeName(store) && (l.planned_for ?? "").slice(0, 10) === date)?.id;
      }
      const created = !listId;
      if (!listId) {
        const ins = await supabase.from("shopping_lists").insert({ household_id: householdId, name: store, planned_for: date }).select("id").single();
        if (ins.error) throw ins.error;
        listId = ins.data.id;
      }
      const open = await supabase.from("shopping_list_items").select("id, name, quantity, unit").eq("list_id", listId).eq("status", "OPEN");
      if (open.error) throw open.error;

      let added = 0;
      let merged = 0;
      let requests = 0;
      // Najstaršia nadiktovaná položka ide do zoznamu prvá (na obrazovke je navrchu najnovšia).
      for (const it of [...items].reverse()) {
        const existing = open.data.find((o) => sameProduct(o.name, it.name) && isCountable(o.unit) && isCountable(it.unit));
        if (existing) {
          const quantity = countOf(existing.quantity) + countOf(it.quantity);
          const upd = await supabase.from("shopping_list_items").update({ quantity }).eq("id", existing.id);
          if (upd.error) throw upd.error;
          existing.quantity = quantity;
          merged++;
          continue;
        }
        const { data, error } = await supabase.rpc("add_item", {
          p_list_id: listId,
          p_name: it.name,
          p_quantity: it.quantity ?? undefined,
          p_unit: it.unit ?? undefined,
          p_category_guess: it.categoryId ?? guessCategory(it.name),
          // ID rozdiktovanej položky: keby sa ukladanie opakovalo, položka nevznikne dvakrát.
          p_client_op_id: it.id,
        });
        if (error) throw error;
        if ((data as { kind?: string })?.kind === "REQUEST") requests++;
        else added++;
      }
      return { listId, added, merged, requests, created };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: listKeys.lists(householdId) });
      qc.invalidateQueries({ queryKey: listKeys.items(r.listId) });
      qc.invalidateQueries({ queryKey: listKeys.stats(householdId) });
      qc.invalidateQueries({ queryKey: ["frequent"] });
    },
  });
}

// ------------------------------------------------------------------ rozpracovaný zoznam

/** store "" = bez obchodu; targetListId = pridávanie do existujúceho zoznamu; date = YYYY-MM-DD. */
export type Draft = { store: string; date: string; targetListId: string | null; items: DraftItem[]; savedAt: number };
const draftKey = (hid: string) => `bh.voiceDraft.${hid}`;

/** Rozdiktovaný zoznam prežije zatvorenie obrazovky aj obnovenie stránky (24 h). */
export function loadDraft(hid: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(hid));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d.items?.length || Date.now() - d.savedAt > 86_400_000) return null;
    return { ...d, store: d.store ?? "", date: d.date ?? "", targetListId: d.targetListId ?? null };
  } catch {
    return null;
  }
}
export function saveDraft(hid: string, d: Draft | null) {
  try {
    if (d && d.items.length) localStorage.setItem(draftKey(hid), JSON.stringify(d));
    else localStorage.removeItem(draftKey(hid));
  } catch {
    /* súkromné okno – nevadí */
  }
}
