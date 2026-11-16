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
/** Riadky a úkony skupiny s vlastnými zdrojmi (napr. halušky): porovnávajú sa len s jej zdrojmi. */
const grp = <T extends object>(group: string, list: T[]): (T & { group: string })[] => list.map((x) => ({ ...x, group }));

/** Zdroje, porcie zdrojov a písmená zdrojov pri surovinách (podľa riadkov porovnania). */
function book(
  info: Omit<BookInfo, "sources" | "check" | "photos"> & { photos?: number },
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
  segedin: [["pliecko", "cibula", "cesnak"], ["mast", "rasca"], ["pliecko", "cesnak", "sol", "muka"], ["paprika_mleta"], ["vyvar", "bobkovy_list"],
    ["kapusta", "vyvar"], ["smotana_sladka", "sol", "korenie"], ["knedla"]],
  paprikas: [["kuracie_stehna", "sol", "cibula"], ["maslo", "cibula"], ["paprika_mleta", "voda"], ["kuracie_stehna", "voda"], ["muka_h", "vajce", "sol_h", "voda_h"],
    ["sol_v"], [], ["olej"], [], ["muka", "smotana"], ["sol"]],
  kulajda: [["sampinony", "cibula", "zemiaky"], ["voda", "sampinony", "cibula", "bobkovy_list", "nove_korenie", "korenie_cele", "rasca"], ["muka", "kysla_smotana"],
    ["zemiaky"], ["vajce"], ["ocot", "sol", "korenie", "kopor"], ["maslo"], ["vajce", "sol", "korenie", "kopor"]],
  medovnik: [["kondenz"], ["maslo", "tuk"], ["vajce", "med", "cukor", "muka", "soda"], [], [], [], ["orechy"], ["maslo", "kondenz"], [], [], []],
  lasagne: [["cibula", "cesnak"], ["olej", "cibula", "cesnak"], ["mlete", "sol", "korenie", "oregano"], ["paradajky_kraj"], ["eidam"],
    ["maslo", "muka", "mlieko", "muskat", "sol", "korenie"], ["lasagne", "eidam"], []],
};

/** Pri každej surovine písmená zdrojov, ktoré ju majú, a pri krokoch ich suroviny. */
function finish(r: Recipe): Recipe {
  const rows = r.book?.check?.rows ?? [];
  const uses = USES[r.id];
  const groups = r.book?.check?.groups ?? {};
  return {
    ...r,
    ingredients: r.ingredients.map((x) => {
      const g = x.group && (groups[x.group] || rows.some((w) => w.group === x.group)) ? x.group : undefined;
      const row = rows.find((w) => w.foods.split("+").includes(x.food) && w.group === g);
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

/* ===================================================================== segedínsky guláš */
const segedin: Recipe = {
  id: "segedin",
  name: "Segedínsky guláš",
  category: "hlavne",
  meat: "bravcove",
  minutes: 110,
  difficulty: 2,
  portions: 4,
  hue: 25,
  icon: "CookingPot",
  tags: ["klasika"],
  source: "",
  book: book(
    {
      photos: 3, // staršie fotky; nové (4) čakajú na kredit na obrázky
      active: 30,
      cuisine: "Česko · Slovensko",
      tools: ["hrniec s hrubým dnom a pokrievkou (aspoň 4 l)", "sitko na kapustu", "lis na cesnak"],
      store: "V chladničke 3 dni v uzavretej nádobe, dá sa zamraziť. Ohrievaj pomaly a často miešaj.",
    },
    [
      ["A", AP, "Tradiční segedínský guláš", "https://www.apetitonline.cz/recept/tradicni-segedinsky-gulas", 4],
      ["B", AP, "Segedínský guláš jako od babičky", "https://www.apetitonline.cz/recept/segedinsky-gulas-jako-od-babicky", 4],
      ["C", AP, "Segedínský guláš podle Pohlreicha", "https://www.apetitonline.cz/recept/segedinsky-gulas-podle-pohlreicha", 4],
      ["D", AP, "Segedínský guláš se zakysanou smetanou", "https://www.apetitonline.cz/recept/segedinsky-gulas-se-zakysanou-smetanou", 5],
      ["E", AP, "Guláš Székely neboli segedínský guláš", "https://www.apetitonline.cz/recept/gulas-szekely-neboli-segedinsky-gulas", 7],
      ["F", LB, "Segedinský guláš", "https://www.labuznik.cz/recept/segedinsky-gulas/", 4],
      ["G", LB, "Segedinský guláš", "https://www.labuznik.cz/recept/segedinsky-gulas-1/", 4],
      ["H", LB, "Székely Gulyás, prostě další segedín", "https://www.labuznik.cz/recept/szekely-gulyas-proste-dalsi-segedin/", 6],
      ["I", TR, "Segedínský guláš", "https://www.toprecepty.cz/recept/1495-segedinsky-gulas/", 5],
      ["J", TR, "Můj segedínský guláš", "https://www.toprecepty.cz/recept/19069-muj-segedinsky-gulas/", 8],
      ["K", TR, "Segedínský guláš, jak ho vařila maďarská babička", "https://www.toprecepty.cz/recept/30046-segedinsky-gulas-jak-ho-varila-madarska-babicka/", 4],
      ["L", TR, "Náš segedínský guláš", "https://www.toprecepty.cz/recept/33653-nas-segedinsky-gulas/", 4],
      ["M", VA, "Dobrý segedínský guláš", "https://www.vareni.cz/recepty/dobry-segedinsky-gulas/", 4],
      ["N", VA, "Domácí segedínský guláš", "https://www.vareni.cz/recepty/domaci-segedinsky-gulas/", 8],
      ["O", VA, "Jednoduchý segedínský guláš", "https://www.vareni.cz/recepty/jednoduchy-segedinsky-gulas/", 4],
      ["P", VA, "Segedín po česku", "https://www.vareni.cz/recepty/segedin-po-cesku/", 6],
      ["Q", GK, "Szegediner Gulasch", "https://www.gutekueche.at/szegediner-gulasch-rezept-27537", 4],
    ],
    {
      anchor: "A",
      rows: [
        row("pliecko", "g", "A800 B1000 C750 D1000 E900 F400 G400 H1000 I500 J1200 K500 L500 M400 N1250 O1000 P750 Q800", "Bravčové mäso (pliecko, krkovička)"),
        row("mast+olej+maslo", "g", "A39 B C100 D39 E100 F40 H26 I J150 K L M N13 O P26 Q", "Tuk (masť, olej)"),
        row("cibula", "g", "A480 B240 C200 D120 E250 F80 G240 H150 I360 J540 K360 L120 M240 N360 O180 P240 Q"),
        row("rasca", "g", "A2 C2 E2 F1.5 H3 I J L N O P Q1"),
        row("cesnak", "g", "A20 E10 H5 K7.5 L10 Q10"),
        row("muka", "g", "A20 B20 C80 D30 F30 H20 I30 J20 L O P20"),
        row("paprika_mleta", "g", "A14 B2.5 C5 D7 E15 F7.5 G H14 I3.75 J20 K5 L M21 N14 O P5 Q16.5"),
        row("vyvar+voda", "g", "A1200 C500 D200 G H720 L1000 N500 P Q350", "Vývar alebo voda"),
        row("bobkovy_list", "ks", "A4 D G3 L1 M3 N P3 Q1"),
        row("kapusta", "g", "A400 B1000 C700 D400 E1200 F400 G300 H500 I500 J750 K500 L1000 M300 N500 O500 P Q350"),
        row("smotana_sladka+kysla_smotana+smotana", "g", "A260 B200 C300 D200 E400 F250 G H120 I100 J200 K300 L30 M200 N200 O200 P Q150", "Smotana (sladká, kyslá)"),
        row("sol", "g", "A B C D E F G H I J K L M N O P Q"),
        row("korenie", "g", "A B C D G H I L M O P Q"),
        row("knedla", "ks", "A B C H J K L M N O P"),
      ],
      acts: [
        act("Na tuku speniť cibuľu dozlatista", "ABCEFIJLNP", 2),
        act("Pridať rascu", "ACEFHINOPQ", 2),
        act("Pridať mäso a opiecť ho zo všetkých strán", "ACDEFHIJKLNPQ", 3),
        act("Zaprášiť múkou", "ABCDFHIJLOP", 3),
        act("Pridať mletú papriku a krátko ju opražiť", "ABCDEFGHIJKLMNOPQ", 4),
        act("Podliať vývarom alebo vodou a dusiť pod pokrievkou", "ABCDEFHIJKLNOPQ", 5),
        act("Pridať kyslú kapustu a dusiť, kým nie je mäso mäkké", "ABCDEFGHIJKLMNOPQ", 6),
        act("Kapustu prepláchnuť, ak je veľmi kyslá", "BCHLNPQ", "tip"),
        act("Zjemniť smotanou a krátko povariť", "ABCDEFGHIJKLMNOPQ", 7),
        act("Podávať s knedľou", "ABCHJKLMNOP", 8),
        act("Na tanier pridať lyžicu kyslej smotany", "A", "tip"),
      ],
      changes: [
        "Cibuľa 2 ks namiesto 4: štyri cibule sú najviac zo všetkých zdrojov (bežne 120–270 g na 4 porcie).",
        "Cesnak 2 strúčiky namiesto 4, mletá paprika 1 lyžica namiesto 2, bobkové listy 2 namiesto 4 a vývar 500 ml namiesto 1,2 l: množstvá kotvy sú nad bežným rozpätím zdrojov.",
        "Kyslá kapusta 500 g namiesto 400 g: jedno bežné balenie, stále v bežnom rozpätí zdrojov.",
        "Kyslá smotana na tanier je v rade, nie medzi surovinami – je na ozdobu.",
      ],
    },
  ),
  ingredients: [
    ...ings("Guláš", [
      ["pliecko", 800, "g", { note: "alebo krkovička" }],
      ["cibula", 2, "ks"],
      ["cesnak", 2, "strucik"],
      ["mast", 3, "lyzica", { note: "alebo olej" }],
      ["rasca", 1, "lyzicka", { note: "celá, pomletá alebo nasekaná" }],
      ["sol", 1, "lyzicka"],
      ["muka", 2, "lyzica", { note: "hladká" }],
      ["paprika_mleta", 1, "lyzica", { note: "sladká" }],
      ["vyvar", 500, "ml", { label: "Vývar", note: "hovädzí alebo bravčový, aj z kocky" }],
      ["bobkovy_list", 2, "ks"],
    ]),
    ...ings("Kapusta a smotana", [
      ["kapusta", 500, "g"],
      ["smotana_sladka", 200, "ml"],
      ["korenie", 1, "stipka", { note: "mleté" }],
    ]),
    ...ings("Na podávanie", [["knedla", 1.5, "ks", { label: "Žemľová knedľa" }]]),
  ],
  steps: steps([
    ["Mäso ({pliecko}) nakrájaj na kocky asi 3 cm a osuš ho papierovou utierkou. Cibuľu ({cibula}) nakrájaj nadrobno, cesnak ({cesnak}) olúp a prelisuj.", 0, "ABCDEFGHIJKLMNOPQ"],
    ["V hrnci s hrubým dnom rozpusti masť ({mast}) a cibuľu na nej za občasného miešania opekaj asi 8 minút dozlatista. Pridaj rascu ({rasca}) a minútu ju opekaj s cibuľou.", 9, "ABCEFIJLNP", {
      heat: "stredný oheň", done: "Cibuľa je mäkká a zlatistá, nie tmavohnedá.", tip: "Rascu pred pridaním pomeľ alebo nasekaj nožom – lepšie pustí vôňu a nebude škrípať pod zubami." }],
    ["Pridaj mäso a za občasného miešania ho opekaj asi 8 minút, kým nie je zo všetkých strán zatiahnuté – sivé, bez ružových miest. Pridaj cesnak, osoľ ({sol}), poprás múkou ({muka}) a za stáleho miešania ešte minútu opekaj.", 9, "ACDEFHIJKLNPQ", {
      heat: "silnejší oheň", warn: "Ak sa mäso nezmestí do hrnca v jednej vrstve, opekaj ho po dávkach. Naraz by pustilo šťavu a dusilo by sa namiesto opekania." }],
    ["Stíš oheň, posyp mäso mletou paprikou ({paprika_mleta}) a za stáleho miešania ju opekaj len asi pol minúty, kým nezavonia.", 1, "ABCDEFGHIJKLMNOPQ", {
      heat: "mierny oheň", warn: "Paprika na horúcom tuku za pár sekúnd zhorkne – hneď ako zavonia, pokračuj ďalším krokom." }],
    ["Zalej mäso polovicou vývaru ({vyvar}), pridaj bobkové listy ({bobkovy_list}), priveď do varu, prikry pokrievkou a dus 30 minút.", 30, "ABCDEFHIJKLNOPQ", {
      heat: "mierny oheň", wait: true, done: "Mäso je polomäkké – vidlička prejde, ale ešte s odporom." }],
    ["Kapustu ({kapusta}) ochutnaj a nakrájaj na kratšie kúsky. Pridaj ju k mäsu aj s trochou jej šťavy a so zvyšným vývarom, premiešaj, prikry a dus ďalších 40 minút. Občas premiešaj, a ak sa guláš prichytáva, podlej trochou vody.", 40, "ABCDEFGHIJKLMNOPQ", {
      heat: "mierny oheň", wait: true, done: "Kúsok mäsa sa ľahko roztlačí vidličkou a kapusta je mäkká.",
      tip: "Ak je kapusta veľmi kyslá, pred pridaním ju v sitku prepláchni studenou vodou a vytlač – guláš bude jemnejší." }],
    ["Vmiešaj smotanu ({smotana_sladka}) a na miernom ohni povar ešte 5 minút, aby sa chute spojili. Ochutnaj a dochuť soľou a korením ({korenie}).", 5, "ABCDEFGHIJKLMNOPQ", {
      heat: "mierny oheň", done: "Omáčka je krémová a jemne obalí lyžicu." }],
    ["Vyber bobkové listy a guláš podávaj s nakrájanou knedľou ({knedla}).", 0, "ABCHJKLMNOP", {
      tip: "Kto má rád, dá si navrch lyžicu kyslej smotany." }],
  ]),
};

/* ===================================================================== kurací paprikáš s haluškami */
const paprikas: Recipe = {
  id: "paprikas",
  name: "Kurací paprikáš s haluškami",
  category: "hlavne",
  meat: "kuracie",
  minutes: 80,
  difficulty: 2,
  portions: 4,
  hue: 20,
  icon: "Drumstick",
  tags: ["klasika"],
  source: "",
  book: book(
    {
      photos: 3, // staršie fotky; nové (4) čakajú na kredit na obrázky
      active: 35,
      cuisine: "Slovensko · Maďarsko · Česko",
      tools: ["široký hrniec s pokrievkou", "veľký hrniec na halušky (aspoň 4 l)", "sitko na halušky", "dierovaná lyžica", "miska a metlička"],
      store: "Paprikáš v chladničke 2 dni, halušky zvlášť. Halušky prehrej na troche masla alebo v horúcej vode.",
    },
    [
      ["A", AP, "Klasické kuře na paprice", "https://www.apetitonline.cz/recept/klasicke-kure-na-paprice", 4],
      ["B", AP, "Kuře na paprice", "https://www.apetitonline.cz/recept/kure-na-paprice", 4],
      ["C", AP, "Kuře na paprice s noky", "https://www.apetitonline.cz/recept/kure-na-paprice-s-noky", 4],
      ["D", GK, "Paprikahendl", "https://www.gutekueche.at/paprikahendl-rezept-4909", 4],
      ["E", GK, "Ungarisches Paprikahuhn", "https://www.gutekueche.at/ungarisches-paprikahuhn-rezept-23122", 3],
      ["F", GK, "Paprikahuhn mit Spätzle", "https://www.gutekueche.at/paprikahuhn-mit-spaetzle-rezept-23123", 2],
      ["G", LB, "Kuře na paprice", "https://www.labuznik.cz/recept/kure-na-paprice/", 4],
      ["H", LB, "Paprikás cirke – kuřecí paprikáš", "https://www.labuznik.cz/recept/paprikas-cirke-kureci-paprikas/", 4],
      ["I", NS, "Csirkepaprikás", "https://www.nosalty.hu/recept/csirkepaprikas", 3],
      ["J", TR, "Kuřecí paprikáš", "https://www.toprecepty.cz/recept/1474-kureci-paprikas/", 6],
      ["K", TR, "Kuře na paprice", "https://www.toprecepty.cz/recept/1432-kure-na-paprice/", 2],
      ["L", TR, "Kuře na paprice", "https://www.toprecepty.cz/recept/2058-kure-na-paprice/", 6],
      ["M", TR, "Kuře na paprice se smetanou", "https://www.toprecepty.cz/recept/12648-kure-na-paprice-se-smetanou/", 4],
      ["N", VA, "Klasické kuře na paprice", "https://www.vareni.cz/recepty/klasicke-kure-na-paprice/", 4],
      ["O", TR, "Halušky", "https://www.toprecepty.cz/recept/1363-halusky/", 4],
      ["P", AP, "Halušky", "https://www.apetitonline.cz/recept/halusky", 6],
      ["Q", NS, "Nokedli egyszerűen", "https://www.nosalty.hu/recept/nokedli-tokeletes", 6],
      ["R", NS, "Nokedli", "https://www.nosalty.hu/recept/nokedli", 4],
      ["S", GK, "Nockerl", "https://www.gutekueche.at/nockerl-rezept-6018", 2],
      ["T", GK, "Eiernockerln", "https://www.gutekueche.at/eiernockerl-rezept-4453", 2],
      ["U", GK, "Spätzleteig", "https://www.gutekueche.at/spaetzleteig-rezept-3858", 4],
      ["V", GK, "Spätzle", "https://www.gutekueche.at/spaetzle-rezept-1178", 4],
      ["W", GK, "Spätzleteig", "https://www.gutekueche.at/spaetzleteig-rezept-23602", 4],
      ["X", GK, "Spätzle", "https://www.gutekueche.at/spaetzle-rezept-24350", 2],
    ],
    {
      anchor: "N",
      groups: { "Halušky": { src: "OPQRSTUVWX", anchor: "Q" } },
      rows: [
        row("kuracie_stehna+kurca", "g", "A1500 B1500 C1300 D700 E1300 F500 G1300 H750 I720 J1300 K650 L1300 M800 N1000", "Kuracie mäso s kosťou"),
        row("maslo+olej+mast", "g", "A50 B60 C100 D39 E39 F26 G102 H26 I J K26 L M28 N50", "Tuk (maslo, olej, masť)"),
        row("cibula", "g", "A150 B120 C240 D360 E120 G60 H120 I J120 K120 L240 M240 N120"),
        row("paprika_mleta", "g", "A14 B7 C D7 E14 F14 G H10.5 I J7 K10.5 L17.5 M25 N"),
        row("voda+vyvar", "g", "B1000 D420 E250 F250 H250 L M500 N", "Voda alebo vývar"),
        row("muka", "g", "A10 B20 C60 D30 E20 F20 H20 I10 J30 K10 L15 M25 N40"),
        row("smotana+smotana_sladka+kysla_smotana", "g", "A250 B200 C300 D30 E200 F100 G400 H350 I200 J250 K200 M200 N200", "Smotana (sladká, kyslá)"),
        row("sol", "g", "A B C D E F G H I J K L M N"),
        ...grp("Halušky", [
          row("muka", "g", "O150 P500 Q400 R400 S250 T300 U250 V500 W400 X250"),
          row("vajce", "ks", "O1 P2 Q2 R1 S2 T1 U3 V3 W4 X2"),
          row("voda+mlieko", "g", "O P300 Q300 R300 S200 T250 U125 V200 W200 X125", "Voda alebo mlieko"),
          row("sol", "g", "O P Q R S T U V W X"),
          row("olej+maslo", "g", "Q13 R T20 X25", "Tuk na premiešanie halušiek"),
        ]),
      ],
      acts: [
        act("Mäso osoliť", "ABCDEFGHJKLMN", 1),
        act("Na tuku speniť cibuľu", "ABCDEGHIJKLMN", 2),
        act("Pridať mletú papriku a krátko ju opražiť", "ABDEFHIJKMN", 3),
        act("Podliať vodou alebo vývarom", "ABCDEFGHIJKLMN", 3),
        act("Vložiť mäso a dusiť pod pokrievkou do mäkka", "ABCDEFGHIJKLMN", 4),
        act("Mäso pred dusením zľahka opiecť", "BCEFGHJ", "tip"),
        act("Mäkké mäso vybrať", "ABCGHIJKLMN", 9),
        act("Zahustiť múkou rozmiešanou v smotane a povariť", "BCDEFHIJKM", 10),
        act("Omáčku precediť alebo rozmixovať", "CGIN", "tip"),
        act("Mäso vrátiť do omáčky a prehriať", "ABCGHIJKLMN", 11),
        act("Mäso obrať z kostí a natrhať na kúsky", "AKLMN", "tip"),
        act("Podávať s haluškami (nokmi)", "CFJN", 11),
        ...grp("Halušky", [
          act("Zmiešať múku, vajcia, soľ a vodu na husté hladké cesto", "OPQRSTUVWX", 5),
          act("Priviesť do varu osolenú vodu", "OPQRTVWX", 6),
          act("Cesto pretláčať cez sitko na halušky do vriacej vody", "OPQRUVWX", 7),
          act("Variť po dávkach a premiešať, aby sa nezlepili", "QRVX", 7),
          act("Variť, kým halušky nevyplávajú", "OQRTUW", 7),
          act("Vyberať dierovanou lyžicou alebo sceďiť", "QRTUWX", 8),
          act("Premiešať s olejom alebo maslom", "QTX", 8),
          act("Bez sitka odrezávať cesto nožom z mokrej dosky", "PQR", "tip"),
          act("Ak sa nepodávajú hneď, prepláchnuť studenou vodou", "STUW", "tip"),
        ]),
      ],
      changes: [
        "Omáčku zahusťujeme múkou rozmiešanou v smotane, ako 10 zo 14 zdrojov. Kotva robí najprv svetlú zápražku z múky a masla a smotanu pridáva až potom.",
        "Múka do omáčky 3 lyžice namiesto 40 g: 40 g je nad bežným rozpätím zdrojov.",
        "Mletá paprika 2 lyžice a voda 400 ml: kotva množstvo neuvádza, sú to bežné množstvá zdrojov.",
        "Kuracie stehná 4 ks (asi 1 kg): kotva píše „4 porcie kurčaťa“.",
        "Halušky sú podľa receptu „Nokedli egyszerűen“ (nosalty.hu) – 400 g múky, 2 vajcia, 300 ml vody a lyžica oleja na premiešanie. Porovnané s 10 receptami na halušky, nokedli a Spätzle.",
      ],
    },
  ),
  ingredients: [
    ...ings("Paprikáš", [
      ["kuracie_stehna", 4, "ks", { note: "celé stehná so záklnom, asi 1 kg" }],
      ["sol", 1, "lyzicka"],
      ["cibula", 1, "ks"],
      ["maslo", 50, "g"],
      ["paprika_mleta", 2, "lyzica", { note: "sladká" }],
      ["voda", 400, "ml", { note: "alebo vývar" }],
      ["muka", 3, "lyzica", { note: "hladká" }],
      ["smotana", 200, "ml", { note: "12 %" }],
    ]),
    ...ings("Halušky", [
      ["muka", 400, "g", { ref: "muka_h", note: "hladká" }],
      ["vajce", 2, "ks"],
      ["sol", 1, "lyzicka", { ref: "sol_h" }],
      ["voda", 300, "ml", { ref: "voda_h" }],
      ["sol", 1, "lyzica", { ref: "sol_v", note: "do vody" }],
      ["olej", 1, "lyzica"],
    ]),
  ],
  steps: steps([
    ["Kuracie stehná ({kuracie_stehna}) osuš papierovou utierkou a zo všetkých strán osoľ ({sol}). Cibuľu ({cibula}) olúp a nakrájaj na drobné kocky.", 0, "ABCDEFGHJKLMN"],
    ["V širokom hrnci rozpusti maslo ({maslo}) a cibuľu na ňom za občasného miešania opekaj asi 8 minút, kým nie je mäkká a zlatistá.", 8, "ABCDEGHIJKLMN", {
      heat: "stredný oheň", done: "Cibuľa je mäkká a zlatistá, nie hnedá." }],
    ["Stíš oheň a za stáleho miešania vsyp mletú papriku ({paprika_mleta}). Opekaj ju len asi pol minúty, kým nezavonia, a hneď podlej asi tretinou vody ({voda}).", 1, "ABDEFHIJKMN", {
      heat: "mierny oheň", warn: "Paprika sa na horúcom tuku za pár sekúnd pripáli a omáčka zhorkne. Pre istotu môžeš hrniec na ten čas stiahnuť z ohňa." }],
    ["Vlož mäso, priveď do varu, prikry pokrievkou a na miernom ohni dus asi 45 minút. V polovici mäso obráť, a keď sa šťava vyvarí, podlej zvyšnou vodou, aby sa nič neprichytávalo.", 45, "ABCDEFGHIJKLMN", {
      heat: "mierny oheň", wait: true, done: "Mäso sa ľahko oddeľuje od kosti a šťava pri kosti nie je ružová.",
      tip: "Kto chce výraznejšiu chuť, stehná pred dusením na tuku zľahka opečie zo všetkých strán a až potom opekaj cibuľu." }],
    ["Kým sa mäso dusí, priprav cesto na halušky: múku ({muka_h}) daj do misy, v strede sprav jamku, rozbi do nej vajcia ({vajce}) a vidličkou ich rozšľahaj. Pridaj soľ ({sol_h}), prilej vodu ({voda_h}) a varechou vymiešaj hladké cesto.", 0, "OPQRSTUVWX", {
      done: "Cesto je husté a lesklé a pomaly, súvisle steká z lyžice.", tip: "Ak je cesto príliš tuhé, prilej lyžicu vody, ak je riedke, primiešaj lyžicu múky." }],
    ["Vo veľkom hrnci priveď do varu asi 3 litre vody s lyžicou soli ({sol_v}).", 0, "OPQRTVWX", {
      heat: "silný oheň" }],
    ["Polož sitko na halušky na hrniec a cesto cez neho pretláčaj priamo do vriacej vody – po dávkach, nie všetko naraz. Halušky hneď jemne premiešaj, aby sa nezlepili, a var ich 2–3 minúty, kým nevyplávajú na hladinu.", 3, "OPQRUVWX", {
      heat: "silný oheň", wait: true, done: "Halušky plávajú na hladine.",
      warn: "Nevkladaj všetko cesto naraz, halušky by sa zlepili. Rob ich na 2–3 dávky.",
      tip: "Ak nemáš sitko na halušky, daj cesto na mokrú dosku a mokrým nožom ho odrezávaj po malých kúskoch do vody." }],
    ["Uvarené halušky vyberaj dierovanou lyžicou do misy, pokvapkaj ich olejom ({olej}) a premiešaj, aby sa nelepili. Rovnako uvar zvyšné cesto.", 0, "QRTUWX", {
      tip: "Ak halušky nebudeš podávať hneď, prepláchni ich studenou vodou – nezlepia sa." }],
    ["Mäkké mäso vyber z hrnca na tanier a prikry ho, aby nevychladlo.", 0, "ABCGHIJKLMN"],
    ["V miske rozmiešaj múku ({muka}) so smotanou ({smotana}) dohladka. Primiešaj do nej naberačku horúcej šťavy z hrnca a až potom ju za stáleho miešania vlej do hrnca. Povar na miernom ohni asi 10 minút, občas premiešaj.", 10, "BCDEFHIJKM", {
      heat: "mierny oheň", wait: true, done: "Omáčka zhustla a jemne obalí lyžicu.",
      warn: "Studenú smotanu s múkou nevlievaj rovno do vriacej omáčky – zrazila by sa a vznikli by hrudky.",
      tip: "Ak chceš úplne hladkú omáčku, preceď ju cez sitko alebo rozmixuj ponorným mixérom." }],
    ["Mäso vráť do omáčky a nechaj ho asi 5 minút prehriať, už ho nevar. Ochutnaj, dochuť soľou a podávaj s haluškami.", 5, "ABCGHIJKLMN", {
      heat: "mierny oheň", tip: "Mäso môžeš pred vrátením obrať z kostí a natrhať na menšie kúsky – lepšie sa je." }],
  ]),
};

/* ===================================================================== kulajda */
const kulajda: Recipe = {
  id: "kulajda",
  name: "Kulajda s vajcom",
  category: "polievky",
  meat: "bez",
  minutes: 45,
  difficulty: 1,
  portions: 4,
  hue: 80,
  icon: "Soup",
  tags: ["klasika"],
  source: "",
  book: book(
    {
      photos: 3, // staršie fotky; nové (4) čakajú na kredit na obrázky
      active: 20,
      cuisine: "Česko",
      tools: ["hrniec (aspoň 3 l)", "malý hrniec na vajcia", "miska a metlička"],
      store: "Polievka bez vajec v chladničke 2 dni. Vajcia uvar vždy čerstvé, keď polievku ohrievaš.",
    },
    [
      ["A", AP, "Kulajda", "https://www.apetitonline.cz/recept/kulajda", 4],
      ["B", AP, "Jihočeská kulajda", "https://www.apetitonline.cz/recept/jihoceska-kulajda"],
      ["C", AP, "Kulajda s vejcem", "https://www.apetitonline.cz/recept/kulajda-s-vejcem", 4],
      ["D", AP, "Kulajda podle Jana Punčocháře", "https://www.apetitonline.cz/recept/kulajda-podle-jana-puncochare", 4],
      ["E", AP, "Kátina kulajda", "https://www.apetitonline.cz/recept/katina-kulajda", 4],
      ["F", LB, "Jihočeská kulajda", "https://www.labuznik.cz/recept/jihoceska-kulajda/"],
      ["G", LB, "Kulajda", "https://www.labuznik.cz/recept/kulajda/", 4],
      ["H", LB, "Kulajda od Elenky", "https://www.labuznik.cz/recept/kulajda-od-elenky/"],
      ["I", LB, "Kulajda z Českomoravské vysočiny", "https://www.labuznik.cz/recept/kulajda-z-ceskomoravske-vysociny/", 4],
      ["J", TR, "Pravá jihočeská kulajda", "https://www.toprecepty.cz/recept/1048-prava-jihoceska-kulajda/", 4],
      ["K", TR, "Jihočeská kulajda", "https://www.toprecepty.cz/recept/13711-jihoceska-kulajda/", 6],
      ["L", TR, "Kulajda", "https://www.toprecepty.cz/recept/389-kulajda/"],
      ["M", TR, "Kulajda", "https://www.toprecepty.cz/recept/31243-kulajda/", 4],
      ["N", TR, "Babiččina kulajda", "https://www.toprecepty.cz/recept/50081-babiccina-kulajda/", 2],
      ["O", TR, "Kulajda mé maminky", "https://www.toprecepty.cz/recept/22527-kulajda-me-maminky/", 4],
      ["P", VA, "Jihočeská kulajda", "https://www.vareni.cz/recepty/jihoceska-kulajda/"],
      ["Q", VA, "Kulajda", "https://www.vareni.cz/recepty/kulajda/", 4],
      ["R", VA, "Jihočeská kulajda s vejcem", "https://www.vareni.cz/recepty/jihoceska-kulajda-s-vejcem/", 4],
      ["S", VA, "Kulajda od babičky", "https://www.vareni.cz/recepty/kulajda-od-babicky/", 4],
      ["T", VA, "Dobrá jihočeská kulajda", "https://www.vareni.cz/recepty/dobra-jihoceska-kulajda/", 4],
    ],
    {
      anchor: "C",
      rows: [
        row("voda+vyvar", "g", "A1000 C1250 D500 E1500 F1000 G H1000 J1000 K1000 L1000 M1500 N500 O P1250 Q1000 S1000 T", "Voda alebo vývar"),
        row("sampinony", "g", "B C400 D250 F G I J300 K250 M160 N70 O P250", "Čerstvé huby"),
        row("cibula", "g", "C120 E80 F150 G J120 K150 O120 Q150 T240"),
        row("bobkovy_list", "ks", "B C2 E1 G K3 M4 N1 O R4 T2"),
        row("nove_korenie", "ks", "B C5 E5 G K4 M6 N2.5 O R5 T5"),
        row("korenie_cele+korenie", "ks", "B C5 D E5 G M6 N O P R5 T10", "Čierne korenie"),
        row("rasca", "g", "A1 C0.5 G H J L O P"),
        row("muka", "g", "A20 B C20 D10 E20 F30 G20 H40 I10 J30 K45 L40 M N15 O P Q20 R10 S30 T20"),
        row("kysla_smotana+smotana_sladka+smotana", "g", "A200 B C250 D200 E200 F250 G200 H500 I250 J250 K200 L200 M400 N120 O250 P100 Q200 R200 S250 T200", "Smotana (kyslá, sladká)"),
        row("zemiaky", "g", "A500 B C500 D300 E500 F625 G H300 I450 J600 K500 L500 M600 N150 O625 P250 Q250 R400 S750 T250"),
        row("vajce", "ks", "A1 C4 D2 E2 F4 G4 H4 I2 J4 K1 M6 N2 O2 R6 S2 T2"),
        row("ocot+citron", "g", "A B C15 D30 E15 F5 H7.5 K30 N15 O P Q R5 T15", "Ocot (alebo citrónová šťava)"),
        row("kopor", "ks", "A B C1 D E F G H I J K1 L M N O1 Q S"),
        row("maslo+mast+olej", "g", "B C14 D28 E28 H40 N28 O P Q50 T13", "Tuk (maslo, masť)"),
        row("sol", "g", "A B C D E F G H I J K L M N O P Q R S T"),
      ],
      acts: [
        act("Huby variť vo vode alebo vo vývare", "ACFGIJKMNO", 2),
        act("Pridať celé korenie a bobkový list", "BCEGKMNORT", 2),
        act("Pridať rascu", "ACGHJLOP", 2),
        act("Zahustiť polievku múkou", "ABCDEFGHIJKLMNOPQRST", 3),
        act("Múku rozmiešať v smotane a vliať do polievky", "ACGIJLOT", 3),
        act("Zjemniť smotanou", "ABCDEFGHIJKLMNOPQRST", 3),
        act("Pridať zemiaky a variť do mäkka", "ABCDEFGHIJKLMNOPQRST", 4),
        act("Uvariť vajcia zvlášť a dať ich do taniera", "CDHJMNQR", 5),
        act("Vajce rozšľahať alebo rozbiť priamo do vriacej polievky", "AEFGIKOST", "tip"),
        act("Dochutiť octom", "ACDEHKNOPQRT", 6),
        act("Pridať kôpor", "ABCDEFGHIJKLMNOQS", 6),
        act("Kôpor už nevariť", "FKLQ", "tip"),
        act("Zjemniť maslom", "CN", 7),
        act("Namiesto čerstvých použiť sušené huby namočené vo vode", "ABCEFIL", "tip"),
      ],
      changes: [
        "Čerstvé huby 300 g namiesto 400 g: 400 g je nad bežným rozpätím zdrojov.",
        "Ligurček z kotvy vynechaný: má ho len 1 z 20 zdrojov.",
      ],
    },
  ),
  ingredients: [
    ...ings("Polievka", [
      ["sampinony", 300, "g", { label: "Čerstvé huby", note: "lesné alebo šampiňóny" }],
      ["cibula", 1, "ks"],
      ["zemiaky", 4, "ks", { note: "stredné" }],
      ["voda", 1250, "ml"],
      ["bobkovy_list", 2, "ks"],
      ["nove_korenie", 5, "ks", { note: "guľky" }],
      ["korenie_cele", 5, "ks", { note: "guľky" }],
      ["rasca", 0.25, "lyzicka", { note: "drvená" }],
      ["muka", 2, "lyzica", { note: "hladká" }],
      ["kysla_smotana", 250, "g"],
      ["ocot", 1, "lyzica", { note: "podľa chuti" }],
      ["sol", 1, "lyzicka"],
      ["korenie", 1, "stipka", { note: "mleté" }],
      ["kopor", 1, "ks", { note: "1 zväzok" }],
      ["maslo", 1, "lyzica"],
    ]),
    ...ings("Na podávanie", [["vajce", 4, "ks"]]),
  ],
  steps: steps([
    ["Huby ({sampinony}) očisti – ak treba, krátko ich opláchni pod studenou vodou alebo otri vlhkou utierkou – a nakrájaj na hrubšie plátky. Cibuľu ({cibula}) olúp a rozpoľ. Zemiaky ({zemiaky}) ošúp a nakrájaj na kocky asi 1,5 cm.", 0, "ABCDEFGHIJKLMNOPQRST"],
    ["V hrnci priveď do varu vodu ({voda}). Pridaj huby, cibuľu, bobkové listy ({bobkovy_list}), nové korenie ({nove_korenie}), guľky korenia ({korenie_cele}) a rascu ({rasca}) a znova priveď do varu.", 5, "ACFGIJKMNO", {
      heat: "silný oheň", tip: "Namiesto čerstvých húb môžeš použiť 2 hrste sušených: namoč ich aspoň na hodinu do vlažnej vody a pridaj ich aj s vodou." }],
    ["V miske rozmiešaj múku ({muka}) s kyslou smotanou ({kysla_smotana}) dohladka – ak je hustá, zrieď ju 2–3 lyžicami studenej vody. Za stáleho miešania ju vlej do polievky a metličkou dobre rozšľahaj.", 0, "ACGIJLOT", {
      warn: "Vlievaj pomaly a stále miešaj, inak vzniknú hrudky." }],
    ["Polievku znova priveď do varu, pridaj zemiaky a var na miernom ohni 10–15 minút, kým nie sú mäkké. Občas premiešaj, aby sa nič neprichytilo ku dnu.", 15, "ABCDEFGHIJKLMNOPQRST", {
      heat: "mierny oheň", wait: true, done: "Zemiaky sú mäkké, ale nerozpadajú sa." }],
    ["Kým sa zemiaky varia, priveď v malom hrnci do varu vodu, lyžicou do nej opatrne vlož vajcia ({vajce}) a var ich 6–7 minút. Potom ich zchlaď v studenej vode a olúp.", 7, "CDHJMNQR", {
      heat: "stredný oheň", wait: true, done: "Bielok je pevný, žĺtok v strede ešte mäkký.",
      warn: "Mäkký žĺtok nie je vhodný pre tehotné, malé deti, seniorov a ľudí s oslabenou imunitou. Pre nich var vajcia 10 minút natvrdo." }],
    ["Keď sú zemiaky mäkké, dochuť polievku octom ({ocot}), soľou ({sol}) a mletým korením ({korenie}) a vmiešaj polovicu nasekaného kôpru ({kopor}). Kulajda má byť jemne kyslá.", 0, "ACDEHKNOPQRT", {
      warn: "Kôpor už nevar, stratil by vôňu.", tip: "Ak chceš, vylov pred podávaním polovice cibule a bobkové listy." }],
    ["Stiahni hrniec z ohňa a vmiešaj maslo ({maslo}).", 0, "CN"],
    ["Vajcia opatrne rozpoľ. Polievku rozdeľ do tanierov, do každého daj polovičky vajca, zľahka ich osoľ, okoreň a posyp zvyšným kôprom.", 0, "CDHJMNQR", {
      tip: "Vajce môžeš aj rozšľahať a za stáleho miešania vliať priamo do vriacej polievky – zrazí sa na jemné vločky." }],
  ]),
};

/* ===================================================================== medovník */
const medovnik: Recipe = {
  id: "medovnik",
  name: "Medovník s karamelovým krémom",
  category: "sladke",
  meat: "bez",
  minutes: 210,
  difficulty: 3,
  portions: 16,
  hue: 35,
  icon: "CakeSlice",
  tags: ["sviatočné"],
  source: "",
  book: book(
    {
      photos: 3, // staršie fotky; nové (4) čakajú na kredit na obrázky
      active: 90,
      wait: "aspoň 1 deň odležať",
      cuisine: "Česko · Slovensko",
      tools: ["hrniec a žiaruvzdorná misa na vodný kúpeľ", "ručný mixér so špirálovými hákmi a metlami", "papier na pečenie a gumová stierka", "tanier alebo tortová forma s priemerom 22–24 cm"],
      store: "V chladničke prikrytý 5 dní. Dá sa zamraziť po kúskoch.",
    },
    [
      ["A", AP, "Medovník", "https://www.apetitonline.cz/recept/medovnik"],
      ["B", AP, "Domácí medový dort", "https://www.apetitonline.cz/recept/domaci-medovy-dort"],
      ["C", LB, "MARLENKA – arménska medová torta", "https://www.labuznik.cz/recept/marlenka-armenska-medova-torta/"],
      ["D", TR, "Můj medovník", "https://www.toprecepty.cz/recept/12041-muj-medovnik/"],
      ["E", TR, "Medovník originál", "https://www.toprecepty.cz/recept/22668-medovnik-original/"],
      ["F", TR, "Medový dort s krémem a oříšky", "https://www.toprecepty.cz/recept/22101-medovnik-marlenka/"],
      ["G", TR, "Jednoduchý medovník", "https://www.toprecepty.cz/recept/13666-jednoduchy-medovnik/"],
      ["H", VA, "Domácí medovník", "https://www.vareni.cz/recepty/domaci-medovnik/"],
      ["I", VA, "Krémový medovník", "https://www.vareni.cz/recepty/kremovy-medovnik/"],
      ["J", VA, "Vynikající medovník", "https://www.vareni.cz/recepty/vynikajici-medovnik/"],
      ["K", TR, "Zamilovaný medovník", "https://www.toprecepty.cz/recept/5687-zamilovany-medovnik/"],
      ["L", TR, "Medovník IV.", "https://www.toprecepty.cz/recept/7528-medovnik-iv/"],
      ["M", AP, "Medovník s odlehčeným krémem", "https://www.apetitonline.cz/recept/medovnik-s-odlehcenym-kremem"],
    ],
    {
      anchor: "A",
      whole: true,
      rows: [
        row("tuk+maslo", "g", "A250 B180 C130 D250 E250 F250 G110 H250 I150 J30 K180 L150 M125", "Tuk do cesta (Hera, maslo)"),
        row("vajce", "ks", "A3 B1 C2 D3 E3 F3 G6 H3 I2 J1 K1 L2 M3"),
        row("med", "g", "A60 B140 C60 D60 E60 F110 G150 H80 I60 J40 K60 L60 M150"),
        row("cukor", "g", "A300 B180 C250 D300 E300 F50 G150 H300 I200 J100 K180 L200 M125"),
        row("muka", "g", "A400 B500 C700 D400 E400 F450 G370 H400 I350 J250 K450 L350 M500"),
        row("soda", "g", "A4.6 B6.9 C13.8 D4.6 E4.6 F4.6 H4.6 J13.8 K6.9 L4.6 M4.6"),
        row("orechy", "g", "A30 B100 C F120 G300 H60 J170 K120", "Vlašské orechy (posyp, krém)"),
        ...grp("Krém", [
          row("kondenz", "ks", "A1 B1 C1.2 D1 E1 F1 G1 H1 I1 J1 K1 L1 M0.63", "Karamelové kondenzované mlieko (plechovka 397 g)"),
          row("maslo", "g", "A300 B200 C375 D187.5 E300 F300 G250 H320 I375 J250 K200 L375"),
        ]),
      ],
      acts: [
        act("Karamelizovať kondenzované mlieko varením neotvorenej plechovky", "FGHIJKL", 1),
        act("Nad parou alebo na miernom ohni rozpustiť tuk (s medom a cukrom)", "ABCDEFHIJKLM", 2),
        act("Pridať vajcia, med, cukor, múku a sódu a vymiešať hladké cesto", "ABCDEFHIJKLM", 3),
        act("Miešať nad parou, kým cesto nezozlatne", "ADEFH", 3),
        act("Cesto rozdeliť na rovnaké diely", "ABEFHJK", 4),
        act("Rozotrieť alebo rozvaľkať tenké pláty podľa formy", "ABCDEFHIJKLM", 5),
        act("Pláty piecť krátko dozlatista", "ABCDEFHIJKLM", 6),
        act("Pláty orezať podľa formy", "AEFHIJKL", 7),
        act("Odrezky rozdrobiť na posyp", "ABDFHIKL", 7),
        act("Vyšľahať maslo s karamelom na krém", "ABCDEFGHIJKL", 8),
        act("Pláty skladať a natierať krémom, natrieť aj vrch a boky", "ABCDEFGHIJKLM", 9),
        act("Obsypať drobkami (s orechmi)", "ABDFHIKL", 10),
        act("Nechať odležať aspoň do druhého dňa", "ADHL", 11),
      ],
      changes: [
        "Vlašské orechy 100 g (jedno balenie) namiesto hrsti (asi 30 g): hrsť je pod bežným rozpätím zdrojov.",
        "Kotva používa hotové karamelové kondenzované mlieko. Ako ho uvariť z obyčajného, je v prvom kroku – robí to 7 z 13 zdrojov.",
      ],
    },
  ),
  ingredients: [
    ...ings("Cesto (6 plátov)", [
      ["tuk", 250, "g", { note: "napr. Hera" }],
      ["vajce", 3, "ks"],
      ["med", 3, "lyzica", { note: "najlepšie tmavý" }],
      ["cukor", 300, "g", { note: "kryštálový" }],
      ["muka", 400, "g", { note: "hladká" }],
      ["soda", 1, "lyzicka"],
    ]),
    ...ings("Krém", [
      ["kondenz", 1, "ks", { note: "karamelové, plechovka 397 g" }],
      ["maslo", 300, "g", { note: "mäkké" }],
    ]),
    ...ings("Na posypanie", [["orechy", 100, "g", { note: "nasekané" }]]),
  ],
  steps: steps([
    ["Ak nemáš hotové karamelové kondenzované mlieko: neotvorenú plechovku obyčajného sladeného kondenzovaného mlieka ({kondenz}) vlož do hrnca, zalej vodou a var 2 hodiny. Nechaj ju vychladnúť vo vode – najlepšie deň vopred.", 120, "FGHIJKL", {
      heat: "mierny var", wait: true, warn: "Plechovka musí byť celý čas pod vodou – vodu dolievaj. Otvor ju až úplne vychladnutú, inak môže horúci karamel vystreknúť." }],
    ["Maslo na krém ({maslo}) vyber z chladničky, aby zmäklo. Priprav vodný kúpeľ: do hrnca nalej trochu vody a polož naň žiaruvzdornú misu tak, aby sa jej dno nedotýkalo hladiny. Vodu priveď k miernemu varu a v mise rozpusti tuk ({tuk}).", 5, "ABCDEFHIJKLM", {
      heat: "voda mierne vrie", warn: "Voda sa nesmie dotýkať misy – vajcia by sa v ďalšom kroku zrazili." }],
    ["Pridaj vajcia ({vajce}), med ({med}), cukor ({cukor}), múku ({muka}) a sódu bikarbónu ({soda}). Zmes nad parou miešaj asi 10 minút, kým nevznikne hladké cesto zlatistej farby. Najľahšie to ide ručným mixérom so špirálovými hákmi – na šľahacie metly sa cesto lepí.", 10, "ABCDEFHIJKLM", {
      heat: "voda mierne vrie", done: "Cesto je hladké, lesklé a zlatisté ako med." }],
    ["Misu stiahni z pary a cesto rozdeľ na 6 rovnakých dielov. Rúru predhrej na 170 °C (teplovzdušnú na 150 °C).", 0, "ABEFHJK"],
    ["Na papier na pečenie obkresli tanier alebo tortovú formu s priemerom 22–24 cm a papier otoč kresbou dole. Do kruhu gumovou stierkou alebo prstami rozotri jeden diel cesta na čo najtenšiu vrstvu – asi centimeter za čiaru.", 0, "ABCDEFHIJKLM", {
      tip: "Kým je cesto teplé, rozotiera sa ľahko. Diely, ktoré čakajú, nechaj v mise prikryté." }],
    ["Plát peč 7–10 minút dozlatista. Takto upeč všetkých 6 dielov – v teplovzdušnej rúre môžeš piecť viac plechov naraz.", 8, "ABCDEFHIJKLM", {
      heat: "170 °C, každý plát 7–10 minút", wait: true, done: "Plát je zlatý, nie hnedý.", warn: "Pár minút navyše a plát stvrdne a zhorkne." }],
    ["Ešte teplé pláty orež podľa taniera alebo formy – polož ho na plát a nožom odrež, čo presahuje. Odrezky rozdrob nadrobno a zmiešaj s nasekanými orechmi ({orechy}).", 0, "AEFHIJKL", {
      tip: "Teplé pláty sa režú ľahko, vychladnuté sa lámu." }],
    ["Krém: mäkké maslo a karamelové kondenzované mlieko šľahaj mixérom asi 10 minút do hladkého krému.", 10, "ABCDEFGHIJKL", {
      done: "Krém je hladký, lesklý a nadýchaný.", tip: "Krém sa nezrazí, keď maslo najprv vyšľaháš do peny a karamel pridávaš po častiach." }],
    ["Skladaj: na tanier polož prvý plát, rozotri naň vrstvu krému, prikry ďalším plátom a znova natri. Pokračuj, kým neminieš všetky pláty. Nakoniec natri krémom aj vrch a boky.", 0, "ABCDEFGHIJKLM"],
    ["Celý medovník obsyp drobkami s orechmi – vrch aj boky.", 0, "ABDFHIKL"],
    ["Nechaj odležať v chlade aspoň do druhého dňa, najlepšie 2–3 dni.", 0, "ADHL", {
      done: "Pláty od krému zmäknú, nôž prejde ľahko a kúsky sú vláčne." }],
  ]),
};

/* ===================================================================== lasagne bolognese */
const lasagne: Recipe = {
  id: "lasagne",
  name: "Lasagne bolognese",
  category: "cestoviny",
  meat: "hovadzie",
  minutes: 105,
  difficulty: 2,
  portions: 4,
  hue: 10,
  icon: "UtensilsCrossed",
  tags: ["víkend"],
  source: "",
  book: book(
    {
      photos: 3, // staršie fotky; nové (4) čakajú na kredit na obrázky
      active: 35,
      cuisine: "Taliansko",
      tools: ["veľká panvica alebo široký hrniec s pokrievkou", "menší hrniec a metlička na bešamel", "zapekacia misa asi 20 × 30 cm", "papier na pečenie", "strúhadlo"],
      store: "V chladničke 3 dni. Upečené aj neupečené sa dajú zamraziť.",
    },
    [
      ["A", AP, "Lasagne s hovězím masem a rajčaty", "https://www.apetitonline.cz/recept/lasagne-s-hovezim-masem-rajcaty", 3],
      ["B", LB, "Lasagne al forno", "https://www.labuznik.cz/recept/lasagne-al-forno/"],
      ["C", LB, "Italské Lasagne", "https://www.labuznik.cz/recept/italske-lasagne/", 4],
      ["D", TR, "Lasagne s boloňskou omáčkou", "https://www.toprecepty.cz/recept/14052-lasagne-s-bolonskou-omackou/", 4],
      ["E", TR, "Lasagne s mletým masem", "https://www.toprecepty.cz/recept/12132-lasagne-s-mletym-masem/", 6],
      ["F", TR, "Maminčiny domácí lasagne (masové)", "https://www.toprecepty.cz/recept/10446-maminciny-domaci-lasagne-masove/", 4],
      ["G", TR, "Výborné lasagne", "https://www.toprecepty.cz/recept/12958-vyborne-lasagne/", 4],
      ["H", VA, "Boloňské lasagně", "https://www.vareni.cz/recepty/bolonske-lasagne/", 4],
      ["I", VA, "Klasické lasagne", "https://www.vareni.cz/recepty/klasicke-lasagne/", 4],
      ["J", VA, "Italské lasagne", "https://www.vareni.cz/recepty/italske-lasagne/", 4],
      ["K", VA, "Chutné lasagne s mletým masem a bešamelem", "https://www.vareni.cz/recepty/chutne-lasagne-s-mletym-masem-a-besamelem/", 4],
      ["L", NS, "Bolognai lasagne", "https://www.nosalty.hu/recept/bolognai-lasagne", 4],
      ["M", NS, "Bolognai lasagne házitésztával", "https://www.nosalty.hu/recept/bolognai-lasagne-hazitesztaval", 6],
      ["N", NS, "Bolognai lasagne DoGGmától", "https://www.nosalty.hu/recept/bolognai-lasagne-doggmatol", 8],
    ],
    {
      anchor: "G",
      rows: [
        row("olej+olivovy_olej", "g", "A E F G H100 I52 J K L26 M20 N100", "Olej"),
        row("cibula", "g", "B120 C120 D150 F120 G150 H240 I120 K120 L50 M150 N240"),
        row("cesnak", "g", "A15 B5 C15 D12.5 F15 G10 H30 I5 K10 M10"),
        row("mlete", "g", "A200 B300 C500 D500 E500 F500 G400 H600 I200 J275 K400 L220 M500 N1000", "Mleté mäso"),
        row("oregano", "g", "A B C F G I J M"),
        row("paradajky_kraj+pasirovane+pretlak+paradajky", "g", "A500 B16 C450 D470 E160 F500 G400 H1000 I200 J320 K400 L100 M220 N32", "Paradajky (konzerva, pasírované, pretlak)"),
        row("maslo", "g", "A50 C62.5 E30 G50 H200 I75 J50 K42 L112 M100 N70"),
        row("muka", "g", "A40 C12 E30 G50 H150 I75 J50 K20 L75 M60 N70"),
        row("mlieko", "g", "A600 C750 E500 G500 H800 I750 J500 K300 L770 M1000 N700", "Mlieko (do bešamelu)"),
        row("muskat", "g", "B C E G H J L M"),
        row("lasagne", "g", "A250 B C250 D300 E500 F G H500 I200 J200 K250 L200 M N125"),
        row("eidam+parmezan", "g", "A B75 C450 D200 E250 F150 G H150 I J50 K200 L50 M300 N300", "Strúhaný syr (eidam, parmezán…)"),
        row("sol", "g", "A B C D E F G H I J K L M N"),
        row("korenie", "g", "B C D E G H I J L M N"),
      ],
      acts: [
        act("Na tuku opražiť cibuľu a cesnak", "CDFGHIKLMN", 2),
        act("Pridať mleté mäso, rozdrobiť ho a opiecť", "ABCDEFGHIJKLMN", 3),
        act("Ochutiť soľou, korením a bylinkami", "ABCDEFGHIJKLMN", 3),
        act("Pridať paradajky", "ABCDEFGHIJKLMN", 4),
        act("Ragù dusiť na miernom ohni 20–60 minút", "BDEFHIKLM", 4),
        act("Podliať vínom a odpariť ho", "BHLN", "tip"),
        act("Misu vymazať tukom alebo vyložiť papierom", "BCDEGILN", 5),
        act("Bešamel: zo zápražky z masla a múky a z mlieka uvariť hustú omáčku", "ACEGHIJKLMN", 6),
        act("Bešamel ochutiť muškátovým orechom", "BCEGHL", 6),
        act("Vrstviť platne, ragù a bešamel", "ABCDEFGHIJKLMN", 7),
        act("Navrch posypať syrom", "ABCDEFGHIJKLMN", 7),
        act("Piecť v rúre pri 175–200 °C", "BDEFGHJKLMN", 8),
        act("Prikryť alobalom, aby vrch nezhnedol priskoro", "HK", "tip"),
        act("Pred krájaním nechať odpočinúť", "L", "tip"),
      ],
      changes: [
        "Ragù dusíme 30 minút: kotva ho len krátko povarí, 9 zo 14 zdrojov ho dusí 20–60 minút.",
        "Kečup a grilovacie korenie z kotvy vynechané: kečup majú len 3 zo 14 zdrojov, grilovacie korenie žiadny ďalší. Bazalku majú len 2 – ostalo oregano (8 zo 14).",
        "Lasagne 250 g a syr 150 g: kotva píše „1 balenie“ a „tvrdý syr“ bez množstva – sú to bežné množstvá zdrojov.",
      ],
    },
  ),
  ingredients: [
    ...ings("Ragù", [
      ["cibula", 1, "ks", { note: "väčšia" }],
      ["cesnak", 2, "strucik"],
      ["olej", 2, "lyzica"],
      ["mlete", 400, "g", { label: "Mleté mäso", note: "hovädzie alebo zmiešané" }],
      ["sol", 1, "lyzicka"],
      ["korenie", 1, "stipka", { note: "mleté" }],
      ["oregano", 1, "lyzicka", { note: "sušené" }],
      ["paradajky_kraj", 400, "g", { label: "Lúpané alebo krájané paradajky", note: "1 konzerva" }],
    ]),
    ...ings("Bešamel", [
      ["maslo", 50, "g"],
      ["muka", 50, "g", { note: "hladká" }],
      ["mlieko", 500, "ml"],
      ["muskat", 1, "stipka", { label: "Muškátový orech", note: "strúhaný" }],
    ]),
    ...ings("Skladanie", [
      ["lasagne", 250, "g", { note: "bez predvárania" }],
      ["eidam", 150, "g", { note: "alebo iný tvrdý syr, parmezán" }],
    ]),
  ],
  steps: steps([
    ["Cibuľu ({cibula}) nakrájaj nadrobno, cesnak ({cesnak}) olúp a nakrájaj na tenké plátky.", 0, "CDFGHIKLMN"],
    ["Vo väčšej panvici rozohrej olej ({olej}) a cibuľu s cesnakom na ňom za občasného miešania opekaj asi 5 minút dozlatista.", 5, "CDFGHIKLMN", {
      heat: "stredný oheň", warn: "Cesnak sa pripaľuje ľahšie ako cibuľa – ak začne tmavnúť, stíš oheň." }],
    ["Pridaj mleté mäso ({mlete}) a za stáleho miešania ho vareškou rozdrob na drobné kúsky. Opekaj asi 8 minút, kým nie je celé sivohnedé. Osoľ ({sol}), okoreň ({korenie}) a pridaj oregano ({oregano}) – ragù má byť výrazne ochutené.", 8, "ABCDEFGHIJKLMN", {
      heat: "silnejší oheň" }],
    ["Pridaj paradajky ({paradajky_kraj}), priveď do varu, stíš oheň, prikry a dus 30 minút. Občas premiešaj, a ak sa ragù prichytáva, prilej trochu vody.", 30, "BDEFHIKLM", {
      heat: "mierny oheň", wait: true, done: "Ragù je husté a šťavnaté, paradajky sa rozpadli.",
      tip: "Kto má rád, podleje mäso pred paradajkami 100 ml červeného vína a nechá ho odpariť." }],
    ["Medzitým rúru predhrej na 180 °C a zapekaciu misu vylož papierom na pečenie. Syr ({eidam}) nastrúhaj nadrobno.", 0, "BCDEGILN"],
    ["Bešamel: v menšom hrnci rozpusti maslo ({maslo}), vmiešaj múku ({muka}) a za stáleho miešania ju minútu opekaj na svetlú zápražku. Postupne prilievaj mlieko ({mlieko}) a stále miešaj metličkou. Pridaj muškátový orech ({muskat}), štipku soli a korenia a za stáleho miešania var asi 5 minút.", 6, "ACEGHIJKLMN", {
      heat: "mierny oheň", done: "Bešamel je hladký a hustý ako puding.", warn: "Mlieko prilievaj po troškách a stále miešaj, inak vzniknú hrudky." }],
    ["Skladaj do misy: vrstva platní ({lasagne}), na ňu časť ragù a vrstva bešamelu. Opakuj, kým neminieš všetko – posledná vrstva má byť ragù a bešamel. Navrch rovnomerne posyp syr.", 0, "ABCDEFGHIJKLMN", {
      warn: "Platne musia byť celé pod omáčkou, inak ostanú tvrdé." }],
    ["Peč asi 45 minút, kým nie je vrch zlatohnedý.", 45, "BDEFGHJKLMN", {
      heat: "180 °C", wait: true, done: "Vrch je zlatohnedý, na okrajoch bublá a nôž prejde platňami ľahko.",
      tip: "Ak vrch hnedne priskoro, prikry misu alobalom. Pred krájaním nechaj lasagne 15 minút odpočinúť – kúsky sa nerozpadnú." }],
  ]),
};

/** Recepty overené metódou „kotva“ (v knihe idú pred staršími). */
export const BOOK_CHECKED: Recipe[] = [svieckova, kapustnica, plnenaPaprika, vtacik, musaka, chili, segedin, paprikas, kulajda, medovnik, lasagne].map(finish);
