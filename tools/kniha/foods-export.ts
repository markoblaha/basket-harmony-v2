// Databáza potravín z appky do JSON pre výber receptov: npx vite-node tools/kniha/foods-export.ts > tools/kniha/data/foods.json
import { FOODS } from "../../src/features/recipes/foods";
console.log(JSON.stringify(FOODS));
