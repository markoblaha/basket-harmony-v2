# Hromadný výber kvalitných receptov pre slabé podkategórie (pokyn majiteľa 21. 11.: „v každej kategórii extrémne málo“).
# Prejde adresy z data/urls.json podľa kľúčových slov podkategórie, načíta JSON-LD a nechá len recepty s hodnotením ≥ 4,2,
# ≥ 40 hlasmi, ≥ 85 % surovín s množstvom a vlastnou fotkou ≥ 1000 px. Zoradí podľa počtu hlasov.
#   python3 tazba.py <priečinok> <podkategória> [max]
import sys, os, re, io, json, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from web import get, recipe, steps_of
import fotky18 as f
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
KLUC = {
 "zakusky": r"rezy|kostky|venecky|vetrnik|kremrol|trubick|rakvick|indianek|laskonk|dortik|kosicky|tartaletk|eclair|profiterol|makronk|rolad|spicky|kokosky-s|punc",
 "kysnute": r"kynut|buchty|buchticky|kolac(e|ky)|zavin|vanocka|mazanec|babovka-kynuta|sneci|loupak|rohlicky-kynut|koblih|vdolk|briosk|pletenec|frgal",
 "muffiny": r"muffin|cupcake|cookies|susenky|scones|madlenk|biscotti|sušenky",
 "dezerty": r"pudink|krem(?!e)|pena|panna-cotta|mousse|zmrzlina|sorbet|parfait|nakyp|trifle|tiramisu|crumble|semifredd|pohar|dezert|creme-brulee|zele",
 "sladke_jedla": r"palacink|livanc|livanec|knedlik|nakyp|zemlovk|sulance|sisky|nudle|vafle|lievan|pancake|trhanec|french-toast|bundas|kase|lokse|kolacky-z-tvarohu|tvarohove-knedliky|pirohy",
 "kolace_rezy": r"kolac|bublanin|rezy|strudl|zavin|brownies|blondies|babovk|chlebicek|pernik|tart|pie|crumble",
}
OUT, sub = sys.argv[1], sys.argv[2]; MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 400
URLS = json.load(open(os.path.join(HERE, "..", "data", "urls.json")))
SITES = {"apetit": r"/recept/", "receptycz": r"/recept/", "vareni": r"/recepty/[^/]+/?$"}
fold = lambda s: unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
slug = lambda u: fold(u.split("?")[0].rstrip("/").rsplit("/", 1)[-1])
pat = re.compile(KLUC[sub]); neg = re.compile(r"slany|slane|masov|kure|vepr|hovez|zelenin|sunk|syrov[ey]-(?!dort)|bramborov|chleb(?!icek)|pizza|toust|houb|ryb|losos|spenat")
cand = [(s, u) for s, p in SITES.items() for u in URLS.get(s, []) if re.search(p, u) and pat.search(slug(u)) and not neg.search(slug(u))][:MAX]
def big(u):
    u = re.sub(r"/styles/[^/]+/public/", "/", u); u = re.sub(r"\.webp(\?.*)?$", "", u) if "apetitonline" in u else u
    return re.sub(r"/h\d+w\d+t?\.jpg", "/h1200w2000t.jpg", u)
def one(j):
    s, u = j
    try: _, _, p = get(u); _, r = recipe(p)
    except Exception: return None
    if not r: return None
    ar = r.get("aggregateRating") or {}; rat = float(ar.get("ratingValue") or 0); vot = int(float(ar.get("ratingCount") or ar.get("reviewCount") or 0))
    ing = r.get("recipeIngredient") or []
    if isinstance(ing, str): ing = [x for x in ing.split("\n") if x.strip()]
    q = sum(1 for x in ing if re.search(r"\d", x)) / max(1, len(ing))
    if rat < 4.2 or vot < 40 or q < 0.85 or len(ing) < 4: return None
    im = r.get("image"); im = im[0] if isinstance(im, list) else im; im = im.get("url") if isinstance(im, dict) else im
    w = 0
    if isinstance(im, str):
        try: w = Image.open(io.BytesIO(f.fetch(big(im), 20))).width
        except Exception: pass
    return {"site": s, "url": u, "name": r.get("name"), "rating": round(rat, 2), "votes": vot, "img": w}
res = [x for x in ThreadPoolExecutor(12).map(one, cand) if x]
res.sort(key=lambda x: -x["votes"])
os.makedirs(OUT, exist_ok=True); json.dump(res, open(f"{OUT}/tazba_{sub}.json", "w"), ensure_ascii=False, indent=1)
print(sub, "kandidátov", len(cand), "kvalitných", len(res))
for x in res[:45]: print(f"  {x['votes']:5} ★{x['rating']} {x['img']:5}px  {x['name'][:60]:60} {x['url']}")
