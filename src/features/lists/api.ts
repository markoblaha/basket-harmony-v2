/**
 * Prístup k zoznamom, položkám, nákupom a žiadostiam.
 * Všetky zápisy, pri ktorých záleží na pravidlách (pridanie položky, nákup,
 * žiadosti), idú cez databázové funkcie – tie rozhodujú, nie prehliadač.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Row } from "@/lib/database.types";
import { guessCategory } from "@/lib/categories";

export type ShoppingList = Row<"shopping_lists">;
export type Item = Row<"shopping_list_items">;
export type Session = Row<"shopping_sessions">;
export type AdditionRequest = Row<"addition_requests">;

export const listKeys = {
  lists: (hid: string) => ["lists", hid] as const,
  items: (listId: string) => ["items", listId] as const,
  session: (listId: string) => ["session", listId] as const,
  requests: (listId: string) => ["requests", listId] as const,
};

/** Kúpené položky zobrazujeme ešte 7 dní (dajú sa vrátiť do zoznamu). */
const RECENT_PURCHASE_DAYS = 7;

export function useLists(householdId: string) {
  return useQuery({
    queryKey: listKeys.lists(householdId),
    queryFn: async (): Promise<ShoppingList[]> => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("household_id", householdId)
        .eq("is_archived", false)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useItems(listId: string | undefined) {
  return useQuery({
    queryKey: listKeys.items(listId ?? "none"),
    enabled: !!listId,
    queryFn: async (): Promise<Item[]> => {
      const since = new Date(Date.now() - RECENT_PURCHASE_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("shopping_list_items")
        .select("*")
        .eq("list_id", listId!)
        .or(`status.eq.OPEN,purchased_at.gte.${since}`)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Aktívny nákup zoznamu (ak nejaký je). Vypršaný sa berie ako neaktívny. */
export function useActiveSession(listId: string | undefined) {
  return useQuery({
    queryKey: listKeys.session(listId ?? "none"),
    enabled: !!listId,
    queryFn: async (): Promise<Session | null> => {
      const { data, error } = await supabase
        .from("shopping_sessions")
        .select("*")
        .eq("list_id", listId!)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // Aby sa vypršanie prejavilo aj bez zásahu servera.
    refetchInterval: 60_000,
    select: (s) => (s && new Date(s.expires_at).getTime() > Date.now() ? s : null),
  });
}

export function useRequests(listId: string | undefined, sessionId: string | undefined) {
  return useQuery({
    queryKey: [...listKeys.requests(listId ?? "none"), sessionId ?? "none"],
    enabled: !!listId && !!sessionId,
    queryFn: async (): Promise<AdditionRequest[]> => {
      const { data, error } = await supabase
        .from("addition_requests")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

// ------------------------------------------------------------------ zápisy

export type AddItemInput = {
  listId: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  categoryId?: string | null;
};
export type AddItemResult = { kind: "ITEM" | "REQUEST"; id: string; shopper_id?: string };

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddItemInput): Promise<AddItemResult> => {
      const { data, error } = await supabase.rpc("add_item", {
        p_list_id: input.listId,
        p_name: input.name,
        p_quantity: input.quantity ?? undefined,
        p_unit: input.unit ?? undefined,
        p_note: input.note ?? undefined,
        p_category_id: input.categoryId ?? undefined,
        p_category_guess: guessCategory(input.name),
        // Jedinečné ID požiadavky: ak sa odošle dvakrát, server vytvorí len jednu položku.
        p_client_op_id: crypto.randomUUID(),
      });
      if (error) throw error;
      return data as AddItemResult;
    },
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: listKeys.items(input.listId) });
      qc.invalidateQueries({ queryKey: listKeys.requests(input.listId) });
    },
  });
}

type ItemPatch = Partial<Pick<Item, "name" | "quantity" | "unit" | "note" | "category_id" | "status">>;

/** Úprava položky – v aplikácii sa prejaví okamžite, server ju potvrdí v pozadí. */
export function useUpdateItem(listId: string) {
  const qc = useQueryClient();
  const key = listKeys.items(listId);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ItemPatch }) => {
      const { error } = await supabase.from("shopping_list_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Item[]>(key);
      qc.setQueryData<Item[]>(key, (items) =>
        items?.map((it) =>
          it.id === id
            ? {
                ...it,
                ...patch,
                ...(patch.status === "PURCHASED" ? { purchased_at: new Date().toISOString() } : {}),
                ...(patch.status === "OPEN" ? { purchased_at: null, purchased_by: null } : {}),
              }
            : it,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteItem(listId: string) {
  const qc = useQueryClient();
  const key = listKeys.items(listId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Item[]>(key);
      qc.setQueryData<Item[]>(key, (items) => items?.filter((it) => it.id !== id));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useCreateList(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .insert({ household_id: householdId, name })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKeys.lists(householdId) }),
  });
}

export function useUpdateList(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; is_archived?: boolean } }) => {
      const { error } = await supabase.from("shopping_lists").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKeys.lists(householdId) }),
  });
}

// ------------------------------------------------------------------ nákup

export function useStartShopping(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("start_shopping", { p_list_id: listId });
      if (error) throw error;
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: listKeys.session(listId) }),
  });
}

export function useEndShopping(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc("end_shopping", { p_session_id: sessionId });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listKeys.session(listId) });
      qc.invalidateQueries({ queryKey: listKeys.requests(listId) });
    },
  });
}

export type DecisionOutcome = "ACCEPTED" | "REJECTED" | "EXPIRED";

export function useDecideRequest(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { data, error } = accept
        ? await supabase.rpc("accept_request", { p_request_id: id })
        : await supabase.rpc("reject_request", { p_request_id: id });
      if (error) throw error;
      return (data as { outcome: DecisionOutcome }).outcome;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listKeys.requests(listId) });
      qc.invalidateQueries({ queryKey: listKeys.items(listId) });
    },
  });
}
