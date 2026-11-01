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

export const PRODUCTS = {};
for (const [id, n, e, c, u, dq, h, syn, approx] of P) {
  PRODUCTS[id] = { id, n, e, c, u, dq, h: h.map(([s, p, d]) => ({ s, p, d: '2026-' + d })), syn: syn || '', approx: approx || null };
}

// Najčastejšie kupované – dlaždice „istý nákup“ v doku.
export const STAPLES = ['banany', 'jogurt', 'rozky', 'mlieko', 'vajcia', 'maslo', 'chlieb', 'kofola', 'voda', 'eidam', 'sunka', 'jablka', 'pivo', 'toaletak', 'horalky', 'avokado'];

// Recepty. Suroviny: [produkt, spotreba v jednotke produktu, text v recepte]; home: true = bežne doma.
export const RECIPES = [
  { id: 'gulas', n: 'Hovädzí guláš', pic: 'gulas_p', e: 'pot', bg: 'peach', min: 120, kcal: 610, por: 4, src: 'varecha.sk', diff: 'stredne náročné', tags: ['klasika'],
    ing: [['hovadzie', .8, '800 g'], ['cibula', 3, '3 ks'], ['paprika', .2, '1 ks'], ['cesnak', 1, '3 strúčiky'], ['pretlak', 1, '2 lyžice'], ['paprikam', .3, '2 lyžice', 1], ['olej', .05, '3 lyžice', 1], ['korenie', .1, 'podľa chuti', 1]],
    steps: [['Cibuľu nakrájajte nadrobno a na oleji pomaly opečte do zlatista.', 15], ['Pridajte mäso nakrájané na kocky a opečte ho zo všetkých strán.', 8], ['Primiešajte mletú papriku, pretlak a prelisovaný cesnak. Podlejte litrom vody.', 0], ['Duste pod pokrievkou, kým mäso nezmäkne. Občas premiešajte a podlejte.', 90], ['Pridajte papriku nakrájanú na rezance a varte ešte 15 minút.', 15], ['Dochuťte soľou a korením. Podávajte s chlebom alebo knedľou.', 0]] },
  { id: 'rizoto', n: 'Kuracie rizoto', pic: 'rizoto_p', e: 'rice', bg: 'butter', min: 35, kcal: 520, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['rýchle'],
    ing: [['kuracie', .5, '500 g'], ['ryza', .6, '300 g'], ['cibula', 1, '1 ks'], ['sampinony', 1, '250 g'], ['parmezan', .5, '50 g'], ['maslo', .2, '1 lyžica', 1], ['vyvar', .3, '1 l vývaru', 1]],
    steps: [['Mäso nakrájajte na kocky, osoľte a opečte. Odložte bokom.', 6], ['Na masle speňte cibuľu, pridajte šampiňóny a ryžu.', 5], ['Postupne prilievajte horúci vývar a miešajte, kým ryža nezmäkne.', 18], ['Vmiešajte mäso a strúhaný parmezán, nechajte 2 minúty odstáť.', 2]] },
  { id: 'palacinky', n: 'Palacinky', pic: 'palacinky_p', e: 'pancakes', bg: 'rose', min: 30, kcal: 380, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['sladké', 'pre deti'],
    ing: [['muka', .25, '250 g'], ['mlieko', .5, '500 ml'], ['vajcia', .2, '2 ks'], ['cukor', .05, '1 lyžica', 1], ['olej', .05, 'na panvicu', 1], ['dzem', 1, 'na plnenie']],
    steps: [['Vymiešajte mlieko, vajcia, múku, cukor a štipku soli na hladké cesto.', 3], ['Nechajte cesto 10 minút odpočívať.', 10], ['Na rozpálenej panvici s kvapkou oleja pečte tenké palacinky z oboch strán.', 15], ['Natrite džemom, zrolujte a podávajte.', 0]] },
  { id: 'stehna', n: 'Pečené stehná so zemiakmi', pic: 'stehna_p', e: 'poultry', bg: 'peach', min: 70, kcal: 690, por: 4, src: 'recepty.sk', diff: 'jednoduché', tags: ['klasika'],
    ing: [['stehna', 1.2, '4 ks'], ['zemiaky', 1, '1 kg'], ['cesnak', 1, '4 strúčiky'], ['paprikam', .2, '1 lyžica', 1], ['olej', .05, '3 lyžice', 1]],
    steps: [['Stehná osoľte, potrite cesnakom, olejom a mletou paprikou.', 5], ['Zemiaky nakrájajte na mesiačiky a rozložte okolo mäsa.', 5], ['Pečte pri 200 °C, v polovici stehná obráťte.', 55]] },
  { id: 'kari', n: 'Kuracie na kari', pic: 'kari_p', e: 'curry', bg: 'butter', min: 40, kcal: 560, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['rýchle'],
    ing: [['kuracie', .6, '600 g'], ['ryza', .5, '250 g'], ['cibula', 1, '1 ks'], ['smotana', 1, '200 ml'], ['kari', .3, '2 lyžice'], ['olej', .03, '2 lyžice', 1]],
    steps: [['Cibuľu opečte na oleji, pridajte kari a krátko orestujte.', 4], ['Pridajte mäso na kocky a opečte dozlatista.', 8], ['Zalejte smotanou a 10 minút poduste.', 10], ['Medzitým uvarte ryžu a podávajte spolu.', 15]] },
  { id: 'salat', n: 'Šalát s fetou', pic: 'salat_p', e: 'salad', bg: 'sage', min: 15, kcal: 320, por: 2, src: 'recepty.sk', diff: 'veľmi jednoduché', tags: ['rýchle', 'bez mäsa'],
    ing: [['salat', 1, '1 hlávka'], ['paradajky', 1, '250 g'], ['uhorka', 1, '1 ks'], ['feta', 1, '200 g'], ['olivy', 1, 'hrsť'], ['olej', .03, '2 lyžice', 1]],
    steps: [['Zeleninu umyte a nakrájajte na väčšie kúsky.', 8], ['Pridajte olivy a nadrobenú fetu.', 2], ['Zakvapkajte olejom, osoľte a premiešajte.', 0]] },
  { id: 'penne', n: 'Penne all\'arrabbiata', pic: 'penne_p', e: 'spaghetti', bg: 'rose', min: 20, kcal: 450, por: 4, src: 'recepty.sk', diff: 'jednoduché', tags: ['rýchle', 'bez mäsa'],
    ing: [['cestoviny', 1, '500 g'], ['lupane', 1, '1 plechovka'], ['cesnak', 1, '3 strúčiky'], ['paprikam', .1, 'štipka čili', 1], ['parmezan', .5, 'na posypanie'], ['olej', .03, '2 lyžice', 1]],
    steps: [['Cestoviny uvarte v osolenej vode do al dente.', 10], ['Na oleji krátko opečte cesnak a čili, pridajte paradajky a 8 minút poduste.', 8], ['Zmiešajte s cestovinami a posypte parmezánom.', 0]] },
  { id: 'losos', n: 'Losos s citrónom', pic: 'losos_p', e: 'fish', bg: 'sky', min: 25, kcal: 540, por: 2, src: 'recepty.sk', diff: 'jednoduché', tags: ['rýchle'],
    ing: [['losos', .4, '2 filety'], ['citrony', .15, '1 ks'], ['zemiaky', .6, '600 g'], ['maslo', .2, '1 lyžica', 1]],
    steps: [['Zemiaky uvarte v šupke doměkka.', 20], ['Losos osoľte a opečte na masle 4 minúty z každej strany.', 8], ['Pokvapkajte citrónom a podávajte so zemiakmi.', 0]] },
  { id: 'paradajkova', n: 'Paradajková polievka', pic: 'p_paradajkova', e: 'tomato', bg: 'rose', min: 30, kcal: 260, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['polievky', 'bez mäsa'],
    ing: [['lupane', 2, '2 plechovky'], ['cibula', 1, '1 ks'], ['cesnak', 1, '2 strúčiky'], ['smotana', 1, '200 ml'], ['olej', .02, '1 lyžica', 1]],
    steps: [['Na oleji opečte cibuľu a cesnak.', 5], ['Pridajte paradajky a 0,5 l vody, varte 15 minút.', 15], ['Rozmixujte, vmiešajte smotanu a dochuťte.', 3]] },
  { id: 'gulasova', n: 'Gulášová polievka', pic: 'p_gulasova', e: 'stew', bg: 'peach', min: 90, kcal: 430, por: 6, src: 'varecha.sk', diff: 'stredne náročné', tags: ['polievky', 'klasika'],
    ing: [['hovadzie', .4, '400 g'], ['zemiaky', .5, '500 g'], ['cibula', 2, '2 ks'], ['paprikam', .2, '1 lyžica', 1], ['pretlak', 1, '1 lyžica']],
    steps: [['Cibuľu opečte, pridajte mäso na kocky a papriku.', 10], ['Zalejte 1,5 l vody a varte, kým mäso nezmäkne.', 60], ['Pridajte zemiaky na kocky a varte ďalších 20 minút.', 20]] },
  { id: 'strips', n: 'Kuracie stripsy', pic: 'p_strips', e: 'poultry', bg: 'butter', min: 30, kcal: 580, por: 4, src: 'Vlastný recept', diff: 'jednoduché', tags: ['pre deti'],
    ing: [['kuracie', .6, '600 g'], ['vajcia', .2, '2 ks'], ['muka', .1, '100 g'], ['struhanka', 1, '150 g'], ['olej', .3, 'na vyprážanie', 1]],
    steps: [['Mäso nakrájajte na pásiky a osoľte.', 5], ['Obaľte v múke, vajci a strúhanke.', 8], ['Vyprážajte v rozpálenom oleji dozlatista.', 12]] },
  { id: 'tekvicova', n: 'Tekvicová polievka', pic: 'p_tekvicova', e: 'sweetpotato', bg: 'butter', min: 35, kcal: 290, por: 4, src: 'recepty.sk', diff: 'jednoduché', tags: ['polievky', 'bez mäsa'],
    ing: [['tekvica', 1, '1 kg'], ['cibula', 1, '1 ks'], ['smotana', 1, '200 ml'], ['vyvar', .3, '1 l vývaru', 1]],
    steps: [['Tekvicu a cibuľu nakrájajte a krátko opečte.', 6], ['Zalejte vývarom a varte 20 minút.', 20], ['Rozmixujte so smotanou a dochuťte.', 3]] },
  { id: 'steak', n: 'Steak so zemiakmi', pic: 'p_steak', e: 'meat', bg: 'peach', min: 40, kcal: 720, por: 2, src: 'Vlastný recept', diff: 'stredne náročné', tags: ['na víkend'],
    ing: [['rostenec', .5, '2 steaky'], ['zemiaky', .6, '600 g'], ['maslo', .3, '2 lyžice', 1], ['cesnak', 1, '2 strúčiky']],
    steps: [['Steaky nechajte 30 minút zohriať na izbovú teplotu, zemiaky upečte.', 30], ['Steaky opečte na rozpálenej panvici 3 minúty z každej strany.', 6], ['Pridajte maslo a cesnak, polievajte a nechajte 5 minút odpočinúť.', 5]] },
  { id: 'zeleninova', n: 'Zeleninová polievka', pic: 'p_zeleninova', e: 'carrot', bg: 'sage', min: 40, kcal: 210, por: 6, src: 'Vlastný recept', diff: 'veľmi jednoduché', tags: ['polievky', 'bez mäsa'],
    ing: [['mrkva', .3, '2 ks'], ['zemiaky', .4, '400 g'], ['brokolica', 1, '1 ks'], ['zmes', 1, '1 balenie'], ['cibula', 1, '1 ks']],
    steps: [['Zeleninu nakrájajte na kúsky.', 10], ['Varte v 1,5 l osolenej vody 25 minút.', 25], ['Dochuťte a podávajte s pečivom.', 0]] },
  { id: 'toasty', n: 'Francúzske toasty', pic: 'p_toasty', e: 'bread', bg: 'butter', min: 15, kcal: 410, por: 2, src: 'Vlastný recept', diff: 'veľmi jednoduché', tags: ['raňajky', 'sladké'],
    ing: [['toast', .5, '6 plátkov'], ['vajcia', .2, '2 ks'], ['mlieko', .1, '100 ml'], ['banany', .3, '2 ks'], ['med', .1, 'na polievanie']],
    steps: [['Vajcia rozšľahajte s mliekom.', 2], ['Plátky toastu namočte a opečte na masle dozlatista.', 8], ['Podávajte s banánom a medom.', 0]] },
  { id: 'grilprsia', n: 'Grilované kuracie prsia', pic: 'prsia', e: 'chicken', bg: 'sage', min: 25, kcal: 390, por: 2, src: 'recepty.sk', diff: 'jednoduché', tags: ['rýchle', 'fit'],
    ing: [['kuracie', .4, '400 g'], ['citrony', .1, '½ ks'], ['cesnak', 1, '1 strúčik'], ['salat', 1, 'na prílohu'], ['olej', .02, '1 lyžica', 1]],
    steps: [['Prsia naklepte, potrite olejom, cesnakom a citrónom.', 5], ['Grilujte 5 minút z každej strany.', 10], ['Podávajte so šalátom.', 0]] },
];

// Čo je doma (pre filter „Z toho, čo mám“ a odpočet surovín).
export const PANTRY = ['olej', 'korenie', 'paprikam', 'cukor', 'muka', 'cesnak', 'ryza', 'cestoviny', 'vyvar', 'maslo', 'zemiaky', 'cibula', 'pretlak', 'kari', 'med', 'dzem'];

// Výdavky z testovacej DB. Október 2026 (do 21. 10.) a september 2026.
export const OCT_CATS = { baby: 146.18, fuel: 81.36, clothing: 70.58, alcohol: 64.7, other: 60.61, home: 60.47, dairy_eggs: 38.68, produce: 37.67, health: 31.84, beverages: 30.68, bakery: 28.57, electronics: 28.06, meat_fish: 27.34, breakfast: 23.5, household_cleaning: 23.45, snacks_sweets: 22.92, deli_chilled: 22.83, personal_care: 21.84, pantry: 20.11, toys_hobby: 15.25, dining: 13.9, fees: 8.77, frozen: 4.68 };
export const SEP_CATS = { baby: 124.25, fuel: 90.26, meat_fish: 68.53, home: 65.22, clothing: 60.26, household_cleaning: 46.37, deli_chilled: 44.69, pantry: 39.49, health: 27.08, alcohol: 22.16, bakery: 17.74, snacks_sweets: 16.3, breakfast: 12.99, personal_care: 11.45, produce: 8.44, dairy_eggs: 7.95, beverages: 7.05, fees: 6.83, toys_hobby: 2.18, other: 1.75 };
export const MONTHS = [{ mo: '2026-08', n: 'August', sum: 36.32, cnt: 1 }, { mo: '2026-09', n: 'September', sum: 659.36, cnt: 31 }, { mo: '2026-10', n: 'Október', sum: 880.99, cnt: 34 }];

// Najväčšie položky kategórií v októbri: [kategória, názov, suma, počet, obchody]
export const OCT_PRODUCTS = [
  ['baby', 'Detská jedálenská súprava', 30.9, 1, 'MYKAN'], ['baby', 'Probiotické kvapky', 17.49, 1, 'Dr.Max'], ['baby', 'Krém na zapareniny', 12.84, 1, 'Dr.Max'], ['baby', 'Vlhčené utierky', 11.9, 2, 'dm'], ['baby', 'Silikónový tanierik', 9.28, 2, 'Dr.Max'], ['baby', 'Podložky na prebaľovanie', 8.85, 3, 'dm'], ['baby', 'Plienky Premium Care 5', 7.99, 1, 'Lidl'],
  ['fuel', 'Benzín EVO 95', 81.36, 1, 'Slovnaft'],
  ['clothing', 'Podprsenka', 15.96, 3, 'Lidl'], ['clothing', 'Detský overal', 11.98, 2, 'Lidl, LPP'], ['clothing', 'Dojčenský overal', 10.98, 2, 'LPP'], ['clothing', 'Textil', 8, 3, 'Feedo'], ['clothing', 'Vianočný komplet', 7.99, 1, 'LPP'],
  ['alcohol', 'Pivo 12°', 20.91, 5, 'Kaufland, Kraj, Lidl, Tesco'], ['alcohol', 'Írska whiskey', 18.49, 1, 'Kaufland'], ['alcohol', 'Sekt 1933', 11.99, 1, 'Tesco'], ['alcohol', 'Pivo 10°', 7.15, 2, 'Lidl, Tesco'], ['alcohol', 'Tramín červený', 3.99, 1, 'Lidl'],
  ['other', 'Platba poistného', 58.47, 1, 'Kooperativa'], ['other', 'Nákupné tašky', 2.14, 3, 'dm, Pepco'],
  ['home', 'Vonný difuzér', 9, 3, 'Pepco'], ['home', 'Kuchárska kniha', 5.99, 1, 'Lidl'], ['home', 'Silikón a tmely', 16.21, 3, 'Hornbach'], ['home', 'Košík', 5, 2, 'Pepco'],
  ['dairy_eggs', 'Bio jogurt', 6.86, 6, 'Lidl'], ['dairy_eggs', 'Camembert', 5.8, 3, 'Lidl'], ['dairy_eggs', 'Strúhaný eidam', 4.77, 2, 'Lidl'], ['dairy_eggs', 'Tvarohový krém', 3.43, 2, 'Lidl'], ['dairy_eggs', 'Vajcia M', 2.39, 1, 'Lidl'],
  ['produce', 'Jablká Cosmic Crisp', 6.23, 2, 'Lidl'], ['produce', 'Cherry paradajky', 4.88, 2, 'Lidl'], ['produce', 'Maliny', 3.78, 2, 'Lidl'], ['produce', 'Šampiňóny', 3.58, 2, 'Lidl'], ['produce', 'Banány', 2.75, 3, 'Lidl'],
  ['health', 'Chladiace náplasti', 9.95, 1, 'dm'], ['health', 'Morská voda – sprej', 7.99, 1, 'Dr.Max'], ['health', 'Pastilky', 5.94, 1, 'Dr.Max'],
  ['beverages', 'Nealko šumivé víno', 8.99, 1, 'Tesco'], ['beverages', 'Sirup jahoda', 5.99, 1, 'Lidl'], ['beverages', 'Nealko pivo', 3.56, 1, 'Lidl'], ['beverages', 'Limonády', 4.3, 2, 'Tesco'],
  ['bakery', 'Toastový chlieb', 7.22, 4, 'Kraj, Lidl'], ['bakery', 'Šiška s náplňou', 4.68, 3, 'Lidl'], ['bakery', 'Bageta', 3.56, 2, 'Lidl'], ['bakery', 'Kaiserka', 2.69, 4, 'Kraj, Lidl'],
  ['electronics', 'Kábel USB-C', 12.51, 1, 'Alza'], ['electronics', 'Batérie', 12.55, 3, 'Hornbach'],
  ['meat_fish', 'Kuracie prsné rezne', 27.34, 5, 'Lidl'],
  ['breakfast', 'Káva zrnková Brazília', 23.5, 1, 'Barista coffee'],
  ['household_cleaning', 'Prací prostriedok Color', 9.95, 1, 'Lidl'], ['household_cleaning', 'Vlhčené utierky kuchynské', 4.47, 2, 'Lidl'], ['household_cleaning', 'Kuchynské utierky', 3.75, 2, 'Lidl'], ['household_cleaning', 'Toaletný papier', 1.99, 1, 'Lidl'],
  ['snacks_sweets', 'Horalky', 5.58, 3, 'Lidl'], ['snacks_sweets', 'Oblátka Horalky', 4.58, 2, 'Lidl'], ['snacks_sweets', 'Slané praclíky', 2.85, 3, 'Lidl'], ['snacks_sweets', 'Lupienky', 4.17, 2, 'Tesco'],
  ['deli_chilled', 'Chorizo', 7, 3, 'Lidl'], ['deli_chilled', 'Mäsiarska šunka', 4.76, 2, 'Lidl'], ['deli_chilled', 'Debrecínska pečienka', 3.83, 1, 'Mäsiarstvo'], ['deli_chilled', 'Treska v majonéze', 3.27, 2, 'Lidl'],
  ['personal_care', 'Dezodoranty', 8.33, 2, 'Alza'], ['personal_care', 'Hygienické vložky', 3.9, 2, 'dm'], ['personal_care', 'Telové mlieko', 2.99, 1, 'Lidl'], ['personal_care', 'Zubná pasta', 3.58, 2, 'Lidl'],
  ['pantry', 'Pesto', 2.78, 1, 'Lidl'], ['pantry', 'Kečup', 2.49, 1, 'Lidl'], ['pantry', 'Paradajkový pretlak', 2.38, 2, 'Lidl'], ['pantry', 'Sójová omáčka', 2.18, 1, 'Lidl'], ['pantry', 'Ryža', 1.69, 1, 'Lidl'],
  ['toys_hobby', 'Drevená hračka', 5.95, 1, 'feedo.sk'], ['toys_hobby', 'Darčekové tašky', 4.3, 4, 'Pepco'],
  ['dining', 'McDonald\'s', 13.9, 6, 'McDonald\'s'], ['fees', 'Doprava', 7.57, 6, 'e-shopy'], ['frozen', 'Polievková zmes', 2.99, 1, 'Lidl'], ['frozen', 'Hranolky', 1.69, 1, 'Lidl'],
];

// Bločky z októbra 2026: [obchod, dátum, čas, suma, počet položiek]
export const OCT_RECEIPTS = [
  ['Dr.Max', '10-21', '', 10.07, 3], ['Dr.Max', '10-21', '', 13.8, 5], ['Kaufland', '10-21', '20:45', 19.79, 3], ['Kooperativa', '10-20', '09:21', 58.47, 1], ['Barista coffee', '10-19', '', 27.5, 3],
  ['Slovnaft', '10-19', '16:39', 81.36, 1], ['Hornbach', '10-19', '16:21', 43.52, 14], ['Tesco', '10-18', '13:38', 25.9, 9], ['McDonald\'s', '10-17', '17:39', 8.8, 5], ['TEDi', '10-17', '14:41', 3, 3],
  ['Lidl', '10-17', '14:33', 55.74, 42], ['Mäsiarstvo', '10-17', '14:02', 3.83, 1], ['Pepco', '10-17', '13:53', 21, 13], ['LPP', '10-16', '', 41.33, 7], ['Alza', '10-16', '', 12.51, 2],
  ['Feedo', '10-15', '', 8, 3], ['feedo.sk', '10-15', '', 10.85, 4], ['Lidl', '10-15', '16:20', 49.92, 25], ['dm', '10-15', '15:46', 50.75, 17], ['McDonald\'s', '10-14', '17:36', 5.1, 1],
  ['Dr.Max', '10-13', '', 18.87, 4], ['Lidl', '10-13', '14:17', 36.99, 19], ['Pepco', '10-13', '13:59', 12, 5], ['Tesco', '10-10', '20:08', 24.43, 5], ['Lidl', '10-09', '12:51', 50.68, 32],
  ['Lidl', '10-07', '13:07', 16.83, 9], ['Kraj', '10-06', '15:27', 16.28, 6], ['Alza', '10-05', '', 8.33, 2], ['Dr.Max', '10-05', '', 22.49, 2], ['TEDi', '10-05', '16:51', 2, 2],
  ['Lidl', '10-05', '16:41', 14.03, 13], ['dm', '10-05', '16:24', 13.85, 3], ['MYKAN', '10-02', '', 42.2, 4], ['Lidl', '10-02', '15:05', 50.77, 27],
];

// Október 2026 – výdavky v obchodoch podľa kategórií (len väčšie sumy)
export const STORE_CATS = {
  Lidl: { produce: 37.67, dairy_eggs: 35.89, meat_fish: 27.34, household_cleaning: 23, bakery: 21.98, pantry: 20.11, clothing: 19.95, deli_chilled: 19, beverages: 17.39, snacks_sweets: 16.04, baby: 11.77, alcohol: 10.69, personal_care: 9.61, home: 5.99, frozen: 4.68 },
  dm: { baby: 49.5, health: 9.95, personal_care: 3.9 },
  Tesco: { alcohol: 26.03, beverages: 13.29, snacks_sweets: 6.12 },
  'Dr.Max': { baby: 39.61, health: 21.89 },
  Kaufland: { alcohol: 19.64 },
  Pepco: { home: 21, toys_hobby: 7.3 },
  Hornbach: { home: 30.48, electronics: 12.55 },
  Slovnaft: { fuel: 81.36 },
};

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
  ['kapustnica', 'Kapustnica', 'polievky', null, 'stew', 'peach', 90, 380, 6, 'varecha.sk', [['kapusta', 1, '500 g'], ['klobasa', 1, '1 ks'], ['sampinony', 1, 'hrsť'], ['paprikam', .1, '1 lyžica', 1], ['cibula', 1, '1 ks']], ['Kapustu prepláchnite a varte v 1,5 l vody 30 minút.', 30], ['Pridajte klobásu, huby a na cibuľke opraženú papriku.', 40], ['Dochuťte a podávajte s chlebom.', 0]],
  ['sosovicova', 'Šošovicová polievka', 'polievky', null, 'beans', 'butter', 45, 320, 4, 'Vlastný recept', [['sosovica', 1, '250 g'], ['mrkva', .2, '2 ks'], ['cibula', 1, '1 ks'], ['zemiaky', .3, '2 ks'], ['vyvar', .3, '1 l', 1]], ['Cibuľu a mrkvu opečte, pridajte šošovicu.', 6], ['Zalejte vývarom, pridajte zemiaky a varte 30 minút.', 30], ['Dochuťte octom a soľou.', 0]],
  ['cesnacka', 'Cesnačka', 'polievky', null, 'garlic', 'butter', 25, 240, 4, 'recepty.sk', [['cesnak', 1, '1 hlavička'], ['zemiaky', .4, '3 ks'], ['eidam', 1, '100 g'], ['chlieb', 1, 'na krutóny']], ['Zemiaky uvarte v osolenej vode s rascou.', 15], ['Pridajte prelisovaný cesnak, povarte 2 minúty.', 2], ['Podávajte so syrom a opečeným chlebom.', 0]],
  ['rebierka', 'Pečené rebierka', 'maso', 'x_rebra', 'meatbone', 'peach', 150, 820, 4, 'varecha.sk', [['rebra', 1.5, '1,5 kg'], ['med', .2, '2 lyžice'], ['cesnak', 1, '4 strúčiky'], ['kecup', 1, '3 lyžice']], ['Rebierka potrite marinádou z medu, cesnaku a kečupu.', 10], ['Pečte prikryté pri 160 °C dve hodiny.', 120], ['Odkryte a dopečte dochrumkava.', 20]],
  ['spizy', 'Bravčové špízy', 'maso', 'x_spizy', 'meat', 'peach', 40, 560, 4, 'Vlastný recept', [['pliecko', .6, '600 g'], ['paprika', .3, '2 ks'], ['cibula', 2, '2 ks'], ['bok', .2, '200 g slaniny']], ['Mäso a zeleninu nakrájajte na kocky a napichajte na špajle.', 15], ['Grilujte 12 minút, občas otočte.', 12], ['Podávajte s chlebom a horčicou.', 0]],
  ['segedin', 'Segedínsky guláš', 'maso', null, 'pot', 'peach', 90, 640, 4, 'varecha.sk', [['pliecko', .6, '600 g'], ['kapusta', 1, '500 g'], ['smotana', 1, '200 ml'], ['cibula', 2, '2 ks'], ['paprikam', .2, '1 lyžica', 1]], ['Cibuľu opečte, pridajte mäso a papriku, poduste 40 minút.', 40], ['Pridajte prepláchnutú kapustu a varte do mäkka.', 30], ['Zjemnite smotanou zmiešanou s trochou múky.', 5]],
  ['karbonatky', 'Mleté karbonátky', 'maso', null, 'meat', 'butter', 35, 590, 4, 'Vlastný recept', [['mlete', 1, '500 g'], ['vajcia', .1, '1 ks'], ['struhanka', 1, 'na obalenie'], ['zemiaky', .8, 'na pyré']], ['Mäso zmiešajte s vajcom, soľou a cesnakom.', 5], ['Tvarujte placky, obaľte v strúhanke a opečte.', 15], ['Podávajte so zemiakovým pyré.', 0]],
  ['kura', 'Pečené kura', 'hydina', 'x_kura', 'poultry', 'peach', 90, 610, 4, 'recepty.sk', [['kura', 1.5, '1 kura'], ['citrony', .1, '1 ks'], ['cesnak', 1, '5 strúčikov'], ['maslo', .3, '2 lyžice', 1]], ['Kura natrite maslom s cesnakom, do brucha dajte citrón.', 10], ['Pečte pri 190 °C asi 80 minút, polievajte výpekom.', 80], ['Nechajte 10 minút odpočinúť a nakrájajte.', 10]],
  ['kurwok', 'Kuracie s ryžou a zeleninou', 'hydina', 'x_kurwok', 'pan', 'sage', 25, 520, 4, 'recepty.sk', [['kuracie', .5, '500 g'], ['ryza', .5, '250 g'], ['paprika', .3, '2 ks'], ['soja', 1, '3 lyžice'], ['mrkva', .2, '1 ks']], ['Uvarte ryžu.', 15], ['Na rozpálenej panvici opečte mäso, pridajte zeleninu.', 8], ['Zalejte sójovou omáčkou a premiešajte s ryžou.', 2]],
  ['naprike', 'Kuracie na paprike', 'hydina', null, 'poultry', 'rose', 50, 580, 4, 'varecha.sk', [['stehna', 1, '1 kg'], ['cibula', 2, '2 ks'], ['smotana', 1, '250 ml'], ['paprikam', .3, '2 lyžice', 1], ['cestoviny', 1, 'halušky alebo cestoviny']], ['Cibuľu opečte, pridajte papriku a mäso.', 10], ['Podlejte vodou a duste 35 minút.', 35], ['Zjemnite smotanou, podávajte s haluškami.', 5]],
  ['hubrizoto', 'Hubové rizoto', 'cestoviny', 'x_rizoto', 'rice', 'butter', 35, 480, 4, 'recepty.sk', [['ryza', .6, '300 g'], ['sampinony', 2, '500 g'], ['parmezan', .5, '50 g'], ['cibula', 1, '1 ks'], ['vyvar', .3, '1 l', 1]], ['Na masle speňte cibuľu a huby.', 8], ['Pridajte ryžu a postupne prilievajte vývar.', 20], ['Vmiešajte parmezán a kúsok masla.', 2]],
  ['krevety', 'Špagety s krevetami', 'cestoviny', 'x_krevety', 'shrimp', 'rose', 25, 560, 4, 'varecha.sk', [['cestoviny', 1, '400 g'], ['krevety', 1, '300 g'], ['paradajky', 1, '250 g'], ['cesnak', 1, '3 strúčiky'], ['olej', .03, '3 lyžice', 1]], ['Uvarte cestoviny al dente.', 10], ['Na oleji opečte cesnak, krevety a paradajky.', 6], ['Zmiešajte s cestovinami a posypte petržlenovou vňaťou.', 0]],
  ['cestsalat', 'Cestovinový šalát', 'cestoviny', 'x_cestsalat', 'salad', 'sage', 20, 420, 4, 'Vlastný recept', [['cestoviny', 1, '300 g'], ['paradajky', 1, '250 g'], ['mozzarella', 1, '125 g'], ['pesto', 1, '3 lyžice']], ['Cestoviny uvarte a nechajte vychladnúť.', 12], ['Zmiešajte s paradajkami, mozzarellou a pestom.', 5]],
  ['halusky', 'Bryndzové halušky', 'cestoviny', null, 'bowl', 'sage', 40, 640, 4, 'varecha.sk', [['zemiaky', 1, '1 kg'], ['muka', .3, '300 g'], ['bryndza', 2, '250 g'], ['bok', .15, '150 g slaniny']], ['Zemiaky nastrúhajte a zmiešajte s múkou a soľou.', 10], ['Cesto pretláčajte do vriacej vody, varte 3 minúty.', 15], ['Zmiešajte s bryndzou a posypte opečenou slaninou.', 8]],
  ['pizza', 'Domáca pizza', 'cestoviny', 'x_pizza', 'pizza', 'rose', 45, 720, 4, 'Vlastný recept', [['muka', .5, '500 g'], ['lupane', 1, '1 plechovka'], ['mozzarella', 2, '250 g'], ['sunka', 2, '200 g'], ['olej', .03, '2 lyžice', 1]], ['Vymiešajte cesto z múky, vody, droždia a oleja, nechajte 30 minút kysnúť.', 30], ['Rozvaľkajte, natrite paradajkami, obložte šunkou a syrom.', 8], ['Pečte pri 250 °C 10 minút.', 10]],
  ['rybieprsty', 'Rybie prsty s pyré', 'ryby', null, 'fish', 'sky', 25, 480, 4, 'Vlastný recept', [['rybieprsty', 1, '1 balenie'], ['zemiaky', .8, '800 g'], ['mlieko', .2, '200 ml'], ['maslo', .2, 'lyžica', 1]], ['Zemiaky uvarte a rozšľahajte s mliekom a maslom.', 20], ['Rybie prsty upečte v rúre podľa návodu.', 15], ['Podávajte s citrónom.', 0]],
  ['tuniak', 'Tuniakový šalát', 'ryby', null, 'salad', 'sky', 15, 380, 2, 'recepty.sk', [['tuniak', 1, '1 konzerva'], ['kukurica', 1, '1 konzerva'], ['salat', 1, '1 hlávka'], ['vajcia', .2, '2 ks']], ['Vajcia uvarte natvrdo.', 10], ['Zmiešajte šalát, tuniak, kukuricu a vajcia, zakvapkajte olejom.', 5]],
  ['syr', 'Vyprážaný syr', 'bezmasa', null, 'cheese2', 'butter', 25, 690, 4, 'Vlastný recept', [['syrvyp', 2, '4 plátky'], ['vajcia', .2, '2 ks'], ['muka', .1, 'na obalenie'], ['struhanka', 1, 'na obalenie'], ['hranolky', 1, 'príloha']], ['Syr obaľte v múke, vajci a strúhanke – dvakrát.', 8], ['Vyprážajte v horúcom oleji dozlatista.', 6], ['Podávajte s hranolkami a tatárskou omáčkou.', 0]],
  ['placky', 'Zemiakové placky', 'bezmasa', null, 'potato', 'butter', 35, 450, 4, 'varecha.sk', [['zemiaky', 1, '1 kg'], ['vajcia', .1, '1 ks'], ['muka', .1, '3 lyžice'], ['cesnak', 1, '3 strúčiky']], ['Zemiaky nastrúhajte a vytlačte z nich vodu.', 10], ['Zmiešajte s vajcom, múkou, cesnakom a majoránom.', 5], ['Vyprážajte tenké placky z oboch strán.', 20]],
  ['hrianka', 'Vajíčková hrianka', 'sladke', 'x_hrianka', 'egg2', 'butter', 10, 340, 2, 'Vlastný recept', [['chlieb', 1, '2 krajce'], ['vajcia', .2, '2 ks'], ['avokado', 1, '1 ks']], ['Chlieb opečte.', 3], ['Na panvici urobte volské oká.', 4], ['Na hrianku dajte avokádo a vajce, osoľte a okoreňte.', 0]],
  ['lievance', 'Lievance', 'sladke', null, 'pancakes', 'rose', 30, 410, 4, 'varecha.sk', [['muka', .3, '300 g'], ['mlieko', .4, '400 ml'], ['vajcia', .2, '2 ks'], ['dzem', 1, 'na podávanie']], ['Vymiešajte cesto s kypriacim práškom.', 5], ['Na panvici pečte malé lievance z oboch strán.', 20], ['Podávajte s džemom alebo medom.', 0]],
  ['kasa', 'Ovsená kaša', 'sladke', null, 'bowl', 'sky', 10, 300, 2, 'Vlastný recept', [['vlocky', .2, '100 g'], ['mlieko', .4, '400 ml'], ['banany', .2, '1 ks'], ['med', .1, 'lyžica']], ['Vločky varte v mlieku 5 minút.', 5], ['Ozdobte banánom a medom.', 0]],
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
