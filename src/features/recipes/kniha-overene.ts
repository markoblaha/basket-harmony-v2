/*
 * Kniha receptov – recepty overené metódou „kotva“ (15. 11. 2026).
 * Postup: ku každému jedlu 11–16 skutočných receptov z povolených webov. Základná porcia = najčastejší počet porcií
 * v zdrojoch. Kotva = jeden skutočný, dobre hodnotený recept, ktorý má najviac surovín väčšiny; jeho pomery ostávajú
 * (niekto ho naozaj uvaril). Každá surovina, množstvo na porciu a úkon postupu sa porovná so všetkými zdrojmi
 * (book.check). Kotva sa mení len tam, kde jej chýba surovina väčšiny, má surovinu, ktorú má menej ako 30 % zdrojov,
 * alebo je jej množstvo mimo bežného rozpätia – každá zmena je zapísaná (changes). Postup je kotvy, rozpísaný
 * pre začiatočníka vlastnými slovami; rady sú zo zdrojov. Kontrola: bookCheck (kniha.ts) a kniha.test.ts.
 * Obsah receptov je údaj (ako názov produktu), nie text rozhrania – preto nie je v i18n.
 */
import type { BookCheck, BookInfo, Ingredient, Recipe, Step } from "./types";

type I = [food: string, qty: number, unit: Ingredient["unit"], extra?: Partial<Ingredient>];
type S = [text: string, min: number, src: string, extra?: Partial<Step>];
type Src = [k: string, site: string, name: string, url: string, portions?: number];

const ings = (group: string, list: I[]): Ingredient[] => list.map(([food, qty, unit, extra]) => ({ food, qty, unit, group, ...extra }));
const steps = (list: S[]): Step[] => list.map(([text, min, src, extra]) => ({ text, timerMin: min || null, src, ...extra }));
/** Riadok porovnania: „A1500 B C600“ = písmeno zdroja a množstvo na celý recept zdroja (samotné písmeno = má, bez množstva). */
const row = (foods: string, unit: "g" | "ks", v: string, label?: string): BookCheck["rows"][number] => ({
  foods,
  unit,
  ...(label ? { label } : {}),
  v: Object.fromEntries(v.trim().split(/\s+/).map((t) => [t[0]!, Number(t.slice(1)) || 0])),
});
type Act = BookCheck["acts"][number];
const act = (a: string, src: string, at?: number | "tip"): Act => (at === "tip" ? { a, src, tip: true } : at ? { a, src, step: at } : { a, src });

/** Zdroje, porcie zdrojov a písmená zdrojov pri surovinách (podľa riadkov porovnania). */
function book(
  info: Omit<BookInfo, "sources" | "check" | "photos">,
  src: Src[],
  check: Omit<BookCheck, "portions">,
): BookInfo {
  return {
    photos: 4,
    ...info,
    sources: src.map(([k, site, name, url]) => ({ k, site, name, url })),
    check: { ...check, portions: Object.fromEntries(src.filter((s) => s[4]).map((s) => [s[0], s[4]!])) },
  };
}
/**
 * Suroviny pri každom kroku (bubliny pri varení) – presne, nie podľa slov v texte
 * („na výpeku po mäse“ nie je mäso, ktoré sa práve pridáva).
 */
const USES: Record<string, string[][]> = {
  svieckova: [["slanina"], ["hovadzie", "slanina", "sol"], ["olej", "maslo"], ["mrkva", "petrzlen", "zeler", "cibula", "cukor"],
    ["horcica", "bobkovy_list", "nove_korenie", "korenie_cele", "ocot", "vyvar"], [], [], ["muka"], ["smotana_sladka", "citron"], ["knedla", "brusnice"]],
  kapustnica: [["huby_susene"], ["udene", "voda", "bobkovy_list", "korenie_cele"], ["kapusta", "rasca", "klobasa"],
    ["mast", "cibula", "muka", "paprika_mleta"], [], ["sol"], ["kysla_smotana"]],
  "plnena-paprika": [["ryza"], ["cibula", "mast_c"], ["paprika"], ["mlete", "vajce", "cesnak", "sol", "korenie"], [], ["mast", "muka", "pretlak"],
    ["voda", "pasirovane", "cukor", "sol_o", "bobkovy_list", "korenie_cele"], [], []],
  vtacik: [["vajce", "uhorky_kysle", "parky"], ["hovadzie", "sol", "korenie", "horcica"], ["slanina"], ["cibula", "mast"], ["vyvar"], [], ["muka"], [], ["ryza"]],
  musaka: [["cesnak", "cibula", "olivovy_olej"], ["mlete"], ["oregano", "skorica", "paradajky_kraj", "pretlak", "sol", "korenie"], ["baklazan"], ["zemiaky"],
    ["maslo", "muka", "mlieko", "eidam"], [], []],
  chili: [["cibula", "paprika_cervena", "cesnak"], ["olej", "chilli", "paprika_mleta", "rimska_rasca"], ["mlete"],
    ["vyvar", "paradajky_kraj", "oregano", "pretlak", "sol", "korenie"], [], ["fazula"], []],
};

/** Pri každej surovine písmená zdrojov, ktoré ju majú, a pri krokoch ich suroviny. */
function finish(r: Recipe): Recipe {
  const rows = r.book?.check?.rows ?? [];
  const uses = USES[r.id];
  return {
    ...r,
    ingredients: r.ingredients.map((x) => {
      const row = rows.find((w) => w.foods.split("+").includes(x.food));
      return row ? { ...x, src: Object.keys(row.v).sort().join("") } : x;
    }),
    steps: r.steps.map((st, i) => (uses?.[i] ? { ...st, uses: uses[i] } : st)),
  };
}

const AP = "apetitonline.cz";
const LB = "labuznik.cz";
const TR = "toprecepty.cz";
const VA = "vareni.cz";
const TE = "tesco.sk";
const GK = "gutekueche.at";
const NS = "nosalty.hu";
const MA = "marmiton.org";

/* ===================================================================== sviečková */
const svieckova: Recipe = {
  id: "svieckova",
  name: "Sviečková na smotane",
  category: "hlavne",
  meat: "hovadzie",
  minutes: 210,
  difficulty: 3,
  portions: 4,
  hue: 35,
  icon: "Beef",
  tags: ["klasika"],
  source: "",
  book: book(
    {
      active: 60,
      cuisine: "Česko · Slovensko",
      tools: ["široký hrniec alebo pekáč s pokrievkou, ktorý sa dá dať do rúry (aspoň 4 l)", "ostrý úzky nôž", "strúhadlo", "ponorný mixér alebo sitko", "metlička"],
      store: "V chladničke 3 dni (mäso v omáčke), dá sa zamraziť. Ohrievaj pomaly a nevar, smotana by sa zrazila.",
    },
    [
      ["A", AP, "Svíčková na smetaně", "https://www.apetitonline.cz/recept/svickova-na-smetane", 5],
      ["B", AP, "Klasická svíčková omáčka podle autorky kuchařek", "https://www.apetitonline.cz/recept/klasicka-svickova-omacka-podle-autorky-kucharek", 10],
      ["C", LB, "Svíčková na smetaně", "https://www.labuznik.cz/recept/svickova-na-smetane/", 4],
      ["D", LB, "Svíčková na smetaně podle šéfkuchaře", "https://www.labuznik.cz/recept/svickova-na-smetane-podle-sefkuchare/", 4],
      ["E", LB, "Svíčková na smetaně podle Richarda Nováka", "https://www.labuznik.cz/recept/svickova-na-smetane-podle-richarda-novaka/", 6],
      ["F", LB, "Domácí svíčková omáčka", "https://www.labuznik.cz/recept/domaci-svickova-omacka/", 4],
      ["G", TR, "Svíčková na smetaně", "https://www.toprecepty.cz/recept/2856-svickova-na-smetane/", 4],
      ["H", TR, "Svíčková na smetaně II", "https://www.toprecepty.cz/recept/2791-svickova-na-smetane-ii/", 4],
      ["I", TR, "Svíčková na smetaně", "https://www.toprecepty.cz/recept/4991-svickova-na-smetane/", 4],
      ["J", TR, "Česká svíčková na smetaně", "https://www.toprecepty.cz/recept/53381-ceska-svickova-na-smetane/", 9],
      ["K", TR, "Svíčková na smetaně snad tak, jak se má dělat", "https://www.toprecepty.cz/recept/21155-svickova-na-smetane-snad-tak-jak-se-ma-delat/", 4],
      ["L", VA, "Svíčková na smetaně od babičky", "https://www.vareni.cz/recepty/svickova-na-smetane-od-babicky/", 6],
      ["M", VA, "Poctivá svíčková na smetaně", "https://www.vareni.cz/recepty/poctiva-svickova-na-smetane/", 4],
      ["N", VA, "Nakládaná svíčková na smetaně", "https://www.vareni.cz/recepty/nakladana-svickova-na-smetane/", 4],
    ],
    {
      anchor: "G",
      rows: [
        row("hovadzie", "g", "A1500 B2000 C600 D800 E1000 F875 G800 H750 I600 J900 K800 L1000 M800 N400"),
        row("slanina", "g", "A200 B250 C50 D E80 F G100 H50 I50 J50 K100 L150 M150"),
        row("mrkva+petrzlen+zeler", "g", "A1360 B580 C180 D170 E1020 F180 G300 H330 I400 J260 K520 L450 M400 N100", "Koreňová zelenina (mrkva, petržlen, zeler)"),
        row("cibula", "g", "A240 B240 C120 E240 F200 G120 H120 I120 J120 K240 L240 M120 N40"),
        row("olej+maslo", "g", "A200 B C40 D120 E189 F G110 H I40 J30 K15 L20 M100 N40", "Tuk (olej, maslo)"),
        row("cukor", "g", "A B15 C D E30 F15 G30 H I J5 K45 L30 M15"),
        row("ocot", "g", "B30 D15 F45 G30 J5 L30"),
        row("horcica", "g", "B15 D15 G50 L30 M15"),
        row("bobkovy_list", "ks", "A5 B2 C D E3 F3 G3 H I2 J1 K1 L4 M3 N"),
        row("nove_korenie", "ks", "A8 B C2 D E8 F6 G5 H I3 J5 K5 L6 M5 N"),
        row("korenie+korenie_cele", "ks", "A B C D E F G H I J K L M N", "Čierne korenie"),
        row("sol", "g", "A B C D E F G H I J K L M N"),
        row("vyvar", "g", "A B275 C D E2000 F G H I J K L700 M1000"),
        row("muka", "g", "A20 C40 D60 F20 G10 H20 I40 J20 K10 N40"),
        row("smotana_sladka", "g", "A250 B275 C250 D300 E500 F250 G250 H200 I250 J250 K200 L200 M250 N200"),
        row("citron", "ks", "A1 B1 C D1 E1 F G H I J1 K L1 M"),
        row("brusnice", "g", "A B C D200 E60 F G I K L M"),
        row("knedla", "ks", "A B C E F G I J K L M N"),
      ],
      acts: [
        act("Mäso prešpikovať slaninou", "ABCDEFGHIJKLM", 2),
        act("Mäso nechať aspoň cez noc v zelenine alebo náleve", "ABFKN", "tip"),
        act("Mäso osoliť a opiecť zo všetkých strán", "CDEFGHIJLM", 3),
        act("Na výpeku opražiť koreňovú zeleninu a cibuľu", "CDEFGHIJLM", 4),
        act("Zeleninu s cukrom nechať skaramelizovať", "CEFGIL", 4),
        act("Pridať horčicu a ocot", "BDFGJL", 5),
        act("Podliať vývarom alebo vodou, pridať korenie a dusiť alebo piecť pod pokrievkou do mäkka", "ABCDEFGHIJKLMN", 6),
        act("Vybrať mäso a celé korenie", "ACDFGHIJL", 7),
        act("Zeleninu rozmixovať alebo prepasírovať", "ACDEFGHIJLM", 7),
        act("Zahustiť múkou a povariť asi 20 minút", "ACDGHIJ", 8),
        act("Zjemniť smotanou a dochutiť citrónom, cukrom a soľou", "ABCDEFGHIJKLMN", 9),
        act("Podávať s knedľou, brusnicami a plátkom citróna", "ABCEFGIKLM", 10),
      ],
      changes: [
        "Horčica 1 lyžica namiesto 50 g: 50 g je najviac zo všetkých zdrojov, ostatné dávajú 1–2 lyžice.",
        "Múka 2 lyžice: kotva píše „1 lyžica alebo podľa potreby“, väčšina zdrojov dáva 2 lyžice.",
        "Koreňová zelenina (kotva: 300 g v rovnakom pomere) rozpísaná na 100 g mrkvy, petržlenu a zeleru.",
        "Múka sa rozmieša vo vode, nie v mlieku – mlieko kotva nemá medzi surovinami.",
      ],
    },
  ),
  ingredients: [
    ...ings("Mäso", [
      ["hovadzie", 800, "g", { note: "v kuse; alebo hovädzie pliecko (falošná sviečková)" }],
      ["slanina", 100, "g", { note: "údená, v kuse" }],
      ["sol", 1, "lyzicka"],
    ]),
    ...ings("Omáčka", [
      ["olej", 100, "ml"],
      ["maslo", 1, "lyzica"],
      ["mrkva", 100, "g"],
      ["petrzlen", 100, "g"],
      ["zeler", 100, "g"],
      ["cibula", 1, "ks"],
      ["cukor", 2, "lyzica"],
      ["horcica", 1, "lyzica", { note: "plnotučná" }],
      ["ocot", 2, "lyzica"],
      ["bobkovy_list", 3, "ks"],
      ["nove_korenie", 5, "ks"],
      ["korenie_cele", 5, "ks"],
      ["vyvar", 750, "ml", { label: "Vývar", note: "hovädzí, horúci" }],
      ["muka", 2, "lyzica"],
      ["smotana_sladka", 250, "ml", { note: "33 %" }],
      ["citron", 1, "ks"],
    ]),
    ...ings("Na podávanie", [
      ["knedla", 1.5, "ks", { label: "Žemľová knedľa", note: "asi 150 g na porciu" }],
      ["brusnice", 4, "lyzica"],
    ]),
  ],
  steps: steps([
    ["Slaninu ({slanina}) nakrájaj na hranolčeky hrubé asi pol centimetra a dlhé ako hrúbka mäsa. Daj ich aspoň na 30 minút do mrazničky – stuhnutá slanina sa do mäsa zasúva oveľa ľahšie.", 30, "GM", {
      wait: true, tip: "Kým slanina tuhne, ošúp a nastrúhaj zeleninu na ďalšie kroky." }],
    ["Z mäsa ({hovadzie}) odrež blany a šľachy a osuš ho papierovou utierkou. Ostrým úzkym nožom urob pozdĺž vlákien zárezy hlboké 3–4 cm, asi 3 cm od seba, a do každého zasuň hranolček slaniny. Mäso zo všetkých strán osoľ ({sol}).", 0, "ABCDEFGHIJKLM", {
      done: "Slanina je v mäse po celej dĺžke a nevytŕča.", tip: "Nemáš špikovaciu ihlu? Stačí úzky nôž – zárez roztvor prstom a slaninu doňho zatlač." }],
    ["V širokom hrnci alebo pekáči, ktorý sa dá dať do rúry, rozohrej olej ({olej}) s maslom ({maslo}). Mäso v ňom opeč zo všetkých strán dozlatista, na každej strane asi 2 minúty. Vyber ho na tanier.", 8, "CDEFGHIJLM", {
      heat: "silný oheň", done: "Mäso je dozlatista zatiahnuté zo všetkých strán.", tip: "Maslo samo by pri silnom ohni horelo, preto ide spolu s olejom." }],
    ["Mrkvu ({mrkva}), petržlen ({petrzlen}) a zeler ({zeler}) ošúp a nastrúhaj nahrubo, cibuľu ({cibula}) nakrájaj nadrobno. Na výpeku po mäse ich opekaj za častého miešania, kým zelenina nezmäkne a mrkva nepustí oranžovú farbu. Potom ju posyp cukrom ({cukor}) a miešaj, kým cukor neskaramelizuje a zelenina nezíska zlatohnedú farbu.", 12, "CEFGIL", {
      heat: "stredný oheň", done: "Zelenina je mäkká, zlatohnedá a vonia sladko.", warn: "Karamel sa pripáli za pár sekúnd. Keď je tmavší ako lieskový orech, hneď prilej ocot z ďalšieho kroku." }],
    ["Vmiešaj horčicu ({horcica}), bobkové listy ({bobkovy_list}), nové korenie ({nove_korenie}) a celé čierne korenie ({korenie_cele}) a prilej ocot ({ocot}). Nechaj minútu prebublať, aby z octu vyprchala ostrosť. Vráť do hrnca mäso aj so šťavou, ktorá z neho vytiekla, a zalej ho vriacim vývarom ({vyvar}) – mäso má byť ponorené asi do dvoch tretín.", 2, "BDFGJL", {
      heat: "stredný oheň" }],
    ["Hrniec prikry pokrievkou (pekáč alobalom) a daj do rúry vyhriatej na 160 °C. Peč asi 2 hodiny, kým mäso nezmäkne. Po hodine mäso otoč, a ak tekutina klesla pod polovicu mäsa, podlej trochou horúcej vody.", 120, "ABCDEFGHIJKLMN", {
      heat: "160 °C", wait: true, done: "Vidlička vojde do mäsa ľahko a mäso z nej samo skĺzne.", tip: "Hovädzie pliecko zmäkne skôr ako zadné – skús ho po 90 minútach." }],
    ["Mäso vyber a zabaľ do alobalu, aby nevychladlo a nevysušilo sa. Z omáčky vylov bobkové listy a guľôčky korenia – nájdeš ich ľahko, keď omáčku rozotrieš varechou po dne. Zeleninu so šťavou rozmixuj ponorným mixérom úplne dohladka, alebo ju pretlač cez sitko.", 5, "ACDEFGHIJLM", {
      warn: "Rozmixované celé korenie by omáčku urobilo štipľavou a horkou – vylov ho dôkladne." }],
    ["Múku ({muka}) rozmiešaj v 4 lyžiciach studenej vody dohladka a za stáleho miešania ju vlej do omáčky. Var ju pomaly asi 20 minút a často miešaj, lebo sa ľahko pripáli. Ak je príliš hustá, zrieď ju trochou vývaru alebo vody.", 20, "ACDGHIJ", {
      heat: "mierny oheň", wait: true, done: "Omáčka je hladká, lesklá, obalí lyžicu a nechutí po surovej múke.", tip: "Múka musí vrieť aspoň 20 minút, inak omáčka chutí múčne." }],
    ["Stiahni hrniec z ohňa. Smotanu ({smotana_sladka}) najprv rozmiešaj s naberačkou horúcej omáčky a až potom ju vlej do hrnca – takto sa nezrazí. Dochuť šťavou z polovice citróna ({citron}), soľou a podľa chuti ešte trochou cukru. Omáčka má byť krémová a jemne sladkokyslá. Odteraz ju už nevar, len zohrievaj.", 0, "ABCDEFGHIJKLMN", {
      warn: "Ak by omáčka so smotanou zovrela, smotana sa môže zraziť na hrudky.", tip: "Kúsok masla vmiešaný na konci dodá omáčke lesk." }],
    ["Mäso nakrájaj naprieč vláknami na plátky hrubé asi 1 cm. Na tanier daj 3–4 plátky knedle ({knedla}), plátky mäsa a veľa omáčky. Ozdob plátkom citróna a lyžicou brusníc ({brusnice}).", 0, "ABCEFGIKLM", {
      tip: "Krájaj vždy naprieč vláknami, inak budú plátky ťahavé." }],
  ]),
};

/* ===================================================================== kapustnica */
const kapustnica: Recipe = {
  id: "kapustnica",
  name: "Kapustnica s údeným mäsom a klobásou",
  category: "polievky",
  meat: "bravcove",
  minutes: 160,
  difficulty: 2,
  portions: 6,
  hue: 30,
  icon: "Soup",
  tags: ["klasika"],
  source: "",
  book: book(
    {
      active: 40,
      cuisine: "Slovensko",
      tools: ["veľký hrniec s pokrievkou (aspoň 4 l)", "panvica", "miska na huby"],
      store: "V chladničke 3–4 dni, dá sa zamraziť. Na druhý deň je ešte lepšia.",
    },
    [
      ["A", AP, "Kapustnica", "https://www.apetitonline.cz/recept/kapustnica", 5],
      ["B", AP, "Kapustnica se sušenými švestkami", "https://www.apetitonline.cz/recept/kapustnica-se-susenymi-svestkami", 6],
      ["C", AP, "Slovenská zelňačka (kapustnica) se sušenými švestkami a klobásou", "https://www.apetitonline.cz/recept/slovenska-zelnacka-kapustnica-se-susenymi-svestkami-klobasou", 4],
      ["D", LB, "Kapustnica – tradiční hustá zelňačka ze Slovenska", "https://www.labuznik.cz/recept/kapustnica-tradicni-husta-zelnacka-ze-slovenska/"],
      ["E", LB, "Vánoční kapustnica z Podolince", "https://www.labuznik.cz/recept/vanocni-kapustnica-z-podolince/", 4],
      ["F", TE, "Vianočná kapustnica", "https://www.tesco.sk/hello/recepty/vianocna-kapustnica/596042"],
      ["G", TR, "Slovenská vánoční kapustnica", "https://www.toprecepty.cz/recept/3640-slovenska-vanocni-kapustnica/", 4],
      ["H", TR, "Červená zelňačka mojí babičky", "https://www.toprecepty.cz/recept/58664-slovenska-kapustnica-babiccina/"],
      ["I", TR, "Babiččina kapustnica", "https://www.toprecepty.cz/recept/3048-babiccina-kapustnica/"],
      ["J", TR, "Kapustnica", "https://www.toprecepty.cz/recept/3467-kapustnica/", 6],
      ["K", TR, "Kapustnica", "https://www.toprecepty.cz/recept/4263-kapustnica/", 6],
      ["L", TR, "Terchovská sváteční kapustnica", "https://www.toprecepty.cz/recept/75642-terchovska-svatecni-kapustnica/", 10],
      ["M", VA, "Slovenská kapustnica", "https://www.vareni.cz/recepty/slovenska-kapustnica/"],
      ["N", VA, "Slovenská kapustnica s klobásou", "https://www.vareni.cz/recepty/slovenska-kapustnica-s-klobasou/", 8],
      ["O", VA, "Kapustnica", "https://www.vareni.cz/recepty/kapustnica/", 8],
    ],
    {
      anchor: "O",
      rows: [
        row("kapusta", "g", "A1000 B500 C300 D E200 F700 G300 H500 I300 J500 K1000 L1000 M400 N500 O500"),
        row("klobasa", "g", "A240 B120 C120 D240 E150 F240 G200 H300 I480 J120 K450 L200 M150 N150 O240"),
        row("udene", "g", "A500 B300 C250 D1500 F200 G300 I600 J500 L1900 O"),
        row("huby_susene", "g", "A15 D100 E30 F15 G10 H75 I30 J15 K15 L5 M40 N5 O25"),
        row("cibula", "g", "A120 B240 C240 D240 F120 G120 H180 J180 K240 L200 M N120 O180"),
        row("paprika_mleta", "g", "A7 B2.5 C2.5 D7 E F H2.5 J K L14 M N7 O5"),
        row("rasca", "g", "D E F H2 J K L2 N2"),
        row("bobkovy_list", "ks", "A1 B2 C2 F2 G2 H3 K O2"),
        row("korenie+korenie_cele", "ks", "A B C F G H J K M O", "Čierne korenie"),
        row("kysla_smotana+smotana_sladka", "g", "B150 C150 D F H250 L45 N250 O", "Smotana (kyslá alebo sladká)"),
        row("muka", "g", "B10 C10 D E G10 H20 I20 J20 N3 O20"),
        row("mast+maslo+olej", "g", "A13 B14 C14 D E50 F G10 I42 J14 K L26 M50 N13 O26", "Tuk (masť, maslo, olej)"),
        row("sol", "g", "A B C D E F G H I J K L M N O"),
      ],
      acts: [
        act("Sušené huby vopred namočiť", "ADEGJMNO", 1),
        act("Údené mäso uvariť do mäkka a z vývaru variť polievku", "BCDFGIJLO", 2),
        act("Kapustu nakrájať a variť s hubami vo vývare", "ABCDEFGHIJKLMNO", 3),
        act("Pridať klobásu", "ABCDEFGHIJKLMNO", 3),
        act("Pridať rascu", "DEFHJKLN", 3),
        act("Speniť cibuľu na tuku", "AFKLMNO", 4),
        act("Pridať mletú papriku", "ABCDEFHJKLMNO", 4),
        act("Zahustiť zápražkou alebo múkou so smotanou", "BCDEGHIJNO", 5),
        act("Mäso a klobásu nakrájať a vrátiť do polievky", "BCDGIJO", 6),
        act("Podávať so smotanou (alebo ňou polievku zjemniť)", "BCDFHLNO", 7),
        act("Pridať sušené slivky", "BCDEF", "tip"),
        act("Kapustu prepláchnuť, ak je veľmi kyslá", "DFG", "tip"),
      ],
      changes: [
        "Údené mäso 400 g namiesto 1 kg údených kostí: kosti má len kotva, ostatné zdroje dávajú údené mäso (bežne 60–100 g na porciu).",
        "Kapusta 500 g (bežné balenie): kotva má 500 g na 8 porcií, väčšina zdrojov 75–110 g na porciu.",
        "Pridaná rasca: má ju viac ako polovica zdrojov.",
        "Vynechané nové korenie a pálivá paprika: má ich menej ako 30 % zdrojov.",
        "Prepočet zo 8 na 6 porcií; cibuľa 180 g, huby 15 g a klobása 250 g zaokrúhlené na bežný kus a balenie.",
      ],
    },
  ),
  ingredients: [
    ...ings("Vývar", [
      ["udene", 400, "g", { note: "údené karé, plece alebo rebierka" }],
      ["bobkovy_list", 2, "ks"],
      ["korenie_cele", 8, "ks"],
      ["voda", 2000, "ml"],
    ]),
    ...ings("Polievka", [
      ["huby_susene", 15, "g", { note: "asi hrsť" }],
      ["kapusta", 500, "g", { note: "aj s trochou nálevu" }],
      ["rasca", 1, "lyzicka"],
      ["klobasa", 250, "g"],
    ]),
    ...ings("Zápražka", [
      ["mast", 1.5, "lyzica"],
      ["cibula", 180, "g", { note: "1 veľká" }],
      ["muka", 1.5, "lyzica"],
      ["paprika_mleta", 2, "lyzicka", { note: "sladká" }],
      ["sol", 1, "lyzicka", { note: "podľa chuti, až na konci" }],
    ]),
    ...ings("Na podávanie", [["kysla_smotana", 200, "g"]]),
  ],
  steps: steps([
    ["Sušené huby ({huby_susene}) zalej v miske asi 300 ml vlažnej vody a nechaj ich aspoň 30 minút namočiť.", 30, "ADEGJMNO", {
      wait: true, tip: "Vodu z húb nevylievaj, je plná chuti – pridáš ju do polievky (bez piesku z dna misky)." }],
    ["Údené mäso ({udene}) prepláchni, vlož do veľkého hrnca a zalej studenou vodou ({voda}). Pridaj bobkové listy ({bobkovy_list}) a celé čierne korenie ({korenie_cele}). Priveď do varu, stíš oheň a pod pokrievkou pomaly var, kým mäso nezmäkne.", 60, "BCDFGIJLO", {
      heat: "mierny oheň", wait: true, done: "Vidlička vojde do mäsa ľahko.", tip: "Penu, ktorá sa na začiatku zbiera na hladine, zober naberačkou – polievka bude čírejšia." }],
    ["Mäso vyber na dosku. Kapustu ({kapusta}) nakrájaj na kratšie kúsky a vlož ju do vody, v ktorej sa varilo mäso, spolu s hubami, vodou z húb a rascou ({rasca}). Pridaj celé klobásy ({klobasa}) a var, kým kapusta nie je polomäkká.", 30, "ABCDEFGHIJKLMNO", {
      heat: "mierny oheň", wait: true, done: "Kapusta je mäkká, ale ešte jemne chrumká.", tip: "Kapustu najprv ochutnaj – ak je veľmi kyslá, krátko ju prepláchni studenou vodou." }],
    ["Kým sa kapusta varí, urob zápražku: na panvici rozpusti masť ({mast}), pridaj nadrobno nakrájanú cibuľu ({cibula}) a opekaj ju dozlatista. Primiešaj múku ({muka}) a za stáleho miešania ju opekaj, kým nezíska svetlohnedú farbu. Panvicu odstav, vmiešaj mletú papriku ({paprika_mleta}), hneď prilej naberačku polievky z hrnca a rozmiešaj dohladka.", 8, "ABCDEFHJKLMNO", {
      heat: "stredný oheň", warn: "Paprika na horúcom tuku za pár sekúnd zhorkne – preto panvicu najprv odstav z ohňa." }],
    ["Zápražku vlej do polievky, dobre rozmiešaj a var ešte 20 minút. Klobásy vyber.", 20, "BCDEGHIJNO", {
      heat: "mierny oheň", wait: true, done: "Polievka trochu zhustne a nechutí po múke." }],
    ["Mäso aj klobásy nakrájaj na kúsky veľké na jedno sústo (z mäsa odkroj kosti a kožu) a vráť ich do polievky. Var ešte 10 minút, ochutnaj a dosoľ ({sol}) – údené mäso aj kapusta sú slané, preto sol až na konci.", 10, "BCDGIJO", {
      heat: "mierny oheň", wait: true }],
    ["Kapustnicu podávaj horúcu a do každého taniera daj lyžicu kyslej smotany ({kysla_smotana}).", 0, "BCDFHLNO", {
      tip: "Na Vianoce sa do kapustnice často pridáva aj hrsť sušených sliviek – dodajú jej jemnú sladkosť." }],
  ]),
};

/* ===================================================================== plnená paprika */
const plnenaPaprika: Recipe = {
  id: "plnena-paprika",
  name: "Plnená paprika v paradajkovej omáčke",
  category: "hlavne",
  meat: "bravcove",
  minutes: 150,
  difficulty: 2,
  portions: 4,
  hue: 8,
  icon: "CookingPot",
  tags: ["klasika"],
  source: "",
  book: book(
    {
      active: 40,
      cuisine: "Slovensko · Česko · Maďarsko",
      tools: ["široký hrniec s pokrievkou (aspoň 4 l)", "panvica", "veľká miska", "sitko", "metlička"],
      store: "V chladničke 3 dni v omáčke, dá sa zamraziť. Ohrievaj pomaly pod pokrievkou.",
    },
    [
      ["A", AP, "Plněné papriky s rajskou omáčkou a knedlíkem", "https://www.apetitonline.cz/recept/plnene-papriky-s-rajskou-omackou-knedlikem", 4],
      ["B", AP, "Plněná paprika", "https://www.apetitonline.cz/recept/plnena-paprika", 6],
      ["C", AP, "Plněné papriky", "https://www.apetitonline.cz/recept/plnene-papriky", 4],
      ["D", LB, "Plněné papriky s rajskou omáčkou", "https://www.labuznik.cz/recept/overeny-plnene-papriky-s-rajskou-omackou-43783/", 4],
      ["E", LB, "Oblíbená plněná paprika", "https://www.labuznik.cz/recept/oblibena-plnena-paprika/", 4],
      ["F", TE, "Plnená paprika s paradajkovou omáčkou", "https://www.tesco.sk/hello/recepty/plnena-paprika-s-paradajkovou-omackou/583192"],
      ["G", TR, "Plněné papriky", "https://www.toprecepty.cz/recept/1380-plnene-papriky/", 4],
      ["H", TR, "Plněné papriky s rajskou", "https://www.toprecepty.cz/recept/13741-plnene-papriky-s-rajskou/", 4],
      ["I", TR, "Plněné papriky", "https://www.toprecepty.cz/recept/19910-plnene-papriky/", 4],
      ["J", GK, "Gefüllte Paprika mit Tomatensauce", "https://www.gutekueche.at/gefuellte-paprika-mit-tomatensauce-rezept-4457", 2],
      ["K", GK, "Gefüllte Paprika in Paradeissauce", "https://www.gutekueche.at/gefuellte-paprika-in-paradeissauce-rezept-49020", 4],
      ["L", NS, "Töltött paprika hagyományosan", "https://www.nosalty.hu/recept/toltott-paprika-hagyomanyosan", 4],
      ["M", NS, "Klasszikus töltött paprika", "https://www.nosalty.hu/recept/klasszikus-toltott-paprika", 4],
      ["N", NS, "Töltött paprika paradicsommártással", "https://www.nosalty.hu/recept/toltott-paprika-paradicsommartassal", 5],
    ],
    {
      anchor: "B",
      rows: [
        row("paprika", "ks", "A8 B6 C8 D4 E4 F4 G4 H4 I8 J4 K4 L4 M6 N15"),
        row("mlete", "g", "A500 B600 C500 D400 E300 F250 G500 H500 I500 J400 K500 L500 M700 N1000"),
        row("ryza", "g", "B120 E70 F100 K60 L125 M150 N320"),
        row("vajce", "ks", "A1 B1 C1 E1 F1 G1 H2 K1 L1 M2"),
        row("cibula", "g", "A240 B120 C160 D240 E120 F120 G120 H I120 J200 K340 L160 M180 N180"),
        row("cesnak", "g", "D5 E5 F10 H5 I10 J5 K10 L5 M10 N30"),
        row("sol", "g", "A B C D E F G H I J K L M N"),
        row("korenie+korenie_cele", "ks", "A B C D E F G J K L M N", "Čierne korenie"),
        row("mast+olej+maslo", "g", "A26 B39 C26 D46 E26 G J52 K41 L78 M39 N65", "Tuk (masť, olej, maslo)"),
        row("muka", "g", "A30 B10 C30 E10 G30 H I10 K20 L100 N20"),
        row("pasirovane+pretlak+paradajky", "g", "A500 B716 C532 D282 E100 F750 G70 H140 I200 J516 K1000 L300 M1000 N500", "Paradajky (pasírované, pretlak, čerstvé)"),
        row("cukor", "g", "B30 F G J12 K4 M24 N12"),
        row("bobkovy_list", "ks", "A1 B1 C1 D1 G1 H1"),
      ],
      acts: [
        act("Ryžu do plnky vopred namočiť alebo uvariť", "BEFKLMN", 1),
        act("Cibuľu do plnky vopred speniť", "BJMN", 2),
        act("Papriky očistiť – odrezať vrch, vybrať jadrovník a semienka", "ABCDEFGHIJKLMN", 3),
        act("Plnku z mletého mäsa, vajca, ryže alebo pečiva, cibule a korenia dobre premiešať", "ABCDEFGHIJKLMN", 4),
        act("Naplniť papriky", "ABCDEFGHIJKLMN", 5),
        act("Zo zvyšnej plnky urobiť guľky", "BC", 5),
        act("Omáčku urobiť zo zápražky (tuk a múka) a paradajok", "ABCHKLN", 6),
        act("Omáčku dochutiť cukrom, soľou a korením", "ABCDFGJKMN", 7),
        act("Papriky dusiť v paradajkovej omáčke do mäkka", "ABCDEFGIKLMN", 8),
        act("Podávať s knedľou, zemiakmi, ryžou alebo chlebom", "ABCH", "tip"),
      ],
      changes: [
        "Prepočet kotvy zo 6 na 4 porcie; mäso 500 g a pasírované paradajky 500 g zaokrúhlené na bežné balenie.",
        "Pridaný cesnak: má ho 10 zo 14 zdrojov, kotva nie.",
        "Vynechané nové korenie (len 4 zo 14 zdrojov) a kúsok zeleru (len kotva).",
      ],
    },
  ),
  ingredients: [
    ...ings("Plnka", [
      ["paprika", 4, "ks", { label: "Paprika na plnenie", note: "veľká, svetlozelená alebo biela" }],
      ["ryza", 80, "g", { note: "guľatozrnná" }],
      ["mast", 1, "lyzica", { ref: "mast_c" }],
      ["cibula", 1, "ks"],
      ["mlete", 500, "g", { note: "bravčové alebo zmiešané" }],
      ["vajce", 1, "ks"],
      ["cesnak", 2, "strucik"],
      ["sol", 1, "lyzicka"],
      ["korenie", 1, "stipka", { note: "mleté" }],
    ]),
    ...ings("Omáčka", [
      ["mast", 1, "lyzica"],
      ["muka", 1, "lyzica"],
      ["pretlak", 1, "lyzica"],
      ["voda", 350, "ml"],
      ["pasirovane", 500, "g"],
      ["cukor", 1, "lyzica", { note: "podľa chuti aj viac" }],
      ["sol", 0.5, "lyzicka", { ref: "sol_o" }],
      ["bobkovy_list", 1, "ks"],
      ["korenie_cele", 3, "ks"],
    ]),
  ],
  steps: steps([
    ["Ryžu ({ryza}) prepláchni v sitku studenou vodou, zalej ju horúcou vodou a nechaj hodinu namočiť. Potom ju sceď a nechaj dobre odkvapkať.", 60, "BEFKLMN", {
      wait: true, tip: "Namočená ryža v plnke dovarí a nasaje šťavu z mäsa. Keď sa ponáhľaš, ryžu 10 minút povar a sceď." }],
    ["Cibuľu ({cibula}) nakrájaj nadrobno a na masti ({mast_c}) ju opekaj asi 5 minút do sklovita. Nechaj ju vychladnúť.", 5, "BJMN", {
      heat: "stredný oheň" }],
    ["Paprikám ({paprika}) odrež vršok so stopkou, vylúp jadrovník a vyškrab biele žilky aj semienka. Papriky opláchni zvnútra aj zvonka.", 0, "ABCDEFGHIJKLMN", {
      tip: "Tenkostenné svetlé papriky zmäknú rovnako rýchlo ako plnka." }],
    ["Vo veľkej miske zmiešaj mleté mäso ({mlete}), vajce ({vajce}), scedenú ryžu, vychladnutú cibuľu, prelisovaný cesnak ({cesnak}), soľ ({sol}) a korenie ({korenie}). Plnku rukami dôkladne prepracuj aspoň 2 minúty, kým nie je súdržná.", 0, "ABCDEFGHIJKLMN", {
      done: "Plnka drží pokope a lepí sa na ruky." }],
    ["Naplň papriky tak, aby pri otvore ostal asi pol centimetra voľného miesta – ryža v plnke ešte napučí. Zo zvyšnej plnky urob mokrými rukami guľky veľké ako orech.", 0, "ABCDEFGHIJKLMN"],
    ["Omáčka: v širokom hrnci rozpusti masť ({mast}), pridaj múku ({muka}) a za stáleho miešania ju 1–2 minúty opekaj na svetlú zápražku. Primiešaj pretlak ({pretlak}) a ešte minútu ho opekaj s ňou.", 3, "ABCHKLN", {
      heat: "stredný oheň", warn: "Zápražka sa ľahko pripáli – nepúšťaj sa od nej a stále miešaj." }],
    ["Za stáleho miešania postupne prilievaj vodu ({voda}), aby sa nespravili hrudky, a potom vlej pasírované paradajky ({pasirovane}). Pridaj cukor ({cukor}), soľ ({sol_o}), bobkový list ({bobkovy_list}) a celé korenie ({korenie_cele}) a priveď do varu.", 5, "ABCDFGJKMN", {
      heat: "stredný oheň" }],
    ["Do mierne vriacej omáčky opatrne vlož papriky otvorom nahor a medzi ne guľky. Hrniec prikry a nechaj pomaly dusiť asi hodinu, kým papriky nezmäknú. Občas skontroluj hustotu omáčky – ak príliš zhustne, prilej trochu vody.", 60, "ABCDEFGIKLMN", {
      heat: "mierny oheň", wait: true, done: "Paprika sa ľahko prepichne a plnka je vo vnútri sivobiela, nie ružová (aspoň 71 °C).",
      warn: "Prvých 15 minút guľky nemiešaj, musia stuhnúť, inak sa rozpadnú. Ak treba, hrncom len jemne potras." }],
    ["Vylov bobkový list a guľôčky korenia. Omáčku ochutnaj a dochuť soľou alebo cukrom, aby bola jemne sladkokyslá. Papriky podávaj s guľkami a veľa omáčky.", 0, "ABCDFGJKMN", {
      tip: "K plnenej paprike sa hodí knedľa, varené zemiaky, ryža alebo chlieb." }],
  ]),
};

/* ===================================================================== španielsky vtáčik */
const vtacik: Recipe = {
  id: "vtacik",
  name: "Španielsky vtáčik s ryžou",
  category: "hlavne",
  meat: "hovadzie",
  minutes: 170,
  difficulty: 2,
  portions: 4,
  hue: 28,
  icon: "Beef",
  tags: ["klasika"],
  source: "",
  book: book(
    {
      active: 50,
      cuisine: "Česko · Slovensko",
      tools: ["široký hrniec alebo kastról s pokrievkou", "palička na mäso a fólia", "špáradlá, kovové ihly alebo kuchynská niť", "metlička"],
      store: "V chladničke 3 dni v omáčke, dá sa zamraziť. Ryžu skladuj zvlášť.",
    },
    [
      ["A", AP, "Španělský ptáček", "https://www.apetitonline.cz/recept/spanelsky-ptacek", 4],
      ["B", AP, "Španělský ptáček podle Hany Kolářové", "https://www.apetitonline.cz/recept/spanelsky-ptacek-podle-hany-kolarove", 4],
      ["C", AP, "Španělský ptáček podle Marka Všetečky", "https://www.apetitonline.cz/recept/spanelsky-ptacek-podle-marka-vsetecky", 4],
      ["D", AP, "Španělský ptáček s rýží podle Honzy Punčocháře", "https://www.apetitonline.cz/recept/spanelsky-ptacek-s-ryzi-podle-honzy-puncochare", 7],
      ["E", AP, "Španělské ptáčky babičky Marušky", "https://www.apetitonline.cz/recept/spanelske-ptacky-babicky-marusky", 4],
      ["F", LB, "Španělské ptáčky", "https://www.labuznik.cz/recept/spanelske-ptacky/"],
      ["G", LB, "Španělský ptáček podle babiček", "https://www.labuznik.cz/recept/spanelsky-ptacek-podle-babicek/", 4],
      ["H", LB, "Španělské ptáčky podle babičky Pavly", "https://www.labuznik.cz/recept/spanelske-ptacky-podle-babicky-pavly/", 6],
      ["I", TE, "Španielske vtáčky", "https://www.tesco.sk/hello/recepty/spanielske-vtacky/589151"],
      ["J", TR, "Španělské ptáčky", "https://www.toprecepty.cz/recept/394-spanelske-ptacky/", 8],
      ["K", TR, "Španělský ptáček", "https://www.toprecepty.cz/recept/24678-spanelsky-ptacek/", 4],
      ["L", TR, "Španělský ptáček s rýží", "https://www.toprecepty.cz/recept/62352-spanelsky-ptacek-s-ryzi/"],
      ["M", TR, "Hovězí španělské ptáčky", "https://www.toprecepty.cz/recept/60372-hovezi-spanelske-ptacky-1/", 5],
      ["N", VA, "Klasický španělský ptáček", "https://www.vareni.cz/recepty/klasicky-spanelsky-ptacek/"],
      ["O", VA, "Klasický španělský ptáček s náplní", "https://www.vareni.cz/recepty/klasicky-spanelsky-ptacek-s-naplni/", 4],
      ["P", VA, "Babiččin španělský ptáček", "https://www.vareni.cz/recepty/babiccin-spanelsky-ptacek/", 4],
    ],
    {
      anchor: "K",
      rows: [
        row("hovadzie", "g", "A B750 C600 D800 F G H I500 J800 K500 L M N O P"),
        row("horcica", "g", "A30 C60 D100 E F60 G H30 I J20 K15 L M N120 O P"),
        row("slanina", "g", "A B100 C150 D80 E F100 G H100 J50 K40 L M100 N O100"),
        row("vajce", "ks", "A2 B5 C3 D2 E2 F1 G1 I2 J2 K1 L1 M4 N3 O2 P1.5"),
        row("parky", "ks", "C D4 E2 G1 J2 L N2 O2 P2"),
        row("uhorky_kysle", "ks", "A B3 C3 D2 E2 F2 G2 H I2 J1 K4 L M2 N4 O2.5 P1.5"),
        row("cibula", "g", "A120 B80 C240 D360 E240 F360 G600 H480 I120 J240 K180 L240 M360 N180 O120 P120"),
        row("mast+olej+maslo", "g", "A40 B14 C39 D180 E26 F26 G13 H200 I J92 K60 L M N52 O P", "Tuk (masť, olej, maslo)"),
        row("muka", "g", "A10 C30 D50 E10 F H90 J10 K50 L8 N25 O10"),
        row("vyvar", "g", "A250 B250 C1000 F G H500 I200 K550 L N1300 O P"),
        row("sol", "g", "A B C D E F G H I J K L M N O P"),
        row("korenie", "g", "A B C D E F G H I J K L M N O P"),
        row("ryza", "g", "C D400 F I J L M N O P"),
      ],
      acts: [
        act("Vajcia uvariť natvrdo", "CDGIJKLMNO", 1),
        act("Mäso nakrájať naprieč vláknami a naklepať", "ABCDEFGHIJKMNOP", 2),
        act("Mäso osoliť, okoreniť a potrieť horčicou", "ABCDEFGHIJKLMNOP", 2),
        act("Na plátky poukladať slaninu, párok, vajce a uhorku", "ABCDEFGHIJKLMNOP", 3),
        act("Mäso zvinúť a upevniť špáradlom, ihlou alebo niťou", "ABCDEFGHIJKLMNOP", 3),
        act("Na tuku opražiť cibuľu dozlatista", "GHIKLMNOP", 4),
        act("Závitky opiecť zo všetkých strán", "BCDGJKMNOP", 5),
        act("Podliať a dusiť pod pokrievkou do mäkka, podlievať a obracať", "ABCDEFGHIJKLMNOP", 6),
        act("Závitky vybrať a šťavu zahustiť múkou", "ACDEHJKLNO", 7),
        act("Závitky povariť v omáčke", "CDKO", 8),
        act("Pred podávaním vybrať špáradlá alebo niť a podávať s ryžou", "DFIJKLMNOP", 9),
      ],
      changes: [
        "Pražská saláma z kotvy nahradená párkami: párok má 9 zo 16 zdrojov, salámu len kotva.",
        "Slanina 80 g a horčica 2 lyžice: kotva má menej, ako je bežné v ostatných zdrojoch.",
        "2 stredné uhorky namiesto 4 malých (pol uhorky do závitku, ako vo väčšine zdrojov).",
        "Múka 3 lyžice namiesto 50 g: 50 g je nad bežným rozpätím, omáčka by bola veľmi hustá.",
        "Ryža na podávanie: spomína ju 10 zo 16 zdrojov.",
      ],
    },
  ),
  ingredients: [
    ...ings("Závitky", [
      ["hovadzie", 500, "g", { note: "zadné alebo vysoká roštenka, v kuse" }],
      ["sol", 1, "lyzicka"],
      ["korenie", 1, "stipka", { note: "mleté" }],
      ["horcica", 2, "lyzica", { note: "plnotučná" }],
      ["slanina", 80, "g", { note: "údená, v kuse" }],
      ["parky", 2, "ks"],
      ["vajce", 1, "ks"],
      ["uhorky_kysle", 2, "ks", { note: "stredné" }],
    ]),
    ...ings("Omáčka", [
      ["cibula", 180, "g", { note: "1 veľká" }],
      ["mast", 60, "g"],
      ["vyvar", 550, "ml", { label: "Vývar", note: "hovädzí, alebo voda" }],
      ["muka", 3, "lyzica"],
    ]),
    ...ings("Na podávanie", [["ryza", 240, "g", { note: "dlhozrnná" }]]),
  ],
  steps: steps([
    ["Vajce ({vajce}) vlož do vriacej vody a var ho 10 minút natvrdo. Schlaď ho v studenej vode, olúp a nakrájaj na štvrtiny. Uhorky ({uhorky_kysle}) rozkroj pozdĺžne na štvrtiny a párky ({parky}) pozdĺžne na polovice.", 10, "CDGIJKLMNO", {
      wait: true }],
    ["Mäso ({hovadzie}) nakrájaj naprieč vláknami na 4 rovnaké plátky. Prikry ich fóliou a paličkou ich rozklepni čo najtenšie, asi na pol centimetra, tak, aby neboli diery. Z vrchnej strany ich osoľ ({sol}), okoreň ({korenie}) a natri horčicou ({horcica}).", 0, "ABCDEFGHIJKLMNOP", {
      tip: "Fólia zabráni tomu, aby sa mäso trhalo a špliechalo." }],
    ["Na užší koniec každého plátku polož špalíček slaniny ({slanina}), polovicu párku, štvrtinu vajca a dva kúsky uhorky. Boky plátku zahni dovnútra a mäso pevne zroluj. Závitok prepichni špáradlom alebo kovovou ihlou, prípadne ho previaž niťou, a zvonka ho jemne osoľ.", 0, "ABCDEFGHIJKLMNOP", {
      tip: "Keď boky plátku najprv zahneš dovnútra, plnka pri dusení nevypadne." }],
    ["Cibuľu ({cibula}) nakrájaj nadrobno. V širokom hrnci s pokrievkou rozohrej masť ({mast}) a cibuľu opekaj 10–15 minút dozlatista. Po prvých minútach stíš oheň, aby sa nepripálila.", 12, "GHIKLMNOP", {
      heat: "stredný oheň", done: "Cibuľa je zlatohnedá a mäkká." }],
    ["Zvýš oheň, vlož závitky k cibuli a opeč ich zo všetkých strán dohneda. Potom ich podlej trochou teplého vývaru ({vyvar}).", 8, "BCDGJKMNOP", {
      heat: "silný oheň" }],
    ["Stíš oheň, hrniec prikry a závitky dus takmer do mäkka. Asi každých 20 minút ich obráť a podlej trochou vývaru, aby šťava nevyvrela.", 75, "ABCDEFGHIJKLMNOP", {
      heat: "mierny oheň", wait: true, done: "Vidlička vojde do závitku s miernym odporom." }],
    ["Závitky vyber na tanier. Šťavu nechaj vyvrieť, kým na dne neostane najmä masť s cibuľou, posyp ju múkou ({muka}) a za stáleho miešania 2–3 minúty opekaj.", 3, "ACDEHJKLNO", {
      heat: "stredný oheň", warn: "Múku stále miešaj, pri dne sa ľahko pripáli." }],
    ["Postupne prilej zvyšok vývaru – omáčka má byť skôr redšia, pri varení zhustne. Metličkou ju rozmiešaj dohladka, vráť do nej závitky a na veľmi miernom ohni var 45 minút. Občas premiešaj.", 45, "CDKO", {
      heat: "veľmi mierny oheň", wait: true, done: "Závitky sú mäkké a omáčka hustá a lesklá." }],
    ["Omáčku ochutnaj a dochuť soľou a korením. Zo závitkov vytiahni špáradlá alebo niť. Podávaj ich celé alebo rozkrojené napoly, aby bolo vidno plnku, s dusenou ryžou ({ryza}) a veľa omáčky.", 0, "DFIJKLMNOP", {
      tip: "Ryžu uvar podľa návodu na obale, kým sa závitky dusia v omáčke." }],
  ]),
};

/* ===================================================================== musaka */
const musaka: Recipe = {
  id: "musaka",
  name: "Grécka musaka",
  category: "hlavne",
  meat: "hovadzie",
  minutes: 140,
  difficulty: 3,
  portions: 4,
  hue: 20,
  icon: "UtensilsCrossed",
  tags: [],
  source: "",
  book: book(
    {
      active: 50,
      cuisine: "Grécko",
      tools: ["široký hrniec s pokrievkou", "2 plechy a papier na pečenie", "zapekacia misa asi 20 × 25 cm", "menší hrniec a metlička", "alobal"],
      store: "V chladničke 3 dni, dá sa zamraziť po porciách. Prehrej v rúre pri 160 °C.",
    },
    [
      ["A", AP, "Musaka", "https://www.apetitonline.cz/recept/musaka", 4],
      ["B", AP, "Řecká musaka", "https://www.apetitonline.cz/recept/recka-musaka", 8],
      ["C", AP, "Nejlepší musaka", "https://www.apetitonline.cz/recept/nejlepsi-musaka"],
      ["D", GK, "Griechisches Moussaka", "https://www.gutekueche.at/griechisches-moussaka-rezept-4605", 2],
      ["E", GK, "Moussaka Grundrezept", "https://www.gutekueche.at/moussaka-grundrezept-rezept-22645", 4],
      ["F", GK, "Griechisches Moussaka", "https://www.gutekueche.at/griechisches-moussaka-rezept-4687", 2],
      ["G", MA, "La vraie moussaka grecque", "https://www.marmiton.org/recettes/recette_la-vraie-moussaka-grecque_72593.aspx", 4],
      ["H", MA, "Moussaka boeuf et aubergines", "https://www.marmiton.org/recettes/recette_moussaka-boeuf-et-aubergines_345975.aspx", 4],
      ["I", TR, "Řecká musaka", "https://www.toprecepty.cz/recept/44299-recka-musaka/", 6],
      ["J", TR, "Řecká musaka z lilku", "https://www.toprecepty.cz/recept/86152-recka-musaka-z-lilku/"],
      ["K", NS, "Hagyományos muszaka", "https://www.nosalty.hu/recept/hagyomanyos-muszaka", 6],
    ],
    {
      anchor: "I",
      rows: [
        row("baklazan", "g", "A300 B1500 C600 D250 E1000 F200 G600 H600 I500 J500 K400"),
        row("zemiaky", "g", "A125 B625 D300 F150 G750 H375 I800 K300"),
        row("mlete", "g", "A500 B600 C450 D250 E750 F200 G500 H300 I500 J500 K600"),
        row("paradajky_kraj+paradajky+pretlak", "g", "A800 B480 C540 D416 E800 F150 G600 H200 I460 J400 K560", "Paradajky (konzerva, čerstvé, pretlak)"),
        row("cibula", "g", "A120 B120 C240 D120 E360 G120 H120 I120 J120 K120"),
        row("cesnak", "g", "C15 D5 E20 F10 H5 I10 J25 K10"),
        row("olivovy_olej+olej", "g", "A13 B C D E104 F13 G26 H13 I91 J26 K300", "Olej"),
        row("skorica", "g", "A2.6 B C D E2.6 G2.6 I K2"),
        row("oregano", "g", "A6 C D E3 I1 J0.5 K3"),
        row("sol", "g", "A B C D E F G H I J K"),
        row("korenie", "g", "A C D E F G H I J K"),
        row("maslo", "g", "B39 C D47 F28 G50 H20 I30 J28 K100"),
        row("muka", "g", "B50 C40 D40 F20 G30 H20 I20 J20 K100"),
        row("mlieko", "g", "B750 C570 D400 F200 G350 H200 I350 J500 K700"),
        row("eidam+parmezan", "g", "A100 B C D150 E400 F5 H30 I150 J150", "Syr"),
      ],
      acts: [
        act("Na oleji speniť cibuľu (a cesnak), opražiť mleté mäso", "ABCDEFGHIJK", 1),
        act("Mäso okoreniť (oregano, škorica), pridať paradajky a dusiť", "ABCDEFGHIJK", 3),
        act("Baklažán nakrájať na plátky a opiecť v rúre alebo na panvici", "BCEFIJK", 4),
        act("Baklažán osoliť a nechať vypotiť", "BCDFGIK", 4),
        act("Zemiaky nakrájať na tenké plátky", "ABDFGHIK", 5),
        act("Zemiaky predvariť alebo opiecť", "BDGHK", "tip"),
        act("Urobiť bešamel z masla, múky a mlieka", "BCDFGHIJK", 6),
        act("Do bešamelu vmiešať syr", "BCIJ", 6),
        act("Vrstviť baklažán, zemiaky a mäso, navrch bešamel", "ABCDEFGHIJK", 7),
        act("Piecť v rúre dozlatista", "ABCDEFGHIJK", 8),
        act("Pred krájaním nechať odpočinúť", "K", "tip"),
      ],
      changes: [
        "Prepočet zo 6 na 4 porcie; baklažán 400 g, zemiaky 500 g a mäso 400 g zaokrúhlené na bežné kusy a balenia.",
        "Oregano 2 lyžičky a škorica 1 lyžička: kotva ich dáva „podľa chuti“, množstvo podľa ostatných zdrojov.",
        "Vynechaná bazalka: má ju len kotva.",
        "Bešamel 20 g masla, 2 lyžice múky a 250 ml mlieka – kotva prepočítaná a zaokrúhlená.",
      ],
    },
  ),
  ingredients: [
    ...ings("Mäsová omáčka", [
      ["olivovy_olej", 5, "lyzica", { note: "2 do omáčky, zvyšok na baklažán a misu" }],
      ["cibula", 1, "ks"],
      ["cesnak", 2, "strucik"],
      ["mlete", 400, "g", { label: "Hovädzie mleté mäso" }],
      ["oregano", 2, "lyzicka"],
      ["skorica", 1, "lyzicka"],
      ["paradajky_kraj", 400, "g", { note: "1 konzerva" }],
      ["pretlak", 2, "lyzica"],
      ["sol", 1, "lyzicka"],
      ["korenie", 1, "stipka", { note: "mleté" }],
    ]),
    ...ings("Zelenina", [
      ["baklazan", 400, "g", { note: "1 veľký alebo 2 menšie" }],
      ["zemiaky", 500, "g"],
    ]),
    ...ings("Bešamel", [
      ["maslo", 20, "g"],
      ["muka", 2, "lyzica"],
      ["mlieko", 250, "ml"],
      ["eidam", 100, "g", { note: "alebo gouda, kefalotyri" }],
    ]),
  ],
  steps: steps([
    ["Cesnak ({cesnak}) olúp a prelisuj, cibuľu ({cibula}) nakrájaj nadrobno. V širokom hrnci rozohrej 2 lyžice oleja ({olivovy_olej}) a cibuľu opekaj asi 5 minút dozlatista. Pridaj cesnak a opekaj ešte minútu.", 6, "ABCDEFGHIJK", {
      heat: "stredný oheň", warn: "Cesnak pridaj až ku koncu – spálený horkne." }],
    ["Pridaj mleté mäso ({mlete}), varechou ho rozdrob na drobné kúsky a za stáleho miešania 5 minút opekaj, kým nezmení farbu.", 5, "ABCDEFGHIJK", {
      heat: "silnejší oheň" }],
    ["Vmiešaj oregano ({oregano}) a škoricu ({skorica}), pridaj krájané paradajky ({paradajky_kraj}) a pretlak ({pretlak}). Prikry a var na strednom ohni 45 minút, občas premiešaj. Nakoniec dochuť soľou ({sol}) a korením ({korenie}).", 45, "ABCDEFGHIJK", {
      heat: "stredný oheň", wait: true, done: "Omáčka je hustá, takmer bez tekutiny navrchu." }],
    ["Kým sa omáčka varí, rozohrej rúru na 180 °C a dva plechy vylož papierom na pečenie. Baklažán ({baklazan}) nakrájaj na plátky hrubé asi 8 mm, z oboch strán ich potri olejom, rozlož na plechy a osoľ. Peč asi 10 minút, kým nezmäknú.", 10, "BCEFIJK", {
      heat: "180 °C", wait: true, done: "Plátky sú mäkké a ohybné.", tip: "Soľ z baklažánu vytiahne vodu a horkosť – plátky sa pri pečení nenasajú olejom." }],
    ["Zemiaky ({zemiaky}) ošúp a nakrájaj na tenké plátky, asi 3–4 mm.", 0, "ABDFGHIK", {
      tip: "Ak sú plátky hrubšie, povar ich 5 minút v osolenej vode – inak by v musake neostali mäkké." }],
    ["Bešamel: v menšom hrnci rozpusti maslo ({maslo}), za stáleho miešania primiešaj múku ({muka}) a minútu ju opekaj na svetlú zápražku. Postupne prilievaj mlieko ({mlieko}) a miešaj metličkou, kým omáčka nezhustne a nie je hladká. Vmiešaj polovicu nastrúhaného syra ({eidam}).", 6, "BCDFGHIJK", {
      heat: "mierny oheň", warn: "Mlieko prilievaj po troškách a stále miešaj, inak vzniknú hrudky." }],
    ["Zapekaciu misu vymaž olejom. Navrstvi polovicu baklažánu, na ňu polovicu zemiakov a polovicu mäsovej omáčky. Vrstvy zopakuj a navrch rovnomerne rozotri bešamel.", 0, "ABCDEFGHIJK"],
    ["Misu tesne prikry alobalom a peč 45 minút pri 180 °C. Potom alobal odstráň, posyp zvyšným syrom a peč odkryté ešte 15 minút, kým syr nie je zlatistý.", 60, "ABCDEFGHIJK", {
      heat: "180 °C", wait: true, done: "Syr je zlatý, pri okrajoch bublá a zemiaky sú mäkké (skús nožom).", tip: "Pred krájaním nechaj musaku 10–15 minút odpočinúť, kúsky sa potom nerozpadnú." }],
  ]),
};

/* ===================================================================== chili con carne */
const chili: Recipe = {
  id: "chili",
  name: "Chili con carne",
  category: "hlavne",
  meat: "hovadzie",
  minutes: 60,
  difficulty: 1,
  portions: 4,
  hue: 12,
  icon: "CookingPot",
  tags: ["rychle"],
  source: "",
  book: book(
    {
      active: 25,
      cuisine: "Mexiko · USA",
      tools: ["veľká panvica s vysokým okrajom alebo hrniec s pokrievkou", "sitko na fazuľu", "vareška"],
      store: "V chladničke 3–4 dni, dá sa zamraziť. Na druhý deň je ešte chutnejšie.",
    },
    [
      ["A", AP, "Chilli con carne", "https://www.apetitonline.cz/recept/chilli-con-carne", 6],
      ["B", AP, "Vydatné chilli con carne", "https://www.apetitonline.cz/recept/vydatne-chilli-con-carne", 4],
      ["C", AP, "Oblíbené chilli con carne Baracka Obamy", "https://www.apetitonline.cz/recept/oblibene-chilli-con-carne-baracka-obamy", 4],
      ["D", TR, "Snadné chilli con carne", "https://www.toprecepty.cz/recept/15100-snadne-chilli-con-carne/", 4],
      ["E", TR, "Chili con Carne III.", "https://www.toprecepty.cz/recept/20939-chili-con-carne-iii/", 5],
      ["F", TR, "Texaská specialita chilli con carne", "https://www.toprecepty.cz/recept/13889-texaska-specialita-chilli-con-carne/", 5],
      ["G", VA, "Chili con carne podle Richarda Nováka", "https://www.vareni.cz/recepty/chili-con-carne-podle-richarda-novaka/", 6],
      ["H", LB, "Chili con carne", "https://www.labuznik.cz/recept/chili-con-carne/", 6],
      ["I", LB, "Chili con carne (naše nejoblíbenější)", "https://www.labuznik.cz/recept/chili-con-carne-nase-nejoblibenejsi/", 4],
      ["J", TE, "Chilli con carne", "https://www.tesco.sk/hello/recepty/chilli-con-carne/589872"],
      ["K", GK, "Chili con carne klassisch", "https://www.gutekueche.at/chili-con-carne-klassisch-rezept-3962", 4],
      ["L", GK, "Chili con carne – Das Original", "https://www.gutekueche.at/chili-con-carne-das-original-rezept-5690", 4],
      ["M", NS, "Chili con carne", "https://www.nosalty.hu/recept/chili-con-carne", 4],
      ["N", NS, "Chili con carne egyszerűen", "https://www.nosalty.hu/recept/chili-con-carne-egyszeruen", 4],
    ],
    {
      anchor: "B",
      rows: [
        row("mlete", "g", "A500 B500 C450 D500 E500 F500 G500 H1000 I600 J500 K500 L500 M500 N500"),
        row("cibula", "g", "A120 B120 C120 D120 E120 F120 G240 H400 I240 J180 K30 L120 M120 N240"),
        row("cesnak", "g", "A5 B10 C D10 E10 F10 G25 H20 I5 J20 K15 L5 M15 N20"),
        row("paprika_cervena+paprika", "ks", "A1 B1 C1 E1 F1 L2 N2", "Čerstvá paprika"),
        row("chilli", "g", "A B C D E F G H I J K L M N"),
        row("paprika_mleta", "g", "A2.5 B7 F7 G21 L"),
        row("rimska_rasca", "g", "A6 B6 C D2 E1 F6 G4 I1 J K L1 N"),
        row("paradajky_kraj+pretlak+paradajky", "g", "A651 B411 C400 E400 F411 G1080 H500 I450 J432 L416 N600", "Paradajky (konzerva, pretlak, čerstvé)"),
        row("fazula", "ks", "A2 B1 C1 D1 E1 F1 G4 H1.25 I1 J1 K1 L1 M0.5 N1.25"),
        row("vyvar", "g", "A300 B300 E F G1500 J K500 L500"),
        row("oregano", "g", "C E G I J K M N"),
        row("olej+olivovy_olej", "g", "A13 B13 C13 D13 E26 F13 G H65 I26 J13 K L M26 N104", "Olej"),
        row("sol", "g", "A B C D E F G H I J K L M N"),
        row("korenie", "g", "A B C D E G H I J K L M N"),
      ],
      acts: [
        act("Na oleji speniť cibuľu do sklovita", "ABCDEFGHIJLMN", 2),
        act("Pridať cesnak, papriku a koreniny a krátko orestovať", "ABCDFGL", 2),
        act("Pridať mleté mäso a opražiť, rozdrobiť ho", "ABCDEFGHIJKLMN", 3),
        act("Pridať paradajky, vývar a korenie", "ABCEFGHIJKLN", 4),
        act("Dusiť pod pokrievkou", "ABCDGHIKL", 5),
        act("Pridať scedenú fazuľu a povariť", "ABCDEFGHIJKLMN", 6),
        act("Nechať pred podávaním odstáť", "B", 7),
        act("Zjemniť cukrom, čokoládou alebo kakaom", "ABEFG", "tip"),
        act("Podávať s ryžou, chlebom alebo tortillovými lupienkami a kyslou smotanou", "ACDGJMN", "tip"),
      ],
      changes: [
        "Majorán z kotvy nahradený oreganom: oregano má 8 zo 14 zdrojov, majorán len 4.",
        "Rímska rasca 2 lyžičky namiesto 1 lyžice: lyžica je najviac zo všetkých zdrojov.",
        "Cukor z kotvy presunutý do rady: sladidlo (cukor, čokoláda alebo kakao) má len 5 zo 14 zdrojov.",
      ],
    },
  ),
  ingredients: [
    ...ings("Chili", [
      ["olej", 1, "lyzica"],
      ["cibula", 1, "ks"],
      ["paprika_cervena", 1, "ks"],
      ["cesnak", 2, "strucik"],
      ["chilli", 1, "lyzica", { note: "sušené vločky; menej, ak nemáš rád ostré" }],
      ["paprika_mleta", 1, "lyzica", { note: "sladká" }],
      ["rimska_rasca", 2, "lyzicka", { note: "mletá" }],
      ["mlete", 500, "g", { label: "Hovädzie mleté mäso" }],
      ["vyvar", 300, "ml", { label: "Vývar", note: "hovädzí" }],
      ["paradajky_kraj", 400, "g", { note: "1 konzerva" }],
      ["oregano", 1, "lyzicka"],
      ["pretlak", 2, "lyzicka"],
      ["fazula", 1, "ks", { note: "1 konzerva 400 g, scedená" }],
      ["sol", 1, "lyzicka"],
      ["korenie", 1, "stipka", { note: "mleté" }],
    ]),
  ],
  steps: steps([
    ["Cibuľu ({cibula}) nakrájaj na drobné kocky. Papriku ({paprika_cervena}) rozkroj, vyber jadrovník a nakrájaj ju na centimetrové kocky. Cesnak ({cesnak}) olúp a nakrájaj na tenké plátky.", 0, "ABCDEFGHIJLMN"],
    ["Vo väčšej panvici s vysokým okrajom alebo v hrnci rozohrej olej ({olej}) a cibuľu na ňom opekaj asi 5 minút, kým nezmäkne a nezosklovatie. Pridaj cesnak, papriku, chilli ({chilli}), mletú papriku ({paprika_mleta}) a rímsku rascu ({rimska_rasca}) a 1–2 minúty opekaj, kým koreniny nezavoňajú.", 7, "ABCDFGL", {
      heat: "stredný oheň", warn: "Mletá paprika a koreniny sa ľahko pripália a zhorknú – stále miešaj, a ak treba, stíš oheň." }],
    ["Pridaj mleté mäso ({mlete}) a varechou ho rozdrob na drobné kúsky. Za stáleho miešania ho asi 5 minút opekaj, kým nie je celé sivohnedé, bez ružových miest.", 5, "ABCDEFGHIJKLMN", {
      heat: "silnejší oheň", tip: "Olej s cibuľou a korením bude trochu prskať – miešaj s odstupom." }],
    ["Prilej vývar ({vyvar}), pridaj krájané paradajky ({paradajky_kraj}), oregano ({oregano}), pretlak ({pretlak}), soľ ({sol}) a korenie ({korenie}) a dobre premiešaj.", 0, "ABCEFGHIJKLN"],
    ["Priveď do varu, prikry pokrievkou, stíš oheň na minimum a nechaj 20 minút pomaly bublať. Občas premiešaj, a ak omáčka príliš zhustne alebo sa prichytáva, prilej trochu vody.", 20, "ABCDGHIKL", {
      heat: "mierny oheň", wait: true, done: "Omáčka je hustá a šťavnatá." }],
    ["Fazuľu ({fazula}) sceď v sitku a prepláchni studenou vodou. Pridaj ju k mäsu, znova priveď do varu a var ešte 10 minút. Ochutnaj a dochuť soľou a korením – chili zvyčajne potrebuje viac soli, ako by si čakal.", 10, "ABCDEFGHIJKLMN", {
      heat: "mierny oheň", wait: true }],
    ["Stiahni z ohňa, odkry a nechaj aspoň 10 minút odstáť, aby sa chute spojili.", 10, "B", {
      wait: true, tip: "Lyžica cukru alebo kocka horkej čokolády zjemní kyslosť paradajok. Podávaj s ryžou, chlebom alebo tortillovými lupienkami a lyžicou kyslej smotany." }],
  ]),
};

/** Recepty overené metódou „kotva“ (v knihe idú pred staršími). */
export const BOOK_CHECKED: Recipe[] = [svieckova, kapustnica, plnenaPaprika, vtacik, musaka, chili].map(finish);
