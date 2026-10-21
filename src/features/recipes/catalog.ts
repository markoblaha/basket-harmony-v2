/*
 * Katalóg receptov (z prototypu). Postupy sú napísané vlastnými slovami.
 * V krokoch {kľúč} = množstvo danej suroviny prepočítané na zvolený počet porcií.
 * Obsah receptov je údaj (ako názov produktu), nie text rozhrania – preto nie je v i18n.
 */
import type { Ingredient, Recipe, RecipeCategory, Step, Unit } from "./types";

const i = (food: string, qty: number, unit: Unit = "g", note = ""): Ingredient => ({ food, qty, unit, note });
const s = (text: string, timerMin?: number): Step => ({ text, timerMin: timerMin ?? null });

/** Mriežka kategórií na úvode (názvy cez t("rc.cat.<id>")). „rychle“ a „deti“ sú filtre, nie kategória receptu. */
export const RECIPE_CATEGORIES: { id: RecipeCategory | "rychle" | "deti"; icon: string; hue: number }[] = [
  { id: "hlavne", icon: "CookingPot", hue: 25 },
  { id: "cestoviny", icon: "UtensilsCrossed", hue: 45 },
  { id: "polievky", icon: "Soup", hue: 95 },
  { id: "sladke", icon: "CakeSlice", hue: 340 },
  { id: "ranajky", icon: "Egg", hue: 50 },
  { id: "salaty", icon: "Salad", hue: 130 },
  { id: "rychle", icon: "Timer", hue: 200 },
  { id: "deti", icon: "Baby", hue: 275 },
];
export const MEATS = ["kuracie", "bravcove", "hovadzie", "ryby", "bez"] as const;

export const CATALOG: Recipe[] = [
  {
    id: "segedin", name: "Segedínsky guláš", category: "hlavne", meat: "bravcove", minutes: 90, difficulty: 2 as const, portions: 4, hue: 25, icon: "CookingPot",
    tags: ["klasika"], source: "",
    ingredients: [
      i("pliecko", 600), i("kapusta", 500), i("cibula", 2, "ks"), i("olej", 3, "lyzica"), i("paprika_mleta", 1, "lyzica"),
      i("rasca", 1, "lyzicka"), i("cesnak", 2, "strucik"), i("kysla_smotana", 200), i("muka", 2, "lyzica"), i("sol", 1, "lyzicka"), i("korenie", 1, "stipka"),
      i("knedla", 1, "ks", "príloha"),
    ],
    steps: [
      s("Cibuľu ({cibula}) nakrájaj nadrobno a speň na {olej} oleja do zlatista.", 6),
      s("Pridaj mäso ({pliecko}) nakrájané na kocky, opeč zo všetkých strán, posyp paprikou ({paprika_mleta}) a hneď podlej vodou."),
      s("Pridaj rascu ({rasca}), soľ, korenie a prelisovaný cesnak ({cesnak}). Duste pod pokrievkou.", 45),
      s("Kapustu ({kapusta}) prepláchni, ak je veľmi kyslá, a pridaj k mäsu. Duste do mäkka.", 25),
      s("Smotanu ({kysla_smotana}) rozmiešaj s múkou ({muka}), vmiešaj do guláša a krátko povar. Podávaj s knedľou."),
    ],
    qa: [
      { q: "Ako znížiť kyslosť kapusty?", a: "Kapustu pred pridaním prepláchni studenou vodou a nechaj odkvapkať. Pomôže aj lyžička cukru na konci." },
      { q: "Dá sa uvariť deň vopred?", a: "Áno, guláš je na druhý deň ešte lepší. Smotanu vmiešaj až pri ohrievaní." },
    ],
  },
  {
    id: "palacinky", name: "Palacinky s džemom", category: "sladke", meat: "bez", minutes: 30, difficulty: 1 as const, portions: 4, hue: 340, icon: "CakeSlice",
    tags: ["deti", "rychle", "klasika"], source: "",
    ingredients: [i("muka", 200), i("mlieko", 500, "ml"), i("vajce", 2, "ks"), i("cukor", 1, "lyzica"), i("sol", 1, "stipka"), i("olej", 2, "lyzica"), i("dzem", 200)],
    steps: [
      s("Vyšľahaj vajcia ({vajce}) s mliekom ({mlieko}), cukrom a štipkou soli."),
      s("Postupne vmiešaj múku ({muka}) na hladké riedke cesto bez hrudiek a nechaj ho odpočinúť.", 10),
      s("Na tenko vymastenej panvici ({olej} oleja spolu) peč tenké palacinky z oboch strán do zlatista."),
      s("Natri džemom ({dzem}) a zroluj."),
    ],
    qa: [
      { q: "Prečo sa palacinky trhajú?", a: "Cesto je príliš husté alebo panvica málo rozpálená. Prilej trochu mlieka a pred prvou palacinkou panvicu dobre nahrej." },
      { q: "Dá sa bez vajec?", a: "Áno, vajcia nahraď 4 lyžicami jemných ovsených vločiek namočených v mlieku. Budú krehkejšie." },
    ],
  },
  {
    id: "carbonara", name: "Špagety carbonara", category: "cestoviny", meat: "bravcove", minutes: 25, difficulty: 2 as const, portions: 4, hue: 45, icon: "UtensilsCrossed",
    tags: ["rychle"], source: "",
    ingredients: [i("spagety", 400), i("slanina", 150), i("vajce", 4, "ks", "3 žĺtky + 1 celé"), i("parmezan", 80), i("korenie", 1, "lyzicka"), i("sol", 1, "lyzica", "do vody")],
    steps: [
      s("Špagety ({spagety}) uvar v osolenej vode al dente.", 9),
      s("Slaninu ({slanina}) nakrájaj na rezančeky a opeč dochrumkava bez oleja."),
      s("Vajcia ({vajce}) vyšľahaj s nastrúhaným parmezánom ({parmezan}) a korením ({korenie})."),
      s("Scedené špagety premiešaj so slaninou mimo ohňa, vlej vajíčkovú zmes a miešaj, kým nevznikne krémová omáčka. Ak treba, pridaj trochu vody z cestovín."),
    ],
  },
  {
    id: "stroganov", name: "Hovädzí Stroganov", category: "hlavne", meat: "hovadzie", minutes: 40, difficulty: 2 as const, portions: 4, hue: 15, icon: "Beef",
    tags: [], source: "",
    ingredients: [i("hovadzie", 600), i("sampinony", 250), i("cibula", 1, "ks"), i("smotana", 200, "ml"), i("horcica", 1, "lyzica"), i("maslo", 30), i("muka", 1, "lyzica"), i("sol", 1, "lyzicka"), i("korenie", 1, "stipka"), i("ryza", 300, "g", "príloha")],
    steps: [
      s("Mäso ({hovadzie}) nakrájaj na tenké prúžky a prudko opeč na polovici masla ({maslo}). Odlož bokom."),
      s("Na zvyšnom masle speň cibuľu ({cibula}) a pridaj nakrájané šampiňóny ({sampinony}).", 6),
      s("Posyp múkou ({muka}), vmiešaj horčicu ({horcica}) a smotanu ({smotana}), krátko povar."),
      s("Vráť mäso, dochuť soľou a korením a prehrej. Podávaj s ryžou ({ryza}).", 3),
    ],
  },
  {
    id: "granadir", name: "Granadír", category: "cestoviny", meat: "bez", minutes: 35, difficulty: 1 as const, portions: 4, hue: 35, icon: "UtensilsCrossed",
    tags: ["klasika", "deti"], source: "",
    ingredients: [i("zemiaky", 600), i("cestoviny", 300), i("cibula", 1, "ks"), i("olej", 2, "lyzica"), i("paprika_mleta", 1, "lyzicka"), i("sol", 1, "lyzicka"), i("uhorky_kysle", 4, "ks", "k podávaniu")],
    steps: [
      s("Zemiaky ({zemiaky}) očisti, nakrájaj na kocky a uvar v osolenej vode do mäkka.", 15),
      s("Cestoviny ({cestoviny}) uvar zvlášť a sceď.", 10),
      s("Na oleji ({olej}) speň cibuľu ({cibula}), stiahni z ohňa a vmiešaj papriku ({paprika_mleta})."),
      s("Všetko premiešaj, dochuť soľou a podávaj s kyslými uhorkami ({uhorky_kysle})."),
    ],
  },
  {
    id: "vepro", name: "Vepřo knedlo zelo", category: "hlavne", meat: "bravcove", minutes: 120, difficulty: 2 as const, portions: 4, hue: 30, icon: "Ham",
    tags: ["klasika"], source: "",
    ingredients: [i("krkovicka", 800), i("kapusta", 500), i("cibula", 2, "ks"), i("rasca", 2, "lyzicka"), i("cesnak", 3, "strucik"), i("olej", 2, "lyzica"), i("muka", 1, "lyzica"), i("cukor", 1, "lyzica"), i("sol", 2, "lyzicka"), i("knedla", 2, "ks")],
    steps: [
      s("Mäso ({krkovicka}) potri soľou, rascou ({rasca}) a cesnakom ({cesnak}), daj do pekáča s cibuľou (1 ks) a trochou vody."),
      s("Peč pri 170 °C, priebežne podlievaj a polievaj výpekom.", 90),
      s("Na oleji ({olej}) speň druhú cibuľu, pridaj kapustu ({kapusta}), podlej vodou a duste.", 25),
      s("Kapustu zahusti múkou ({muka}) a dochuť cukrom ({cukor}). Podávaj s mäsom a knedľou ({knedla})."),
    ],
  },
  {
    id: "kuracie-kari", name: "Kuracie kari s ryžou", category: "hlavne", meat: "kuracie", minutes: 30, difficulty: 1 as const, portions: 4, hue: 40, icon: "Drumstick",
    tags: ["rychle"], source: "",
    ingredients: [i("kuracie_prsia", 600), i("kokosove_mlieko", 400, "ml"), i("kari", 2, "lyzica"), i("cibula", 1, "ks"), i("cesnak", 2, "strucik"), i("olej", 2, "lyzica"), i("ryza", 300), i("sol", 1, "lyzicka")],
    steps: [
      s("Ryžu ({ryza}) uvar podľa obalu.", 15),
      s("Na oleji ({olej}) speň cibuľu ({cibula}) a cesnak ({cesnak}), pridaj kari pastu ({kari}) a krátko orestuj."),
      s("Pridaj kuracie mäso ({kuracie_prsia}) na kocky a opeč, kým nezbelie.", 5),
      s("Zalej kokosovým mliekom ({kokosove_mlieko}), dochuť soľou a nechaj prebublať. Podávaj s ryžou.", 10),
    ],
  },
  {
    id: "paprikas", name: "Kurací paprikáš", category: "hlavne", meat: "kuracie", minutes: 50, difficulty: 1 as const, portions: 4, hue: 20, icon: "Drumstick",
    tags: ["klasika", "deti"], source: "",
    ingredients: [i("kuracie_stehna", 1000), i("cibula", 2, "ks"), i("paprika_mleta", 2, "lyzica"), i("kysla_smotana", 200), i("muka", 1, "lyzica"), i("olej", 2, "lyzica"), i("sol", 1, "lyzicka"), i("cestoviny", 400, "g", "príloha")],
    steps: [
      s("Na oleji ({olej}) speň nadrobno nakrájanú cibuľu ({cibula}).", 6),
      s("Stiahni z ohňa, vmiešaj papriku ({paprika_mleta}), hneď podlej vodou a vlož stehná ({kuracie_stehna}). Osoľ."),
      s("Duste pod pokrievkou do mäkka.", 35),
      s("Smotanu ({kysla_smotana}) rozmiešaj s múkou ({muka}), vmiešaj a krátko povar. Podávaj s cestovinami ({cestoviny})."),
    ],
  },
  {
    id: "bryndzove", name: "Bryndzové halušky", category: "hlavne", meat: "bravcove", minutes: 40, difficulty: 2 as const, portions: 4, hue: 55, icon: "Wheat",
    tags: ["klasika"], source: "",
    ingredients: [i("zemiaky", 800), i("muka", 300), i("bryndza", 250), i("slanina", 150), i("sol", 1, "lyzicka")],
    steps: [
      s("Zemiaky ({zemiaky}) ošúp a najemno nastrúhaj, osoľ a vymiešaj s múkou ({muka}) na husté cesto."),
      s("Cez haluškár hádž halušky do vriacej osolenej vody a var, kým nevyplávajú.", 4),
      s("Slaninu ({slanina}) nakrájaj na kocky a vyškvar dochrumkava."),
      s("Scedené halušky premiešaj s bryndzou ({bryndza}) a polej slaninou aj výpekom."),
    ],
  },
  {
    id: "rezen", name: "Vyprážaný rezeň so zemiakmi", category: "hlavne", meat: "bravcove", minutes: 45, difficulty: 2 as const, portions: 4, hue: 40, icon: "Ham",
    tags: ["klasika", "deti"], source: "",
    ingredients: [i("bravcove_stehno", 600), i("vajce", 2, "ks"), i("muka", 4, "lyzica"), i("struhanka", 100), i("olej", 200, "ml", "na vyprážanie"), i("zemiaky", 800), i("maslo", 30), i("sol", 2, "lyzicka")],
    steps: [
      s("Zemiaky ({zemiaky}) uvar v šupke alebo ošúpané v osolenej vode.", 20),
      s("Mäso ({bravcove_stehno}) nakrájaj na plátky, naklepi a osoľ."),
      s("Obaľ v múke ({muka}), rozšľahaných vajciach ({vajce}) a strúhanke ({struhanka})."),
      s("Vyprážaj na rozpálenom oleji ({olej}) z oboch strán do zlatista.", 8),
      s("Zemiaky polej rozpusteným maslom ({maslo}) a podávaj s rezňami."),
    ],
  },
  {
    id: "sviečková", name: "Sviečková na smotane", category: "hlavne", meat: "hovadzie", minutes: 150, difficulty: 3 as const, portions: 4, hue: 30, icon: "Beef",
    tags: ["klasika"], source: "",
    ingredients: [i("hovadzie", 800), i("mrkva", 2, "ks"), i("petrzlen", 1, "ks"), i("zeler", 100), i("cibula", 1, "ks"), i("slanina", 50), i("smotana", 250, "ml"), i("maslo", 30), i("cukor", 1, "lyzica"), i("horcica", 1, "lyzica"), i("sol", 1, "lyzicka"), i("korenie", 1, "stipka"), i("knedla", 2, "ks"), i("brusnice", 100, "g", "k podávaniu")],
    steps: [
      s("Mäso ({hovadzie}) prešpikuj slaninou ({slanina}), osoľ, okoreň a opeč na masle ({maslo})."),
      s("Pridaj nakrájanú zeleninu: mrkvu ({mrkva}), petržlen ({petrzlen}), zeler ({zeler}) a cibuľu ({cibula}). Opeč, podlej vodou a duste.", 120),
      s("Mäso vyber, zeleninu rozmixuj so smotanou ({smotana}), dochuť cukrom ({cukor}) a horčicou ({horcica})."),
      s("Podávaj nakrájané mäso s omáčkou, knedľou ({knedla}) a brusnicami ({brusnice})."),
    ],
  },
  {
    id: "cesnakova", name: "Cesnaková polievka", category: "polievky", meat: "bez", minutes: 30, difficulty: 1 as const, portions: 4, hue: 95, icon: "Soup",
    tags: ["rychle"], source: "",
    ingredients: [i("zemiaky", 400), i("cesnak", 6, "strucik"), i("maslo", 20), i("rasca", 1, "lyzicka"), i("majoran", 1, "lyzicka"), i("sol", 1, "lyzicka"), i("eidam", 100), i("chlieb", 4, "ks", "krajce na krutóny")],
    steps: [
      s("Zemiaky ({zemiaky}) nakrájaj na kocky a var v 1,2 l osolenej vody s rascou ({rasca}).", 15),
      s("Na masle ({maslo}) opeč kocky chleba ({chlieb}) na krutóny."),
      s("Do polievky pridaj prelisovaný cesnak ({cesnak}) a majorán ({majoran}), už nevar."),
      s("Podávaj s krutónmi a nastrúhaným syrom ({eidam})."),
    ],
  },
  {
    id: "kulajda", name: "Kulajda", category: "polievky", meat: "bez", minutes: 35, difficulty: 2 as const, portions: 4, hue: 80, icon: "Soup",
    tags: [], source: "",
    ingredients: [i("zemiaky", 300), i("sampinony", 200), i("kysla_smotana", 200), i("mlieko", 200, "ml"), i("muka", 2, "lyzica"), i("vajce", 4, "ks", "na stratené vajcia"), i("ocot", 2, "lyzica"), i("kopor", 2, "lyzica"), i("maslo", 20), i("sol", 1, "lyzicka")],
    steps: [
      s("Zemiaky ({zemiaky}) a huby ({sampinony}) var v 1 l osolenej vody do mäkka.", 15),
      s("Smotanu ({kysla_smotana}) rozmiešaj s mliekom ({mlieko}) a múkou ({muka}), vlej do polievky a povar.", 5),
      s("Dochuť octom ({ocot}) a pridaj kôpor ({kopor}) s maslom ({maslo})."),
      s("Do každého taniera daj stratené vajce ({vajce})."),
    ],
  },
  {
    id: "sosovica", name: "Šošovicový prívarok", category: "hlavne", meat: "bravcove", minutes: 45, difficulty: 1 as const, portions: 4, hue: 30, icon: "CookingPot",
    tags: ["klasika"], source: "",
    ingredients: [i("sosovica", 300), i("cibula", 1, "ks"), i("olej", 2, "lyzica"), i("muka", 1, "lyzica"), i("ocot", 1, "lyzica"), i("cukor", 1, "lyzicka"), i("sol", 1, "lyzicka"), i("parky", 4, "ks", "k podávaniu")],
    steps: [
      s("Šošovicu ({sosovica}) prepláchni a var do mäkka.", 25),
      s("Na oleji ({olej}) speň cibuľu ({cibula}), posyp múkou ({muka}) a urob svetlú zápražku."),
      s("Zápražku vmiešaj do šošovice, dochuť octom ({ocot}), cukrom a soľou a povar.", 5),
      s("Podávaj s ohriatymi párkami ({parky})."),
    ],
  },
  {
    id: "bolonske", name: "Bolonské špagety", category: "cestoviny", meat: "bravcove", minutes: 50, difficulty: 1 as const, portions: 4, hue: 10, icon: "UtensilsCrossed",
    tags: ["deti"], source: "",
    ingredients: [i("spagety", 400), i("mlete", 500), i("pasirovane", 500), i("cibula", 1, "ks"), i("mrkva", 1, "ks"), i("cesnak", 2, "strucik"), i("olej", 2, "lyzica"), i("parmezan", 40), i("sol", 1, "lyzicka"), i("oregano", 1, "lyzicka")],
    steps: [
      s("Na oleji ({olej}) speň cibuľu ({cibula}), nastrúhanú mrkvu ({mrkva}) a cesnak ({cesnak})."),
      s("Pridaj mleté mäso ({mlete}) a opekaj, kým sa nerozpadne a nezhnedne.", 8),
      s("Zalej pasírovanými paradajkami ({pasirovane}), pridaj oregano ({oregano}), osoľ a pomaly duste.", 25),
      s("Uvar špagety ({spagety}) a podávaj s omáčkou a parmezánom ({parmezan}).", 9),
    ],
  },
  {
    id: "greckysalat", name: "Grécky šalát", category: "salaty", meat: "bez", minutes: 15, difficulty: 1 as const, portions: 4, hue: 130, icon: "Salad",
    tags: ["rychle"], source: "",
    ingredients: [i("paradajky", 4, "ks"), i("uhorka", 1, "ks"), i("paprika", 1, "ks"), i("cervena_cibula", 1, "ks"), i("feta", 200), i("olivy", 100), i("olivovy_olej", 3, "lyzica"), i("oregano", 1, "lyzicka"), i("sol", 1, "stipka")],
    steps: [
      s("Paradajky ({paradajky}), uhorku ({uhorka}) a papriku ({paprika}) nakrájaj na väčšie kúsky, cibuľu ({cervena_cibula}) na kolieska."),
      s("Pridaj olivy ({olivy}), polej olivovým olejom ({olivovy_olej}) a jemne osoľ."),
      s("Navrch polož fetu ({feta}) a posyp oreganom ({oregano})."),
    ],
  },
  {
    id: "lievance", name: "Lievance s čučoriedkami", category: "ranajky", meat: "bez", minutes: 25, difficulty: 1 as const, portions: 4, hue: 260, icon: "CakeSlice",
    tags: ["deti", "rychle", "sladke"], source: "",
    ingredients: [i("muka", 250), i("mlieko", 300, "ml"), i("vajce", 2, "ks"), i("cukor", 2, "lyzica"), i("prasok", 1, "lyzicka"), i("olej", 2, "lyzica"), i("sol", 1, "stipka"), i("cucoriedky", 150)],
    steps: [
      s("Zmiešaj múku ({muka}), prášok do pečiva ({prasok}), cukor ({cukor}) a štipku soli."),
      s("Pridaj vajcia ({vajce}) a mlieko ({mlieko}) a vymiešaj husté cesto."),
      s("Na panvici s kvapkou oleja ({olej}) peč malé lievance z oboch strán.", 8),
      s("Podávaj s čučoriedkami ({cucoriedky})."),
    ],
  },
  {
    id: "pazenica", name: "Praženica s chlebom", category: "ranajky", meat: "bez", minutes: 10, difficulty: 1 as const, portions: 2, hue: 50, icon: "Egg",
    tags: ["rychle", "deti"], source: "",
    ingredients: [i("vajce", 4, "ks"), i("maslo", 15), i("cibula", 1, "ks"), i("sol", 1, "stipka"), i("korenie", 1, "stipka"), i("chlieb", 2, "ks", "krajce")],
    steps: [
      s("Na masle ({maslo}) speň nadrobno nakrájanú cibuľu ({cibula}).", 3),
      s("Vbi vajcia ({vajce}), osoľ, okoreň a miešaj, kým nestuhnú. Podávaj s chlebom ({chlieb}).", 2),
    ],
  },
  {
    id: "buchty", name: "Kysnuté buchty s lekvárom", category: "sladke", meat: "bez", minutes: 100, difficulty: 3 as const, portions: 6, hue: 30, icon: "Croissant",
    tags: ["klasika", "deti"], source: "",
    ingredients: [i("muka", 500), i("mlieko", 250, "ml"), i("drozdie", 20), i("cukor", 80), i("maslo", 80), i("vajce", 1, "ks"), i("sol", 1, "stipka"), i("dzem", 200, "g", "lekvár")],
    steps: [
      s("Droždie ({drozdie}) rozmiešaj vo vlažnom mlieku ({mlieko}) s lyžičkou cukru a nechaj vzísť.", 10),
      s("Zmiešaj s múkou ({muka}), zvyšným cukrom ({cukor}), vajcom ({vajce}), štipkou soli a rozpusteným maslom ({maslo}). Vypracuj cesto a nechaj kysnúť.", 45),
      s("Rozdeľ na kúsky, naplň lekvárom ({dzem}), uzavri a ulož do vymasteného pekáča tesne vedľa seba."),
      s("Peč pri 180 °C do zlatista.", 30),
    ],
  },
  {
    id: "losos", name: "Losos so zeleninou", category: "hlavne", meat: "ryby", minutes: 30, difficulty: 1 as const, portions: 4, hue: 200, icon: "Fish",
    tags: ["rychle"], source: "",
    ingredients: [i("losos", 600), i("brokolica", 1, "ks"), i("mrkva", 2, "ks"), i("zemiaky", 600), i("citron", 1, "ks"), i("olivovy_olej", 2, "lyzica"), i("cesnak", 2, "strucik"), i("sol", 1, "lyzicka"), i("korenie", 1, "stipka")],
    steps: [
      s("Zemiaky ({zemiaky}) nakrájaj na mesiačiky, premiešaj s olejom ({olivovy_olej}) a soľou a peč pri 200 °C.", 15),
      s("Pridaj ružičky brokolice ({brokolica}) a mrkvu ({mrkva}) na kolieska."),
      s("Navrch polož lososa ({losos}) s cesnakom ({cesnak}) a plátkami citróna ({citron}), dopeč.", 12),
    ],
  },
];

/*
 * Podrobnosti krokov (ako poznáš, že je hotovo · tip · podrobnejší postup) pre katalógové recepty.
 * Vlastným receptom ich napíše Gemini pri čítaní.
 */
export const STEP_DETAILS: Record<string, Pick<Step, "done" | "tip" | "more">[]> = {
  segedin: [
    { done: "Cibuľa je sklovitá a zlatistá, nie hnedá.", tip: "Mierny oheň – spálená cibuľa zhorkne celý guláš.", more: "Cibuľu nakrájaj na malé kocky (asi 5 mm). Olej nahrej na strednom ohni, cibuľu pridaj s malou štipkou soli, vytiahne z nej vodu a speníš ju rovnomernejšie. Miešaj každú minútu." },
    { done: "Mäso je zo všetkých strán zatiahnuté, už nie ružové.", tip: "Papriku daj až na chvíľku a hneď podlej – na horúcom oleji zhorkne za pár sekúnd.", more: "Mäso nakrájaj na kocky asi 3 × 3 cm a opekaj po dávkach, aby sa nedusilo vo vlastnej šťave. Po paprike podlej toľko vody, aby bolo mäso takmer zakryté." },
    { done: "Mäso je polomäkké, vidlička prejde s miernym odporom.", tip: "Občas zamiešaj a podlej, keď šťava klesne pod mäso.", more: "Pokrievku nechaj mierne pootvorenú, nech sa šťava pomaly redukuje. Cesnak môžeš pridať aj až v posledných 10 minútach, bude výraznejší." },
    { done: "Kapusta aj mäso sú mäkké, šťava je hustejšia.", tip: "Ochutnaj kapustu – ak je veľmi kyslá, prepláchni ju dôkladnejšie alebo pridaj lyžičku cukru.", more: "Kapustu pred pridaním vytlač z nálevu a pokrájaj, ak má dlhé vlákna. Po pridaní premiešaj a duste pod pokrievkou na miernom ohni." },
    { done: "Guláš je krémový, múka už nie je cítiť (asi 3 minúty varu).", tip: "Smotanu najprv zmiešaj s trochou horúcej šťavy, nezrazí sa.", more: "Do misky so smotanou a múkou prilej naberačku šťavy, rozšľahaj dohladka a až potom vlej do hrnca. Krátko povar za stáleho miešania a dochuť soľou." },
  ],
  palacinky: [
    { done: "Zmes je jednoliata, bez kúskov bielka.", tip: "Mlieko izbovej teploty sa s vajcami spojí lepšie.", more: "Vajcia rozšľahaj metličkou, prilej asi tretinu mlieka, pridaj cukor a soľ. Zvyšok mlieka pridáš v ďalšom kroku spolu s múkou." },
    { done: "Cesto steká z lyžice ako hustejšia smotana, bez hrudiek.", tip: "Odpočinok 10 minút – palacinky sa potom netrhajú.", more: "Múku pridávaj postupne a stále šľahaj, striedaj ju so zvyškom mlieka. Ak vzniknú hrudky, cesto preceď cez sitko." },
    { done: "Okraje sa odliepajú a spodok je zlatistý – vtedy otoč.", tip: "Prvá palacinka býva skúšobná, podľa nej uprav hrúbku a oheň.", more: "Panvicu dobre rozpáľ, potri ju tenko olejom (najlepšie kúskom papierovej utierky), nalej naberačku cesta a krúživým pohybom ho rozlej po celom dne." },
    { done: "Palacinky sú natreté tenkou vrstvou a pevne zrolované.", tip: "Upečené palacinky ukladaj na tanier pod pokrievku, ostanú mäkké a teplé.", more: "Džem natri až k okrajom, nechaj asi 1 cm voľný. Môžeš ich aj preložiť na štvrtinu, ak sa ti zrolované rozbaľujú." },
  ],
};
