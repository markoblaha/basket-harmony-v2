/*
 * Kniha receptov Basket Harmony – recepty spojené z 3–5 skutočných receptov z rôznych webov.
 * Pravidlá (prototyp/recepty-vyroba-navrh.html): surovina je v recepte, len keď ju má viac ako polovica
 * zdrojov (src = písmená zdrojov), množstvo je stredná hodnota zdrojov zaokrúhlená na kuchynskú mieru
 * a bežné balenie, každý krok a rada má zdroj, text je vlastnými slovami. Výživa a alergény sa počítajú
 * zo surovín (foods.ts, USDA), nič sa nepíše ručne. Kontroly sú v kniha.test.ts.
 * Obsah receptov je údaj (ako názov produktu), nie text rozhrania – preto nie je v i18n.
 */
import { FOODS, type Allergen } from "./foods";
import type { Ingredient, Recipe, Step } from "./types";

type I = [food: string, qty: number, unit: Ingredient["unit"], src: string, extra?: Partial<Ingredient>];
type S = [text: string, min: number, src: string, extra?: Partial<Step>];

const ings = (group: string, list: I[]): Ingredient[] =>
  list.map(([food, qty, unit, src, extra]) => ({ food, qty, unit, src, group, ...extra }));
const steps = (list: S[]): Step[] =>
  list.map(([text, min, src, extra]) => ({ text, timerMin: min || null, src, ...extra }));

export const BOOK: Recipe[] = [
  {
    id: "segedin",
    name: "Segedínsky guláš",
    category: "hlavne",
    meat: "bravcove",
    minutes: 120,
    difficulty: 2,
    portions: 4,
    hue: 25,
    icon: "CookingPot",
    tags: ["klasika"],
    source: "",
    book: {
      photos: 3,
      active: 35,
      cuisine: "Česko · Slovensko",
      tools: ["hrniec s hrubým dnom a pokrievkou (aspoň 4 l)", "miska a metlička"],
      store: "V chladničke 3 dni v uzavretej nádobe, dá sa zamraziť.",
      sources: [
        { k: "A", site: "toprecepty.cz", name: "Segedínský guláš", url: "https://www.toprecepty.cz/recept/1495-segedinsky-gulas/" },
        { k: "B", site: "apetitonline.cz", name: "Tradiční segedínský guláš", url: "https://www.apetitonline.cz/recept/tradicni-segedinsky-gulas" },
        { k: "C", site: "kucharkaprodceru.cz", name: "Segedínský guláš", url: "https://www.kucharkaprodceru.cz/segedinsky-gulas/" },
        { k: "D", site: "cooklikeczechs.com", name: "Segedínský guláš", url: "https://www.cooklikeczechs.com/?p=4756" },
        { k: "E", site: "kuchynalidla.sk", name: "Segedínsky guláš", url: "https://kuchynalidla.sk/recepty/segedinsky-gulas" },
      ],
    },
    ingredients: [
      ...ings("Mäso a základ", [
        ["pliecko", 700, "g", "ABCDE", { note: "alebo bravčové kocky na guláš" }],
        ["mast", 1, "lyzica", "BCD", { note: "alebo olej" }],
        ["cibula", 2, "ks", "ABCDE"],
        ["cesnak", 2, "strucik", "BDE"],
        ["rasca", 1, "lyzicka", "ABCD"],
        ["paprika_mleta", 1, "lyzica", "ABCDE", { note: "sladká" }],
        ["sol", 1, "lyzicka", "ABCDE"],
        ["korenie", 1, "stipka", "ABE"],
        ["vyvar", 750, "ml", "BDE", { label: "Vývar alebo voda", note: "hovädzí alebo bravčový" }],
      ]),
      ...ings("Kapusta a omáčka", [
        ["kapusta", 500, "g", "ABCDE"],
        ["smotana_sladka", 200, "ml", "ABE", { note: "na šľahanie alebo na varenie" }],
        ["muka", 2, "lyzica", "ABCDE"],
      ]),
      ...ings("Na podávanie", [["knedla", 1, "ks", "BCE", { label: "Žemľová knedľa" }]]),
    ],
    steps: steps([
      ["Mäso nakrájaj na kocky asi 3 cm a osuš papierovou utierkou. Cibuľu nakrájaj nadrobno, cesnak nasekaj.", 0, "CDE"],
      ["V hrnci s hrubým dnom rozohrej masť a opekaj cibuľu. Na konci pridaj cesnak a chvíľu ho opekaj s ňou.", 8, "ABDE", {
        heat: "stredný oheň", done: "Cibuľa je mäkká a sklovito zlatistá, nie hnedá." }],
      ["Pridaj mäso, rascu, soľ a korenie a opekaj, kým mäso zo všetkých strán nezbelie.", 6, "ABCDE", {
        heat: "silnejší oheň", warn: "Ak je mäsa veľa, opekaj ho po dávkach. Naraz pustí vodu a bude sa variť, nie opekať." }],
      ["Hrniec stiahni z ohňa, vmiešaj papriku a hneď podlej trochou vývaru.", 0, "ACE", {
        warn: "Paprika na horúcom tuku za pár sekúnd zhorkne a celé jedlo bude horké." }],
      ["Vráť hrniec na oheň a podlej zvyšným vývarom ({vyvar} spolu), aby bolo mäso takmer zakryté. Prikry a dus.", 50, "BCDE", {
        heat: "mierny oheň", wait: true, done: "Mäso je takmer mäkké. Ochutnaj kúsok." }],
      ["Kapustu ochutnaj. Ak je veľmi kyslá, krátko ju prepláchni studenou vodou a vytlač, inak ju len sceď. Nakrájaj ju na kratšie kúsky, vmiešaj k mäsu a dus ďalej pod pokrievkou.", 25, "ABCDE", {
        heat: "mierny oheň", wait: true, done: "Kúsok mäsa sa ľahko roztlačí vidličkou." }],
      ["V miske vymiešaj smotanu s múkou dohladka. Za stáleho miešania ju vlej do guláša a povar.", 12, "ACE", {
        heat: "mierny oheň", wait: true, done: "Omáčka zhustne a jemne obalí lyžicu." }],
      ["Dochuť soľou a korením a podávaj s knedľou.", 0, "ABDE", {
        tip: "Kto má rád, dá na tanier lyžicu kyslej smotany. Na druhý deň je segedín ešte lepší." }],
    ]),
  },
  {
    id: "paprikas",
    name: "Kurací paprikáš s haluškami",
    category: "hlavne",
    meat: "kuracie",
    minutes: 80,
    difficulty: 2,
    portions: 4,
    hue: 20,
    icon: "Drumstick",
    tags: ["klasika"],
    source: "",
    book: {
      photos: 3,
      active: 40,
      cuisine: "Slovensko · Maďarsko · Česko",
      tools: ["široký hrniec s pokrievkou", "veľký hrniec na halušky", "sitko na halušky", "miska a metlička"],
      store: "Paprikáš v chladničke 2 dni, halušky zvlášť. Halušky prehrej na troche masla.",
      sources: [
        { k: "A", site: "apetitonline.cz", name: "Kuře na paprice s noky", url: "https://www.apetitonline.cz/recept/kure-na-paprice-s-noky" },
        { k: "B", site: "kucharkaprodceru.cz", name: "Kuře na paprice", url: "https://www.kucharkaprodceru.cz/kure-na-paprice/" },
        { k: "C", site: "nosalty.hu", name: "Klasszikus csirkepaprikás", url: "https://www.nosalty.hu/recept/klasszikus-csirkepaprikas" },
        { k: "D", site: "toprecepty.cz", name: "Kuřecí paprikáš", url: "https://www.toprecepty.cz/recept/1474-kureci-paprikas/" },
        { k: "E", site: "vareni.cz", name: "Klasické kuře na paprice", url: "https://www.vareni.cz/recepty/klasicke-kure-na-paprice/" },
        { k: "F", site: "nosalty.hu", name: "Nokedli egyszerűen", url: "https://www.nosalty.hu/recept/nokedli-tokeletes" },
        { k: "G", site: "toprecepty.cz", name: "Halušky", url: "https://www.toprecepty.cz/recept/1363-halusky/" },
        { k: "H", site: "apetitonline.cz", name: "Halušky", url: "https://www.apetitonline.cz/recept/halusky" },
        { k: "I", site: "kuchynalidla.sk", name: "Kurací perkelt so smotanou a haluškami", url: "https://kuchynalidla.sk/recepty/kuraci-perkelt-so-smotanou-a-haluskami" },
      ],
      groupSources: { "Paprikáš": "ABCDE", "Halušky": "FGHI" },
    },
    ingredients: [
      ...ings("Paprikáš", [
        ["kurca", 1, "ks", "ABDE", { note: "rozdelené na 8 kúskov, alebo 8 kuracích stehien" }],
        ["olej", 2, "lyzica", "BCD"],
        ["cibula", 1, "ks", "ABCDE", { note: "väčšia" }],
        ["paprika_mleta", 1, "lyzica", "ABCDE", { note: "sladká" }],
        ["sol", 1, "lyzicka", "ABCDE"],
        ["voda", 500, "ml", "BCD"],
        ["smotana", 250, "ml", "ABDE", { note: "12 %" }],
        ["muka", 3, "lyzica", "ABCDE"],
      ]),
      ...ings("Halušky", [
        ["muka", 300, "g", "FGHI", { ref: "muka_h", note: "hladká alebo polohrubá" }],
        ["vajce", 1, "ks", "FGHI"],
        ["voda", 200, "ml", "FGI", { ref: "voda_h", note: "podľa potreby" }],
        ["sol", 0.5, "lyzicka", "FGI", { ref: "sol_h" }],
        ["sol", 1, "lyzica", "FGHI", { ref: "sol_v", note: "do vody" }],
        ["maslo", 1, "lyzica", "FI", { optional: true }],
      ]),
    ],
    steps: steps([
      ["Kurča rozdeľ na 8 kúskov, osuš ho a zo všetkých strán osoľ.", 0, "ABE"],
      ["V širokom hrnci rozohrej olej a mäso v jednej vrstve zľahka opeč z oboch strán. Vyber ho na tanier.", 10, "ABD", {
        heat: "stredný oheň", done: "Mäso je na povrchu svetlo zatiahnuté. Nemusí byť zlaté." }],
      ["Vo výpeku opekaj nadrobno nakrájanú cibuľu do mäkka.", 6, "ABCDE", {
        heat: "stredný oheň", done: "Cibuľa je mäkká a sklovitá." }],
      ["Hrniec stiahni z ohňa, vmiešaj papriku a hneď podlej {voda} vody.", 0, "BCE", {
        warn: "Paprika na horúcom tuku za pár sekúnd zhorkne." }],
      ["Vráť mäso do hrnca, priveď k miernemu varu, prikry a dus. V polovici mäso obráť.", 45, "ABCE", {
        heat: "mierny oheň", wait: true, done: "Mäso sa ľahko oddeľuje od kosti a pri kosti má aspoň 74 °C." }],
      ["Medzitým priprav halušky: v miske zmiešaj {muka_h} múky, vajce a {sol_h} soli. Postupne prilievaj vodu, kým nevznikne husté lesklé cesto, ktoré pomaly steká z lyžice.", 0, "FGHI", {
        tip: "Ak je cesto príliš tuhé, prilej lyžicu vody." }],
      ["Vo veľkom hrnci priveď do varu vodu s lyžicou soli. Cesto pretláčaj cez sitko na halušky priamo do vody a halušky jemne premiešaj, aby sa nezlepili.", 3, "FGHI", {
        heat: "silný oheň", wait: true, done: "Halušky vyplávajú na hladinu. Vtedy ich var ešte 2 minúty.", warn: "Nevkladaj všetko cesto naraz, halušky by sa zlepili. Rob ich na 2 až 3 dávky." }],
      ["Halušky sceď a premiešaj s maslom, aby sa nelepili.", 0, "FI"],
      ["Mäso vyber z hrnca. Múku rozmiešaj v smotane dohladka, primiešaj do nej naberačku horúcej omáčky a až potom ju vlej do hrnca. Povar za občasného miešania.", 15, "ACDE", {
        heat: "mierny oheň", wait: true, warn: "Studenú smotanu nevlievaj rovno do vriacej omáčky, zrazila by sa.", tip: "Ak chceš úplne hladkú omáčku, pred pridaním smotany ju rozmixuj ponorným mixérom." }],
      ["Mäso vráť do omáčky, nechaj ho prehriať a dochuť soľou. Podávaj s haluškami.", 3, "ABDE"],
    ]),
  },
  {
    id: "kulajda",
    name: "Kulajda s vajcom",
    category: "polievky",
    meat: "bez",
    minutes: 45,
    difficulty: 1,
    portions: 4,
    hue: 80,
    icon: "Soup",
    tags: ["klasika"],
    source: "",
    book: {
      photos: 3,
      active: 20,
      cuisine: "Česko",
      tools: ["hrniec (aspoň 3 l)", "miska a metlička"],
      store: "Polievka bez vajec v chladničke 2 dni. Vajcia pridaj vždy čerstvé pri ohrievaní.",
      sources: [
        { k: "A", site: "apetitonline.cz", name: "Kulajda", url: "https://www.apetitonline.cz/recept/kulajda" },
        { k: "B", site: "toprecepty.cz", name: "Pravá jihočeská kulajda", url: "https://www.toprecepty.cz/recept/1048-prava-jihoceska-kulajda/" },
        { k: "C", site: "labuznik.cz", name: "Kulajda", url: "https://www.labuznik.cz/recept/kulajda/" },
        { k: "D", site: "vareni.cz", name: "Jihočeská kulajda", url: "https://www.vareni.cz/recepty/jihoceska-kulajda/" },
      ],
    },
    ingredients: ings("Polievka", [
      ["zemiaky", 4, "ks", "ABCD", { note: "stredné (asi 500 g)" }],
      ["sampinony", 300, "g", "BCD", { label: "Čerstvé huby", note: "lesné alebo šampiňóny" }],
      ["rasca", 0.5, "lyzicka", "ABCD", { note: "celá" }],
      ["sol", 1, "lyzicka", "ABCD"],
      ["voda", 1000, "ml", "ACD"],
      ["kysla_smotana", 200, "g", "ABD"],
      ["muka", 2, "lyzica", "ABCD"],
      ["vajce", 4, "ks", "ABC"],
      ["kopor", 1, "ks", "ABCD", { note: "1 zväzok" }],
      ["ocot", 1, "lyzica", "AD", { optional: true, note: "podľa chuti" }],
    ]),
    steps: steps([
      ["Zemiaky ošúp a nakrájaj na kocky asi 1 cm. Huby očisti a nakrájaj na plátky.", 0, "ABC"],
      ["Do hrnca nalej {voda} vody, pridaj zemiaky, huby, rascu a soľ, priveď do varu a var.", 15, "ABCD", {
        heat: "stredný oheň", wait: true, done: "Zemiaky sú takmer mäkké, ale ešte sa nerozpadajú." }],
      ["Smotanu vymiešaj s múkou dohladka. Za stáleho miešania ju vlej do polievky a povar.", 10, "ABC", {
        heat: "mierny oheň", wait: true, warn: "Vlievaj pomaly a stále miešaj, inak vzniknú hrudky." }],
      ["Stíš oheň, aby polievka len jemne bublala. Vajcia rozbi priamo do polievky, každé na iné miesto, a nechaj ich stuhnúť.", 4, "C", {
        heat: "mierny oheň", wait: true, done: "Bielok je biely a pevný, žĺtok ostane mäkký.",
        warn: "Mäkký žĺtok nie je vhodný pre tehotné, malé deti, seniorov a ľudí s oslabenou imunitou. Pre nich var vajce, kým žĺtok nestuhne (asi 10 minút)." }],
      ["Stiahni hrniec z ohňa a vmiešaj nasekaný kôpor.", 0, "ABCD", { warn: "Kôpor už nevar, stratil by vôňu." }],
      ["Dochuť soľou a podľa chuti trochou octu. Kulajda má byť jemne kyslá.", 0, "AD", {
        tip: "Namiesto čerstvých húb môžeš použiť 2 hrste sušených. Namoč ich aspoň na 30 minút do vody a pridaj ich aj s ňou." }],
    ]),
  },
  {
    id: "medovnik",
    name: "Medovník s karamelovým krémom",
    category: "sladke",
    meat: "bez",
    minutes: 150,
    difficulty: 3,
    portions: 16,
    hue: 35,
    icon: "CakeSlice",
    tags: ["sviatočné"],
    source: "",
    book: {
      photos: 3,
      active: 90,
      wait: "1–3 dni odležať",
      cuisine: "Česko · Slovensko",
      tools: ["hrniec a kovová miska na vodný kúpeľ", "ručný mixér s hákmi a metlami", "valček a papier na pečenie", "tortová forma alebo tanier s priemerom 23 cm"],
      store: "V chladničke prikrytý 5 dní. Dá sa zamraziť po kúskoch.",
      sources: [
        { k: "A", site: "apetitonline.cz", name: "Medovník", url: "https://www.apetitonline.cz/recept/medovnik" },
        { k: "B", site: "toprecepty.cz", name: "Medový dort s krémem a oříšky", url: "https://www.toprecepty.cz/recept/22101-medovnik-marlenka/" },
        { k: "C", site: "vareni.cz", name: "Domácí medovník", url: "https://www.vareni.cz/recepty/domaci-medovnik/" },
        { k: "D", site: "labuznik.cz", name: "Medovník", url: "https://www.labuznik.cz/recept/medovnik/" },
        { k: "E", site: "nosalty.hu", name: "Mézes torta", url: "https://www.nosalty.hu/recept/mezes-torta" },
      ],
    },
    ingredients: [
      ...ings("Cesto (5 plátov)", [
        ["tuk", 250, "g", "ABCD", { note: "napr. Hera" }],
        ["cukor", 250, "g", "ABCDE", { note: "kryštálový" }],
        ["med", 4, "lyzica", "ABCDE"],
        ["vajce", 3, "ks", "ABCDE"],
        ["soda", 1, "lyzicka", "ABCDE"],
        ["muka", 450, "g", "ABCDE"],
      ]),
      ...ings("Karamelový krém", [
        ["kondenz", 1, "ks", "ABC", { note: "plechovka 397 g, alebo hotové karamelové" }],
        ["maslo", 300, "g", "ABC", { note: "mäkké" }],
      ]),
      ...ings("Na posypanie", [["orechy", 60, "g", "ABCE", { note: "nasekané" }]]),
    ],
    steps: steps([
      ["Ak nemáš hotové karamelové kondenzované mlieko, vlož neotvorenú plechovku do hrnca, zalej ju vodou a var. Potom ju nechaj vychladnúť. Maslo na krém vyber z chladničky, aby zmäklo.", 90, "ABC", {
        heat: "mierny var", wait: true, warn: "Plechovka musí byť celý čas pod vodou, vodu dolievaj. Otvor ju až úplne vychladnutú, inak môže horúci karamel vystreknúť." }],
      ["Priprav vodný kúpeľ: do hrnca nalej trochu vody a polož naň misku tak, aby sa dna nedotýkala. V miske rozpusti tuk s cukrom a medom.", 5, "ABCD", {
        heat: "voda jemne vrie", warn: "Voda sa nesmie dotýkať misky, inak sa vajcia v ďalšom kroku zrazia." }],
      ["Pridaj vajcia a sódu a za stáleho miešania zohrievaj. Najľahšie to ide ručným mixérom s hákmi.", 10, "ABCD", {
        done: "Zmes zhustne, napení sa a má zlatú medovú farbu." }],
      ["Misku stiahni z pary, vmiešaj múku a vypracuj hladké, mierne lepivé cesto. Rozdeľ ho na 5 rovnakých dielov.", 0, "ABCD"],
      ["Rúru predhrej na 170 °C (teplovzdušnú na 150 °C). Na papier na pečenie si obkresli kruh s priemerom 23 cm.", 0, "ABC"],
      ["Každý diel rozvaľkaj alebo rozotri na papieri na tenký plát, o niečo väčší ako kruh, a peč ho.", 7, "ABCD", {
        heat: "170 °C, každý plát 6–8 minút", wait: true, done: "Plát je zlatý, nie hnedý.", warn: "Pár minút navyše a plát stvrdne a zhorkne." }],
      ["Ešte teplé pláty hneď orež podľa formy alebo taniera. Odrezky odlož na posyp.", 0, "ABC"],
      ["Krém: karamel a mäkké maslo šľahaj dohladka.", 10, "ABC", { done: "Krém je hladký, lesklý a nadýchaný." }],
      ["Skladaj: plát, vrstva krému, ďalší plát a tak ďalej. Krémom natri aj vrch a boky.", 0, "ABC"],
      ["Odrezky rozdrv na jemnú drvinu, zmiešaj ich s nasekanými orechmi a obsyp nimi celý medovník.", 0, "ABC"],
      ["Nechaj odležať v chlade aspoň do druhého dňa, najlepšie 2–3 dni.", 0, "ABC", {
        done: "Pláty od krému zmäknú, nôž prejde ľahko a kúsky sú vláčne." }],
    ]),
  },
  {
    id: "lasagne",
    name: "Lasagne bolognese",
    category: "cestoviny",
    meat: "hovadzie",
    minutes: 170,
    difficulty: 2,
    portions: 6,
    hue: 10,
    icon: "UtensilsCrossed",
    tags: ["víkend"],
    source: "",
    book: {
      photos: 3,
      active: 45,
      cuisine: "Taliansko",
      tools: ["široký hrniec s pokrievkou", "malý hrniec na bešamel", "metlička", "zapekacia misa 30 × 20 cm"],
      store: "V chladničke 3 dni. Upečené aj neupečené sa dajú zamraziť.",
      sources: [
        { k: "A", site: "kuchynalidla.sk", name: "Pravé talianske lasagne bolognese", url: "https://kuchynalidla.sk/recepty/prave-talianske-lasagne-bolognese" },
        { k: "B", site: "kucharkaprodceru.cz", name: "Lasagne", url: "https://www.kucharkaprodceru.cz/lasagne-recept/" },
        { k: "C", site: "bbcgoodfood.com", name: "Classic lasagne", url: "https://www.bbcgoodfood.com/recipes/classic-lasagne-0" },
        { k: "D", site: "marmiton.org", name: "Lasagne à la bolognaise", url: "https://www.marmiton.org/recettes/recette_lasagnes-a-la-bolognaise_540219.aspx" },
        { k: "E", site: "toprecepty.cz", name: "Boloňské lasagne", url: "https://www.toprecepty.cz/recept/60403-bolonske-lasagne-1/" },
      ],
    },
    ingredients: [
      ...ings("Ragù", [
        ["olivovy_olej", 2, "lyzica", "ABCDE"],
        ["cibula", 1, "ks", "ABDE"],
        ["mrkva", 1, "ks", "ABD"],
        ["zeler_stopkovy", 1, "ks", "ABD", { note: "1 stonka" }],
        ["mlete", 600, "g", "ABCDE", { note: "bravčovo-hovädzie" }],
        ["pasirovane", 400, "g", "ACDE", { label: "Pasírované alebo lúpané paradajky" }],
        ["vyvar", 300, "ml", "ABC", { label: "Vývar alebo voda" }],
        ["sol", 1, "lyzicka", "ABCDE"],
        ["korenie", 1, "stipka", "ACE"],
      ]),
      ...ings("Bešamel", [
        ["maslo", 50, "g", "BDE"],
        ["muka", 50, "g", "BDE"],
        ["mlieko", 600, "ml", "BDE"],
        ["muskat", 1, "stipka", "BCDE"],
      ]),
      ...ings("Skladanie", [
        ["lasagne", 250, "g", "ABCDE", { note: "bez predvárania" }],
        ["parmezan", 100, "g", "ABDE", { note: "strúhaný" }],
      ]),
    ],
    steps: steps([
      ["Cibuľu, mrkvu a zeler nakrájaj na drobné kocky.", 0, "ABD"],
      ["V širokom hrnci rozohrej olivový olej a zeleninu opekaj do mäkka.", 6, "ABD", {
        heat: "stredný oheň", done: "Zelenina zmäkla, ale nezhnedla." }],
      ["Pridaj mleté mäso a opekaj ho, hrudky rozbíjaj vareškou.", 10, "ABCDE", {
        heat: "silný oheň", done: "Mäso sa rozpadlo na malé kúsky, nie je ružové a začína sa opekať." }],
      ["Pridaj paradajky, {vyvar} vývaru, soľ a korenie. Prikry a dus, občas premiešaj. Ak sa ragù prichytáva, podlej trochou vody.", 75, "ABCDE", {
        heat: "mierny oheň", wait: true, done: "Ragù je husté a sýte.", tip: "Kto má rád, podleje mäso pred paradajkami 150 ml červeného vína a nechá ho odpariť." }],
      ["Bešamel: v hrnčeku rozpusti maslo, vmiešaj múku a minútu miešaj. Postupne prilievaj studené mlieko a stále šľahaj metličkou. Var, kým nezhustne, a dochuť soľou a muškátovým orechom.", 10, "BDE", {
        heat: "mierny oheň", done: "Omáčka zhustla a obalí lyžicu.", warn: "Mlieko prilievaj po častiach a stále šľahaj, inak budú hrudky." }],
      ["Rúru predhrej na 180 °C.", 0, "ABCDE"],
      ["Skladaj do misy 30 × 20 cm: na dno trochu ragù, vrstva platní, ragù, bešamel a parmezán. Opakuj, kým nespotrebuješ všetko. Navrch daj bešamel a zvyšný parmezán.", 0, "ABCDE", {
        warn: "Platne musia byť celé pod omáčkou, inak ostanú tvrdé." }],
      ["Peč dozlatista.", 45, "ABC", {
        heat: "180 °C", wait: true, done: "Vrch je zlatohnedý a na okrajoch bublá.", tip: "Ak vrch hnedne priskoro, prikry misu alobalom." }],
      ["Nechaj lasagne odpočívať, až potom krájaj.", 15, "ABD", {
        wait: true, warn: "Hneď po upečení by sa kúsky rozpadli." }],
    ]),
  },
];

/** Recept z knihy podľa kľúča. */
export const bookRecipe = (id: string) => BOOK.find((r) => r.id === id);

/** Triedy fotiek receptu: pic-kb_<id>_<n> (súbory public/kniha/<id>-<n>.webp). */
export function bookPics(r: Pick<Recipe, "id" | "book">) {
  const n = r.book?.photos ?? 0;
  return Array.from({ length: n }, (_, k) => `kb_${r.id}_${k + 1}`);
}

/** Alergény receptu – odvodené zo surovín (nikdy nie ručne). */
export function recipeAllergens(r: Pick<Recipe, "ingredients">) {
  const al = new Set<Allergen>();
  const check = new Set<string>();
  for (const ing of r.ingredients) {
    const food = FOODS[ing.food];
    for (const a of food?.al ?? []) al.add(a);
    if (food?.check && food.al?.length) check.add(ing.label || food.name);
  }
  return { allergens: [...al], check: [...check] };
}
