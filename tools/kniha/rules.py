# Pravidlá variantu pre každé jedlo šarže: čo musí mať (must, „a|b“ = jedno z), čo nesmie (forbid), ktoré potraviny
# sa porovnávajú spolu (rows), čo sa neporovnáva (ignore), úkony postupu (acts: vzor v zloženom texte postupu).
FLOUR = ["muka", "muka_polohruba", "muka_hruba"]
CREAM = ["smotana_sladka", "smotana", "kysla_smotana"]
FAT = ["olej", "tuk", "mast", "maslo", "olivovy_olej"]
R = {
    "halusky": dict(
        sk=True, must=["bryndza", "zemiaky"], forbid=["zemiaky_varene", "SKIP_halusky_hotove"],
        rows={"muka": FLOUR, "smotana": CREAM, "tuk": FAT}, ignore=["voda"],
        acts={"nastrúhať zemiaky": r"nastrouh|nastruh|strouh|struh|rozmix|mixer", "cesto s múkou": r"mouk|muk[uoy]|testo|cesto",
              "variť v osolenej vriacej vode": r"vrouc|vriac|osolen\w* vod|vod\w* osolen", "kým vyplávajú": r"vyplav|vypla|na hladin",
              "slanina vyškvariť": r"vyskvar|vypec|opec|oprazi|opraz|skvar|osmaz|osmahn", "zmiešať s bryndzou": r"bryndz|brynz",
              "posypať slaninou": r"posyp|polej|prelej|prelij"}),
    "gulas": dict(
        must=["hovadzie", "cibula", "paprika_mleta"], forbid=["sampinony", "pivo", "vino", "fazula", "leco", "kren"],
        rows={"tuk": FAT, "muka": FLOUR + ["jiska"]}, ignore=["voda", "dochucovadlo"], free_q=["cukor", "ocot"],
        acts={"orestovať cibuľu": r"cibul\w*.{0,80}(osmah|orest|zpen|zlatov|sklovit|opraz|smaz)|(osmah|orest|zpen|sklovit|opraz|smaz).{0,80}cibul",
              "mäso opiecť": r"mas\w*.{0,60}(opec|orest|rest|zatahn|osmah|opraz)|(opec|orest|zatahn|osmah|opraz|pridame).{0,60}mas", "paprika": r"paprik",
              "podliať": r"podlij|podlej|zalij|zalej|podlev|vod[uy]|vyvar", "dusiť": r"dus|varim|varit|vari se|var(i|ime)", "zahustiť": r"zahust|mouk|muk|jisk|zaprask"}),
    "palacinky": dict(
        whole=False, must=["vajce", "mlieko", "muka|muka_polohruba|muka_hruba"], forbid=["tvaroh", "drozdie", "kakao"],
        rows={"muka": FLOUR, "tuk": FAT, "mlieko": ["mlieko", "voda", "mineralka"]}, ignore=["dzem"],
        acts={"rozmiešať cesto": r"rozmich|vymich|smich|smiet|smich|metl|rozsle|promich|ummich|mix", "odstáť": r"odpoc|nechame stat|nechat stat|odstat|odlezat|minut",
              "panvica s tukom": r"panev|panvic|olej|tuk|masl", "liať cesto": r"nalij|nalej|lijem|lit|nabere|naberac|vlijeme|rozlij", "otočiť": r"obrat|otoc|prevrat"}),
    "babovka": dict(
        whole=True, base="muka", must=["vajce", "muka|muka_polohruba|muka_hruba", "cukor|cukor_mly"], forbid=["drozdie", "tvaroh", "jablko"],
        rows={"muka": FLOUR, "cukor": ["cukor", "cukor_mly"], "tuk": FAT, "mlieko": ["mlieko"]}, ignore=["voda"],
        acts={"vyšľahať": r"slehat|vysleh|utre|umich|sleh|mix", "vymastiť formu": r"vymast|vymaz|vysyp|formu", "kakao do časti": r"kakao|polovin|cast",
              "piecť": r"pecte|pecem|pect|upec|\d+ ?min", "skúška špajdlou": r"spejl|spajdl|spejl|spejlem|jehl|zapich"}),
    "carbonara": dict(
        must=["spagety", "vajce|zltok"], forbid=["smotana_sladka", "smotana", "kysla_smotana", "cream_cheese", "sampinony", "cibula", "mlieko"],
        rows={"syr": ["parmezan", "pecorino", "syr_tvrdy"], "slanina": ["slanina", "guanciale", "salama"], "vajce": ["vajce", "zltok"], "tuk": FAT}, ignore=["voda"],
        acts={"uvariť cestoviny": r"uvar|varime|vari|al dente|vroucl|vriac", "opražiť slaninu": r"slanin|panc|guanc|spek|opec|osmah|opraz|orest",
              "vajcia so syrom": r"vejc|vajc|zlout|zltk", "zmiešať mimo ohňa": r"odstav|z plotny|mimo|z ohna|stahn|zchlad|neprav|nesra", "korenie": r"pepr|koren"}),
    "paprikas": dict(
        must=["kurca|kuracie_stehna|kuracie_prsia", "cibula", "paprika_mleta", "kysla_smotana|smotana_sladka|smotana"],
        forbid=["sampinony", "pretlak", "paradajky", "vino"],
        rows={"kura": ["kurca", "kuracie_stehna", "kuracie_prsia"], "smotana": CREAM, "tuk": FAT, "muka": FLOUR}, ignore=["voda"],
        acts={"orestovať cibuľu": r"cibul\w*.{0,80}(osmah|orest|zpen|zlatov|sklovit|opraz|smaz)|(osmah|orest|zpen|sklovit|opraz|smaz).{0,80}cibul",
              "opiecť mäso": r"(opec|orest|rest|zatahn|osmah|opraz).{0,80}(mas|kur|steh)|(mas|kur|steh).{0,80}(opec|orest|rest|zatahn|osmah|opraz)", "paprika": r"paprik",
              "podliať a dusiť": r"podlij|podlej|zalij|zalej|dus", "smotana s múkou": r"smetan|smotan", "zahustiť": r"zahust|mouk|muk"}),
    "cesnakova": dict(
        must=["cesnak", "zemiaky|zemiaky_varene"], forbid=["kurca", "klobasa", "sampinony", "hovadzie"],
        rows={"tuk": FAT, "zemiaky": ["zemiaky", "zemiaky_varene"], "tekutina": ["voda", "vyvar"]}, ignore=[],
        acts={"zemiaky uvariť": r"brambor|zemiak", "cesnak": r"cesnek|cesnak", "rasca/majorán": r"kmin|rasc|majoran", "chlieb opiecť": r"chleb|chlieb|krutony|topink|opec",
              "soliť a dochutiť": r"osol|dochut|sul|sol"}),
    "cheesecake": dict(
        whole=True, base="cream_cheese", must=["cream_cheese", "susienky", "vajce|zltok"], forbid=["tvaroh", "zelatina"],
        rows={"tuk": ["maslo", "tuk"], "cukor": ["cukor", "cukor_mly"], "smotana": CREAM, "vajce": ["vajce", "zltok"]}, ignore=["voda"],
        acts={"rozdrviť sušienky s maslom": r"rozdrt|rozdrv|nadrc|rozmix|drt|drv|mix", "upiecť/vtlačiť korpus": r"udus|natla|vtla|pritla|uhlad|upech|pech|predpec", "vymiešať krém": r"vymich|smich|vysleh|umich|mix",
              "piecť": r"pecte|pecem|pect|upec|troub\w* .{0,30}\d+ ?°|rur", "vychladnúť": r"vychlad|chlad|lednic|chladnic"}),
    "rezen": dict(
        must=["bravcove_stehno|krkovicka", "vajce", "struhanka", "muka|muka_polohruba|muka_hruba"], forbid=["syr_tvrdy", "salama", "cream_cheese", "bryndza"],
        forbid_name=[r"naruby|snehu|holand|brynz|naklad|olomouc|kovar|bucek|bucku|specia|minutk|sekan|gril|pivn|paliv|bylink|horcic|parmaz|kukur|jinak|cornf|tvaruz|zazvor|ledvin|hliv|hrib|omack|srbsk|dvou barev|dusen|ochucen|marinov|ananas|testick|zelen|lvi|cibul|vine|zapek|plnen|natural|kremz|belehrad|bakch|oliver|horal|stav|krehk|mlet"],
        rows={"tuk": FAT, "muka": FLOUR, "maso": ["bravcove_stehno", "krkovicka"]}, ignore=["voda", "zemiaky", "citron"],
        acts={"naklepať": r"naklep|rozklep|klep|paliček|palick", "osoliť": r"osol|sul|sol", "obaliť v trojobale": r"obal|mouk|vejc|vajc|strouhank|struhank",
              "vyprážať v tuku": r"smaz|vypraz|olej|tuk|sadl|mast", "osušiť": r"papir|ubrous|okap|odkap"}),
    "salat": dict(
        must=["zemiaky|zemiaky_varene", "majoneza", "cibula|jarna_cibulka"], forbid=["sled_x", "jogurt_x"],
        rows={"zemiaky": ["zemiaky", "zemiaky_varene"], "zelenina": ["mrkva", "petrzlen", "zeler"]}, ignore=["voda"], free_q=["cukor", "ocot"],
        acts={"uvariť zemiaky v šupke": r"slupc|supk|slupk|uvar", "olúpať a nakrájať": r"oloup|olup|nakraj|kostk", "zelenina uvariť": r"mrkev|mrkv|zelenin|celer|zeler",
              "majonéza": r"majonez", "odstáť v chlade": r"lednic|chladnic|odlez|uleh|nechame|chlad"}),
    "kapustnica": dict(
        sk=True, must=["kapusta", "udene|klobasa|slanina"], forbid=["zemiaky", "zemiaky_varene", "fazula", "kurca"],
        rows={"tuk": FAT, "muka": FLOUR, "smotana": CREAM, "huby": ["huby_susene", "sampinony"], "tekutina": ["voda", "vyvar"], "maso": ["udene", "bravcove_stehno", "slanina", "pliecko", "krkovicka"]}, ignore=[], free_q=["cukor", "ocot"],
        acts={"huby namočiť": r"namoc|namac|nambo|zalij\w* vod|houb\w*.{0,40}vod", "uvariť údené": r"uzen|uden|maso|mäso|vyvar|koleno|zebr",
              "kapusta do hrnca": r"zeli|kapust", "zápražka": r"jisk|zaprask|zapraz|mouk|muk|zahust", "klobása": r"klobas", "variť": r"var|dus", "smotana": r"smetan|smotan"}),
    "segedin": dict(
        must=["pliecko|bravcove_stehno|krkovicka", "kapusta", "paprika_mleta", "kysla_smotana|smotana_sladka|smotana"], forbid=["hovadzie", "kurca", "zemiaky", "sampinony", "udene"],
        rows={"maso": ["pliecko", "bravcove_stehno", "krkovicka"], "tuk": FAT, "muka": FLOUR, "smotana": CREAM, "tekutina": ["voda", "vyvar"]}, ignore=[],
        acts={"orestovať cibuľu": r"cibul\w*.{0,80}(osmah|orest|zpen|zlatov|sklovit|opraz|smaz)|(osmah|orest|zpen|sklovit|opraz|smaz).{0,80}cibul",
              "mäso opiecť": r"(opec|orest|rest|zatahn|osmah|opraz).{0,80}mas|mas\w*.{0,80}(opec|orest|rest|zatahn|osmah|opraz)", "paprika": r"paprik", "podliať a dusiť": r"podlij|podlej|zalij|zalej|dus",
              "kapusta": r"zeli|kapust", "smotana s múkou": r"smetan|smotan", "zahustiť": r"zahust|mouk|muk"}),
}
