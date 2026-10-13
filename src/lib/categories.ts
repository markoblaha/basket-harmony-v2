/**
 * Kategórie položiek. Zoznam je zhodný s tabuľkou `categories` v databáze
 * (tam je autoritatívny – databáza neprijme neznámu kategóriu).
 * Poradie zodpovedá tomu, ako bežne ideš obchodom: ovocie a zelenina pri
 * vchode, pečivo, chladené... drogéria na konci.
 */
export const CATEGORIES = [
  { id: "groceries", name: "Nákup potravín (bez rozpisu)", emoji: "🧺", hue: 120 },
  { id: "produce", name: "Ovocie a zelenina", emoji: "🥦", hue: 140 },
  { id: "bakery", name: "Pečivo", emoji: "🥖", hue: 70 },
  { id: "dairy_eggs", name: "Mliečne a vajcia", emoji: "🥛", hue: 230 },
  { id: "deli_chilled", name: "Údeniny a chladené", emoji: "🧀", hue: 35 },
  { id: "meat_fish", name: "Mäso a ryby", emoji: "🥩", hue: 15 },
  { id: "frozen", name: "Mrazené", emoji: "🧊", hue: 210 },
  { id: "pantry", name: "Trvanlivé potraviny", emoji: "🥫", hue: 55 },
  { id: "breakfast", name: "Raňajky, káva a čaj", emoji: "☕", hue: 45 },
  { id: "snacks_sweets", name: "Sladkosti a slané", emoji: "🍫", hue: 330 },
  { id: "beverages", name: "Nápoje", emoji: "🧃", hue: 190 },
  { id: "alcohol", name: "Alkohol", emoji: "🍷", hue: 350 },
  { id: "household_cleaning", name: "Domácnosť a čistenie", emoji: "🧽", hue: 170 },
  { id: "personal_care", name: "Drogéria", emoji: "🧴", hue: 290 },
  { id: "health", name: "Zdravie a lekáreň", emoji: "💊", hue: 0 },
  { id: "baby", name: "Pre deti", emoji: "🍼", hue: 310 },
  { id: "pet", name: "Zvieratá", emoji: "🐾", hue: 90 },
  { id: "clothing", name: "Oblečenie a obuv", emoji: "👕", hue: 260 },
  { id: "home", name: "Domov a vybavenie", emoji: "🛋️", hue: 25 },
  { id: "toys_hobby", name: "Hračky a hobby", emoji: "🧸", hue: 100 },
  { id: "electronics", name: "Elektronika", emoji: "🔌", hue: 245 },
  { id: "fuel", name: "Pohonné hmoty", emoji: "⛽", hue: 275 },
  { id: "transport", name: "Auto a doprava", emoji: "🚗", hue: 230 },
  { id: "dining", name: "Jedlo von", emoji: "🍽️", hue: 60 },
  { id: "leisure", name: "Voľný čas", emoji: "🎟️", hue: 80 },
  { id: "fees", name: "Doprava a poplatky", emoji: "📦", hue: 200 },
  { id: "deposit", name: "Zálohy", emoji: "♻️", hue: 150 },
  { id: "housing", name: "Bývanie a energie", emoji: "🏠", hue: 25 },
  { id: "telecom", name: "Telefón, internet a predplatné", emoji: "📱", hue: 200 },
  { id: "insurance", name: "Poistenie a financie", emoji: "🛡️", hue: 220 },
  { id: "other", name: "Ostatné", emoji: "🛒", hue: 280 },
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
  groceries: [],
  transport: ["parkovan", "dialnicn", "znamka", "umyvanie auta", "autoumyv"],
  leisure: ["vstupenk", "listok do kina", "kino"],
  housing: ["najom", "najomne", "elektrin", "plyn", "voda a stocne"],
  telecom: ["netflix", "spotify", "predplatne", "kredit na mobil"],
  insurance: ["poistenie", "poistk"],
  health: ["ibalgin", "paralen", "nurofen", "liek", "tablet", "sirup proti", "nahrast", "obvaz", "teplomer", "magnez", "vitamin c", "vitamin d"],
  clothing: ["tricko", "mikina", "nohavic", "ponozk", "pancuch", "bunda", "sveter", "pulover", "obuv", "topanky", "tenisk", "podprsenk", "spodn", "pyzam"],
  home: ["hrnc", "panvic", "tanier", "pohar", "pribor", "noz", "vesiak", "ramik", "dekorac", "uterak", "obliecka", "vank", "kvetinac", "stolik"],
  toys_hobby: ["hracka", "hracky", "lego", "puzzle", "plastelin", "modelovac", "pastelk", "farbick", "zosit", "pero", "lopta", "stavebnic", "hrazdick"],
  electronics: ["kabel", "nabijack", "sluchadl", "usb", "adapter", "klavesnic", "powerbank"],
  fuel: ["nafta", "diesel", "benzin", "natural 95", "natural 98", "lpg", "adblue"],
  dining: ["menu", "obed", "restaurac", "bufet", "kebab", "burger"],
  fees: ["doprava", "postovne", "postovn", "balne", "poplatok", "kurier", "alzabox", "dorucen"],
  deposit: ["zaloha", "zaloh", "zalohovan", "vratn"],
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
