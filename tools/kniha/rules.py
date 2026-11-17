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
    # ------------------------------------------------------------------ šarža 2
    "svieckova": dict(
        must=["hovadzie", "mrkva|petrzlen|zeler", "smotana_sladka|smotana|kysla_smotana"], forbid=["bravcove_stehno", "kurca"],
        forbid_name=[r"dyn|italsk|minutk|petiden|rychl|fale|vegan|kral|jelen|srnc|zverin|kure"],
        rows={"tuk": FAT, "muka": FLOUR, "smotana": CREAM, "zelenina": ["mrkva", "petrzlen", "zeler"], "tekutina": ["voda", "vyvar"]}, ignore=["knedla", "brusnice", "citron_kora"], free_q=["cukor", "ocot"],
        acts={"prešpikovať slaninou": r"prospik|spik|prerast|slanin", "opiecť mäso": r"(opec|orest|rest|zatahn|osmah|opraz).{0,80}mas|mas\w*.{0,80}(opec|orest|rest|zatahn|osmah|opraz)",
              "zelenina orestovať": r"zelenin|mrkv|celer", "korenie (bobkový list, nové korenie)": r"bobkov|nov\w* koren|pepr|kulick", "dusiť / piecť": r"dus|troub|rur|pec",
              "rozmixovať / prepasírovať omáčku": r"rozmix|mixer|propasir|prolis|pasir|sit|cedit|precedi", "smotana": r"smetan|smotan", "dochutiť": r"cukr|citron|oct|dochut"}),
    "kulajda": dict(
        must=["zemiaky", "kopor", "kysla_smotana|smotana_sladka|smotana"], forbid=["hovadzie", "kurca", "klobasa"],
        rows={"smotana": CREAM, "huby": ["sampinony", "huby_susene"], "tekutina": ["voda", "vyvar"], "muka": FLOUR, "tuk": FAT}, ignore=[], free_q=["cukor", "ocot"],
        acts={"zemiaky uvariť": r"brambor|zemiak", "huby": r"houb|hub|hrib|zampion", "smotana s múkou": r"smetan\w*.{0,80}mouk|mouk\w*.{0,80}smetan|zahust", "kôpor": r"kopr|kopor",
              "vajce": r"vejc|vajc|vajic", "ocot": r"oct|ocet"}),
    "gulasovka": dict(
        must=["hovadzie", "zemiaky", "paprika_mleta", "cibula"], forbid=["fazula", "pivo", "vino", "kurca", "klobasa"],
        rows={"tuk": FAT, "muka": FLOUR, "tekutina": ["voda", "vyvar"]}, ignore=["dochucovadlo"], free_q=["cukor", "ocot"],
        acts={"orestovať cibuľu": r"cibul\w*.{0,80}(osmah|orest|rest|zpen|zlatov|sklovit|opraz|smaz)|(osmah|orest|rest|zpen|sklovit|opraz|smaz).{0,80}cibul",
              "mäso opiecť": r"(opec|orest|rest|zatahn|osmah|opraz|pridame).{0,80}mas|mas\w*.{0,80}(opec|orest|rest|zatahn|osmah|opraz)", "paprika": r"paprik",
              "zaliať a variť": r"zalij|zalej|podlij|podlej|var|dus", "zemiaky": r"brambor|zemiak", "zahustiť": r"zahust|mouk|jisk|zaprask"}),
    "syr": dict(
        must=["syr_tvrdy", "vajce", "struhanka", "muka|muka_polohruba|muka_hruba"], forbid=["sunka", "salama", "hermelin", "kremovy_syr"],
        rows={"tuk": FAT, "muka": FLOUR}, ignore=["voda", "zemiaky", "tatarska", "majoneza", "citron"],
        acts={"nakrájať plátky": r"platk|platek|plat|kraj|kousk", "obaliť v trojobale": r"obal|trojobal|mouk|vejc|strouhank", "obaliť dvakrát": r"dvakrat|znovu|podruhe|dvojit|2x|dvojite",
              "vyprážať v tuku": r"smaz|vypraz|olej|tuk|fritov", "osušiť": r"papir|ubrous|okap|odkap"}),
    "bramboraky": dict(
        must=["zemiaky", "muka|muka_polohruba|muka_hruba", "cesnak|majoran"], forbid=["tvaroh", "kysla_smotana", "slanina", "klobasa", "mlete"],
        rows={"tuk": FAT, "muka": FLOUR}, ignore=["voda"],
        acts={"nastrúhať zemiaky": r"strouh|struh|nastrouh", "vyžmýkať / scediť": r"vymack|vyzdim|vymacka|scedi|slij|slej|prebyt|vod", "cesnak a majorán": r"cesnek|majoran",
              "cesto": r"testo|mouk|vejc|promich|smich", "smažiť na tuku": r"smaz|osmah|opec|pan|sadl|olej", "tenké placky": r"plack|rozprostr|rozetr|tenk|lzic"}),
    "plnena_paprika": dict(
        must=["paprika", "mlete|bravcove_stehno|hovadzie", "ryza", "pretlak|paradajky|pasirovane"], forbid=["kurca", "kuracie_prsia", "syr_tvrdy", "zemiaky"],
        rows={"maso": ["mlete", "bravcove_stehno", "hovadzie"], "omacka": ["pretlak", "paradajky", "pasirovane"], "muka": FLOUR, "tuk": FAT, "tekutina": ["voda", "vyvar"]}, ignore=[], free_q=["cukor", "ocot"],
        acts={"ryža": r"ryz|ryž|ryže", "naplniť papriky": r"naplni|plnim|plnit|naplnte|naplnime|plnku|napln", "paradajková omáčka": r"rajsk|rajc|protlak|omack|paradaj",
              "dusiť / variť": r"dus|var|pec", "zahustiť": r"zahust|jisk|mouk|zaprask", "osladiť": r"cukr|oslad|dochut"}),
    "sekana": dict(
        must=["mlete|bravcove_stehno|hovadzie", "vajce", "chlieb|struhanka"], forbid=["kurca", "kuracie_prsia", "syr_tvrdy", "sampinony"],
        rows={"maso": ["mlete", "bravcove_stehno", "hovadzie"], "pecivo": ["chlieb", "struhanka"], "tuk": FAT, "mlieko": ["mlieko", "voda"]}, ignore=[], free_q=["cukor"],
        acts={"namočiť pečivo": r"namoc|namac|rozmoc|mlek|vymack", "cibuľa": r"cibul", "zmiešať": r"smich|promich|zaprac|hnet|prohnet|smes",
              "tvarovať šišku": r"tvar|bochnik|sisk|vek|forem|pekac|valec", "piecť": r"pec|troub|rur", "podlievať": r"podlev|podlij|polev|prelev|vypek"}),
    "knedle": dict(
        must=["ovocie|slivky|jablko", "tvaroh"], forbid=["drozdie", "zemiaky", "zemiaky_varene"],
        rows={"muka": FLOUR + ["krupica"], "ovocie": ["ovocie", "slivky"], "tuk": FAT, "cukor": ["cukor", "cukor_mly", "cukor_vanil"]}, ignore=["voda"],
        acts={"cesto z tvarohu": r"tvaroh|testo", "obaliť ovocie": r"obal|zabal|ovoc|svestk|merunk|jahod", "variť vo vode": r"var|vod", "kým vyplávajú": r"vyplav|na hladin|vypla",
              "posypať / poliať": r"posyp|polij|polej|prelij|maslem|maslo|cukr"}),
    "strudla": dict(
        must=["jablko", "listkove_cesto|strudlove_cesto"], forbid=["tvaroh", "mak"],
        rows={"cukor": ["cukor", "cukor_mly", "cukor_vanil"], "tuk": FAT, "pecivo": ["struhanka", "susienky"], "ovocie_suche": ["hrozienka", "orechy"]}, ignore=["voda"],
        acts={"jablká nastrúhať / nakrájať": r"jabl.{0,80}(strouh|struh|kraj|plat)|(strouh|struh|kraj|plat).{0,80}jabl", "skorica a cukor": r"skoric|cukr", "rozvaľkať cesto": r"rozvalc|vyvalc|rozvin|rozlozi|rozprostr|plat",
              "zavinúť": r"zavin|zaroln|stoc|svin", "potrieť": r"potri|potre|vajic|vejc|zlout", "piecť": r"pec|troub|rur"}),
    "lievance": dict(
        must=["muka|muka_polohruba|muka_hruba", "mlieko", "vajce"], forbid=["tvaroh", "kakao", "zemiaky"],
        rows={"muka": FLOUR, "tuk": FAT, "cukor": ["cukor", "cukor_vanil", "cukor_mly"], "kypridlo": ["drozdie", "prasok", "soda"]}, ignore=["dzem", "ovocie", "smotana_sladka", "kysla_smotana"],
        acts={"kvások / kypridlo": r"kvasek|kvask|drozd|prasek|kyprici", "cesto": r"testo|smich|rozmich|vymich|metl", "nechať kysnúť / odpočinúť": r"kyn|vykyn|odpoc|nechame|minut",
              "piecť na lievanečníku / panvici": r"livanec|lievanec|pan|plotn|lzic", "otočiť": r"obrat|otoc|prevrat", "podávať": r"podav|dzem|marmelad|smetan|tvaroh"}),
}
