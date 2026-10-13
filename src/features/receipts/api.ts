/**
 * Prístup k bločkom. Čítanie fotky robí server (Edge Function extract-receipt);
 * či je bloček "v poriadku" rozhoduje databáza. Tu len nahrávame a zobrazujeme.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Row } from "@/lib/database.types";

export type Receipt = Row<"receipts">;
export type ReceiptItem = Row<"receipt_items">;

export const receiptKeys = {
  all: (hid: string) => ["receipts", hid] as const,
  one: (id: string) => ["receipt", id] as const,
  image: (path: string) => ["receipt-image", path] as const,
};

export function useReceipts(householdId: string) {
  return useQuery({
    queryKey: receiptKeys.all(householdId),
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("household_id", householdId)
        .order("purchased_on", { ascending: false, nullsFirst: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    // Kým sa nejaký bloček číta, zoznam sa sám obnovuje (okrem živej synchronizácie).
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "PROCESSING") ? 5_000 : false),
  });
}

export function useReceipt(id: string | undefined) {
  return useQuery({
    queryKey: receiptKeys.one(id ?? "none"),
    enabled: !!id,
    queryFn: async (): Promise<{ receipt: Receipt; items: ReceiptItem[] } | null> => {
      const [r, i] = await Promise.all([
        supabase.from("receipts").select("*").eq("id", id!).maybeSingle(),
        supabase.from("receipt_items").select("*").eq("receipt_id", id!).order("position"),
      ]);
      if (r.error) throw r.error;
      if (i.error) throw i.error;
      return r.data ? { receipt: r.data, items: i.data } : null;
    },
    refetchInterval: (q) => (q.state.data?.receipt.status === "PROCESSING" ? 4_000 : false),
  });
}

/** Fotka je v súkromnom úložisku – ukážeme ju cez dočasný podpísaný odkaz. */
export function useReceiptImage(path: string | undefined) {
  return useQuery({
    queryKey: receiptKeys.image(path ?? "none"),
    enabled: !!path,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

// ------------------------------------------------------------------ nahrávanie

export type UploadOutcome = "NEW" | "DUPLICATE" | "OK" | "NEEDS_REVIEW" | "FAILED";

async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function extensionOf(file: File): "jpg" | "png" | "webp" | "heic" {
  const t = file.type.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("heic") || t.includes("heif")) return "heic";
  return "jpg";
}

/** Príliš veľkú fotku (nad limit úložiska) zmenšíme; bežné fotky idú v pôvodnej podobe. */
async function fitForUpload(file: File): Promise<Blob> {
  const LIMIT = 9 * 1024 * 1024;
  if (file.size <= LIMIT) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("IMAGE_TOO_LARGE");
  return blob;
}

/** Vyvolá čítanie bločku na serveri. Vráti výsledný stav bločku. */
export async function extractReceipt(receiptId: string): Promise<"OK" | "NEEDS_REVIEW"> {
  const { data, error } = await supabase.functions.invoke("extract-receipt", { body: { receipt_id: receiptId } });
  if (error) {
    // Pri chybe servera je užitočný text až v tele odpovede.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json().catch(() => null);
      if (body?.detail) throw new Error(body.detail);
    }
    throw error;
  }
  return data?.status === "OK" ? "OK" : "NEEDS_REVIEW";
}

/**
 * Nahrá jednu fotku: odtlačok -> registrácia (duplicitu databáza odmietne)
 * -> fotka do úložiska -> čítanie na serveri.
 */
export async function uploadReceiptFile(householdId: string, file: File): Promise<UploadOutcome> {
  const checksum = await sha256Hex(file);
  const { data, error } = await supabase.rpc("register_receipt", {
    p_household_id: householdId,
    p_checksum: checksum,
    p_ext: extensionOf(file),
  });
  if (error) throw error;
  const reg = data[0]!;
  if (reg.already_exists) return "DUPLICATE";

  const body = await fitForUpload(file);
  const up = await supabase.storage.from("receipts").upload(reg.path, body, {
    contentType: body.type || "image/jpeg",
  });
  if (up.error) {
    // Bez fotky by bloček zostal prázdny a ďalší pokus by ho brał ako duplicitu.
    await supabase.from("receipts").delete().eq("id", reg.receipt_id);
    throw up.error;
  }
  try {
    return await extractReceipt(reg.receipt_id);
  } catch {
    return "FAILED"; // dôvod je uložený pri bločku, zobrazí sa v zozname
  }
}

// ------------------------------------------------------------------ úpravy

export function useRereadReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => extractReceipt(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipt"] });
    },
  });
}

export function useConfirmReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("confirm_receipt", { p_receipt_id: id });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipt"] });
    },
  });
}

export function useUpdateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { store_name?: string | null; purchased_on?: string | null; total?: number | null };
    }) => {
      const { error } = await supabase.from("receipts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipt"] });
    },
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (receipt: Receipt) => {
      const { error } = await supabase.from("receipts").delete().eq("id", receipt.id);
      if (error) throw error;
      // Fotku mažeme až po riadku; ak by sa nepodarilo, ostane len nevyužitý súbor.
      await supabase.storage.from("receipts").remove([receipt.image_path]);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipt"] });
    },
  });
}
