# Doplnenie fotiek (pokyn majiteľa 21. 11.: recept má mať 2–3 pekné fotky; ak má jednu alebo malú, nájsť rovnaké jedlo
# na iných weboch a vziať ich hlavnú fotku). Kandidáti: recepty s rovnakým jedlom v adrese (data/urls.json), len fotka
# receptu z JSON-LD, šírka ≥ 1000 px. Výstup: <priečinok>/<id>-k<n>.bin + kontaktné hárky na ručný výber.
#   python3 dopln_fotky.py <priečinok> [id …]
import sys, os, re, io, json, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from web import get, recipe
import fotky18 as f
from PIL import Image, ImageDraw, ImageStat
from concurrent.futures import ThreadPoolExecutor
VZOR = {
 "japonsky_cheesecake": r"japonsky-cheesecake|japanese-cheesecake", "jogurtovy_cheesecake": r"jogurtovy-cheesecake",
 "kokosovy_cheesecake_biela_cokolada": r"kokosovy-cheesecake", "malinovy_cheesecake": r"malinovy-cheesecake",
 "mrkvovy_fit_cheesecake": r"mrkvovy.*cheesecake", "nepeceny_cokoladovy_cheesecake": r"nepeceny-cokoladovy-cheesecake|cokoladovy-nepeceny-cheesecake",
 "nepeceny_cucoriedkovy_cheesecake": r"nepeceny-boruvkovy-cheesecake|boruvkovy-nepeceny", "pistaciovy_cheesecake": r"pistaciovy-cheesecake",
 "tiramisu_cheesecake": r"tiramisu-cheesecake", "amaretto_cheesecake_slany_karamel": r"cheesecake.*slanym-karamelem|karamelovy-cheesecake",
 "levandulovy_cheesecake_cucoriedky": r"boruvkovy-cheesecake|cheesecake-s-boruvkami", "matcha_cheesecake_lotus": r"matcha.*cheesecake",
 "ricotta_cheesecake": r"ricott.*cheesecake|cheesecake.*ricott", "brownies": r"^brownies|cokoladove-brownies",
 "bublanina": r"^bublanina", "cokoladova_torta": r"^cokoladovy-dort", "jablkova_strudla": r"jablecny-zavin|jablecny-strudl|jablkova-strudla",
 "jablkovy_kolac": r"^jablecny-kolac|francouzsky-jablecny-kolac|jablecny-tart", "kremes": r"^kremes|^kremove-rezy|kremesove-rezy",
 "mramorova_babovka": r"mramorova-babovka|^babovka", "mrkvova_torta": r"^mrkvovy-dort", "orechova_torta": r"^orechovy-dort",
 "sacherova_torta": r"^sacher|sacheruv-dort", "schwarzwaldska_torta": r"schwarzwald.*dort|svarcvald.*dort", "tvarohovy_kolac": r"^tvarohovy-kolac",
 "buchty": r"^buchty|^pecene-buchty|kynute-buchty", "cokoladova_pena": r"^cokoladova-pena|cokoladova-mousse", "kokosky": r"^kokosky",
 "kysnuty_kolac": r"kynuty-kolac", "linecke_kolieska": r"^linecke", "makovnik": r"^makovy-zavin|^makovnik",
 "medovnicky": r"^pernicky|vanocni-pernicky", "orechovnik": r"orechovy-zavin|^orechovnik", "rumove_gulky": r"rumove-kulicky",
 "skoricove_slimaky": r"skoricovi-sneci|skoricove-sneky|cinnamon-roll|skoricove-slimaky", "tiramisu": r"^tiramisu",
 "trubicky": r"^trubicky|^kornoutky", "vanilkove_rozky": r"vanilkove-rohlicky",
 "cokoladove_muffiny": r"^cokoladove-muffiny", "cucoriedkove_muffiny": r"boruvkove-muffiny", "cookies": r"^cookies|chocolate-chip|americke-cookies",
 "ovsene_susienky": r"^ovesne-susenky", "bananove_muffiny": r"^bananove-muffiny", "palacinky": r"^palacinky",
 "ovocne_knedle": r"ovocne-knedliky|merunkove-knedliky|svestkove-knedliky|jahodove-knedliky", "parene_buchty": r"kynute-knedliky|borukove-knedliky|boruvkove-knedliky",
 "zemlovka": r"^zemlovka", "sulance_s_makom": r"sisky-s-makem|bramborove-sisky", "lievance": r"^livanec|^livance|^livanecky", "tvarohovy_krem": r"tvarohovy-krem",
 "tarte_tatin": r"tatin", "clafoutis": r"clafoutis", "venceky": r"venecky", "profiteroly": r"profiterol", "creme_brulee": r"creme-brulee|krem-brulee",
 "pavlova": r"pavlov", "baklava": r"baklav", "churros": r"churros", "citronovy_tart": r"citronov[ya]-tart|citronovy-kolac",
 "dobosova_torta": r"dobos", "red_velvet_torta": r"red-velvet", "jahodova_torta": r"^jahodov[ya]-dort", "punciova_torta": r"puncov[ya]-dort|puncove-rezy",
 "tres_leches": r"tres-leches|trimlek", "victoria_sponge": r"victoria|piskotovy-dort-s-jahod", "tiramisu_torta": r"tiramisu-dort", "oblatkova_torta": r"oplatkov[ya]-dort|lazensk",
}
SITES = {"apetit": r"/recept/", "receptycz": r"/recept/", "vikend": r"/\d{4}/\d{2}/", "lidl": r"/recepty/", "vareni": r"/recepty/[^/]+/?$", "toprecepty": r"/recept/\d+"}
URLS = json.load(open(os.path.join(HERE, "..", "data", "urls.json")))
fold = lambda s: unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
slug = lambda u: fold(u.split("?")[0].rstrip("/").rsplit("/", 1)[-1])
def big(u):
    u = re.sub(r"/styles/[^/]+/public/", "/", u); u = re.sub(r"\.webp(\?.*)?$", "", u) if "apetitonline" in u else u
    return re.sub(r"/h\d+w\d+t?\.jpg", "/h1200w2000t.jpg", u)
def photo(url):
    try:
        _, _, p = get(url); _, r = recipe(p)
        if not r and "vikendovepeceni" in url:
            m = re.search(r'og:image" content="([^"]+)', p); img = m and m.group(1)
        else:
            img = r and r.get("image"); img = img[0] if isinstance(img, list) else img; img = img.get("url") if isinstance(img, dict) else img
        if not img: return None
        raw = f.fetch(big(img), 25); im = Image.open(io.BytesIO(raw))
        if ImageStat.Stat(im.convert("L").resize((64, 64))).stddev[0] < 30: return None  # zástupný obrázok (logo webu na sivom pozadí)
        return (url, raw, im.size) if im.width >= 1000 and im.height >= 650 else None
    except Exception: return None
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ids = sys.argv[2:] or list(VZOR)
src = {}
for rid in ids:
    pat = re.compile(VZOR[rid])
    cand = [u for s, p in SITES.items() for u in URLS.get(s, []) if re.search(p, u) and pat.search(slug(u))][:30]
    got = [x for x in ThreadPoolExecutor(10).map(photo, cand) if x][:6]
    src[rid] = []
    for n, (u, raw, sz) in enumerate(got, 1):
        open(f"{OUT}/{rid}-k{n}.bin", "wb").write(raw); src[rid].append(u)
    print(rid, len(cand), "→", len(got))
json.dump(src, open(f"{OUT}/zdroje.json", "w"), ensure_ascii=False, indent=1)
