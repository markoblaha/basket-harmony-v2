/**
 * Oblasti rodinného rozpočtu: kategórie zoskupené tak, ako o peniazoch rozmýšľa
 * domácnosť (Strava, Auto a benzín, Bývanie...). Je to len pohľad – v databáze
 * zostávajú podrobné kategórie, takže sa nič nestratí.
 */
export type Area = { id: string; name: string; emoji: string; hue: number; categories: string[] };

export const AREAS: Area[] = [
  {
    id: "food",
    name: "Strava",
    emoji: "🍽️",
    hue: 140,
    categories: [
      "groceries", "produce", "bakery", "dairy_eggs", "deli_chilled", "meat_fish", "frozen", "pantry",
      "breakfast", "snacks_sweets", "beverages", "dining",
    ],
  },
  { id: "alcohol", name: "Alkohol", emoji: "🍷", hue: 350, categories: ["alcohol"] },
  { id: "household", name: "Drogéria a domácnosť", emoji: "🧴", hue: 290, categories: ["household_cleaning", "personal_care", "home", "pet"] },
  { id: "kids", name: "Deti", emoji: "🧸", hue: 310, categories: ["baby", "toys_hobby"] },
  { id: "car", name: "Auto a benzín", emoji: "⛽", hue: 275, categories: ["fuel", "transport"] },
  { id: "housing", name: "Bývanie a energie", emoji: "🏠", hue: 25, categories: ["housing"] },
  { id: "telecom", name: "Telefón a predplatné", emoji: "📱", hue: 200, categories: ["telecom"] },
  { id: "health", name: "Zdravie", emoji: "💊", hue: 0, categories: ["health"] },
  { id: "clothing", name: "Oblečenie", emoji: "👕", hue: 260, categories: ["clothing"] },
  { id: "leisure", name: "Voľný čas", emoji: "🎟️", hue: 60, categories: ["leisure", "electronics"] },
  { id: "finance", name: "Poistenie a poplatky", emoji: "🛡️", hue: 220, categories: ["insurance", "fees"] },
  { id: "other", name: "Ostatné", emoji: "📦", hue: 280, categories: ["other", "deposit", "_unassigned", "_receipt_discount"] },
];

const BY_CATEGORY = new Map(AREAS.flatMap((a) => a.categories.map((c) => [c, a] as const)));

/** Oblasť kategórie; neznáma kategória patrí do Ostatné. */
export function areaOf(categoryId: string): Area {
  return BY_CATEGORY.get(categoryId) ?? AREAS[AREAS.length - 1]!;
}

export type AreaTotal = {
  area: Area;
  amount: number;
  prev: number;
  categories: { id: string; amount: number; items: number; prev_amount: number }[];
};

/** Sčíta kategórie do oblastí (zoradené od najväčšej). */
export function groupByArea(categories: { id: string; amount: number; items: number; prev_amount: number }[]): AreaTotal[] {
  const map = new Map<string, AreaTotal>();
  for (const c of categories) {
    const area = areaOf(c.id);
    const t = map.get(area.id) ?? { area, amount: 0, prev: 0, categories: [] };
    t.amount += c.amount;
    t.prev += c.prev_amount;
    t.categories.push(c);
    map.set(area.id, t);
  }
  return [...map.values()]
    .map((t) => ({ ...t, amount: Math.round(t.amount * 100) / 100, prev: Math.round(t.prev * 100) / 100 }))
    .filter((t) => t.amount !== 0 || t.prev !== 0)
    .sort((a, b) => b.amount - a.amount);
}
