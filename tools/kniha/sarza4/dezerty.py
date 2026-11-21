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

# Rozšírenie na 300 (pokyn majiteľa 21. 11.: mix SK/CZ klasík, receptov zo sveta a „wow“ nápadov; priorita 2 = svet,
# 3 = sezónne a slávnostné). Vzor hľadá české názvy v adresách receptov.
Z2 = """
torty|opera_torta|Torta Opera|2|opera
torty|tres_leches|Tres leches|2|tres-leches
torty|victoria_sponge|Victoria sponge|2|victoria
torty|citronova_torta_beze|Citrónová torta s bezé|2|citronov.*(dort|torta).*(beze|snehem|merengu)
torty|malinovo_pistaciova_torta|Malinovo-pistáciová torta|3|malin.*pistac.*dort|pistac.*malin.*dort
torty|kokosova_torta|Kokosová torta|2|kokosov[ya]-dort
torty|bananova_torta|Banánová torta s karamelom|2|bananov[ya]-dort
torty|tiramisu_torta|Tiramisu torta|2|tiramisu-dort
torty|ferrero_torta|Lieskovoorieškovo-čokoládová torta|3|ferrero|liskov.*cokolad.*dort|nugatov[ya]-dort
torty|naked_cake|Naked cake s ovocím|3|naked
torty|pavlova_torta|Bezé torta s ovocím|3|^beze.*dort|snehov[ya]-dort
torty|makova_torta|Maková torta|2|^makov[ya]-dort
torty|tvarohova_torta|Tvarohová torta|2|^tvarohov[ya]-dort
torty|jogurtova_torta|Jogurtová torta s ovocím|2|jogurtov[ya]-dort
torty|kavova_torta|Kávová torta|2|kavov[ya]-dort
torty|karamelova_torta|Karamelová torta|2|karamelov[ya]-dort
torty|cokoladovo_malinova_torta|Čokoládovo-malinová torta|2|cokoladovo-malinov[ya]-dort|malinovo-cokoladov
torty|mascarpone_torta|Torta s mascarpone a jahodami|2|dort.*mascarpone|mascarpone.*dort
torty|ovocna_piskotova_torta|Ovocná piškótová torta|2|ovocn[ya]-dort|piskotov[ya]-dort
torty|lotus_torta|Lotus torta|3|lotus.*dort
torty|marcipanova_torta|Slávnostná marcipánová torta|3|marcipan.*dort
torty|zmrzlinova_torta|Zmrzlinová torta|3|zmrzlinov[ya]-dort
torty|grilazova_torta|Grilážová torta|2|grilaz
torty|gastanova_torta|Gaštanová torta|2|kastanov[ya]-dort|gastan
torty|cokoladova_bez_muky|Čokoládová torta bez múky|2|bez-mouky.*dort|dort.*bez-mouky
torty|hruskova_torta|Hruškovo-karamelová torta|3|hruskov[ya]-dort
torty|chocolate_drip|Narodeninová drip torta|3|drip|narozeninov[ya]-dort
torty|medova_torta_spartak|Medová torta Spartak|2|spartak
cheesecaky|makovy_cheesecake|Makový cheesecake|2|^makovy-cheesecake
kolace_rezy|tarte_tatin|Tarte Tatin|2|tatin
kolace_rezy|citronovy_tart|Citrónový tart|2|citronov[ya]-tart|citronovy-kolac
kolace_rezy|clafoutis|Čerešňový clafoutis|2|clafoutis
kolace_rezy|pecan_pie|Pekanový koláč (pecan pie)|2|pekan
kolace_rezy|key_lime_pie|Limetkový koláč (key lime pie)|2|key-lime|limetkov[ya]-kolac
kolace_rezy|banoffee|Banoffee pie|2|banoffee
kolace_rezy|galette|Ovocná galette|2|galette
kolace_rezy|tekvicovy_kolac|Tekvicový koláč (pumpkin pie)|2|dynov[ya]-kolac|pumpkin
kolace_rezy|blondies|Blondies|2|blondies
kolace_rezy|jablkovy_pie|Americký jablkový koláč (apple pie)|2|apple-pie|americky-jablecny
kolace_rezy|cokoladovy_tart|Čokoládový tart|2|cokoladov[ya]-tart
kolace_rezy|frangipane_tart|Hruškový tart s mandľovým krémom|3|frangipan|hruskov[ya]-tart
kolace_rezy|bananovy_kolac_plech|Banánový koláč na plechu|2|bananov[ya]-kolac
kolace_rezy|perniky_rezy|Perník na plechu|1|^pernik$|pernik-na-plech|hrnickovy-pernik
kolace_rezy|hrnckovy_kolac|Hrnčekový koláč|1|hrnickov[ya]-kolac|bublanina-z-hrnku
kolace_rezy|zemlovka_kolac|Žmolenkový koláč s ovocím|2|drobenkov[ya]-kolac|kolac-s-drobenkou
kolace_rezy|snehove_rezy|Snehové rezy|2|snehove-rezy
kolace_rezy|salko_rezy|Karamelové rezy|2|karamelove-rezy
kolace_rezy|pudingove_rezy|Pudingové rezy s ovocím|2|pudinkove-rezy
kolace_rezy|marlenka|Medové rezy s kondenzovaným mliekom|2|marlenka
kolace_rezy|rakovy_kolac|Rebarborový koláč|2|rebarborov[ya]-kolac
kolace_rezy|slivkovy_kolac|Slivkový koláč|1|svestkov[ya]-kolac
kolace_rezy|marhulovy_kolac|Marhuľový koláč|1|merunkov[ya]-kolac
kolace_rezy|cucoriedkovy_kolac|Čučoriedkový koláč|1|boruvkov[ya]-kolac
kolace_rezy|bezlepkovy_kolac|Mandľový koláč bez múky|3|mandlov[ya]-kolac|bez-mouky.*kolac
kolace_rezy|ovsene_rezy|Ovsené rezy (flapjack)|2|flapjack|ovesne-rezy|ovesne-tycinky
kolace_rezy|kokosove_hrncek|Kokosové rezy s čokoládou (bounty)|2|bounty
kolace_rezy|brownies_cheesecake|Cheesecake brownies s malinami|3|brownies-s-malinami|malinove-brownies
kolace_rezy|bananovy_chlebik_orechy|Cuketový koláč|3|cuketov[ya]-kolac|cuketov[ya]-buchta
kolace_rezy|jablkovy_zavin_tahany|Ťahaná jablková štrúdľa|2|tazen|tahany
kysnute|kanelbullar|Švédske škoricové uzlíky (kanelbullar)|2|kanelbullar|skoricove-uzlik
kysnute|panettone|Panettone|3|panettone
kysnute|vdolky|Vdolky (lekvárové šišky)|1|^vdolky|^lividy
kysnute|bratislavske_rozky|Bratislavské rožky|1|bratislavsk
kysnute|krehke_kolace|Moravské koláče|1|moravske-kolace|frgal
kysnute|babovka_kysnuta|Kysnutá bábovka|2|kynut[ay]-babovk
kysnute|tvarohove_kolacik|Tvarohové koláčiky z kysnutého cesta|1|tvarohove-kolacky
kysnute|pletenka|Sladká pletenka|2|pletenec|pletenka|chalka
kysnute|veterniky_kysnute|Lekvárové buchtičky na pare|2|buchticky-se-sodo|buchticky
kysnute|focaccia_sladka|Sladká focaccia s hroznom|3|sladka-focaccia|focaccia-s-hroznem
kysnute|loupaky|Maslové rožky (loupáky)|1|loupak
kysnute|brioskove_buchty|Brioškové buchty s krémom (maritozzi)|3|maritozzi
kysnute|kolac_drozdi|Koláč s drobenkou a slivkami (frgál)|2|frgal
kysnute|babovky_mini|Bábovky so sušeným ovocím (Kugelhopf)|3|kugelhopf|babovka-s-rozinkami
kysnute|croissanty|Croissanty|3|croissant
kysnute|hrnckove_sisky|Krapne (fašiangové šišky)|2|krapn|masopustni-kobl
kysnute|velkonocny_baranok|Veľkonočná mazanec|3|mazanec
kysnute|skoricovy_veniec|Škoricový veniec|3|skoricovy-venec|skoricov[ya]-babka
kysnute|cokoladove_rozky|Čokoládové rožky|2|cokoladove-rohlicky|rohlicky-s-cokolad
kysnute|orechove_slimaky|Orechové slimáky|2|orechovi-sneci|orechove-sneky
zakusky|eclairs|Éclairs (veterníky po francúzsky)|2|eclair|venecky
zakusky|profiteroly|Profiteroly|2|profiterol
zakusky|cannoli|Cannoli|3|cannoli
zakusky|mille_feuille|Mille-feuille|3|mille-feuille|millefeuille
zakusky|venceky|Venčeky|1|^venecky
zakusky|ovocne_tartaletky|Ovocné tartaletky s krémom|2|tartaletk
zakusky|kokosove_kocky|Kokosové kocky (Mišove rezy)|2|misa-rezy|misovy-rezy
zakusky|punc_kocky|Punčové kocky|2|puncove-kostky
zakusky|beze_rolada|Bezé roláda s malinami|3|beze-rolada|snehova-rolada
zakusky|piskotova_rolada|Piškótová roláda s džemom|1|piskotov[ya]-rolad
zakusky|cokoladova_rolada|Čokoládová roláda|2|cokoladov[ya]-rolad
zakusky|kokosky_kosicky|Košíčky s krémom a ovocím|2|kosicky-s-kremem|ovocne-kosicky
zakusky|tiramisu_pohare|Mini tiramisu v pohári|3|tiramisu-ve-sklenic|tiramisu-v-pohar
zakusky|chlebicky_sladke|Malinové mini tortičky|3|malinove-dortiky|mini-dortiky
zakusky|griliazky|Grilážky s krémom|2|grilazky
zakusky|kremrole|Kremrole so šľahačkou|2|kremrol
zakusky|lotus_kosicky|Karamelové košíčky s orieškami|3|karamelove-kosicky
zakusky|dobos_rezy|Dobošove rezy|2|dobosove-rezy|dobos-rez
zakusky|esterhazy_rezy|Esterházy rezy|2|esterhazy-rez
zakusky|mini_pavlovy|Mini pavlovy s ovocím|3|mini-pavlov|pusinky-s-ovocem
zakusky|cupcake_zakusky|Choux s karamelom|3|choux|odpalovane-testo
cukrovie|plnene_orechy|Plnené orechy|1|plnene-orechy|orechy-plnene
cukrovie|medove_kocky|Medové kocky|2|medove-kostky|medove-rezy-s-orechy
cukrovie|vosie_hniezda|Vosie hniezda|1|vosi-hnizd
cukrovie|kokosove_gulky|Kokosové guľky s mandľou|2|kokosove-kulicky
cukrovie|marcipanove|Marcipánové koláčiky|2|marcipanov[eé]-cukrovi|marcipanove-kulicky
cukrovie|salamove_kolieska|Pracny so džemom|2|pracny-s-
cukrovie|lieskovce|Lieskovoorieškové koláčiky|2|liskovoorisk.*cukrovi|liskove-susenky
cukrovie|snehove_gule|Snehové guľky (ruské čajové)|2|snehove-koule|ruske-cajove
cukrovie|pernicky_plnene|Plnené medovníčky|2|plnene-pernicky|pernickove-srdicka
cukrovie|kokosove_beze|Kokosové bezé|2|kokosove-pusinky
cukrovie|cokoladove_lupienky|Čokoládové lupienky s orechmi|2|cokoladove-lupinky|florentin
cukrovie|mandlove_rozky|Mandľové rožky|2|mandlove-rohlicky
cukrovie|linecke_s_cokoladou|Linecké so šťavnatou čokoládou|2|linecke-s-cokolad
cukrovie|orechove_kolieska|Orechové kolieska s krémom|2|orechove-kolecka|orechova-kolecka
cukrovie|kokosove_rohy|Kokosové rožky|2|kokosove-rohlicky
cukrovie|sachovnica|Šachovnica (kakaové a vanilkové)|2|sachovnic
cukrovie|kakaove_gulky|Kakaové guľky s orechmi|2|kakaove-kulicky|ořechove-kulicky|orechove-kulicky
cukrovie|ovsene_cukrovie|Ovsené guľky|2|ovesne-kulicky
cukrovie|linecke_hviezdicky|Škoricové hviezdičky (Zimtsterne)|3|skoricove-hvezdicky|zimtstern
cukrovie|vianocne_susienky|Zázvorové sušienky|3|zazvorove-susenky|gingerbread
muffiny|jablkove_muffiny|Jablkové muffiny so škoricou|2|jablecne-muffiny
muffiny|citronove_muffiny|Citrónové muffiny|2|citronove-muffiny
muffiny|malinove_muffiny|Malinové muffiny s bielou čokoládou|2|malinove-muffiny
muffiny|mrkvove_muffiny|Mrkvové muffiny|2|mrkvove-muffiny
muffiny|cokoladove_cupcaky|Čokoládové cupcaky|2|cokoladove-cupcake
muffiny|red_velvet_cupcaky|Red velvet cupcaky|3|red-velvet-cupcake
muffiny|madlenky|Madlenky|2|madlenk|madeleine
muffiny|financiers|Mandľové finančníky|3|financ
muffiny|biscotti|Biscotti|2|biscotti|cantucci
muffiny|scones|Scones|2|scones
muffiny|maslove_susienky|Maslové sušienky|1|maslove-susenky|shortbread
muffiny|arasidove_susienky|Arašidové sušienky|2|arasidove-susenky|burakove-susenky
muffiny|double_choco_cookies|Dvojito čokoládové cookies|2|cokoladove-cookies|double
muffiny|ovsene_cookies_brusnice|Ovsené cookies s brusnicami|2|ovesne-cookies
muffiny|whoopie|Whoopie pies|3|whoopie
muffiny|amerika_palacinky_muffin|Banánovo-ovsené muffiny bez cukru|3|ovesne-muffiny|fit-muffiny
muffiny|tekvicove_muffiny|Tekvicové muffiny|3|dynove-muffiny
muffiny|snickerdoodles|Škoricové sušienky (snickerdoodles)|3|snickerdoodle|skoricove-susenky
muffiny|kokosove_susienky|Kokosové sušienky|2|kokosove-susenky
dezerty|semifreddo|Semifreddo|2|semifreddo
dezerty|baklava|Baklava|2|baklav
dezerty|churros|Churros s čokoládou|2|churros
dezerty|sufle|Čokoládové suflé|3|sufle|souffle
dezerty|lava_cake|Čokoládový fondán (lava cake)|2|fondan|lava|cokoladovy-dortik-s-tekutym
dezerty|eton_mess|Eton mess|3|eton
dezerty|trifle|Ovocný trifle|2|trifle
dezerty|zabaione|Zabaglione|3|zabaglion|zabaione
dezerty|ryzovy_puding|Ryžový puding s vanilkou|2|ryzovy-puding|rizovy-pudink|mlecna-ryze
dezerty|chia_puding|Chia puding|2|chia-puding|chia-pudink
dezerty|ovocny_sorbet|Ovocný sorbet|2|sorbet
dezerty|jahodova_pena|Jahodová pena|2|jahodov[ya]-pena
dezerty|tvarohovy_krem|Tvarohový krém s ovocím|1|tvarohov[ya]-krem
dezerty|kremove_pohare|Pohárový dezert s mascarpone a ovocím|2|pohar.*mascarpone|mascarpone.*sklenic
dezerty|karamelovy_flan|Karamelový krém (flan)|2|flan|karamelovy-krem|creme-caramel
dezerty|pecene_jablka|Pečené jablká s orechmi|1|pecena-jablka|pecene-jablko
dezerty|hruska_vo_vine|Hrušky vo víne|3|hrusky-ve-vine|hrusky-v-cervenem
dezerty|mango_lassi_dezert|Mangový dezert s kokosom|3|mangovy-dezert|mango.*kokos.*dezert
dezerty|citronovy_posset|Citrónový posset|3|posset
dezerty|affogato|Affogato|3|affogato
dezerty|banany_karamel|Karamelizované banány|2|karamelizovane-banany
dezerty|kremesovy_dezert|Vanilkový krém so šľahačkou (krém v pohári)|2|vanilkovy-krem
dezerty|bananovy_puding|Banánový puding|2|bananovy-pudink
dezerty|mochi|Mochi|3|mochi
dezerty|zmrzlina_jahodova|Jahodová zmrzlina bez zmrzlinovača|2|jahodov[ya]-zmrzlina
dezerty|nanuk_jogurt|Jogurtové nanuky|2|nanuk|jogurtove-nanuky
dezerty|ovocny_kompot|Domáci ovocný kompót|2|kompot
dezerty|crepes_suzette|Palacinky Suzette|3|suzette
dezerty|cokoladove_fondue|Čokoládové fondue|3|fondue
dezerty|jablkovy_crumble_pohar|Jablkový crumble v pohári|2|jablecny-crumble
dezerty|panna_cotta_mango|Mangová panna cotta|3|mangova-panna|panna-cotta-s-mangem
dezerty|krem_brulee_levandula|Pistáciový krém|3|pistaciovy-krem
sladke_jedla|francuzske_toasty|Francúzske toasty|2|francouzsky-toast|bundasky|chudy-rytir
sladke_jedla|lievance|Lievance|1|livanec|livance
sladke_jedla|americke_palacinky|Americké palacinky (pancakes)|2|americke-palacinky|pancake
sladke_jedla|gombovky_slivkove|Slivkové gombovky|1|svestkove-knedlik|gombov
sladke_jedla|krupicova_kasa|Krupicová kaša|1|krupicova-kase
sladke_jedla|kaiser_jahody|Jahodové knedle z tvarohového cesta|2|jahodove-knedlik
sladke_jedla|waffle|Belgické wafle|2|wafle|vafle
sladke_jedla|makove_rezance|Makové rezance|1|nudle-s-makem|makove-nudle
sladke_jedla|orechove_rezance|Orechové rezance (pirohy)|2|nudle-s-orechy
sladke_jedla|pirohy_lekvar|Pirohy s lekvárom|2|pirohy
sladke_jedla|dukatove_buchticky|Dukátové buchtičky so šodó|1|dukatove-buchticky|buchticky-se-sodo
"""
for line in Z2.strip().splitlines():
    sub, i, n, pr, rx = line.split("|", 4)
    ZOZNAM.append((i, n, sub, int(pr), rx))
def fold(s): return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
if sys.argv[1] == "sql":
    q = lambda x: x.replace("'", "''")
    v = ",\n".join(f"('{i}', '{q(n)}', 'sladke', '{'SK-CZ' if p == 1 else 'WORLD'}', null, {p}, 'planned', 'sub={s}')" for i, n, s, p, _ in ZOZNAM)
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
