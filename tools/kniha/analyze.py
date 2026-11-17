# Výber najlepšieho skutočného receptu: porovnanie všetkých receptov toho istého variantu, potom víťaz =
# recept z hlavného webu s najviac hodnoteniami, ktorý prejde kontrolou (štruktúra, suroviny väčšiny,
# bežné množstvá, úkony väčšiny). Výsledok: out/<jedlo>.json + prehľad na výstupe.
import os
from pathlib import Path
# Pracovné dáta (zoznamy adries z webov, stiahnuté recepty, výsledky) nie sú v gite: priečinok KNIHA_DATA (predvolene tools/kniha/data).
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
os.chdir(DATA)
import json, re, sys, os
from parse import parse, fold
from rules import R

MAIN = {"apetitonline.cz", "vareni.cz", "toprecepty.cz"}
SK = {"recepty.aktuality.sk", "receptar.sk"}

def portions(y):
    if y is None: return None
    if isinstance(y, list): y = " ".join(map(str, y))
    t = fold(str(y))
    m = re.search(r"(\d+)\s*(?:-\s*\d+\s*)?(porc|osob|porci|lid|ks|kus|kous|dil|rez)", t) or re.search(r"pro\s*(\d+)", t)
    if m: n = int(m.group(1)); return n if n >= 1 else None
    m = re.fullmatch(r"\s*(\d+)\s*", t)
    if m and int(m.group(1)) >= 2: return int(m.group(1))
    return None

def pct(xs, p):
    xs = sorted(xs); i = (len(xs) - 1) * p; lo = int(i)
    return xs[lo] + (xs[min(lo + 1, len(xs) - 1)] - xs[lo]) * (i - lo)

def row_of(cfg, key):
    for name, keys in cfg.get("rows", {}).items():
        if key in keys: return name
    return key

def analyze(dish):
    cfg = R[dish]
    data = json.load(open(f"raw/{dish}.json"))
    recs = []
    for i, r in enumerate(data):
        items = [parse(l) for l in r["ing"]]
        items = [x for x in items if x["key"] != "SKIP_head"]
        keys = {x["key"] for x in items if x["key"]}
        rows = {}
        for x in items:
            if not x["key"] or x["key"].startswith("SKIP"): continue
            if x["key"] in cfg.get("ignore", ()): continue
            rn = row_of(cfg, x["key"])
            g = None if x.get("serve") else x["g"]
            cur = rows.get(rn)
            rows[rn] = (cur or 0) + (g or 0) if (g is not None or cur) else (cur if cur is not None else 0)
            if g is None and rn not in rows: rows[rn] = 0
        serve_rows = {row_of(cfg, x["key"]) for x in items if x["key"] and x.get("serve")} - {row_of(cfg, x["key"]) for x in items if x["key"] and not x.get("serve")}
        text = fold(" ".join(r["steps"]))
        acts = {a for a, p in cfg["acts"].items() if re.search(p, text)}
        por = portions(r.get("yield"))
        why = []
        rowkeys = set(rows)
        for m in cfg.get("must", []):
            if not (set(m.split("|")) & (keys | rowkeys)): why.append(f"chýba {m}")
        for f in cfg.get("forbid", []):
            if f in keys: why.append(f"má {f}")
        for p in cfg.get("forbid_name", []):
            if re.search(p, fold(r["name"])): why.append(f"názov {p}")
        recs.append(dict(i=i, r=r, items=items, rows=rows, serve_rows=serve_rows, acts=acts, por=por, variant=not why, why=why))
    # porovnáva sa s 20 najhodnotenejšími receptmi toho istého variantu (11–20 podľa zadania)
    same = sorted([x for x in recs if x["variant"]], key=lambda x: (-(int(x["r"].get("count") or 0)), -(float(x["r"].get("rating") or 0)), x["i"]))[:20]
    keep = {x["i"] for x in same}
    for x in recs:
        if x["variant"] and x["i"] not in keep: x["variant"] = False; x["why"] = ["mimo 20 najhodnotenejších"]
    # voda/vývar len v postupe (nie v zozname) = tekutina je
    for x in same:
        if "tekutina" in cfg.get("rows", {}) and "tekutina" not in x["rows"] and re.search(r"\bvod[uaoy]|vodou|vyvar|zalij|zalej|podlij|podlej", fold(" ".join(x["r"]["steps"]))):
            x["rows"]["tekutina"] = 0
    n = len(same)
    whole = cfg.get("whole", False)
    base = cfg.get("base")
    def amount(x, k):
        v = x["rows"].get(k)
        if not v: return None
        if base:
            b = x["rows"].get(base)
            return v / b * 100 if b else None
        if whole: return v
        return v / x["por"] if x["por"] else None
    # podiel a bežné rozpätie na porciu (alebo na celý recept pri pečení)
    allrows = sorted({k for x in same for k in x["rows"]})
    stats = {}
    for k in allrows:
        have = [x for x in same if k in x["rows"]]
        per = [v for v in (amount(x, k) for x in have) if v is not None]
        stats[k] = dict(share=len(have) / n, n=len(have), q=len(per),
                        lo=pct(per, .2) if len(per) >= 4 else None, hi=pct(per, .8) if len(per) >= 4 else None,
                        min=min(per) if per else None, max=max(per) if per else None, med=pct(per, .5) if per else None)
    core = [k for k, s in stats.items() if s["share"] > 0.5]
    acts_major = [a for a in cfg["acts"] if sum(a in x["acts"] for x in same) / n > 0.5]
    for x in recs:
        prob = []
        if not x["variant"]: x["ok"] = False; x["prob"] = x["why"]; continue
        if x["r"]["site"] not in MAIN | (SK if cfg.get("sk") else set()): prob.append("web len na porovnanie")
        if not whole and not x["por"]: prob.append("bez porcií")
        bad = [it["text"] for it in x["items"] if it["key"] is None or it["key"].startswith("SKIP_h")]
        if bad: prob.append("nečitateľné: " + "; ".join(bad[:3]))
        noq = [it["text"] for it in x["items"] if it["key"] and not it["key"].startswith("SKIP") and it["g"] is None and not it.get("serve")
               and it["key"] not in cfg.get("free_q", ()) and it["key"] not in ("sol", "korenie", "voda", "korenie_cele", "petrzlenova_vnat", "pazitka", "kopor", "majoran", "rasca", "tymian", "muskat", "chilli", "nove_korenie", "bobkovy_list", "oregano")]
        if noq: prob.append("bez množstva: " + "; ".join(noq[:3]))
        if len(x["r"]["steps"]) < 2 or len(" ".join(x["r"]["steps"])) < 200: prob.append("krátky postup")
        miss = [k for k in core if k not in x["rows"] and k not in ("sol", "korenie")]
        dev = []
        for k, s in stats.items():
            v = amount(x, k)
            if k != base and s["lo"] is not None and v is not None and s["med"] < 1.0 and v > 3 * s["hi"]:
                dev.append(f"{k} {v:.1f} (bežne {s['lo']:.1f}–{s['hi']:.1f}, priveľa)")
            elif k != base and s["lo"] is not None and v is not None and s["med"] >= 1.0:
                if v < s["lo"] * 0.999 or v > s["hi"] * 1.001: dev.append(f"{k} {v:.0f} (bežne {s['lo']:.0f}–{s['hi']:.0f})")
        rare = [k for k in x["rows"] if stats[k]["share"] < 0.3 and k not in cfg.get("free_q", ())]
        am = [a for a in acts_major if a not in x["acts"]]
        unq = [k for k in core if k in x["rows"] and not x["rows"][k] and k not in x["serve_rows"] and k not in ("sol", "korenie", "korenie_cele", "tekutina") and k not in cfg.get("free_q", ())
               and not (stats[k]["med"] is not None and stats[k]["med"] < 1.0)]
        if unq: prob.append("väčšinová bez množstva: " + ", ".join(unq))
        if len(miss) > 1: prob.append("chýba väčšinová: " + ", ".join(miss))
        if len(dev) > 1: prob.append("mimo bežného: " + "; ".join(dev))
        if len(am) > len(acts_major) // 2: prob.append("chýbajú úkony: " + ", ".join(am))
        x.update(miss=miss, dev=dev, rare=rare, am=am, ok=not prob, prob=prob)
    ranked = sorted([x for x in recs if x["variant"]], key=lambda x: (-(int(x["r"].get("count") or 0)), -(float(x["r"].get("rating") or 0))))
    win = next((x for x in ranked if x["ok"]), None)
    return dict(cfg=cfg, recs=recs, same=same, stats=stats, core=core, acts_major=acts_major, ranked=ranked, win=win)

def report(dish, A):
    if A["cfg"].get("base"): print(f"\n   (množstvá na 100 g: {A['cfg']['base']})", end="")
    print(f"\n######## {dish}: {len(A['recs'])} receptov, variant {len(A['same'])}, väčšinové suroviny: {', '.join(A['core'])}")
    print("   úkony väčšiny:", ", ".join(A["acts_major"]))
    for k, s in sorted(A["stats"].items(), key=lambda kv: -kv[1]["share"]):
        rng = f"{s['lo']:.0f}–{s['hi']:.0f} (med {s['med']:.0f}, z {s['q']})" if s["lo"] is not None else (f"z {s['q']}" if s["q"] else "")
        print(f"   {k:22} {s['share']*100:3.0f} %  {rng}")
    print("   --- poradie podľa hodnotení")
    for x in A["ranked"][:14]:
        r = x["r"]
        print(f"   {'✔' if x['ok'] else '✘'} [{x['i']:2}] {r['site']:20} {r['name'][:40]:40} ★{float(r['rating'] or 0):.1f} ({r['count']}) porcie {x['por']} | {' / '.join(x['prob'])[:220]}")
    out = [x for x in A["recs"] if not x["variant"]]
    if out: print("   mimo variantu:", "; ".join(f"[{x['i']}] {x['r']['name'][:30]} ({', '.join(x['why'])})" for x in out))
    w = A["win"]
    print("   VÍŤAZ:", f"[{w['i']}] {w['r']['name']} – {w['r']['url']}" if w else "žiadny (karanténa)")

if __name__ == "__main__":
    os.makedirs("out", exist_ok=True)
    for dish in sys.argv[1:]:
        A = analyze(dish)
        report(dish, A)
        w = A["win"]
        json.dump(dict(win=w and {**{k: w[k] for k in ("i", "por", "miss", "dev", "rare", "am")}, "acts": sorted(w["acts"]), "rows": w["rows"], "r": w["r"]},
                       stats=A["stats"], core=A["core"], acts_major=A["acts_major"],
                       same=[dict(i=x["i"], url=x["r"]["url"], site=x["r"]["site"], name=x["r"]["name"], por=x["por"], rows=x["rows"], acts=sorted(x["acts"]),
                                  rating=x["r"]["rating"], count=x["r"]["count"]) for x in A["same"]]),
                  open(f"out/{dish}.json", "w"), ensure_ascii=False, indent=1)
