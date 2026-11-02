/**
 * Bloček z nákupu – prenesené z mockupu 1:1 (prototyp/src/receipt.jsx Scan): odfotiť / z galérie →
 * „Čítam bloček“ (číta server na pozadí) → výsledok: zaplatené vs. odhad, skutočné ceny pri položkách,
 * navyše v bločku, čo na bločku chýba. Doklad sa hneď priradí k nákupu (?nakup=<id>).
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { MAX_PAGES, useReceipt, type ReceiptItem } from "@/features/receipts/api";
import { failureText, readErrorMessage } from "@/features/receipts/format";
import { normalizeName } from "@/lib/categories";
import { formatDateTime, formatNumber, t } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB } from "@/mockup/ui";
import { Btn, eur, eur0, storeKeyOf, storeName } from "@/mockup/kit";
import { useLists, useTripItems, useUploadTripReceipt, type Item } from "./api";
import { useEstimator, type Estimator } from "./estimate";

const money = (v: number) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (v: number) => `${v > 0 ? "+" : "−"}${eur(Math.abs(v))}`;
const shortDate = (d: string | null) => (d ? formatDateTime(new Date(`${d}T00:00`), { day: "numeric", month: "numeric" }) : "");

/** Papierik bločku (ukážka pred odfotením alebo prečítaný bloček). */
function Paper({ store, date, lines, total, small }: { store: string; date: string; lines: { raw: string; t: number | null }[]; total: number | null; small?: boolean }) {
  const max = small ? 4 : 8;
  return (
    <div className={`paper${small ? " sm" : ""}`} aria-hidden="true">
      <div className="pc b">{store.toUpperCase()}</div>
      <div className="pc o">{date || "— — —"}</div>
      <div className="pd" />
      {lines.slice(0, max).map((l, i) => (
        <div className="pr" key={i}>
          <span>{l.raw}</span>
          <span>{l.t != null ? money(l.t) : "··,··"}</span>
        </div>
      ))}
      {lines.length > max && (
        <div className="pr o">
          <span>…</span>
          <span />
        </div>
      )}
      <div className="pd" />
      <div className="pr b">
        <span>{t("sc.total")}</span>
        <span>{total != null ? money(total) : "··,··"}</span>
      </div>
    </div>
  );
}

const words = (s: string) => normalizeName(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

/** Riadky bločku ↔ kúpené položky: najprv podľa produktu z katalógu, potom podľa slov názvu. */
function matchLines(lines: ReceiptItem[], bought: Item[], est: Estimator, names: Record<string, string>) {
  const used = new Set<string>();
  const map = new Map<string, Item>();
  for (const l of lines) {
    if (!l.product_id) continue;
    const it = bought.find((i) => !used.has(i.id) && est.resolve(i.name)?.members.some((p) => p.id === l.product_id));
    if (it) {
      used.add(it.id);
      map.set(l.id, it);
    }
  }
  for (const l of lines) {
    if (map.has(l.id)) continue;
    const text = normalizeName(`${names[l.product_id ?? ""] ?? ""} ${l.raw_name}`);
    const it = bought.find((i) => !used.has(i.id) && words(i.name).some((w) => text.includes(w.slice(0, Math.max(4, w.length - 2)))));
    if (it) {
      used.add(it.id);
      map.set(l.id, it);
    }
  }
  return map;
}

export function ScanScreen() {
  const { household } = useHousehold();
  const g = useTheme().style === "glass";
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const listId = params.get("nakup");
  const list = useLists(household.id).data?.find((l) => l.id === listId) ?? null;
  const trip = useTripItems(listId ?? undefined);
  const estimator = useEstimator(household.id);
  const upload = useUploadTripReceipt(household.id);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const rec = useReceipt(receiptId ?? undefined);
  const [img, setImg] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  useEffect(() => () => void (img && URL.revokeObjectURL(img)), [img]);

  const bought = (trip.data ?? []).filter((i) => i.status === "PURCHASED");
  const storeKey = storeKeyOf(list?.name);
  const status = rec.data?.receipt.status;
  const phase: "capture" | "reading" | "result" = !receiptId && !upload.isPending ? "capture" : status && status !== "PROCESSING" && status !== "FAILED" ? "result" : status === "FAILED" ? "capture" : "reading";

  // Kroky čítania: nahrávanie → čítanie na serveri → (po chvíli) výpočet cien.
  useEffect(() => {
    if (phase !== "reading") return;
    if (upload.isPending) return setStep(0);
    setStep(1);
    const tm = setTimeout(() => setStep(2), 5000);
    return () => clearTimeout(tm);
  }, [phase, upload.isPending]);
  useEffect(() => {
    if (status === "FAILED") setErr(failureText(rec.data?.receipt.error_text ?? null));
  }, [status, rec.data?.receipt.error_text]);

  const close = () => {
    if (phase === "reading") toast.show(t("sc.background"));
    if (listId) navigate(`/history/${listId}`, { replace: true });
    else navigate(-1);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PAGES);
    e.target.value = "";
    if (!files.length) return;
    setErr("");
    setReceiptId(null);
    setImg(URL.createObjectURL(files[0]!));
    upload.mutate(
      { listId, files, onRegistered: setReceiptId },
      {
        onSuccess: (o) => o === "DUPLICATE" && toast.show(t("sc.duplicate")),
        onError: (er) => {
          setReceiptId(null);
          setErr(readErrorMessage(er));
        },
      },
    );
  };
  const inputs = (
    <>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      <input ref={gal} type="file" accept="image/*,application/pdf" multiple hidden onChange={onPick} />
    </>
  );
  const listPaper = { store: storeName(storeKey) ?? list?.name ?? t("sc.shop"), date: "", lines: bought.slice(0, 6).map((i) => ({ raw: i.name.toUpperCase().slice(0, 14), t: null })), total: null };
  const lede = list ? t("sc.lede", { list: storeName(storeKey) && storeName(storeKey) !== list.name ? `${list.name} · ${storeName(storeKey)}` : list.name }) : t("sc.ledeNone");

  if (phase === "capture")
    return (
      <div className="bhm bhm-full">
        <div className="scr scan cap">
          {inputs}
          {g && <div className="cam" />}
          <header className="nb">
            <IB n="x" label={t("sc.close")} cls={g ? "wg" : ""} onClick={close} />
            <span className="nbt sh">{g ? "" : t("sc.nb")}</span>
            {g ? (
              <span className="pb sm wg">
                <I n="lightning" />
                Auto
              </span>
            ) : (
              <span className="ibs" />
            )}
          </header>
          <div className="capbody">
            {g ? (
              <div className="frame">
                <span className="cor tl" />
                <span className="cor tr" />
                <span className="cor bl" />
                <span className="cor br" />
                <Paper {...listPaper} />
              </div>
            ) : (
              <>
                <h1 className="lt">{t("sc.title")}</h1>
                <p className="meta">{lede}</p>
                <div className="papwrap">
                  <Paper {...listPaper} />
                </div>
              </>
            )}
          </div>
          <div className={`capfoot${g ? " glass2" : ""}`}>
            {err && (
              <p className="vnote" role="alert">
                <I n="warning-circle" />
                {err}
              </p>
            )}
            {g && <div className="t1 c">{t("sc.frameHint")}</div>}
            <Btn cls={`pri full big${g ? " a" : ""}`} onClick={() => cam.current?.click()}>
              <I n="camera" />
              {err ? t("sc.retry") : t("sp.photo")}
            </Btn>
            <Btn cls={`soft full${g ? " gl" : ""}`} onClick={() => gal.current?.click()}>
              <I n="image" />
              {t("sc.gallery")}
            </Btn>
          </div>
        </div>
      </div>
    );

  if (phase === "reading")
    return (
      <div className="bhm bhm-full">
        <div className="scr scan reading">
          {g && <div className="cam" />}
          <header className="nb">
            <IB n="x" label={t("sc.cancel")} cls={g ? "wg" : ""} onClick={close} />
            <span className="nbt sh">{t("sc.reading")}</span>
            <span className="ibs" />
          </header>
          <div className="capbody">
            <div className="frame rd">
              {img ? <img src={img} alt={t("sc.shot")} className="shot" /> : <Paper {...listPaper} />}
              <span className="scanl" />
            </div>
            <div className={`rsteps${g ? " glass2" : ""}`}>
              {[t("sc.step1"), t("sc.step2"), t("sc.step3")].map((s, i) => (
                <div key={s} className={i < step ? "dn" : i === step ? "now" : ""}>
                  {i < step ? <I n="check-circle" /> : <span className="sp" />}
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

  return <Result g={g} data={rec.data!} bought={bought} estimator={estimator} listStore={storeKey} listName={list?.name ?? null} onClose={close} />;
}

function Result({
  g,
  data,
  bought,
  estimator,
  listStore,
  listName,
  onClose,
}: {
  g: boolean;
  data: NonNullable<ReturnType<typeof useReceipt>["data"]>;
  bought: Item[];
  estimator: Estimator;
  listStore: string | null;
  listName: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { receipt: r, items: lines, products } = data;
  const map = useMemo(() => matchLines(lines, bought, estimator, products), [lines, bought, estimator, products]);
  const matched = lines.filter((l) => map.has(l.id));
  const extra = lines.filter((l) => !map.has(l.id));
  const missing = bought.filter((i) => ![...map.values()].includes(i));
  const est = matched.reduce((a, l) => a + (estimator.est(map.get(l.id)!, listStore)?.v ?? 0), 0);
  const paidL = matched.reduce((a, l) => a + Number(l.line_total), 0);
  const exSum = extra.reduce((a, l) => a + Number(l.line_total), 0);
  const total = r.total != null ? Number(r.total) : paidL + exSum;
  const ok = r.status === "OK" && (!extra.length || extra.every((x) => Number(x.line_total) < 3));
  const sk = storeKeyOf(r.store_name);
  const store = storeName(sk) ?? r.store_name ?? "";
  const d = paidL - est;

  const row = (l: ReceiptItem) => {
    const it = map.get(l.id);
    const e = it ? estimator.est(it, listStore) : null;
    const diff = e ? Number(l.line_total) - e.v : null;
    const kg = (l.unit ?? "").toLowerCase() === "kg";
    const q = Number(l.quantity);
    const up = l.unit_price != null ? Number(l.unit_price) : null;
    return (
      <div className="row" key={l.id}>
        <span className="th">
          <E k={estimator.emoji(it?.name ?? products[l.product_id ?? ""] ?? l.raw_name, l.category_id)} />
        </span>
        <div className="tx">
          <b>{it ? it.name : (products[l.product_id ?? ""] ?? l.raw_name)}</b>
          <span className="sub">
            {kg && up != null
              ? t("sc.perKg", { q: formatNumber(q, { maximumFractionDigits: 3 }), price: eur(up) })
              : q > 1 && up != null
                ? t("sc.times", { q: formatNumber(q), price: eur(up) })
                : l.raw_name}
          </span>
        </div>
        <div className="ra">
          <b className="lt2">{eur(Number(l.line_total))}</b>
          {diff != null && <span className={`diff${Math.abs(diff) < 0.05 || diff < 0 ? " good" : ""}`}>{Math.abs(diff) < 0.05 ? t("sc.exact") : signed(diff)}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="bhm bhm-full">
      <div className="scr scan res">
        {g && <div className="cam" />}
        <div className="sc">
          <header className="nb">
            <IB n="x" label={t("sc.close")} cls={g ? "wg" : ""} onClick={onClose} />
            <span className="nbt sh">{store}</span>
            <span className="ibs" />
          </header>
          <div className={`body${g ? " rsheet glass2" : ""}`}>
            <div className="reshead">
              {!g && <Paper store={store} date={`${shortDate(r.purchased_on)} ${r.purchased_time?.slice(0, 5) ?? ""}`} lines={lines.map((l) => ({ raw: l.raw_name, t: Number(l.line_total) }))} total={total} small />}
              <div className="grow">
                {g && (
                  <span className="okb">
                    <I n="check" w="bold" />
                  </span>
                )}
                <h1 className="lt">{ok ? t("sc.ok") : t("sc.check")}</h1>
                <div className="meta">{t("sc.matched", { m: matched.length, n: lines.length, date: shortDate(r.purchased_on) })}</div>
              </div>
            </div>
            <div className={`card match${g ? " mg" : ""}`}>
              <div>
                <div className="k">{t("sc.paid")}</div>
                <div className="price">{eur(total)}</div>
              </div>
              {est > 0 && (
                <div className="ra">
                  <div className="k">{t("sc.estWas")}</div>
                  <div className="price mut">~{est < 20 ? eur(est) : eur0(est)}</div>
                  <div className="meta sm">
                    {Math.abs(d) < 0.3 ? t("sc.almost") : d > 0 ? t("sc.dearer", { amount: eur(Math.abs(d)) }) : t("sc.cheaper", { amount: eur(Math.abs(d)) })}
                    {exSum ? t("sc.extraSum", { amount: eur(exSum) }) : ""}
                  </div>
                </div>
              )}
            </div>
            {matched.length > 0 && (
              <>
                <div className="group plain">
                  <span className="gl">{t("sc.realPrices")}</span>
                </div>
                <div className="lst">{matched.map(row)}</div>
              </>
            )}
            {extra.length > 0 && (
              <>
                <div className="group plain">
                  <span className="gl">{t("sc.extra")}</span>
                </div>
                <div className="lst">{extra.map(row)}</div>
              </>
            )}
            {missing.length > 0 && (
              <p className="vnote">
                <I n="info" />
                {t("sc.missing", { names: missing.map((i) => i.name).join(", ") })}
              </p>
            )}
            {!ok && (
              <Btn cls="soft full" onClick={() => navigate(`/receipts/${r.id}`)}>
                {t("sc.open")}
              </Btn>
            )}
          </div>
        </div>
        <div className="dock solo">
          <Btn
            cls={`pri full big${g ? " a" : ""}`}
            onClick={() => {
              onClose();
              toast.show(listName ? t("sc.saved", { name: listName }) : t("sc.savedNoList"), "success");
            }}
          >
            {t("sc.done")}
          </Btn>
        </div>
      </div>
    </div>
  );
}
