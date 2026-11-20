# Spoločné: sťahovanie stránok, sitemap, čítanie receptu zo schema.org (JSON-LD / mikrodáta).
import gzip, json, re, time, urllib.request, html as H
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
def get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "sk,cs;q=0.9", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        b = r.read()
        if r.headers.get("Content-Encoding") == "gzip" or url.endswith(".gz"): b = gzip.decompress(b)
        return r.status, r.geturl(), b.decode("utf-8", "replace")
def locs(xml): return [H.unescape(x.strip()) for x in re.findall(r"<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</loc>", xml, re.S)]
def sitemap_urls(seeds, pat, max_maps=40, sub_pat=None, log=print):
    seen, out, queue, n = set(), [], list(seeds), 0
    while queue and n < max_maps:
        sm = queue.pop(0)
        if sm in seen: continue
        seen.add(sm); n += 1
        try: _, _, x = get(sm)
        except Exception as e: log(f"  sitemap chyba {sm}: {e}"); continue
        ls = locs(x)
        if "<sitemapindex" in x[:2000] or (ls and all(re.search(r"sitemap|\.xml", l) for l in ls[:5])):
            subs = [l for l in ls if not sub_pat or re.search(sub_pat, l)]
            queue.extend(subs)
        else:
            out.extend(l for l in ls if re.search(pat, l))
        time.sleep(0.3)
    return list(dict.fromkeys(out)), n, len(queue)
def _walk(o):
    if isinstance(o, list):
        for x in o: yield from _walk(x)
    elif isinstance(o, dict):
        yield o
        for k in ("@graph", "mainEntity", "itemListElement"):
            if k in o: yield from _walk(o[k])
def recipe(page):
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S | re.I):
        try: data = json.loads(m.group(1).strip(), strict=False)
        except Exception: continue
        for o in _walk(data):
            t = o.get("@type"); t = t if isinstance(t, list) else [t]
            if "Recipe" in t: return "jsonld", o
    if re.search(r'itemtype="https?://schema\.org/Recipe"', page): return "microdata", None
    return None, None
def steps_of(ins):
    out = []
    if isinstance(ins, str): return [s for s in re.split(r"\n+|(?<=\.)\s{2,}", H.unescape(re.sub(r"<[^>]+>", "\n", ins))) if s.strip()]
    for x in ins or []:
        if isinstance(x, str): out.append(x)
        elif isinstance(x, dict):
            if x.get("@type") == "HowToSection": out += steps_of(x.get("itemListElement"))
            else: out.append(x.get("text") or x.get("name") or "")
    return [H.unescape(re.sub(r"<[^>]+>", " ", s)).strip() for s in out if s and s.strip()]
QTY = re.compile(r"(^|\s)(\d|½|¼|¾|⅓|⅔)")
def metrics(o):
    ing = [H.unescape(re.sub(r"<[^>]+>", "", str(i))).strip() for i in (o.get("recipeIngredient") or o.get("ingredients") or []) if str(i).strip()]
    st = steps_of(o.get("recipeInstructions"))
    ar = o.get("aggregateRating") or {}
    if isinstance(ar, list): ar = ar[0] if ar else {}
    def num(v):
        try: return float(str(v).replace(",", "."))
        except Exception: return None
    votes = num(ar.get("ratingCount")) or num(ar.get("reviewCount"))
    y = o.get("recipeYield"); y = y[0] if isinstance(y, list) and y else y
    return {"name": H.unescape(str(o.get("name", "")))[:80], "ing": len(ing), "qty": (sum(bool(QTY.search(i)) for i in ing) / len(ing)) if ing else 0,
            "steps": len(st), "words": sum(len(s.split()) for s in st), "yield": bool(y), "time": bool(o.get("totalTime") or o.get("cookTime") or o.get("prepTime")),
            "rating": num(ar.get("ratingValue")), "votes": votes, "img": bool(o.get("image")), "ing_list": ing, "steps_list": st, "yield_v": str(y)[:40] if y else ""}
def micro(page):
    def inner(prop):
        out = []
        for m in re.finditer(r'<(\w+)[^>]*itemprop="' + prop + r'"[^>]*>', page):
            tag, start = m.group(1), m.end(); depth, i = 1, start
            for t in re.finditer(r'<(/?)' + tag + r'\b[^>]*>', page[start:]):
                depth += -1 if t.group(1) else 1
                if depth == 0: out.append(page[start:start + t.start()]); break
        return out
    txt = lambda s: re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
    ing = []
    for blk in inner("recipeIngredient") + inner("ingredients"):
        items = re.findall(r"<li[^>]*>(.*?)</li>", blk, re.S) or re.split(r"<br\s*/?>|\n", blk)
        ing += [txt(x) for x in items if txt(x)]
    st = []
    for blk in inner("recipeInstructions"):
        items = re.findall(r"<(?:li|p)[^>]*>(.*?)</(?:li|p)>", blk, re.S) or [blk]
        st += [txt(x) for x in items if txt(x)]
    name = [txt(x) for x in inner("name")][:1]
    return {"name": name[0] if name else "", "recipeIngredient": ing, "recipeInstructions": st}
