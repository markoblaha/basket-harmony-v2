/**
 * Doplniť veľkosť balenia – výrobky z bločkov bez veľkosti, ktorých druh sa porovnáva za kg / l.
 * Bez veľkosti nie sú v cene za jednotku; jedno ťuknutie ju uloží pre všetky staré aj budúce nákupy (set_product_size).
 * Návrhy veľkostí sú z iných výrobkov toho istého druhu, inak bežné balenia.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { formatNumber, t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, Back, useScrolled } from "@/mockup/ui";
import { emojiFor, eur } from "@/mockup/kit";
import { parseAmount, readErrorMessage } from "@/features/receipts/format";
import { useMissingSizes, useSetProductSize, type MissingSize } from "./api";

const fmt = (v: number, basis: "kg" | "l") => (v >= 1000 ? `${formatNumber(v / 1000, { maximumFractionDigits: 2 })} ${basis}` : `${formatNumber(v)} ${basis === "kg" ? "g" : "ml"}`);
const DEFAULTS = { kg: [100, 250, 500, 1000], l: [330, 500, 1000, 1500] } as const;

export function SizesPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const scrolled = useScrolled();
  const q = useMissingSizes(household.id);
  const items = q.data ?? [];
  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={t("mn.title")} onClick={() => navigate(-1)} />
            <span className={`nbt${scrolled ? " sh" : ""}`}>{t("mn.sizesTitle")}</span>
            <span className="ibs" />
          </header>
        </div>
      </div>
      <div className="bhm bhm-list">
        <div className="body">
          <div className="lhead">
            <span className="tile lg">
              <E k="tag" s={40} />
            </span>
            <div className="grow">
              <h1 className="lt">{t("mn.sizesTitle")}</h1>
              <div className="meta">{t("mn.sizesSub")}</div>
            </div>
          </div>
          {q.isPending ? (
            <Spinner />
          ) : q.isError ? (
            <ErrorState error={readErrorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : items.length === 0 ? (
            <div className={`card insight${g ? " glass2" : ""}`}>
              <span className="tile">
                <E k="sparkle" />
              </span>
              <div className="grow">
                <div className="ib-t">{t("mn.sizesDone")}</div>
                <div className="meta">{t("mn.sizesDoneD")}</div>
              </div>
            </div>
          ) : (
            items.map((x) => <SizeCard key={x.product_id} x={x} g={g} />)
          )}
        </div>
      </div>
    </>
  );
}

function SizeCard({ x, g }: { x: MissingSize; g: boolean }) {
  const toast = useToast();
  const save = useSetProductSize();
  const [custom, setCustom] = useState(false);
  const [val, setVal] = useState("");
  const opts = [...new Set([...(x.sizes ?? []).map(Number), ...DEFAULTS[x.basis]])].sort((a, b) => a - b).slice(0, 5);
  const unit = x.basis === "kg" ? "g" : "ml";
  const store = (v: number) =>
    save.mutate(
      { productId: x.product_id, value: v, unit },
      {
        onSuccess: () => toast.show(t("mn.sizeSaved", { size: fmt(v, x.basis), n: tn("mn.trips", x.buys) }), "success"),
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );
  return (
    <div className={`card an-fix${g ? " glass2" : ""}`}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="th">
          <E k={emojiFor(x.kind || x.name, x.category_id)} />
        </span>
        <div className="grow">
          <b>{[x.brand, x.name].filter(Boolean).join(" ")}</b>
          <small>
            {x.stores.join(", ")} · {eur(x.price)} · {tn("mn.trips", x.buys)}
          </small>
        </div>
      </div>
      <div className="meta sm">{t("mn.sizeAsk")}</div>
      <div className="chips wrap">
        {opts.map((v) => (
          <button type="button" key={v} className="chip plain" disabled={save.isPending} onClick={() => store(v)}>
            {fmt(v, x.basis)}
          </button>
        ))}
        <button type="button" className="chip plain" onClick={() => setCustom(!custom)}>
          {t("mn.sizeOther")}
        </button>
      </div>
      {custom && (
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseAmount(val);
            if (!n || n <= 0) return toast.show(t("pp.packInvalid"), "error");
            store(n);
          }}
        >
          <input id={`size-${x.product_id}`} inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder={t("mn.sizePh", { unit })} aria-label={t("mn.sizeAsk")} autoFocus />
          <button type="submit" className="m" aria-label={t("lm.save")}>
            <I n="check" w="bold" />
          </button>
        </form>
      )}
    </div>
  );
}
