/*
 * Databáza potravín pre recepty (z prototypu; hodnoty na 100 g jedlej časti, orientačne podľa
 * bežných tabuliek USDA / EuroFIR). Názvy sú údaje (ako názvy produktov), nie text rozhrania.
 * n: [kcal, bielkoviny, sacharidy, z toho cukry, tuky, z toho nasýtené, vláknina, soľ] alebo null = bez údajov.
 * g = hmotnosť 1 kusu, lyz = g v 1 lyžici, lyzk = g v 1 lyžičke, dens = g v 1 ml,
 * loose = kupuje sa na váhu, pack = bežné balenie v obchode (g | ml | ks).
 * cat = kategória položky v nákupnom zozname.
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
};

type Opts = Partial<Pick<Food, "g" | "lyz" | "lyzk" | "dens" | "loose" | "pack">>;
function f(name: string, cat: string, n: number[] | null, o: Opts = {}): Food {
  return { name, cat, n, g: o.g ?? null, lyz: o.lyz ?? 15, lyzk: o.lyzk ?? 5, dens: o.dens ?? 1, loose: !!o.loose, pack: o.pack ?? null };
}

export const FOODS: Record<string, Food> = {
  // ---------------------------------------------------- vždy doma (state.staples)
  sol: f("Soľ", "pantry", [0, 0, 0, 0, 0, 0, 0, 100], { lyz: 18, lyzk: 6, pack: { g: 1000 } }),
  olej: f("Olej", "pantry", [884, 0, 0, 0, 100, 10, 0, 0], { lyz: 13, lyzk: 4.5, dens: 0.92, pack: { ml: 1000 } }),
  korenie: f("Čierne korenie", "pantry", [251, 10.4, 64, 0.6, 3.3, 1.4, 25, 0.05], { lyz: 7, lyzk: 2.5, pack: { g: 50 } }),
  cukor: f("Cukor", "pantry", [400, 0, 100, 100, 0, 0, 0, 0], { lyz: 12, lyzk: 4, pack: { g: 1000 } }),
  rasca: f("Rasca", "pantry", [333, 19.8, 50, 0.6, 14.6, 0.6, 38, 0.04], { lyz: 6, lyzk: 2, pack: { g: 30 } }),
  paprika_mleta: f("Mletá sladká paprika", "pantry", [282, 14, 54, 10, 13, 2.1, 35, 0.2], { lyz: 7, lyzk: 2.5, pack: { g: 50 } }),
  muka: f("Hladká múka", "pantry", [345, 10, 72, 0.3, 1, 0.2, 3, 0], { lyz: 10, lyzk: 3, pack: { g: 1000 } }),

  // ---------------------------------------------------- mäso a ryby
  pliecko: f("Bravčové pliecko", "meat_fish", [200, 17, 0, 0, 15, 5.5, 0, 0.15], { loose: true }),
  krkovicka: f("Bravčová krkovička", "meat_fish", [250, 16, 0, 0, 21, 7.5, 0, 0.15], { loose: true }),
  bravcove_stehno: f("Bravčové stehno (rezne)", "meat_fish", [140, 21, 0, 0, 6, 2, 0, 0.15], { loose: true }),
  kuracie_prsia: f("Kuracie prsia", "meat_fish", [110, 23, 0, 0, 1.5, 0.4, 0, 0.15], { loose: true }),
  kuracie_stehna: f("Kuracie stehná", "meat_fish", [200, 18, 0, 0, 14, 4, 0, 0.2], { loose: true, g: 250 }),
  hovadzie: f("Hovädzie zadné", "meat_fish", [140, 21, 0, 0, 6, 2.5, 0, 0.15], { loose: true }),
  mlete: f("Mleté mäso zmiešané", "meat_fish", [260, 17, 0, 0, 21, 8, 0, 0.2], { pack: { g: 500 } }),
  slanina: f("Slanina", "meat_fish", [400, 13, 0.5, 0, 38, 14, 0, 3], { pack: { g: 150 } }),
  parky: f("Párky", "meat_fish", [280, 12, 2, 1, 25, 9, 0, 2.2], { g: 50, pack: { g: 250 } }),
  losos: f("Losos filet", "meat_fish", [208, 20, 0, 0, 13, 3.1, 0, 0.15], { pack: { g: 200 } }),

  // ---------------------------------------------------- ovocie a zelenina
  cibula: f("Cibuľa", "produce", [40, 1.1, 9.3, 4.2, 0.1, 0, 1.7, 0], { g: 110, loose: true }),
  cervena_cibula: f("Červená cibuľa", "produce", [40, 1.1, 9.3, 4.2, 0.1, 0, 1.7, 0], { g: 120, loose: true }),
  cesnak: f("Cesnak", "produce", [149, 6.4, 33, 1, 0.5, 0.1, 2.1, 0.04], { g: 40, pack: { ks: 1 } }),
  zemiaky: f("Zemiaky", "produce", [77, 2, 17, 0.8, 0.1, 0, 2.2, 0], { g: 150, loose: true }),
  mrkva: f("Mrkva", "produce", [41, 0.9, 9.6, 4.7, 0.2, 0, 2.8, 0.17], { g: 80, loose: true }),
  petrzlen: f("Petržlen koreň", "produce", [55, 3, 12, 4.9, 0.6, 0.1, 4.3, 0.03], { g: 80, loose: true }),
  zeler: f("Zeler", "produce", [42, 1.5, 9.2, 1.6, 0.3, 0.1, 1.8, 0.25], { g: 400, loose: true }),
  sampinony: f("Šampiňóny", "produce", [22, 3.1, 3.3, 2, 0.3, 0.1, 1, 0.01], { pack: { g: 250 } }),
  paradajky: f("Paradajky", "produce", [18, 0.9, 3.9, 2.6, 0.2, 0, 1.2, 0.01], { g: 120, loose: true }),
  uhorka: f("Uhorka šalátová", "produce", [15, 0.7, 3.6, 1.7, 0.1, 0, 0.5, 0], { g: 300 }),
  paprika: f("Paprika", "produce", [31, 1, 6, 4.2, 0.3, 0, 2.1, 0], { g: 150, loose: true }),
  brokolica: f("Brokolica", "produce", [34, 2.8, 6.6, 1.7, 0.4, 0, 2.6, 0.08], { g: 400 }),
  citron: f("Citrón", "produce", [29, 1.1, 9.3, 2.5, 0.3, 0, 2.8, 0], { g: 100 }),
  kopor: f("Kôpor čerstvý", "produce", [43, 3.5, 7, 0, 1.1, 0, 2.1, 0.15], { lyz: 4, pack: { ks: 1 } }),
  cucoriedky: f("Čučoriedky", "produce", [57, 0.7, 14, 10, 0.3, 0, 2.4, 0], { pack: { g: 125 } }),
  brusnice: f("Brusnice (kompót)", "pantry", null, { pack: { g: 200 } }),

  // ---------------------------------------------------- mliečne a vajcia
  kysla_smotana: f("Kyslá smotana", "dairy_eggs", [190, 2.8, 3.4, 3.4, 18, 11.5, 0, 0.1], { pack: { g: 200 } }),
  smotana: f("Smotana na varenie", "dairy_eggs", [135, 2.8, 4, 4, 12, 7.5, 0, 0.1], { pack: { ml: 200 } }),
  mlieko: f("Mlieko polotučné", "dairy_eggs", [46, 3.4, 4.8, 4.8, 1.5, 1, 0, 0.1], { dens: 1.03, pack: { ml: 1000 } }),
  vajce: f("Vajcia", "dairy_eggs", [143, 12.6, 0.7, 0.4, 9.5, 3.1, 0, 0.36], { g: 50, pack: { ks: 10 } }),
  maslo: f("Maslo", "dairy_eggs", [740, 0.7, 0.6, 0.6, 82, 52, 0, 0.02], { lyz: 14, pack: { g: 250 } }),
  parmezan: f("Parmezán", "dairy_eggs", [392, 36, 3, 0.8, 26, 16, 0, 1.6], { pack: { g: 100 } }),
  eidam: f("Eidam", "dairy_eggs", [340, 25, 0, 0, 27, 17, 0, 1.6], { pack: { g: 100 } }),
  bryndza: f("Bryndza", "dairy_eggs", [260, 14, 2, 2, 21, 14, 0, 2.4], { pack: { g: 125 } }),
  feta: f("Feta", "dairy_eggs", [264, 14, 4, 4, 21, 15, 0, 2.8], { pack: { g: 200 } }),
  tvaroh: f("Tvaroh", "dairy_eggs", [120, 13, 3.5, 3.5, 6, 4, 0, 0.08], { pack: { g: 250 } }),

  // ---------------------------------------------------- trvanlivé a pečivo
  spagety: f("Špagety", "pantry", [359, 13, 71, 3, 1.5, 0.3, 3, 0.01], { pack: { g: 500 } }),
  cestoviny: f("Cestoviny (kolienka)", "pantry", [359, 13, 71, 3, 1.5, 0.3, 3, 0.01], { pack: { g: 500 } }),
  ryza: f("Ryža", "pantry", [360, 7, 79, 0.1, 0.6, 0.2, 1.3, 0], { pack: { g: 1000 } }),
  sosovica: f("Šošovica", "pantry", [352, 25, 60, 2, 1.1, 0.2, 11, 0.02], { pack: { g: 500 } }),
  struhanka: f("Strúhanka", "pantry", [395, 13, 72, 6, 5, 1, 4.5, 1.2], { pack: { g: 250 } }),
  pasirovane: f("Pasírované paradajky", "pantry", [32, 1.4, 5.5, 4.5, 0.2, 0, 1.5, 0.2], { pack: { g: 500 } }),
  kapusta: f("Kyslá kapusta", "pantry", [20, 1, 4.3, 1.8, 0.1, 0, 2.9, 1.7], { pack: { g: 500 } }),
  kokosove_mlieko: f("Kokosové mlieko", "pantry", [197, 2, 3, 2, 20, 18, 0, 0.05], { pack: { ml: 400 } }),
  kari: f("Kari pasta", "pantry", [200, 3, 15, 6, 14, 2, 4, 6], { lyz: 15, pack: { g: 100 } }),
  horcica: f("Horčica plnotučná", "pantry", [150, 6, 12, 7, 9, 0.5, 4, 5.5], { lyz: 15, lyzk: 5, pack: { g: 200 } }),
  olivovy_olej: f("Olivový olej", "pantry", [884, 0, 0, 0, 100, 14, 0, 0], { lyz: 13, dens: 0.92, pack: { ml: 500 } }),
  olivy: f("Olivy", "pantry", [145, 1, 4, 0, 15, 2, 3, 3], { pack: { g: 150 } }),
  oregano: f("Oregano sušené", "pantry", [265, 9, 69, 4, 4.3, 1.6, 42, 0.04], { lyz: 3, lyzk: 1, pack: { g: 10 } }),
  majoran: f("Majorán sušený", "pantry", [271, 12.7, 60, 4.1, 7, 0.5, 40, 0.2], { lyz: 3, lyzk: 1, pack: { g: 10 } }),
  ocot: f("Ocot", "pantry", [18, 0, 0.6, 0.6, 0, 0, 0, 0], { lyz: 15, lyzk: 5, pack: { ml: 1000 } }),
  prasok: f("Kypriaci prášok", "pantry", [53, 0, 28, 0, 0, 0, 0, 26], { lyzk: 4, pack: { g: 12 } }),
  drozdie: f("Droždie", "dairy_eggs", [105, 8.4, 18, 0, 1.9, 0.3, 8, 0.1], { pack: { g: 42 } }),
  dzem: f("Džem / lekvár", "pantry", [250, 0.4, 61, 55, 0.1, 0, 1, 0], { lyz: 20, pack: { g: 340 } }),
  uhorky_kysle: f("Kyslé uhorky", "pantry", [12, 0.3, 2.3, 1.1, 0.2, 0, 1, 2], { g: 60, pack: { g: 670 } }),
  knedla: f("Knedľa parená", "bakery", [230, 7, 45, 2, 2, 0.5, 2, 1], { g: 400, pack: { ks: 1 } }),
  chlieb: f("Chlieb", "bakery", [250, 8.5, 48, 3, 1.5, 0.3, 5, 1.2], { g: 40, pack: { g: 500 } }),
};

/** Čo býva doma vždy (v „Čo máš doma?“ je predvolene označené). */
export const STAPLE_KEYS = ["sol", "olej", "korenie", "cukor", "rasca", "paprika_mleta", "muka"];
