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
/** Čítanie sa začalo, ale server ho nikdy nedokončil (napr. zavretá aplikácia, výpadok). */
export const isStale = (r: Receipt) => r.status === "PROCESSING" && Date.now() - new Date(r.updated_at).getTime() > 3 * 60_000;
/** Doklad čaká na človeka: kontrola, chyba alebo zaseknuté čítanie. */
export const needsAttention = (r: Receipt) => r.status === "NEEDS_REVIEW" || r.status === "FAILED" || isStale(r);
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
export async function uploadReceipt(householdId: string, files: File[], listId?: string | null): Promise<UploadOutcome> {
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
  if (listId) {
    // Doklad k nákupu (z obrazovky „Nákup dokončený“ alebo z Histórie): priradí sa hneď.
    const { error: ae } = await supabase.rpc("attach_receipt_to_list", { p_receipt_id: reg.receipt_id, p_list_id: listId });
    if (ae) console.warn("Doklad sa nepodarilo priradiť k nákupu", ae);
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

export type ItemInput = {
  /** Bez id = nová položka. */
  id?: string;
  name: string;
  lineTotal: number;
  quantity: number;
  discount: number;
  categoryId: string;
};

/** Pridá alebo zmení položku dokladu. Súčet a stav dokladu prepočíta databáza. */
export function useSaveReceiptItem(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: ItemInput) => {
      const { error } = await supabase.rpc("save_receipt_item", {
        p_receipt_id: receiptId,
        p_item_id: item.id ?? null,
        p_name: item.name,
        p_line_total: item.lineTotal,
        p_quantity: item.quantity,
        p_discount: item.discount,
        p_category_id: item.categoryId,
      });
      if (error) throw error;
    },
    onSettled: () => invalidateReceipts(qc),
  });
}

export function useRemoveReceiptItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc("remove_receipt_item", { p_item_id: itemId });
      if (error) throw error;
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
      patch: { store_name?: string | null; purchased_on?: string | null; total?: number | null; category_id?: string | null };
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

// ------------------------------------------------------------------ bankový výpis a ručné výdavky

export type StatementRow = {
  idx: number;
  date: string;
  amount: number;
  direction: "out" | "in";
  merchant: string;
  description: string | null;
  kind: "purchase" | "bill" | "transfer" | "cash" | "income" | "fee" | "other";
  category_id: string;
};
export type StatementMatch = { idx: number; receipt_id: string; store_name: string | null; purchased_on: string | null; origin: string };

const fileToBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("READ_FAILED"));
    reader.readAsDataURL(file);
  });

/**
 * Výpis pošleme na server (funkcia read-statement), ten ho prečíta cez AI a vráti pohyby.
 * Súbor sa nikde neukladá. Potom databáza nájde pohyby, ku ktorým už bloček máme.
 */
export async function readStatement(householdId: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isText = ext === "csv" || ext === "txt" || file.type.startsWith("text/");
  const body = isText
    ? { household_id: householdId, text: await file.text() }
    : { household_id: householdId, file_b64: await fileToBase64(file), ext: ext === "jpeg" ? "jpg" : ext || "pdf" };
  const { data, error } = await supabase.functions.invoke("read-statement", { body });
  if (error) {
    let detail = "";
    try {
      detail = JSON.stringify(await (error as { context?: Response }).context?.json());
    } catch {
      /* bez detailu */
    }
    if (detail.includes("GEMINI_402")) throw new Error("GEMINI_402");
    if (detail.includes("FILES_TOO_LARGE")) throw new Error("FILE_TOO_LARGE");
    throw new Error("STATEMENT_READ_FAILED");
  }
  const result = data as { is_statement: boolean; transactions: StatementRow[] };
  if (!result.is_statement) throw new Error("NOT_A_STATEMENT");
  const rows = result.transactions;
  const { data: matches, error: matchError } = await supabase.rpc("preview_bank_payments", {
    p_household_id: householdId,
    p_rows: rows.filter((r) => r.direction === "out").map((r) => ({ idx: r.idx, date: r.date, amount: r.amount })),
  });
  if (matchError) throw matchError;
  const fileHash = await sha256Hex(file);
  return { rows, matches: new Map((matches as StatementMatch[]).map((m) => [m.idx, m])), fileHash };
}

export function useImportBankPayments(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { date: string; amount: number; merchant: string; category_id: string; ref: string }[]) => {
      const { data, error } = await supabase.rpc("import_bank_payments", { p_household_id: householdId, p_rows: rows });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useAddManualExpense(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; date: string; amount: number; categoryId: string }) => {
      const { data, error } = await supabase.rpc("add_manual_expense", {
        p_household_id: householdId,
        p_name: input.name,
        p_date: input.date,
        p_amount: input.amount,
        p_category_id: input.categoryId,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

// ------------------------------------------------------------------ párovanie s nákupom

export type MatchCandidate = {
  list_id: string;
  name: string;
  completed_at: string;
  receipt_state: "NONE" | "LATER" | "ATTACHED";
  attached: boolean;
  score: number;
  store_match: boolean;
  days: number;
  hit: string[];
  missing: string[];
  extra: { name: string; line_total: number }[];
};
export type MatchSuggestion = { receipt_id: string; list_id: string; score: number };

/** Doklady bez nákupu, ku ktorým databáza našla pravdepodobný nákup (časť „Na vybavenie“). */
export function useMatchSuggestions(householdId: string) {
  return useQuery({
    queryKey: ["receipt-match", householdId],
    queryFn: async (): Promise<MatchSuggestion[]> => {
      const { data, error } = await supabase.rpc("receipt_match_suggestions", { p_household_id: householdId });
      if (error) throw error;
      return (data as MatchSuggestion[]).map((s) => ({ ...s, score: Number(s.score) }));
    },
    // Bez nasadenej funkcie Doklady fungujú ďalej, len bez návrhov.
    retry: false,
  });
}

/** Nákupy, ku ktorým môže doklad patriť – so zhodou a porovnaním položiek. */
export function useMatchCandidates(receiptId: string | undefined) {
  return useQuery({
    queryKey: ["receipt-candidates", receiptId ?? "none"],
    enabled: !!receiptId,
    queryFn: async (): Promise<MatchCandidate[]> => {
      const { data, error } = await supabase.rpc("receipt_match_candidates", { p_receipt_id: receiptId! });
      if (error) throw error;
      return (data as MatchCandidate[]).map((c) => ({ ...c, score: Number(c.score) }));
    },
  });
}

function invalidateMatch(qc: ReturnType<typeof useQueryClient>) {
  invalidateReceipts(qc);
  qc.invalidateQueries({ queryKey: ["receipt-match"] });
  qc.invalidateQueries({ queryKey: ["receipt-candidates"] });
  qc.invalidateQueries({ queryKey: ["lists"] });
}

/** Priradí doklad k nákupu (databáza odpojí doklad od predchádzajúceho nákupu). */
export function useAttachReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ receiptId, listId }: { receiptId: string; listId: string }) => {
      const { error } = await supabase.rpc("attach_receipt_to_list", { p_receipt_id: receiptId, p_list_id: listId });
      if (error) throw error;
    },
    onSettled: () => invalidateMatch(qc),
  });
}

/** „Bez nákupu“ – doklad sa už nebude navrhovať k nákupu. */
export function useDismissMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (receiptId: string) => {
      const { error } = await supabase.rpc("dismiss_receipt_match", { p_receipt_id: receiptId });
      if (error) throw error;
    },
    onSettled: () => invalidateMatch(qc),
  });
}
