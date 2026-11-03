// Ukážkové dáta prototypu. Ceny a výdavky sú z testovacej databázy (bločky domácnosti, sept.–okt. 2026),
// položky s approx:true majú len orientačnú cenu (v bločkoch sa ešte nevyskytli).

export const MEMBERS = {
  m: { id: 'm', name: 'Marek', ini: 'M', col: '#c9775e' },
  l: { id: 'l', name: 'Lucia', ini: 'L', col: '#5f8fb0' },
};

export const STORES = {
  lidl: { n: 'Lidl', s: 'L', c1: '#2f78c8', c2: '#174f92' },
  kaufland: { n: 'Kaufland', s: 'K', c1: '#ec4b44', c2: '#a3161c' },
  tesco: { n: 'Tesco', s: 'T', c1: '#3d6fc4', c2: '#1d438c' },
  dm: { n: 'dm', s: 'dm', c1: '#5574c6', c2: '#2a428c' },
  drmax: { n: 'Dr.Max', s: 'D', c1: '#3cb57a', c2: '#1b7a4a' },
  kraj: { n: 'Kraj', s: 'K', c1: '#e3a53e', c2: '#b37414' },
  metro: { n: 'Metro', s: 'M', c1: '#33509c', c2: '#182c6a' },
  alza: { n: 'Alza', s: 'A', c1: '#4a8fd8', c2: '#215fa3' },
  billa: { n: 'Billa', s: 'B', c1: '#f0c33c', c2: '#c4920f' },
};
export const SHOP_STORES = ['kaufland', 'lidl', 'tesco', 'billa', 'dm', 'drmax'];

// Kategórie v poradí trasy obchodu (rovnaké pre všetky obchody – rozhodnutie majiteľa).
export const CATS = {
  bakery: { n: 'Pečivo', e: 'baguette', col: '#d9a35b' },
  produce: { n: 'Ovocie a zelenina', e: 'leafy', col: '#6fb36a' },
  meat_fish: { n: 'Mäso a ryby', e: 'meat', col: '#d8726a' },
  deli_chilled: { n: 'Údeniny a syry', e: 'cheese', col: '#e0b54f' },
  dairy_eggs: { n: 'Mliečne a vajcia', e: 'milk', col: '#8fb4d9' },
  frozen: { n: 'Mrazené', e: 'ice', col: '#7cc3d6' },
  pantry: { n: 'Trvanlivé', e: 'canned', col: '#c98a5a' },
  breakfast: { n: 'Káva a čaj', e: 'coffee', col: '#a07858' },
  snacks_sweets: { n: 'Sladkosti a slané', e: 'chocolate', col: '#b5815e' },
  beverages: { n: 'Nápoje', e: 'juice', col: '#78b8a0' },
  alcohol: { n: 'Alkohol', e: 'wine', col: '#c0647e' },
  household_cleaning: { n: 'Domácnosť', e: 'sponge', col: '#8aa0c0' },
  personal_care: { n: 'Drogéria', e: 'lotion', col: '#c39ad6' },
  baby: { n: 'Pre deti', e: 'babybottle', col: '#e08ba6' },
  health: { n: 'Zdravie', e: 'pill', col: '#6fb3a1' },
  // len v analytike
  fuel: { n: 'Palivo', e: 'fuel', col: '#e8a65a' },
  clothing: { n: 'Oblečenie', e: 'tshirt', col: '#9b8ad6' },
  home: { n: 'Domov a dielňa', e: 'couch', col: '#c9a14d' },
  electronics: { n: 'Elektronika', e: 'plug', col: '#7d8fa8' },
  toys_hobby: { n: 'Hračky', e: 'teddy', col: '#d99a6c' },
  dining: { n: 'Jedlo von', e: 'plate', col: '#c77b5b' },
  fees: { n: 'Doprava a poplatky', e: 'package', col: '#a3a08f' },
  other: { n: 'Ostatné', e: 'basket', col: '#9c9a92' },
};
export const ROUTE = ['bakery', 'produce', 'meat_fish', 'deli_chilled', 'dairy_eggs', 'frozen', 'pantry', 'breakfast', 'snacks_sweets', 'beverages', 'alcohol', 'household_cleaning', 'personal_care', 'baby', 'health', 'other'];

// [id, názov, emoji, kategória, jednotka, predvolené množstvo, história [obchod, cena za jednotku, 'MM-DD'], synonymá, orientačná cena]
const P = [
  ['rozky', 'Rožky', 'baguette', 'bakery', 'ks', 6, [['lidl', .14, '09-09'], ['kraj', .10, '09-21']], 'rozok rozky rozkov'],
  ['kaiserka', 'Kaiserka', 'bagel', 'bakery', 'ks', 4, [['kaufland', .09, '09-29'], ['kraj', .14, '10-06'], ['lidl', .09, '10-15']], 'kaiserky zemla zemle zemlicky'],
  ['chlieb', 'Chlieb viaczrnný', 'bread', 'bakery', 'ks', 1, [['lidl', 1.49, '10-09']], 'chlieb chleba bochnik'],
  ['toast', 'Toastový chlieb', 'flour', 'bakery', 'ks', 1, [['lidl', 1.09, '10-05'], ['lidl', 1.09, '10-17']], 'toast toastovy'],
  ['bageta', 'Bageta', 'baguette', 'bakery', 'ks', 2, [['lidl', .89, '10-09'], ['lidl', .89, '10-17']], 'bagetu bagety'],
  ['siska', 'Šiška s náplňou', 'donut', 'bakery', 'ks', 4, [['lidl', .65, '09-21'], ['lidl', .39, '10-13'], ['lidl', .39, '10-15']], 'sisky donut donuty'],
  ['struhanka', 'Strúhanka', 'flour', 'pantry', 'bal', 1, [], 'struhanku', .79],

  ['banany', 'Banány', 'banana', 'produce', 'kg', 1, [['lidl', 1.59, '09-13'], ['kaufland', 1.19, '09-29'], ['lidl', 1.59, '10-07'], ['lidl', 1.59, '10-13'], ['lidl', 1.29, '10-15']], 'banan banany bananov'],
  ['jablka', 'Jablká', 'apple', 'produce', 'kg', 1, [['lidl', 2.69, '09-24'], ['lidl', 2.69, '10-07']], 'jablko jablka jabk'],
  ['avokado', 'Avokádo', 'avocado', 'produce', 'ks', 2, [['lidl', 1.39, '10-02'], ['lidl', .89, '10-13'], ['lidl', .99, '10-17']], 'avokada avokado'],
  ['cibula', 'Cibuľa', 'onion', 'produce', 'ks', 3, [], 'cibula cibule cibul cibuliek', .22],
  ['cesnak', 'Cesnak', 'garlic', 'produce', 'ks', 1, [], 'cesnaku cesnak strucik', .45],
  ['mrkva', 'Mrkva', 'carrot', 'produce', 'kg', .5, [['lidl', 1.39, '10-02'], ['lidl', 1.29, '10-17']], 'mrkvu mrkvy'],
  ['paprika', 'Paprika červená', 'pepper', 'produce', 'kg', .3, [['lidl', 3.79, '10-02'], ['lidl', 2.99, '10-09']], 'papriky papriku paprik'],
  ['paradajky', 'Cherry paradajky', 'tomato', 'produce', 'bal', 1, [['lidl', 2.49, '10-02'], ['lidl', 2.39, '10-13']], 'paradajky paradajok rajciny cherry'],
  ['sampinony', 'Šampiňóny', 'mushroom', 'produce', 'bal', 1, [['lidl', 1.79, '10-09'], ['lidl', 1.79, '10-17']], 'sampinony huby hrib'],
  ['citrony', 'Citróny', 'lemon', 'produce', 'kg', .3, [['lidl', 2.99, '10-02'], ['lidl', 2.49, '10-17']], 'citron citrony citronov'],
  ['salat', 'Ľadový šalát', 'leafy', 'produce', 'ks', 1, [['lidl', 1.29, '10-09'], ['lidl', 1.59, '10-17']], 'salat ladovy hlavkovy'],
  ['uhorka', 'Uhorka šalátová', 'cucumber', 'produce', 'ks', 1, [['lidl', .99, '10-17']], 'uhorka uhorky uhorku'],
  ['cuketa', 'Cuketa', 'cucumber', 'produce', 'kg', .5, [['lidl', 2.49, '10-02'], ['lidl', 1.29, '10-15']], 'cuketu cukety'],
  ['zemiaky', 'Zemiaky', 'potato', 'produce', 'kg', 2, [], 'zemiak zemiaky zemiakov krumple', .89],
  ['maliny', 'Maliny', 'strawberry', 'produce', 'bal', 1, [['lidl', 1.89, '10-13'], ['lidl', 1.89, '10-15']], 'maliny malin'],
  ['brokolica', 'Brokolica', 'broccoli', 'produce', 'ks', 1, [], 'brokolicu brokolica', 1.29],
  ['tekvica', 'Tekvica hokaido', 'sweetpotato', 'produce', 'kg', 1, [], 'tekvicu tekvica hokaido', 1.49],

  ['kuracie', 'Kuracie prsia', 'chicken', 'meat_fish', 'kg', .5, [['lidl', 7.49, '09-09'], ['lidl', 8.99, '10-02'], ['lidl', 4.99, '10-07'], ['lidl', 7.49, '10-09'], ['lidl', 7.49, '10-15'], ['lidl', 7.49, '10-17']], 'kuracie kuracich kurca kuraci prsia prsne rezne kura'],
  ['stehna', 'Kuracie stehná', 'poultry', 'meat_fish', 'kg', 1, [], 'stehna stehien stehno', 3.99],
  ['pliecko', 'Bravčové pliecko', 'meat', 'meat_fish', 'kg', .6, [], 'pliecko bravcove bravcoveho', 6.49],
  ['bok', 'Bravčový bok', 'bacon', 'meat_fish', 'kg', 1, [['metro', 5.99, '09-24'], ['metro', 5.69, '09-24']], 'bok boku'],
  ['mlete', 'Mleté mäso', 'meat', 'meat_fish', 'bal', 1, [['kaufland', 3.00, '09-29']], 'mlete mleteho mletym'],
  ['hovadzie', 'Hovädzie zadné', 'meatbone', 'meat_fish', 'kg', .8, [], 'hovadzie hovadzieho hovadzine', 12.9],
  ['rostenec', 'Hovädzí roštenec', 'meat', 'meat_fish', 'kg', .5, [], 'rostenec steak steaky', 24.9],
  ['losos', 'Losos filet', 'fish', 'meat_fish', 'kg', .4, [], 'losos lososa ryba ryby', 19.9],

  ['sunka', 'Šunka', 'sandwich', 'deli_chilled', 'ks', 2, [['lidl', 1.19, '10-09']], 'sunka sunku sunky'],
  ['parky', 'Párky', 'sausage', 'deli_chilled', 'ks', 1, [['lidl', 1.99, '10-13']], 'parky parkov'],
  ['chorizo', 'Chorizo', 'sausage', 'deli_chilled', 'ks', 1, [['lidl', 1.75, '10-13'], ['lidl', 1.75, '10-17']], 'chorizo'],
  ['camembert', 'Camembert', 'cheese2', 'deli_chilled', 'ks', 1, [['kaufland', .99, '09-29'], ['lidl', 1.45, '10-13'], ['lidl', 1.45, '10-17']], 'camembert hermelin'],
  ['eidam', 'Eidam strúhaný', 'cheese', 'deli_chilled', 'ks', 1, [['lidl', 1.59, '10-02'], ['lidl', 1.59, '10-09']], 'eidam syr syra syru'],
  ['bryndza', 'Bryndza', 'cheese', 'deli_chilled', 'ks', 1, [['lidl', 1.65, '10-13']], 'bryndzu bryndza'],
  ['feta', 'Feta syr', 'cheese2', 'deli_chilled', 'ks', 1, [['lidl', 2.99, '09-09']], 'feta fetu'],
  ['mozzarella', 'Mozzarella', 'cheese', 'deli_chilled', 'ks', 1, [['lidl', .99, '10-17']], 'mozzarellu mozarela'],
  ['parmezan', 'Parmezán', 'cheese2', 'deli_chilled', 'ks', 1, [], 'parmezan grana', 2.49],
  ['olivy', 'Olivy', 'olive', 'deli_chilled', 'bal', 1, [['kaufland', 1.99, '09-29']], 'olivy oliv'],

  ['mlieko', 'Mlieko polotučné', 'milk', 'dairy_eggs', 'l', 2, [], 'mlieko mlieka mliecko', .99],
  ['jogurt', 'Bio jogurt', 'bowl', 'dairy_eggs', 'ks', 4, [['lidl', .49, '10-05'], ['lidl', .49, '10-07'], ['lidl', .49, '10-09'], ['lidl', .49, '10-13'], ['lidl', .49, '10-15'], ['lidl', .49, '10-17']], 'jogurt jogurty jogurtov'],
  ['vajcia', 'Vajcia M · 10 ks', 'egg', 'dairy_eggs', 'bal', 1, [['lidl', 2.39, '10-09']], 'vajcia vajec vajicka vajce'],
  ['maslo', 'Maslo', 'butter', 'dairy_eggs', 'ks', 1, [], 'maslo masla', 2.19],
  ['smotana', 'Smotana na varenie', 'jar', 'dairy_eggs', 'ks', 1, [], 'smotana smotanu smotany', .89],
  ['kyslasmotana', 'Kyslá smotana', 'jar', 'dairy_eggs', 'ks', 1, [['lidl', .55, '10-13']], 'kysla kyslu'],
  ['tvaroh', 'Tvaroh', 'bowl', 'dairy_eggs', 'ks', 1, [], 'tvaroh tvarohu', .99],

  ['hranolky', 'Hranolky', 'fries', 'frozen', 'bal', 1, [['lidl', 1.69, '10-02']], 'hranolky hranoliek'],
  ['zmes', 'Polievková zmes', 'broccoli', 'frozen', 'bal', 1, [['lidl', 2.99, '10-09']], 'zmes zeleninova'],

  ['ryza', 'Ryža', 'rice', 'pantry', 'bal', 1, [['lidl', 1.69, '10-17']], 'ryza ryzu ryze'],
  ['cestoviny', 'Cestoviny penne', 'spaghetti', 'pantry', 'bal', 1, [], 'cestoviny penne spagety makarony', .99],
  ['pretlak', 'Paradajkový pretlak', 'canned', 'pantry', 'ks', 1, [['kaufland', 1.49, '09-29'], ['lidl', 1.19, '10-15']], 'pretlak pretlaku'],
  ['lupane', 'Lúpané paradajky', 'canned', 'pantry', 'ks', 1, [], 'lupane konzerva', .89],
  ['pesto', 'Pesto', 'jar', 'pantry', 'ks', 1, [['lidl', 1.39, '10-15']], 'pesto'],
  ['kecup', 'Kečup', 'canned', 'pantry', 'ks', 1, [['lidl', 2.49, '10-15']], 'kecup kecupu'],
  ['soja', 'Sójová omáčka', 'jar', 'pantry', 'ks', 1, [['lidl', 1.09, '10-17']], 'soja sojovka'],
  ['kukurica', 'Kukurica', 'corn', 'pantry', 'ks', 1, [['lidl', 1.09, '10-17']], 'kukuricu kukurica'],
  ['uhorkyk', 'Kyslé uhorky', 'jar', 'pantry', 'ks', 1, [['lidl', 1.05, '10-17']], 'kysle uhorky caly'],
  ['muka', 'Múka hladká', 'flour', 'pantry', 'bal', 1, [], 'muka muku', .69],
  ['cukor', 'Cukor', 'salt', 'pantry', 'bal', 1, [['lidl', .99, '10-15']], 'cukor cukru'],
  ['olej', 'Olej slnečnicový', 'olive', 'pantry', 'l', 1, [], 'olej oleja', 1.99],
  ['korenie', 'Čierne korenie', 'salt', 'pantry', 'ks', 1, [['lidl', .39, '10-05']], 'korenie'],
  ['paprikam', 'Mletá paprika', 'chili', 'pantry', 'ks', 1, [], 'mleta paprika', .79],
  ['kari', 'Kari korenie', 'chili', 'pantry', 'ks', 1, [], 'kari curry', .99],
  ['vyvar', 'Bujón', 'jar', 'pantry', 'ks', 1, [], 'bujon vyvar', .99],
  ['dzem', 'Džem', 'jar', 'pantry', 'ks', 1, [], 'dzem lekvar', 1.89],

  ['kava', 'Káva zrnková', 'coffee', 'breakfast', 'ks', 1, [['kraj', 12.99, '09-28']], 'kava kavu kavy'],
  ['caj', 'Čaj', 'tea', 'breakfast', 'ks', 1, [], 'caj caju', 1.49],
  ['med', 'Med', 'honey', 'breakfast', 'ks', 1, [], 'med medu', 4.49],

  ['horalky', 'Horalky', 'chocolate', 'snacks_sweets', 'ks', 3, [['lidl', .62, '10-09']], 'horalky horalku'],
  ['lupienky', 'Zemiakové lupienky', 'popcorn', 'snacks_sweets', 'ks', 1, [['tesco', 2.45, '10-10'], ['tesco', 1.72, '10-18']], 'lupienky cipsy chipsy'],
  ['praclik', 'Slané praclíky', 'pretzel', 'snacks_sweets', 'ks', 1, [['lidl', .95, '10-13'], ['lidl', .95, '10-17']], 'praclik pracliky'],
  ['cokolada', 'Čokoláda', 'chocolate', 'snacks_sweets', 'ks', 1, [], 'cokoladu cokolada', 1.29],

  ['kofola', 'Kofola 2 l', 'soda', 'beverages', 'ks', 1, [['lidl', 1.15, '10-17']], 'kofola kofolu'],
  ['voda', 'Minerálka', 'water', 'beverages', 'ks', 6, [['tesco', .87, '09-19'], ['lidl', .69, '10-17']], 'voda vodu mineralka mineralky'],
  ['dzus', 'Pomarančový džús', 'juice', 'beverages', 'l', 1, [], 'dzus dzusu', 1.49],
  ['nealko', 'Nealko pivo', 'beer', 'beverages', 'ks', 4, [['lidl', .89, '10-17']], 'nealko nealkoholicke'],

  ['pivo', 'Pivo 12°', 'beer', 'alcohol', 'ks', 6, [['lidl', .92, '10-05'], ['kraj', 1.39, '10-06'], ['lidl', .92, '10-17'], ['tesco', 1.29, '10-18'], ['kaufland', 1.15, '10-21']], 'pivo piva piv pivko dvanastka'],
  ['vino', 'Víno Tramín', 'wine', 'alcohol', 'ks', 1, [['lidl', 3.99, '10-09']], 'vino vina'],

  ['toaletak', 'Toaletný papier', 'toiletpaper', 'household_cleaning', 'bal', 1, [['lidl', 1.99, '10-05']], 'toaletny toaletak wc papier'],
  ['utierky', 'Kuchynské utierky', 'toiletpaper', 'household_cleaning', 'ks', 2, [['lidl', 1.25, '10-15']], 'utierky kuchynske'],
  ['praci', 'Prací prostriedok', 'bucket', 'household_cleaning', 'ks', 1, [['lidl', 8.99, '09-13'], ['lidl', 9.95, '10-09']], 'praci prasok gel'],
  ['riad', 'Prostriedok na riad', 'soap', 'household_cleaning', 'ks', 1, [['lidl', 1.39, '09-13']], 'jar na riad saponat'],
  ['tablety', 'Tablety do umývačky', 'sponge', 'household_cleaning', 'bal', 1, [['alza', 19.09, '09-17']], 'tablety umyvacka'],
  ['alobal', 'Alobal', 'package', 'household_cleaning', 'ks', 1, [['lidl', 1.45, '10-09']], 'alobal folia'],
  ['vrecia', 'Vrecia na odpad', 'bucket', 'household_cleaning', 'bal', 1, [], 'vrecia vrecka odpad', 1.29],

  ['pasta', 'Zubná pasta', 'toothbrush', 'personal_care', 'ks', 1, [['lidl', 1.89, '10-07'], ['lidl', 1.69, '10-15']], 'zubna pasta pastu'],
  ['mydlo', 'Tekuté mydlo', 'soap', 'personal_care', 'ks', 1, [['dm', .95, '09-16']], 'mydlo mydla'],
  ['deo', 'Dezodorant', 'lotion', 'personal_care', 'ks', 1, [['alza', 5.19, '10-05']], 'dezodorant deo'],
  ['telove', 'Telové mlieko', 'lotion', 'personal_care', 'ks', 1, [['lidl', 2.99, '10-09']], 'telove'],
  ['tampony', 'Kozmetické tampóny', 'lotion', 'personal_care', 'ks', 1, [['lidl', 1.95, '10-17']], 'tampony odlicovacie'],

  ['plienky', 'Plienky Mini', 'babybottle', 'baby', 'bal', 1, [['dm', 5.95, '09-16'], ['dm', 5.95, '09-29'], ['dm', 5.95, '10-15']], 'plienky plienok pampersky'],
  ['vlhcene', 'Vlhčené utierky', 'toiletpaper', 'baby', 'bal', 2, [['dm', 5.95, '09-16'], ['dm', 5.95, '10-15']], 'vlhcene obrusky'],
  ['prikrm', 'Detský príkrm', 'babybottle', 'baby', 'ks', 2, [['lidl', 1.89, '10-17']], 'prikrm prikrmy'],
  ['chrumky', 'Detské chrumky', 'cookie', 'baby', 'ks', 2, [['dm', 1.00, '10-15']], 'chrumky'],
  ['podlozky', 'Podložky na prebaľovanie', 'package', 'baby', 'bal', 1, [['dm', 2.95, '09-29'], ['dm', 2.95, '10-15']], 'podlozky'],
  ['probio', 'Probiotické kvapky', 'pill', 'health', 'ks', 1, [['drmax', 17.49, '10-05']], 'probiotika kvapky'],
  ['naplast', 'Náplasti', 'bandage', 'health', 'bal', 1, [['drmax', 1.09, '10-13']], 'naplast naplasti'],
];

// Katalóg produktov. Okrem skutočných produktov vie vrátiť aj „virtuálne“ položky, ktoré vznikajú podľa toho,
// čo človek napísal: všeobecná položka „g:pivo“ (priemer všetkých pív) a značka „b:pilsner-urquell“.
// Virtuálne sa nevracajú v Object.values (katalóg ostáva čistý), ale PRODUCTS['g:pivo'] funguje všade.
const _PRODUCTS = {};
let VIRTUAL = null;
export const setVirtual = (f) => { VIRTUAL = f; };
export const PRODUCTS = new Proxy(_PRODUCTS, { get(t, k) { if (typeof k === 'string' && !(k in t) && VIRTUAL && /^[gb]:/.test(k)) return VIRTUAL(k) || undefined; return t[k]; } });
for (const [id, n, e, c, u, dq, h, syn, approx] of P) {
  PRODUCTS[id] = { id, n, e, c, u, dq, h: h.map(([s, p, d]) => ({ s, p, d: '2026-' + d })), syn: syn || '', approx: approx || null };
}

// Najčastejšie kupované – dlaždice „istý nákup“ v doku.
export const STAPLES = ['banany', 'jogurt', 'rozky', 'mlieko', 'vajcia', 'maslo', 'chlieb', 'kofola', 'voda', 'eidam', 'sunka', 'jablka', 'pivo', 'toaletak', 'horalky', 'avokado'];

// Recepty. Suroviny: [produkt, spotreba v jednotke produktu, text v recepte]; home: true = bežne doma.
export const RECIPES = [
  { id: 'gulas', n: 'Hovädzí guláš', pic: 'gulas_p', e: 'pot', bg: 'peach', min: 120, kcal: 610, por: 4, src: 'varecha.sk', diff: 'stredne náročné', tags: ['klasika'],
    ing: [['hovadzie', .8, '800 g'], ['cibula', 3, '3 ks'], ['paprika', .2, '1 ks'], ['cesnak', 1, '3 strúčiky'], ['pretlak', 1, '2 lyžice'], ['paprikam', .3, '2 lyžice', 1], ['olej', .05, '3 lyžice', 1], ['korenie', .1, 'podľa chuti', 1]],
    steps: [['Cibuľu nakrájaj nadrobno a na oleji pomaly opeč do zlatista.', 15], ['Pridaj mäso nakrájané na kocky a opeč ho zo všetkých strán.', 8], ['Primiešaj mletú papriku, pretlak a prelisovaný cesnak. Podlej litrom vody.', 0], ['Dus pod pokrievkou, kým mäso nezmäkne. Občas premiešaj a podlej.', 90], ['Pridaj papriku nakrájanú na rezance a var ešte 15 minút.', 15], ['Dochuť soľou a korením. Podávaj s chlebom alebo knedľou.', 0]] },
  { id: 'rizoto', n: 'Kuracie rizoto', pic: 'rizoto_p', e: 'rice', bg: 'butter', min: 35, kcal: 520, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['rýchle'],
    ing: [['kuracie', .5, '500 g'], ['ryza', .6, '300 g'], ['cibula', 1, '1 ks'], ['sampinony', 1, '250 g'], ['parmezan', .5, '50 g'], ['maslo', .2, '1 lyžica', 1], ['vyvar', .3, '1 l vývaru', 1]],
    steps: [['Mäso nakrájaj na kocky, osoľ a opeč. Odlož bokom.', 6], ['Na masle speň cibuľu, pridaj šampiňóny a ryžu.', 5], ['Postupne prilievaj horúci vývar a miešaj, kým ryža nezmäkne.', 18], ['Vmiešaj mäso a strúhaný parmezán, nechaj 2 minúty odstáť.', 2]] },
  { id: 'palacinky', n: 'Palacinky', pic: 'palacinky_p', e: 'pancakes', bg: 'rose', min: 30, kcal: 380, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['sladké', 'pre deti'],
    ing: [['muka', .25, '250 g'], ['mlieko', .5, '500 ml'], ['vajcia', .2, '2 ks'], ['cukor', .05, '1 lyžica', 1], ['olej', .05, 'na panvicu', 1], ['dzem', 1, 'na plnenie']],
    steps: [['Vymiešaj mlieko, vajcia, múku, cukor a štipku soli na hladké cesto.', 3], ['Nechaj cesto 10 minút odpočívať.', 10], ['Na rozpálenej panvici s kvapkou oleja peč tenké palacinky z oboch strán.', 15], ['Natri džemom, zroluj a podávaj.', 0]] },
  { id: 'stehna', n: 'Pečené stehná so zemiakmi', pic: 'stehna_p', e: 'poultry', bg: 'peach', min: 70, kcal: 690, por: 4, src: 'recepty.sk', diff: 'jednoduché', tags: ['klasika'],
    ing: [['stehna', 1.2, '4 ks'], ['zemiaky', 1, '1 kg'], ['cesnak', 1, '4 strúčiky'], ['paprikam', .2, '1 lyžica', 1], ['olej', .05, '3 lyžice', 1]],
    steps: [['Stehná osoľ, potri cesnakom, olejom a mletou paprikou.', 5], ['Zemiaky nakrájaj na mesiačiky a rozlož okolo mäsa.', 5], ['Peč pri 200 °C, v polovici stehná obráť.', 55]] },
  { id: 'kari', n: 'Kuracie na kari', pic: 'kari_p', e: 'curry', bg: 'butter', min: 40, kcal: 560, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['rýchle'],
    ing: [['kuracie', .6, '600 g'], ['ryza', .5, '250 g'], ['cibula', 1, '1 ks'], ['smotana', 1, '200 ml'], ['kari', .3, '2 lyžice'], ['olej', .03, '2 lyžice', 1]],
    steps: [['Cibuľu opeč na oleji, pridaj kari a krátko orestuj.', 4], ['Pridaj mäso na kocky a opeč dozlatista.', 8], ['Zalej smotanou a 10 minút podus.', 10], ['Medzitým uvar ryžu a podávaj spolu.', 15]] },
  { id: 'salat', n: 'Šalát s fetou', pic: 'salat_p', e: 'salad', bg: 'sage', min: 15, kcal: 320, por: 2, src: 'recepty.sk', diff: 'veľmi jednoduché', tags: ['rýchle', 'bez mäsa'],
    ing: [['salat', 1, '1 hlávka'], ['paradajky', 1, '250 g'], ['uhorka', 1, '1 ks'], ['feta', 1, '200 g'], ['olivy', 1, 'hrsť'], ['olej', .03, '2 lyžice', 1]],
    steps: [['Zeleninu umy a nakrájaj na väčšie kúsky.', 8], ['Pridaj olivy a nadrobenú fetu.', 2], ['Zakvapkaj olejom, osoľ a premiešaj.', 0]] },
  { id: 'penne', n: 'Penne all\'arrabbiata', pic: 'penne_p', e: 'spaghetti', bg: 'rose', min: 20, kcal: 450, por: 4, src: 'recepty.sk', diff: 'jednoduché', tags: ['rýchle', 'bez mäsa'],
    ing: [['cestoviny', 1, '500 g'], ['lupane', 1, '1 plechovka'], ['cesnak', 1, '3 strúčiky'], ['paprikam', .1, 'štipka čili', 1], ['parmezan', .5, 'na posypanie'], ['olej', .03, '2 lyžice', 1]],
    steps: [['Cestoviny uvar v osolenej vode do al dente.', 10], ['Na oleji krátko opeč cesnak a čili, pridaj paradajky a 8 minút podus.', 8], ['Zmiešaj s cestovinami a posyp parmezánom.', 0]] },
  { id: 'losos', n: 'Losos s citrónom', pic: 'losos_p', e: 'fish', bg: 'sky', min: 25, kcal: 540, por: 2, src: 'recepty.sk', diff: 'jednoduché', tags: ['rýchle'],
    ing: [['losos', .4, '2 filety'], ['citrony', .15, '1 ks'], ['zemiaky', .6, '600 g'], ['maslo', .2, '1 lyžica', 1]],
    steps: [['Zemiaky uvar v šupke domäkka.', 20], ['Losos osoľ a opeč na masle 4 minúty z každej strany.', 8], ['Pokvapkaj citrónom a podávaj so zemiakmi.', 0]] },
  { id: 'paradajkova', n: 'Paradajková polievka', pic: 'p_paradajkova', e: 'tomato', bg: 'rose', min: 30, kcal: 260, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['polievky', 'bez mäsa'],
    ing: [['lupane', 2, '2 plechovky'], ['cibula', 1, '1 ks'], ['cesnak', 1, '2 strúčiky'], ['smotana', 1, '200 ml'], ['olej', .02, '1 lyžica', 1]],
    steps: [['Na oleji opeč cibuľu a cesnak.', 5], ['Pridaj paradajky a 0,5 l vody, var 15 minút.', 15], ['Rozmixuj, vmiešaj smotanu a dochuť.', 3]] },
  { id: 'gulasova', n: 'Gulášová polievka', pic: 'p_gulasova', e: 'stew', bg: 'peach', min: 90, kcal: 430, por: 6, src: 'varecha.sk', diff: 'stredne náročné', tags: ['polievky', 'klasika'],
    ing: [['hovadzie', .4, '400 g'], ['zemiaky', .5, '500 g'], ['cibula', 2, '2 ks'], ['paprikam', .2, '1 lyžica', 1], ['pretlak', 1, '1 lyžica']],
    steps: [['Cibuľu opeč, pridaj mäso na kocky a papriku.', 10], ['Zalej 1,5 l vody a var, kým mäso nezmäkne.', 60], ['Pridaj zemiaky na kocky a var ďalších 20 minút.', 20]] },
  { id: 'strips', n: 'Kuracie stripsy', pic: 'p_strips', e: 'poultry', bg: 'butter', min: 30, kcal: 580, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['pre deti'],
    ing: [['kuracie', .6, '600 g'], ['vajcia', .2, '2 ks'], ['muka', .1, '100 g'], ['struhanka', 1, '150 g'], ['olej', .3, 'na vyprážanie', 1]],
    steps: [['Mäso nakrájaj na pásiky a osoľ.', 5], ['Obaľ v múke, vajci a strúhanke.', 8], ['Vyprážaj v rozpálenom oleji dozlatista.', 12]] },
  { id: 'tekvicova', n: 'Tekvicová polievka', pic: 'p_tekvicova', e: 'sweetpotato', bg: 'butter', min: 35, kcal: 290, por: 4, src: 'recepty.sk', diff: 'jednoduché', tags: ['polievky', 'bez mäsa'],
    ing: [['tekvica', 1, '1 kg'], ['cibula', 1, '1 ks'], ['smotana', 1, '200 ml'], ['vyvar', .3, '1 l vývaru', 1]],
    steps: [['Tekvicu a cibuľu nakrájaj a krátko opeč.', 6], ['Zalej vývarom a var 20 minút.', 20], ['Rozmixuj so smotanou a dochuť.', 3]] },
  { id: 'steak', n: 'Steak so zemiakmi', pic: 'p_steak', e: 'meat', bg: 'peach', min: 40, kcal: 720, por: 2, src: 'Vlastný recept', diff: 'stredne náročné', tags: ['na víkend'],
    ing: [['rostenec', .5, '2 steaky'], ['zemiaky', .6, '600 g'], ['maslo', .3, '2 lyžice', 1], ['cesnak', 1, '2 strúčiky']],
    steps: [['Steaky nechaj 30 minút zohriať na izbovú teplotu, zemiaky upeč.', 30], ['Steaky opeč na rozpálenej panvici 3 minúty z každej strany.', 6], ['Pridaj maslo a cesnak, polievaj a nechaj 5 minút odpočinúť.', 5]] },
  { id: 'zeleninova', n: 'Zeleninová polievka', pic: 'p_zeleninova', e: 'carrot', bg: 'sage', min: 40, kcal: 210, por: 6, src: 'Vlastný recept', diff: 'veľmi jednoduché', tags: ['polievky', 'bez mäsa'],
    ing: [['mrkva', .3, '2 ks'], ['zemiaky', .4, '400 g'], ['brokolica', 1, '1 ks'], ['zmes', 1, '1 balenie'], ['cibula', 1, '1 ks']],
    steps: [['Zeleninu nakrájaj na kúsky.', 10], ['Var v 1,5 l osolenej vody 25 minút.', 25], ['Dochuť a podávaj s pečivom.', 0]] },
  { id: 'toasty', n: 'Francúzske toasty', pic: 'p_toasty', e: 'bread', bg: 'butter', min: 15, kcal: 410, por: 2, src: 'Vlastný recept', diff: 'veľmi jednoduché', tags: ['raňajky', 'sladké'],
    ing: [['toast', .5, '6 plátkov'], ['vajcia', .2, '2 ks'], ['mlieko', .1, '100 ml'], ['banany', .3, '2 ks'], ['med', .1, 'na polievanie']],
    steps: [['Vajcia rozšľahaj s mliekom.', 2], ['Plátky toastu namoč a opeč na masle dozlatista.', 8], ['Podávaj s banánom a medom.', 0]] },
  { id: 'grilprsia', n: 'Grilované kuracie prsia', pic: 'prsia', e: 'chicken', bg: 'sage', min: 25, kcal: 390, por: 2, src: 'recepty.sk', diff: 'jednoduché', tags: ['rýchle', 'fit'],
    ing: [['kuracie', .4, '400 g'], ['citrony', .1, '½ ks'], ['cesnak', 1, '1 strúčik'], ['salat', 1, 'na prílohu'], ['olej', .02, '1 lyžica', 1]],
    steps: [['Prsia naklep, potri olejom, cesnakom a citrónom.', 5], ['Griluj 5 minút z každej strany.', 10], ['Podávaj so šalátom.', 0]] },
];

// Čo je doma (pre filter „Z toho, čo mám“ a odpočet surovín).
export const PANTRY = ['olej', 'korenie', 'paprikam', 'cukor', 'muka', 'cesnak', 'ryza', 'cestoviny', 'vyvar', 'maslo', 'zemiaky', 'cibula', 'pretlak', 'kari', 'med', 'dzem'];

// ---------- kniha receptov: ďalšie suroviny, recepty a kategórie ----------
const P2 = [
  ['kapusta', 'Kyslá kapusta', 'cabbage', 'pantry', 'bal', 1, [], 'kapusta kapustu kysla', 1.29],
  ['klobasa', 'Klobása', 'sausage', 'deli_chilled', 'ks', 1, [], 'klobasa klobasu', 2.49],
  ['fazula', 'Fazuľa červená', 'beans', 'pantry', 'ks', 1, [], 'fazula fazulu', .99],
  ['sosovica', 'Šošovica', 'beans', 'pantry', 'bal', 1, [], 'sosovica sosovicu', 1.49],
  ['tuniak', 'Tuniak v konzerve', 'fish', 'pantry', 'ks', 1, [], 'tuniak tuniaka', 1.79],
  ['rybieprsty', 'Rybie prsty', 'fish', 'frozen', 'bal', 1, [], 'rybie prsty', 2.49],
  ['vlocky', 'Ovsené vločky', 'bowl', 'breakfast', 'bal', 1, [], 'vlocky ovsene', .89],
  ['krevety', 'Krevety', 'shrimp', 'frozen', 'bal', 1, [['metro', 10.23, '09-10']], 'krevety kreviet'],
  ['rebra', 'Bravčové rebierka', 'meatbone', 'meat_fish', 'kg', 1, [], 'rebierka rebra', 5.99],
  ['kura', 'Celé kura', 'poultry', 'meat_fish', 'kg', 1.5, [], 'kura kurca cele', 3.49],
  ['syrvyp', 'Syr na vyprážanie', 'cheese2', 'deli_chilled', 'ks', 1, [], 'syr na vyprazanie', 2.29],
];
for (const [id, n, e, c, u, dq, h, syn, approx] of P2) PRODUCTS[id] = { id, n, e, c, u, dq, h: h.map(([s, p, d]) => ({ s, p, d: '2026-' + d })), syn: syn || '', approx: approx || null };

const R2 = [
  ['kapustnica', 'Kapustnica', 'polievky', null, 'stew', 'peach', 90, 380, 6, 'varecha.sk', [['kapusta', 1, '500 g'], ['klobasa', 1, '1 ks'], ['sampinony', 1, 'hrsť'], ['paprikam', .1, '1 lyžica', 1], ['cibula', 1, '1 ks']], ['Kapustu prepláchni a var v 1,5 l vody 30 minút.', 30], ['Pridaj klobásu, huby a na cibuľke opraženú papriku.', 40], ['Dochuť a podávaj s chlebom.', 0]],
  ['sosovicova', 'Šošovicová polievka', 'polievky', null, 'beans', 'butter', 45, 320, 4, 'Vlastný recept', [['sosovica', 1, '250 g'], ['mrkva', .2, '2 ks'], ['cibula', 1, '1 ks'], ['zemiaky', .3, '2 ks'], ['vyvar', .3, '1 l', 1]], ['Cibuľu a mrkvu opeč, pridaj šošovicu.', 6], ['Zalej vývarom, pridaj zemiaky a var 30 minút.', 30], ['Dochuť octom a soľou.', 0]],
  ['cesnacka', 'Cesnačka', 'polievky', null, 'garlic', 'butter', 25, 240, 4, 'recepty.sk', [['cesnak', 1, '1 hlavička'], ['zemiaky', .4, '3 ks'], ['eidam', 1, '100 g'], ['chlieb', 1, 'na krutóny']], ['Zemiaky uvar v osolenej vode s rascou.', 15], ['Pridaj prelisovaný cesnak, povar 2 minúty.', 2], ['Podávaj so syrom a opečeným chlebom.', 0]],
  ['rebierka', 'Pečené rebierka', 'maso', 'x_rebra', 'meatbone', 'peach', 150, 820, 4, 'varecha.sk', [['rebra', 1.5, '1,5 kg'], ['med', .2, '2 lyžice'], ['cesnak', 1, '4 strúčiky'], ['kecup', 1, '3 lyžice']], ['Rebierka potri marinádou z medu, cesnaku a kečupu.', 10], ['Peč prikryté pri 160 °C dve hodiny.', 120], ['Odkry a dopeč dochrumkava.', 20]],
  ['spizy', 'Bravčové špízy', 'maso', 'x_spizy', 'meat', 'peach', 40, 560, 4, 'Vlastný recept', [['pliecko', .6, '600 g'], ['paprika', .3, '2 ks'], ['cibula', 2, '2 ks'], ['bok', .2, '200 g slaniny']], ['Mäso a zeleninu nakrájaj na kocky a napichaj na špajle.', 15], ['Griluj 12 minút, občas otoč.', 12], ['Podávaj s chlebom a horčicou.', 0]],
  ['segedin', 'Segedínsky guláš', 'maso', null, 'pot', 'peach', 90, 640, 4, 'varecha.sk', [['pliecko', .6, '600 g'], ['kapusta', 1, '500 g'], ['smotana', 1, '200 ml'], ['cibula', 2, '2 ks'], ['paprikam', .2, '1 lyžica', 1]], ['Cibuľu opeč, pridaj mäso a papriku, podus 40 minút.', 40], ['Pridaj prepláchnutú kapustu a var do mäkka.', 30], ['Zjemni smotanou zmiešanou s trochou múky.', 5]],
  ['karbonatky', 'Mleté karbonátky', 'maso', null, 'meat', 'butter', 35, 590, 4, 'Vlastný recept', [['mlete', 1, '500 g'], ['vajcia', .1, '1 ks'], ['struhanka', 1, 'na obalenie'], ['zemiaky', .8, 'na pyré']], ['Mäso zmiešaj s vajcom, soľou a cesnakom.', 5], ['Tvaruj placky, obaľ v strúhanke a opeč.', 15], ['Podávaj so zemiakovým pyré.', 0]],
  ['kura', 'Pečené kura', 'hydina', 'x_kura', 'poultry', 'peach', 90, 610, 4, 'recepty.sk', [['kura', 1.5, '1 kura'], ['citrony', .1, '1 ks'], ['cesnak', 1, '5 strúčikov'], ['maslo', .3, '2 lyžice', 1]], ['Kura natri maslom s cesnakom, do brucha daj citrón.', 10], ['Peč pri 190 °C asi 80 minút, polievaj výpekom.', 80], ['Nechaj 10 minút odpočinúť a nakrájaj.', 10]],
  ['kurwok', 'Kuracie s ryžou a zeleninou', 'hydina', 'x_kurwok', 'pan', 'sage', 25, 520, 4, 'recepty.sk', [['kuracie', .5, '500 g'], ['ryza', .5, '250 g'], ['paprika', .3, '2 ks'], ['soja', 1, '3 lyžice'], ['mrkva', .2, '1 ks']], ['Uvar ryžu.', 15], ['Na rozpálenej panvici opeč mäso, pridaj zeleninu.', 8], ['Zalej sójovou omáčkou a premiešaj s ryžou.', 2]],
  ['naprike', 'Kuracie na paprike', 'hydina', null, 'poultry', 'rose', 50, 580, 4, 'varecha.sk', [['stehna', 1, '1 kg'], ['cibula', 2, '2 ks'], ['smotana', 1, '250 ml'], ['paprikam', .3, '2 lyžice', 1], ['cestoviny', 1, 'halušky alebo cestoviny']], ['Cibuľu opeč, pridaj papriku a mäso.', 10], ['Podlej vodou a dus 35 minút.', 35], ['Zjemni smotanou, podávaj s haluškami.', 5]],
  ['hubrizoto', 'Hubové rizoto', 'cestoviny', 'x_rizoto', 'rice', 'butter', 35, 480, 4, 'recepty.sk', [['ryza', .6, '300 g'], ['sampinony', 2, '500 g'], ['parmezan', .5, '50 g'], ['cibula', 1, '1 ks'], ['vyvar', .3, '1 l', 1]], ['Na masle speň cibuľu a huby.', 8], ['Pridaj ryžu a postupne prilievaj vývar.', 20], ['Vmiešaj parmezán a kúsok masla.', 2]],
  ['krevety', 'Špagety s krevetami', 'cestoviny', 'x_krevety', 'shrimp', 'rose', 25, 560, 4, 'varecha.sk', [['cestoviny', 1, '400 g'], ['krevety', 1, '300 g'], ['paradajky', 1, '250 g'], ['cesnak', 1, '3 strúčiky'], ['olej', .03, '3 lyžice', 1]], ['Uvar cestoviny al dente.', 10], ['Na oleji opeč cesnak, krevety a paradajky.', 6], ['Zmiešaj s cestovinami a posyp petržlenovou vňaťou.', 0]],
  ['cestsalat', 'Cestovinový šalát', 'cestoviny', 'x_cestsalat', 'salad', 'sage', 20, 420, 4, 'Vlastný recept', [['cestoviny', 1, '300 g'], ['paradajky', 1, '250 g'], ['mozzarella', 1, '125 g'], ['pesto', 1, '3 lyžice']], ['Cestoviny uvar a nechaj vychladnúť.', 12], ['Zmiešaj s paradajkami, mozzarellou a pestom.', 5]],
  ['halusky', 'Bryndzové halušky', 'cestoviny', null, 'bowl', 'sage', 40, 640, 4, 'varecha.sk', [['zemiaky', 1, '1 kg'], ['muka', .3, '300 g'], ['bryndza', 2, '250 g'], ['bok', .15, '150 g slaniny']], ['Zemiaky nastrúhaj a zmiešaj s múkou a soľou.', 10], ['Cesto pretláčaj do vriacej vody, var 3 minúty.', 15], ['Zmiešaj s bryndzou a posyp opečenou slaninou.', 8]],
  ['pizza', 'Domáca pizza', 'cestoviny', 'x_pizza', 'pizza', 'rose', 45, 720, 4, 'Vlastný recept', [['muka', .5, '500 g'], ['lupane', 1, '1 plechovka'], ['mozzarella', 2, '250 g'], ['sunka', 2, '200 g'], ['olej', .03, '2 lyžice', 1]], ['Vymiešaj cesto z múky, vody, droždia a oleja, nechaj 30 minút kysnúť.', 30], ['Rozvaľkaj, natri paradajkami, oblož šunkou a syrom.', 8], ['Peč pri 250 °C 10 minút.', 10]],
  ['rybieprsty', 'Rybie prsty s pyré', 'ryby', null, 'fish', 'sky', 25, 480, 4, 'Vlastný recept', [['rybieprsty', 1, '1 balenie'], ['zemiaky', .8, '800 g'], ['mlieko', .2, '200 ml'], ['maslo', .2, 'lyžica', 1]], ['Zemiaky uvar a rozšľahaj s mliekom a maslom.', 20], ['Rybie prsty upeč v rúre podľa návodu.', 15], ['Podávaj s citrónom.', 0]],
  ['tuniak', 'Tuniakový šalát', 'ryby', null, 'salad', 'sky', 15, 380, 2, 'recepty.sk', [['tuniak', 1, '1 konzerva'], ['kukurica', 1, '1 konzerva'], ['salat', 1, '1 hlávka'], ['vajcia', .2, '2 ks']], ['Vajcia uvar natvrdo.', 10], ['Zmiešaj šalát, tuniak, kukuricu a vajcia, zakvapkaj olejom.', 5]],
  ['syr', 'Vyprážaný syr', 'bezmasa', null, 'cheese2', 'butter', 25, 690, 4, 'Vlastný recept', [['syrvyp', 2, '4 plátky'], ['vajcia', .2, '2 ks'], ['muka', .1, 'na obalenie'], ['struhanka', 1, 'na obalenie'], ['hranolky', 1, 'príloha']], ['Syr obaľ v múke, vajci a strúhanke – dvakrát.', 8], ['Vyprážaj v horúcom oleji dozlatista.', 6], ['Podávaj s hranolkami a tatárskou omáčkou.', 0]],
  ['placky', 'Zemiakové placky', 'bezmasa', null, 'potato', 'butter', 35, 450, 4, 'varecha.sk', [['zemiaky', 1, '1 kg'], ['vajcia', .1, '1 ks'], ['muka', .1, '3 lyžice'], ['cesnak', 1, '3 strúčiky']], ['Zemiaky nastrúhaj a vytlač z nich vodu.', 10], ['Zmiešaj s vajcom, múkou, cesnakom a majoránom.', 5], ['Vyprážaj tenké placky z oboch strán.', 20]],
  ['hrianka', 'Vajíčková hrianka', 'sladke', 'x_hrianka', 'egg2', 'butter', 10, 340, 2, 'Vlastný recept', [['chlieb', 1, '2 krajce'], ['vajcia', .2, '2 ks'], ['avokado', 1, '1 ks']], ['Chlieb opeč.', 3], ['Na panvici urob volské oká.', 4], ['Na hrianku daj avokádo a vajce, osoľ a okoreň.', 0]],
  ['lievance', 'Lievance', 'sladke', null, 'pancakes', 'rose', 30, 410, 4, 'varecha.sk', [['muka', .3, '300 g'], ['mlieko', .4, '400 ml'], ['vajcia', .2, '2 ks'], ['dzem', 1, 'na podávanie']], ['Vymiešaj cesto s kypriacim práškom.', 5], ['Na panvici peč malé lievance z oboch strán.', 20], ['Podávaj s džemom alebo medom.', 0]],
  ['kasa', 'Ovsená kaša', 'sladke', null, 'bowl', 'sky', 10, 300, 2, 'Vlastný recept', [['vlocky', .2, '100 g'], ['mlieko', .4, '400 ml'], ['banany', .2, '1 ks'], ['med', .1, 'lyžica']], ['Vločky var v mlieku 5 minút.', 5], ['Ozdob banánom a medom.', 0]],
];
const CATMAP = { gulas: 'maso', steak: 'maso', rizoto: 'cestoviny', palacinky: 'sladke', stehna: 'hydina', kari: 'hydina', salat: 'bezmasa', penne: 'cestoviny', losos: 'ryby', paradajkova: 'polievky', gulasova: 'polievky', strips: 'hydina', tekvicova: 'polievky', zeleninova: 'polievky', toasty: 'sladke', grilprsia: 'hydina' };
for (const r of RECIPES) r.cat = CATMAP[r.id];
for (const [id, n, cat, pic, e, bg, min, kcal, por, src, ing, ...steps] of R2) RECIPES.push({ id, n, cat, pic, e, bg, min, kcal, por, src, diff: '', tags: [], ing, steps });
for (const id of ['palacinky', 'strips', 'rybieprsty', 'karbonatky', 'lievance', 'kasa', 'pizza', 'syr']) { const r = RECIPES.find((x) => x.id === id); if (r && !r.tags.includes('pre deti')) r.tags.push('pre deti'); }

export const RCATS = [
  { id: 'polievky', n: 'Polievky', e: 'stew', pic: 'p_zeleninova' },
  { id: 'maso', n: 'Mäso', e: 'meat', pic: 'gulas_p' },
  { id: 'hydina', n: 'Kuracie a hydina', e: 'poultry', pic: 'stehna_p' },
  { id: 'cestoviny', n: 'Cestoviny, ryža a pizza', e: 'spaghetti', pic: 'penne_p' },
  { id: 'ryby', n: 'Ryby', e: 'fish', pic: 'losos_p' },
  { id: 'bezmasa', n: 'Bez mäsa a šaláty', e: 'salad', pic: 'salat_p' },
  { id: 'sladke', n: 'Raňajky a sladké', e: 'pancakes', pic: 'palacinky_p' },
  { id: 'all', n: 'Všetky recepty', e: 'books', pic: 'x_pizza' },
];
export const RCOLS = [
  { id: 'rychle', n: 'Do 30 minút', e: 'timer', test: (r) => r.min <= 30 },
  { id: 'deti', n: 'Pre deti', e: 'teddy', test: (r) => r.tags.includes('pre deti') },
  { id: 'lacne', n: 'Lacné jedlá', e: 'coin', test: null },
];
export const RSOURCES = ['varecha.sk', 'recepty.sk', 'Vlastný recept', 'AI návrh'];
