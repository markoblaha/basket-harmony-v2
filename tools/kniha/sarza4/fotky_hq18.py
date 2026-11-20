# Najkrajšie fotky jedla z kvalitných webov v najväčšom rozlíšení (kandidáti na ručný výber).
import sys, re, io, os, json, html as H
sys.path.insert(0, "tools/kniha/sarza4")
import fotky18 as f
from web import sitemap_urls
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
S = sys.argv[1]; os.makedirs(f"{S}/hq", exist_ok=True)
SITES = {
 "apetit": (["https://www.apetitonline.cz/recepty/sitemap.xml"], None, r"/recept/"),
 "toprecepty": (["https://www.toprecepty.cz/sitemap.xml"], r"recepty", r"/recept/\d+-"),
 "receptycz": (["https://www.recepty.cz/sitemap.xml"], r"recipe-sitemap", r"/recept/"),
 "vikend": (["https://vikendovepeceni.cz/post-sitemap.xml"], None, r"vikendovepeceni\.cz/\d{4}/\d{2}/"),
}
DISH = {
 "svieckova": r"svickov", "pecena_kacica": r"pecen\w*-kach|kachna-na|kachni-steh|pecena-kachn", "spanielsky_vtacik": r"spanelsk\w*-ptac",
 "vianocka": r"vanock", "medovnik": r"medovnik", "karamelove_veterniky": r"vetrnik", "recka_musaka": r"musak|moussak",
 "segedinsky_gulas": r"segedin", "lasagne": r"lasagn", "hovadzi_gulas": r"hovezi-gulas", "kulajda": r"kulajd",
 "moravsky_vrabec": r"vrabec", "laskonky": r"laskonk", "vianocna_kapustnica": r"kapustnic|vanocni-zelnac|zelnacka",
 "konfitovana_kacica": r"konfit|confit", "makove_torticky_s_mangom": r"makov\w*-dort\w*-mang|mang\w*-mak", "tekvicove_rezy": r"dynov\w*-rez", "cheesecake_s_ovocnou_penou": r"cheesecake",
}
cache = f"{S}/hq/urls.json"
if os.path.exists(cache): urls = json.load(open(cache))
else:
    urls = {k: sitemap_urls(v[0], v[2], max_maps=60, sub_pat=v[1], log=lambda *_: None)[0] for k, v in SITES.items()}
    json.dump(urls, open(cache, "w"))
print({k: len(v) for k, v in urls.items()})
def big(u, site):
    if site == "apetit": u = re.sub(r"/styles/[^/]+/public/", "/", u); u = re.sub(r"\.webp(\?.*)?$", "", u); u = re.sub(r"\?.*$", "", u)
    if site == "receptycz": u = re.sub(r"/h\d+w\d+t?\.jpg", "/h1200w2000t.jpg", u)
    return u
jobs = []
for dish, rx in DISH.items():
    for site, lst in urls.items():
        hits = [u for u in lst if re.search(rx, u.rsplit("/", 2)[-2] if u.endswith("/") else u.rsplit("/", 1)[-1])]
        hits = [u for u in hits if not re.search(r"polevk|polievk", u)] if dish != "kulajda" else hits
        for u in hits[:6]: jobs.append((dish, site, u))
print("stránok", len(jobs))
def one(j):
    dish, site, url = j
    try: page = f.fetch(url, 25).decode("utf-8", "replace")
    except Exception: return []
    c = f.candidates(page, url)[:4]
    out = []
    for u in dict.fromkeys(big(x, site) for x in c):
        try: raw = f.fetch(u, 25); im = Image.open(io.BytesIO(raw))
        except Exception: continue
        if im.width < 1000 or im.height < 650 or im.width / im.height > 2.2: continue
        out.append((dish, site, url, u, im.size, raw)); break
    return out
res = [r for rr in ThreadPoolExecutor(8).map(one, jobs) for r in rr]
idx = []
for k, (dish, site, url, u, sz, raw) in enumerate(res):
    p = f"{S}/hq/{dish}-h{k}.bin"; open(p, "wb").write(raw); idx.append({"dish": dish, "k": k, "site": site, "page": url, "img": u, "size": sz})
json.dump(idx, open(f"{S}/hq/index.json", "w"), ensure_ascii=False, indent=0)
from collections import Counter; print(Counter(x["dish"] for x in idx))
