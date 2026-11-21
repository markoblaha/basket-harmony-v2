# Šarža 6: 15 ďalších cheesecakov – 11 z Víkendového pečenia (suroviny a postup z HTML, vlastné fotky receptu) a 4 z Apetitu.
# Spustenie: python3 cheesecake15.py <priečinok>  → cc15.json a cc15/ (kandidáti fotiek)
import sys, os, re, io, json, html as H
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from web import get, recipe, steps_of
import fotky18 as f
from PIL import Image
S = os.path.abspath(sys.argv[1]); cwd = os.getcwd(); import parse as P; os.chdir(cwd)
txt = lambda s: re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
V = "https://vikendovepeceni.cz/"
URLS = [
 ("makovy_cheesecake", "makovy-cheesecake"), ("tvarohovy_cheesecake_s_lekvarom", "tvarohovy-cheesecake-s-povidly-skorici"),
 ("cheesecake_so_slivkovou_omackou", "cheesecake-se-svestkovou-omackou"), ("cheesecake_s_figami", "cheesecake-s-fiky"),
 ("cheesecake_s_hruskami_zazvorom", "cheesecake-s-hruskami-zazvorem-bilou"), ("tekvicovy_cheesecake", "dynovy-cheesecake"),
 ("vanilkovy_cheesecake_pena_biela_cokolada", "vanilkovy-cheesecake-s-penou-z-bile"), ("cheesecake_s_cokoladovou_penou", "cheesecake-s-cokoladovou-penou"),
 ("mini_cheesecakes_arasidove_maslo", "mini-cheesecakes-s-burakovym-maslem"), ("cheesecake_s_jahodami_rebarborou", "cheesecake-s-jahodami-a-rebarborou"),
 ("mini_cheesecakes_citronovy_krem", "mini-cheesecakes-s-citronovym-kremem")]
APETIT = [("ricotta_cheesecake", "Ricotta Cheesecake"), ("amaretto_cheesecake_slany_karamel", "Amaretto cheesecake se slaným karamelem"),
 ("levandulovy_cheesecake_cucoriedky", "Luxusní levandulový cheesecake s borůvkami"), ("matcha_cheesecake_lotus", "Matcha cheesecake s lotuskovými sušenkami")]
res = [x for x in json.load(open(f"{S}/cheesecake.json")) if "err" not in x]
byslug = {x["url"].rstrip("/").split("/")[-1]: x for x in res}
byname = {x.get("name"): x for x in res}
os.makedirs(f"{S}/cc15", exist_ok=True)
def ing_of(lines, groups=None):
    out = []
    for k, line in enumerate(lines):
        p = P.parse(line); out.append({"cs": line, "food": p.get("key"), "qty": p.get("qty"), "unit": p.get("unit"), "group": groups[k] if groups else None})
    return out
def save_imgs(n, urls, maxn):
    got = 0
    for u in urls:
        if got >= maxn: break
        try: raw = f.fetch(u, 25); w, h = Image.open(io.BytesIO(raw)).size
        except Exception: continue
        if w < 700 or h < 450: continue
        got += 1; open(f"{S}/cc15/{n:02d}-{got}.bin", "wb").write(raw)
    return got
out = []
for n, (rid, sl) in enumerate(URLS):
    x = byslug.get(sl) or {}; url = x.get("url") or next(u["url"] for u in res if sl in u["url"])
    _, _, p = get(url)
    mh = re.search(r"<h2[^>]*>(?:\s*<span[^>]*>)?\s*Recept na\b", p, re.I)
    if not mh: print("BEZ ŠTRUKTÚRY", rid, url); continue
    i = mh.end(); j = p.find("TISK receptu", i)
    if j < 0: j = p.find("comment-reply-title", i)
    body = p[i:j]; ing, steps, cur, yld = [], [], "", ""
    for t in re.finditer(r'<(h2|h3|p|ul)\b[^>]*>(.*?)</\1>', body, re.S):
        tag, inner = t.group(1), t.group(2)
        if tag == "h3": cur = txt(inner); continue
        if tag == "ul": ing += [(txt(li), cur) for li in re.findall(r"<li[^>]*>(.*?)</li>", inner, re.S)]
        elif tag == "p":
            s = txt(inner)
            if s and not ing and not steps and s.startswith("("): yld = s.strip("()"); continue
            if s: steps.append((cur, s))
    imgs = re.findall(r'(https://vikendovepeceni\.cz/wp-content/uploads/\d{4}/\d{2}/[^"\s,]+?\.(?:jpe?g|png))', p)
    imgs = [u for u in dict.fromkeys(imgs) if not re.search(r"-\d+x\d+\.", u)]
    got = save_imgs(n, imgs, 6)
    out.append({"n": n, "id": rid, "site": "vikend", "url": url, "name": txt(re.search(r"<h1[^>]*>(.*?)</h1>", p, re.S).group(1)), "rating": x.get("rating"), "votes": x.get("votes"),
                "yield": yld, "ings": ing_of([a for a, _ in ing], [b for _, b in ing]), "steps": steps, "photos": got})
for k, (rid, nm) in enumerate(APETIT):
    n = len(URLS) + k; x = byname[nm]; _, _, p = get(x["url"]); _, r = recipe(p)
    st = []
    for s in r.get("recipeInstructions") or []:
        if isinstance(s, dict) and s.get("@type") == "HowToSection":
            st += [(s.get("name"), txt(y.get("text", ""))) for y in s.get("itemListElement", [])]
        elif isinstance(s, dict): st.append((None, txt(s.get("text", ""))))
    im = r.get("image"); im = im[0] if isinstance(im, list) else im; im = im.get("url") if isinstance(im, dict) else im
    im = re.sub(r"\.webp(\?.*)?$|\?.*$", "", re.sub(r"/styles/[^/]+/public/", "/", im))
    got = save_imgs(n, [im], 1)
    out.append({"n": n, "id": rid, "site": "apetit", "url": x["url"], "name": r.get("name"), "rating": x["rating"], "votes": x["votes"], "yield": r.get("recipeYield"),
                "prep": r.get("prepTime"), "cook": r.get("cookTime"), "total": r.get("totalTime"), "ings": ing_of([H.unescape(re.sub(r"\s+", " ", l)).strip() for l in r.get("recipeIngredient") or []]), "steps": st, "photos": got})
for r in out: print(r["n"], r["id"], "| surovín", len(r["ings"]), "| krokov", len(r["steps"]), "| fotiek", r["photos"], "| výťažok:", r["yield"])
json.dump(out, open(f"{S}/cc15.json", "w"), ensure_ascii=False, indent=1)
