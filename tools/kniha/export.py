# Export porovnania pre appku: zdroje (písmená podľa počtu hodnotení), riadky surovín (gramy na celý recept zdroja),
# úkony (ktoré zdroje ich robia, krok víťaza). Výstup: TS dáta do src/features/recipes/kniha-porovnanie.ts.
import os
from pathlib import Path
# Pracovné dáta (zoznamy adries z webov, stiahnuté recepty, výsledky) nie sú v gite: priečinok KNIHA_DATA (predvolene tools/kniha/data).
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
os.chdir(DATA)
import json, re, sys, string
from analyze import analyze, row_of
from parse import fold, FOODS
from rules import R

# Názvy zlúčených riadkov porovnania (riadok = viac potravín z rules.py).
LABEL = {"muka": "Múka", "tuk": "Tuk (olej, masť, maslo)", "smotana": "Smotana", "tekutina": "Tekutina (voda, vývar)", "maso": "Mäso",
         "kura": "Kuracie mäso", "syr": "Syr", "slanina": "Slanina / pancetta", "vajce": "Vajcia a žĺtky", "cukor": "Cukor",
         "zelenina": "Koreňová zelenina", "majoneza": "Majonéza a tatárska omáčka", "huby": "Huby", "omacka": "Paradajky (pretlak, pasírované)",
         "pecivo": "Pečivo a strúhanka", "mlieko": "Mlieko (alebo voda)", "ovocie": "Ovocie", "ovocie_suche": "Hrozienka a orechy",
         "kypridlo": "Kypridlo (droždie, prášok)", "zemiaky": None}
APPKEY = {"cream_cheese": "kremovy_syr", "syr_tvrdy": "eidam", "guanciale": "slanina", "zemiaky_varene": "zemiaky", "salama": "salama"}
KEEP_STEPS = {"palacinky": 3, "lievance": 3}  # ďalšie „kroky“ zdroja sú poznámky a tipy, nie postup
BASE_APP = {"cream_cheese": "kremovy_syr"}

def ts(v): return json.dumps(v, ensure_ascii=False)

def export(dish):
    A = analyze(dish); cfg = R[dish]; w = A["win"]
    same = A["same"]  # zoradené podľa počtu hodnotení
    L = {x["i"]: string.ascii_uppercase[k] for k, x in enumerate(same)}
    anchor = L[w["i"]]
    src = [dict(k=L[x["i"]], site=x["r"]["site"], name=x["r"]["name"], url=x["r"]["url"], portions=x["por"],
                rating=round(float(x["r"]["rating"]), 2) if x["r"].get("rating") else None, votes=int(x["r"]["count"]) if x["r"].get("count") else None) for x in same]
    rows = []
    for k, st in sorted(A["stats"].items(), key=lambda kv: -kv[1]["share"]):
        if st["share"] < 0.25 and k not in w["rows"]: continue
        keys = cfg.get("rows", {}).get(k, [k])
        foods = "+".join(dict.fromkeys(APPKEY.get(x, x) for x in keys))
        label = LABEL.get(k) if k in cfg.get("rows", {}) else None
        v = {L[x["i"]]: round(x["rows"][k], 1) if x["rows"][k] else 0 for x in same if k in x["rows"]}
        rows.append(dict(foods=foods, unit="g", v=v, **({"label": label} if label else {})))
    nsteps = KEEP_STEPS.get(dish, len(w["r"]["steps"]))
    steps = [fold(s) for s in w["r"]["steps"][:nsteps]]
    acts = []
    for a, pat in cfg["acts"].items():
        letters = "".join(L[x["i"]] for x in same if a in x["acts"])
        at = next((i + 1 for i, s in enumerate(steps) if re.search(pat, s)), None)
        acts.append(dict(a=a, src=letters, **({"step": at} if at else {})))
    base = cfg.get("base")
    out = dict(anchor=anchor, sources=src, rows=rows, acts=acts, whole=bool(cfg.get("whole")),
               base=BASE_APP.get(base, base) if base else None)
    return out

if __name__ == "__main__":
    dishes = sys.argv[1:]
    lines = ["/*", " * Porovnanie receptov skúšobnej šarže 1 – vygenerované nástrojom výberu (tools/kniha/export.py), needitovať ručne.",
             " * Pre každé jedlo: 11–20 najhodnotenejších receptov toho istého variantu (písmená podľa počtu hodnotení),",
             " * množstvá surovín v gramoch na celý recept zdroja (0 = má, bez množstva), úkony postupu a kotva (víťaz).", " */",
             'import type { BookCheck, BookInfo } from "./types";', "",
             "export type Compare = { sources: (BookInfo[\"sources\"][number] & { portions?: number | null })[]; check: Omit<BookCheck, \"portions\" | \"changes\"> };", "",
             "export const COMPARE: Record<string, Compare> = {"]
    for d in dishes:
        o = export(d)
        check = {"anchor": o["anchor"], "rows": o["rows"], "acts": o["acts"]}
        if o["whole"]: check["whole"] = True
        if o["base"]: check["base"] = o["base"]
        lines.append(f"  {ts(d)}: {{")
        lines.append("    sources: [")
        for s in o["sources"]:
            s = {k: v for k, v in s.items() if v is not None}
            lines.append(f"      {ts(s)},")
        lines.append("    ],")
        lines.append(f"    check: {ts(check)},")
        lines.append("  },")
        print(d, "kotva", o["anchor"], "zdrojov", len(o["sources"]), "riadkov", len(o["rows"]), "úkony", [(a["a"], len(a["src"]), a.get("step")) for a in o["acts"]], file=sys.stderr)
    lines.append("};")
    open(Path(__file__).resolve().parents[2] / "src/features/recipes/kniha-porovnanie.ts", "w").write("\n".join(lines) + "\n")
