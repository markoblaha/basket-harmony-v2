# Vypíše vybrané recepty (suroviny, postup, výťažok, časy) a stiahne fotku receptu z JSON-LD (fotky z okolia stránky patria iným receptom): python3 vypis.py <priečinok> id=url …
import sys, os, re, io, json, html as H
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from web import get, recipe, steps_of
import fotky18 as f
from PIL import Image
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
def big(u):
    u = re.sub(r"/styles/[^/]+/public/", "/", u); u = re.sub(r"\.webp(\?.*)?$", "", u) if "apetitonline" in u else u
    return re.sub(r"/h\d+w\d+t?\.jpg", "/h1200w2000t.jpg", u)
for arg in sys.argv[2:]:
    rid, url = arg.split("=", 1); _, _, p = get(url); _, r = recipe(p)
    ar = r.get("aggregateRating") or {}
    print(f"##### {rid} | {r.get('name')} | ★{ar.get('ratingValue')}/{ar.get('ratingCount') or ar.get('reviewCount')} | {r.get('recipeYield')} | {r.get('prepTime')} {r.get('cookTime')} {r.get('totalTime')}")
    ing = r.get("recipeIngredient") or []
    for i in ing: print("  -", H.unescape(re.sub(r"\s+", " ", i)).strip())
    ins = r.get("recipeInstructions") or []
    for s in ([ins] if isinstance(ins, str) else ins):
        if isinstance(s, dict) and s.get("@type") == "HowToSection":
            print("  ##", s.get("name"))
            for y in s.get("itemListElement", []): print("  >", H.unescape(re.sub(r"<[^>]+>|\s+", " ", y.get("text", ""))).strip())
        elif isinstance(s, dict): print("  >", H.unescape(re.sub(r"<[^>]+>|\s+", " ", s.get("text", ""))).strip())
        else: print("  >", H.unescape(re.sub(r"<[^>]+>|\s+", " ", str(s))).strip())
    img = r.get("image"); img = img if isinstance(img, list) else [img]
    cands = [big(x.get("url") if isinstance(x, dict) else x) for x in img if x]
    got, sigs = 0, []
    for u in dict.fromkeys(cands):
        if got >= 6: break
        try: raw = f.fetch(u, 20); im = Image.open(io.BytesIO(raw))
        except Exception: continue
        if im.width < 600 or im.height < 400: continue
        sig = im.convert("L").resize((16, 16)).tobytes()
        if any(sum(abs(a - b) for a, b in zip(sig, s)) < 16 * 16 * 12 for s in sigs): continue
        sigs.append(sig); got += 1; open(f"{OUT}/{rid}-{got}.bin", "wb").write(raw); print(f"  [foto {got}] {im.width}x{im.height} {u}")
