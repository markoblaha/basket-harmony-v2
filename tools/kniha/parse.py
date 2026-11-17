# Prevod riadku suroviny (CZ/SK) na (kľúč potraviny, množstvo, jednotka, gramy).
# Gramy z jednotky: g/kg/dkg priamo, ml/l/dl cez hustotu, lyžica/lyžička/kus z databázy potravín (foods.json + EXTRA).
import os
from pathlib import Path
# Pracovné dáta (zoznamy adries z webov, stiahnuté recepty, výsledky) nie sú v gite: priečinok KNIHA_DATA (predvolene tools/kniha/data).
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
os.chdir(DATA)
import json, re, unicodedata
from pathlib import Path
HERE = Path(__file__).parent
FOODS = json.load(open(DATA / "foods.json"))

def fold(s):
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()

# Nové potraviny (do foods.ts sa doplnia s USDA hodnotami): g = kus, lyz/lyzk = g v lyžici/lyžičke, dens = g/ml.
EXTRA = {
    "muka_polohruba": dict(name="Polohrubá múka", g=None, lyz=10, lyzk=3, dens=0.6),
    "muka_hruba": dict(name="Hrubá múka", g=None, lyz=12, lyzk=4, dens=0.65),
    "zemiaky": dict(name="Zemiaky", g=150, lyz=15, lyzk=5, dens=1),
    "pazitka": dict(name="Pažítka", g=None, lyz=3, lyzk=1, dens=1),
    "petrzlenova_vnat": dict(name="Petržlenová vňať", g=None, lyz=4, lyzk=1.3, dens=1),
    "zvazok": dict(name="", g=None, lyz=0, lyzk=0, dens=1),
    "spagety": dict(name="Špagety", g=None, lyz=15, lyzk=5, dens=1),
    "guanciale": dict(name="Guanciale / pancetta", g=None, lyz=15, lyzk=5, dens=1),
    "pecorino": dict(name="Pecorino", g=None, lyz=6, lyzk=2, dens=1),
    "zltok": dict(name="Vaječný žĺtok", g=18, lyz=15, lyzk=5, dens=1),
    "majoneza": dict(name="Majonéza", g=None, lyz=14, lyzk=5, dens=0.95),
    "hrasok": dict(name="Hrášok", g=None, lyz=12, lyzk=4, dens=0.7),
    "salama": dict(name="Saláma / šunka", g=None, lyz=15, lyzk=5, dens=1),
    "jablko": dict(name="Jablko", g=180, lyz=15, lyzk=5, dens=1),
    "cukor_mly": dict(name="Práškový cukor", g=None, lyz=8, lyzk=3, dens=0.56),
    "cukor_vanil": dict(name="Vanilkový cukor", g=None, lyz=12, lyzk=4, dens=0.8),
    "kakao": dict(name="Kakao", g=None, lyz=7, lyzk=2.5, dens=0.5),
    "rum": dict(name="Rum", g=None, lyz=15, lyzk=5, dens=0.95),
    "citron_kora": dict(name="Citrónová kôra", g=None, lyz=6, lyzk=2, dens=1),
    "cream_cheese": dict(name="Krémový syr (žervé, Philadelphia)", g=None, lyz=15, lyzk=5, dens=1),
    "susienky": dict(name="Sušienky (Bebe, digestive)", g=None, lyz=8, lyzk=3, dens=1),
    "skrob": dict(name="Kukuričný škrob (Solamyl)", g=None, lyz=10, lyzk=3, dens=0.6),
    "zemiaky_varene": dict(name="Zemiaky uvarené", g=150, lyz=15, lyzk=5, dens=1),
    "mineralka": dict(name="Sóda / minerálka", g=None, lyz=15, lyzk=5, dens=1, free=True),
    "pivo": dict(name="Pivo", g=None, lyz=15, lyzk=5, dens=1),
    "vino": dict(name="Víno", g=None, lyz=15, lyzk=5, dens=1),
    "hovadzie_vyvar": dict(name="Vývar", g=None, lyz=15, lyzk=5, dens=1),
    "kmin": dict(name="Rasca", g=None, lyz=6, lyzk=2, dens=1),
    "paprika_pal": dict(name="Pálivá paprika mletá", g=None, lyz=7, lyzk=2.5, dens=1),
    "zemiakovy_skrob": dict(name="Zemiakový škrob", g=None, lyz=10, lyzk=3, dens=0.6),
    "chlieb_krutony": dict(name="Chlieb na krutóny", g=40, lyz=15, lyzk=5, dens=1),
    "vyvar_kocka": dict(name="Bujón (kocka)", g=10, lyz=15, lyzk=5, dens=1),
    "syr_tvrdy": dict(name="Tvrdý syr", g=None, lyz=6, lyzk=2, dens=1),
    "bravcove_karé": dict(name="Bravčové karé", g=150, lyz=15, lyzk=5, dens=1),
    "smotana_kysla": dict(name="Kyslá smotana", g=None, lyz=15, lyzk=5, dens=1.0),
}
def food(k):
    return FOODS.get(k) or EXTRA.get(k) or {}

# Poradie je dôležité: špecifické pred všeobecným. Vzor na zloženom (bez diakritiky) texte suroviny.
RULES = [
    (r"^.{0,40}:$|^(volitel|podle chuti|na ozdob|na posyp|navic|dale|dalsi|zalivka|testo|cesto|naplne|naplni|na testo|na cesto|na krem|krem|poleva|na polevu|korpus|na korpus|na zdobeni|omacka|na omacku|halusky|na halusky|zalievka|plnka|na plnku)\b.{0,25}$", "SKIP_head"),
    (r"\bsodovk|mineral|perliv", "mineralka"),
    (r"bramborov\w* halusk|halusk\w* (baleni|hotov|susen|z obchod)", "SKIP_halusky_hotove"),
    (r"varen\w* brambor|uvaren\w* brambor|brambor\w* uvaren|brambor\w* varen\w* ve slupce|zemiak\w* uvaren|uvaren\w* zemiak|varen\w* zemiak", "zemiaky_varene"),
    (r"brambor|zemiak", "zemiaky"),
    (r"polohrub", "muka_polohruba"),
    (r"hrub\w* mouk|hrub\w* muk|mouk\w* hrub|muk\w* hrub", "muka_hruba"),
    (r"bramborov\w* skrob|zemiakov\w* skrob", "zemiakovy_skrob"),
    (r"skrob|solamyl|maizen|gustin|pudinkov\w* prasek|pudink", "skrob"),
    (r"prasek do peciva|kypric|prasok do peciva|prasku do peciva|kyprici|kypriaci|peciv\w* prasek", "prasok"),
    (r"mouk|muk[ay]\b|muka|muky|mouka", "muka"),
    (r"bryndz|brynz", "bryndza"),
    (r"vanilk\w* extrakt|vanilk\w* past|vanilk\w* lusk|vanilkov\w* aroma|^vanilka|vanilkov\w* esenc", "vanilka"),
    (r"liker|likeru", "liker"),
    (r"ricott", "ricotta"),
    (r"smetanov\w* syr|smetanov\w* kremov\w* syr|philadelph|cream cheese|zerve|lucin|krem\w* syr|smetanov\w* syr|mascarpon|syr\w* typu|tavenym syr|natiratel", "cream_cheese"),
    (r"zakysan\w* smetan|kysl\w* smotan|kysan\w* smetan|zakysank", "kysla_smotana"),
    (r"smetan\w* (ke|na) slehan|smotan\w* na slahan|slehack|sladk\w* smetan|sladk\w* smotan|smetan\w* 3[0-9]|smotan\w* 3[0-9]|3[0-9] ?% smetan|3[0-9] ?% smotan", "smotana_sladka"),
    (r"smetan\w* na vaeni|smetan\w* na vareni|smotan\w* na varenie|cooking cream", "smotana"),
    (r"smetan|smotan", "smotana_sladka"),
    (r"zloutk|zltk|zltok|zloutek", "zltok"),
    (r"bilk|bielk", "vajce_bielok"),
    (r"vejc|vajic|vajec|vajca|vajce|vajci|vajick|vajicko", "vajce"),
    (r"rozink|hrozien", "hrozienka"),
    (r"brusin|brusnic", "brusnice"),
    (r"hrebic|klinc", "klincek"),
    (r"badyan|anyz|anis", "badyan"),
    (r"pernikov\w* koren", "pernikove_korenie"),
    (r"kari koren|\bkari\b|curry", "kari_korenie"),
    (r"rozmaryn", "rozmaryn"),
    (r"kokos", "kokos"),
    (r"cokolad|granko", "cokolada"),
    (r"marmelad|dzem|lekvar|povidl|nutell|merunkov\w* dzem", "dzem"),
    (r"jahod|malin|boruvk|cucoried|ovoc|banan|broskv|merunk|marhul|tresn|visn|ostruzin|ribiz|rybiz", "ovocie"),
    (r"orech|orisk|mandl|liskov|lieskov|kesu|pistac|arasid", "orechy"),
    (r"zampion|sampinon|houb|hub\b|huby|hrib|hliv", "sampinony"),
    (r"polevkov\w* zelenin|polievkov\w* zelenin|korenov\w* zelenin|zelenin\w* na polev", "zelenina_polievkova"),
    (r"margarin|rama|perla|flora", "tuk"),
    (r"gulasov\w* koren|gulasov\w* korenie|koren\w* na gulas", "gulas_korenie"),
    (r"polevkov\w* koren|maggi|podravk|veget|masox|dochucov|sojov\w* omack|worcester|liboc|libec|glutaman", "dochucovadlo"),
    (r"\bkren|\bkren\b", "kren"),
    (r"salotk|salotka", "cibula"),
    (r"feferon|ostr\w* papric|paliv\w* papric|jalapen", "chilli"),
    (r"\bleco\b|lecho", "leco"),
    (r"jisk|zapražk|zaprazk|zasmazk", "jiska"),
    (r"oregan|dobromysl", "oregano"),
    (r"tymian", "tymian"),
    (r"vlock", "vlocky"),
    (r"mlet\w* (vepr\w* |hovez\w* |smes\w* |veprove\w* a hovez\w* )?mas|mlet\w* (vepr|hovez|smes)|mlete maso|mleteho masa", "mlete"),
    (r"\bryz|\bryze|\bryzi|\bryza|ryze\b", "ryza"),
    (r"pasirovan\w* rajc|passat|drcen\w* rajc|krajen\w* rajc|rajcat\w* v plech|pasirovan\w* paradaj|sekan\w* rajc|loupan\w* rajc", "pasirovane"),
    (r"listov\w* test|listkov\w* cest|lístkov\w* cest|listov\w* cest", "listkove_cesto"),
    (r"strudlov\w*|testo na strudl|filo|fillo|tazen\w* test", "strudlove_cesto"),
    (r"krupic(e|i|a|ou)\b|krupici\b|detsk\w* krupic", "krupica"),
    (r"\bmak\b|\bmaku\b|makem|mletý mák|mlety mak", "mak"),
    (r"kopr|kopor", "kopor"),
    (r"anglick\w* slanin|slanin|spek|bacon|oravsk", "slanina"),
    (r"guanciale|pancett", "guanciale"),
    (r"uzen\w* mas|uzen\w* vepr|udene|udeneho|uzene|uzeneho|uzenin|uzen\w* kolen|uzen\w* zebr|udene rebr|udenin|koleno|zebirk|rebierk|kotlet\w* uzen", "udene"),
    (r"klobas|klobás|klobask|kolbas", "klobasa"),
    (r"kysan\w* zel|kysel\w* zel|kysl\w* kapust|kysan\w* kapust|kapust|\bzeli\b|zelí|zeli\b|zelim|zela\b", "kapusta"),
    (r"susen\w* (houb|hrib|hub)|hrib|suchych hub|suchy hub|susen\w* hub", "huby_susene"),
    (r"svestk|slivk|slivky|sviestk", "slivky"),
    (r"pecorin", "pecorino"),
    (r"parmez|parmaz|parmigian|grana padano", "parmezan"),
    (r"tvaroh", "tvaroh"),
    (r"emental|eidam|gouda|tvrd\w* syr|syr\b|syra\b|syrem\b|syru\b", "syr_tvrdy"),
    (r"susen|bebe|digestiv|keks|piskot|sušenk|lasti", "susienky"),
    (r"majonez|tatarsk", "majoneza"),
    (r"hrasek|hrasok|hrach", "hrasok"),
    (r"salam|sunk|sunka|vurt|moravsk\w* salam|gothaj|parky|parek", "salama"),
    (r"kyselou okurk|kysele okurk|sterilovan\w* okurk|nakladan\w* okurk|okurk\w* steril|kysl\w* uhor|steriliz\w* uhor|cornich|okurk|uhork", "uhorky_kysle"),
    (r"nalev|lak z okur|lak zo|nalevu", "nalev"),
    (r"jabl", "jablko"),
    (r"bujon|kostk|kock|bouillon|masox", "vyvar_kocka"),
    (r"vyvar|vyvaru", "vyvar"),
    (r"(\bpivo|\bpiva|\bpivem)", "pivo"),
    (r"vino|vina\b|vinem", "vino"),
    (r"krkovic|krkovick|krkovicka", "krkovicka"),
    (r"vepr\w* kotlet|karé|kare\b|vepr\w* panenk|vepr\w* ky[tk]|vepr\w* maso|vepr\w* plec|vepr\w* rizk|vepr|bravcov|rizky z|maso na rizk|plec|rizk", "bravcove_stehno"),
    (r"kurec\w* steh|kurac\w* steh|stehna|stehno|stehen|horni stehn", "kuracie_stehna"),
    (r"kurec\w* prs|kurac\w* prs|prsicka|prsa", "kuracie_prsia"),
    (r"kure|kuraci|kurec|kurca|kurc", "kurca"),
    (r"hovez|hovadz|kliz|kyta|predni|zadni|loupan\w* plec|plec|maso na gulas|gulasov\w* maso", "hovadzie"),
    (r"sadl|mast|sadlo", "mast"),
    (r"maslem|masl|maslo", "maslo"),
    (r"rostlinn\w* tuk|hera|palmarin|zlat\w* hera|tuk", "tuk"),
    (r"olivov\w* olej", "olivovy_olej"),
    (r"olej", "olej"),
    (r"cervena cibul|cervene cibul|cervenou cibul|cervena cibula|cervenu cibul", "cervena_cibula"),
    (r"jarn\w* cibul|zelen\w* cibul|cibulk", "jarna_cibulka"),
    (r"cibul", "cibula"),
    (r"cesnek|cesnak|strouzk|strucik|strucek", "cesnak"),
    (r"mrkev|mrkv", "mrkva"),
    (r"celer|zeler", "zeler"),
    (r"petrzelov\w* nat|petrzlenov\w* vnat|petrzelk|kudrnk|petrzel\w* nat|petrzlen\w* vnat|natka|vnat|petruzel", "petrzlenova_vnat"),
    (r"petrzel|petrzlen|pastrnak", "petrzlen"),
    (r"pazitk", "pazitka"),
    (r"porek|porik|por\b", "porik"),
    (r"kopr|kopor", "kopor"),
    (r"paprikov\w* lusk|paprik\w* (cerven|zelen|zlut)|kapi|lusk|zelen\w* paprik", "paprika"),
    (r"paliv\w* paprik|paprik\w* paliv|chilli|chili|kajensk|kajen", "chilli"),
    (r"paprik", "paprika_mleta"),
    (r"rajcatov\w* protlak|protlak|pretlak|paradajkov\w* pretlak|kecup", "pretlak"),
    (r"rajc|paradaj", "paradajky"),
    (r"majorank|majoran", "majoran"),
    (r"kmin|rasc|rasca", "rasca"),
    (r"bobkov|vavrin|bobk", "bobkovy_list"),
    (r"nove koreni|nove korenie|novym korenim|nov\w* koren", "nove_korenie"),
    (r"pepr|pepr\w* cel|korenie|cierne koren|cern\w* koren|kulick", "korenie"),
    (r"muskat", "muskat"),
    (r"skoric", "skorica"),
    (r"skoricov\w* cukr|skoricov\w* cukor", "skoricovy_cukor"),
    (r"merunk|marhul", "marhule"),
    (r"salam|sunkov\w* salam", "salama"),
    (r"koren\w* na mlet\w* mas", "korenie_mlete_maso"),
    (r"vanilkov\w* cukr|vanilin\w* cukr|vanilk\w* cukor|vanilin|vanilk|vanilin", "cukor_vanil"),
    (r"mouckov\w* cukr|moucn\w* cukr|prask\w* cukor|praskov\w* cukor|mlet\w* cukr|cukr moucka|moucka", "cukor_mly"),
    (r"cukr|cukor|krystal", "cukor"),
    (r"kakao|kakaa|kakaem", "kakao"),
    (r"\brum|rumov\w* aroma|rumu", "rum"),
    (r"citronov\w* kur|citronov\w* kor|kura z citr|kury z citr|kora z citr|nastrouhan\w* kur", "citron_kora"),
    (r"citron", "citron"),
    (r"mleko|mlieko|mleka|mliek|mlekem|mliekom", "mlieko"),
    (r"drozd|kvasnic|drozdie", "drozdie"),
    (r"ocet|ocot|octa|octem", "ocot"),
    (r"horcic", "horcica"),
    (r"strouhank|struhank", "struhanka"),
    (r"spaget|spaghet|testovin|cestovin|linguin|bucatin|rigaton|tagliatel", "spagety"),
    (r"rohlik|rozok|rozk|zeml|housk", "rozok"),
    (r"chleb|chlieb|veka|bagetk|toust|krajic|kruton|topink", "chlieb"),
    (r"voda|vody|vodou|vodu|vod\b", "voda"),
    (r"sul\b|soli\b|sol\b|soľ|osolit|\bsul|sul,|morsk\w* sul", "sol"),
]
CR = [(re.compile(p), k) for p, k in RULES]

UNITS = [
    (r"kg|kil\w*", "kg"), (r"dkg|dag|deka", "dkg"), (r"g|gr|gramu|gramov|gramy|gram", "g"),
    (r"ml|mililitr\w*", "ml"), (r"dl|dcl|dc|decilitr\w*|deci", "dl"), (r"l|litr\w*|liter|litre", "l"),
    (r"kl|cl|lzick\w*|lzicek|lyzick\w*|lyziciek|kavov\w* lzick\w*|cajov\w* lzick\w*", "lyzicka"),
    (r"pl|lzic\w*|lyzic\w*|polevkov\w* lzic\w*|polievkov\w* lyzic\w*|vrchovat\w* lzic\w*|zarovnan\w* pl|zarovnan\w* lzic\w*", "lyzica"),
    (r"hrnek|hrnk[uy]|hrnicek|hrnicky|hrncek|hrnceky|hrncek|salk[ay]|salek|cup", "hrnek"),
    (r"strouzk\w*|strouzek|strucik\w*|strucek|stroužk\w*", "strucik"),
    (r"spet\w*|stip\w*", "stipka"),
    (r"kulic\w*|zrnk\w*|zrn\b", "zrnko"),
    (r"ks|kus\w*|kusy|kusov", "ks"),
    (r"platk\w*|platek|platok|platky", "platok"),
    (r"baleni|balicek|balick\w*|bal\.?|balenie|sacek|sacky|sacok|sacku|kelimek|kelimk\w*|vanicka|vanick\w*|kostk\w*|kocka|kocky|tabulk\w*|tycink\w*|konzerv\w*|plechovk\w*|sklenic\w*|pohar\w*", "pack"),
    (r"svazek|svazk\w*|zvazok|zvazk\w*|svazecek", "zvazok"),
    (r"hrst\w*|hrsti", "hrst"),
    (r"vetvick\w*|stonk\w*|snitk\w*", "vetvicka"),
]
UR = [(re.compile(r"^(" + p + r")\b\.?\s*"), u) for p, u in UNITS]
NUM = re.compile(r"^\s*(cca\.?|asi|priblizne|zhruba|max\.?|min\.?)?\s*(\d+\s*/\s*\d+|\d+(?:[.,]\d+)?|½|¼|¾|⅓|⅔)(?:\s*(?:-|–|az|až|do)\s*(\d+(?:[.,]\d+)?))?\s*")
FR = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3}
WORDN = {"jeden": 1, "jedna": 1, "jedno": 1, "dva": 2, "dve": 2, "tri": 3, "ctyri": 4, "styri": 4, "pul": 0.5, "pol": 0.5, "pet": 5}

# Balenie (g alebo ml) podľa potraviny, keď recept píše „1 balenie / kelímek / sáček“.
PACK = {"vyvar_kocka": 10, "prasok": 12, "cukor_vanil": 20, "drozdie": 42, "smotana_sladka": 200, "smotana": 200, "kysla_smotana": 200, "bryndza": 250, "tvaroh": 250,
        "cream_cheese": 200, "maslo": 250, "tuk": 250, "vyvar": 10, "pretlak": 70, "susienky": 130, "skrob": 40, "majoneza": 250, "hrasok": 400,
        "spagety": 500, "mascarpone": 250, "salama": 100, "uhorky_kysle": 670}
PIECE = {"vyvar_kocka": 10, "cibula": 120, "cesnak": 40, "mrkva": 80, "petrzlen": 70, "zeler": 300, "zemiaky": 150, "zemiaky_varene": 150, "vajce": 55, "zltok": 18,
         "vajce_bielok": 33, "paprika": 150, "paradajky": 120, "jablko": 180, "citron": 120, "bobkovy_list": 0.2, "nove_korenie": 0.3,
         "uhorky_kysle": 40, "chlieb": 40, "slanina": 15, "salama": 15, "bravcove_stehno": 125, "kuracie_stehna": 250, "kuracie_prsia": 200,
         "vyvar": 10, "drozdie": 42, "jarna_cibulka": 20, "porik": 150, "kurca": 1300, "krkovicka": 150, "citron_kora": 2, "spagety": 100}
LYZ = {"muka": 10, "muka_polohruba": 10, "muka_hruba": 12, "cukor": 12, "cukor_mly": 8, "sol": 18, "olej": 13, "maslo": 15, "mast": 13, "tuk": 13,
       "paprika_mleta": 7, "kakao": 7, "kysla_smotana": 15, "smotana_sladka": 15, "smotana": 15, "mlieko": 15, "majoneza": 14, "horcica": 15,
       "pretlak": 17, "skrob": 10, "cukor_vanil": 12, "rasca": 6, "majoran": 2, "korenie": 7, "ocot": 15, "rum": 15, "struhanka": 8,
       "pazitka": 3, "petrzlenova_vnat": 4, "kopor": 3, "voda": 15, "citron": 15, "prasok": 10, "chilli": 7, "parmezan": 6, "pecorino": 6,
       "med": 21, "bryndza": 20, "tvaroh": 20, "cream_cheese": 15, "zemiakovy_skrob": 10, "nalev": 15}
DENS = {"olej": 0.92, "olivovy_olej": 0.92, "mlieko": 1.03, "smotana_sladka": 1.0, "smotana": 1.0, "kysla_smotana": 1.0, "voda": 1, "vyvar": 1,
        "muka": 0.55, "muka_polohruba": 0.6, "muka_hruba": 0.65, "cukor": 0.85, "cukor_mly": 0.56, "ocot": 1, "rum": 0.95, "pivo": 1, "vino": 1,
        "maslo": 0.95, "mast": 0.92, "tuk": 0.92, "med": 1.4, "struhanka": 0.45, "kakao": 0.5, "majoneza": 0.95, "nalev": 1, "mineralka": 1}

def num(s):
    s = s.replace(",", ".").replace(" ", "")
    if "/" in s:
        a, b = s.split("/")
        return float(a) / float(b)
    return FR.get(s) or float(s)

# Kľúče výberu → kľúče databázy potravín v appke (foods.ts); prevody (kus, lyžica, hustota) sa berú z appky.
APP = {"cream_cheese": "kremovy_syr", "guanciale": "slanina", "zemiaky_varene": "zemiaky", "syr_tvrdy": "eidam", "huby_susene": "huby_susene"}

def appfood(key):
    return FOODS.get(APP.get(key, key))

def grams(key, qty, unit, text=""):
    """Gramy pre množstvo; None = nedá sa určiť. Rovnaké prevody ako toGrams v appke (logic.ts)."""
    if qty is None: return None
    af = appfood(key)
    if af:
        if unit in ("ml", "dl", "l", "hrnek"):
            return qty * {"ml": 1, "dl": 100, "l": 1000, "hrnek": 250}[unit] * af["dens"]
        if unit == "lyzica": return qty * af["lyz"]
        if unit == "lyzicka": return qty * af["lyzk"]
        if unit == "hrst": return qty * (10 if af["lyz"] <= 7 else 30)
        if unit == "pack" and af.get("g") and key in ("cukor_vanil", "prasok", "skoricovy_cukor"): return qty * af["g"]
        if unit == "platok": return qty * (af.get("g") or 15)
        if unit in ("ks", None) and af.get("g"):
            return qty * af["g"]  # ako v appke: veľkosť („veľká cibuľa“) sa neprepočítava
    if unit == "g": return qty
    if unit == "kg": return qty * 1000
    if unit == "dkg": return qty * 10
    ml = {"ml": 1, "dl": 100, "cl": 10, "l": 1000, "hrnek": 250}.get(unit)
    if ml: return qty * ml * DENS.get(key, food(key).get("dens", 1))
    if unit == "lyzica": return qty * LYZ.get(key, food(key).get("lyz", 15))
    if unit == "lyzicka": return qty * LYZ.get(key, food(key).get("lyz", 15)) / 3
    if unit == "stipka": return qty * 0.5
    if unit == "strucik": return qty * 5
    if unit == "platok": return qty * (15 if key in ("slanina", "salama") else 25)
    if unit == "pack":
        p = PACK.get(key)
        return qty * p if p else None
    if unit == "hrst": return qty * 30
    if unit == "zrnko": return qty * 0.06
    if unit == "zvazok": return qty * 30
    if unit == "vetvicka": return qty * 2
    if unit in ("ks", None):
        g = PIECE.get(key) or food(key).get("g")
        if g is None: return None
        f = 1.0
        t = fold(text)
        if re.search(r"\bmal[ae\w]*\b|mensi|menši|maličk", t): f = 0.7
        if re.search(r"\bvelk\w*|vetsi|väčš|vacs", t): f = 1.4
        return qty * g * f
    return None

def parse(line):
    """→ dict(key, qty, unit, g, text) alebo key=None."""
    t = fold(line).strip()
    t = re.sub(r"\(.*?\)", " ", t).strip()
    qty = None; unit = None
    m = NUM.match(t)
    if m and m.group(2):
        a = num(m.group(2)); b = m.group(3)
        qty = (a + num(b)) / 2 if b else a
        t = t[m.end():]
    else:
        w = t.split(" ")[0] if t else ""
        if w in WORDN: qty = WORDN[w]; t = t[len(w):].strip()
    for r, u in UR:
        mm = r.match(t)
        if mm: unit = u; t = t[mm.end():]; break
    # „250g“ bez medzery
    if qty is None:
        m2 = re.match(r"^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|dl|l)\b", t)
        if m2: qty = num(m2.group(1)); unit = m2.group(2); t = t[m2.end():]
    key = None
    for r, k in CR:
        if r.search(t): key = k; break
    implicit = qty is not None and unit is None
    if implicit: unit = "ks"
    serve = bool(re.search(r"na (smazeni|vymazani|vymaz|vysypani|vysyp|posypani|posyp|poprasen|ozdob|potreni|podavani|servirovani|obaleni|pomazani|smazenie|vymastenie|vysypanie|posypanie|ozdobenie|potretie|podavanie|osmazeni|opeceni|vypraz)|dle chuti|podle chuti|podla chuti|dle potreby|podle potreby|podla potreby|na dochuceni|k podavani|k servirovani|na formu|do formy|formu|vytreni|na vytren", fold(line)))
    if implicit and key in PACK and qty <= 3 and key in ("prasok", "cukor_vanil", "drozdie", "pudink", "skrob", "vyvar"): unit = "pack"; implicit = False
    if key == "paprika_mleta" and unit == "ks" and not re.search(r"mlet|sladk|lzic|lzick|prasek", t): key = "paprika"
    if key == "korenie" and re.search(r"cel\w* pepr|pepr\w* cel|kulick|zrnk|cel\w* koren", t): key = "korenie_cele"
    g = grams(key, qty, unit, t) if key else None
    mz = re.search(r"z (\d+|jednoho|jedneho|1/2|pul|pol) citron", t)
    if key == "citron_kora" and qty is None and mz:
        n = {"jednoho": 1, "jedneho": 1, "1/2": 0.5, "pul": 0.5, "pol": 0.5}.get(mz.group(1)) or float(mz.group(1)); qty = n; unit = "ks"; g = n * 3
    if implicit and qty > 12: g = None  # „200 brynza“ bez jednotky – neisté
    return dict(key=key, qty=qty, unit=unit, g=g, text=line, serve=serve and qty is None)

if __name__ == "__main__":
    import sys
    for l in sys.argv[1:]: print(parse(l))
