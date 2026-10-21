/** Recept: katalógový (id z katalógu) alebo vlastný z databázy (uuid, mine = true). */
export type Unit = "g" | "ml" | "ks" | "lyzica" | "lyzicka" | "strucik" | "stipka" | (string & {});

export type Ingredient = {
  /** Kľúč suroviny: z databázy potravín (foods.ts) alebo vlastný – podľa neho sa dopĺňajú množstvá v krokoch {kľúč}. */
  food: string;
  /** Názov, ak surovina nie je v databáze potravín. */
  label?: string;
  qty: number;
  unit: Unit;
  note?: string;
  /** Neisté miesto po čítaní (len pri kontrole importu). */
  uncertain?: string | null;
};

export type Step = {
  text: string;
  timerMin?: number | null;
  /** Čaká sa (dusenie, pečenie…) – ukáže sa časovač. */
  wait?: boolean;
  /** Podrobnosti kroku pri varení. */
  done?: string;
  tip?: string;
  more?: string;
  uncertain?: string | null;
};

export type QA = { q: string; a: string };

export type RecipeCategory = "hlavne" | "cestoviny" | "polievky" | "sladke" | "ranajky" | "salaty";
export type Meat = "kuracie" | "bravcove" | "hovadzie" | "ryby" | "bez";

export type Recipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  meat: Meat;
  minutes: number;
  difficulty: 1 | 2 | 3;
  portions: number;
  hue: number;
  icon: string;
  tags: string[];
  source: string;
  sourceUrl?: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  qa?: QA[];
  mine?: boolean;
  ai?: boolean;
};
