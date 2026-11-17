# Stiahne recepty (schema.org Recipe v JSON-LD) pre jedlo z loose.json do raw/<jedlo>.json; každý web vo vlastnom vlákne, slušne pomaly.
import os
from pathlib import Path
# Pracovné dáta (zoznamy adries z webov, stiahnuté recepty, výsledky) nie sú v gite: priečinok KNIHA_DATA (predvolene tools/kniha/data).
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
os.chdir(DATA)
import sys, json, re, html, urllib.request, urllib.parse, time, os, threading
UA="Mozilla/5.0 (compatible; BasketHarmonyRecipeCheck/0.1)"
def get(u):
    req=urllib.request.Request(urllib.parse.quote(u,safe=':/?=&%#'),headers={"User-Agent":UA,"Accept-Language":"sk,cs;q=0.9"})
    with urllib.request.urlopen(req,timeout=25) as r: return r.read().decode("utf-8","replace")
def recipes(o):
    if isinstance(o,list):
        for x in o: yield from recipes(x)
    elif isinstance(o,dict):
        t=o.get("@type"); t=t if isinstance(t,list) else [t]
        if "Recipe" in t: yield o
        for k in ("@graph","mainEntity"):
            if k in o: yield from recipes(o[k])
def steps(ins):
    out=[]
    if isinstance(ins,str): return [x for x in re.split(r"\n+|<br\s*/?>|</p>",ins) if x.strip()]
    for x in ins or []:
        if isinstance(x,str): out.append(x)
        elif x.get("@type")=="HowToSection": out+=steps(x.get("itemListElement"))
        else: out.append(x.get("text",""))
    return out
clean=lambda s: re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",html.unescape(str(s)))).strip()
def one(u):
    s=get(u)
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',s,re.S|re.I):
        raw=m.group(1).strip()
        for txt in (raw, html.unescape(raw), re.sub(r"[\x00-\x1f]"," ",raw)):
            try: d=json.loads(txt); break
            except Exception: d=None
        if d is None: continue
        for r in recipes(d):
            if r.get("recipeIngredient"):
                rat=r.get("aggregateRating") or {}
                return {"url":u,"site":urllib.parse.urlparse(u).netloc.replace("www.",""),"name":clean(r.get("name")),
                  "yield":r.get("recipeYield"),"time":r.get("totalTime"),"rating":rat.get("ratingValue"),"count":rat.get("ratingCount") or rat.get("reviewCount"),
                  "ing":[clean(i) for i in r.get("recipeIngredient",[]) if clean(i)],"steps":[clean(t) for t in steps(r.get("recipeInstructions")) if clean(t)]}
    return micro(u, s)

def micro(u, s):
    """Recept v microdata (itemprop, napr. Receptár.sk), keď stránka nemá JSON-LD."""
    if 'itemprop="recipeIngredient"' not in s and 'itemprop="ingredients"' not in s: return None
    def all_(prop): return [clean(x) for x in re.findall(r'itemprop="' + prop + r'"[^>]*>(.*?)</(?:li|p|span|div|h1|h2)>', s, re.S)]
    def meta(prop):
        m = re.search(r'itemprop="' + prop + r'"[^>]*content="([^"]*)"', s) or re.search(r'content="([^"]*)"[^>]*itemprop="' + prop + r'"', s)
        if m: return m.group(1)
        v = all_(prop); return v[0] if v else None
    name = all_("name"); rv = meta("ratingValue"); rc = meta("ratingCount") or meta("reviewCount")
    if not (rv and rv.replace(".", "").isdigit() and float(rv) > 0): rc = None  # počet bez hodnotenia (Receptár: 0/5) nie sú hodnotenia
    return {"url": u, "site": urllib.parse.urlparse(u).netloc.replace("www.", ""), "name": name[0] if name else "",
            "yield": meta("recipeYield"), "time": meta("totalTime"), "rating": float(rv) if rv and rv.replace(".", "").isdigit() and float(rv) > 0 else None,
            "count": int(rc) if rc and rc.isdigit() and int(rc) > 0 else None,
            "ing": [x for x in all_("recipeIngredient") if x] or [y.strip(" .") for x in all_("ingredients") for y in re.split(r",\s+|;\s*", x) if y.strip(" .")],
            "steps": [x for x in all_("recipeInstructions") if x]}
dish=sys.argv[1]; L=json.load(open("loose.json"))[dish]
os.makedirs("raw",exist_ok=True); f=f"raw/{dish}.json"
data=json.load(open(f)) if os.path.exists(f) else []
have={d["url"] for d in data}; bad=[]; lock=threading.Lock()
def worker(us):
    for u in us:
        if u in have: continue
        try: r=one(u)
        except Exception as e: r=None; bad.append((u,str(e)[:60]))
        with lock:
            if r: data.append(r)
            else: bad.append((u,"bez receptu"))
        time.sleep(0.8)
ts=[threading.Thread(target=worker,args=(us,)) for us in L.values()]
[t.start() for t in ts]; [t.join() for t in ts]
json.dump(data,open(f,"w"),ensure_ascii=False,indent=1)
print(dish, "receptov:",len(data),"chyby:",len(bad))
for b in bad[:8]: print("  ",*b)
