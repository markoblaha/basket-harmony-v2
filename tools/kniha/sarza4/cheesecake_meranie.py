import sys, re, io, json, os
sys.path.insert(0, "tools/kniha/sarza4")
from web import get, recipe, sitemap_urls, steps_of, metrics
import fotky18 as f
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
S = sys.argv[1]
urls = json.load(open(f"{S}/hq/urls.json"))
more = {"vareni": (["https://www.vareni.cz/sitemap.xml"], r"recepty", r"vareni\.cz/recepty/[^/]+/?$"),
        "lidl": (["https://kuchynalidla.sk/sitemap.xml"], None, r"kuchynalidla\.sk/recepty/[^/]+$")}
for k, (seeds, sub, pat) in more.items():
    if k not in urls: urls[k] = sitemap_urls(seeds, pat, max_maps=60, sub_pat=sub, log=lambda *_: None)[0]
json.dump(urls, open(f"{S}/hq/urls.json", "w"))
slug = lambda u: u.rstrip("/").rsplit("/", 1)[-1]
cand = [(s, u) for s, l in urls.items() for u in l if re.search(r"cheese-?cake|cheesecak|chessecake", slug(u))]
print("stránok so slovom cheesecake:", len(cand), {s: sum(1 for x, _ in cand if x == s) for s in urls})
def one(j):
    site, url = j
    try:
        _, _, page = get(url); kind, r = recipe(page)
    except Exception as e: return {"site": site, "url": url, "err": str(e)[:60]}
    if not r: return {"site": site, "url": url, "err": "bez JSON-LD"}
    ing = r.get("recipeIngredient") or []
    if isinstance(ing, str): ing = [x for x in ing.split("\n") if x.strip()]
    q = sum(1 for x in ing if re.search(r"\d", x))
    st = steps_of(r.get("recipeInstructions"))
    words = sum(len(str(s).split()) for s in st)
    ar = r.get("aggregateRating") or {}
    rating = float(ar.get("ratingValue") or 0); votes = int(float(ar.get("ratingCount") or ar.get("reviewCount") or 0))
    if site == "lidl" and rating > 5: rating = rating / 20
    img = r.get("image"); img = img[0] if isinstance(img, list) else img; img = img.get("url") if isinstance(img, dict) else img
    w = 0
    if isinstance(img, str):
        if site == "apetit": img = re.sub(r"/styles/[^/]+/public/", "/", img); img = re.sub(r"\.webp(\?.*)?$|\?.*$", "", img)
        if site == "receptycz": img = re.sub(r"/h\d+w\d+t?\.jpg", "/h1200w2000t.jpg", img)
        try: w = Image.open(io.BytesIO(f.fetch(img, 20))).width
        except Exception: w = 0
    return {"site": site, "url": url, "name": r.get("name"), "rating": rating, "votes": votes, "ing": len(ing), "qty": q, "words": words, "img": w,
            "nobake": bool(re.search(r"nepe[cč]|bez pe[cč]|no-?bake", (r.get("name") or "") + url, re.I))}
res = list(ThreadPoolExecutor(10).map(one, cand))
json.dump(res, open(f"{S}/cheesecake.json", "w"), ensure_ascii=False)
ok = [x for x in res if "err" not in x]
editorial = {"apetit", "vikend", "lidl"}
def good(x):
    trust = (x["rating"] >= 4.3 and x["votes"] >= 5) or (x["site"] in editorial)
    return trust and x["ing"] >= 5 and x["qty"] >= 0.8 * x["ing"] and x["words"] >= 60 and x["img"] >= 800
g = [x for x in ok if good(x)]
print("prečítané:", len(ok), "chyby:", len(res) - len(ok))
for s in urls:
    a = [x for x in ok if x["site"] == s]; b = [x for x in g if x["site"] == s]
    if a: print(f"{s:11} spolu {len(a):4}  kvalitné {len(b):3}")
print("KVALITNÉ SPOLU:", len(g), "| nepečené:", sum(x["nobake"] for x in g))
import collections
print("dôvody vyradenia:", collections.Counter(
    "hodnotenie" if not ((x["rating"] >= 4.3 and x["votes"] >= 5) or x["site"] in editorial) else "suroviny" if x["ing"] < 5 or x["qty"] < 0.8 * x["ing"] else "postup" if x["words"] < 60 else "fotka" for x in ok if not good(x)))
for x in sorted(g, key=lambda x: (-(x["votes"] or 0)))[:25]: print(f'  {x["site"]:10} {x["rating"]:.1f}★ {x["votes"]:4} {x["img"]:5}px {x["words"]:4}sl  {x["name"]}')
