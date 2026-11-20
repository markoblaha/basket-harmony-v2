# Kontrola prekladu proti zdroju + príprava SQL pre knihu (šarža 4). Použitie: build18.py <data dir> <repo>
import sys, json, re, collections, unicodedata
D, REPO = sys.argv[1], sys.argv[2]
sys.path.insert(0, REPO + "/tools/kniha"); from parse import parse, FOODS, APP
src = {r["url"]: r for r in json.load(open(D + "/vybrane.json"))}
tr = json.load(open(D + "/preklad18a.json")) + json.load(open(D + "/preklad18b.json"))
norm = lambda s: re.sub(r"[\s ]+", " ", s).strip()
nums = lambda s: collections.Counter(x.replace(",", ".").rstrip("0").rstrip(".") if "." in x.replace(",", ".") else x for x in re.findall(r"\d+(?:[.,]\d+)?", s))
fold = lambda s: unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
BASE = {"kg": ("g", 1000), "dkg": ("g", 10), "g": ("g", 1), "l": ("ml", 1000), "dl": ("ml", 100), "ml": ("ml", 1), "pack": ("bal", 1), "hrnek": ("hrncek", 1),
        "vetvicka": ("ks", 1), "zvazok": ("ks", 1), "zrnko": ("ks", 1)}
CZ = re.compile(r"[řěůŘĚŮ]|\b(brambor\w*|smetan\w*|mouk\w*|máslo|másla|vejce|pepř|jíšk\w*|kmín\w*|zelí|lžíc\w*|lžič\w*|hrnek|troub\w*)\b", re.I)
report, rows = [], []
for t in tr:
    s = src[t["url"]]; bad = []
    groups = set(t.get("group_lines", [])) | set(t.get("groups_src", {}))
    s_ing = [norm(x) for x in s["ing_list"] if norm(x) and norm(x) not in groups and not norm(x).endswith(":")]
    t_ing = [norm(i["orig"]) for i in t["ingredients"] if not i.get("added")]
    if s_ing != t_ing:
        bad.append(f"suroviny nesedia so zdrojom: chýba {[x for x in s_ing if x not in t_ing][:3]} navyše {[x for x in t_ing if x not in s_ing][:3]}")
    for i in t["ingredients"]:
        p = parse(i["orig"]); u, q = i["unit"], i["qty"]
        if p["qty"] is None:
            if u not in ("podla_chuti", "podla_potreby") and not (u in ("stipka", "ks") and q == 1): bad.append(f"množstvo bez zdroja: {i['orig']} → {q} {u}")
        else:
            bu, f = BASE.get(p["unit"] or "ks", (p["unit"] or "ks", 1))
            if bu != u or abs(p["qty"] * f - q) > 1e-6: bad.append(f"množstvo: {i['orig']} → zdroj {p['qty']} {p['unit']} = {p['qty']*f} {bu}, preklad {q} {u}")
        for txt in (i["sk"], i.get("note", "")):
            if CZ.search(txt): bad.append(f"české slovo v surovine: {txt}")
    drop = set(t.get("drop_steps", []))
    s_steps = [norm(x) for x in s["steps_list"] if norm(x) and norm(x) not in drop]
    s_text = " ".join(s_steps)
    for r in t.get("removed", []):
        if norm(r) not in s_text: bad.append(f"odstránený text nie je v zdroji: {r[:40]}")
        s_text = s_text.replace(norm(r), " ")
    if nums(s_text) != nums(" ".join(t["steps"])):
        a, b = nums(s_text), nums(" ".join(t["steps"]))
        bad.append(f"čísla v postupe: chýba {dict(a - b)} navyše {dict(b - a)}")
    for st in t["steps"]:
        if CZ.search(st): bad.append(f"české slovo v kroku: {CZ.search(st).group(0)} | {st[:50]}")
    if t.get("copy"):
        mine = [norm(re.sub(r"^(" + "|".join(map(re.escape, drop)) + r"): ", "", x)) for x in t["steps"]]
        theirs = [x for x in s_steps if all(norm(r) != x for r in t.get("removed", []))]
        if mine != theirs: bad.append(f"kópia nesedí: {[x[:40] for x in mine if x not in theirs][:2]}")
    report.append((t["id"], bad))
    ings = []
    for i in t["ingredients"]:
        p = parse(i["orig"]); k = APP.get(p["key"], p["key"]) if p["key"] else None
        key = k if k and k in FOODS and not str(k).startswith("SKIP") else "x_" + re.sub(r"[^a-z0-9]+", "_", fold(i["sk"]))[:30].strip("_")
        ing = {"food": key, "qty": i["qty"], "unit": i["unit"], "label": i["sk"], "orig": i["orig"] if not i.get("added") else ""}
        for f in ("group", "note"):
            if i.get(f): ing[f] = i[f]
        ings.append(ing)
    rows.append({"t": t, "s": s, "ings": ings})
ok = sum(1 for _, b in report if not b)
for id, b in report: print(("OK        " if not b else "PROBLÉM   ") + id + ("" if not b else "\n           " + "\n           ".join(b[:6])))
print(f"\nprešlo {ok} z {len(report)}")
json.dump(rows, open(D + "/rows18.json", "w"), ensure_ascii=False)
