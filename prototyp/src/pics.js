// Fotky jedál: každý recept (aj nový z AI) dostane skutočnú fotku podľa názvu a štítku.
// Pravidlá idú zhora nadol, prvá zhoda vyhráva. Text sa porovnáva bez diakritiky.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const RULES = [
  [/kolacik|susienk|cookie|sutienk/, ['n_muffin', 'n_cokolada']],
  [/jablk\w*\s+(kolac|zavin|babovk|torta|placky|rezy)|kolac\w*\s+(s\s+)?jablk|jablkovo/, ['n_jablkovykolac', 'n_kolac']],
  [/cheesecake|tvarohov\w*\s+(kolac|torta)|syrnik/, 'n_cheesecake'],
  [/muffin|babovk/, ['n_muffin', 'n_kolac']],
  [/cokolad|brownie|kakaov/, ['n_cokolada', 'n_muffin']],
  [/vafl/, 'n_vafle'],
  [/palacink|lievanc|placky\s+sladk/, 'palacinky_p'],
  [/crepe/, 'n_crepe'],
  [/kolac|torta|dort|zavin|pernik|dezert|tiramisu/, ['n_kolac', 'n_jablkovykolac', 'n_cheesecake']],
  [/puding|flan|panna cotta|krem\b/, 'n_puding'],
  [/smoothie|kokteil|shake/, 'n_smoothie'],
  [/quiche|slany kolac/, 'n_quiche'],
  [/omelet|volske oko|miesane vajic|praz\w*\s+vajic/, 'n_omeleta'],
  [/salat|caprese|grecky/, 'salat_p'],
  [/vajic|vajec|raňajk|ranajk/, 'n_vajcia'],
  [/granola|ovsen|jogurtov\w*\s+misk|jogurt s ovoc/, 'n_jogurt'],
  [/tvaroh|cottage/, 'n_tvaroh'],
  [/lasag|zapek\w*\s+cestovin/, 'n_lasagne'],
  [/bolon|boloň|mlet\w*\s+maso.*cestovin|spagety|spaghetti/, 'n_bolonske'],
  [/carbonar|alfredo|cestovin|tagliatelle|makaron|penne/, 'penne_p'],
  [/rezance|nudle|ramen|pad thai|lo mein/, 'n_rezance'],
  [/wok|stir.?fry|zeleninov\w*\s+(mix|panvic)/, 'n_wok'],
  [/sushi|maki|nigiri/, 'n_sushi'],
  [/rezen|schnitzel|vyprazan|smazen/, 'n_rezen'],
  [/halusk|gnocchi|kopytk/, 'n_gnocchi'],
  [/knedl|pirohy|taske|dumpling/, 'n_knedle'],
  [/plnen\w*\s*(paprik|cuket|kapust)|plnen/, 'n_plnenepaprika'],
  [/gulky|gulicky|fasirk|kofta|mlet\w*\s+maso|zavitky/, 'n_gulky'],
  [/hrasok|hrachov|sosovic|fazul|cizrn|dal\b/, 'n_hrasok'],
  [/gulas|perkelt|paprikas/, 'gulas_p'],
  [/kari|curry|tikka/, 'kari_p'],
  [/polievk|vyvar|krem z/, 'p_paradajkova'],
  [/rizoto|risotto/, 'rizoto_p'],
  [/ryza|ryzov/, 'x_rizoto'],
  [/losos|treska|pstruh|ryb|filet/, 'losos_p'],
  [/steak|hovadz|rostenec|svieckov/, 'p_steak'],
  [/kuracie|kura\b|kurac|stehn|prsia|krid|pecen\w*\s+kur/, 'stehna_p'],
  [/pizza/, 'x_pizza'],
  [/sendvic|toast|hrianka|wrap|bagetk|burrito|tortil|tacos?/, 'n_sendvic'],
  [/hub|hriby|hribov|sampin/, 'n_huby'],
  [/zemiak|hranolk|opekan|pecen\w*\s+zemiak|kasa/, 'n_zemiaky'],
  [/gril|pecen\w*\s+zelenin|ratatouille|zapek\w*\s+zelenin/, 'n_grilzelenina'],
  [/hummus|nátierk|natierk|pomazank|dip\b/, 'n_hummus'],
  [/chlieb|pecivo|focaccia|bochnik|kvasok|rozky/, 'n_chlebpecenie'],
  [/salat|caprese|grecky/, 'salat_p'],
  [/zelenin|kapust|brokolic|mrkv|cuket|tekvic/, 'n_wok'],
];
// Rezerva podľa kategórie, keď sa nič nehodí
const BY_CAT = { polievky: 'p_zeleninova', maso: 'p_steak', kuracie: 'stehna_p', ryby: 'losos_p', cestoviny: 'penne_p', salaty: 'salat_p', sladke: 'n_kolac', rychle: 'n_sendvic', bezmasa: 'n_wok' };
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pick = (pic, name) => (Array.isArray(pic) ? pic[hash(name || '') % pic.length] : pic);
export function picFor(r) {
  const t = norm([r.n, r.tag, r.diff, (r.tags || []).join(' ')].join(' '));
  for (const [re, pic] of RULES) if (re.test(t)) return pick(pic, r.n);
  const ing = norm((r.ing || []).map((x) => x[4] || '').join(' '));
  for (const [re, pic] of RULES.slice(0, 40)) if (re.test(ing)) return pick(pic, r.n);
  return (r.cat && BY_CAT[r.cat]) || null;
}
