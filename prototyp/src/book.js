// Kniha receptov 2.0 – recepty podľa štandardu (skupiny surovín, kroky s „Hotové je, keď / Pozor / Tip“).
// Texty napísal Claude, 3 fotky na recept vytvorila AI (Gemini) v jednotnom „domácom“ štýle.
// Všetko je označené ako test (aiTest), aby sa dalo v prototype vyskúšať a ohodnotiť.
import { PRODUCTS, RECIPES } from './data.js';

// Suroviny, ktoré v katalógu chýbali (orientačná cena)
const NEWP = [
  ['knedla', 'Knedľa kysnutá', 'bread', 'bakery', 'ks', 1, 'knedla knedlu knedle knedlik', 1.29],
  ['krupica', 'Krupica detská', 'flour', 'pantry', 'bal', 1, 'krupica krupicu', .89],
  ['lasagne', 'Lasagne platne', 'spaghetti', 'pantry', 'bal', 1, 'lasagne platne lasagni', 1.79],
  ['kopor', 'Kôpor čerstvý', 'herb', 'produce', 'ks', 1, 'kopor kopru', .99],
  ['hriby', 'Sušené hríby', 'mushroom', 'pantry', 'ks', 1, 'hriby huby susene', 2.99],
  ['zeler', 'Zeler stopkový', 'leafy', 'produce', 'ks', 1, 'zeler stopkovy', 1.29],
  ['ocot', 'Ocot 8 %', 'jar', 'pantry', 'ks', 1, 'ocot octu', .59],
  ['soda', 'Sóda bikarbóna', 'salt', 'pantry', 'ks', 1, 'soda bikarbona', .39],
  ['rasca', 'Rasca celá', 'herb', 'pantry', 'ks', 1, 'rasca rascu', .69],
  ['bobkovy', 'Bobkový list', 'leaf', 'pantry', 'ks', 1, 'bobkovy list', .59],
  ['sol', 'Soľ', 'salt', 'pantry', 'ks', 1, 'sol soli', .35],
  ['muskat', 'Muškátový orech', 'chestnut', 'pantry', 'ks', 1, 'muskat muskatovy orech', 1.49],
];
for (const [id, n, e, c, u, dq, syn, approx] of NEWP) if (!PRODUCTS[id]) PRODUCTS[id] = { id, n, e, c, u, dq, h: [], syn, approx };

// Skupina: [názov, [[produkt alebo null, množstvo v jednotke produktu, popis, mám doma (1), vlastný názov]]]
// Krok: [text, minúty, { heat, ok: hotové je keď, pz: pozor, tip }]
const W = null; // voda a podobné – nekupuje sa
export const BOOK = [
  {
    id: 'segedin', n: 'Segedínsky guláš', cat: 'maso', pics: ['a_seg1', 'a_seg2', 'a_seg3'], e: 'stew', bg: 'peach',
    min: 105, act: 30, kcal: 640, por: 4, diff: 'Ľahké', cuisine: 'Česko · varí sa aj u nás', tags: ['klasika', 'bravčové'],
    tools: ['hrniec s hrubým dnom (4 l)', 'sitko', 'metlička'], store: 'V chladničke 3 dni, dá sa zamraziť. Na druhý deň je ešte lepší.', allergens: ['lepok', 'mlieko'],
    variants: [['s bravčovým bôčikom', 'plan'], ['z morčacieho mäsa', 'plan']],
    groups: [
      ['Mäso a základ', [['pliecko', .8, '800 g (alebo krkovička)'], ['cibula', 2, '2 ks (250 g)'], ['olej', .04, '3 PL masti alebo oleja', 1], ['paprikam', .15, '2 PL sladkej (15 g)', 1], ['cesnak', 1, '2 strúčiky'], ['rasca', .1, '1 ČL celej', 1], ['bobkovy', .1, '2 listy', 1], ['sol', .02, '1½ ČL', 1], ['korenie', .05, '½ ČL mletého', 1], [W, 0, 'asi 600 ml', 1, 'Voda']]],
      ['Kapusta', [['kapusta', 1, '500 g']]],
      ['Zahustenie', [['kyslasmotana', 1, '250 ml (16 %)'], ['muka', .02, '2 PL (20 g)', 1]]],
      ['Na podávanie', [['knedla', 1, '8–10 plátkov']]],
    ],
    steps: [
      ['Mäso nakrájaj na kocky 2–3 cm, cibuľu nadrobno, cesnak pretlač. Kapustu ochutnaj: ak je veľmi kyslá, krátko ju prepláchni v sitku studenou vodou a vytlač. Dlhé vlákna nakrájaj kratšie.', 10, { pz: 'Kapustu neplákaj dlho, stratí chuť. Stačí pár sekúnd.' }],
      ['V hrnci s hrubým dnom rozpusti masť a opekaj cibuľu.', 9, { heat: 'stredný oheň', ok: 'Cibuľa je mäkká a zlatá, nie tmavohnedá.' }],
      ['Hrniec stiahni z ohňa, vmiešaj papriku a hneď podlej 100 ml vody.', 0, { pz: 'Paprika na horúcom tuku za pár sekúnd zhorkne a celé jedlo bude horké. Preto mimo ohňa a hneď podliať.' }],
      ['Pridaj mäso, cesnak, rascu, soľ a korenie. Vráť na oheň a za stáleho miešania opekaj, kým mäso zo všetkých strán nezbelie.', 5, { heat: 'stredný oheň' }],
      ['Podlej vodou, aby bolo mäso takmer zakryté (asi 400 ml), pridaj bobkový list, prikry a duste. Občas premiešaj a podlej, ak sa voda vyvarí.', 40, { heat: 'mierny oheň' }],
      ['Pridaj kapustu, premiešaj a dolej vodu tak, aby bola zakrytá. Duste ďalej pod pokrievkou.', 35, { heat: 'mierny oheň', ok: 'Kúsok mäsa sa ľahko roztlačí vidličkou.' }],
      ['Smotanu vymiešaj s múkou metličkou dohladka. Primiešaj do nej 3 lyžice horúcej šťavy z hrnca a až potom ju vlej do guláša za stáleho miešania. Povar 5 minút a vyber bobkové listy.', 5, { pz: 'Studená smotana vliata rovno do vriaceho guláša sa zrazí na hrudky.' }],
      ['Dochuť soľou. Ak je guláš príliš kyslý, pridaj štipku cukru. Podávaj s knedľou.', 0, { tip: 'Knedľu nakrájaj niťou alebo nožom namočeným vo vode, nepomačká sa.' }],
    ],
  },
  {
    id: 'paprikas', n: 'Kurací paprikáš s haluškami', cat: 'hydina', pics: ['a_pap1', 'a_pap2', 'a_pap3'], e: 'poultry', bg: 'rose',
    min: 75, act: 40, kcal: 720, por: 4, diff: 'Stredné', cuisine: 'Slovensko · Maďarsko', tags: ['klasika', 'pre deti'],
    tools: ['široký kastról s pokrievkou', 'veľký hrniec na halušky', 'haluškár alebo doska a nôž', 'metlička'], store: 'Paprikáš v chladničke 2 dni. Halušky uchovávaj zvlášť, prehrej ich na masle.', allergens: ['lepok', 'vajcia', 'mlieko'],
    variants: [['z kuracích pŕs', 'plan'], ['s cestovinami namiesto halušiek', 'plan']],
    groups: [
      ['Paprikáš', [['stehna', 1.2, '4 stehná (1,2 kg)'], ['cibula', 2, '2 ks'], ['paprika', .15, '1 červená paprika'], ['pretlak', .3, '1 PL'], ['olej', .03, '2 PL', 1], ['paprikam', .15, '2 PL sladkej', 1], ['sol', .02, '1 ČL', 1], ['korenie', .05, '½ ČL', 1], [W, 0, 'asi 400 ml', 1, 'Voda']]],
      ['Omáčka', [['kyslasmotana', 1, '250 ml (16 %)'], ['muka', .02, '2 PL (20 g)', 1]]],
      ['Halušky', [['muka', .3, '300 g hladkej'], ['vajcia', .2, '2 ks'], ['sol', .01, '1 ČL', 1], ['maslo', .08, '20 g'], [W, 0, 'asi 150 ml', 1, 'Voda']]],
    ],
    steps: [
      ['Stehná osuš papierovou utierkou, osoľ a okoreň z oboch strán.', 5, {}],
      ['V širokom kastróle rozpáľ olej a stehná opeč kožou dole do zlatista. Otoč, opeč aj druhú stranu a vyber na tanier.', 10, { heat: 'silnejší oheň', ok: 'Koža je zlatohnedá a sama sa pustí od dna.', pz: 'Nehýb nimi, kým sa koža nepustí, inak sa roztrhne.' }],
      ['Na výpeku opekaj nadrobno nakrájanú cibuľu do mäkka. Pridaj papriku nakrájanú na kocky a pretlak.', 8, { heat: 'stredný oheň' }],
      ['Kastról stiahni z ohňa, vmiešaj mletú papriku a hneď podlej 100 ml vody.', 0, { pz: 'Paprika na horúcom tuku za pár sekúnd zhorkne.' }],
      ['Vráť stehná kožou hore, podlej vodou do polovice výšky mäsa (asi 300 ml), prikry a duste.', 35, { heat: 'mierny oheň', ok: 'Pri prepichnutí stehna pri kosti vyteká číra šťava, nie ružová.' }],
      ['Medzitým halušky: múku, vajcia, soľ a vodu vymiešaj vareškou na husté lesklé cesto, ktoré pomaly steká z lyžice. Nechaj 10 minút odpočívať.', 5, { tip: 'Cesto má byť hustejšie ako na palacinky. Ak je tuhé, pridaj lyžicu vody.' }],
      ['Vo veľkom hrnci priveď do varu osolenú vodu. Cesto pretláčaj cez haluškár alebo strúhaj z dosky nožom priamo do vody. Var, kým halušky nevyplávajú, a ešte 2 minúty.', 10, { ok: 'Všetky halušky plávajú na hladine.', pz: 'Nenahadzuj naraz veľa, zlepia sa. Rob ich na 2 až 3 dávky.' }],
      ['Halušky sceď, prepláchni horúcou vodou a premiešaj s maslom.', 2, {}],
      ['Stehná vyber. Ak chceš hladkú omáčku, rozmixuj ju ponorným mixérom. Smotanu vymiešaj s múkou dohladka, primiešaj 3 lyžice horúcej šťavy a vlej do omáčky. Povar 5 minút za stáleho miešania.', 6, { pz: 'Studená smotana priamo do vriacej omáčky sa zrazí.' }],
      ['Stehná vráť do omáčky, prehrej a dochuť soľou. Podávaj s haluškami.', 3, { tip: 'Kto má rád pikantné, pridá štipku pálivej papriky.' }],
    ],
  },
  {
    id: 'medovnik', n: 'Medovník', cat: 'sladke', pics: ['a_med1', 'a_med2', 'a_med3'], e: 'cake', bg: 'butter',
    min: 120, act: 120, wait: '12 h v chladničke', kcal: 420, por: 16, unit: 'kúskov', diff: 'Náročné', cuisine: 'Slovensko · Česko', tags: ['sviatočné', 'koláč'],
    tools: ['hrniec a kovová miska na paru', 'metlička', 'valček', 'papier na pečenie', 'šablóna 20 × 30 cm', 'mixér alebo šľahač'], form: 'pláty 20 × 30 cm', store: 'V chladničke 5 dní, prikrytý. Dá sa zamraziť po kúskoch.', allergens: ['lepok', 'vajcia', 'mlieko'],
    variants: [['s karamelovým krémom', 'plan'], ['okrúhly ako torta', 'plan']],
    groups: [
      ['Cesto (7 plátov)', [['maslo', .4, '100 g'], ['cukor', .15, '150 g kryštálového'], ['med', .3, '3 PL (75 g)'], ['vajcia', .2, '2 ks'], ['soda', .1, '1 ČL sódy bikarbóny'], ['muka', .5, '450 g hladkej + na podsypanie']]],
      ['Krupicový krém', [['mlieko', .7, '700 ml'], ['krupica', .25, '100 g detskej krupice'], ['cukor', .12, '120 g'], ['maslo', 1, '250 g, mäkké']]],
      ['Na posypanie', [[W, 0, 'odrezky a 1 plát', 1, 'Z upečených plátov']]],
    ],
    steps: [
      ['Maslo na krém nechaj zmäknúť pri izbovej teplote aspoň hodinu. Rúru predhrej na 180 °C (horúci vzduch 170 °C).', 5, { tip: 'Mäkké maslo je základ hladkého krému. Prst doň má ľahko zapadnúť.' }],
      ['Krém začni ako prvý, musí vychladnúť: mlieko s cukrom priveď do varu, za stáleho miešania metličkou sypaj krupicu a var 3 až 4 minúty do hustej kaše. Prikry fóliou priamo na povrch a nechaj úplne vychladnúť.', 10, { heat: 'stredný oheň', pz: 'Krupicu sypi pomaly a stále miešaj, inak vzniknú hrudky.', tip: 'Fólia priamo na kaši zabráni, aby na nej vznikla kôrka.' }],
      ['Cesto: v miske nad hrncom s vriacou vodou roztop maslo, cukor a med. Pridaj vajcia a za stáleho šľahania zohrievaj.', 6, { ok: 'Zmes zhustne a zosvetlí.', pz: 'Voda pod miskou len mierne vrie a nesmie sa dotýkať misky, inak sa vajcia zrazia.' }],
      ['Pridaj sódu bikarbónu a premiešaj.', 2, { ok: 'Zmes spení, zväčší objem a zmení farbu na karamelovú.' }],
      ['Misku stiahni z pary, postupne primiešaj múku a vypracuj mäkké, mierne lepivé cesto. Rozdeľ ho na 7 rovnakých dielov.', 5, { tip: 'Teplé cesto sa vaľká najlepšie. Diely, ktoré čakajú, prikry utierkou.' }],
      ['Každý diel vyvaľkaj na papieri na pečenie na tenko (asi 2 mm), o niečo väčší ako 20 × 30 cm. Prepichaj vidličkou a peč.', 35, { heat: '180 °C, každý plát 4–5 min', ok: 'Plát je zlatý, nie hnedý.', pz: 'O minútu dlhšie pečený plát stvrdne a zhorkne.' }],
      ['Ešte teplý plát hneď orež ostrým nožom podľa šablóny 20 × 30 cm. Odrezky a posledný plát odlož na posyp.', 5, { pz: 'Po vychladnutí sa plát pri krájaní láme.' }],
      ['Krém: mäkké maslo vyšľahaj do peny, potom po lyžiciach pridávaj vychladnutú kašu a šľahaj dohladka.', 6, { ok: 'Krém je hladký a nadýchaný.', pz: 'Kaša aj maslo musia mať rovnakú izbovú teplotu, inak sa krém zrazí.' }],
      ['Skladaj: plát, tenká vrstva krému (asi 4 lyžice), plát… Posledný plát natri krémom aj s bokmi.', 15, { tip: 'Pláty jemne pritláčaj dlaňou, aby koláč držal rovno.' }],
      ['Odrezky rozdrv na jemnú strúhanku (mixér alebo valček a vrecko) a celý koláč nimi obsyp.', 5, {}],
      ['Nechaj v chladničke odležať aspoň 12 hodín, najlepšie 24. Pláty zmäknú od krému.', 0, { ok: 'Nôž prejde ľahko a kúsky sú mäkké.', tip: 'Krájaj nožom namočeným v horúcej vode.' }],
    ],
  },
  {
    id: 'kulajda', n: 'Kulajda so zastreným vajcom', cat: 'polievky', pics: ['a_kul1', 'a_kul2', 'a_kul3'], e: 'soup', bg: 'sky',
    min: 45, act: 30, kcal: 380, por: 4, diff: 'Stredné', cuisine: 'Česko · varí sa aj u nás', tags: ['bezmäsité', 'huby'],
    tools: ['hrniec (3 l)', 'panvica', 'široký hrniec na vajcia', 'dierovaná lyžica', 'metlička'], store: 'Polievka v chladničke 2 dni, vajcia rob vždy čerstvé.', allergens: ['lepok', 'vajcia', 'mlieko'],
    variants: [['s lesnými hubami', 'plan']],
    groups: [
      ['Polievka', [['zemiaky', .5, '500 g'], ['sampinony', 1, '250 g'], ['hriby', .3, '10 g (nemusí byť)'], ['maslo', .12, '30 g'], ['rasca', .05, '½ ČL', 1], ['sol', .02, '1 ČL', 1], [W, 0, '1 l', 1, 'Voda']]],
      ['Zahustenie', [['kyslasmotana', 1, '250 ml (16 %)'], ['smotana', 1, '200 ml'], ['muka', .02, '2 PL (20 g)', 1]]],
      ['Dochutenie', [['ocot', .1, '1–2 PL'], ['kopor', 1, '1 zväzok'], ['cukor', .01, 'štipka', 1], ['korenie', .03, 'podľa chuti', 1]]],
      ['Zastreté vajcia', [['vajcia', .4, '4 čerstvé'], ['ocot', .05, '1 PL do vody']]],
    ],
    steps: [
      ['Sušené hríby (ak ich máš) namoč do 100 ml teplej vody. Zemiaky ošúp a nakrájaj na kocky 1 cm, šampiňóny na plátky.', 10, {}],
      ['Do hrnca daj 1 l vody, zemiaky, rascu a soľ a var.', 12, { heat: 'stredný oheň', ok: 'Zemiaky sú takmer mäkké, ale nerozpadávajú sa.' }],
      ['Medzitým na masle na panvici opeč šampiňóny, kým sa z nich neodparí voda a mierne nezozlatnú.', 6, { heat: 'silnejší oheň', pz: 'Nedávaj ich naraz veľa, inak sa dusia namiesto opekania.' }],
      ['Huby aj s namočenými hríbmi a ich vodou pridaj k zemiakom.', 1, {}],
      ['Obe smotany vymiešaj s múkou dohladka, primiešaj 3 lyžice horúcej polievky a za stáleho miešania vlej do hrnca. Povar 5 minút.', 5, { heat: 'mierny oheň', pz: 'Studená smotana priamo do vriacej polievky sa zrazí.' }],
      ['Dochuť octom, soľou, korením a štipkou cukru, má byť jemne kyslá. Stiahni z ohňa a vmiešaj nasekaný kôpor.', 2, { tip: 'Ocot pridávaj po lyžičke a ochutnávaj, každý je inak silný.', pz: 'Kôpor už nevar, stratí vôňu.' }],
      ['Zastreté vajcia: v širokom hrnci priveď k miernemu varu vodu s lyžicou octu, bez soli. Vajce rozbi do šálky, lyžicou zatoč vodu do víru a vajce opatrne vkĺzni do stredu. Var 3 minúty a vyber dierovanou lyžicou.', 12, { heat: 'voda len jemne bublá', ok: 'Bielok je stuhnutý, žĺtok pri dotyku pruží.', pz: 'Pri prudkom vare sa bielok roztrhá.', tip: 'Čím čerstvejšie vajce, tým krajšie drží tvar.' }],
      ['Polievku nalej do tanierov, na každý polož vajce a posyp kôprom.', 0, {}],
    ],
  },
  {
    id: 'lasagne', n: 'Lasagne bolognese', cat: 'cestoviny', pics: ['a_las1', 'a_las2', 'a_las3'], e: 'spaghetti', bg: 'peach',
    min: 150, act: 60, kcal: 750, por: 6, diff: 'Náročné', cuisine: 'Taliansko', tags: ['víkend', 'návšteva'],
    tools: ['široký hrniec s pokrievkou', 'malý hrniec na bešamel', 'metlička', 'zapekacia misa 20 × 30 cm', 'alobal'], form: 'misa 20 × 30 cm', store: 'V chladničke 3 dni, upečené aj neupečené sa dajú zamraziť.', allergens: ['lepok', 'vajcia', 'mlieko', 'zeler'],
    variants: [['špenátové s ricottou', 'plan'], ['zeleninové', 'plan']],
    groups: [
      ['Ragù', [['mlete', 1, '500 g (bravčovo-hovädzie)'], ['bok', .1, '100 g slaniny alebo pancetty'], ['cibula', 1, '1 ks'], ['mrkva', .1, '1 ks (100 g)'], ['zeler', 1, '1 stonka'], ['cesnak', 1, '2 strúčiky'], ['olej', .03, '2 PL olivového', 1], ['vino', .2, '150 ml bieleho suchého'], ['lupane', 1, '1 plechovka (400 g)'], ['pretlak', .5, '2 PL'], ['mlieko', .1, '100 ml'], ['bobkovy', .05, '1 list', 1], ['sol', .02, 'podľa chuti', 1], ['korenie', .03, 'podľa chuti', 1]]],
      ['Bešamel', [['maslo', .24, '60 g'], ['muka', .06, '60 g'], ['mlieko', .8, '800 ml'], ['muskat', .05, 'štipka', 1], ['sol', .01, '½ ČL', 1]]],
      ['Skladanie', [['lasagne', 1, '250 g (bez predvárania)'], ['parmezan', 1, '100 g strúhaného'], ['maslo', .04, 'na vymastenie']]],
    ],
    steps: [
      ['Cibuľu, mrkvu a zeler nakrájaj na veľmi drobné kocky (2–3 mm), cesnak pretlač, slaninu na drobné kúsky.', 15, { tip: 'Drobná zelenina sa v ragù „rozpustí“ a dodá mu sladkosť.' }],
      ['V širokom hrnci na oleji vyškvar slaninu, pridaj zeleninu a duste do mäkka.', 10, { heat: 'stredný oheň', ok: 'Cibuľa je sklovitá a mäkká, nič nie je hnedé.' }],
      ['Pridaj mleté mäso a opekaj ho, pričom ho vareškou rozbíjaj na drobno.', 8, { heat: 'silnejší oheň', ok: 'Mäso stratí ružovú farbu a začne sa jemne opekať.', pz: 'Nemiešaj neustále, nechaj ho chvíľu opiecť. Inak sa len uvarí vo vlastnej šťave.' }],
      ['Podlej vínom a var, kým sa takmer neodparí.', 3, {}],
      ['Pridaj pretlak, rozmačkané lúpané paradajky, bobkový list, soľ, korenie a 100 ml vody. Prikry pokrievkou nakrivo a duste, občas premiešaj. Na konci vmiešaj mlieko.', 90, { heat: 'veľmi mierny oheň', ok: 'Ragù je husté a na povrchu sa jemne oddeľuje tuk.', pz: 'Ak sa začne prichytávať, podlej lyžicou vody.', tip: 'Ragù sa dá urobiť deň vopred, bude ešte lepšie.' }],
      ['Bešamel: v hrnci rozpusti maslo, pridaj múku a za miešania 2 minúty opekaj. Postupne prilievaj studené mlieko a stále šľahaj metličkou. Var, kým nezhustne, a dochuť soľou a muškátovým orechom.', 10, { heat: 'mierny oheň', ok: 'Omáčka obalí lyžicu ako hustý jogurt.', pz: 'Mlieko pridávaj postupne a stále šľahaj, inak budú hrudky.', tip: 'Hrudky zachráni ponorný mixér.' }],
      ['Rúru predhrej na 190 °C (horúci vzduch 180 °C). Misu vymasti maslom a z ragù vyber bobkový list.', 2, {}],
      ['Skladaj: na dno 3 lyžice bešamelu, vrstva platní, ragù, bešamel, parmezán. Zopakuj štyrikrát. Navrch daj pláty, bešamel a zvyšný parmezán.', 10, { pz: 'Pláty bez predvárania musia byť celé zakryté omáčkou, inak ostanú tvrdé.', tip: 'Zlomený plát nevadí, kúsky len priložte k sebe.' }],
      ['Peč prikryté alobalom 25 minút, potom bez alobalu ďalších 15 až 20 minút.', 45, { heat: '190 °C', ok: 'Vrch je zlatohnedý a bublá, nôž ľahko prejde cestom.' }],
      ['Nechaj 15 minút odpočívať, až potom krájaj.', 15, { pz: 'Hneď po upečení sa kúsky rozpadnú.' }],
    ],
  },
];

for (const b of BOOK) {
  b.pic = b.pics[0];
  b.src = 'Kniha Basket Harmony';
  b.aiTest = true; // recept aj fotky z AI – na otestovanie
  b.groups = b.groups.map(([n, items]) => ({ n, items }));
  b.ing = b.groups.flatMap((g) => g.items).filter((x) => x[0]);
  // rovnaký produkt v dvoch skupinách (múka, maslo…) sa pre nákup a „mám doma“ spočíta
  const m = new Map();
  for (const x of b.ing) { const o = m.get(x[0]); if (o) { o[1] += x[1]; o[2] = 'spolu'; o[3] = o[3] && x[3]; } else m.set(x[0], [...x]); }
  b.ing = [...m.values()];
  const i = RECIPES.findIndex((r) => r.id === b.id);
  if (i >= 0) RECIPES.splice(i, 1);
}
// staré krátke verzie, ktoré nahrádzajú nové recepty (žiadne duplicity)
for (const id of ['naprike']) { const i = RECIPES.findIndex((r) => r.id === id); if (i >= 0) RECIPES.splice(i, 1); }
RECIPES.unshift(...BOOK);

// Plán knihy – čo by malo pribudnúť (ukážka pre Mapu knihy a hľadanie)
export const PLAN = [
  ['Polievky', 65], ['Kuracie a hydina', 80], ['Mäso', 105], ['Cestoviny, ryža a pizza', 70], ['Ryby', 45], ['Bez mäsa a šaláty', 115], ['Raňajky a sladké', 140],
];
