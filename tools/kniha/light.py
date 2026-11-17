# Ľahký výber: názov jedla → adresy z 3 hlavných webov → stiahnuť do 12 → víťaz (najviac hodnotení, ★≥4, 10+ hodnotení,
# väčšina surovín s množstvom, aspoň 3 kroky) → data/in/<id>.json (vstup pre AI prepis). Použitie: light.py id "regex slugu" [id "regex"...]
import os, sys, json, re, unicodedata
from pathlib import Path
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data")); DATA.mkdir(parents=True, exist_ok=True); os.chdir(DATA)
src = open(Path(__file__).resolve().parent / "fetch.py").read().split("dish=sys.argv[1]")[0].replace("Path(__file__).resolve().parent", "DATA")
g = {"__file__": str(Path(__file__)), "__name__": "f", "DATA": DATA}; exec(src, g); one = g["one"]
import time
fold = lambda s: unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
SITES = {"apetit": r"apetitonline\.cz/recept/", "toprecepty": r"toprecepty\.cz/recept/\d+", "vareni": r"vareni\.cz/recepty/[^/]+/?$"}
idx = {s: [u for u in json.load(open(DATA / f"idx_{s}.json")) if re.search(p, u)] for s, p in SITES.items()}
os.makedirs("in", exist_ok=True)
a = sys.argv[1:]
for did, pat in zip(a[0::2], a[1::2]):
    P = re.compile(pat); cands = []
    for s, us in idx.items():
        hs = sorted({u for u in us if P.search(re.sub(r"^\d+-", "", fold(u).rstrip("/").split("/")[-1]))}, key=lambda u: len(u))[:5]
        cands += hs
    recs = []
    for u in cands:
        try: r = one(u)
        except Exception: r = None
        if r: recs.append(r)
        time.sleep(0.4)
    def ok(r):
        n = len(r["ing"]); q = sum(bool(re.match(r"\s*[\d½¼¾]", i)) for i in r["ing"])
        return r.get("rating") and float(r["rating"]) >= 4 and int(r.get("count") or 0) >= 10 and n >= 4 and q / n >= .6 and len(r["steps"]) >= 3
    good = sorted([r for r in recs if ok(r)], key=lambda r: -int(r["count"]))
    if good: json.dump({"id": did, "winner": good[0], "compared": [{k: r[k] for k in ("site", "name", "url", "yield", "rating", "count")} for r in recs]}, open(f"in/{did}.json", "w"), ensure_ascii=False, indent=1)
    print(did, "kandidátov", len(recs), "víťaz:", (good[0]["name"], good[0]["site"], good[0]["count"]) if good else "žiadny")
