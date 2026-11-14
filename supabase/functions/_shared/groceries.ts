// Slovník bežného sortimentu potravín a drogérie (slovensky, v tvare, ako ich ľudia vyslovujú).
// Živý prepis reči (voice-live-token → customVocabulary) podľa neho lepšie rozpozná menej časté slová
// („majoránka“, „bobkový list“, „kaleráb“). Doplnok k položkám, ktoré domácnosť kupuje najčastejšie.
// Značky sem nepatria (okrem bežných názvov druhu tovaru ako Vegeta či Jar) – dlhý zoznam značiek
// model pri šume vypisoval ako vetu (13. 11. 2026); appka takúto ozvenu slovníka spozná (isVocabEcho).

const GROUPS: Record<string, string[]> = {
  ovocie: [
    "jablká", "hrušky", "banány", "pomaranče", "mandarínky", "citróny", "limetky", "grapefruit", "hrozno", "jahody",
    "maliny", "čučoriedky", "černice", "ríbezle", "egreše", "čerešne", "višne", "slivky", "marhule", "broskyne",
    "nektárinky", "kiwi", "ananás", "mango", "melón", "vodný melón", "avokádo", "granátové jablko", "figy", "datle",
    "kokos", "liči", "papája", "marakuja", "brusnice", "pomelo", "kaki", "rebarbora",
  ],
  zelenina: [
    "zemiaky", "nové zemiaky", "mrkva", "petržlen", "zeler", "paštrnák", "cibuľa", "červená cibuľa", "jarná cibuľka", "pór",
    "cesnak", "paradajky", "cherry paradajky", "uhorky", "šalátová uhorka", "paprika", "kapia", "chilli paprička",
    "feferónky", "kapusta", "červená kapusta", "čínska kapusta", "kel", "ružičkový kel", "karfiol", "brokolica",
    "kaleráb", "cuketa", "baklažán", "tekvica", "hokkaido", "cvikla", "reďkovky", "reďkev", "hlávkový šalát",
    "ľadový šalát", "rukola", "špenát", "polníček", "kukurica", "hrášok", "zelená fazuľka", "šampiňóny", "hlivy",
    "huby", "batáty", "zázvor", "chren", "kôpor", "petržlenová vňať", "pažítka", "mäta", "klíčky", "špargľa", "fenikel",
  ],
  pecivo: [
    "chlieb", "celozrnný chlieb", "tmavý chlieb", "toastový chlieb", "rožky", "žemle", "bagety", "kaiserky",
    "croissanty", "pletenka", "vianočka", "koláč", "bábovka", "šišky", "buchty", "pagáče", "tortilly", "sucháre",
    "lístkové cesto", "kysnuté cesto", "cesto na pizzu", "strúhanka",
  ],
  mliecne: [
    "mlieko", "polotučné mlieko", "plnotučné mlieko", "bezlaktózové mlieko", "trvanlivé mlieko", "maslo", "smotana",
    "kyslá smotana", "smotana na šľahanie", "smotana na varenie", "šľahačka", "jogurt", "biely jogurt", "grécky jogurt",
    "ovocný jogurt", "kefír", "acidko", "cmar", "tvaroh", "bryndza", "syr", "eidam", "gouda", "ementál", "mozzarella",
    "parmezán", "niva", "encián", "oštiepok", "korbáčiky", "parenica", "údený syr", "tavený syr", "žervé", "cottage",
    "mascarpone", "ricotta", "feta", "balkánsky syr", "hermelín", "puding", "vajcia", "ovsené mlieko", "sójové mlieko",
    "mandľové mlieko", "margarín",
  ],
  maso: [
    "kuracie prsia", "kuracie stehná", "kuracie krídla", "celé kura", "morčacie prsia", "bravčové mäso",
    "bravčová krkovička", "bravčové karé", "bravčové plece", "bravčový bôčik", "rebierka", "hovädzie mäso",
    "hovädzia roštenka", "hovädzie zadné", "mleté mäso", "mleté hovädzie", "mleté bravčové", "teľacie mäso",
    "jahňacie mäso", "kačica", "hus", "králik", "kuracia pečeň", "losos", "treska", "pstruh", "kapor", "tuniak",
    "makrela", "sardinky", "krevety", "rybie prsty", "rybie filé",
  ],
  udeniny: [
    "šunka", "šunka od kosti", "hydinová šunka", "saláma", "chorizo", "prosciutto", "slanina", "oravská slanina",
    "klobása", "párky", "špekačky", "jaternice", "tlačenka", "paštéta", "pečeňová paštéta", "debrecínka",
    "údené mäso", "mortadela",
  ],
  trvanlive: [
    "múka", "hladká múka", "polohrubá múka", "hrubá múka", "celozrnná múka", "cukor", "kryštálový cukor",
    "práškový cukor", "trstinový cukor", "vanilkový cukor", "soľ", "morská soľ", "olej", "slnečnicový olej",
    "olivový olej", "repkový olej", "kokosový olej", "ocot", "balzamikový ocot", "ryža", "basmati ryža",
    "jazmínová ryža", "guľatozrnná ryža", "cestoviny", "špagety", "penne", "fusilli", "kolienka", "rezance",
    "lasagne", "tarhoňa", "gnocchi", "kuskus", "bulgur", "quinoa", "pohánka", "pšeno", "jačmenné krúpy",
    "ovsené vločky", "šošovica", "fazuľa", "cícer", "hrach", "prášok do pečiva", "sóda bikarbóna", "droždie",
    "sušené droždie", "želatína", "kakao", "čokoláda na varenie", "strúhaný kokos", "orechy", "vlašské orechy",
    "lieskové orechy", "mandle", "kešu", "arašidy", "pistácie", "hrozienka", "sušené slivky", "sušené marhule",
    "sezam", "ľanové semienko", "chia semienka", "slnečnicové semienka", "tekvicové semienka", "med", "džem",
    "lekvár", "arašidové maslo", "kečup", "horčica", "majonéza", "tatárska omáčka", "sójová omáčka", "tabasco",
    "pesto", "paradajkový pretlak", "pasírované paradajky", "sterilizovaná kukurica", "kyslé uhorky",
    "sterilizovaná paprika", "olivy", "kapary", "tuniak v konzerve", "fazuľa v konzerve", "kokosové mlieko",
    "bujón", "instantná polievka", "puding v prášku",
  ],
  koreniny: [
    "korenie", "čierne korenie", "mleté čierne korenie", "celé čierne korenie", "biele korenie", "nové korenie",
    "sladká paprika", "štipľavá paprika", "údená paprika", "mletá paprika", "rasca", "mletá rasca", "majoránka",
    "oregano", "bazalka", "tymián", "rozmarín", "šalvia", "bobkový list", "klinčeky", "škorica", "mletá škorica",
    "vanilka", "vanilkový struk", "muškátový oriešok", "mletý zázvor", "kurkuma", "kari", "garam masala", "kmín",
    "koriander", "chilli", "chilli vločky", "kajenské korenie", "granulovaný cesnak", "sušená cibuľa",
    "provensálske bylinky", "talianske bylinky", "grilovacie korenie", "korenie na kura", "korenie na gyros",
    "korenie na mäso", "korenie na ryby", "gulášové korenie", "perníkové korenie", "badián", "kardamom", "šafran",
    "borievky", "saturejka", "estragón", "horčičné semienko", "Vegeta", "Maggi",
  ],
  mrazene: [
    "mrazená zelenina", "mrazený hrášok", "mrazená pizza", "zmrzlina", "nanuk", "hranolky", "mrazené jahody",
    "mrazený špenát", "mrazené ryby", "pirohy", "knedle",
  ],
  sladkosti: [
    "čokoláda", "mliečna čokoláda", "horká čokoláda", "sušienky", "keksy", "oblátky", "piškóty", "cukríky", "žuvačky",
    "lízanky", "gumené cukríky", "tyčinky", "slané tyčinky", "chipsy", "krekry", "popcorn", "solené arašidy",
    "müsli tyčinky", "torta", "zákusky",
  ],
  ranajky: [
    "káva", "zrnková káva", "mletá káva", "instantná káva", "kávové kapsule", "čaj", "zelený čaj", "čierny čaj",
    "ovocný čaj", "bylinkový čaj", "müsli", "cereálie", "corn flakes", "granola",
  ],
  napoje: [
    "voda", "minerálka", "sóda", "perlivá voda", "neperlivá voda", "džús", "pomarančový džús", "jablkový džús", "sirup",
    "malinovka", "kofola", "cola", "limonáda", "ľadový čaj", "energetický nápoj", "tonik",
  ],
  alkohol: [
    "pivo", "nealkoholické pivo", "víno", "biele víno", "červené víno", "ružové víno", "šumivé víno", "prosecco",
    "šampanské", "borovička", "slivovica", "hruškovica", "vodka", "rum", "whisky", "gin", "likér", "fernet",
    "becherovka", "cider",
  ],
  drogeria: [
    "toaletný papier", "papierové utierky", "vreckovky", "servítky", "mydlo", "tekuté mydlo", "sprchový gél", "šampón",
    "kondicionér", "zubná pasta", "zubná kefka", "ústna voda", "zubná niť", "dezodorant", "krém na ruky",
    "telové mlieko", "holiaci strojček", "pena na holenie", "vložky", "tampóny", "vatové tyčinky", "odličovacie tampóny",
    "vlhčené obrúsky", "náplasti", "opaľovací krém",
  ],
  domacnost: [
    "prací prášok", "prací gél", "aviváž", "kapsuly do práčky", "odstraňovač škvŕn", "prostriedok na riad", "Jar",
    "tablety do umývačky", "soľ do umývačky", "leštidlo do umývačky", "čistič na okná", "čistiaci prostriedok", "Savo",
    "čistič na kúpeľňu", "odvápňovač", "hubky na riad", "handry", "vrecia na odpadky", "alobal", "potravinová fólia",
    "papier na pečenie", "vrecúška na zmrazovanie", "sviečky", "batérie", "žiarovky", "zápalky",
  ],
  deti: ["plienky", "detská výživa", "dojčenské mlieko", "detské piškóty", "detský krém", "detské príkrmy"],
  zvierata: ["krmivo pre psa", "krmivo pre mačku", "granule", "kapsičky pre mačky", "piesok pre mačky", "maškrty pre psa"],
  zdravie: ["vitamíny", "vitamín C", "magnézium", "kvapky do nosa", "sirup proti kašľu", "pastilky", "tablety proti bolesti"],
};

/** Celý slovník (bez duplikátov), poradie podľa oddelení. */
export const GROCERIES_SK: string[] = [...new Set(Object.values(GROUPS).flat())];
