import { t } from "@/i18n";

/**
 * Kategórie položiek. Zoznam je zhodný s tabuľkou `categories` v databáze
 * (tam je autoritatívny – databáza neprijme neznámu kategóriu).
 * Poradie zodpovedá tomu, ako bežne ideš obchodom: ovocie a zelenina pri
 * vchode, pečivo, chladené... drogéria na konci.
 *
 * Názov (`name`) sa prekladá v okamihu čítania podľa zvoleného jazyka;
 * texty sú v src/i18n/sk/categories.ts a src/i18n/en/categories.ts pod kľúčom `category.<id>`.
 */
const DEFINITIONS = [
  ["groceries", "🧺", 120],
  ["produce", "🥦", 140],
  ["bakery", "🥖", 70],
  ["dairy_eggs", "🥛", 230],
  ["deli_chilled", "🧀", 35],
  ["meat_fish", "🥩", 15],
  ["frozen", "🧊", 210],
  ["pantry", "🥫", 55],
  ["breakfast", "☕", 45],
  ["snacks_sweets", "🍫", 330],
  ["beverages", "🧃", 190],
  ["alcohol", "🍷", 350],
  ["household_cleaning", "🧽", 170],
  ["personal_care", "🧴", 290],
  ["health", "💊", 0],
  ["baby", "🍼", 310],
  ["pet", "🐾", 90],
  ["clothing", "👕", 260],
  ["home", "🛋️", 25],
  ["toys_hobby", "🧸", 100],
  ["electronics", "🔌", 245],
  ["fuel", "⛽", 275],
  ["transport", "🚗", 230],
  ["dining", "🍽️", 60],
  ["leisure", "🎟️", 80],
  ["fees", "📦", 200],
  ["deposit", "♻️", 150],
  ["housing", "🏠", 25],
  ["telecom", "📱", 200],
  ["insurance", "🛡️", 220],
  ["other", "🛒", 280],
] as const;

export type CategoryId = (typeof DEFINITIONS)[number][0];

export type CategoryInfo = {
  readonly id: CategoryId;
  readonly emoji: string;
  readonly hue: number;
  /** Názov v aktuálnom jazyku. */
  readonly name: string;
};

export const CATEGORIES: readonly CategoryInfo[] = DEFINITIONS.map(([id, emoji, hue]) => ({
  id,
  emoji,
  hue,
  get name() {
    return t(`category.${id}`);
  },
}));

const ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [c.id, i]));
const BY_ID = new Map<string, CategoryInfo>(CATEGORIES.map((c) => [c.id, c]));

export function categoryOrder(id: string): number {
  return ORDER.get(id) ?? ORDER.get("other")!;
}

export function category(id: string): CategoryInfo {
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
    "sampon", "kondicioner", "sprchov", "mydlo", "zubna", "zubna pasta", "zubnu", "kefka", "deodorant", "dezodorant",
    "krem", "pletov", "holiac", "ziletk", "vlozk", "tampon", "vatov", "tycinky do usi", "parfum",
    "make-up", "rtenk", "odlicova", "ustna voda", "nivea", "dove", "hygien", "vitamin",
  ],
  baby: ["plienk", "pampers", "detsk", "dojcensk", "prikrm", "vlhcene obrusk", "sunar", "hami"],
  pet: ["granul", "pre psa", "pre macku", "krmivo", "steliv", "psie", "macaci", "macacie", "whiskas", "pedigree"],
};

/**
 * Anglické názvy. Odhad nezávisí od jazyka rozhrania – kto píše „milk“ v slovenskej
 * aplikácii (alebo „mlieko“ v anglickej), dostane rovnakú kategóriu.
 * Značka `$` na konci znamená „presne toto slovo“ (inak sedí začiatok slova):
 * "pot$" je hrniec, ale nie "potato".
 */
const KEYWORDS_EN: Record<Exclude<CategoryId, "other" | "groceries">, string[]> = {
  transport: ["parking", "toll$", "car wash", "vignette"],
  leisure: ["ticket", "cinema", "movie"],
  housing: ["rent$", "electricity", "utilities"],
  telecom: ["subscription", "data plan", "phone credit", "top up"],
  insurance: ["insurance"],
  health: [
    "ibuprofen", "paracetamol", "aspirin", "painkiller", "medicine", "pills$", "plaster$", "plasters$",
    "bandage", "thermometer", "magnesium", "vitamin c", "vitamin d", "cough", "allergy",
  ],
  clothing: [
    "t-shirt", "tshirt", "shirt$", "hoodie", "trousers", "pants$", "jeans", "socks$", "tights", "jacket",
    "sweater", "jumper$", "shoes$", "sneakers", "boots$", "bras$", "underwear", "pyjama", "pajama",
  ],
  home: ["pot$", "pots$", "pan$", "pans$", "plate$", "plates$", "glass$", "glasses$", "cutlery", "knife$", "hanger", "decor", "towel$", "towels$", "bedding", "pillow", "cushion", "vase$", "mug$", "mugs$", "bowl$", "bowls$"],
  toys_hobby: ["toy$", "toys$", "lego", "puzzle", "plasticine", "crayon", "notebook", "pen$", "pens$", "ball$"],
  electronics: ["cable$", "charger", "headphones", "earbuds", "usb", "adapter", "keyboard", "powerbank", "power bank"],
  fuel: ["diesel", "petrol", "unleaded", "gasoline", "lpg", "adblue", "fuel$"],
  dining: ["lunch", "dinner", "restaurant", "takeaway", "kebab", "burger", "meal deal"],
  fees: ["delivery", "postage", "shipping", "packaging", "fee$", "fees$", "courier"],
  deposit: ["deposit", "refundable"],
  produce: [
    "apple", "pear$", "pears$", "banana", "orange$", "oranges$", "tangerine", "lemon", "lime$", "limes$",
    "grapefruit", "kiwi", "grape$", "grapes$", "strawberr", "raspberr", "blueberr", "cherr", "plum$", "plums$",
    "peach", "apricot", "melon$", "pineapple", "mango", "avocado", "fruit", "vegetable", "tomato", "cucumber",
    "pepper$", "peppers$", "onion", "garlic", "potato", "carrot", "parsley", "celery", "cabbage", "kale$",
    "broccoli", "cauliflower", "zucchini", "courgette", "aubergine", "eggplant", "lettuce", "spinach",
    "rocket$", "arugula", "radish", "beetroot", "pumpkin", "mushroom", "chives", "herbs$", "dill$", "basil",
    "ginger", "beans$", "peas$", "sweetcorn", "corn$", "dates$", "figs$", "salad",
  ],
  bakery: [
    "bread", "roll$", "rolls$", "baguette", "bun$", "buns$", "croissant", "pastry", "pastries", "cake$",
    "toast$", "tortilla", "wraps$", "pita", "bagel", "brioche", "pretzel", "donut", "doughnut", "scone",
    "sourdough", "loaf",
  ],
  dairy_eggs: [
    "milk", "yogurt", "yoghurt", "kefir", "cheese", "butter", "cream$", "sour cream", "egg$", "eggs$",
    "mozzarella", "parmesan", "cheddar", "gouda", "edam", "feta", "halloumi", "ricotta", "mascarpone",
    "cottage", "skyr", "pudding", "quark", "buttermilk", "creme fraiche",
  ],
  deli_chilled: ["ham$", "salami", "sausage", "hot dog", "bacon", "pate$", "hummus", "tofu", "cold cuts", "deli$", "sushi", "fresh pasta", "gnocchi"],
  meat_fish: [
    "meat$", "chicken", "beef", "pork", "veal", "lamb$", "turkey", "duck$", "goose$", "minced", "mince$",
    "steak", "schnitzel", "chops$", "ribs$", "fillet", "fish$", "salmon", "tuna", "cod$", "trout", "carp$",
    "shrimp", "prawn", "squid", "octopus", "tenderloin",
  ],
  frozen: ["frozen", "ice cream", "popsicle", "fries$", "french fries", "fish fingers"],
  pantry: [
    "rice$", "pasta$", "spaghetti", "penne", "fusilli", "macaroni", "noodle", "flour", "sugar", "salt$",
    "oil$", "olive oil", "vinegar", "ketchup", "mustard", "mayonnaise", "mayo$", "sauce", "canned", "tinned",
    "chickpea", "lentil", "couscous", "bulgur", "quinoa", "spice", "oregano", "stock cube", "bouillon", "soup$",
    "baking powder", "yeast", "breadcrumb", "nuts$", "almond", "walnut", "raisin", "sesame", "chia",
    "passata", "olives$", "coconut milk", "black pepper", "pesto", "tomato paste",
  ],
  breakfast: [
    "coffee", "tea$", "teabag", "tea bags", "cocoa", "muesli", "oats$", "oatmeal", "porridge", "cornflakes",
    "cereal", "honey", "jam$", "marmalade", "nutella", "peanut butter", "granola",
  ],
  snacks_sweets: [
    "chocolate", "candy", "sweets$", "gummy", "gummies", "biscuit", "cookie", "wafer", "crisps", "chips$",
    "popcorn", "lollipop", "marshmallow", "snack", "dessert",
  ],
  beverages: [
    "water$", "sparkling water", "mineral water", "juice", "soda$", "lemonade", "cola", "tonic", "energy drink",
    "red bull", "monster", "iced tea", "smoothie", "drink$", "drinks$", "squash$", "sprite", "fanta",
    "orange juice", "apple juice",
  ],
  alcohol: ["beer", "wine", "prosecco", "champagne", "vodka", "rum$", "whisky", "whiskey", "gin$", "brandy", "liqueur", "cider", "lager", "ale$", "tequila"],
  household_cleaning: [
    "detergent", "washing powder", "laundry", "fabric softener", "dishwasher tablet", "toilet paper",
    "kitchen roll", "paper towel", "bin bag", "trash bag", "garbage bag", "foil$", "aluminium foil",
    "baking paper", "cling film", "cleaner", "bleach", "sponge", "cloth$", "air freshener", "battery", "batteries",
    "light bulb", "candle", "napkin", "washing up", "dish soap", "wipes$",
  ],
  personal_care: [
    "shampoo", "conditioner", "shower gel", "soap$", "toothpaste", "toothbrush", "deodorant", "face cream",
    "moisturi", "razor", "shaving", "tampon", "cotton", "perfume", "make-up", "makeup", "mascara",
    "mouthwash", "sunscreen", "lotion", "nail polish", "lip balm",
  ],
  baby: ["diaper", "nappy", "nappies", "baby", "formula milk", "wet wipes"],
  pet: ["dog food", "cat food", "pet$", "cat litter", "litter$", "dog treats", "kibble"],
};

const RULES: [CategoryId, string[]][] = Object.keys({ ...KEYWORDS, ...KEYWORDS_EN }).map((id) => [
  id as CategoryId,
  [
    ...(KEYWORDS[id as keyof typeof KEYWORDS] ?? []),
    ...(KEYWORDS_EN[id as keyof typeof KEYWORDS_EN] ?? []),
  ].map(normalizeName),
]);

export function guessCategory(name: string): CategoryId {
  const text = normalizeName(name);
  if (!text) return "other";
  const words = text.split(" ");
  let best: { id: CategoryId; length: number } | null = null;
  for (const [id, keywords] of RULES) {
    for (const keyword of keywords) {
      const exact = keyword.endsWith("$");
      const word = exact ? keyword.slice(0, -1) : keyword;
      const hit = word.includes(" ")
        ? text.includes(word)
        : exact
          ? words.includes(word)
          : words.some((w) => w.startsWith(word));
      // Dlhšie (konkrétnejšie) zhody vyhrávajú: "pizza mrazena" > "pizza".
      if (hit && (!best || word.length > best.length)) best = { id, length: word.length };
    }
  }
  return best?.id ?? "other";
}
