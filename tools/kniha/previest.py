# Prevod AI prepisu (data/out + data/in) do tvaru receptu appky → data/db/<šarža>.json, ktorý nahrá nahraj.py.
# Použitie: previest.py <šarža> <id> [id ...]   (recept, ktorý neprešiel overit.py, dostane stav quarantine)
import os, sys, json, re, subprocess
from pathlib import Path
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data")); os.chdir(DATA)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from parse import parse, fold, APP, FOODS
META = {  # id → (kategória, mäso, riadok pre obrázok šarže)
 "hrachova": ("polievky", "bravcove"), "bramborova": ("polievky", "bez"), "bramborovy_gulas": ("hlavne", "kuracie"), "lasagne": ("cestoviny", "hovadzie"),
 "buchty": ("sladke", "bez"), "tvarohovy_kolac": ("sladke", "bez"), "jablkovy_kolac": ("sladke", "bez"), "zemiakova_kasa": ("hlavne", "bez"), "gulasovka": ("polievky", "hovadzie")}
batch, ids = int(sys.argv[1]), sys.argv[2:]
out, rep = [], []
for id in ids:
    i = json.load(open(f"in/{id}.json")); w = i["winner"]; o = json.load(open(f"out/{id}.json"))
    bad = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "overit.py"), id], capture_output=True, text=True, env=os.environ).stdout
    ok = bad.startswith("OK")
    ings = []
    for x in o["ingredients"]:
        p = parse(x["orig"]); k = APP.get(p["key"], p["key"]) if p["key"] else None
        known = bool(k) and k in FOODS and not str(k).startswith("SKIP")
        key = k if known else "x_" + re.sub(r"[^a-z0-9]+", "_", fold(x["name_sk"]))[:30].strip("_")
        ing = {"food": key, "qty": x["qty"] or 0, "unit": x["unit"], "label": x["name_sk"]}
        if x.get("note"): ing["note"] = x["note"]
        ings.append(ing)
    m = re.search(r"PT(?:(\d+)H)?(?:(\d+)M)?", w.get("time") or ""); mins = (int(m.group(1) or 0) * 60 + int(m.group(2) or 0)) if m else 0
    steps = [{"text": s["sk"], "timerMin": None, "src": "A"} for s in o["steps"]]
    srcs = sorted(i["compared"], key=lambda r: -int(r.get("count") or 0)); letters = {}
    for n, r in enumerate(srcs): letters[r["url"]] = "ABCDEFGHIJKLMNOPQRST"[n % 20]
    sources = [{"k": letters[r["url"]], "site": r["site"], "name": r["name"], "url": r["url"], **({"rating": float(r["rating"])} if r.get("rating") else {}), **({"votes": int(r["count"])} if r.get("count") else {})} for r in srcs[:20]]
    steps = [{**s, "src": letters[w["url"]]} for s in steps]
    cat, meat = META[id]
    out.append({"id": id, "name": o["name_sk"], "category": cat, "meat": meat, "minutes": mins or 45, "difficulty": 2, "portions": o.get("portions") or 4, "tags": [], "ingredients": ings, "steps": steps,
        "book": {"photos": 1, "batch": batch, "active": mins or 45, "cuisine": "Česko · Slovensko", "tools": [], "store": "", "portionsGuess": not o.get("portions"), "sources": sources,
                 "verification": {"kind": "light", "compared": len(sources), "anchor": letters[w["url"]], "translation_check": "ok" if ok else bad.strip(), "unmapped": [x["food"] for x in ings if x["food"].startswith("x_")]},
                 "_status": "published" if ok else "quarantine"}})
    rep.append((id, "ok" if ok else "KARANTÉNA"))
Path("db").mkdir(exist_ok=True); json.dump(out, open(f"db/sarza{batch}.json", "w"), ensure_ascii=False, indent=1)
print(rep)
