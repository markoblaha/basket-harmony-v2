/*
 * Kniha receptov – skúšobná šarža 1 (17. 11. 2026).
 * Každý recept je JEDEN skutočný recept: najhodnotenejší z hlavných webov (Apetit, Vaření, Toprecepty), ktorý prešiel
 * kontrolou proti 11–20 ďalším receptom toho istého variantu (kniha-porovnanie.ts, bookCheck v kniha.ts).
 * Suroviny, množstvá aj postup sú presne podľa neho – len preložené do slovenčiny (bez reklamy, odkazov a histórie).
 * Rady „Hotové je, keď / Pozor / Tip“ majú na konci pôvod: zdroj (písmeno z porovnania), pôvodný recept
 * alebo pravidlo bezpečnosti potravín. Výživa a alergény sa počítajú zo surovín (foods.ts).
 * Obsah receptov je údaj (ako názov produktu), nie text rozhrania – preto nie je v i18n.
 */
import { COMPARE } from "./kniha-porovnanie";
import type { BookInfo, Ingredient, Recipe, Step } from "./types";

type I = [food: string, qty: number, unit: Ingredient["unit"], extra?: Partial<Ingredient>];
type S = [text: string, min: number, uses: string[], extra?: Partial<Step>];

/** Skúšobná šarža – kým ich majiteľ neschváli, majú namiesto fotky obrázok s číslom šarže. */
const BATCH = 1;

/** Pravidlá bezpečnosti potravín (pôvod rád, ktoré nie sú zo zdrojov). */
const RULE = {
  poultry: "pravidlo bezpečnosti potravín (USDA: hydina aspoň 74 °C vo vnútri)",
  eggs: "pravidlo bezpečnosti potravín (EFSA, USDA: nedovarené vajcia a rizikové skupiny)",
  leftovers: "Varené jedlo schlaď a daj do chladničky do 2 hodín, zjedz do 3–4 dní (pravidlo USDA).",
};

/** Pôvod rady zo zdroja: písmeno a web podľa adresy receptu („A – Vaření“), aby sedel aj po novom porovnaní. */
const SITE: Record<string, string> = { "vareni.cz": "Vaření", "apetitonline.cz": "Apetit", "toprecepty.cz": "Toprecepty", "labuznik.cz": "Labužník", "receptar.sk": "Receptár", "recepty.aktuality.sk": "Aktuality" };
function from(id: string, url: string) {
  const s = COMPARE[id]!.sources.find((x) => x.url === url);
  if (!s) throw new Error(`${id}: zdroj ${url} nie je v porovnaní`);
  return `zdroj ${s.k} (${SITE[s.site] ?? s.site})`;
}
/** Pôvod rady z úkonu, ktorý robia viaceré zdroje: „zdroje A, F, I“. */
function fromAct(id: string, act: string) {
  const a = COMPARE[id]!.check.acts.find((x) => x.a === act);
  if (!a?.src) throw new Error(`${id}: úkon ${act} nemá zdroje`);
  return `zdroje ${[...a.src].join(", ")}`;
}

const ings = (group: string | undefined, list: I[]): Ingredient[] =>
  list.map(([food, qty, unit, extra]) => ({ food, qty, unit, ...(group ? { group } : {}), ...extra }));

/** Kroky: zdroj kroku je vždy kotva (recept sa preberá presne), suroviny kroku sú dané (uses). */
function steps(id: string, list: S[]): Step[] {
  const anchor = COMPARE[id]!.check.anchor;
  return list.map(([text, min, uses, extra]) => ({ text, timerMin: min || null, src: anchor, uses, ...(min ? { wait: true } : {}), ...extra }));
}

/** Zdroje, porovnanie a údaje knihy z kniha-porovnanie.ts. */
function book(id: string, info: Omit<BookInfo, "sources" | "check" | "photos" | "batch">): BookInfo {
  const c = COMPARE[id]!;
  return {
    photos: 1,
    batch: BATCH,
    ...info,
    sources: c.sources.map(({ k, site, name, url, rating, votes }) => ({ k, site, name, url, ...(rating ? { rating } : {}), ...(votes ? { votes } : {}) })),
    check: {
      ...c.check,
      portions: Object.fromEntries(c.sources.filter((s) => s.portions).map((s) => [s.k, s.portions!])),
      changes: [],
    },
  };
}

/** Pri každej surovine písmená zdrojov, ktoré ju majú (podľa riadkov porovnania). */
function finish(r: Recipe): Recipe {
  const rows = r.book?.check?.rows ?? [];
  return {
    ...r,
    ingredients: r.ingredients.map((x) => {
      const row = rows.find((w) => w.foods.split("+").includes(x.food) && !w.group);
      return row ? { ...x, src: Object.keys(row.v).sort().join("") } : x;
    }),
  };
}

/* ===================================================================== cesnaková polievka */
const cesnakova: Recipe = {
  id: "cesnakova",
  name: "Cesnaková polievka (klasická česnečka)",
  category: "polievky",
  meat: "bez",
  minutes: 25,
  difficulty: 1,
  portions: 4,
  hue: 55,
  icon: "Soup",
  tags: ["klasika", "rychle"],
  source: "",
  book: book("cesnakova", {
    active: 15,
    scale: "free",
    cuisine: "Česko · Slovensko",
    tools: ["hrniec", "panvica", "dierovaná lyžica"],
    store: RULE.leftovers,
  }),
  ingredients: ings(undefined, [
    ["zemiaky", 3, "ks", { note: "väčšie, olúpané" }],
    ["cesnak", 8, "strucik", { note: "olúpaný" }],
    ["rasca", 1, "lyzicka", { label: "Rasca celá" }],
    ["vyvar", 750, "ml", { label: "Kurací vývar", note: "dá sa nahradiť bujónom alebo vodou" }],
    ["majoran", 2, "lyzicka", { note: "drhnutý" }],
    ["cibula", 1, "ks", { note: "olúpaná" }],
    ["mast", 1, "lyzica", { note: "alebo rastlinný olej", alt: ["olej"] }],
    ["sol", 0, "podla_chuti"],
    ["korenie", 0, "podla_chuti", { label: "Mleté korenie" }],
    ["majoran", 0, "podla_potreby", { ref: "majoran_c", label: "Čerstvý majorán", note: "vetvičky na podávanie (nemusí byť)", optional: true }],
  ]),
  steps: steps("cesnakova", [
    ["Zemiaky nakrájajte na väčšie kúsky a cesnak na tenké plátky.", 0, ["zemiaky", "cesnak"]],
    ["Vložte ich do hrnca, pridajte rascu a zalejte vývarom. Priveďte do varu a varte asi 15 minút, kým nebudú zemiaky takmer mäkké.", 15, ["zemiaky", "cesnak", "rasca", "vyvar"]],
    ["Pridajte sušený majorán a zemiaky vyberte dierovanou lyžicou, aby sa ďalej nerozvarili.", 0, ["majoran", "zemiaky"]],
    [
      "Cibuľu nakrájajte nadrobno. Na panvici rozohrejte masť alebo olej a cibuľu opekajte asi 5 minút dozlatista. Pridajte predvarené zemiaky, časť z nich zľahka roztlačte a spolu opekajte ešte asi 3–5 minút. Osoľte a okoreňte.",
      10,
      ["cibula", "mast", "zemiaky", "sol", "korenie"],
      { wait: false },
    ],
    [
      "Opečené zemiaky vráťte do polievky, prípadne ich rozdeľte do tanierov a zalejte horúcou cesnačkou. Podľa chuti ešte osoľte a okoreňte a podávajte ozdobené čerstvým majoránom.",
      0,
      ["zemiaky", "sol", "korenie", "majoran_c"],
      { tip: `Pre silnejší cesnakový efekt môžete pridať ďalšie 3 strúčiky cesnaku, tentoraz už prelisovaného. — ${from("cesnakova", "https://www.vareni.cz/recepty/cesnecka-se-syrem/")}` },
    ],
  ]),
};

/* ===================================================================== hovädzí guláš */
const gulas: Recipe = {
  id: "gulas",
  name: "Hovädzí guláš podľa Richarda Nováka",
  category: "hlavne",
  meat: "hovadzie",
  minutes: 150,
  difficulty: 2,
  portions: 10,
  hue: 20,
  icon: "Beef",
  tags: ["klasika"],
  source: "",
  book: book("gulas", {
    active: 30,
    scale: "free",
    cuisine: "Česko · Slovensko",
    tools: ["veľká panvica s pokrievkou", "veľký hrniec s pokrievkou"],
    store: RULE.leftovers,
  }),
  ingredients: ings(undefined, [
    ["cesnak", 6, "strucik"],
    ["sol", 0, "podla_chuti"],
    ["majoran", 1, "hrst"],
    ["cibula", 5, "ks"],
    ["vyvar", 1500, "ml", { label: "Vývar z kostí" }],
    ["muka", 0.5, "hrncek", { label: "Hladká múka" }],
    ["hovadzie", 1500, "g", { label: "Hovädzia kližka" }],
    ["rasca", 1, "lyzica", { label: "Mletá rasca" }],
    ["pretlak", 3, "lyzica"],
    ["paprika_mleta", 3, "lyzica"],
    ["korenie", 0, "podla_chuti", { label: "Mleté čierne korenie" }],
    ["mast", 5, "lyzica", { alt: ["olej"] }],
    ["chilli", 1, "stipka"],
    ["paprika_udena", 1, "lyzica"],
  ]),
  steps: steps("gulas", [
    [
      "Hovädzie mäso nakrájame na väčšie kocky, len okoreníme a na dostatočnom množstve masti prudko orestujeme rovnomerne zo všetkých strán, aby sa mäso pekne zatiahlo. Ja používam veľkú panvicu, ktorú po odstavení prikryjem pokrievkou, aby mäso nestrácalo teplotu.",
      0,
      ["hovadzie", "korenie", "mast"],
    ],
    [
      "Masť spod mäsa vlejeme do veľkého hrnca a orestujeme na nej nadrobno nasekanú cibuľu dohneda. Cibuľa tak dá gulášu peknú farbu. Malý trik, ako cibuľu nepripáliť a rovnomerne ju orestovať dohneda, spočíva v tom, že do rozpálenej hnednúcej cibule pridáme malé množstvo vody. Voda s olejom spení a cibuľa sa krásne rovnomerne zafarbí.",
      0,
      ["mast", "cibula"],
    ],
    [
      "Teraz vložíme mäso, zaprášime paprikou, podlejeme trochou vývaru, pridáme paradajkový pretlak, prikryjeme pokrievkou a dáme dusiť na miernom ohni. Podľa potreby podlievame a premiešame.",
      30,
      ["hovadzie", "paprika_mleta", "paprika_udena", "vyvar", "pretlak"],
      { heat: "mierny oheň" },
    ],
    ["Po pol hodine osolíme, pridáme rascu, premiešame a dolejeme zvyšok vývaru.", 90, ["sol", "rasca", "vyvar"]],
    [
      "Po dvoch hodinách guláš zahustíme zápražkou (z hladkej múky) pripravenou spolu s roztretým cesnakom, ale dá sa zahustiť aj strúhaným chlebom. Pridáme v dlani pomrvený majorán a štipku chilli. Guláš potom necháme prechádzať miernym varom za občasného miešania ešte asi pol hodiny.",
      30,
      ["muka", "cesnak", "majoran", "chilli"],
    ],
    [
      "Prílohu k hovädziemu gulášu si zvolíme podľa chuti – čerstvé pečivo alebo knedle všetkých druhov. Guláš podľa Richarda Nováka môžeme ozdobiť na kolieska nakrájanou cibuľou a troškou čerstvo nastrúhaného chrenu.",
      0,
      [],
    ],
  ]),
};

/* ===================================================================== segedínsky guláš */
const segedin: Recipe = {
  id: "segedin",
  name: "Segedínsky guláš",
  category: "hlavne",
  meat: "bravcove",
  minutes: 115,
  difficulty: 2,
  portions: 8,
  hue: 30,
  icon: "CookingPot",
  tags: ["klasika"],
  source: "",
  book: book("segedin", {
    active: 25,
    scale: "free",
    cuisine: "Česko · Slovensko",
    tools: ["veľký hrniec"],
    store: RULE.leftovers,
  }),
  ingredients: ings(undefined, [
    ["bocik", 600, "g"],
    ["pliecko", 600, "g"],
    ["kapusta", 750, "g"],
    ["kysla_smotana", 200, "g"],
    ["mast", 150, "g"],
    ["cibula", 3, "ks", { note: "veľké" }],
    ["paprika_mleta", 20, "g"],
    ["gulas_korenie", 10, "g"],
    ["rasca", 0, "podla_chuti", { label: "Mletá rasca" }],
    ["sol", 0, "podla_potreby"],
    ["voda", 0, "podla_potreby", { note: "na podliatie (je v postupe)" }],
    ["muka_polohruba", 2, "lyzica", { note: "asi, na zahustenie" }],
    ["knedla", 0, "podla_potreby", { label: "Kysnutá knedľa", note: "na podávanie", optional: true }],
  ]),
  steps: steps("segedin", [
    ["Bôčik aj pliecko nakrájame na kocky veľkosti sústa.", 0, ["bocik", "pliecko"]],
    ["Cibuľu olúpeme, nakrájame nahrubo a osmažíme na rozohriatej masti dozlatista.", 0, ["cibula", "mast"]],
    ["Pridáme pripravené mäso a restujeme asi 5 minút.", 5, ["bocik", "pliecko"], { wait: false }],
    [
      "Potom prisypeme korenie (papriku, korenie na guláš a rascu), ktoré orestujeme už len krátko, aby paprika nezhorkla. Podlejeme vodou, osolíme a dusíme asi 40 minút takmer domäkka.",
      40,
      ["paprika_mleta", "gulas_korenie", "rasca", "voda", "sol"],
    ],
    ["Hneď ako je mäso mäkké, pridáme pokrájanú kapustu a varíme ďalších približne 10 minút.", 10, ["kapusta"]],
    ["Nakoniec prilejeme kyslú smotanu, v ktorej rozmiešame múku, a varíme ďalších 20 minút.", 20, ["kysla_smotana", "muka_polohruba"]],
    ["Podávame s kysnutou knedľou.", 0, ["knedla"]],
  ]),
};

/* ===================================================================== kurací paprikáš */
const paprikas: Recipe = {
  id: "paprikas",
  name: "Kurací paprikáš so smotanou",
  category: "hlavne",
  meat: "kuracie",
  minutes: 65,
  difficulty: 2,
  portions: 4,
  hue: 15,
  icon: "Drumstick",
  tags: ["klasika", "deti"],
  source: "",
  book: book("paprikas", {
    active: 20,
    scale: "free",
    cuisine: "Česko · Slovensko",
    tools: ["hrniec alebo hlboká panvica"],
    store: RULE.leftovers,
  }),
  ingredients: ings(undefined, [
    ["kuracie_stehna", 800, "g", { note: "alebo chrbty, krídla" }],
    ["vyvar", 500, "ml", { label: "Hydinový vývar", note: "alebo 1 kuracia bujónová kocka" }],
    ["smotana", 200, "ml"],
    ["paprika_mleta", 25, "g"],
    ["cibula", 2, "ks"],
    ["maslo", 2, "lyzica"],
    ["muka_polohruba", 2.5, "lyzica", { note: "2–3 lyžice" }],
    ["sol", 1, "stipka"],
    ["tekute_korenie", 0, "podla_chuti", { optional: true }],
    ["cestoviny", 0, "podla_potreby", { label: "Kolienka", note: "na podávanie", optional: true }],
    ["knedla", 0, "podla_potreby", { label: "Knedľa", note: "na podávanie, namiesto kolienok", optional: true }],
  ]),
  steps: steps("paprikas", [
    [
      "Pripravíme cibuľovo-paprikový základ. Cibuľu olúpeme, nakrájame nadrobno a orestujeme na masle dozlatista. Potom ju zaprášime sladkou paprikou a už len krátko orestujeme.",
      0,
      ["cibula", "maslo", "paprika_mleta"],
    ],
    [
      "Pridáme kúsky kuraťa a zalejeme hydinovým vývarom alebo vodou. Ak zalejeme vodou, pridáme bujónovú kocku. Osolíme len vtedy, ak je to potrebné. Hneď ako je mäso mäkké, vyberieme ho a necháme trochu vychladnúť.",
      0,
      ["kuracie_stehna", "vyvar", "sol"],
      { warn: `Kuracie mäso musí byť prepečené aj pri kosti – vo vnútri aspoň 74 °C. — ${RULE.poultry}` },
    ],
    [
      "Pripravíme zátrepku (múku zmiešame so smotanou) a omáčku zahustíme. Asi 20 minút prevárame na miernom plameni s občasným miešaním. Hustotu omáčky prípadne upravíme pridaním vývaru alebo vody.",
      20,
      ["muka_polohruba", "smotana", "vyvar"],
      { heat: "mierny plameň" },
    ],
    ["Medzitým oberieme mäso z kostí a pridáme ho do hotovej omáčky. Môžeme dochutiť soľou a tekutým korením.", 0, ["kuracie_stehna", "sol", "tekute_korenie"]],
    ["Podávame väčšinou s kolienkami, ale ako prílohu môžeme dať aj knedľu.", 0, ["cestoviny", "knedla"]],
  ]),
};

/* ===================================================================== bryndzové halušky */
const halusky: Recipe = {
  id: "halusky",
  name: "Bryndzové halušky so slaninou",
  category: "hlavne",
  meat: "bravcove",
  minutes: 45,
  difficulty: 2,
  portions: 4,
  hue: 45,
  icon: "Wheat",
  tags: ["klasika"],
  source: "",
  book: book("halusky", {
    active: 35,
    scale: "free",
    cuisine: "Slovensko",
    tools: ["jemné strúhadlo", "mixér", "sito na halušky s veľkými okami (alebo doska a nôž)", "veľký hrniec", "panvica", "cedidlo"],
    store: RULE.leftovers,
  }),
  ingredients: ings(undefined, [
    ["zemiaky", 750, "g", { note: "varný typ C" }],
    ["muka_polohruba", 250, "g", { label: "Polohrubá pšeničná múka" }],
    ["sol", 0, "podla_chuti"],
    ["korenie", 0, "podla_chuti", { label: "Čerstvo mleté korenie" }],
    ["vajce", 1, "ks"],
    ["slanina", 150, "g"],
    ["bryndza", 200, "g"],
    ["smotana_sladka", 100, "ml"],
    ["petrzlenova_vnat", 1, "hrst", { note: "nasekaná" }],
    ["olej", 0, "podla_potreby", { note: "trocha na opečenie slaniny (je v postupe)" }],
  ]),
  steps: steps("halusky", [
    ["Zemiaky olúpte a nastrúhajte najemno. Nastrúhané zemiaky rozmixujte na pyré.", 0, ["zemiaky"]],
    [
      "Zlejte prebytočnú tekutinu, zemiaky osoľte, pridajte vajce a vmiešajte toľko múky, aby ste získali riedke cesto. Konzistenciou by malo pripomínať cesto na lievance alebo riedku zemiakovú kašu.",
      0,
      ["zemiaky", "sol", "vajce", "muka_polohruba"],
      { tip: `Správnu hustotu zistíte tak, že kúsok cesta uvaríte v horúcej vode. Ak sa rozpadne, cesto je príliš riedke a treba pridať múku. — ${from("halusky", "https://www.vareni.cz/recepty/prave-slovenske-halusky-s-bryndzou-a-slaninou/")}` },
    ],
    [
      "Cesto postupne pretláčajte do vriacej osolenej vody špeciálnym sitom na halušky s veľkými okami a opatrne zamiešajte. Ak sito nemáte, môžete z cesta na doske odkrajovať nožom kúsky a hádzať ich jeden po druhom do vriacej vody.",
      0,
      ["sol"],
    ],
    ["Keď halušky vyplávajú na povrch, vyberte ich sitkom (asi po 4–5 minútach) a uvarte ďalšiu várku.", 5, []],
    ["Medzitým nakrájajte slaninu na kocky a opečte na troške oleja.", 0, ["slanina", "olej"]],
    ["Bryndzu rozmiešajte so smotanou dohladka a okoreňte.", 0, ["bryndza", "smotana_sladka", "korenie"]],
    [
      "Scedené horúce halušky premiešajte s bryndzou a na tanieroch prelejte rozškvarenou slaninou a posypte petržlenovou vňaťou.",
      0,
      ["bryndza", "slanina", "petrzlenova_vnat"],
      { tip: "Anglickú slaninu môžete nahradiť tradičnejšou údenou bielou slaninou. Ak nemáte bryndzu, použite kozí syr. — z pôvodného receptu (Apetit)" },
    ],
  ]),
};

/* ===================================================================== špagety carbonara */
const carbonara: Recipe = {
  id: "carbonara",
  name: "Špagety carbonara",
  category: "cestoviny",
  meat: "bravcove",
  minutes: 30,
  difficulty: 2,
  portions: 4,
  hue: 48,
  icon: "UtensilsCrossed",
  tags: ["rychle"],
  source: "",
  book: book("carbonara", {
    active: 25,
    scale: "free",
    cuisine: "Taliansko",
    tools: ["veľký hrniec", "veľká panvica", "strúhadlo", "miska", "vidlička alebo kliešte"],
    store: RULE.leftovers,
  }),
  ingredients: ings(undefined, [
    ["sol", 0, "podla_chuti"],
    ["spagety", 360, "g"],
    ["slanina", 100, "g", { label: "Pancetta (alebo údený bok)" }],
    ["pecorino", 50, "g"],
    ["parmezan", 50, "g"],
    ["vajce", 3, "ks", { note: "veľké" }],
    ["korenie", 0, "podla_chuti", { label: "Čerstvo mleté korenie" }],
    ["cesnak", 2, "strucik"],
    ["maslo", 50, "g"],
  ]),
  steps: steps("carbonara", [
    [
      "Do veľkého hrnca nalejte 3,5 litra vody, pridajte lyžicu soli a priveďte do varu. Hneď ako voda začne vrieť, vhoďte do nej špagety. Povarte ich podľa návodu na obale tak, aby ostali pevné na skus.",
      0,
      ["sol", "spagety"],
    ],
    ["Pancettu nakrájajte najemno, oba druhy syra nastrúhajte. Vajcia prešľahajte vidličkou v miske, osoľte a okoreňte.", 0, ["slanina", "pecorino", "parmezan", "vajce", "sol", "korenie"]],
    [
      "Cesnak trochu stlačte plochou stranou noža, aby sa z neho uvoľnili silice. Kým sa cestoviny varia, rozpustite vo veľkej panvici maslo. Pridajte pancettu a strúčiky cesnaku. Na strednom ohni opekajte zhruba päť minút, kým nie je pancetta chrumkavá. Cesnak vyberte a vyhoďte.",
      5,
      ["cesnak", "maslo", "slanina"],
      { heat: "stredný oheň", wait: false },
    ],
    [
      "Pod panvicou udržujte veľmi mierny oheň. Hneď ako cestoviny dosiahnu správnu konzistenciu, zlejte ich a trochu vody odložte. Cestoviny preložte do panvice a pridajte lyžicu vody, v ktorej sa varili.",
      0,
      ["spagety"],
    ],
    [
      "K vajciam v miske zašľahajte väčšinu syra. Panvicu odstavte z ohňa a k cestovinám prilejte vajíčka so syrom. Kliešťami alebo dlhou vidličkou cestoviny premiešavajte, aby sa obalili vaječnou zmesou. Tá vďaka teplu sálajúcemu z cestovín zhustne. Nemala by sa však začať zrážať.",
      0,
      ["vajce", "pecorino", "parmezan"],
      { warn: `Vajcia sa v omáčke len zohrejú, žĺtok ostane mäkký – tehotné ženy, malé deti, starší a chorí ľudia by mali jesť len vajcia dovarené. — ${RULE.eggs}` },
    ],
    ["Podľa potreby pridajte ešte pár lyžíc vody z cestovín, ale len toľko, aby bola omáčka hodvábna, nie vodnatá. Ak treba, dosoľte.", 0, ["sol"]],
    ["Pomocou dlhej vidličky stočte každému na tanier akýsi špagetový drdolík. Poprášte ho troškou zvyšného syra, čerstvo mletým korením a ihneď podávajte.", 0, ["pecorino", "parmezan", "korenie"]],
  ]),
};

/* ===================================================================== zemiakový šalát */
const salat: Recipe = {
  id: "salat",
  name: "Vianočný zemiakový šalát",
  category: "salaty",
  meat: "bravcove",
  minutes: 35,
  difficulty: 1,
  portions: 4,
  hue: 70,
  icon: "Salad",
  tags: ["klasika"],
  source: "",
  book: book("salat", {
    active: 35,
    wait: "odležať najlepšie do druhého dňa",
    scale: "free",
    cuisine: "Česko · Slovensko",
    tools: ["2 hrnce", "cedník", "veľká misa", "malá panvica"],
    store: "V chladničke, zjedz do 3–4 dní (pravidlo USDA pre hotové jedlá s majonézou a varenými surovinami).",
  }),
  ingredients: ings(undefined, [
    ["cukor", 0, "podla_chuti"],
    ["sol", 0, "podla_chuti"],
    ["vajce", 2, "ks"],
    ["zemiaky", 8, "ks", { note: "stredne veľké" }],
    ["cibula", 1, "ks"],
    ["zeler", 100, "g"],
    ["jablko", 1, "ks"],
    ["majoneza", 100, "g"],
    ["mrkva", 200, "g"],
    ["petrzlen", 100, "g"],
    ["slanina", 50, "g", { label: "Špek", alt: ["tuk"] }],
    ["uhorky_kysle", 100, "g"],
    ["tatarska", 100, "g"],
    ["hrasok", 100, "g"],
    ["korenie", 0, "podla_chuti", { label: "Mleté čierne korenie" }],
  ]),
  steps: steps("salat", [
    ["Stredne veľké zemiaky uvaríme v šupke domäkka, uvarené zemiaky olúpeme a nakrájame na kocky.", 0, ["zemiaky"]],
    ["Mrkvu, zeler a petržlen očistíme, nakrájame pozdĺžne (zeler na plátky) a uvaríme v mierne osolenej vode. Mäkkú zeleninu scedíme a nakrájame na kocky.", 0, ["mrkva", "zeler", "petrzlen", "sol"]],
    ["Cibuľu olúpeme, nakrájame nadrobno a na cedníku prelejeme vriacou vodou.", 0, ["cibula"]],
    ["Vajcia uvaríme natvrdo, olúpeme a nakrájame na kocky.", 0, ["vajce"]],
    ["Jablko olúpeme, zbavíme jadrovníka a tiež nakrájame na kocky.", 0, ["jablko"]],
    [
      "Zemiaky dáme do misy spolu so zeleninou, pridáme hrášok, nakrájané uhorky spolu s časťou uhorkového nálevu a doplníme vajcami a jablkami.",
      0,
      ["zemiaky", "mrkva", "zeler", "petrzlen", "hrasok", "uhorky_kysle", "vajce", "jablko"],
    ],
    ["Nakoniec rozpustíme nakrájaný špek a celý obsah misy zalejeme vypusteným tukom (škvarky odložíme na iný recept).", 0, ["slanina"]],
    [
      "Misu so všetkými surovinami na vianočný zemiakový šalát necháme odstáť a opatrne miešame, kým nie je všetko úplne vychladnuté. Je dôležité, aby v šaláte ostali kúsky zemiakov, zeleniny a ostatných surovín.",
      0,
      [],
    ],
    ["Zemiakový šalát podľa chuti osolíme, okoreníme, pocukrujeme a na záver pridáme aj tatársku omáčku a majonézu.", 0, ["sol", "korenie", "cukor", "tatarska", "majoneza"]],
    [
      "Takto pripravený vianočný zemiakový šalát necháme v pokoji odležať, a to najlepšie do druhého dňa. Podávame s vyprážaným kaprom alebo klasickými rezňami, ako kto má rád.",
      0,
      [],
    ],
  ]),
};

/* ===================================================================== palacinky */
const palacinky: Recipe = {
  id: "palacinky",
  name: "Tenké palacinky",
  category: "sladke",
  meat: "bez",
  minutes: 20,
  difficulty: 1,
  portions: 4,
  hue: 40,
  icon: "Egg",
  tags: ["rychle", "deti"],
  source: "",
  book: book("palacinky", {
    active: 15,
    scale: "piece",
    cuisine: "Česko · Slovensko",
    tools: ["mixér alebo metlička", "panvica na palacinky", "malá naberačka"],
    store: "Hotové palacinky prikry, aby nevyschli; zvyšok do chladničky a zjedz do 3–4 dní (pravidlo USDA).",
  }),
  ingredients: ings(undefined, [
    ["muka", 200, "g", { label: "Hladká múka" }],
    ["sol", 1, "stipka"],
    ["vajce", 2, "ks"],
    ["mlieko", 400, "ml"],
    ["olej", 0, "podla_potreby", { note: "na vyprážanie" }],
  ]),
  steps: steps("palacinky", [
    [
      "Hladkú múku rozmixujeme so štipkou soli, mliekom a dvoma vajcami tak, aby vzniklo správne husté cesto na palacinky (ani riedke, ani príliš husté). Cesto necháme aspoň 20 minút odležať.",
      20,
      ["muka", "sol", "mlieko", "vajce"],
    ],
    [
      "Na panvicu s rozpáleným olejom vlejeme približne jednu malú naberačku cesta a rozlejeme po panvici. Opekáme asi pol minúty a potom palacinku otočíme. Palacinku vyprážame z oboch strán dozlatista.",
      0,
      ["olej"],
      {
        tip: "Na jednu porciu rátam 2 palacinky – recept vystačí asi na 4 porcie, 8–10 palaciniek podľa veľkosti panvice a hrúbky. Na hotové palacinky nanesieme, čo nám chutí: džemy, marmelády, tvaroh, puding, nutellu alebo mäsovú, hubovú či zeleninovú zmes. — z pôvodného receptu (Vaření)",
      },
    ],
  ]),
};

/* ===================================================================== bábovka */
const babovka: Recipe = {
  id: "babovka",
  name: "Babkina mramorová bábovka",
  category: "sladke",
  meat: "bez",
  minutes: 100,
  difficulty: 2,
  portions: 12,
  hue: 30,
  icon: "CakeSlice",
  tags: ["klasika"],
  source: "",
  book: book("babovka", {
    active: 30,
    scale: "whole",
    cuisine: "Česko · Slovensko",
    tools: ["forma na bábovku", "2 misy", "šľahač alebo metlička", "stierka", "mriežka"],
    store: "Prikrytú pri izbovej teplote 2–3 dni.",
  }),
  ingredients: ings(undefined, [
    ["vajce", 6, "ks"],
    ["cukor", 300, "g", { label: "Krupicový cukor" }],
    ["maslo", 180, "g", { note: "zmäknuté + na vymastenie formy" }],
    ["mlieko", 250, "ml"],
    ["cukor_vanil", 1, "bal"],
    ["muka_hruba", 450, "g", { label: "Hrubá pšeničná múka", note: "+ na vysypanie formy" }],
    ["prasok", 1, "bal"],
    ["kakao", 3, "lyzica"],
    ["cukor_mly", 0, "podla_potreby", { note: "na poprášenie" }],
  ]),
  steps: steps("babovka", [
    [
      "Bábovkovú formu starostlivo vymastite maslom a vysypte hrubou múkou. Rúru predhrejte na 180 °C (teplovzdušnú na 160 °C).",
      0,
      ["maslo", "muka_hruba"],
      { heat: "180 °C (teplovzdušná 160 °C)" },
    ],
    ["Oddeľte žĺtky a bielky. Žĺtky vymiešajte s cukrom, potom pridajte zmäknuté maslo a mlieko a dobre premiešajte.", 0, ["vajce", "cukor", "maslo", "mlieko"]],
    [
      "V inej miske vyšľahajte dotuha bielky s vanilkovým cukrom. Múku zmiešajte s kypriacim práškom do pečiva. Sneh a múku potom po častiach opatrne vmiešajte do žĺtkovej zmesi.",
      0,
      ["vajce", "cukor_vanil", "muka_hruba", "prasok"],
    ],
    ["Polovicu cesta vlejte do formy, zvyšok zafarbite kakaom a nalejte na svetlé cesto. Uhlaďte stierkou.", 0, ["kakao"]],
    [
      "Pečte asi 60–70 minút. Bábovku vyberte z rúry, nechajte chvíľu chladnúť vo forme, potom ju vyklopte a dajte chladnúť na mriežku. Podávajte posypanú práškovým cukrom.",
      65,
      ["cukor_mly"],
      {
        done: `špajdľa zapichnutá do stredu bábovky po vytiahnutí ostane suchá. — ${fromAct("babovka", "skúška špajdlou")}`,
        tip: "Ako šikovne vyklopiť bábovku? Na formu priklopte rovný tanier alebo tácku a bábovku obráťte. Ak hneď nevypadne, priložte na obrátenú formu utierky namočené v studenej vode. — z pôvodného receptu (Apetit)",
      },
    ],
  ]),
};

/* ===================================================================== cheesecake */
const cheesecake: Recipe = {
  id: "cheesecake",
  name: "New York cheesecake",
  category: "sladke",
  meat: "bez",
  minutes: 90,
  difficulty: 2,
  portions: 12,
  hue: 50,
  icon: "Cake",
  tags: [],
  source: "",
  book: book("cheesecake", {
    active: 40,
    wait: "do druhého dňa v chladničke",
    scale: "whole",
    cuisine: "USA",
    tools: ["rozoberateľná forma s priemerom 24 cm", "papier na pečenie", "valček alebo kuchynský robot", "pohár s rovným dnom", "misa", "alobal"],
    store: "V chladničke prikrytý, zjedz do 3–4 dní (pravidlo USDA pre mliečne dezerty).",
  }),
  ingredients: [
    ...ings("Korpus", [
      ["susienky", 200, "g", { note: "BeBe alebo maslové sušienky" }],
      ["maslo", 70, "g", { note: "až 120 g + navyše na formu" }],
    ]),
    ...ings("Krém", [
      ["kremovy_syr", 600, "g", { note: "plnotučný, čerstvý (napr. Lučina, Philadelphia, Gervais)" }],
      ["kysla_smotana", 200, "ml"],
      ["cukor_mly", 250, "g"],
      ["citron", 1.5, "lyzicka", { label: "Citrónová šťava" }],
      ["citron_kora", 1, "ks", { note: "nastrúhaná najemno z 1 citróna" }],
      ["vanilka", 1.5, "lyzicka"],
      ["vajce", 3, "ks", { note: "veľké" }],
      ["zltok", 1, "ks"],
    ]),
    ...ings("Poleva", [
      ["kysla_smotana", 250, "ml", { ref: "kysla_smotana_p" }],
      ["cukor_mly", 1, "lyzica", { ref: "cukor_mly_p" }],
      ["citron", 2, "lyzicka", { ref: "citron_p", label: "Citrónová šťava" }],
    ]),
  ],
  steps: steps("cheesecake", [
    [
      "Na korpus nasypte sušienky do vrecka, rozdrvte ich valčekom a zmiešajte s rozpusteným maslom. Môžete ich rozmixovať aj niekoľkými rýchlymi pulzmi v kuchynskom robote, pridať k nim nerozpustené maslo, krátko premixovať a po minúte zapulzovať po tretí raz, aby hmota začala tvoriť hrudky, čo je ideálne.",
      0,
      ["susienky", "maslo"],
    ],
    ["Rozoberateľnú tortovú formu s priemerom 24 cm vymastite maslom, pre ľahšie vyberanie torty ju potom ešte môžete vyložiť papierom na pečenie.", 0, ["maslo"]],
    [
      "Sušienkovú hmotu rovnomerne utlačte dnom pohára na dno formy. Korpus dajte do chladničky a nechajte ho tam počas zvyšnej prípravy. Korpus sa dá navyše predpiecť, a to 10 minút pri 180 °C – bude chrumkavejší.",
      0,
      ["susienky"],
    ],
    [
      "Rúru stlmte na 160 °C (a zabudnite na teplovzdušný režim, ten torte neprospieva). Do čerstvého syra po častiach pridávajte kyslú smotanu, práškový cukor, citrónovú šťavu aj kôru a vanilkový extrakt. Potom do hladkej hmoty po jednom vmiešajte vajcia a žĺtok.",
      0,
      ["kremovy_syr", "kysla_smotana", "cukor_mly", "citron", "citron_kora", "vanilka", "vajce", "zltok"],
      { heat: "160 °C, bez teplovzdušného režimu" },
    ],
    [
      "Vlejte na korpus a nechajte 5 minút stáť, aby vyprchali bublinky vzduchu. Pečte 25–30 minút. Prestaňte piecť o chvíľku skôr, ako je zvyčajné: ak by ste čakali, kým koláč celý dobre stuhne, prepiekol by sa, popraskal a hlavne by ste prišli o fenomenálnu krémovú konzistenciu. Pečenie končí vo chvíli, keď po poklepaní lyžicou na bok formy zistíte, že sa cesto chveje podobne ako želé.",
      30,
      [],
      { done: "sa cesto pri poklepaní lyžicou na bok formy chveje ako želé. — z pôvodného receptu (Apetit)" },
    ],
    ["Vychladnutý dezert zakryte alobalom a dajte do druhého dňa odpočívať do chladničky.", 0, []],
    ["Kyslú smotanu vymiešajte s práškovým cukrom a citrónovou šťavou a vychlaďte.", 0, ["kysla_smotana_p", "cukor_mly_p", "citron_p"]],
    ["Cheesecake vyberte z formy, potrite vychladenou ochutenou smotanou, nakrájajte na rezy a podávajte.", 0, ["kysla_smotana_p"]],
  ]),
};

/** Šarža 1: 10 receptov z rôznych kategórií (polievka, hovädzie, bravčové, hydina, slovenská klasika, cestoviny, šalát, sladké). */
export const BOOK_CHECKED: Recipe[] = [cesnakova, gulas, segedin, paprikas, halusky, carbonara, salat, palacinky, babovka, cheesecake].map(finish);
