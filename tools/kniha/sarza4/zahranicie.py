# Fotky zo zahraničných receptov (pokyn majiteľa 21. 11.): ak recept nemá fotku celého jedla alebo fotka nesedí k názvu,
# nájdi rovnaké jedlo na zahraničných weboch (WebSearch), porovnaj NÁZOV, SUROVINY aj OBRÁZOK a vezmi originálnu fotku
# vo vyššom rozlíšení. Skript pre každú adresu vypíše názov a suroviny receptu (na porovnanie s naším) a stiahne fotku
# (JSON-LD image, inak og:image; najväčšia verzia), uloží <priečinok>/<id>-z<n>.bin a kontaktný hárok <priečinok>/<id>.png.
#   python3 zahranicie.py <priečinok> <id> <url> [<url> …]
import sys, os, re, io, json, html as H
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from web import get, recipe
import fotky18 as f
from PIL import Image, ImageDraw, ImageStat
OUT, rid, urls = sys.argv[1], sys.argv[2], sys.argv[3:]; os.makedirs(OUT, exist_ok=True)
def imgs_of(r, p):
    out = []
    im = (r or {}).get("image")
    for x in (im if isinstance(im, list) else [im]):
        if isinstance(x, dict): x = x.get("url") or x.get("contentUrl")
        if isinstance(x, str): out.append(x)
    out += re.findall(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', p)
    return [H.unescape(u) for u in dict.fromkeys(out)]
got = []
for n, u in enumerate(urls, 1):
    try: _, _, p = get(u); _, r = recipe(p)
    except Exception as e: print(f"z{n} CHYBA {u} {str(e)[:60]}"); continue
    ing = (r or {}).get("recipeIngredient") or []
    print(f"z{n} {(r or {}).get('name') or '(bez JSON-LD)'} | {u}")
    print("    suroviny:", "; ".join(H.unescape(re.sub(r'\s+', ' ', x)) for x in ing[:14]))
    best = None
    for iu in imgs_of(r, p):
        try: raw = f.fetch(iu, 25); im = Image.open(io.BytesIO(raw))
        except Exception: continue
        if ImageStat.Stat(im.convert("L").resize((64, 64))).stddev[0] < 30: continue
        if not best or im.width > best[1].width: best = (raw, im)
    if best:
        open(f"{OUT}/{rid}-z{n}.bin", "wb").write(best[0]); got.append((n, best[1])); print(f"    fotka {best[1].width}x{best[1].height}")
W, Hh = 260, 195
if got:
    sh = Image.new("RGB", (W * len(got), Hh + 16), "white"); d = ImageDraw.Draw(sh)
    for k, (n, im) in enumerate(got):
        t = im.convert("RGB"); t.thumbnail((W, Hh)); sh.paste(t, (k * W, 0)); d.text((k * W + 3, Hh + 2), f"z{n} {im.width}px", fill="black")
    sh.save(f"{OUT}/{rid}.png")
