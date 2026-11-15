/*
 * Databáza potravín pre recepty (z prototypu; hodnoty na 100 g jedlej časti, orientačne podľa
 * bežných tabuliek USDA / EuroFIR). Názvy sú údaje (ako názvy produktov), nie text rozhrania.
 * n: [kcal, bielkoviny, sacharidy, z toho cukry, tuky, z toho nasýtené, vláknina, soľ] alebo null = bez údajov.
 * g = hmotnosť 1 kusu, lyz = g v 1 lyžici, lyzk = g v 1 lyžičke, dens = g v 1 ml,
 * loose = kupuje sa na váhu, pack = bežné balenie v obchode (g | ml | ks).
 * cat = kategória položky v nákupnom zozname.
 * Pri potravinách z knihy receptov sú hodnoty z USDA FoodData Central (SR Legacy, kód fdc v poznámke),
 * al = alergény (14 alergénov EÚ, nariadenie 1169/2011, príloha II), check = kupovaný výrobok, ktorého zloženie
 * sa líši podľa značky (skontrolovať obal), edible = jedlý podiel (bez kostí), free = nekupuje sa (voda).
 */
export type Food = {
  name: string;
  cat: string;
  n: number[] | null;
  g: number | null;
  lyz: number;
  lyzk: number;
  dens: number;
  loose: boolean;
  pack: { g?: number; ml?: number; ks?: number } | null;
  /** Alergény (14 alergénov EÚ). Pri potravinách z knihy receptov je vždy vyplnené (aj prázdne). */
  al?: Allergen[];
  /** Kupovaný výrobok, ktorého zloženie sa líši podľa značky – pri alergénoch „skontroluj obal“. */
  check?: boolean;
  /** Jedlý podiel (napr. kurča s kosťami 0,68) – pre výživové hodnoty. */
  edible?: number;
  /** Nekupuje sa (voda). */
  free?: boolean;
};

/** 14 alergénov EÚ (nariadenie 1169/2011, príloha II). */
export const ALLERGENS = ["lepok", "korysovce", "vajcia", "ryby", "arasidy", "soja", "mlieko", "orechy", "zeler", "horcica", "sezam", "siricitany", "vlci_bob", "makkyse"] as const;
export type Allergen = (typeof ALLERGENS)[number];

type Opts = Partial<Pick<Food, "g" | "lyz" | "lyzk" | "dens" | "loose" | "pack" | "al" | "check" | "edible" | "free">>;
function f(name: string, cat: string, n: number[] | null, o: Opts = {}): Food {
  const food: Food = { name, cat, n, g: o.g ?? null, lyz: o.lyz ?? 15, lyzk: o.lyzk ?? 5, dens: o.dens ?? 1, loose: !!o.loose, pack: o.pack ?? null };
  if (o.al) food.al = o.al;
  if (o.check) food.check = true;
  if (o.edible) food.edible = o.edible;
  if (o.free) food.free = true;
  return food;
}

export const FOODS: Record<string, Food> = {
  // ---------------------------------------------------- vždy doma (state.staples)
  sol: f("Soľ", "pantry", [0, 0, 0, 0, 0, 0, 0, 100], { lyz: 18, lyzk: 6, pack: { g: 1000 }, al: [] }),
  olej: f("Olej", "pantry", [884, 0, 0, 0, 100, 10, 0, 0], { lyz: 13, lyzk: 4.5, dens: 0.92, pack: { ml: 1000 }, al: [] }),
  korenie: f("Čierne korenie", "pantry", [251, 10.4, 64, 0.6, 3.3, 1.4, 25, 0.05], { lyz: 7, lyzk: 2.5, pack: { g: 50 }, al: [] }),
  cukor: f("Cukor", "pantry", [387, 0, 100, 99.8, 0, 0, 0, 0], { lyz: 12, lyzk: 4, pack: { g: 1000 }, al: [] }), // fdc 169655
  rasca: f("Rasca", "pantry", [333, 19.8, 50, 0.6, 14.6, 0.6, 38, 0.04], { lyz: 6, lyzk: 2, pack: { g: 30 }, al: [] }),
  paprika_mleta: f("Mletá sladká paprika", "pantry", [282, 14.1, 54, 10.3, 12.9, 2.1, 34.9, 0.17], { lyz: 7, lyzk: 2.5, pack: { g: 50 }, al: [] }), // fdc 171329
  muka: f("Hladká múka", "pantry", [364, 10.3, 76.3, 0.3, 1, 0.2, 2.7, 0.01], { lyz: 10, lyzk: 3, pack: { g: 1000 }, al: ["lepok"] }), // fdc 169761

  // ---------------------------------------------------- mäso a ryby
  pliecko: f("Bravčové pliecko", "meat_fish", [236, 17.2, 0, 0, 18, 6.2, 0, 0.16], { loose: true, al: [] }), // fdc 167843
  krkovicka: f("Bravčová krkovička", "meat_fish", [250, 16, 0, 0, 21, 7.5, 0, 0.15], { loose: true }),
  bravcove_stehno: f("Bravčové stehno (rezne)", "meat_fish", [140, 21, 0, 0, 6, 2, 0, 0.15], { loose: true }),
  kuracie_prsia: f("Kuracie prsia", "meat_fish", [110, 23, 0, 0, 1.5, 0.4, 0, 0.15], { loose: true }),
  kuracie_stehna: f("Kuracie stehná", "meat_fish", [200, 18, 0, 0, 14, 4, 0, 0.2], { loose: true, g: 250 }),
  hovadzie: f("Hovädzie zadné", "meat_fish", [198, 20.7, 0, 0, 12.2, 4.8, 0, 0.13], { loose: true, al: [] }), // fdc 168697
  mlete: f("Mleté mäso zmiešané", "meat_fish", [263, 16.9, 0, 0, 21.2, 7.9, 0, 0.14], { pack: { g: 500 }, al: [] }), // fdc 167902
  slanina: f("Údená slanina", "meat_fish", [393, 13.7, 0, 0.3, 37.1, 12.6, 0, 1.88], { pack: { g: 150 }, al: [] }), // fdc 168277
  parky: f("Párky", "meat_fish", [269, 12.8, 0.3, 0, 23.7, 8.7, 0.1, 2.04], { g: 50, pack: { g: 250 }, al: [], check: true }), // fdc 172964
  losos: f("Losos filet", "meat_fish", [208, 20, 0, 0, 13, 3.1, 0, 0.15], { pack: { g: 200 } }),

  // ---------------------------------------------------- ovocie a zelenina
  cibula: f("Cibuľa", "produce", [40, 1.1, 9.3, 4.2, 0.1, 0, 1.7, 0], { g: 120, loose: true, al: [] }), // fdc 170000
  cervena_cibula: f("Červená cibuľa", "produce", [40, 1.1, 9.3, 4.2, 0.1, 0, 1.7, 0], { g: 120, loose: true }),
  cesnak: f("Cesnak", "produce", [149, 6.4, 33, 1, 0.5, 0.1, 2.1, 0.04], { g: 40, pack: { ks: 1 }, al: [] }), // fdc 169230
  zemiaky: f("Zemiaky", "produce", [77, 2, 17.5, 0.8, 0.1, 0, 2.1, 0.01], { g: 125, loose: true, al: [] }), // fdc 170026
  mrkva: f("Mrkva", "produce", [41, 0.9, 9.6, 4.7, 0.2, 0, 2.8, 0.17], { g: 80, loose: true, al: [] }), // fdc 170393
  petrzlen: f("Petržlen koreň", "produce", [55, 3, 12, 4.9, 0.6, 0.1, 4.3, 0.03], { g: 80, loose: true, al: [] }),
  zeler: f("Zeler", "produce", [42, 1.5, 9.2, 1.6, 0.3, 0.1, 1.8, 0.25], { g: 400, loose: true, al: ["zeler"] }), // fdc 170400
  sampinony: f("Šampiňóny", "produce", [22, 3.1, 3.3, 2, 0.3, 0.1, 1, 0.01], { pack: { g: 250 }, al: [] }), // fdc 169251
  paradajky: f("Paradajky", "produce", [18, 0.9, 3.9, 2.6, 0.2, 0, 1.2, 0.01], { g: 120, loose: true }),
  uhorka: f("Uhorka šalátová", "produce", [15, 0.7, 3.6, 1.7, 0.1, 0, 0.5, 0], { g: 300 }),
  paprika: f("Paprika", "produce", [20, 0.9, 4.6, 2.4, 0.2, 0.1, 1.7, 0.01], { g: 150, loose: true, al: [] }), // fdc 170427 (zelená)
  paprika_cervena: f("Červená paprika", "produce", [26, 1, 6, 4.2, 0.3, 0.1, 2.1, 0.01], { g: 180, loose: true, al: [] }), // fdc 170108
  brokolica: f("Brokolica", "produce", [34, 2.8, 6.6, 1.7, 0.4, 0, 2.6, 0.08], { g: 400 }),
  citron: f("Citrón", "produce", [29, 1.1, 9.3, 2.5, 0.3, 0, 2.8, 0.01], { g: 100, al: [] }), // fdc 167746
  kopor: f("Kôpor čerstvý", "produce", [43, 3.5, 7, 0, 1.1, 0.1, 2.1, 0.15], { g: 25, lyz: 4, pack: { ks: 1 }, al: [] }), // fdc 172233
  cucoriedky: f("Čučoriedky", "produce", [57, 0.7, 14, 10, 0.3, 0, 2.4, 0], { pack: { g: 125 } }),
  brusnice: f("Brusnice (kompót)", "pantry", [159, 0.9, 40.4, 31.8, 0.1, 0, 1.1, 0.01], { lyz: 20, lyzk: 7, pack: { g: 200 }, al: [] }), // fdc 173961

  // ---------------------------------------------------- mliečne a vajcia
  kysla_smotana: f("Kyslá smotana", "dairy_eggs", [198, 2.4, 4.6, 3.4, 19.4, 10.1, 0, 0.08], { pack: { g: 200 }, al: ["mlieko"] }), // fdc 171257
  smotana: f("Smotana na varenie", "dairy_eggs", [131, 3.1, 4.3, 4.1, 11.5, 7, 0, 0.15], { pack: { ml: 250 }, al: ["mlieko"] }), // fdc 171255 (10–18 % tuku)
  mlieko: f("Mlieko polotučné", "dairy_eggs", [50, 3.3, 4.8, 5.1, 2, 1.3, 0, 0.12], { dens: 1.03, pack: { ml: 1000 }, al: ["mlieko"] }), // fdc 171267
  vajce: f("Vajcia", "dairy_eggs", [143, 12.6, 0.7, 0.4, 9.5, 3.1, 0, 0.35], { g: 50, pack: { ks: 10 }, al: ["vajcia"] }), // fdc 171287
  maslo: f("Maslo", "dairy_eggs", [717, 0.9, 0.1, 0.1, 81.1, 50.5, 0, 0.03], { lyz: 14, pack: { g: 250 }, al: ["mlieko"] }), // fdc 173430
  parmezan: f("Parmezán", "dairy_eggs", [392, 35.8, 3.2, 0.1, 25, 14.9, 0, 2.94], { pack: { g: 100 }, al: ["mlieko"] }), // fdc 170848
  eidam: f("Eidam", "dairy_eggs", [357, 25, 1.4, 0, 28.6, 18.7, 0, 2.43], { pack: { g: 100 }, al: ["mlieko"] }), // fdc 173419
  bryndza: f("Bryndza", "dairy_eggs", [260, 14, 2, 2, 21, 14, 0, 2.4], { pack: { g: 125 } }),
  feta: f("Feta", "dairy_eggs", [264, 14, 4, 4, 21, 15, 0, 2.8], { pack: { g: 200 } }),
  tvaroh: f("Tvaroh", "dairy_eggs", [120, 13, 3.5, 3.5, 6, 4, 0, 0.08], { pack: { g: 250 } }),

  // ---------------------------------------------------- trvanlivé a pečivo
  spagety: f("Špagety", "pantry", [359, 13, 71, 3, 1.5, 0.3, 3, 0.01], { pack: { g: 500 } }),
  cestoviny: f("Cestoviny (kolienka)", "pantry", [359, 13, 71, 3, 1.5, 0.3, 3, 0.01], { pack: { g: 500 } }),
  ryza: f("Ryža", "pantry", [365, 7.1, 80, 0.1, 0.7, 0.2, 1.3, 0.01], { lyz: 15, pack: { g: 1000 }, al: [] }), // fdc 169756
  sosovica: f("Šošovica", "pantry", [352, 25, 60, 2, 1.1, 0.2, 11, 0.02], { pack: { g: 500 } }),
  struhanka: f("Strúhanka", "pantry", [395, 13, 72, 6, 5, 1, 4.5, 1.2], { pack: { g: 250 } }),
  pasirovane: f("Pasírované paradajky", "pantry", [16, 0.8, 3.5, 2.6, 0.3, 0, 1.9, 0.29], { pack: { g: 500 }, al: [] }), // fdc 170051
  kapusta: f("Kyslá kapusta", "pantry", [19, 0.9, 4.3, 1.8, 0.1, 0, 2.9, 1.65], { pack: { g: 500 }, al: [] }), // fdc 169279
  kokosove_mlieko: f("Kokosové mlieko", "pantry", [197, 2, 3, 2, 20, 18, 0, 0.05], { pack: { ml: 400 } }),
  kari: f("Kari pasta", "pantry", [200, 3, 15, 6, 14, 2, 4, 6], { lyz: 15, pack: { g: 100 } }),
  horcica: f("Horčica plnotučná", "pantry", [60, 3.7, 5.8, 0.9, 3.3, 0.2, 4, 2.76], { lyz: 15, lyzk: 5, pack: { g: 200 }, al: ["horcica"] }), // fdc 172234
  olivovy_olej: f("Olivový olej", "pantry", [884, 0, 0, 0, 100, 13.8, 0, 0], { lyz: 13, dens: 0.92, pack: { ml: 500 }, al: [] }), // fdc 171413
  olivy: f("Olivy", "pantry", [145, 1, 4, 0, 15, 2, 3, 3], { pack: { g: 150 } }),
  oregano: f("Oregano sušené", "pantry", [265, 9, 68.9, 4.1, 4.3, 1.6, 42.5, 0.06], { lyz: 3, lyzk: 1, pack: { g: 10 }, al: [] }), // fdc 171328
  majoran: f("Majorán sušený", "pantry", [271, 12.7, 60.6, 4.1, 7, 0.5, 40.3, 0.19], { lyz: 3, lyzk: 1, pack: { g: 10 }, al: [] }), // fdc 170928
  ocot: f("Ocot", "pantry", [18, 0, 0.6, 0.6, 0, 0, 0, 0], { lyz: 15, lyzk: 5, pack: { ml: 1000 }, al: [] }),
  prasok: f("Kypriaci prášok", "pantry", [53, 0, 28, 0, 0, 0, 0, 26], { lyzk: 4, pack: { g: 12 } }),
  drozdie: f("Droždie", "dairy_eggs", [105, 8.4, 18, 0, 1.9, 0.3, 8, 0.1], { pack: { g: 42 } }),
  dzem: f("Džem / lekvár", "pantry", [250, 0.4, 61, 55, 0.1, 0, 1, 0], { lyz: 20, pack: { g: 340 } }),
  uhorky_kysle: f("Sterilizované uhorky", "pantry", [12, 0.5, 2.4, 1.1, 0.3, 0.1, 1, 2.02], { g: 60, pack: { g: 670 }, al: [], check: true }), // fdc 168558
  knedla: f("Knedľa parená", "bakery", [230, 7, 45, 2, 2, 0.5, 2, 1], { g: 400, pack: { ks: 1 }, al: ["lepok", "vajcia", "mlieko"], check: true }),
  chlieb: f("Chlieb", "bakery", [250, 8.5, 48, 3, 1.5, 0.3, 5, 1.2], { g: 40, pack: { g: 500 } }),
};


/* Ďalšie potraviny knihy receptov (hodnoty USDA FoodData Central, SR Legacy). */
Object.assign(FOODS, {
  kurca: f("Kurča celé", "meat_fish", [215, 18.6, 0, 0, 15.1, 4.3, 0, 0.17], { g: 1300, loose: true, edible: 0.68, al: [] }), // fdc 171447
  mast: f("Bravčová masť", "meat_fish", [902, 0, 0, 0, 100, 39.2, 0, 0], { lyz: 13, lyzk: 4.5, pack: { g: 250 }, al: [] }), // fdc 171401
  vyvar: f("Vývar", "pantry", [13, 2, 1.2, 0.5, 0.1, 0, 0, 0.49], { pack: { ml: 500 }, al: ["zeler"], check: true }), // fdc 172883
  voda: f("Voda", "pantry", [0, 0, 0, 0, 0, 0, 0, 0], { al: [], free: true }),
  smotana_sladka: f("Smotana na šľahanie", "dairy_eggs", [340, 2.8, 2.8, 2.9, 36.1, 23, 0, 0.07], { pack: { ml: 250 }, al: ["mlieko"] }), // fdc 170859
  tuk: f("Tuk na pečenie", "pantry", [717, 0.2, 0.7, 0, 80.7, 15.2, 0, 0.01], { pack: { g: 250 }, al: [], check: true }), // fdc 173585
  med: f("Med", "pantry", [304, 0.3, 82.4, 82.1, 0, 0, 0.2, 0.01], { lyz: 20, lyzk: 7, pack: { g: 500 }, al: [] }), // fdc 169640
  kondenz: f("Kondenzované mlieko sladené", "pantry", [321, 7.9, 54.4, 54.4, 8.7, 5.5, 0, 0.32], { g: 397, pack: { ks: 1 }, al: ["mlieko"] }), // fdc 171275
  soda: f("Sóda bikarbóna", "pantry", [0, 0, 0, 0, 0, 0, 0, 68.4], { lyzk: 4.6, pack: { g: 20 }, al: [] }), // fdc 175040
  orechy: f("Vlašské orechy", "pantry", [654, 15.2, 13.7, 2.6, 65.2, 6.1, 6.7, 0.01], { pack: { g: 100 }, al: ["orechy"] }), // fdc 170187
  lasagne: f("Lasagne platne", "pantry", [371, 13, 74.7, 2.7, 1.5, 0.3, 3.2, 0.01], { pack: { g: 500 }, al: ["lepok"], check: true }), // fdc 168927
  zeler_stopkovy: f("Zeler stopkový", "produce", [14, 0.7, 3, 1.3, 0.2, 0, 1.6, 0.2], { g: 40, pack: { ks: 1 }, al: ["zeler"] }), // fdc 169988
  muskat: f("Muškátový orech", "pantry", [525, 5.8, 49.3, 3, 36.3, 25.9, 20.8, 0.04], { lyzk: 2.2, pack: { g: 20 }, al: [] }), // fdc 171326
  // ---------------------------------------------------- recepty overené metódou „kotva“ (15. 11. 2026), USDA SR Legacy
  bobkovy_list: f("Bobkový list", "pantry", [313, 7.6, 75, 0, 8.4, 2.3, 26.3, 0.06], { g: 0.2, pack: { g: 10 }, al: [] }), // fdc 170917
  nove_korenie: f("Nové korenie", "pantry", [263, 6.1, 72.1, 0, 8.7, 2.5, 21.6, 0.19], { g: 0.1, lyzk: 2, pack: { g: 20 }, al: [] }), // fdc 171315
  korenie_cele: f("Čierne korenie celé", "pantry", [251, 10.4, 64, 0.6, 3.3, 1.4, 25.3, 0.05], { g: 0.06, lyzk: 3, pack: { g: 30 }, al: [] }), // ako mleté
  skorica: f("Škorica mletá", "pantry", [247, 4, 80.6, 2.2, 1.2, 0.3, 53.1, 0.03], { lyz: 8, lyzk: 2.6, pack: { g: 20 }, al: [] }), // fdc 171320
  rimska_rasca: f("Rímska rasca (kmín)", "pantry", [375, 17.8, 44.2, 2.2, 22.3, 1.5, 10.5, 0.42], { lyz: 6, lyzk: 2, pack: { g: 30 }, al: [] }), // fdc 170923
  chilli: f("Chilli mleté", "pantry", [318, 12, 56.6, 10.3, 17.3, 3.3, 27.2, 0.07], { lyz: 5.4, lyzk: 1.8, pack: { g: 30 }, al: [] }), // fdc 170932
  udene: f("Údené bravčové mäso", "meat_fish", [269, 16.5, 0, 0, 22, 7.9, 0, 3.12], { loose: true, al: [] }), // fdc 168288
  klobasa: f("Údená klobása", "meat_fish", [313, 13.3, 1.9, 0, 27.6, 9.7, 0, 2.93], { g: 120, pack: { g: 250 }, al: [], check: true }), // fdc 172939
  huby_susene: f("Sušené huby", "pantry", [296, 9.6, 75.4, 2.2, 1, 0.2, 11.5, 0.03], { pack: { g: 20 }, al: [] }), // fdc 168436
  baklazan: f("Baklažán", "produce", [25, 1, 5.9, 3.5, 0.2, 0, 3, 0.01], { g: 300, loose: true, al: [] }), // fdc 169228
  pretlak: f("Paradajkový pretlak", "pantry", [82, 4.3, 18.9, 12.2, 0.5, 0.1, 4.1, 0.15], { lyz: 16, lyzk: 5.5, pack: { g: 70 }, al: [] }), // fdc 170459
  paradajky_kraj: f("Krájané paradajky (konzerva)", "pantry", [16, 0.8, 3.5, 2.5, 0.2, 0, 1.9, 0.29], { pack: { g: 400 }, al: [] }), // fdc 170051
  fazula: f("Červená fazuľa (konzerva)", "pantry", [124, 8, 21.5, 3.8, 1.1, 0.2, 5.5, 0.58], { g: 240, pack: { ks: 1 }, al: [] }), // fdc 174285, scedená
} satisfies Record<string, Food>);

/** Čo býva doma vždy (v „Čo máš doma?“ je predvolene označené). */
export const STAPLE_KEYS = ["sol", "olej", "korenie", "cukor", "rasca", "paprika_mleta", "muka"];
