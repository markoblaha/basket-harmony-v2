# Koláče a dezerty – plán celej kategórie (pokyn majiteľa 21. 11.: „naplň celú kategóriu, postupne cez limity“).
# ZOZNAM = jedlá, ktoré má kategória mať (id, názov, podkategória, priorita 1 = klasika, vzor adresy receptu).
# Plán je aj v DB: book_dishes so status 'planned' a notes 'sub=<podkategória>'; hotové jedlo má status 'done'.
#   python3 dezerty.py sql            → SQL na zápis plánu do book_dishes (bez prepisu hotových)
#   python3 dezerty.py hladaj <id…>   → nájde kandidátov (Apetit, Vaření, Recepty.cz, Toprecepty, Lidl), zoradí podľa
#                                        hodnotenia, počtu hlasov, množstiev a dĺžky postupu, uloží <priečinok>/<id>.json + fotky
import sys, os, re, io, json, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ZOZNAM = [
 # torty
 ("sacherova_torta", "Sacherova torta", "torty", 1, r"sacher"),
 ("schwarzwaldska_torta", "Schwarzwaldská torta", "torty", 1, r"schwarzwald|svarcvald|cernoles"),
 ("orechova_torta", "Orechová torta", "torty", 1, r"^orechov[ya]-dort|^orechova-torta"),
 ("cokoladova_torta", "Čokoládová torta", "torty", 1, r"^cokoladov[ya]-(dort|torta)$|^nejlepsi-cokoladovy-dort"),
 ("mrkvova_torta", "Mrkvová torta", "torty", 1, r"^mrkvov[ya]-(dort|torta)"),
 ("dobosova_torta", "Dobošova torta", "torty", 2, r"dobos"),
 ("red_velvet_torta", "Red velvet torta", "torty", 2, r"red-velvet"),
 ("jahodova_torta", "Jahodová torta", "torty", 2, r"^jahodov[ya]-(dort|torta)"),
 ("punciova_torta", "Punčová torta", "torty", 2, r"puncov[ya]-(dort|torta)"),
 ("esterhazy_torta", "Esterházy torta", "torty", 2, r"esterh"),
 ("oblatkova_torta", "Oblátková torta", "torty", 2, r"oplatkov[ya]-dort|oblatkov"),
 # koláče a rezy
 ("jablkovy_kolac", "Jablkový koláč", "kolace_rezy", 1, r"^jablecny-kolac|^jablkovy-kolac|jablecny-kolac-s-drobenkou"),
 ("jablkova_strudla", "Jablková štrúdľa", "kolace_rezy", 1, r"jablecny-zavin|jablkova-strudla|^jablecny-strudl"),
 ("bublanina", "Bublanina", "kolace_rezy", 1, r"^bublanina"),
 ("kremes", "Krémeš", "kolace_rezy", 1, r"^kremes|^krempita|kremove-rezy"),
 ("brownies", "Čokoládové brownies", "kolace_rezy", 1, r"^brownies|^cokoladove-brownies"),
 ("tvarohovy_kolac", "Tvarohový koláč", "kolace_rezy", 1, r"^tvarohovy-kolac"),
 ("babovka", "Bábovka", "kolace_rezy", 1, r"^babovka|^mramorova-babovka"),
 ("medove_rezy", "Medové rezy", "kolace_rezy", 2, r"medove-rezy|^medovnikove-rezy"),
 ("bananovy_chlebik", "Banánový chlebík", "kolace_rezy", 2, r"bananovy-chleb"),
 ("makovy_kolac", "Makový koláč", "kolace_rezy", 2, r"^makovy-kolac"),
 ("tvarohova_strudla", "Tvarohová štrúdľa", "kolace_rezy", 2, r"tvarohovy-zavin|tvarohova-strudla"),
 ("kokosove_rezy", "Kokosové rezy", "kolace_rezy", 2, r"kokosove-rezy"),
 ("linecky_kolac", "Linecký koláč s džemom", "kolace_rezy", 2, r"linecky-kolac"),
 ("visnovy_kolac", "Višňový koláč", "kolace_rezy", 2, r"^visnovy-kolac|^visnova-bublanina"),
 # kysnuté
 ("buchty", "Pečené buchty", "kysnute", 1, r"^buchty|^pecene-buchty|^babiciny-buchty"),
 ("kysnuty_kolac", "Kysnutý koláč s tvarohom a ovocím", "kysnute", 1, r"kynuty-kolac|kysnuty-kolac"),
 ("skoricove_slimaky", "Škoricové slimáky", "kysnute", 1, r"skoricov|cinnamon-roll"),
 ("svadobne_kolaciky", "Svadobné koláčiky", "kysnute", 1, r"svatebni-kolac|svadobne-kolac"),
 ("makovnik", "Makovník", "kysnute", 1, r"^makovy-zavin|^makovnik"),
 ("orechovnik", "Orechovník", "kysnute", 1, r"orechovy-zavin|^orechovnik"),
 ("sisky", "Šišky (donuty)", "kysnute", 2, r"^kobliha|^koblihy|^donuty|^sisky"),
 ("briosky", "Brioška", "kysnute", 2, r"briosk|brioche"),
 ("babka", "Čokoládová babka", "kysnute", 2, r"babka"),
 # zákusky
 ("indianky", "Indiánky", "zakusky", 2, r"^indianky|^indianek"),
 ("trubicky", "Trubičky so šľahačkou", "zakusky", 1, r"^trubicky|^kornoutky"),
 ("rakvicky", "Rakvičky (Kremrole)", "zakusky", 2, r"rakvick|^kremrole"),
 ("punc_rezy", "Punčové rezy", "zakusky", 2, r"puncove-rezy|^puncak"),
 ("makronky", "Makrónky", "zakusky", 2, r"^makronky"),
 ("ovocne_kosicky", "Ovocné košíčky", "zakusky", 2, r"ovocne-kosicky"),
 # vianočné cukrovie
 ("linecke_kolieska", "Linecké koláčiky", "cukrovie", 1, r"^linecke-(cukrovi|kolecka|kolieska|kolacky)|^linecke$"),
 ("vanilkove_rozky", "Vanilkové rožky", "cukrovie", 1, r"vanilkove-rohlicky|vanilkove-rozky"),
 ("medovnicky", "Medovníčky", "cukrovie", 1, r"^pernicky|^medovnicky|^vanocni-pernicky"),
 ("kokosky", "Kokosky", "cukrovie", 1, r"^kokosky|^kokosove-kupky"),
 ("rumove_gulky", "Rumové guľky", "cukrovie", 1, r"rumove-kulicky|rumove-gulky"),
 ("orechove_pracny", "Orechové pracny", "cukrovie", 2, r"^pracny|orechove-pracny"),
 ("ischelky", "Išelské koláčiky", "cukrovie", 2, r"iscel|ischl"),
 ("bezove_pusinky", "Bezé pusinky", "cukrovie", 2, r"^pusinky|^snehove-pusinky|^beze"),
 ("marokanky", "Marokánky", "cukrovie", 2, r"marokank"),
 ("cokoladova_salama", "Čokoládová saláma", "cukrovie", 2, r"cokoladovy-salam|cokoladova-salama"),
 # muffiny a sušienky
 ("cokoladove_muffiny", "Čokoládové muffiny", "muffiny", 1, r"^cokoladove-muffiny"),
 ("cucoriedkove_muffiny", "Čučoriedkové muffiny", "muffiny", 1, r"^boruvkove-muffiny|^cucoriedkove-muffiny"),
 ("cookies", "Cookies s čokoládou", "muffiny", 1, r"^cookies|^americke-cookies|chocolate-chip"),
 ("ovsene_susienky", "Ovsené sušienky", "muffiny", 1, r"^ovesne-susenky|^ovsene-susienky"),
 ("bananove_muffiny", "Banánové muffiny", "muffiny", 2, r"^bananove-muffiny"),
 ("vanilkove_cupcaky", "Vanilkové cupcaky", "muffiny", 2, r"^vanilkove-cupcake|^cupcakes?$"),
 # dezerty a krémy
 ("tiramisu", "Tiramisu", "dezerty", 1, r"^tiramisu$|^tiramisu-original|^klasicke-tiramisu"),
 ("panna_cotta", "Panna cotta", "dezerty", 1, r"^panna-cotta"),
 ("cokoladova_pena", "Čokoládová pena", "dezerty", 1, r"^cokoladova-pena|^cokoladova-mousse"),
 ("creme_brulee", "Crème brûlée", "dezerty", 2, r"creme-brulee|krem-brulee"),
 ("vanilkovy_puding", "Domáci vanilkový puding", "dezerty", 2, r"domaci-vanilkovy-puding|^vanilkovy-puding"),
 ("crumble", "Ovocný crumble", "dezerty", 2, r"crumble"),
 ("pavlova", "Pavlova", "dezerty", 2, r"pavlov"),
 ("domaca_zmrzlina", "Domáca zmrzlina", "dezerty", 2, r"domaci-zmrzlina|domaca-zmrzlina"),
 # sladké jedlá
 ("palacinky", "Palacinky", "sladke_jedla", 1, r"^palacinky$|^palacinky-zakladni|^zakladni-palacinky"),
 ("ovocne_knedle", "Ovocné knedle", "sladke_jedla", 1, r"^ovocne-knedliky|^merunkove-knedliky|^svestkove-knedliky"),
 ("parene_buchty", "Parené buchty", "sladke_jedla", 1, r"^kynute-knedliky|^parene-buchty|^dukatove"),
 ("zemlovka", "Žemľovka", "sladke_jedla", 1, r"^zemlovka|^zemlovka-s-jablky"),
 ("sulance_s_makom", "Šúľance s makom", "sladke_jedla", 1, r"^sulance|^sisky-s-makem|^bramborove-sisky"),
 ("tvarohove_knedle", "Tvarohové knedle", "sladke_jedla", 2, r"^tvarohove-knedliky"),
 ("cisarsky_trhanec", "Cisársky trhanec", "sladke_jedla", 2, r"cisarsky-trhanec|kaiserschmarrn"),
 ("rizovy_nakyp", "Ryžový nákyp", "sladke_jedla", 2, r"^rizovy-nakyp|^nakyp-z-ryze"),
 ("lekvarove_tasticky", "Lekvárové taštičky", "sladke_jedla", 2, r"povidlove-tasticky|lekvarove-tasticky"),
]
def fold(s): return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
if sys.argv[1] == "sql":
    v = ",\n".join(f"('{i}', '{n}', 'sladke', '{'SK-CZ' if p == 1 else 'EU'}', null, {p}, 'planned', 'sub={s}')" for i, n, s, p, _ in ZOZNAM)
    print("insert into public.book_dishes(id, name_sk, category, cuisine, family, priority, status, notes) values\n" + v + "\non conflict (id) do nothing;")
    sys.exit()
from web import get, recipe, steps_of
import fotky18 as f
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
OUT = os.environ.get("OUT", "/tmp/dezerty"); os.makedirs(OUT, exist_ok=True)
URLS = json.load(open(os.path.join(HERE, "..", "data", "urls.json")))
SITES = {"apetit": r"/recept/", "vareni": r"/recepty/[^/]+/?$", "receptycz": r"/recept/", "toprecepty": r"/recept/\d+", "lidl": r"/recepty/"}
slug = lambda u: fold(u.split("?")[0].rstrip("/").rsplit("/", 1)[-1])
def info(site, url):
    try: _, _, page = get(url); _, r = recipe(page)
    except Exception as e: return None
    if not r: return None
    ing = r.get("recipeIngredient") or []
    if isinstance(ing, str): ing = [x for x in ing.split("\n") if x.strip()]
    st = steps_of(r.get("recipeInstructions")); ar = r.get("aggregateRating") or {}
    rat = float(ar.get("ratingValue") or 0); vot = int(float(ar.get("ratingCount") or ar.get("reviewCount") or 0))
    if site == "lidl" and rat > 5: rat /= 20
    q = sum(1 for x in ing if re.search(r"\d", x)) / max(1, len(ing)); words = sum(len(str(s).split()) for s in st)
    score = (rat >= 4) * 2 + min(vot, 300) / 100 + q * 2 + min(words, 300) / 100 + (site == "apetit") * 0.5
    return {"site": site, "url": url, "name": r.get("name"), "rating": rat, "votes": vot, "qty": round(q, 2), "words": words, "score": round(score, 2), "r": r, "page_imgs": f.candidates(page, url)[:8]}
for did in sys.argv[2:]:
    d = next(x for x in ZOZNAM if x[0] == did); pat = re.compile(d[4])
    cand = [(s, u) for s, p in SITES.items() for u in URLS.get(s, []) if re.search(p, u) and pat.search(slug(u))]
    cand = list({slug(u) + s: (s, u) for s, u in cand}.values())[:40]
    res = [x for x in ThreadPoolExecutor(10).map(lambda j: info(*j), cand) if x and len(x["r"].get("recipeIngredient") or []) >= 3]
    res.sort(key=lambda x: -x["score"])
    print(f"## {did}: kandidátov {len(cand)}, s receptom {len(res)}")
    for x in res[:5]: print(f"   {x['score']:5} ★{x['rating']:.1f}/{x['votes']:<4} q{x['qty']} w{x['words']:<4} {x['url']}")
    json.dump(res[:3], open(f"{OUT}/{did}.json", "w"), ensure_ascii=False, indent=1)
