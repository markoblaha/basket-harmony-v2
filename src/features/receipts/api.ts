/**
 * Prístup k bločkom. Čítanie fotky robí server (Edge Function extract-receipt);
 * či je bloček "v poriadku" rozhoduje databáza. Tu len nahrávame a zobrazujeme.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Row } from "@/lib/database.types";

export type Receipt = Row<"receipts">;
export type ReceiptItem = Row<"receipt_items">;
export type ReceiptPage = Row<"receipt_pages">;

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

/** NOT_A_RECEIPT = na fotke nie je nákupný doklad (trvalé, nie porucha služby – preto nezastavuje dávku). */
export type UploadOutcome = "NEW" | "DUPLICATE" | "OK" | "NEEDS_REVIEW" | "FAILED" | "NOT_A_RECEIPT";

export const isNotAReceiptError = (e: unknown) => e instanceof Error && e.message.startsWith("NOT_A_RECEIPT");
/**
 * Chyba, pri ktorej nemá zmysel pokračovať ďalšími dokladmi (došiel kredit, zlý alebo chýbajúci kľúč).
 * Všetko ostatné (jeden nečitateľný doklad, výpadok) sa týka len jedného dokladu.
 */
export const isGlobalFailure = (message: string | null | undefined) =>
  !!message && /^(GEMINI_(401|402|403)|GEMINI_API_KEY_MISSING)/.test(message);
export const isReceiptPdf = (r: Pick<Receipt, "image_path">) => r.image_path.toLowerCase().endsWith(".pdf");
export const isNotAReceipt = (r: Receipt) => r.status === "FAILED" && !!r.error_text?.startsWith("NOT_A_RECEIPT");

async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function extensionOf(file: File): "jpg" | "png" | "webp" | "heic" | "pdf" {
  const t = file.type.toLowerCase();
  if (t.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("heic") || t.includes("heif")) return "heic";
  return "jpg";
}

/** Najviac strán jedného dokladu (rovnaký limit je v databáze). */
export const MAX_PAGES = 8;
/** Server pošle Gemini všetky strany naraz; spolu ich smie byť zhruba toľko. */
const TOTAL_BUDGET = 12 * 1024 * 1024;
const STORAGE_LIMIT = 9 * 1024 * 1024;

/**
 * Príliš veľký súbor zmenšíme (obrázok) alebo odmietneme (PDF); bežné fotky idú v pôvodnej podobe.
 * Pri doklade z viacerých strán sa limit na jednu stranu zníži, aby sa všetky zmestili naraz.
 */
async function fitForUpload(file: File, limit: number): Promise<Blob> {
  if (file.size <= limit) return file;
  if (extensionOf(file) === "pdf") throw new Error("FILE_TOO_LARGE");
  const bitmap = await createImageBitmap(file);
  let blob: Blob | null = null;
  for (const [side, quality] of [[3600, 0.85], [3000, 0.75], [2400, 0.7]] as const) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size <= limit) return blob;
  }
  if (!blob || blob.size > STORAGE_LIMIT) throw new Error("FILE_TOO_LARGE");
  return blob;
}

const perFileLimit = (count: number) => Math.min(STORAGE_LIMIT, Math.floor(TOTAL_BUDGET / Math.max(1, count)));

async function putFile(path: string, file: File, limit: number): Promise<void> {
  const body = await fitForUpload(file, limit);
  const up = await supabase.storage.from("receipts").upload(path, body, {
    contentType: body.type || (extensionOf(file) === "pdf" ? "application/pdf" : "image/jpeg"),
  });
  if (up.error) throw up.error;
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
 * Nahrá jeden doklad z jednej alebo viacerých strán (fotiek, snímok, PDF):
 * odtlačok -> registrácia (duplicitu databáza odmietne) -> súbory do úložiska -> čítanie na serveri.
 * Strana, ktorá v domácnosti už je, sa preskočí.
 */
export async function uploadReceipt(householdId: string, files: File[]): Promise<UploadOutcome> {
  const first = files[0];
  if (!first) throw new Error("VALIDATION");
  if (files.length > MAX_PAGES) throw new Error("TOO_MANY_PAGES");
  const limit = perFileLimit(files.length);

  const { data, error } = await supabase.rpc("register_receipt", {
    p_household_id: householdId,
    p_checksum: await sha256Hex(first),
    p_ext: extensionOf(first),
  });
  if (error) throw error;
  const reg = data[0]!;
  if (reg.already_exists) return "DUPLICATE";

  const uploaded: string[] = [];
  try {
    await putFile(reg.path, first, limit);
    uploaded.push(reg.path);
    for (const file of files.slice(1)) {
      const { data: pd, error: pe } = await supabase.rpc("register_receipt_page", {
        p_receipt_id: reg.receipt_id,
        p_checksum: await sha256Hex(file),
        p_ext: extensionOf(file),
      });
      if (pe) throw pe;
      const page = pd[0]!;
      if (page.already_exists) continue; // tá istá strana už v domácnosti je
      await putFile(page.path, file, limit);
      uploaded.push(page.path);
    }
  } catch (err) {
    // Bez súborov by doklad zostal prázdny a ďalší pokus by ho bral ako duplicitu.
    await supabase.from("receipts").delete().eq("id", reg.receipt_id);
    if (uploaded.length > 0) await supabase.storage.from("receipts").remove(uploaded);
    throw err;
  }
  try {
    return await extractReceipt(reg.receipt_id);
  } catch (e) {
    // Globálna chyba (kredit, kľúč) ide ďalej, aby sa dávka zastavila a človek videl dôvod.
    if (e instanceof Error && isGlobalFailure(e.message)) throw e;
    // Ostatné: dôvod je uložený pri doklade, zobrazí sa v zozname.
    return isNotAReceiptError(e) ? "NOT_A_RECEIPT" : "FAILED";
  }
}

/** Strany jedného dokladu v poradí (každá je samostatný súbor v úložisku). */
export function useReceiptPages(receiptId: string | undefined) {
  return useQuery({
    queryKey: ["receipt-pages", receiptId ?? "none"],
    enabled: !!receiptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_pages")
        .select("*")
        .eq("receipt_id", receiptId!)
        .order("position");
      if (error) throw error;
      return data as ReceiptPage[];
    },
  });
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

function invalidateReceipts(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["receipts"] });
  qc.invalidateQueries({ queryKey: ["receipt"] });
  qc.invalidateQueries({ queryKey: ["receipt-pages"] });
}

/** Pridá strany k existujúcemu dokladu a prečíta ho znova (všetky strany spolu). */
export function useAddReceiptPages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ receipt, files }: { receipt: Receipt; files: File[] }) => {
      const { count } = await supabase
        .from("receipt_pages")
        .select("id", { count: "exact", head: true })
        .eq("receipt_id", receipt.id);
      if ((count ?? 1) + files.length > MAX_PAGES) throw new Error("TOO_MANY_PAGES");
      const limit = perFileLimit((count ?? 1) + files.length);
      let added = 0;
      for (const file of files) {
        const { data, error } = await supabase.rpc("register_receipt_page", {
          p_receipt_id: receipt.id,
          p_checksum: await sha256Hex(file),
          p_ext: extensionOf(file),
        });
        if (error) throw error;
        const page = data[0]!;
        if (page.already_exists) continue; // tá istá strana už v domácnosti je
        await putFile(page.path, file, limit);
        added++;
      }
      if (added === 0) throw new Error("PAGE_ALREADY_EXISTS");
      return extractReceipt(receipt.id);
    },
    onSettled: () => invalidateReceipts(qc),
  });
}

/**
 * Spojí viac dokladov do jedného (prvý zostane, ostatné sa pridajú ako ďalšie strany)
 * a spojený doklad prečíta znova. Samotné spojenie robí databáza.
 */
export function useMergeReceipts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc("merge_receipts", { p_receipt_ids: ids });
      if (error) throw error;
      invalidateReceipts(qc);
      try {
        await extractReceipt(data);
      } catch (e) {
        // Spojenie prebehlo; zlyhanie čítania je vidno pri doklade a dá sa zopakovať.
        if (e instanceof Error && isGlobalFailure(e.message)) throw e;
      }
      return data;
    },
    onSettled: () => invalidateReceipts(qc),
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
      // Cesty všetkých strán si zapamätáme skôr, než zmizne riadok.
      const { data: pages } = await supabase.from("receipt_pages").select("image_path").eq("receipt_id", receipt.id);
      const paths = new Set([receipt.image_path, ...(pages ?? []).map((p) => p.image_path)]);
      const { error } = await supabase.from("receipts").delete().eq("id", receipt.id);
      if (error) throw error;
      // Súbory mažeme až po riadku; ak by sa nepodarilo, ostanú len nevyužité súbory.
      await supabase.storage.from("receipts").remove([...paths]);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipt"] });
    },
  });
}
