// Napojenie na Claude cez schopnosť „sample“ v Artifacte. Keď nie je k dispozícii,
// appka použije miestne rozpoznávanie a ukážkové dáta – nič sa nepokazí.
import { PRODUCTS, RECIPES } from './data.js';

let p = null;
let denied = false;
export function getSample() {
  if (!p) p = (window.claude && window.claude.use ? window.claude.use('sample') : Promise.resolve(null)).catch(() => null);
  return p;
}
export async function aiAvailable() { return !denied && !!(await getSample()); }
export async function aiImages() {
  const s = await getSample(); if (!s) return false;
  try { const l = await s.limits(); return !!(l && l.images); } catch { return false; }
}
async function json(prompt, opts = {}) {
  const s = await getSample();
  if (!s || denied) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
  try { return await s.json(prompt, { modelTier: 'quick', ...opts }); }
  catch (e) { if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled' || e.code === 'capability_disabled')) denied = true; throw e; }
}
export function aiErrorText(e) {
  const c = e && e.code;
  if (c === 'unavailable') return 'AI tu nie je dostupná – použilo sa rozpoznávanie v telefóne.';
  if (c === 'not_granted') return 'Prístup k AI ste nepovolili – použilo sa rozpoznávanie v telefóne.';
  if (c === 'rate_limited') return 'AI je chvíľu vyťažená. Skúste to o minútu.';
  if (c === 'image_rejected') return 'Fotku sa nepodarilo prečítať. Skúste ju odfotiť ostrejšie.';
  return 'AI teraz neodpovedala – použilo sa rozpoznávanie v telefóne.';
}

const CATALOG = Object.values(PRODUCTS).map((x) => `${x.id}|${x.n}|${x.u}`).join('\n');
const RLIST = RECIPES.map((r) => `${r.id}|${r.n}`).join('\n');
export const EMOJI_KEYS = ['pot', 'rice', 'pancakes', 'poultry', 'curry', 'salad', 'spaghetti', 'fish', 'tomato', 'stew', 'sweetpotato', 'meat', 'carrot', 'bread', 'chicken', 'soup', 'pan', 'pizza', 'burger', 'sandwich', 'taco', 'dumpling', 'ramen', 'bowl', 'egg2', 'cake', 'cookie'];
const EMOJIS = EMOJI_KEYS.join(' ');

export function aiParseVoice(text) {
  return json(`Si hlasový asistent slovenskej rodinnej nákupnej aplikácie. Používateľ povedal (prepis reči, môže mať chyby):
"""${text}"""

Katalóg produktov domácnosti (id|názov|jednotka):
${CATALOG}

Recepty domácnosti (id|názov):
${RLIST}

Vráť IBA JSON v tvare:
{"intent":"items"|"recipe_search"|"recipe_add","items":[{"id":"id z katalógu alebo null","name":"názov v základnom tvare","qty":číslo alebo null,"unit":"kg"|"g"|"l"|"ml"|"ks"|"bal"|null}],"query":"čo hľadať v receptoch alebo null","recipe":"id receptu alebo null","say":"krátka odpoveď po slovensky, najviac 8 slov"}

Pravidlá: množstvo je počet kusov (kus, balík, strapec) – „dve mlieka“ = qty 2, unit null; „banány“ = qty null. Jednotku (g, kg, ml, l) daj LEN ak ju človek vyslovene povedal: „pol kila mletého“ = 0.5 kg, „300 gramov syra“ = 300 g, „dve deci smotany“ = 200 ml. Ak množstvo nezaznelo, qty = null.
Produkt mimo katalógu daj s id null a krátkym názvom. „Telové mlieko“ nie je „mlieko“.
„Niečo na guláš“ alebo „suroviny na palacinky“ = intent recipe_add s id receptu.
Otázka typu „čo uvariť z kuracieho“ = intent recipe_search, query = krátky popis.`);
}

export function aiRecipes(query, have, exclude = []) {
  const prods = Object.values(PRODUCTS).filter((x) => ['produce', 'meat_fish', 'deli_chilled', 'dairy_eggs', 'pantry', 'bakery', 'frozen'].includes(x.c)).map((x) => `${x.id}|${x.n}|${x.u}`).join('\n');
  return json(`Navrhni 4 rôzne recepty pre slovenskú rodinu (2 dospelí, malé dieťa) podľa požiadavky: "${query}".
Doma majú: ${have.map((h) => PRODUCTS[h] && PRODUCTS[h].n).filter(Boolean).join(', ')}.
${exclude.length ? 'Neopakuj tieto: ' + exclude.join(', ') + '.' : ''}
Suroviny priraď ku katalógu (id|názov|jednotka), množstvo „use“ je v jednotke katalógu (kg, l, ks alebo bal):
${prods}

Vráť IBA JSON pole 4 objektov:
[{"n":"názov","min":minúty,"kcal":kcal na porciu,"por":4,"e":"jedno z: ${EMOJIS}","tag":"krátky štítok","ing":[{"id":"id alebo null","name":"surovina","use":číslo,"label":"množstvo v recepte, napr. 300 g"}],"steps":[{"t":"krok, jedna veta","min":minúty alebo 0}]}]
Najviac 7 surovín a 5 krokov. Píš prirodzenou slovenčinou.`);
}

export function aiRecipeFromText(text) {
  return json(`Z tohto textu (nadiktovaný alebo vložený recept) sprav štruktúrovaný recept po slovensky:
"""${text}"""
Suroviny priraď ku katalógu (id|názov|jednotka), „use“ je v jednotke katalógu:
${CATALOG}
Vráť IBA JSON: {"n":"názov","min":minúty,"kcal":odhad na porciu,"por":počet porcií,"e":"jedno z: ${EMOJIS}","tag":"štítok","ing":[{"id":"id alebo null","name":"surovina","use":číslo,"label":"množstvo v recepte"}],"steps":[{"t":"krok","min":minúty alebo 0}]}`);
}

export function aiReceipt(images) {
  return json(`Na fotke je pokladničný bloček zo slovenského obchodu. Prečítaj ho a vráť IBA JSON:
{"store":"názov obchodu","date":"YYYY-MM-DD alebo null","time":"HH:MM alebo null","total":suma na úhradu,"lines":[{"raw":"text riadku z bločku","n":"čitateľný slovenský názov produktu v základnom tvare","id":"id z katalógu alebo null","q":množstvo,"u":"kg"|"l"|"ks","up":cena za jednotku,"t":suma riadku}]}
Zľavy odpočítaj od riadku, ku ktorému patria. Zálohy za obaly vynechaj.
Katalóg (id|názov|jednotka):
${CATALOG}`, { images, modelTier: 'default' });
}

export function aiRecipeFromImage(images) {
  return json(`Na fotke je recept (z kuchárskej knihy, časopisu alebo obrazovky). Prepíš ho po slovensky.
Suroviny priraď ku katalógu (id|názov|jednotka), „use“ je v jednotke katalógu:
${CATALOG}
Vráť IBA JSON: {"n":"názov","min":minúty,"kcal":odhad na porciu,"por":počet porcií,"e":"jedno z: ${EMOJIS}","tag":"štítok","ing":[{"id":"id alebo null","name":"surovina","use":číslo,"label":"množstvo v recepte"}],"steps":[{"t":"krok","min":minúty alebo 0}]}`, { images, modelTier: 'default' });
}
