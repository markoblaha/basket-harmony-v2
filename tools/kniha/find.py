# Kandidáti pre jedlo: adresy receptov z hlavných webov (a porovnávacích), ktorých adresa zodpovedá vzoru.
import os
from pathlib import Path
# Pracovné dáta (zoznamy adries z webov, stiahnuté recepty, výsledky) nie sú v gite: priečinok KNIHA_DATA (predvolene tools/kniha/data).
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
os.chdir(DATA)
import json, re, sys, unicodedata
SP=str(DATA)+"/"
def fold(s): return unicodedata.normalize("NFKD", s.lower()).encode("ascii","ignore").decode()
SITES={"apetit":r"/recept/","toprecepty":r"/recept/\d+","vareni":r"/recepty/[^/]+/?$","labuznik":r"/recept/"}
pat=re.compile(sys.argv[1]); neg=re.compile(sys.argv[2]) if len(sys.argv)>2 and sys.argv[2] else None
out={}
for s,p in SITES.items():
    us=[u for u in json.load(open(SP+f"idx_{s}.json")) if re.search(p,u)]
    seen=set(); hits=[]
    for u in us:
        f=fold(u).split("?")[0].rstrip("/")
        slug=f.split("/")[-1]
        if f in seen or not pat.search(slug) or (neg and neg.search(slug)): continue
        seen.add(f); hits.append(u)
    out[s]=hits
rk=[u for u in open(SP+"receptar_urls.txt").read().split() if pat.search(fold(u).split("/")[-1].split("?")[0]) and not (neg and neg.search(fold(u)))]
out["receptar"]=list(dict.fromkeys(rk))
for s,h in out.items():
    print(f"## {s}: {len(h)}")
    for u in h[:int(sys.argv[3]) if len(sys.argv)>3 else 40]: print("  ",u)
