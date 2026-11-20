# Šarža 5: 25 cheesecakov – stiahnutie receptov (JSON-LD), priradenie potravín (parse.py), kandidáti fotiek v plnej veľkosti.
# Spustenie: python3 cheesecake25.py <priečinok> (vstup <priečinok>/cheesecake.json z merania, výstup cc25.json a cc25/ fotky)
import sys, os, re, io, json, html as H
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from web import get, recipe, steps_of
import fotky18 as f
from PIL import Image
S = os.path.abspath(sys.argv[1])
cwd = os.getcwd(); import parse as P; os.chdir(cwd)
PICK = [0, 3, 14, 20, 8, 5, 4, 17, 18, 19, 11, 16, 13, 10, 15, 7, 38, 31, 24, 46, 48, 30, 51, 41, 63]
res = [x for x in json.load(open(f"{S}/cheesecake.json")) if "err" not in x]
def ok(x):
    if x["votes"] >= 5 and x["rating"] < 4.0: return False
    if x["votes"] < 5 and x["site"] not in ("apetit", "vikend", "lidl"): return False
    return x["ing"] >= 5 and x["qty"] >= 0.8 * x["ing"] and x["words"] >= 60 and x["img"] >= 800
g = sorted([x for x in res if ok(x)], key=lambda x: -(x["votes"] * x["rating"]))
def big(u, site):
    u = H.unescape(u)
    if site == "apetit": u = re.sub(r"/styles/[^/]+/public/", "/", u); u = re.sub(r"\.webp(\?.*)?$|\?.*$", "", u)
    if site == "receptycz": u = re.sub(r"/h\d+w\d+t?\.jpg", "/h1200w2000t.jpg", u)
    return u
def sections(ins):
    out = []
    for s in ins if isinstance(ins, list) else [ins]:
        if isinstance(s, dict) and s.get("@type") == "HowToSection":
            for x in s.get("itemListElement", []): out.append((s.get("name"), x.get("text") if isinstance(x, dict) else str(x)))
        elif isinstance(s, dict): out.append((None, s.get("text")))
        elif isinstance(s, str): out.append((None, s))
    return [(a, H.unescape(re.sub(r"<[^>]+>", " ", b or "")).strip()) for a, b in out if b]
os.makedirs(f"{S}/cc25", exist_ok=True)
out = []
for n, i in enumerate(PICK):
    x = g[i]; url = x["url"]
    _, _, page = get(url); _, r = recipe(page)
    ing = r.get("recipeIngredient") or []
    ings = []
    for line in ing:
        line = H.unescape(re.sub(r"\s+", " ", line)).strip()
        p = P.parse(line)
        ings.append({"cs": line, "food": p.get("key"), "qty": p.get("qty"), "unit": p.get("unit")})
    imgs = []
    im = r.get("image"); im = im if isinstance(im, list) else [im]
    for u in im:
        u = u.get("url") if isinstance(u, dict) else u
        if isinstance(u, str): imgs.append(big(u, x["site"]))
    for u in f.candidates(page, url): imgs.append(big(u, x["site"]))
    imgs = list(dict.fromkeys(imgs))
    got = 0
    for u in imgs:
        if got >= 8: break
        try: raw = f.fetch(u, 25); w, h = Image.open(io.BytesIO(raw)).size
        except Exception: continue
        if w < 700 or h < 450: continue
        got += 1; open(f"{S}/cc25/{n:02d}-{got}.bin", "wb").write(raw)
    out.append({"n": n, "site": x["site"], "url": url, "name": r.get("name"), "rating": x["rating"], "votes": x["votes"], "yield": r.get("recipeYield"),
                "prep": r.get("prepTime"), "cook": r.get("cookTime"), "total": r.get("totalTime"), "ings": ings,
                "steps": sections(r.get("recipeInstructions")), "photos": got, "desc": (r.get("description") or "")[:300]})
    print(n, x["site"], r.get("name"), "| surovín", len(ings), "| krokov", len(out[-1]["steps"]), "| fotiek", got, "| neznáme:", sum(1 for z in ings if not z["food"]))
json.dump(out, open(f"{S}/cc25.json", "w"), ensure_ascii=False, indent=1)
