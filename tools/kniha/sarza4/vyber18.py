# Kandidáti na komplikované recepty zo 6 webov z návrhu: sitemap → zhoda názvu → stiahnuť → miery. Výstup: <out>.json
import sys, re, json, time, threading, unicodedata, urllib.parse, html as H
sys.path.insert(0, sys.argv[1]); from web import get, sitemap_urls, recipe, metrics, micro
OUT = sys.argv[2]; PER = 4
fold = lambda s: unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
def slug(u): return re.sub(r"^\d+-|-\d+$", "", fold(urllib.parse.unquote(u)).split("?")[0].rstrip("/").split("/")[-1]).replace(".html", "")
txt = lambda s: re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
def lidl(u):
    _, _, p = get(u, timeout=40); k, o = recipe(p)
    if not o: return None
    ing = o.get("recipeIngredient")
    if isinstance(ing, str): o["recipeIngredient"] = [x.strip() for x in re.split(r"\n|\r|(?<=[a-zľščťžýáíéúäôň\)])\s*,\s*(?=\d)", ing) if x.strip()]
    m = metrics(o); ar = o.get("aggregateRating") or {}
    if m["rating"] and m["rating"] > 5: m["rating"] = round(m["rating"] / 20, 2)
    m["raw_ing"] = ing if isinstance(ing, str) else None
    return m
def vikend(u):
    _, _, p = get(u, timeout=40); k, o = recipe(p); ar = (o or {}).get("aggregateRating") or {}
    mh = re.search(r"<h2[^>]*>(?:\s*<span[^>]*>)?\s*Recept na\b", p, re.I)
    if not mh: return None
    i = mh.end(); j = p.find("TISK receptu", i)
    if j < 0: j = p.find("comment-reply-title", i)
    if j < 0: return None
    body = p[i:j]; groups, ing, steps, cur, yld = [], [], [], "", ""
    for t in re.finditer(r'<(h2|h3|p|ul)\b[^>]*>(.*?)</\1>', body, re.S):
        tag, inner = t.group(1), t.group(2)
        if tag == "h3": cur = txt(inner); first = True; continue
        if tag == "ul":
            for x in re.findall(r"<li[^>]*>(.*?)</li>", inner, re.S): ing.append({"t": txt(x), "group": cur})
        elif tag == "p":
            s = txt(inner)
            if not s: continue
            if not ing and not steps and s.startswith("("): yld = s.strip("()"); continue
            steps.append({"t": s, "group": cur})
    name = txt(re.search(r"<h1[^>]*>(.*?)</h1>", p, re.S).group(1)) if re.search(r"<h1[^>]*>(.*?)</h1>", p, re.S) else slug(u)
    o2 = {"name": name, "recipeIngredient": [x["t"] for x in ing], "recipeInstructions": [x["t"] for x in steps], "aggregateRating": ar, "recipeYield": yld}
    m = metrics(o2); m["groups_ing"] = [x["group"] for x in ing]; m["groups_steps"] = [x["group"] for x in steps]
    return m
def std(u):
    _, _, p = get(u, timeout=40); k, o = recipe(p)
    if k == "microdata" or (o and not o.get("recipeIngredient")): o = micro(p)
    if not o or not o.get("recipeIngredient"): return None
    m = metrics(o); m["time_v"] = (o.get("totalTime") if isinstance(o, dict) else None)
    return m
SITES = {
 "vareni.cz": (["https://www.vareni.cz/sitemap.xml"], r"recepty", r"vareni\.cz/recepty/[^/]+/?$", std, [("svieckova", r"^svickova-na-smetane"), ("spanielsky_vtacik", r"^spanelsk\w*-ptac"), ("plnena_paprika", r"^plnen\w*-papri"), ("rajska_omacka", r"^rajska-omacka"), ("koprova_omacka", r"^koprova-omacka"), ("pecena_kacica", r"^pecena-kachna")]),
 "apetitonline.cz": (["https://www.apetitonline.cz/recepty/sitemap.xml"], None, r"/recept/", std, [("medovnik", r"medovnik"), ("vianocka", r"vanock"), ("veterniky", r"vetrnik"), ("laskonky", r"laskonk"), ("kulajda", r"kulajd"), ("puncove_rezy", r"puncov")]),
 "toprecepty.cz": (["https://www.toprecepty.cz/sitemap.xml"], r"recepty", r"/recept/\d+-", std, [("lasagne", r"^lasagne|^vyborne-lasagne"), ("kulajda", r"kulajd"), ("plnena_kapusta", r"zeln\w*-zavitk|holubk|plnen\w*-zel"), ("musaka", r"musak|moussak"), ("segedin", r"segedin")]),
 "recepty.cz": (["https://www.recepty.cz/sitemap.xml"], r"recipe-sitemap", r"/recept/", std, [("gulas", r"^hovezi-gulas"), ("segedin", r"^segedinsk"), ("znojemska", r"znojem"), ("rizek", r"smazen\w*-rizek|^vepro\w*-rizek"), ("kynute_knedliky", r"kynut\w*-knedl"), ("buchty", r"^buchty")]),
 "kuchynalidla.sk": (["https://kuchynalidla.sk/sitemap.xml"], None, r"kuchynalidla\.sk/recepty/[^/]+$", lidl, [("pool", r"kapustnic|piroh|vypeck|kacac|kacic|holubk|plnena-kapust|sulanc|strudl|svieckov|gulas|rezen|laskonk|medovnik|kulajd|paprikas|halusk|knedl|sekan|segedin")]),
 "vikendovepeceni.cz": (["https://vikendovepeceni.cz/post-sitemap.xml"], None, r"vikendovepeceni\.cz/\d{4}/\d{2}/", vikend, [("pool", r"cheesecake|vetrnik|rezy|dort|buchty|loupac|linecke|kolac|vanock|babovk")]),
}
res, lock = {}, threading.Lock()
def run(site, cfg):
    seeds, sub, pat, reader, dishes = cfg
    urls = sitemap_urls(seeds, pat, max_maps=40, sub_pat=sub, log=lambda *_: None)[0]
    out = {}
    for d, rx in dishes:
        hit = {}
        for u in urls:
            s = slug(u)
            if re.search(rx, s) and s not in hit: hit[s] = u
        n = 22 if d == "pool" else PER
        cand = [hit[s] for s in sorted(hit, key=lambda s: (len(s.split("-")), len(s)))][:n]
        rows = []
        for u in cand:
            try: r = reader(u)
            except Exception as e: r = None
            if r: r["url"] = u; rows.append(r)
            time.sleep(0.9)
        out[d] = rows
    with lock: res[site] = out
    print(site, "adries", len(urls), {d: len(v) for d, v in out.items()}, flush=True)
th = [threading.Thread(target=run, args=(s, c)) for s, c in SITES.items()]; [t.start() for t in th]; [t.join() for t in th]
json.dump(res, open(OUT, "w"), ensure_ascii=False, indent=1)
