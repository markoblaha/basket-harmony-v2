/**
 * Kategórie položiek. Zoznam je zhodný s tabuľkou `categories` v databáze
 * (tam je autoritatívny – databáza neprijme neznámu kategóriu).
 * Poradie zodpovedá tomu, ako bežne ideš obchodom: ovocie a zelenina pri
 * vchode, pečivo, chladené... drogéria na konci.
 */
export const CATEGORIES = [
  { id: "produce", name: "Ovocie a zelenina", emoji: "🥦" },
  { id: "bakery", name: "Pečivo", emoji: "🥖" },
  { id: "dairy_eggs", name: "Mliečne a vajcia", emoji: "🥛" },
  { id: "deli_chilled", name: "Údeniny a chladené", emoji: "🧀" },
  { id: "meat_fish", name: "Mäso a ryby", emoji: "🥩" },
  { id: "frozen", name: "Mrazené", emoji: "🧊" },
  { id: "pantry", name: "Trvanlivé potraviny", emoji: "🥫" },
  { id: "breakfast", name: "Raňajky, káva a čaj", emoji: "☕" },
  { id: "snacks_sweets", name: "Sladkosti a slané", emoji: "🍫" },
  { id: "beverages", name: "Nápoje", emoji: "🧃" },
  { id: "alcohol", name: "Alkohol", emoji: "🍷" },
  { id: "household_cleaning", name: "Domácnosť a čistenie", emoji: "🧽" },
  { id: "personal_care", name: "Drogéria", emoji: "🧴" },
  { id: "baby", name: "Pre deti", emoji: "🍼" },
  { id: "pet", name: "Zvieratá", emoji: "🐾" },
  { id: "other", name: "Ostatné", emoji: "🛒" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

const ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [c.id, i]));
const BY_ID = new Map<string, (typeof CATEGORIES)[number]>(CATEGORIES.map((c) => [c.id, c]));

export function categoryOrder(id: string): number {
  return ORDER.get(id) ?? ORDER.get("other")!;
}

export function category(id: string) {
  return BY_ID.get(id) ?? BY_ID.get("other")!;
}

/** "  Mlieko  POLOTUČNÉ " -> "mlieko polotucne" (rovnako ako name_key v databáze) */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Odhad kategórie podľa slov v názve. Každé slovo položky sa porovná so
 * začiatkami slov nižšie ("jablk" sedí na jablko, jablká, jablkový...).
 * Je to len prvý odhad – keď ho používateľ opraví, databáza si opravu
 * zapamätá a nabudúce má prednosť pred týmto odhadom.
 */
const KEYWORDS: Record<Exclude<CategoryId, "other">, string[]> = {
  produce: [
    "jablk", "hrusk", "banan", "pomaranc", "mandarin", "citron", "limet", "grep", "kiwi", "hrozn",
    "jahod", "malin", "cucoried", "ceresn", "visn", "slivk", "broskyn", "marhul", "melon", "ananas",
    "mango", "avokad", "ovoc", "zelenin", "paradajk", "rajcin", "uhork", "paprik", "cibul", "cesnak",
    "zemiak", "mrkv", "petrzlen", "zeler", "kapust", "kel", "brokolic", "karfiol", "cuket", "baklazan",
    "salat", "spenat", "rukol", "redkovk", "repa", "tekvic", "hub", "sampinon", "pazitk", "bylink",
    "kopr", "bazalk", "zazvor", "fazulk", "hrasok", "kukuric", "dyna", "datl", "figy",
  ],
  bakery: [
    "chlieb", "chleb", "rozok", "rozky", "rozk", "bageta", "baget", "kaiserk", "zeml", "pecivo",
    "croissant", "kolac", "kolac", "buchta", "buchty", "vianocka", "toast", "tortill", "pita", "loupak",
    "slimak", "pagac", "osie hniezd",
  ],
  dairy_eggs: [
    "mliek", "mleko", "jogurt", "kefir", "acidko", "syr", "syry", "bryndz", "tvaroh", "maslo",
    "masla", "smotan", "smetan", "zakys", "vajc", "vajec", "mozzarell", "parmezan", "eidam", "gouda",
    "niva", "cottage", "skyr", "pudink", "lucin", "ricott", "mascarpon", "feta", "halloumi", "nite",
  ],
  deli_chilled: [
    "sunk", "salam", "parky", "parok", "klobas", "slanin", "pastet", "hummus", "natierk", "tofu",
    "udenin", "spekacik", "tlacenk", "sushi", "cestoviny cerstve", "gnocchi",
  ],
  meat_fish: [
    "maso", "masa", "kurac", "kuraci", "kura", "morcac", "hovadz", "bravcov", "teleci", "jahnac",
    "mlete", "rezen", "stehn", "prsia", "krkovic", "karé", "kare", "ryba", "ryby", "losos", "tuniak",
    "treska", "pstruh", "kapor", "krevet", "chobotnic", "kaci", "kacic", "husac", "panenk",
  ],
  frozen: ["mrazen", "zmrzlin", "nanuk", "pizza mrazen", "hranolk", "mrazene"],
  pantry: [
    "ryza", "ryze", "ryzu", "cestovin", "spaget", "penne", "fusill", "makaron", "muka", "cukor",
    "sol", "olej", "ocot", "kecup", "horcic", "majonez", "omack", "konzerv", "fazula", "sosovic",
    "cicer", "kuskus", "bulgur", "quinoa", "korenie", "paprika mlet", "rasc", "oregano", "bujon",
    "polievk", "kypriac", "drozdie", "strouhank", "struhank", "strukovin", "orechy", "mandle",
    "vlassk", "arasid", "rozink", "sezam", "chia", "pretlak", "passat", "olivy", "kukurica sterilizovana",
  ],
  breakfast: [
    "kava", "kavu", "caj", "kakao", "musli", "vlock", "cornflakes", "cerealie", "med", "dzem",
    "lekvar", "nutella", "natierka orieskov", "arasidove maslo", "kapsule", "granola",
  ],
  snacks_sweets: [
    "cokolad", "cukrik", "bonbon", "susienk", "keks", "oblatk", "tycink", "chips", "chrumk", "slane",
    "popcorn", "orieskov", "gumen", "lizank", "zuvack", "horalk", "kinder", "milka", "sladkost",
    "croissant cokolad", "muffin", "torta", "dezert",
  ],
  beverages: [
    "voda", "vodu", "vody", "mineralk", "sodovk", "dzus", "dzusy", "sirup", "limonad", "cola",
    "kofol", "fanta", "sprite", "tonic", "energetick", "redbull", "red bull", "monster", "caj ladovy",
    "ladovy caj", "napoj", "smoothie", "capri", "rajec", "budis", "mattoni",
  ],
  alcohol: [
    "pivo", "piva", "pivo nealko", "vino", "vina", "prosecco", "sekt", "sampan", "vodka", "rum",
    "whisky", "gin", "borovick", "slivovic", "hruskovic", "becherovk", "jagermeister", "likér", "liker",
    "radler", "cider",
  ],
  household_cleaning: [
    "prasok", "praci", "avivaz", "jar", "saponat", "umyvack", "tablety do", "toaletny papier",
    "papierove uterak", "kuchynske uterk", "vreck", "sacky", "alobal", "folia", "papier na pecenie",
    "cistiac", "domestos", "savo", "worek", "spongi", "hubk", "hubky", "handr", "osviezovac",
    "bateri", "ziarovk", "sviecka", "sviecky", "servitk", "ariel", "persil", "lenor", "finish",
  ],
  personal_care: [
    "sampon", "kondicioner", "sprchov", "mydlo", "zubna", "zubnu", "kefka", "deodorant", "dezodorant",
    "krem", "pletov", "holiac", "ziletk", "vlozk", "tampon", "vatov", "tycinky do usi", "parfum",
    "make-up", "rtenk", "odlicova", "ustna voda", "nivea", "dove", "hygien", "vitamin",
  ],
  baby: ["plienk", "pampers", "detsk", "dojcensk", "prikrm", "vlhcene obrusk", "sunar", "hami"],
  pet: ["granul", "pre psa", "pre macku", "krmivo", "steliv", "psie", "macaci", "macacie", "whiskas", "pedigree"],
};

const RULES: [CategoryId, string[]][] = Object.entries(KEYWORDS).map(([id, words]) => [
  id as CategoryId,
  words.map(normalizeName),
]);

export function guessCategory(name: string): CategoryId {
  const text = normalizeName(name);
  if (!text) return "other";
  const words = text.split(" ");
  let best: { id: CategoryId; length: number } | null = null;
  for (const [id, keywords] of RULES) {
    for (const keyword of keywords) {
      const hit = keyword.includes(" ")
        ? text.includes(keyword)
        : words.some((word) => word.startsWith(keyword));
      // Dlhšie (konkrétnejšie) zhody vyhrávajú: "pizza mrazena" > "pizza".
      if (hit && (!best || keyword.length > best.length)) best = { id, length: keyword.length };
    }
  }
  return best?.id ?? "other";
}
