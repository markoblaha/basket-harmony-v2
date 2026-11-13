/**
 * „V obchode X by to vyšlo lacnejšie“ pod odhadom zoznamu (13. 11. 2026). Porovnáva len položky s čerstvou cenou
 * bez akcie v oboch obchodoch (compareStores); ťuk otvorí rozpis po položkách. Zoznam sa nemení – obchod zoznamu
 * je podľa jeho názvu.
 */
import { useMemo, useState } from "react";
import { t, tn } from "@/i18n";
import { E, I } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { StoreTile, eur, storeKeyOf, storeName } from "@/mockup/kit";
import type { Item } from "./api";
import type { Estimator } from "./estimate";
import { compareStores } from "./itemCatalog";

const nameOf = (k: string) => storeName(k) ?? k.charAt(0).toUpperCase() + k.slice(1);

export function StoreCompareTip({ items, estimator, storeKey, gl }: { items: Item[]; estimator: Estimator; storeKey: string | null; gl: string }) {
  const [open, setOpen] = useState(false);
  const res = useMemo(
    () => (storeKey && estimator.catalog && items.length >= 2 ? compareStores(items, estimator.resolve, storeKey, storeKeyOf) : []),
    [items, estimator, storeKey],
  );
  if (!storeKey || !res.length) return null;
  const best = res[0]!;
  const cheaper = best.diff >= 0.5;
  const here = nameOf(storeKey);
  return (
    <>
      <button type="button" className={`card insight tapc${gl}`} onClick={() => setOpen(true)}>
        <span className="tile">
          <E k={cheaper ? "moneybag" : "coin"} />
        </span>
        <div className="grow">
          <div className="ib-t">{cheaper ? t("li.cmpCheaper", { store: nameOf(best.key), amount: eur(best.diff) }) : t("li.cmpBest", { store: here })}</div>
          <div className="meta">{cheaper ? t("li.cmpCheaperD", { n: best.n, total: items.length }) : t("li.cmpBestD")}</div>
        </div>
        <I n="caret-right" w="bold" cls="chev" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={t("li.cmpTitle")}>
        <div className="sh-head">
          <div className="grow">
            <h2>{t("li.cmpTitle")}</h2>
            <div className="meta">{t("li.cmpSub", { store: here })}</div>
          </div>
        </div>
        <div className="sh-body">
          <div className="lst">
            {res.map((c) => (
              <div className="row" key={c.key}>
                <StoreTile k={c.key} n={nameOf(c.key)} s={40} />
                <div className="tx">
                  <b>{nameOf(c.key)}</b>
                  <span className="sub">{tn("li.cmpItems", c.n)}</span>
                </div>
                <div className="an-r">
                  <b className="amt">{c.diff >= 0.005 ? `−${eur(c.diff)}` : c.diff <= -0.005 ? `+${eur(-c.diff)}` : t("li.cmpSame")}</b>
                  <span className={`an-tag ${c.diff >= 0.005 ? "good" : c.diff <= -0.005 ? "up" : "mu"}`}>{c.diff >= 0.005 ? t("li.cmpLess") : c.diff <= -0.005 ? t("li.cmpMore") : t("li.cmpSame")}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="h2 sm">{t("li.cmpLines", { a: here, b: nameOf(best.key) })}</div>
          <div className="lst">
            {best.lines.map((l) => (
              <div className="row" key={l.name}>
                <span className="th">
                  <E k={estimator.emoji(l.name)} />
                </span>
                <div className="tx">
                  <b>{l.name}</b>
                </div>
                <div className="an-r">
                  <b className="amt">{eur(l.there)}</b>
                  <span className="sub">
                    {here} {eur(l.here)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="vnote">
            <I n="info" />
            {t("li.cmpNote")}
          </p>
        </div>
      </Sheet>
    </>
  );
}
