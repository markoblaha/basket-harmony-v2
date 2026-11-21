# Stav projektu (odovzdanie pre ďalšiu reláciu)

Aktualizované 20. 11. 2026 (kniha receptov: šarža 4 ako presná kópia zdroja v pôvodnom jazyku, stĺpec `lang`). Pred prácou si prečítaj celé – je to krátke.

## Kde čo beží

| Čo | Kde |
|---|---|
| Ostrá appka | vetva `main` → Cloudflare Worker `basket-harmony-v2`, DB `kjadeylctafnmgembgev` |
| Testovacia appka | vetva `design/v2-mobile-redesign` → https://design-v2-mobile-redesign-basket-harmony-v2.markoblaha.workers.dev, DB `esftqxrdrlldvpmwirrx` (režim „staging“, `.env.staging`) |
| Nasadenie | každý `push` – Cloudflare postaví vetvu sám (1–3 min). Overenie: zmení sa `assets/index-*.js` v HTML testovacej adresy. |
| Prototyp v telefóne | https://design-v2-mobile-redesign-basket-harmony-v2.markoblaha.workers.dev/prototyp/ – súbor `public/prototyp/` (vytvorí `python3 prototyp/build.py && python3 prototyp/web.py`). Od Fázy 9 je to aj **ukážka v appke** (`/prototyp/?ukazka=…`), takže musí ísť aj do `main`. |
| Starý repozitár | `markoblaha/basket-harmony` (pôvodná appka z Lovable) – s v2 nesúvisí |

Majiteľ nechce: push do `main` ani Pull Request bez výslovného pokynu. Do ostrej DB len pri zlúčení.

Testovacia DB má kópiu dokladov domácnosti Blahovci z ostrej DB (23. 10. 2026: 66 dokladov, 523 položiek,
416 produktov + aliasy; všetky doklady pripísané Markovi). Fotky dokladov ani `receipt_pages` sa nekopírovali.

**Testovací účet (len testovacia DB, 2. 11. 2026, so súhlasom majiteľa):** `e2e-test@basket-harmony.invalid`, heslo je v trezore
testovacej DB (`select decrypted_secret from vault.decrypted_secrets where name in ('e2e_test_email','e2e_test_password')`),
nie v repozitári. Má vlastnú domácnosť „Testovacia domácnosť (kópia)“ s kópiou údajov Blahovcov (doklady, položky, produkty,
aliasy, zoznamy, rozpočty) + jeden skúšobný bloček „Lidl 5,01 €“ z overenia čítania na pozadí. Blahovci ani Marko ho nevidia.
Starší účet `claude-test-recepty@example.com` (heslo neznáme) ostal nepoužitý.

**Automatické preklikanie appky:** `testy/preklikanie.cjs` – prihlási testovací účet cez obrazovku, prejde 32 obrazoviek
v telefónovej veľkosti v 4 vzhľadoch (Teplá a Sklo, svetlý aj tmavý) a hľadá chyby JS, neúspešné volania
servera, chybové hlásenia, pretekanie, text mimo obrazovky a prekrytia. Fotky + `report.json` do `testy/vysledky/` (mimo gitu).
`E2E_EMAIL=… E2E_PASSWORD=… node testy/preklikanie.cjs [adresa]` – bez adresy ide na nasadenú testovaciu appku; `ONLY=nakupy,parovanie` preklikne len vybrané obrazovky.
**Test pridávania:** `testy/pridavanie.cjs` (rovnaké premenné) – nový zoznam → okno pridávania → 3 rýchle ťuky na bublinu
= 1 riadok s 3 ks (kontrola aj v DB), pole prázdne → mínus → po dokončení časté veci → ťuk na častú vec ju nahradí ďalšou →
„rozky 2“ + Enter → posúvanie nechá klávesnicu → ťuk do zoznamu okno zavrie; testovací zoznam na konci archivuje.
**Test toku nákupu:** `testy/nakup.cjs` (rovnaké premenné) – nový zoznam → 3 položky písaním → Nakupovať → všetko do košíka →
Dokončiť nákup → Teraz nie → zoznam je v Histórii. Zapisuje do testovacej DB (zoznam „Tok nákupu …“); rozbehnutý nákup
z prerušeného behu na začiatku ukončí (`end_shopping`).

## Pred zlúčením testovacej vetvy do `main` (nedokončené)

1. ~~`main` má 1 zmenu navyše (`9aba9fb`)~~ – HOTOVO 2. 11.: zlúčená do testovacej vetvy, migrácie `receipt_queue`
   a `worker_secret` nasadené v testovacej DB, v trezore testovacej DB je `project_url`. Čítanie bločku na pozadí overené
   (nahratie → databáza → extract-receipt → zjednotenie produktov za ~10 s, náklady v `ai_usage`).
2. Do ostrej DB chýbajú migrácie testovacej vetvy: `20261021000024_item_unavailable`,
   `…025_shopping_time_finish`, `…026_receipt_match`, `…027_recipes`, `20261022000028_staple_items`,
   `20261030000029_product_kinds` (v testovacej DB nasadená ako 3 kroky: product_kinds, product_kinds_units,
   product_kinds_by_name – súbor v repozitári je ich súčet). Funkciu `normalize-products` v3 (druh) nasadiť aj do ostrej.
   Históriu migrácií oboch DB porovnaj (`list_migrations`) – ostrá má niektoré pod inými menami.
   Ďalej `20261102000030_ai_guard` (poistka AI + zamknuté vnútorné funkcie párovania) a `20261102000031_item_catalog`
   (katalóg položiek pre rozpoznanie a odhad ceny v zozname) a `20261102000032_finish_keep_unavailable` (koniec nákupu:
   „nemali“ pokračuje v zozname, pokračujúci zoznam si nechá pôvodný deň), `…033_recipe_week_plan` (deň v pláne
   týždňa, plánovanie bez zoznamu) a `…034_recipe_likes` (Ochutnávač – „Chcem“ za každého člena).
   Výdavky 2.0 a model cien (13. 11.): `20261112000038_price_model` (v testovacej DB ako 2 kroky), `…039_analytics_daily`,
   `20261113000040_price_store_count`, `…041_price_comparable` (v testovacej DB ako 3 kroky: price_comparable,
   price_comparable_kind, price_comparable_sizes – súbor je ich súčet). Po nasadení spustiť `supabase/tests/price_model_test.sql`
   (vráti všetko späť, hľadaj `fails=0`; v ostrej DB treba upraviť názov testovacej domácnosti v 1. riadku bloku).
   Kniha receptov: `20261117000043_recipe_book`, `20261120000044_book_recipe_lang` (jazyk receptu `lang`, cs/sk) a
   `20261120000045_book_recipe_images` (počet fotiek, stav 'source') a `20261120000046_book_recipe_subcategory_yield`.
3. Edge funkcie: pri zlúčení nasadiť do ostrej všetky z repozitára aj so spoločnými súbormi `_shared/` (gemini, receipt, guard).
   Nasadzujú sa s cestami `<funkcia>/index.ts` + `_shared/*.ts` (vstup `<funkcia>/index.ts`). V testovacej DB: parse-voice v5,
   recipe-ai v6 (obe s `guard.ts` – vyžadujú `household_id`, inak NOT_FOUND), extract-receipt v3, normalize-products v4,
   read-statement v3. Funkciu `proto-images` (vypnutá, 410) možno zmazať.
4. `supabase/tests/core_test.sql` celý nebežal (obsahuje `delete` testovacích riadkov vo vnútri bloku, ktorý sa celý vráti
   späť → treba súhlas majiteľa). Nové časti (fronta dokladov, poistka AI, katalóg položiek) overené samostatným blokom:
   všetko ok (katalóg: člen vidí, cudzí NOT_FOUND, neprihlásený nemá prístup; koniec nákupu MOVE: nákup v histórii,
   nekúpené aj „nemali“ v pokračujúcom zozname, deň zachovaný).

## Čo je hotové v testovacej vetve (oproti `main`)

- **Analytika – druh produktu (30. 10.):** Kategória → Druh (Pivo, Kuracie prsia) → výrobok (značka + balenie).
  `products.kind` (+ `kind_manual`), detail druhu `analytics_kind` (množstvo, priemer €/kg·l·ks, výrobky, obchody od
  najlacnejšieho, nákupy), druhy v `analytics_category`, úprava druhu pri produkte (`set_product_kind`). AI dopĺňa druh pri
  zjednotení; v testovacej DB sú druhy pre 360 produktov doplnené ručne. Obrazovka `features/analytics/KindPage.tsx`.
  V prehliadači s prihlásením zatiaľ neoverené (funkcie overené SQL na dátach domácnosti).

- **Zoznam – plánovanie:** jednoduchý zoznam bez kategórií, najnovšie hore. Po pridaní dorolovanie
  a rozsvietenie riadku. Potiahnutie celej karty: doprava +1, doľava −1, pri poslednom kuse dlhý ťah = zmazať
  (karta odletí, riadok sa zbalí).
- **Dok pri palci** (`features/lists/QuickDock.tsx`, `Composer.tsx`): 5 dlaždíc „istý nákup“
  (SQL `staple_items`), Všetky 3×3, Obľúbené (max 11) s editorom, ťuk = +1 a po 2 s sa pridá,
  dlaždicu nahradí ďalšia. Písanie: 6 bublín, pole prilepené ku klávesnici (`useKeyboardEdge`),
  počet v texte („pivo6“, „6x pivo“ – `lib/parseItem.ts`).
- **Nákup:** kategórie s animáciou v poradí trasy obchodu (`storeRouteOrder`), žiadosti, koniec nákupu.
- **Prehľad zoznamov:** karta živého nákupu pulzuje, recepty v odznaku sa posúvajú (`Marquee`).
- **Recepty:** X na okamžité zrušenie čakajúceho receptu (aj „Rozpracovaný nákup“).
- **Hlas:** len tiché nahrávanie (`useRecorder`) bez spracovania reči telefónu – inak iPhone
  pípa. Zvuk appky (AudioContext) sa po nahrávaní zatvorí, inak pípa pri minimalizovaní. Spracovanie zvuku telefónom
  (echoCancellation, autoGainControl) NEVYPÍNAŤ – bez neho iPhone dáva tichý zvuk a hlas nefunguje vôbec. V testovacej
  appke je nad panelom hlasu kontrolný riadok: stav zvuku · ▲hlasitosť / prah reči · ↑odoslané vety.
  Diktovanie v poli zoznamu: `features/voice/useDictation.ts`. Úseky reči idú na server súbežne (výsledky v poradí),
  kým sa spracúvajú, v zozname je karta „Spracúvam vetu…“. Rozpoznanie reči (`useRecorder`) počíta s tichým
  mikrofónom bez automatickej hlasitosti aj so stálym hlukom; pri dlhom diktovaní odošle úsek už po krátkej pauze.
  Ak iPhone zvuk appky nepustí (prišlo 0 nahrávok od 926f665), do 1,5 s sa ukáže „Ťukni kamkoľvek“ a ťuk ho rozbehne
  (`stalled`/`wake` v `useRecorder`). Overiť na skutočnom iPhone: v záznamoch parse-voice musia pribúdať „audio“.
- **Viac:** hlavné prepínače + „Rozšírené“, rozpočet cez list z Analytiky, poradie obchodov ťahaním,
  vibrácie na iPhone cez systémový prepínač (`haptic()` v `components/kit.tsx`).
- Systémová lišta iPhonu vo farbe témy, plynulejšie animácie (`components/motion.ts`: FLIP, animateOut, collapseOut).

## Prestavba testovacej appky podľa mockupu (plán schválený 2. 11. 2026)

Plán `prototyp/plan-prestavby.html`: fázy 0 (poistky, bezpečnostné opravy, testovací účet) → 1 vzhľad a kostra → 2 Domov,
Nákupy, História → 3 zoznam a pridávanie (všeobecná/druh/značka) → 4 nákup a bloček → 5 hlas 2.0 → 6 recepty → 7 výdavky →
8 upozornenia a Viac → 9 uvítanie a nápovedy (ukážka bez zápisu do DB) → 10 pred obchodmi. Každá fáza: súpis, migrácia do
testovacej DB + core_test, kód + sk/en, `npm run check`, prekliknutie testovacej adresy, push, odskúšanie majiteľom.
Rozhodnutia majiteľa (2. 11.): vo všetkých piatich rozporoch ide appka podľa mockupu (kategórie v zozname, návrhy pri písaní
ako zoznam riadkov, rad často kupovaných namiesto doku, záložky Domov · Nákupy · mikrofón · Recepty · Výdavky s Viac pod
avatarom, témy Teplá kuchyňa a Fotky a sklo – obe, každá svetlá a tmavá). Pravidlo: vždy len jedna fáza, ďalšia až po „OK“
majiteľa; žiadny Pull Request bez pokynu.

**Fáza 0 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** zlúčená zmena z `main` (čítanie dokladov na pozadí, meranie nákladov AI);
poistka AI – `parse-voice` a `recipe-ai` pred volaním Gemini overia v DB (`ai_allow`), že volajúci je členom domácnosti a
domácnosť neprekročila limit (hlas 300/h a 1500/deň, recepty 40/h a 200/deň; počíta sa z `ai_usage`), spotreba sa zapisuje;
appka posiela `household_id` (`features/household/current.ts`); chyba `error.AI_LIMIT`. Zamknuté vnútorné funkcie
`_auto_match_receipt`, `_receipt_list_score` (a spúšťače). Testovací účet + `testy/preklikanie.cjs` (0 nálezov, 2 vzhľady × 22 obrazoviek).
Hlas pri prekročení limitu ukáže len všeobecné „nerozumel som / nepodarilo sa“ (konkrétny text príde s Hlasom 2.0 vo Fáze 5).
Ďalej: Fáza 1 (vzhľad a kostra).

**Postup prestavby (pokyn majiteľa 2. 11.): appka má byť 1:1 ako interaktívny mockup, napojená na funkčný backend.**
Preto sa vzhľad NEkreslí nanovo – preberá sa priamo kód mockupu: `python3 prototyp/do-appky.py` vygeneruje
`src/mockup/mockup.css` (štýly prototyp/css bez rámu telefónu, obmedzené na obal `.bhm`, animácie s predponou `mk-`),
`src/mockup/icons.ts` (ikony Phosphor), `src/mockup/assets.css` + `public/mk/em|pic` (3D emoji a fotky). Na `<html>` je trieda
témy ako na `.app` v mockupe (`w` / `g`, tmavý `t-d`). Prenesená časť appky je v `<div className="bhm">` (= `.app` mockupu);
rozdiely voči rámu telefónu (posúvanie okna, pevná lišta, okraje iPhonu) sú len v `src/mockup/adapt.css`. Prvky z `ui.jsx`
sú v `src/mockup/ui.tsx` (I, E, IB, Seg, MeBtn, Back, MkHeader). Každá ďalšia fáza prenesie obrazovky z `prototyp/src/*.jsx`
takmer doslova a napojí ich na `features/*/api.ts`; mockup ostáva jediný vzor (zmena vzhľadu = zmena v prototype + skript).
Staré (ešte neprenesené) obrazovky ostávajú mimo `.bhm` a používajú farby tém zo `src/styles.css` + `styles/themes.css`.

**Fáza 1 – HOTOVÁ 2. 11., prerobená 1:1 (čaká na „OK“ majiteľa):** témy Teplá kuchyňa / Fotky a sklo × svetlý / tmavý /
podľa systému (`bh.style`, `bh.theme`), lišta, hlavička (avatar · malý nadpis pri posúvaní · tlačidlá, veľký nadpis),
pozadie Fotiek a skla (.bgl z mockupu), výber témy vo Viac – všetko z kódu mockupu. Domov je zatiaľ rozcestník (Fáza 2),
na zozname sa lišta skryje ako v mockupe. Tlačidlo „?“ (nápovedy) príde vo Fáze 9. Preklikanie 4 vzhľady × 23 obrazoviek: 0 nálezov.

**Fáza 2 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** z mockupu prenesené Domov (`/`, `features/home/HomePage.tsx`:
Treba vybaviť = nákupy bez bločku za 30 dní, Nákupy = kto nakupuje + najbližší zoznam s Nakupovať, Naplánované recepty =
`recipe_plans` PENDING, Rýchlo), Nákupy (`/lists`, `ShoppingHub.tsx`: karty .lcard s košíkom, + Nový zoznam, História),
História (`/history`) a detail nákupu (`/history/:id`, `HistoryScreens.tsx`: spolu z bločku, Odfotiť bloček, kúpené
položky, Nakúpiť znova = nový zoznam na zajtra s rovnakými položkami cez add_item). Ikony položiek: 3D emoji podľa názvu
z katalógu mockupu (`src/mockup/catalog.ts`, `emojiFor`), dlaždice obchodov podľa názvu zoznamu (`storeKeyOf`).
Appka sa otvára na Domove; Nákupy sú na `/lists`. Databáza bez zmeny.
**Fáza 3 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** zoznam (`/lists/:id`) prenesený z mockupu: `ListView.tsx`
(hlavička Späť „Nákupy“ · ľudia · ⋯, názov s obchodom a dňom, karta Odhad nákupu s rozpätím a Nakupovať, položky,
skupiny receptov podľa poznámky „na …“, V košíku s Odstrániť/Vrátiť) a `ListParts.tsx` (riadok ceny, potiahnutie
+1/−1/zmazať, ťuk na množstvo = − / +, pole s návrhmi a „Často kupujete“, detail položky: množstvo, Kusy/Váha, odhad,
bežná cena s históriou, Spresniť druh alebo značku, poznámka, Presunúť do, Zmazať). Mikrofón v poli otvorí hlasový režim
rovno pre tento zoznam (Fáza 5 ho prerobí). Nákupný režim, žiadosti a sledovanie ostali v `ShoppingPage.tsx` (Fáza 4).
Rozpoznanie a ceny: `itemCatalog.ts` (+ testy) nad DB funkciou `item_catalog` (produkty domácnosti s nákupmi z bločkov
za 180 dní). Pravidlo „appka nič nedomýšľa“: všeobecná položka = druh `products.kind` („pivo“ → priemer druhov piva
v tej istej kategórii), druh = názov produktu („Svetlé pivo 12°“), značka = `products.brand` s hovorovými menami
(„plzeň“ → Pilsner Urquell, cena len z nej); inak sa pridá text tak, ako je, bez ceny. Druh/značka = medián
posledných 3 nákupov za 120 dní (prednostne v obchode zoznamu), všeobecná = priemer bez extrémov; vážený tovar
v kusoch = cena za kg × bežne kupovaná váha (pri 3+ kusoch váha kusu). Rovnaký odhad je na kartách v Nákupoch a na Domove
(`estimate.ts`). Starý `PlanList`/`Composer`/`QuickDock`/`EditItemSheet` sa už na zozname nepoužívajú (Composer ešte
v nákupnom režime). Menu ⋯ je zatiaľ starý panel – prenesie sa s Fázou 4.
**Fáza 4 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** z mockupu (`shop.jsx`, `receipt.jsx`, menu ⋯) prenesené:
nákup v obchode (`ShopScreen.tsx`: hlavička s časom, sumou v košíku a pásikom, obrazovka ostáva zapnutá, položky podľa
trasy v obchode s „Teraz: …“, odškrtnutie fajkou v ikone, ⋯ → Nemali, žiadosť člena s Pridať/Odmietnuť, Dokončiť),
„Nákup dokončený?“ (nechať nekúpené na budúce = `finish_shopping` MOVE, inak sa odstránia; Odfotiť bloček / Teraz nie),
bloček (`ScanScreen.tsx`, `/scan?nakup=<id>`: odfotiť / z galérie → „Čítam bloček“ (server) → výsledok so
spárovaním riadkov s kúpenými položkami, zaplatené vs. odhad, navyše, čo chýba), sledovanie nákupu iného člena
(`FollowScreen`, „Poprosiť o…“ = žiadosť), menu ⋯ (`ListMenuSheet.tsx`: premenovať, zmeniť obchod = názov, skopírovať
ako text, odstrániť odškrtnuté, zmazať = archivovať s Vrátiť). Odfotiť bloček z Domova a z detailu nákupu ide na `/scan`.
Starý nákupný režim a staré časti zoznamu zmazané (ShoppingMode, PlanList, Composer, QuickDock, EditItemSheet,
ListSheet, ListActionsSheet). Rozdiely od mockupu: prepínač „Zapísať ceny“ vo výsledku bločku nie je (appka ceny
z bločku zapisuje vždy), tlačidlo je „Hotovo“ (bloček je už uložený). Sledovanie (Follow) sa nedalo preklikať –
testovací účet je v domácnosti sám.
**Fáza 5 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** hlasový režim (`VoiceSession.tsx`) má vzhľad a ovládanie z mockupu
(`voicetalk.jsx`): hore „Do: <zoznam>“ (predvolene najbližší otvorený zoznam, ťuk → „Kam pridávať?“), položky padajú
zhora s ikonou, cenou a viditeľnou opravou na 3 s (~~plzeň~~ → Pilsner Urquell, ~~2 ks~~ → 3 ks), nejasná položka
s možnosťami, ťuk = úprava (rýchle množstvá, „Upravujem: …“, Zmazať), dole „Počúvam / Počujem / Pozastavené“, Písať,
guľa (pauza), Hotovo → ak cieľ nie je jasný, „Kam pridať N položiek?“ (existujúci zoznam alebo nový: obchod, deň,
kto ho uvidí – „Iba ja“ = súkromný). Engine ostal (tiché nahrávanie bez pípania, parse-voice, recepty hlasom, koncept
v zariadení). Nové: názvy sa pri uložení riadia katalógom (plzeň → Pilsner Urquell) a z názvu od AI ostanú len slová,
ktoré zazneli (`keepSaidWords` – „dve mlieka“ ≠ „Mlieko plnotučné“). Mikrofón v poli zoznamu otvorí hlas pre ten zoznam.
Známe: pri veľmi rýchlych vetách za sebou (bez pauzy) sa môžu výsledky AI premiešať – pri bežnom diktovaní nie.
**Fáza 6 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** Recepty z mockupu (`cookbook.jsx`, `recipes.jsx`, `book.jsx`):
`RecipesPage.tsx` (Kniha receptov: hľadanie aj hlasom – tiché nahrávanie, Ochutnávač, kategórie s fotkami, rýchly výber,
odporúčané, zdroje; Moje: pridať vlastný, obľúbené, pridané vami, naposledy varené; Plán týždňa: 7 dní, chýbajúce suroviny
do najbližšieho zoznamu), `CollectionPage.tsx` (`/recipes/c/:druh/:id`, triedenie), `RecipePage.tsx` (detail: fotka,
čas, kcal, cena za porciu z bločkov, porcie, „mám doma“ ťukom – pamätá sa v zariadení `bh.recipeHave`, základné suroviny
predvolene doma; postup; listovanie; dole Kúpiť N surovín), `sheets.tsx` (Naplánovať, Pridať suroviny – nový zoznam
alebo existujúci, deň), `CookPage.tsx` (kroky, viac časovačov naraz, Hotové je keď / Tip, suroviny), `TastePage.tsx`
(`/recipes/taste`, potiahnutie, dvojťuk = Chcem, Zhoda! keď recept chce aj iný člen). Kategórie knihy sú mapované
na kategórie a druh mäsa receptov appky (`mk.tsx` RCATS). Rozdiely: v knihe nie je sekcia „Na otestovanie AI“
(obsah knihy je samostatný projekt); pri chýbajúcom recepte appka nesľubuje doplnenie (nemá kam si to zapísať);
AI otázky počas varenia a starý košík receptov (`/recipes/cart`, `/recipes/check`) z obrazoviek zmizli – súbory ostali.
**Fáza 7 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** Výdavky z mockupu (`money.jsx`, `receipt.jsx`): `MoneyPage.tsx`
(`/analytics`: chýbajúce bločky s Odfotiť / Bloček nemám, Odfotiť bloček / Všetky bločky, Týždeň / aktuálny mesiac / Rok
v adrese `?per=`, prstenec kategórií so súčtom a porovnaním, rozpočet – panel s posuvníkom, týždne/mesiace, kam peniaze
odišli, obchody, „Oplatí sa vedieť“ zo zmien cien a dochádzajúcich vecí; v téme sklo veľké číslo a dlaždice),
kategória → druh → výrobok → bloček a obchod v štýle mockupu (`CategoryPage`, `KindPage`, `ProductPage` – úprava
a zlúčenie výrobku ostali pod ⋯, `StorePage`), Bločky (`ReceiptsPage`: mesiace, po dňoch, hore „Na kontrolu“,
v ⋯ výdavok bez bločku a výpis z banky) a detail bločku (`ReceiptDetailPage`: zaplatené, rozdiel, kontrola s
opravami, nákup / Priradiť k nákupu, položky → výrobok, fotka, Upraviť / Pridať položku / Zmazať). Databáza bez zmeny
(všetko z analytics_*). Zmazané staré obrazovky (AnalyticsLayout, OverviewTab, CategoriesTab, StoresTab, akit, charts,
ReceiptRow, UploadStatus, useBatch). Rozdiely: zoznam bločkov už nemá hľadanie, spájanie a hromadné nahrávanie
(mockup ich nemá); `/analytics/products` (hľadanie výrobkov) ostal len ako adresa.
**Fáza 8 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** Viac z mockupu (`more.jsx`, `notif.js`): `MorePage.tsx` – profil,
Upozornenia (`features/more/notif.ts`: kto nakupuje, kto pridal položky, chýbajúce bločky, zmena ceny; počíta sa
z existujúcich dát, „prečítané“ v zariadení `bh.notifSeen`; nové označí červená bodka na avatare `MeBtn`), Téma, Vzhľad,
Domácnosť (členovia, Pozvať – odkaz cez zdieľanie telefónu alebo skopírovanie, jedna pozvánka na otvorenie, Spravovať,
Prepnúť, Nová), Nastavenia (rozpočet cez panel z Výdavkov, Čo mám doma – `bh.pantry`, recepty to predvolene nekúpia,
obchody, upozornenia, prepínače, rozšírené, jazyk, export, pomoc), Odhlásiť, Zmazať účet, zdroje fotiek. Databáza bez
zmeny. Chýbajúce ikony Phosphor (bell, sign-out, download-simple) v `src/mockup/icons-extra.ts`. Podstránky
`/more/household`, `/more/notifications`, `/more/stores`, `/more/tiles` ostali v pôvodnom rozložení (mockup ich nemá).
Upozornenia do telefónu (push) sú samostatný krok.
**Fáza 9 – HOTOVÁ 2. 11. (čaká na „OK“ majiteľa):** Uvítanie, ukážka a nápovedy (`src/features/help/`, mockup
`coach.jsx`, `tour.jsx`). Stav v zariadení `bh.help` (uvítanie prebehlo, nápovedy zap./vyp., videné, prejdené kapitoly,
Prvé kroky). Vitajte pri prvom spustení v zariadení: „Prezrieť si ukážku“ (Zoznámte sa → Základy, 3 kapitoly) alebo
„Začať naprázdno“ (prehrajú sa nápovedy Domova, na Domove karta Prvé kroky: prvý zoznam / pozvať / prvý bloček). Potom
nič samo – „?“ vpravo hore na Domove, Nákupoch, zozname, Histórii, Receptoch, recepte, Výdavkoch, Viac, v nákupe,
sledovaní, hlase, varení a Ochutnávači ponúkne nápovedy obrazovky / kapitolu / celú ukážku; Viac → Pomoc a ukážka
(8 kapitol, nápovedy zap./vyp., ukázať znova). Nápovedy (`hints.ts`, 35 tipov, texty `co.*`) ukazujú na skutočné prvky.
**Ukážka beží v mockupe** cez celú plochu (`Demo` → `/prototyp/?ukazka=zaklady|vsetko|k0…k7&tema&vzhlad[&z=pomoc]`):
mockup v tomto režime nič neukladá ani neposiela, koniec a prejdené kapitoly oznámi appke správou (`bh-demo-end`,
`bh-demo-ch`). Overené: celé Základy v appke až po koniec, do DB počas ukážky žiadny zápis. Oprava prevodu štýlov:
trieda svetlého režimu `t-l` (okná nápovedy mali priehľadné pozadie). Od Etapy 7 (3. 11.) má ukážka vymyslené údaje,
tyká a v appke má 0,7 MB; je stále len po slovensky.
**Plynulosť animácií – 2. 11. (na žiadosť majiteľa):** meranie so 4× spomaleným procesorom ukázalo: pole dole počas
prechodu odskočilo (posun obrazovky z nej urobil kontajner pre pevné prvky), poloha posúvania skákala a nevracala sa,
stará obrazovka zmizla naraz, pri prvom otvorení obrazovky prebehla prázdna stránka, rad návrhov v zozname pribudol
neskôr (+60 px), ťah panela prekresľoval obsah, nekonečné pulzy prekresľovali tieň v každom snímku, hlášky miznuli naraz.
Oprava: prechody cez View Transitions (`src/components/navMotion.tsx`, `MotionRouter` namiesto `BrowserRouter`):
prehliadač nasníma starú obrazovku, appka v pokoji nakreslí novú, potom sa snímky vymenia mimo hlavného vlákna –
dopredu sprava, späť doprava, bloček/varenie/Ochutnávač zdola, záložky prelínaním, zmena len parametrov adresy bez
animácie (CSS v `src/styles/shell.css`). Poloha posúvania: nová obrazovka hore, späť = pôvodné miesto (`bh.scroll`
v relácii). Stiahnuté obrazovky sa vykreslia hneď (`page()` v `App.tsx`), čakanie na kód nechá starú obrazovku.
Potiahnutie späť z okraja: pevné prvky dostanú vyrovnanie, návrat len prelínaním. Panel: ťah bez prekresľovania,
švih nadol zavrie. Nákup/sledovanie začaté na zozname vyjde zdola, hlas sa zatvorí zasunutím nadol, hlášky plynulo
odídu. Bez podpory View Transitions (iOS < 18) len krátke prelínanie. Pri „obmedziť pohyb“ v telefóne bez animácií.
3. 11.: Recepty bez čísla na lište (počítalo aj recepty bez dňa, ktoré v Receptoch nevidno; mockup číslo nemá).
Výdavky: listovanie obdobím ‹ › (mesiac, týždeň, rok) – `?o=-1` v adrese, platí aj na detailoch; v Roku ťuk na mesiac.
11. 11.: Plán týždňa – časti „Bez dňa“ (recepty pridané do nákupu bez dňa) a „Z minulých dní“ (neuvarené); „Určiť deň“ = `plan_recipes` s pôvodným zoznamom a bez surovín (nič sa nepridá dvakrát), dá sa aj odstrániť z plánu. Bez zmeny DB (migráciu `set_recipe_plan_day` majiteľ nepovolil – netreba).
11. 11.: **Vizuálne doladenie** (pokyn majiteľa: svetlé vzhľady pôsobili ako demo) – `src/mockup/finish.css` (načítava sa
posledné): tiene vo farbe témy (kontakt + mäkký rozptyl), Teplá svetlá – karty s jemným prechodom, textúra papiera 3 %,
hlavné tlačidlo s prechodom a hranou; Sklo svetlé – redší závoj (pozadie má farbu), karty ako zmatnené sklo
(backdrop blur 22 px, saturate 1,7) so svetlou hranou, aj v tmavom; texty na fotkách kategórií čitateľné (silnejší
prechod, tieň, max 2 riadky); prepínač (`Seg` v `ui.tsx`) má posuvnú zvolenú plochu; ikona lišty poskočí; odozva na
dotyk (stmavnutie, ikonové tlačidlá). Opravy: fotky jedál v štvorčekoch (`.th`) sa neukazovali – triedy `pic-` majú
`:root` (`do-appky.py`, `kniha.css`); suma Spolu na detaile výrobku pretekala; chýbajúce bločky – fotoaparát ako ikona,
dátum v jednom riadku; podnadpis na Domove sa nezalomí s „·“ na začiatku riadku; recepty bez fotky majú emoji podľa
jedla (`art()` v `mk.tsx`); varenie – posúvaný krok pri okraji zmizne. `testy/preklikanie.cjs` vie aj inú veľkosť (`W=375 H=667`).
**Zlúčenie 11. 11. (pokyn majiteľa „zlúč to do testovacej appky“):** do testovacej vetvy prišiel „Finálny vzhľad“ a naklikanie
kusov z vetvy `claude/jolly-lamport-pu5abj`. Z „Vizuálneho doladenia“ vyššie ostali len emoji podľa jedla (`mk.tsx`),
mäkký okraj varenia (`adapt.css`) a `W/H` v preklikaní; `src/mockup/finish.css` a posuvná plocha v `Seg` (`ui.tsx`) boli
odstránené – robili to isté ako `prototyp/css/finish.css` (dva jazdce prepínača, dve vrstvy tieňov).
Automatické testy prototypu (Playwright, vzor aj pre testy appky): `prototyp/testy/` – `sprievodca.cjs` (celá ukážka,
FLOW=basics|rest|all), `napovedy.cjs` („?“ na 13 obrazovkách), `pridavanie.cjs` (smotana/pivo/plzeň…), `rozlozenie.cjs`
(pretekanie a prekrývanie na všetkých obrazovkách), `metriky.cjs` (ťukacie plochy, písmo, kontrast). Spustenie:
`python3 prototyp/build.py && python3 prototyp/test-html.py && node prototyp/testy/<test>.cjs`.

## Rozhodnutia majiteľa (nemeniť bez opýtania)

- ~~Plánovanie bez kategórií~~ a ~~6 bublín / dok~~ – 2. 11. nahradené mockupom (pozri Prestavba). Kategória sa priraďuje
  pri pridaní. Poradie trasy je všeobecné, nie podľa obchodu.
- Pridávanie: appka nič nedomýšľa – „smotana“ = Smotana (priemer druhov), „kyslá smotana“ = druh, „plzeň“ = značka (cena len z nej).
- Nápovedy a ukážka sa samy ukážu len pri prvom spustení, potom len cez „?“. Ukážka nesmie zapisovať do DB.
- Hlas nesmie vydávať žiadne zvuky. Pásik ˄ ˅ ✓ nad klávesnicou iPhonu z webu skryť nejde (len natívna appka).
- Texty po slovensky, jednoduché, bez skloňovania mien („Nakupuje: Lucia“).
- Appka tyká (3. 11. 2026). Dokument = „bloček“.
- Položka pridaná počas cudzieho nákupu ide cez schválenie nakupujúcim (3. 11. 2026).
- **Recepty – poradie (16. 11. 2026): najprv slovenské a české, potom zahraničné, nakoniec exotické.** Recepty musia byť
  skutočné a overené metódou „kotva“ (žiadne priemery), s fotkami. Analýza zdrojov (16. 11.): dokument „Zdroje receptov:
  najprv slovenské a české…“ na https://claude.ai/artifact/4RnqjfoFYcEBJ7z44YNiak. Pre SK/CZ: Toprecepty.cz, Apetitonline.cz,
  Vaření.cz, Labužník.cz, recepty.aktuality.sk, Receptár.sk (strojovo nezakazujú; meranie v scratchpade `ana/cover.py`).
  Varecha.sk strojové sťahovanie zakazuje (noai, tdm-reservation) – nepoužívať. Voľný text: staré kuchárky Vansovej
  a Rettigovej, Wikiknihy (CC BY-SA); voľné fotky: Wikimedia Commons.
- **Recept = jeden najlepší skutočný recept, nie spojenie viacerých (16. 11. 2026).** Z 11–20 receptov na jedlo sa vyberie
  najlepší (najviac hodnotení, všetky množstvá, najpodrobnejší postup, redakčný), ktorý prejde kontrolou proti ostatným:
  má suroviny väčšiny (najviac 1 chýba), najviac 1 množstvo mimo bežného rozpätia a postup väčšiny. Suroviny a množstvá
  sa prevezmú presne bez zmien; postup s rovnakými krokmi, časmi a teplotami sa napíše vlastnými slovami, podrobnejšie
  pre začiatočníka. Ak žiadny recept neprejde, jedlo ide do karantény (doplniť zdroje), nič sa nevymýšľa. Overené na
  našich 11 jedlách: vyhovujúci recept existuje pri 10 (nie pri muse, má len 11 zdrojov). Duplikáty stráži zoznam jedál
  (jedno jedlo = jeden záznam, varianty len pri inom postupe/surovinách). Návrh ChatGPT (balík „Recipe Factory“,
  16. 11.) slúži ako kontrolný zoznam: prevziať katalóg v DB, uložený stav receptov, poctivé stavy overenia; nie
  9 tabuliek, fronty a vymýšľanie receptov. Jeho katalóg 250 jedál treba očistiť od duplikátov.
- **Fotky až na konci, keď bude databáza receptov plná (16. 11. 2026).**
- **Návrh riešenia knihy receptov (16. 11. 2026, schvaľuje majiteľ):** https://claude.ai/artifact/BqMuG8JGCLiVFMY7FwwaBo –
  výrobná linka v 9 krokoch (zoznam jedál → zber 11–20 receptov zo 6 webov → kontrola a výber → prevzatie → rady pre
  kuchára s pôvodom → 9 automatických kontrol vrátane nezávislej druhej kontroly textu → schválený recept v DB → fotky
  na konci → ostrá appka). Bez skúšobného varenia a bez ručnej kontroly (majiteľ nemá čas) – o kvalite rozhodujú
  automatické kontroly, neprejdený recept ide do karantény. Recepty sa presúvajú z kódu do DB (3 časti: zoznam jedál,
  zdroje, recepty knihy; stavy naplánovaný → zdroje → vybraný → napísaný → schválený → s fotkami / karanténa). Nástroje:
  recipe-scrapers (MIT) na čítanie webov, slovník slovenských/českých názvov surovín, kontroly = kód appky. Fázy:
  1 databáza a zoznam 250 jedál, 2 linka na 1 recepte, 3 pilot 20 receptov, 4 dávky, 5 fotky, 6 ostrá appka.
  **Spresnenia majiteľa (16. 11. večer, zapracované v dokumente):** postup sa preberá VERNE – každý úkon, poradie, čas,
  teplota a množstvo ako v recepte, nič sa nevymýšľa ani nevynecháva; mení sa len jazyk viet (preklad do slovenčiny,
  delenie dlhých krokov). Recept sa berie z 3 najlepších webov – Apetitonline.cz, Vaření.cz, Toprecepty.cz (merané:
  medián 39 / 53 / 15 hodnotení na recept, 151 / 128 / 118 slov postupu); slovenské špeciality z recepty.aktuality.sk
  a Receptár.sk, zahraničné z GuteKueche.at; Labužník len na porovnanie (medián 1 hodnotenie). Varianty = samostatné
  recepty spojené do rodiny (rezeň, cheesecake, halušky…), najviac 6 na rodinu, každý s vlastným zdrojom a kontrolou.
  Základná porcia = porcia pôvodného receptu; prepočet podľa druhu jedla: voľný (½–2×) pri varení, po kusoch, pri pečení
  len celé násobky; časy sa nenásobia, vajcia na celé kusy. Výživa a alergény počítané zo surovín (USDA, 14 alergénov EÚ),
  označené „vypočítané zo surovín“. Cieľ asi 3 000 receptov (míľniky 20 / 250 / 1 000 / 3 000), prevažne SK/CZ + asi
  300 u nás bežne varených zahraničných; ďalšie krajiny neskôr (recept má kuchyňu a jazyk). Ochutnávač ukazuje recept
  až s fotkami; kategórie sa rozšíria (prílohy, šaláty, pečivo, koláče, torty, sviatočné).
- **Recepty sa kopírujú presne (19. 11. 2026, rozhodnutie majiteľa):** z jedného najlepšieho receptu sa prevezmú suroviny,
  množstvá, údaje aj postup bez zmien – nič sa nespája, nepíše vlastnými slovami ani nedopĺňa. **Spresnené 20. 11.:**
  recept sa uloží presne v jazyku a znení zdroja (český po česky, slovenský po slovensky, aj so značkami, tipmi a výzvami
  autora, aj s chybami zdroja); stĺpec `book_recipes.lang`. Preklad cs→sk a sk→cs bude neskôr samostatná vrstva, originál
  sa neprepisuje. Jednotky sa ukazujú len g, kg, ml, l (dkg, dl, hrnčeky appka prepočíta pri zobrazení – `metric()`).
  Cena na porciu, cena nákupu a kalórie sa ukážu len pri úplných údajoch (každá surovina s množstvom má cenu / výživu),
  inak vôbec – radšej nič ako zlé číslo (pokyn 20. 11.: kačica nemôže stáť 25 centov). Alergény ukazuje recept z knihy vždy
  (hore pri čase), pri surovine mimo databázy potravín „a možno ďalšie“ + v Info „nevieme určiť pri …“ (`fullCost` v `mk.tsx`,
  `recipeAllergens` v `kniha.ts`).
  **Kategórie (20. 11., podľa Vaření, Varecha, Apetit):** dlaždice Polievky, Mäso, Kuracie a hydina, Cestoviny/ryža/pizza,
  Ryby, Bez mäsa a šaláty, **Raňajky** (samostatne) a **Koláče a dezerty**; podkategórie `SUBCATS` v `mk.tsx` (stĺpec
  `book_recipes.subcategory`, na stránke kategórie filtre): sladké = torty, cheesecaky, koláče a rezy, kysnuté pečivo,
  zákusky a drobné pečivo, dezerty a krémy, sladké jedlá; polievky = vývary, krémové, zeleninové, mäsové a kapustové;
  mäso = hovädzie, bravčové, jahňacie a zverina; hydina = kuracie, kačica a hus, morka; cestoviny = zapekané, s omáčkou,
  ryža, pizza; bez mäsa = zeleninové, zo syra a vajec, strukoviny, šaláty; raňajky = sladké, slané, kaše.
  **Koláče bez porcií:** `book_recipes.yield_text` = výťažok zo zdroja („1 cheesecake (forma Ø 20 cm)“); pri `scale = whole`
  appka ukáže „Koľko upiecť: 1× recept“ + „Recept na: …“, kusové pečivo (`piece` + výťažok) po polovici receptu v kusoch
  (laskonky 10/20/30/40 ks). Migrácia `20261120000046_book_recipe_subcategory_yield` (TESTOVACIA DB).
  **Čo sa z receptu NEberie (pokyn 20. 11., spresnenie „presnej kópie“):** berie sa podrobný postup, tipy a rady k vareniu
  a naše upozornenia; vynechajú sa výzvy autora (komentáre, hodnotenie, sledovanie), odkazy na obchody a iné články,
  reklama na výrobky (napr. Tescoma, „kúpite ich tu“), značky obchodu v surovinách (Lidl: Alesto, Belbake, Pilos, Kania,
  Pikok…) a smajlíky. Originál ostáva vo `verification.original`. Text pod receptom už netvrdí „spojené z receptov“.
  **Polotovary s postupom (pokyn 20. 11.):** pri preberaní receptu vždy posúdiť, či bežný človek surovinu vie pripraviť
  (pyré z tekvice, zápražka, domáci fondán, karamel, odpaľované cesto, vývar…). Ak nie, pridať k surovine postup prípravy
  `ingredients[].how` = { title, ingredients?, steps, url, orig } – z odkazu v zdroji („jak připravit“), inak z kvalitného
  receptu s hodnoteniami; text doslovne preložený. Appka: „Ako pripraviť“ pri surovine, „Vopred priprav: …“ nad postupom
  a pri 1. kroku varenia (`PrepBox`, `prepsOf` v `book.tsx`). Kupované polotovary (karamelizované kondenzované mlieko,
  mangové pyré) postup nepotrebujú. Zatiaľ: tekvicové rezy (tekvicové pyré, zo zdroja), hovädzí guláš (zápražka,
  Toprecepty „Jíška do zásoby“ 4,7/18).
  Rady, tipy a upozornenia zdroja (bloky „Nejčastější chyby“, „Tipy“, „Tip:“) patria ku kroku, ktorého
  sa týkajú – políčko Pozor (`steps[].warn`) alebo Tip (`steps[].tip`), doslovne; nie ako samostatné kroky na konci
  (pokyn 20. 11.). Právo a licencie si rieši majiteľ sám pred
  vydaním appky – v návrhoch ich neriešiť. Napĺňanie postupne cez predplatné Claude (20 €), nie cez platené API.
  Návrh ChatGPT „Recipe Platform V3“ (17. 11.: 17 tabuliek catalog_*, etapy F0–F8, AI „obohatenie“) je zamietnutý –
  vychádzal zo starého ZIP-u (recepty ešte v kóde) a prerábal by hotovú knihu v DB.

## Otvorené (návrhy čakajú na rozhodnutie majiteľa)

- **Pridávanie do zoznamu – IMPLEMENTOVANÉ v testovacej appke (13. 11. 2026, pokyn „implementuj to do testovacej aplikácie“,
  čaká na skúšku na iPhone):** podľa odporúčaní návrhu (klávesnica pri posúvaní ostáva, potvrdenie v zozname bez hlášok,
  vodorovné bubliny, pridanie hneď). `Composer` v `ListParts.tsx`: okno nad klávesnicou má hlavičku (‹ · názov · „N položiek
  · ~X €“ · Hotovo), v tele zoznam (tie isté `ItemRow` z `ListView` – prop `list`; zasvieti/dorolujú sa len riadky v okne),
  dole rad bublín (`.bb-*` v `pick.css`) a pole. Bubliny sa prepočítajú len pri zmene textu, otvorení okna, načítaní častých
  vecí/zoznamu – po ťuknutí sa nepohnú. Ťuk = `smartAdd(instant, quiet)`; počas cudzieho nákupu sa ťuky na jednu bublinu
  spoja do jednej žiadosti (1,2 s). Mínus len na poslednej ťuknutej bubline (pri 1 ks zmaže s „Vrátiť“). Ťuk do zoznamu
  v okne zavrie klávesnicu (po potiahnutí riadku nie), potiahnutie doku nadol zavrie, `blur` = koniec bez čakania.
  Dátová vrstva: `useAddItem` s `optimistic` ukáže dočasný riadok hneď; `useSmartAdd` číta položky z cache a ťuky počas
  letu pridania pripočíta k dočasnému riadku a dopíše jednou úpravou po ID (žiadne dvojité riadky). `sameProduct` spája
  tvary slova (`itemKey`: banán = banány, rožok = rožky, cukor = cukru; Mlieko ≠ Mlieko polotučné) – platí aj pre hlas.
  Ikony: 10 nových 3D ikon ovocia (mango, kiwi, hrozno, ananás, hruška, melón ×2, čerešne, mandarínky, čučoriedky; Fluent
  MIT) v `prototyp/gen/assets.css` → `do-appky.py`, slová v `EXTRA` v `src/mockup/kit.tsx`. Zmazané: odpočítavanie, „Pridané
  teraz“, názorná ukážka s prstom (+ nepoužívané texty `li.*`).
  Druhý krok (13. 11., pokyn „Implementuj to“ = zvyšok návrhu): neúspešné okamžité pridanie ostane navrchu zoznamu ako
  riadok „Nepodarilo sa pridať · Skúsiť znova“ s krížikom (`FailedAdd` z `useSmartAdd.onFailed`, stav v `ShoppingPage`,
  aj s kusmi naťukanými počas čakania; tlačidlá majú `data-keep`, okno nezatvoria). Ukážka v appke (prototyp
  `lists.jsx` Composer) má rovnaký rad bublín, ťuk = hneď, preklep ako bublina „Zemiaky?“ (sprievodca upravený). Štýly
  bublín sú vo vzorovom prototype (`prototyp/css/base.css`, `g.css`) → `do-appky.py` → `mockup.css`; `pick.css` má len okno.
  Overené: `npm run check`; Playwright s napodobeným serverom (3 ťuky = 1 add + 1 úprava, pomalý server 1,3 s, chyba
  servera → riadok so „Skúsiť znova“, žiadosti, 4 vzhľady pri výške 422 px); na nasadenej testovacej appke so skutočnou
  testovacou DB: nový `testy/pridavanie.cjs` (9 krokov, zoznam „Pridávanie …“ sa na konci archivuje), `testy/nakup.cjs`
  (8 krokov), preklikanie Nákupy + zoznam 4 vzhľady 0 nálezov; testy prototypu `pridavanie.cjs` a `sprievodca.cjs FLOW=all`
  bez chýb. Neoverené: skutočný iPhone (klávesnica, kurzor pri ťuku na bublinu, posúvanie s otvorenou klávesnicou).
  Tretí krok (13. 11., po skúške majiteľa na iPhone – bubliny ostávali „visieť“): **ťukanie s dokončením.** Každý ťuk
  pridá kus hneď, bublina ukazuje počet ťuknutí, „pridané · N ks“ a pásik (1,5 s, `BURST_MS`); keď sa neťuká, bublina
  dostane ✓ a odíde (`OUT_MS` 420 ms) – časté veci nahradí na tom istom mieste ďalšia najčastejšie kupovaná vec, návrhy
  pri písaní sa po dokončení vymenia za časté veci. Text v poli zmizne hneď po prvom ťuknutí (dá sa písať ďalší produkt;
  nový text ťukanie ukončí). Enter = pridá, vyprázdni pole a vráti časté veci. Mínus počas ťukania (aj kým server ešte
  nepotvrdil nový riadok – úprava počká). Počas cudzieho nákupu jedna žiadosť po dokončení. Rovnako v ukážke (prototyp).
  `testy/pridavanie.cjs` má 10 krokov (aj výmenu častej veci a návrat častých vecí), prešiel na testovacej DB.
  Opravy po snímkach majiteľa (13. 11., Sklo tmavé): (1) po zatvorení klávesnice ostala obrazovka na iPhone posunutá
  o výšku klávesnice (pole a bubliny v strede, horná lišta mimo) – iOS nevráti posun vizuálnej plochy; `Composer` si pri
  ťuknutí do poľa zapamätá polohu stránky a po zavretí okna ju vráti (`window.scrollTo`, opakovane do 1 s, kým
  `visualViewport.offsetTop` > 0). Na iPhone neoverené. (2) Riadok zoznamu mal `max-height: 120px` + `overflow: hidden`
  (kvôli animácii zmazania) – dlhý štítok výrobku sa zalomil a štítok obchodu sa schoval pod ďalší riadok. Teraz 260 px
  a štítky v riadku (`.sub .mk`) sú na jeden riadok so skrátením „…“ (`prototyp/css/base.css` → `mockup.css`).
  Návrh: https://claude.ai/artifact/SAVJcwhe4dE5NGpn4rtexX
  (zdroj `prototyp/pridavanie-navrh.html`: dokument + preklikateľný mockup s nakreslenou klávesnicou, ukážkou a prepínačmi
  variantov; obrázky a štýly ako pri návrhu Výdavkov – `mk/mockup.css`, `mk/em/*` sa priložia pri publikovaní). Podnet:
  snímka okna pridávania (okno a „Pridané teraz“ zakrývajú zoznam). Návrh: žiadne samostatné okno – pri písaní ostáva
  zoznam, hlavička na jeden riadok (názov, počet · suma, Hotovo), karta Odhad sa zbalí; nad klávesnicou vodorovný rad
  bublín + pole (ten istý prvok aj bez klávesnice); ťuk na bublinu pridá hneď (bez odpočítavania 1,8 s), číslo v bubline =
  počet v zozname, mínus uberie; po ťuknutí sa pole vyprázdni, ale rad bublín sa nepohne, kým sa nepíše ďalej; klávesnica
  pri posúvaní zoznamu ostáva, zavrie ju Hotovo, ✓ nad klávesnicou, ťuk do zoznamu, potiahnutie doku nadol alebo skrytie
  telefónom (nič nečaká); potvrdenie priamo v zozname (nová položka navrchu, ikona priletí, riadok sa rozsvieti), bez hlášok.
  „banan“ → jedna bublina Banány (iný tvar toho istého slova); Banán/Banány, rožok/rožky sa spoja do jedného riadku.
  Opravy: ikona najprv podľa názvu (Mango mal fľašu pre bábätká, Kiwi košík; doplniť ikony ovocia), chyba pridania ostane
  v riadku so „Skúsiť znova“, zápisy pri rýchlom ťukaní spojiť. Mení rozhodnutie z 2. 11. „návrhy ako zoznam riadkov“.
  Databáza bez zmeny, v appke zatiaľ nič. Po „OK“: najprv `prototyp/src/lists.jsx`, potom `Composer` v `ListParts.tsx`.

- **Výdavky 2.0 – IMPLEMENTOVANÉ v testovacej appke (13. 11. 2026, čaká na „OK“ majiteľa):** pokyn „implementuj to celé
  aj s mockupom“. Rozhodnutia prijaté podľa odporúčaní návrhu (majiteľ môže zmeniť): kalendárne týždne po–ne, ceny
  vždy za posledné 3 mesiace k dnešku, v zozname ostáva napísaný názov položky a konkrétny výrobok je štítok pod ním.
  *Model cien (DB, migrácie 038–041):* fakt = riadok bločku (`_price_facts`); zálohy nie sú tovar (kategória záloha
  alebo 0,15 €/ks pri alkohole a nápojoch); množstvo = balenia × veľkosť balenia, vážené podľa bločku, „6x“ sa nenásobí
  dvakrát; jeden kľúč obchodu (`_store_key` + spúšťač `receipts_store_key_norm`, Lidl = LIDL); jednotka porovnania
  podľa druhu (`_kind_basis`); porovnávajú sa len potraviny, drogéria a pod. (`_comparable` – oblečenie, služby, palivo…
  nie). „Priemerne platíš“ = peniaze ÷ množstvo za 90 dní; „Cena teraz“ = posledný nákup výrobku v obchode bez akcie
  (akcia = zľava ≥ 15 %), čerstvá do 45 dní; úspora len z čerstvých cien bez akcie. Funkcie pre appku:
  `analytics_price_kind`, `analytics_price_product`, `analytics_price_store`, `analytics_daily`, `analytics_missing_sizes`,
  `set_product_size`; `item_catalog` vracia pri nákupoch aj výrobok, balenie a akciu.
  *Odhad v zozname (`itemCatalog.ts`):* najčastejší výrobok položky v obchode zoznamu za 120 dní a jeho posledná cena
  bez akcie; rozpätie = najlacnejší/najdrahší výrobok; vážené podľa hmotnosti s veľkosťou balenia. V detaile položky
  „podľa výrobku …“, „zatiaľ tu nekúpené“.
  *Obrazovky:* Výdavky (súhrn s ‹ obdobie › aj potiahnutím, porovnanie k rovnakému dňu, bez porovnania pred prvým
  bločkom, časová os, Priebeh/Dni v týždni, prstenec kategórií / obchody, Oplatí sa vedieť, bločky), Druh (karty cien,
  úspora, výrobky bez veľkosti, graf, obchody a ceny, značky a balenia, posledné nákupy), Výrobok (Cena teraz,
  Priemerne platíš, Najnižšia cena, graf, obchody, porovnanie, pridať do zoznamu), Obchod (Produkty – „najlacnejší pri
  X z Y produktov, ktoré kupuješ aj inde“, Kategórie, Bločky), Kategória, nová obrazovka Doplniť veľkosť balenia
  (`/analytics/sizes`). Štýly `src/styles/analytics-v2.css` (triedy `an-*`), texty `mn.*` v sk aj en.
  *Overené:* `supabase/tests/price_model_test.sql` v testovacej DB ok=16 fails=0; `npm run check` (196 testov);
  preklikanie 4 vzhľady × 12 obrazoviek na testovacom builde s testovacím účtom – 0 nálezov, fotky prezreté.
  Na reálnych dátach: pivo priemerne 2,35 €/l, najlacnejšie Tesco 2,10 €/l; 7 pív z Lidla bez veľkosti → fronta veľkostí.
  Neoverené: skutočný iPhone. Do ostrej DB nič (migrácie v zozname „Pred zlúčením“).
  **Mockup verzia 4 (13. 11., na otázku „vylepšil by si ešte niečo?“):** v tom istom artefakte, kapitola 7. Návrhy:
  1) bez opakovaných čísel (výrobok kúpený raz = karta „Kúpené raz“; stále rovnaká cena = len Cena teraz; druh z jedného
  obchodu bez druhej karty), 2) chýbajúce bločky zbalené do jedného riadku, 3) v zozname „V obchode X by to vyšlo asi o … €
  lacnejšie“ (len položky s cenou do 6 týždňov v oboch obchodoch, bez akcií; ťuk prepočíta zoznam; v mockupe karta Nákupy),
  4) veľkosť balenia prevzatá z bločku iného obchodu pri rovnakom výrobku, 5) zdraženie v „Oplatí sa vedieť“ (už v mockupe),
  6) textový popis grafov pre VoiceOver. Čaká na výber majiteľa; v appke nič z verzie 4 nie je.

- **Výdavky 2.0 – návrh prestavby karty (11. 11. 2026):** https://claude.ai/artifact/TRAxKhERGN3ZcRiLSiMDQw
  (zdroj `prototyp/vydavky-navrh.html`: dokument + preklikateľný mockup s vymyslenými dátami). Zistenia z testovacej DB:
  „o 1775 % viac ako august“ (v auguste 1 bloček), „Obchod 681 € · Woolworth“ (v testovacej DB 0 zo 67 bločkov má
  `store_key` – všetko sa zlialo do `_none`; ostrá DB 96/97), „3 kg“ pri 3 baleniach po 120 g (KindPage/ProductPage
  píšu k počtu balení jednotku porovnania, pri litroch „ks“), pivo 0,03 €/ks („PLZ 6x“ = zálohy priradené k pivu
  + dvojité násobenie balenia 6 × 6), 315 z 523 položiek bez veľkosti balenia (107 potraviny) → druh mieša €/ks a €/kg,
  dva rôzne „priemery“, Lidl/LIDL nezjednotené, zálohy nikde, obdobie 4× na obrazovke, detail druhu má vlastné obdobie.
  Návrh: jedno obdobie, súhrn s tempom a rozpočtom, pohľady Kategórie / Obchody / Produkty, druh s bežnou cenou
  (medián 3 mesiacov) a poradím obchodov, obchod s „tu vs. inde“, hľadanie, porovnanie obchodov, fronta „Na doplnenie“;
  jednotka porovnania uložená pri druhu (`product_kinds`). 5 krokov, 5 otázok na rozhodnutie. Nič nie je implementované.
  **Verzia 2 (11. 11., po pripomienke majiteľa „neprehľadné, zbytočnosti, vzhľad dospelejší“):** mockup prekreslený –
  hlavička avatar · lupa · fotoaparát, pod ňou Týždeň/Mesiac/Rok, súhrn (‹ obdobie ›, suma, jedna veta porovnania),
  pásik „Chýba bloček“, jedna karta s grafom (priebeh mesiaca + rozpočet + odhad), Kam išli peniaze (6 najväčších),
  Oplatí sa vedieť (max 3), Bločky. Detaily bez vlastného prepínača obdobia. Čiarové ikony kategórií namiesto emoji,
  produkty len text + cena, karty s tenkou linkou bez tieňov, jeden systém tlačidiel / štítkov / upozornení
  (kapitola 5 „Vzhľad a prvky“ v dokumente). Majiteľ odmietol: čiarové ikony nie sú z appky.
  **Verzia 3 (12. 11., pokyn majiteľa: náhľad musí vyzerať ako testovacia appka, farebné ikony, krajšie grafy, lepšie
  listovanie obdobím, logika kategória → produkt → konkrétny výrobok, použiteľné ceny, animácie):** náhľad sa vykresľuje
  priamo štýlmi appky (`src/mockup/mockup.css` pod `.bhm`, téma Fotky a sklo tmavá/svetlá) a jej 3D ikonami a fotkou
  pozadia (`public/mk/em`, `public/mk/pic/trh_p.webp`) – pri publikovaní sa prikladajú ako súbory `mk/…`; nové prvky
  majú triedy `an-*` v `prototyp/vydavky-navrh.html`. Pozor: triedy `.ok`, `.top`, `.wrap`, `.scr`, `.cam` appka už
  používa (kolízie). Nové: časová os (stĺpec = mesiac/týždeň, ťuk vyberie, čiarkovaný odhad a rozpočet; v Roku ťuk otvorí
  mesiac), Priebeh mesiaca s čítaním dňa ťahom prsta, prstenec kategórií, karty cien, cesta v hlavičke detailu
  (Výdavky › kategória › produkt), prechody `in-push`/`in-pop` z appky. Model cien: „Priemerne platíš“ = peniaze ÷
  množstvo za 3 mesiace; „Cena teraz“ = posledný nákup výrobku v obchode bez akcie; obchod pri produkte = jeho
  najlacnejší výrobok podľa ceny za jednotku; „Ušetríš“ = (priemer − najlacnejšie teraz) × mesačné množstvo.
  **Revízia verzie 3 (12. 11.):** automatická kontrola všetkých obrazoviek × obdobia × tmavý/svetlý × 393/360 px
  (pretekanie, orezané texty, písmo < 12,5 px, ťukacie plochy < 40 px, NaN, chyby JS) – opravené: pád pri výrobku bez
  nákupu, pretekanie „Dni v týždni“ na 360 px, písmo 11–11,5 px v grafoch, cesta v hlavičke s plochou 28 px.
  Logika: ceny produktov sú vždy k dnešku (obdobie mení len sumy), trend porovnáva rovnaký výrobok v rovnakom obchode,
  úspora len z ceny do 6 týždňov a nie z akcie, obchod s cenou len z akcie nie je „najlacnejší“, v grafe druhu je za
  obchod čiara jeho najlacnejšieho výrobku, odhad na časovej osi má vlastné číslo. Pri implementácii: grafy sú čisté SVG
  bez knižnice; ťah po grafe a výseky prstenca potrebujú textovú alternatívu pre čítačky; id v SVG musia byť jedinečné.
  (Implementované 13. 11. – pozri položku vyššie.)

- **Revízia pred ostrým spustením (3. 11. 2026):** https://claude.ai/artifact/X8aprnTLiiWL5bgiDQwNAT – preklikané
  4 vzhľady × 19 obrazoviek (0 chýb JS/servera), kód, DB, AI. Blokery P0: zmazanie účtu len predstiera (dialóg + hláška
  „zatiaľ nevie“), chýbajú zásady súkromia/podmienky, offline v obchode (žiadny service worker), push upozornenia,
  zálohy (Supabase Pro), ceny Gemini 3.8/3.6 Flash sa 1. 1. 2027 zdvojnásobia (`_shared/gemini.ts` to nevie →
  `ai_usage` bude klamať). P1: limity AI príliš voľné (hlas 1500/deň, recepty 200/deň, bločky bez limitu), vypnutá
  ochrana uniknutých hesiel, bez sledovania chýb. Dizajn: 3 vizuálne jazyky (Teplá, Sklo, staré obrazovky), karta vs.
  pozadie 1,09:1, biely text na hornej časti oranžového tlačidla 3,8:1 (tichý text je v poriadku – `polish.css` ho
  prepisuje); návrh jednej témy „Harmónia“. Hlas 2.0 (A vzhľad, B Silero VAD, C Gemini Live), matica push,
  tykanie/vykanie zmiešané. Kapitola 11 = 7 rozhodnutí, kapitola 12 = kontrolný prompt na ďalšie revízie.
  **Rozhodnutie majiteľa 3. 11.: obe témy (Teplá kuchyňa, Fotky a sklo) ostávajú, len sa vylepšia; postupne sa opraví
  všetko ostatné z revízie.** Pokyn majiteľa 3. 11.: dizajn a farby sa robia priamo v testovacej verzii
  (vetva `design/v2-mobile-redesign`) na aktuálnych témach – nie v samostatnej vetve.
  - **Etapa 1 – HOTOVÁ 3. 11. (čaká na „OK“):** farby oboch tém v `prototyp/css/polish.css` (blok „Revízia 3. 11.“) →
    `do-appky.py`; staré obrazovky v `styles.css`. Teplá: pozadie #F2ECE2, biele karty s okrajom, akcia #2F6B4F (namiesto
    takmer čiernej #26392D), šalviový nádych hore (`--tint`, v appke na body + systémová lišta). Sklo: tlačidlo
    #C25226 → #A8441F (biely text 4,6–6:1), hustejší závoj, Ochutnávač vo farbách témy. Opakované akcie tónové (košík na
    karte zoznamu, Odfotiť, ▶ Variť, Rýchlo); 2+ chýbajúce bločky = jeden riadok na Domove. Výdavky: „o 83 % menej ako
    1. – 3. 10.“ (DB už porovnávala rovnaké dni, text nie). Rovnaké rozpätie ceny sa nepíše. Kontrolný riadok hlasu len
    s `?diag=1` (vypne `?diag=0`). Texty: „Zabudnuté heslo?“, bez mužského rodu, „vlastník“ jednotne.
  - **Etapa 2 – HOTOVÁ 3. 11. (čaká na „OK“):** migrácia `20261103000035_account_deletion_ai_limits` (v testovacej DB):
    `prepare_account_deletion` + edge funkcia `delete-account` v1 (testovacia DB; zmaže súkromné zoznamy, odíde zo
    všetkých domácností, posledný člen ju zruší aj s fotkami bločkov, potom auth.users). Overené so súhlasom majiteľa
    na skúšobnom účte `zmazanie-test@basket-harmony.invalid` (už neexistuje; heslo ostalo vo vault `delete_test_password`):
    vlastná domácnosť zmizla, v testovacej domácnosti ostala položka bez autora, vlastník bez zmeny, bez tokenu 401,
    bez potvrdenia 400. Viac → Zmazať účet volá funkciu naozaj. Limity AI: hlas 120/h a 400/deň, recepty 20/h a 60/deň,
    mesačný strop 5 $ na domácnosť (`_ai_month_cap`), bločky najviac 40 za 24 h (`RECEIPT_LIMIT`) – overené blokom
    s vrátením (fails=0), testy doplnené do `core_test.sql` (celý súbor stále nebežal – obsahuje `delete`).
    `/privacy` a `/terms` (sk/en, `src/i18n/*/legal.ts`), odkaz pri registrácii a Viac → Súkromie a podmienky.
    `_shared/gemini.ts`: ceny podľa dátumu (3.6/3.8 Flash od 1. 1. 2027 dvojnásobok).
    **Pred zverejnením / do 31. 12. 2026:** nasadiť všetky AI funkcie znova (testovacia aj ostrá DB) – inak `ai_usage`
    od januára ukáže polovičné náklady; doplniť prevádzkovateľa (`legal.operator`); overiť platený plán Gemini API;
    Supabase Pro (zálohy + ochrana uniknutých hesiel: Authentication → Sign In / Providers → Email → Prevent use of
    leaked passwords – je len v Pro). Funkciu `delete-account` nasadiť aj do ostrej.
  - **Etapa 3 – HOTOVÁ 3. 11. (čaká na „OK“):** prihlásenie, nové heslo, prvé spustenie, pozvánka a zásady majú spoločný
    obal `src/features/auth/shell.tsx` (AuthShell, AuthLogo, Field, Note; CSS v `adapt.css` `.auth-pg`) s triedami mockupu,
    v Skle aj fotka v pozadí; Google s logom. Domácnosť, Upozornenia a Moje obchody vo vzhľade tém (MkHeader, .lst/.row,
    Toggle, StoreTile). Podstránka `/more/tiles` zrušená (nič na ňu neviedlo). Avatary všade `memberColor(id)` (aj MeBtn,
    PersonAvatar). Výpis z banky a párovanie bločku doladené v Etape 6.
  - **Etapa 4 – Hlas 2.0, časť A HOTOVÁ 3. 11. (čaká na „OK“):** mikrofón je tlačidlo s ikonou (pauza = sivé s ikonou
    pauzy), prstenec dýcha podľa hlasitosti (`useRecorder.level` → `--lvl` cez requestAnimationFrame, pri obmedzení
    pohybu vypnuté), stav s bodkou (Počúvam / Počujem / Rozumiem vete / Pozastavené / Upravujem), veta pod tlačidlami
    (`vx.cap*`), „Hotovo · N“, príklady len text (`.vx-exl`; v prototype ostali tlačidlá – ukážka nemá mikrofón).
    Oprava: písaný text v hlase už neposiela AI zoznam „často kupujete“ (pokyn „podobne znejúce = ten produkt“ patrí
    k nahrávke) – AI inak menila „chlieb“ na „Rožky“/„Toastový chlieb“. Neurobené: B (Silero VAD – ~2 MB model +
    onnxruntime ~10 MB, treba overiť na iPhone) a C (Gemini Live, živý prepis) – navrhnuté ako pokus s majiteľom.
  - **Hlas 2.0 – živý prepis (Gemini Live) HOTOVÝ 3. 11. (čaká na skúšku na iPhone):** model `gemini-3.5-transcribe-live`
    (sk-SK, ~0,9 c/min reči: zvuk 0,5 + text 0,4; cenník overený 3. 11.). Edge funkcia `voice-live-token` v3 (testovacia DB,
    `verify_jwt`): ai_allow `voice-live` (30/h, 120/deň, mesačný strop), slovník domácnosti (často kupované + značky,
    max 100 → `customVocabulary`), jednorazový token cez `POST v1beta/auth_tokens` s `bidiGenerateContentSetup` (pole
    `liveConnectConstraints` REST nepozná), 1 min na pripojenie, 6 min relácia; do `ai_usage` odhad 1 min na token.
    Appka: `features/voice/live.ts` (WebSocket `…v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=`,
    16 kHz PCM po 100 ms, priebežné zosilnenie), `useRecorder(onSegment, sink)` posiela len reč (aj začiatok vety, keď sa
    spojenie otvorí uprostred), na konci vety `audioStreamEnd` → hotová veta ~0,25 s → rovnaký rozbor ako písaný text.
    Miestny rozbor sa ukáže hneď len keď každú položku pozná katalóg; inak „Spracúvam vetu…“ do odpovede AI (žiadne
    „Mletého“/„Mäsa“). Pri chybe spojenia pôvodné posielanie viet (parse-voice audio), pri výpadku uprostred vety sa
    čakajúce vety pošlú ako WAV. Overené zo sandboxu (USA): token ~1 s, prvý text ~1 s od začiatku reči, „Dve mlieka,
    chlieb, pol kila mletého mäsa a jeden Radegast“ presne; v prehliadači s nahrávkou ako mikrofónom správne položky.
    Neoverené: skutočný iPhone (zvuk bez pípania, appka z plochy). Migrácia `20261103000036_voice_live` (testovacia DB).
    Pred zlúčením: nasadiť `voice-live-token` aj do ostrej (kľúč Gemini musí byť platený – inak Google údaje použije).
  - **Etapa 5 – HOTOVÁ 3. 11. (čaká na „OK“ a skúšku na iPhone):**
    *Offline:* `public/sw.js` (obal stránky sieť → po 3,5 s kópia, `/assets` a obrázky z pamäte, Supabase nikdy),
    `lib/offlineCache.ts` (zoznamy, položky, nákupy, členovia, katalóg v localStorage `bh.cache.v1`, mapy ako `__map`,
    max. 7 dní, pri odhlásení zmazané), mutácie sa pri chybe spojenia opakujú (8×, odstup), `add_item` má rovnaké
    `client_op_id` aj pri opakovaní, bez signálu sa nová položka ukáže hneď (`tmp-…`). Overené lokálne v prehliadači
    s vypnutou sieťou (zoznam sa ukázal, pridanie sa po pripojení uložilo raz). Service worker sa registruje len v builde.
    *Push:* migrácia `20261103000037_push` (testovacia DB): `push_subscriptions` (bez mazania – vypnutý = `disabled_at`),
    `save_push_subscription` / `remove_push_subscription` / `set_push_prefs`, `push_vapid()` (len service_role), spúšťače
    → `_push()` → pg_net → edge funkcia `push-send` v1 (`verify_jwt` false, overuje `x-worker-secret`): nakupuje (ostatní,
    pri súkromnom zozname len autor), koniec nákupu, žiadosť (nakupujúcemu), odpoveď (žiadateľovi), nemali (kto pridal),
    bloček prečítaný / na kontrolu (kto nahral); nikdy nie autorovi akcie, prefs podľa Viac → Upozornenia (na účte),
    noc 22–7 (Bratislava) len žiadosti a odpovede, 404/410 → vypnúť odber. `_shared/webpush.ts`: VAPID + aes128gcm cez
    WebCrypto, overené knižnicou http_ece. Kľúče VAPID: verejný v `.env.*` (`VITE_VAPID_PUBLIC_KEY`), súkromný v trezore
    testovacej DB (`vapid_public`, `vapid_private_jwk`) – pri zlúčení skopírovať rovnaký pár do trezoru ostrej DB.
    Overené: udalosť v DB → push-send → skúšobný odber (httpbin) „sent 1“, 410 → odber vypnutý. Neoverené: skutočné
    zobrazenie v telefóne (prehliadač v sandboxe si odber u Google nevytvorí). Pridávanie počas nákupu ostáva so
    schvaľovaním (rozhodnutie majiteľa 3. 11.).
  - **Etapa 6 – HOTOVÁ 3. 11. (čaká na „OK“):** všetky slovenské texty tykajú (rozhodnutie majiteľa), „doklad“ → „bloček“
    vo všetkých tvaroch, vety o domácnosti bez rodu a množného čísla („Za október sa minulo…“, „Minuté“), ženský/mužský
    rod odstránený („Zabudnuté heslo?“, „Nájdený 1 pohyb“), aj v upozorneniach („Kúpené: 5 · Lucia“, push-send v2).
    Staré obrazovky (hlavička, karty, sekcie, riadky) dostali vzhľad tém v `adapt.css`; výpis z banky má hlavičku
    `MkHeader`. Nákupy v skupinách Dnes (aj práve nakupovaný) / Tento týždeň / Z minulých dní (najnovšie hore) /
    Neskôr a bez dňa, hlavičky len keď je skupín viac; prázdne zoznamy zbalené pod „N prázdnych zoznamov“.
    Návrhy pri písaní: jedlo pred drogériou s rovnakým slovom a iná kategória ako najlepšia zhoda nižšie („mlie“ →
    Mlieko, Trvanlivé mlieko, až potom Telové mlieko); oprava preklepu volí všeobecnejší názov („mleko“ → Mlieko).
    Párovanie bločku a výpis z banky vo vzhľade tém; spodné tlačidlá nad lištou majú plné (v Skle rozmazané) pozadie
    až pod lištu – obsah pod nimi už nepresvitá. Preklikanie 4 vzhľady × 31 obrazoviek (pribudlo párovanie), 0 nálezov. Ukážka (prototyp) má stále vykanie a skutočné dáta – Etapa 7.
  - **Etapa 7 – časť 1 HOTOVÁ 3. 11. (čaká na „OK“):**
    *Rýchlosť* (meranie `Playwright`, procesor 6× pomalší, sieť 4G 150 ms): prihlásenie ~2,0 s, prvé otvorenie Domova
    ~3,0 s (zo sandboxu v USA; každá požiadavka do DB tu má +200 ms, zo Slovenska odhad ~2–2,5 s), ďalšie otvorenie
    ~1,0–1,4 s (offline kópia). Zmeny: anglický slovník sa stiahne len pri angličtine (`loadLocale`, hlavný balík
    781 → 665 kB, zbalený 252 → 216 kB), Domov v hlavnom balíku, ostatné obrazovky sa sťahujú až po prvých údajoch
    a po troch (predtým ~40 súborov naraz brzdilo načítanie domácnosti). CSS (322 kB, z toho `mockup.css` 219 kB)
    ostalo – orezanie by bolo riskantné pre obe témy.
    *Ukážka:* vymyslené bločky domácnosti Kováčovci (`prototyp/src/realdata.js`, 65 bločkov 17. 8. – 21. 10., Lidl,
    Kaufland, Tesco, Billa, dm, Dr.Max, Pepco, Slovnaft, Alza, vymyslená Pizzeria Basilico; značky piva pre
    „plzeň“/„Radegast“), zmazané nepoužívané súhrny skutočných výdavkov v `data.js` (boli v nich aj poisťovňa
    a meno súkromného predajcu), priezvisko „Blahovci“ → „Kováčovci“ (mená Marek a Lucia ostali). Všetky texty
    ukážky tykajú, bez rodu pri kupujúcom („Čo sa kúpilo“, „Minuté“). V appke berie obrázky zo súborov `/mk/`
    (`web.py`): 4,7 MB → 0,7 MB. Testy prototypu: pridávanie, celá ukážka, nápovedy bez chýb; rozloženie 237 nálezov
    (predtým 261, rovnaký druh – lepiaca hlavička nad posunutým obsahom, zámerne prekryté avatary).
    *Testy tokov:* `testy/nakup.cjs` prešiel na nasadenej appke. Našiel chybu: karta kúpeného zoznamu („Nakúpené dnes“,
    Pridať bloček) sa rozpadala – prerobená na riadky vo vzhľade tém; preklikanie má novú obrazovku `zoznam-kupeny`.
    Dlhý názov zoznamu v riadku „Chýbajú bločky“ na Domove pretekal cez „Odfotiť“ – úseky podnadpisu sa skracujú (…).
    Otvorené: ukážka v angličtine (prototyp má texty natvrdo po slovensky – preklad je väčšia práca, alebo ju
    v angličtine skryť), žiadosť počas nákupu a bloček ako test toku (žiadosť potrebuje druhý testovací účet),
    skúška na skutočnom staršom iPhone, kniha receptov v5 (4 rozhodnutia v kap. 12).
  - **Recepty – rozhodnutie majiteľa 3. 11.:** robia sa ako samostatná úloha v novom čete. Požiadavky: bez jedinej chyby,
    suroviny overené vo viacerých nezávislých zdrojoch (nič vymyslené, nič navyše, nič nechýba), presné množstvá na počet
    porcií, skutočné výživové hodnoty, podrobný postup aj pre začiatočníkov (na čo si dať pozor, čo nerobiť), aspoň
    3 fotorealistické fotky na recept v jednom jednotnom štýle pre celú knihu (Ochutnávač ako TikTok má lákať).
    **Plán v3 HOTOVÝ 3. 11. (vetva `claude/relaxed-cori-ubcp6x`, čaká na „OK“ na pokus s 20 receptmi):**
    https://claude.ai/artifact/8nRqJTgePNe4wGs8wtZ44H (kópia `prototyp/recepty-vyroba-navrh.html`). Majiteľ v1 aj v2 zamietol
    (komplikované, drahé, neprehľadné). Chce: každý recept = **spojenie 3–5 skutočných receptov** z najlepších webov (nič
    vymyslené), podrobný postup, reálne množstvá, 3 fotky v jednom štýle, tisíce receptov – najprv SK/CZ, potom aj
    exotické kuchyne; čo najlacnejšie cez predplatné Claude Max (100 €).
    Plán v3: 6 500 receptov v 3 vlnách – Vlna 1 SK/CZ 2 500 (21 kategórií z plánu v5, ciele v pláne), Vlna 2 Európa 2 000,
    Vlna 3 Svet 2 000 + „Navrhni recept“ priebežne. Pravidlá spájania: 3–5 zdrojov z rôznych webov (kópie = 1 zdroj, napr.
    SITA.sk = preklad toprecepty.cz 1495), surovina len ak ju má > polovica zdrojov (2/5 = tip, 1/5 von), množstvo = medián
    zaokrúhlený na mieru a bežné balenie, každý krok a rada má zdroj (písmeno), text vlastnými slovami. Ukážka: segedín
    z A toprecepty.cz 1495, B apetitonline.cz tradiční, C kucharkaprodceru.cz, D cooklikeczechs.com, E thepeasantsdaughter.net.
    Fotky: 3 × 1K dávkovo (Nano Banana 2.1 alebo 3.1 Flash-Lite Image, 0,0168 $/ks) + 10 % = ~0,055 $/recept
    (2 500 ≈ 140 $, 6 500 ≈ 360 $); drahší 3.1 Flash Image ~0,20 $/recept ako záloha. Pokus: 20 receptov × 3 fotky
    × 3 modely naslepo, ~8 $, bez zmeny DB a appky.
    Preverenie 45 webov (3. 11., skript na robots.txt + sitemap): pravidlo „web, ktorý zakazuje akýkoľvek AI robot
    v robots.txt, nepoužijeme“. Povolené A (redakčné): apetitonline.cz (~13 tis.), kucharkaprodceru.cz (~190, bez JSON-LD –
    čítať text), kuchynalidla.sk (~3 tis.), tesco.sk (~900), kingarthurbaking.com, justonecookbook.com, hot-thai-kitchen.com.
    B (komunitné): toprecepty.cz (~86 tis., JSON-LD), vareni.cz (~50 tis.), labuznik.cz (~73 tis., aj články/diskusie),
    fitrecepty.sk, coop.sk, ichkoche.at (~131 tis.), gutekueche.at (~54 tis.), nosalty.hu (~80 tis.), marmiton.org (~31 tis.).
    Vyradené (AI zákaz): zena.sme.sk, prozeny.cz, receptyonline.cz, rohlik.cz (CCBot), chefkoch.de, essen-und-trinken.de,
    lecker.de, giallozafferano.it, allrecipes, bbcgoodfood (GPTBot, CCBot), bonappetit, epicurious, seriouseats,
    recipetineats, thewoksoflife, maangchi, simplyrecipes, mexicoinmykitchen; Varecha podľa podmienok. recepty.sk
    a dobruchut.aktuality.sk nemajú sitemap. Chýba redakčný taliansky a ázijský zdroj – doplniť.
    Technika (pre pokus): zoznam receptov zo sitemap → schema.org Recipe (JSON-LD: recipeIngredient, recipeYield,
    recipeInstructions) → gramy na porciu → spojenie (Claude) → kontrola → fotky; DuckDuckGo z kontajnera nejde (202),
    USDA API ide (DEMO_KEY s limitom). Úložisko receptov a fotiek sa rozhodne po pokuse (návrh: DB `book_recipes`,
    fotky Cloudflare R2).
    **Plán v4 (3. 11., rovnaký odkaz):** majiteľ chce overovať aj podľa Varechy, Chefkochu, Allrecipes atď. a chce
    realistické fotky, pri ktorých sú všetky 3 fotky receptu to isté jedlo. Varecha má AI Content Policy (od 25. 5. 2026,
    varecha.pravda.sk/info/ai-content-policy/): bez licencie zakazuje „validáciu, evaluáciu“ a „vytvorenie konkurenčného
    … aplikácie alebo databázy“, výhrada TDM podľa čl. 4 ods. 3 smernice 2019/790, meta `noai` a `tdm-reservation: 1`;
    robots.txt blokuje ClaudeBot (povoľuje Claude-SearchBot len na odpovede s odkazom); licenciu ponúka (varecha@ourmedia.sk,
    info@varecha.sk). Rozhodnutie: weby, ktoré blokujú Claude alebo AI použitie zakazujú, program nečíta (skupina C).
    Majiteľ ich porovná ručne cez odkazy „Porovnaj na…“ v galérii várky a môže požiadať Varechu o licenciu (e-mail pripravený
    v čete). Späť povolené (blokujú len GPTBot/CCBot, nie Claude): BBC Good Food, rohlik.cz, lecker.de, mexicoinmykitchen.com,
    pred použitím prečítať podmienky. Na povolených weboch (vzorka 22) nie sú hlavičky `tdm-reservation` ani `noai`.
    Fotky: jedno fotenie = hlavná fotka, potom 2 zábery s hlavnou ako predlohou (rovnaký tanier a jedlo), kontrola Claudom
    (navzájom, voči receptu, voči fotkám skutočného jedla zo zdrojov – len porovnanie). Ukážka segedínu: Nano Banana 2.1
    (`gemini-nano-banana-2.1`), 1K, 928×1152, ~13 s na fotku, 6 fotiek ~0,20 $; prvá hlavná mala bledú omáčku → prerobená.
    Dostupné obrázkové modely na kľúči testovacieho projektu: gemini-nano-banana-2.1, gemini-3.1-flash-lite-image,
    gemini-3.1-flash-image, gemini-3-pro-image (+ preview). Funkcia `proto-images` bola na ukážku dočasne nasadená
    (v3, token len v scratchpade) a hneď znova vypnutá (v4, 410, verify_jwt).
    **5 receptov z knihy v testovacej appke – HOTOVÉ 3. 11. (na pokyn majiteľa „sprav 5 receptov a vlož ich do testovacej
    appky“, bez licencií a bez ďalších návrhov):** segedín, kurací paprikáš s haluškami, kulajda s vajcom, medovník
    s karamelovým krémom, lasagne bolognese. Každý spojený zo 4–5 skutočných receptov z rôznych povolených webov
    (paprikáš 5 + halušky 4), suroviny s písmenami zdrojov (`src`), kroky so zdrojmi, text vlastnými slovami.
    Súbory: `src/features/recipes/kniha.ts` (recepty, zdroje, `recipeAllergens`, `bookPics`), `book.tsx` (galéria,
    suroviny v skupinách, kroky s ohňom a „Hotové je, keď / Pozor / Tip“, alergény, náradie, skladovanie, zdroje –
    z mockupu book.jsx), `kniha.css` (triedy `pic-kb_<id>_<n>`), fotky `public/kniha/<id>-<1|2|3>.webp` (1080×1341)
    + `-1s.webp` (480 px na karty), `kniha.test.ts` = kontrolný program v `npm run check` (3–5 zdrojov z rôznych webov,
    surovina vo viac ako polovici zdrojov, kroky so zdrojom, suroviny ↔ postup podľa tvarov slov `SAID`, hydina 74 °C,
    mäkký žĺtok s upozornením, časovače, alergény a výživa zo všetkých surovín, fotky existujú). `foods.ts`: hodnoty
    USDA SR Legacy (kód fdc v komentári), `al` (14 alergénov EÚ), `check` (skontroluj obal), `edible` (kurča 0,68),
    `free` (voda sa nekupuje); nové potraviny kurca, mast, vyvar, voda, smotana_sladka, tuk, med, kondenz, soda, orechy,
    lasagne, zeler_stopkovy, muskat. `catalog.ts`: CATALOG = BOOK + staršie (staré segedín, paprikáš, kulajda zmazané,
    aj STEP_DETAILS.segedin). Ochutnávač dáva recepty z knihy dopredu, kategória Mäso už neberie cestoviny.
    Fotky: hlavná fotka zo zadania podľa receptu (štýl: svetlý dub, svetlo zľava, biela keramika, šalviová utierka,
    nič mimo receptu), potom 2 zábery s hlavnou fotkou ako predlohou (zhora – „flat lay 90°“, zblízka), model
    `gemini-nano-banana-2.1`, 2K, cez dočasnú `proto-images` (znova vypnutá, v6). Kontrola každej sady pohľadom:
    paprikáš (málo omáčky, halušky ako cestoviny) a medovník (hrubé pláty bez krému) prerobené, 3 zábery zhora prerobené.
    Cena ~1 $. Overené lokálne (vite preview, testovací účet, Teplá aj Sklo tmavé): 5 receptov, galéria, postup,
    porcie, varenie, Ochutnávač – bez chýb JS/servera a bez pretekania. Recepty sú zatiaľ len po slovensky (aj v EN
    rozhraní) a sú v kóde appky, nie v DB; „Navrhni recept“ a „Nahlásiť chybu“ ešte nie sú.
    **Fotky do strán a Ochutnávač 2.0 – HOTOVÉ 3. 11. (pokyn majiteľa: listovanie fotiek s počtom, Ochutnávač
    „návykový, kvalitný, optimalizovaný“):** `Photos.tsx` (`PhotoSwiper`): natívne posúvanie so zarážkami, ťuk na ľavú/
    pravú tretinu, šípky na počítači (len zariadenia s myšou), klávesy ← →, počítadlo „1/3“, bodky, `<img>` s async
    dekódovaním a lenivým načítaním, malý náhľad pod prvou fotkou; detail receptu z knihy má väčšiu fotku (4:5).
    V Ochutnávači: pásiky ako príbeh, fotky sa samy posúvajú každých 3,2 s (kým sa ich nedotkneš), pomalé priblíženie
    (vypnuté pri „obmedziť pohyb“). `TastePage.tsx` prepísaný: nekonečný feed v kolách (`taste.ts` + test – kniha
    prvá, nevidené a „mám doma“ vyššie, pestré kategórie, „Nie“ dozadu, nikdy rovnaký recept za sebou), prestávka
    so súhrnom po 12 receptoch („Listovať ďalej“ / Hotovo), návrat z receptu na to isté miesto (`bh.tasteSession`
    v sessionStorage, 30 min), aktuálna karta cez IntersectionObserver, obsah len pre karty ±3, fotky ±1,
    prednačítanie ďalších 3, karty `memo`, dvojťuk = Chcem so srdcom na mieste ťuknutia a vibráciou, návod pri prvom
    spustení (`bh.tasteHint`), klávesy ↓ ↑ medzerník L Esc. „Chcem“ je optimistické (`useToggleLike` onMutate).
    Opravené aj ikony v štítkoch (čas/oheň) – v mockup CSS dostávali pozadie a odsadenie štítku (`kniha.css`).
    Overené Playwrightom lokálne: ťuk/kláves menia 1/3 → 2/3 → 3/3, samé posúvanie, dvojťuk, návrat, prestávka na 12,
    pri 4× spomalenom procesore 57 snímok/s, 2 dlhé snímky z ~300, v DOM ~280 uzlov po 9 receptoch. Prototyp
    (`prototyp/src/book.jsx`) tieto zmeny nemá – Ochutnávač sa teraz vyvíja v appke.
    **Varenie – kroky ťukom a ťahom (3. 11., pokyn majiteľa):** `CookPage.tsx`: ťuk na ľavú tretinu = späť, inde = ďalej,
    ťah prstom (krok ide za prstom, na začiatku/konci len pruží), klávesy ← → medzerník, animácia prechodu podľa smeru,
    vibrácia, návod „Ďalší krok: ťukni vpravo…“ do prvého gesta (`bh.cookHint`). Posledný krok ťah ani ťuk neukončí
    (len tlačidlo Hotovo), ťuk na časovač krok nemení. `AppShell.tsx`: okrajové „späť“ (`EdgeBack`) je vypnuté na
    varení a v Ochutnávači (`OWN_SWIPE`), inak by ťah od ľavého okraja zavrel obrazovku. Overené dotykom (CDP).
    **Varenie a prehľad surovín – vylepšenie (4. 11., pokyn majiteľa „posunúť vizuál a ovládanie vyššie“):**
    pri každom kroku sú bubliny so surovinami a presným množstvom pre zvolený počet porcií (`stepFoods` v `kniha.ts`:
    zástupky `{…}` v texte + slová zo `SAID`, alebo pole `uses` v kroku; test v `kniha.test.ts`), pod pásikom krokov
    „Ešte asi X min“ (bežiaci časovač sa ráta skutočným časom), časovač má kruh, ktorý ubúda, a na konci kroku je
    náhľad „Ďalej: …“ (ťuk = ďalší krok). Ochutnávač: „Doma máš X z Y“ je tlačidlo s malým ukazovateľom → panel
    `HaveSheet` (`sheets.tsx`): pásik doma/kúpiť, tabuľka „Treba kúpiť“ (koľko kúpiť, cena ak ju poznáme; súčet len
    keď poznáme cenu všetkého), kartičky „Máš doma“, „Upraviť v recepte“, „Späť“ (zostane na tej istej karte)
    a „Pridať do nákupu“ (bežný panel). Overené lokálne (Teplá svetlá, Sklo tmavé), bez chýb v konzole.
    **Lišta iPhonu (hodiny, batéria) vo farbe obrazovky (4. 11., pokyn majiteľa):** na iPhone svietila nad
    obrazovkou takmer čierna lišta (#11130f = --bg), hoci vrch obrazovky je v Teplej šalviový (--tint). iOS 26
    neberie farbu z `theme-color` meta za behu ani z `body::before`, ale z pevného prvku navrchu stránky, inak
    z pozadia body/html. Riešenie `src/theme/statusBar.ts`: skutočný prvok `#sbar` (index.html) + farba pozadia
    body (Teplá, pod prechodom nie je vidieť) / html (Sklo) + theme-color – všetko `--sbar`. Farby: Teplá =
    --tint, Sklo = --bg (fotka v pozadí do nej prechádza, `.bhm-bg::after`); Ochutnávač, varenie a bloček
    v Skle = čierna (`useStatusBarPhoto`, obraz do nej prechádza). Detail receptu: vrch fotky prechádza z farby
    lišty; vo svetlom Skle tam nie sú biele tlačidlá (`wg`), boli by nečitateľné. Hlavička po posunutí má sklo
    vo farbe lišty, celoobrazovkové okná v Teplej majú hore nádych. Pri každej zmene sa `#sbar` vymení za nový
    prvok (iOS farbu odčíta, keď sa prvok objaví). Overené simuláciou iPhonu 13 mini (výrez 50 px) v oboch
    režimoch (lišta nad stránkou aj stránka pod lištou), 4 vzhľady × 15 obrazoviek; na skutočnom iPhone overí
    majiteľ (appku treba úplne zavrieť a znova otvoriť). Oprava po snímke majiteľa: `#sbar` mal na iPhone
    minimálne 6 px – na iPhone majiteľa je stránka pod lištou (výrez 0), pás prekryl vrch stránky a odsekol
    tlačidlá hlavičky na všetkých obrazovkách. Výška je teraz len výrez displeja; farbu vtedy dáva pozadie body/html.
    **Finálny vzhľad (11. 11., pokyn majiteľa „aby to nevyzeralo ako demo, ale ako appka na predaj“; vetva
    `claude/jolly-lamport-pu5abj`):** farby tém ostali, pribudla nová vrstva `prototyp/css/finish.css` (posledná v
    `do-appky.py` aj `build.py` → appka aj ukážka). Povrchy: vrstvený mäkký tieň (`--sh`, `--sh-hi` pre súhrny),
    svetlá hrana zhora; Sklo s diagonálnym odleskom a svetlom aj na spodnej hrane. Tlačidlá: hlavné s prechodom,
    odleskom a farebným tieňom (`--f-pri`), tónové s hranou, pružné stlačenie. Ikonové dlaždice ako farebné kamienky,
    3D emoji s tieňom, dlaždica obchodu s leskom. Teplá: teplé svetlo v rohoch pozadia (`--f-glow-*`, v appke na body
    v `adapt.css`, pás pod lištou iPhonu ostáva čistý nádych). Lišta: aktívna záložka s podkladom, mikrofón plnou farbou.
    Pohyb: obsah obrazovky nastúpi postupne (`f-rise`, len karty/bloky, `:where` = existujúce zvýraznenia majú
    prednosť, oneskorenie v premennej), riadky zoznamov, dlaždice Rýchlo a kategórie s pružinou, prepínač `.seg` má
    posuvného jazdca (`:has`), prázdne stavy s vznášajúcim sa emoji; pri „obmedziť pohyb“ nič z toho. Načítavanie =
    tri bodky vo farbe témy, ukážu sa až po 250 ms (`Spinner`, `.bh-load`). Texty: dlhé názvy na dva riadky (riadky,
    karty zoznamov, Domov, chýbajúce bločky), bodka „·“ sa drží predchádzajúceho úseku, Výdavky → chýbajúce bločky majú
    ikonu fotoaparátu namiesto širokého „Odfotiť“ (`mn.photoAria`), História má stav bločku pod názvom, štatistiky
    výrobku/druhu v troch rovnakých stĺpcoch s „/ kg“ pod sumou (`PerUnit`). Oprava prevodu: fotky jedál v dlaždiciach
    (`.th.pic-…` – Plán týždňa, Ochutnávač, panely) prekrýval podklad `.bhm .th` → triedy fotiek majú aj `.bhm .pic-…`
    (`do-appky.py`, `kniha.css`). Overené: `npm run check`, preklikanie 4 vzhľady × 32 obrazoviek, testy ukážky
    (sprievodca, nápovedy, pridávanie), test toku nákupu, meranie animácií v prehliadači, preklikanie 4 × 9 obrazoviek
    na nasadenom náhľade https://claude-jolly-lamport-pu5abj-basket-harmony-v2.markoblaha.workers.dev (testovacia DB).
    Do `design/v2-mobile-redesign` zatiaľ nezlúčené – čaká na „OK“ majiteľa. Na skutočnom iPhone overí majiteľ.
    **Pridávanie – pravopis a naklikanie kusov (11. 11., pokyn majiteľa):** Enter (aj tučný prvý riadok návrhov) pridá
    presne napísaný text s počtom, opraví sa len pravopis (`spellFix` v `itemCatalog.ts` + testy: diakritika podľa
    názvov produktov, veľké písmeno, vlastné mená, preklep len pri jednom slove – „mleko 3“ → Mlieko 3 ks, „plzen 6“ →
    Plzeň 6 ks, nie Pilsner Urquell; cena sa aj tak ráta zo značky). Samostatná bublina „preklep?“ zmizla – oprava je
    rovno v prvom riadku („opravený preklep „mleko““). V každej bubline návrhu sa dajú naklikať kusy: ťuk = +1 (prvý ťuk
    = napísané množstvo alebo 1 ks), − / +, pásik dole ukazuje čas – po 1,8 s bez ťuknutia sa položka pridá (bublina
    zozelenie, „✓ Pridané“, ikona odletí), pri ďalšom písaní alebo odchode sa naklikané pridá hneď. Kód `Composer`
    (`pickRow`) v `ListParts.tsx`, štýly `src/features/lists/pick.css`. Overené v prehliadači (Teplá svetlá/tmavá,
    Sklo svetlé); do testovacieho zoznamu „Tok nákupu 11-03 15:01“ pribudli skúšobné položky (Svetlé pivo 12°, Plzeň,
    Banány, Mlieko +3).
    **Okno pridávania (11. 11., pokyn majiteľa „aby nič neskákalo a klávesnica nepreskakovala“):** ťuk do poľa zoznamu
    zmení pole na okno cez celú viditeľnú plochu nad klávesnicou (výška z `visualViewport`, stránka pod ním sa neposúva,
    to isté pole = klávesnica sa nezavrie). Hlavička „Pridávaš do zoznamu · názov“ + Hotovo (s počtom pridaných), v strede
    návrhy, „Pridané teraz“ (čo pribudlo v tomto okne), názorná ukážka (prst 3× ťukne, krúžok odpočíta, „pridané · 3 ks“ –
    kým nič nepribudlo) a Často kupuješ ako rovnaké bubliny, dole pole. Bublina: ťuk = +1, krúžok okolo čísla odpočíta
    1,8 s, potom zelené ✓ a položka je v „Pridané teraz“; − uberie. „Hotovo“ na klávesnici pri prázdnom poli okno zavrie.
    Overené Playwrightom (pole na rovnakom mieste vo všetkých stavoch, fokus ostáva), test toku nákupu prešiel.
    Oprava po skúške na iPhone (11. 11.): ťuk na bublinu zobral poľu fokus (iPhone berie fokus pri mousedown, nielen
    pointerdown) → klávesnica zmizla, okno sa zavrelo a naklikané sa pridalo hneď. Teraz sa bráni aj mousedown, okno
    kým bublina odpočítava ostáva otvorené aj bez klávesnice. Po pridaní okno aj klávesnica ostávajú otvorené na mieste,
    pole sa vyprázdni (druhý pokyn majiteľa 11. 11.); zavrie sa len cez Hotovo.
    Tretí pokyn (11. 11.): `spellFix` už slová NEVYMIEŇA za podobné (preklepy sa neopravujú – „mleko“ ostane Mleko,
    na výber iného produktu sú bubliny), len diakritika podľa názvov produktov a veľké písmeno. Enter berie text priamo
    z poľa (Gboard mal posledné písmeno ešte rozpísané → „masl“ → oprava preklepu → „Mäso“). Pole sa vymaže hneď pri
    pridaní z bubliny.
    Štvrtý pokyn (11. 11., „z okna sa nedá vyjsť“): chyba – po pridaní z bubliny sa zrušil časovač dokončenia, bublina
    ostala „rozklikaná“ a okno sa nedalo zavrieť ani skrytím klávesnice. Opravené; keď klávesnica zmizne počas
    odpočítavania, okno sa po pridaní zavrie (iPhone klávesnicu bez ťuknutia znova neotvorí). V hlavičke okna je šípka
    späť (zavrie okno → zoznam s Nakupovať a ‹ Nákupy) a Hotovo; zoznam bez písmen v názve = „Bez názvu“. Pod oknom je jeho pozadie (pri pásiku ˄ ˅ ✓ neprešvitá zoznam). Pásik ˄ ˅ ✓ nad klávesnicou
    web skryť nevie (rozhodnutie z minulosti platí – len natívna appka).
    **6 receptov metódou „kotva“ – HOTOVÉ 15. 11. (pokyn majiteľa: 6 komplikovaných receptov, hlavná fotka + 3 detaily,
    každý recept iná scéna, extra fotorealistické):** sviečková na smotane, kapustnica, plnená paprika, španielsky vtáčik,
    grécka musaka, chili con carne (tikka masala vynechaná – na povolených weboch málo klasických receptov). Majiteľ
    odmietol pôvodnú metódu (stredná hodnota každej suroviny zvlášť dáva pomery, ktoré nikto neuvaril). Nová metóda
    (`src/features/recipes/kniha-overene.ts`, typ `BookCheck` v `types.ts`, výpočet `bookCheck`/`basePortions` v `kniha.ts`):
    11–16 skutočných receptov z 4–7 povolených webov (JSON-LD, skripty v scratchpade `r6/grab.py`), základná porcia =
    najčastejšia v zdrojoch (pri zhode bližšia k mediánu), kotva = skutočný dobre hodnotený recept s najviac surovinami
    väčšiny, jeho pomery ostávajú; zmena len keď chýba surovina väčšiny, surovinu má < 30 % zdrojov alebo je množstvo mimo
    bežného rozpätia (20.–80. percentil na porciu) – každá zmena je zapísaná (`changes`). Úkony postupu (`acts`): úkon väčšiny
    musí byť v postupe, každý úkon v postupe robí kotva alebo ≥ 30 % zdrojov, menšinové sú rady. Zhoda = priemer (suroviny
    väčšiny, množstvá v bežnom rozpätí, úkony väčšiny) ≥ 90 %; výsledok 97–100 %. Kroky sú rozpísané pre začiatočníka
    (2–4 vety, oheň, čas, „Hotové je, keď“, „Pozor“, rady zo zdrojov), suroviny pri kroku presne (`USES`, test).
    V detaile receptu nová sekcia „Ako sme recept overili“ (zhoda, základný recept, tabuľka u nás / bežne / koľko zdrojov,
    zmeny oproti základu). Nové potraviny s hodnotami USDA SR Legacy (lokálna kópia dát v scratchpade `usda/`), staršie
    potraviny doplnené o alergény (`horcica`, `zeler`, `eidam`…). Fotky: `gemini-3-pro-image` 2K, hlavná fotka zo zadania
    podľa receptu, 3 ďalšie s hlavnou ako predlohou (iný uhol, ten istý tanier), 3 zábery prerobené (boli takmer rovnaké
    ako hlavná); 4 × 6 fotiek WebP 1080×1341 + náhľad 480 px v `public/kniha/`, cena asi 3–5 $. Funkcia `proto-images`
    bola na várku dočasne zapnutá (v7, heslo len v scratchpade) a hneď znova vypnutá (v8, 410). Dlhé kroky majú pri varení
    menšie písmo (`.stx.lg/.xl`). Overené lokálne (Teplá svetlá, Sklo tmavé): 4 fotky, tabuľka, varenie, Ochutnávač, bez chýb.
    **Fotky prerobené realistickejšie (16. 11., majiteľ: fotky „vidno, že sú umelé“):** rovnaký model `gemini-3-pro-image`,
    ale 4K, nový štýl (skutočná fotka do kuchárky, denné svetlo z okna, tlmené prirodzené farby, drobné nedokonalosti,
    žiadne svetielka a „sklený“ lesk – `scratchpad/foto/style7.txt`), 2 varianty hlavnej fotky na výber, detaily s hlavnou
    ako predlohou, potom zmenšenie zo 4K + jemné zrno a vinetácia (`scratchpad/foto/proc.py`). Hotové sady: sviečková
    (slanina už v mäse, nie navrchu), kapustnica (detail = výrez zo 4K), plnená paprika, vtáčik. **Kredit Gemini na Google
    účte došiel (chyba 402) – musaka a chili majú zatiaľ pôvodné fotky z 15. 11.**; po dobití kreditu (Google AI Studio →
    projekt → Billing) treba dorobiť ich detaily (zadania v `scratchpad/foto/details7.json`, hlavné fotky už sú
    `r7/musaka-1b.jpg`, `r7/chili-1a.jpg`). Pozor: rovnaký kľúč používajú aj AI funkcie appky (čítanie bločkov, hlas,
    recepty) – kým nie je kredit, v testovacej appke nepôjdu. `proto-images` znova vypnutá (v10).
    **Kniha len z overených receptov (16. 11., pokyn majiteľa: odstrániť ukážkové recepty a recepty bez fotiek, ostatné
    prerobiť novou metódou):** 18 ukážkových receptov z prvej verzie (bez fotiek, `catalog.ts`) je preč, kniha má 11 receptov
    a všetky sú overené metódou „kotva“. Starších 5 (segedín, paprikáš s haluškami, kulajda, medovník, lasagne) je
    prerobených: segedín 17 zdrojov (kotva apetitonline „Tradiční segedínský guláš“), paprikáš 14 + halušky 10 zdrojov
    (kotvy vareni „Klasické kuře na paprice“ a nosalty „Nokedli egyszerűen“), kulajda 20 (apetitonline „Kulajda s vejcem“),
    medovník 13 medovníkov s karamelovým krémom (apetitonline „Medovník“), lasagne 14 (toprecepty „Výborné lasagne“; základná
    porcia je teraz 4, nie 6). Zhoda 96–100 %. Metóda vie dve nové veci: **skupina s vlastnými zdrojmi** (`check.groups` –
    halušky sa porovnávajú len s receptami na halušky/nokedli/Spätzle, v tabuľke majú vlastný nadpis) a **porovnanie na celý
    kus** (`check.whole` – torta: každý zdroj je jedna torta, porcie sú kúsky na krájanie). Riadok so skupinou bez vlastných
    zdrojov (medovník „Krém“) oddelí maslo do krému od masla do cesta. Starý spôsob „spájania 3–5 zdrojov“ (`BOOK_MERGED`
    a jeho testy) je zrušený. Kategórie a rýchly výber bez receptu sa nezobrazujú, dlaždice kategórií a Ochutnávača majú
    fotky z knihy namiesto ukážkových jedál. „¼ lyžičky“ sa píše zlomkom. **Fotky týchto 5 receptov sú zatiaľ staré
    (3 zábery z 3. 11.)** – nové realistické (hlavná + 3 detaily) čakajú na dobitie kreditu Gemini (16. 11. stále chyba 402;
    `proto-images` krátko zapnutá v11 a hneď vypnutá v12). Test fotiek dočasne žiada aspoň 3 zábery; po nových fotkách vrátiť
    na 4 (`kniha.test.ts`) a v `kniha-overene.ts` zmazať `photos: 3`. Pozor pri kulajde: stará fotka má vajce v polievke,
    nový recept dáva polovičky vareného vajca. V DB (`recipe_plans`) ostali plány s kľúčmi zmazaných receptov
    (palacinky, bryndzove, cesnakova, rezen, sosovica, vepro) – appka ich neukazuje a nepadá (overené); zmazanie riadkov len
    so súhlasom majiteľa.
    **Ochutnávač – ťuk vľavo/vpravo (16. 11.):** ťuk na ľavú tretinu fotky = predchádzajúca fotka, na pravú = ďalšia
    (`PhotoSwiper` aj vo feede), dvojťuk „Chcem“ len v strednej časti (rýchle ťukanie na kraj nedá „Chcem“); návod
    v Ochutnávači upravený. Overené dotykom v prehliadači.
    **Čistý začiatok a skúšobná šarža 1 (17. 11. 2026, pokyn majiteľa):** v testovacej DB zmazané (so súhlasom) všetky
    recepty domácností (7), plány varenia (24) a obľúbené/„páči sa mi“ (boli 0). Z kódu preč 11 starých receptov knihy
    a ich 50 fotiek (commit 2924695). Potom **šarža 1 = 10 receptov** (kniha-overene.ts, commit a9f40db), každý je JEDEN
    skutočný recept prevzatý presne a preložený, namiesto fotky obrázok „Testovacia šarža 1 · v1 · 17. 11. 2026“
    (`book.batch`, `public/kniha/<id>-1.webp`, robí ho `tools/kniha/obrazky-sarze.cjs`). Výber robí nástroj **`tools/kniha/`**
    (Python; pracovné dáta mimo gitu v `tools/kniha/data` alebo `KNIHA_DATA`): `loose.py` adresy z mapy stránok
    3 hlavných webov + Labužník/Receptár/Aktuality → `fetch.py` stiahne JSON-LD → `parse.py` prevedie riadok suroviny
    na potravinu a gramy (rovnaké prevody ako appka) → `rules.py` variant jedla (čo musí/nesmie mať, úkony) →
    `analyze.py` porovná s 20 najhodnotenejšími receptmi variantu a vyberie víťaza (najviac hodnotení, prešiel kontrolou:
    všetky suroviny čitateľné a s množstvom okrem korenín/„podľa chuti“, porcie uvedené, max 1 chýbajúca surovina väčšiny,
    max 1 množstvo mimo 20.–80. percentilu, väčšina úkonov; koreniny pod 1 g na porciu sa porovnávajú len hrubo, pečenie
    na 100 g múky/krémového syra) → `export.py` zapíše `src/features/recipes/kniha-porovnanie.ts`. Appka (bookCheck) počíta
    to isté a ukazuje verdikt; test žiada `ok`.
    Víťazi šarže 1 (hodnotenia): cesnaková polievka Apetit (380), hovädzí guláš Vaření R. Novák (325), segedín Toprecepty
    „Můj segedínský guláš“ (53), kurací paprikáš Toprecepty „Kuře na paprice se smetanou“ (89), bryndzové halušky Apetit
    (204), carbonara Apetit (706), vianočný zemiakový šalát Vaření (846), palacinky Vaření (3 854), bábovka Apetit (1 133),
    New York cheesecake Apetit (426). Kategórie: polievky 1, mäso 3, hydina 1, cestoviny 1, šaláty 1, sladké 3.
    **Neprešli / odložené:** kapustnica – víťaz mal len 10 hodnotení (aktuality.sk), lepšie recepty mali 2 odchýlky; rezeň –
    len 11 čistých klasických receptov a víťaz s 15 hodnoteniami (treba širší zber, aj SK weby); pri prvom behu aj
    cesnaková (pred porovnaním tekutín spolu). Receptár.sk nemá JSON-LD (treba vlastné čítanie stránky).
    Zmeny v appke: pravidlá kontroly (max 1/max 1/väčšina úkonov, `check.base`, `res.ok`), jednotky `podla_chuti`,
    `podla_potreby`, `hrncek`, `bal`, `hrst` (10 g bylinky / 30 g ostatné), `Ingredient.alt` (náhrada v postupe „masť alebo
    olej“), režimy porcií `book.scale` (free ½–2×, piece, whole = celé násobky) s poznámkou pod porciami, vajcia sa pri
    prepočte zaokrúhlia na celé, hodnotenie zdroja (`sources.rating/votes`) v „Ako sme recept overili“, 21 nových potravín
    s USDA hodnotami a alergénmi. Dlaždice kategórií berú obrázok z prvého receptu kategórie, šaláty sú v „Bez mäsa
    a šaláty“. Testy logiky majú vlastné skúšobné recepty (nezávislé od knihy). Overené na testovacej adrese (prihlásený,
    telefón): kategórie, detail receptu, tabuľka porovnania, žiadne chyby v konzole.
    **Šarža 2 (17. 11. 2026, majiteľ: „Pokračuj“) – v knihe je 20 receptov (míľnik 20).** Kniha je rozdelená: `kniha-pomocne.ts`
    (spoločné funkcie, pôvod tipov `from()`/`fromAct()` z dát porovnania – písmená sa nikdy nepíšu ručne), `kniha-sarza1.ts`,
    `kniha-sarza2.ts`, `kniha-overene.ts` ich spája. Šarža 2: sviečková Toprecepty (58), juhočeská kulajda Toprecepty (133),
    slovenská kapustnica s klobásou Vaření (87), plnené papriky Vaření (27), babkina sekaná Apetit (651), vyprážaný syr
    Toprecepty (62), zemiakové placky Vaření (46 867), marhuľové knedle Vaření (188), jablková štrúdľa Apetit (220),
    lievance Vaření (1 037). Obrázky „Testovacia šarža 2“ (`node tools/kniha/obrazky-sarze.cjs <priečinok> 2`).
    **Zmeny metódy (platia pre všetky šarže):** (1) „mimo bežného“ = **Tukeyho hranice na log škále** (kvartily ± 1,5 ×
    medzikvartilové rozpätie), nie 20.–80. percentil – pásmo z definície označilo 40 % zdrojov a vyraďovalo najlepšie recepty
    (napr. bramboráky so 46 867 hodnoteniami); pásmo ostáva v tabuľke ako „bežne“, do pravidla „najviac 1“ sa ráta len
    „neobvyklé“. (2) Víťaz musí mať **aspoň ★4,0 a 10 hodnotení**. (3) Bez množstva smú byť koreniny, voda/vývar na
    podlievanie, trojobal a tuk na vyprážanie, zriedkavé prílohy/ozdoba. (4) Receptár.sk sa číta z mikrodát, jeho hodnotenia
    sa ignorujú (nesedia) – je len na porovnanie. (5) Pečenie a knedle sa porovnávajú na 100 g základnej suroviny.
    Dôsledok pre šaržu 1: paprikáš je teraz Toprecepty „Kuře na paprice (i pro začátečníky)“ (561) a segedín Apetit
    „Tradiční segedínský guláš“ (248) – oba nanovo preložené. Nové: jednotka `platok`, `book.portionsGuess` (zdroj porcie
    neuvádza – appka to pri porciách napíše), ~15 nových potravín s USDA hodnotami.
    **Odložené:** gulášová polievka (má víťaza Apetit „Pikantní gulášová polévka s chilli“, 259 – do šarže 3), rezeň
    (len 12 klasických receptov, víťaz s 15 hodnoteniami – treba širší zber), cesnaková polievka je v šarži 1.
    **Kniha v databáze, nie v kóde (17. 11. 2026, rozhodnutie majiteľa):** recepty už nie sú v kóde. Migrácia
    `20261117000043_recipe_book.sql` (nasadená do TESTOVACEJ DB, do ostrej až pri zlúčení do `main`): `book_dishes`, `book_recipes`
    (stav draft/quarantine/approved/published, verzia, šarža, `check_data` = porovnanie, `verification` = výsledok kontrol, `image_path`),
    `book_sources`, `book_runs` (záznam každého behu – tu vidno, kde pokračovať). Appka číta len approved/published cez RLS
    (`useBookRecipes` v api.ts), obrázky sa pridávajú za behu (`injectBookPics`). Zapisuje len linka: `tools/kniha/nahraj.py`
    (SUPABASE_URL + SUPABASE_SERVICE_KEY z prostredia, nikdy nie do gitu). Vzorka 20 receptov pre testy: `__fixtures__/kniha.json`.
    **Linka bez ručného písania receptov:** `light.py` (výber víťaza z 3 webov) → Haiku „low“ pomocníci prekladajú (`in/` → `out/`)
    → `overit.py` (čísla, počet surovín a krokov) → `previest.py` (kľúče potravín, zdroje, stav) → `nahraj.py`. Neprešli = karanténa.
    Prvá dávka z predplatného (šarža 3): 9 receptov, 8 prešlo, hrachová polievka v karanténe (pomocník zdvojil maslo, vynechal cibuľu).
    Pozor: tajný kľúč testovacej DB bol vložený do chatu – po dokončení ho v Supabase obnoviť (rotovať).
    **Fotky:** až po naplnení knihy, dávkovo cez Gemini (kredit musí byť dobitý); dovtedy obrázok šarže (`image_status = batch_label`).
    **Zostáva:** dopĺňať potraviny (nové suroviny dostávajú kľúč `x_…` bez výživy), údaje 20 receptov šarží 1–2 sú plné (porovnanie),
    nové z linky „light“ (bez tabuľky porovnania), kategórie a Ochutnávač čítajú z DB.
    **Kniha naprázdno (19. 11. 2026, pokyn a súhlas majiteľa):** v TESTOVACEJ DB zmazané všetky recepty knihy (29 jedál,
    29 receptov, 497 zdrojov, 3 behy linky) a 1 plán varenia; recepty domácností, obľúbené a „páči sa mi“ boli už prázdne.
    Zmazal majiteľ sám v SQL Editore – potvrdenie mazania z konektora Supabase sa v jeho appke nezobrazuje (4 pokusy
    skončili po 60 s bez odpovede), preto mazanie v DB vždy rovno cez SQL Editor majiteľa. Z kódu preč 58 obrázkov šarží
    (`public/kniha`; zlúčené do testovacej vetvy 20. 11.). Ostala len testovacia vzorka
    `__fixtures__/kniha.json` (appka ju neukazuje) a vymyslené recepty v ukážke. Overené preklikaním testovacej adresy
    (Domov, Recepty, Ochutnávač, recept, varenie × 4 vzhľady): 0 chýb; pri prázdnej knihe ostávajú prázdne nadpisy
    „Kategórie“ a „Rýchly výber“ (zmiznú po naplnení). Ďalej: oprava načítania knihy a nová linka, potom prvá dávka.
    **Návrh systému knihy (19. 11. 2026, čaká na 7 rozhodnutí majiteľa):** dokument „Kniha receptov – návrh systému“
    https://claude.ai/artifact/3SiahzC5pTB7pMZVWcXz5q (Claude Docs). Jadro: rodina → jedlo (karta, jeden chod) → spôsob
    prípravy (max 6, kľúč `jedlo__spôsob`); test jedlo/spôsob (iný chod / iná hlavná surovina / vlastné meno = iné jedlo,
    zmena chuti či techniky = spôsob, prívlastok = nič); prílohy a základy sú samostatné jedlá s väzbou „podáva sa s“;
    „kuracie“ je filter. Linka v 9 krokoch, AI len preklad; skóre dôvery (hlasy × hviezdy + 20 × 4,3) / (hlasy + 20).
    Mapa knihy = zoznam jedál s cieľmi po 15 chodoch (spolu 3 000) + skóre „oplatí sa“ (weby, hlasy, dopyt v appke, medzera,
    sezóna). Prehľad knihy pre správcu vo Viac. Nové: `book_terms`, `book_signals`, preklady/trhy až s DE/AT. Fázy 1–6 s bránami.
    **Šarža 4 (20. 11. 2026, pokyn majiteľa „po 3 komplikované recepty zo všetkých stránok z dokumentu“):** v TESTOVACEJ DB
    18 receptov (batch 4, published, bez fotiek – appka ukáže emoji): Vaření – sviečková po našom, pečená kačica, španielsky
    vtáčik po česky; Apetit – vianočka, medovník, karamelové veterníky; Toprecepty – grécka musaka, segedínsky guláš, lasagne;
    Recepty.cz – hovädzí guláš v tlakovom hrnci, kulajda, moravský vrabec; Kuchyňa Lidla – laskonky, vianočná kapustnica,
    konfitovaná kačica; Víkendové pečení – makové tortičky s mangom, tekvicové rezy, cheesecake s ovocnou penou.
    **Verzia 2 (20. 11., pokyn majiteľa „musíš to okopírovať a všetko musí byť ako v reálnom recepte“):** prvá verzia
    (preklad do SK, bez značiek a výziev, doplnené maslo) zamietnutá. Teraz je každý recept presne v jazyku a znení zdroja:
    15 česky (`lang = 'cs'`, aj názov „Svíčková na smetaně po našem“), 3 slovensky z Lidla (aj so značkami Alesto, Belbake…).
    Suroviny = riadky zdroja (`orig`; appka ukáže riadok presne a pri inom počte porcií prepočíta len číslo na začiatku –
    `scaleOrig`), kroky = text zdroja; nadpisy častí (Krém, Korpus…) sú v `steps[].group` a appka ich ukáže nad krokom.
    Ponechané ako v zdroji: tipy, chyby a rady autorov, výzvy a odkazy Víkendového pečenia („napište mi do komentáře“, Tescoma),
    sviečková bez masla v zozname (zdroj ho má len v postupe – poznámka vo `verification.notes`). Náradie a čas čakania len
    pri Lidli (zdroj ich uvádza), inde prázdne. Kontrola `tools/kniha/sarza4/orig18.py`: pri všetkých 18 riadky surovín =
    zdroj a text krokov = text zdroja; zápis do DB overený odtlačkom (md5) každého receptu – 18/18 zhodných. Zdroj je jeden
    riadok v `book_sources` (A, kotva), detaily vo `verification`. Migrácia `20261120000044_book_recipe_lang` je v TESTOVACEJ
    DB. Nové zobrazenie (orig, nadpisy častí) je od 20. 11. aj v testovacej vetve `design/v2-mobile-redesign` (zlúčené
    z `claude/bold-fermat-3easmm`). Oprava: suroviny
    mimo databázy potravín (`x_…`, napr. mangové pyré, tymián) ukazovali „netreba kupovať“ – recept teraz hľadá riadok nákupu
    rovnakým kľúčom ako nákup (`rowKey` v `logic.ts`).
    **Verzia 3 (20. 11., pokyn „tipy a rady v postupe tam, kam patria, nie na koniec“):** v 9 receptoch presunuté rady
    k svojmu kroku (`tools/kniha/sarza4/rady18.py`, rozmiestnenie je v `SPEC`): guláš (pripálenie papriky → krok 1, opečenie
    mäsa → 2, rozvarenie + majoránka, zápražka, odležanie → 3), kulajda, moravský vrabec, sviečková, pečená kačica (sadlo),
    veterníky (domáci fondán), laskonky, cheesecake, makové dortíky. Text rád bez zmeny (SQL ich berie priamo z textu v DB),
    zahodené len nadpisy blokov a „!“; zápis overený odtlačkom 9/9. Viac rád pri kroku = nový riadok v `tip`/`warn`, appka
    (`boxLines`) ukáže každú v samostatnom políčku.
    **Jednotky (20. 11., pokyn „gramy, kilá, litre, mililitre, žiadne dkg a podobne“):** appka ukazuje len g, kg, ml, l –
    `metric()` v `logic.ts` pri zobrazení prepočíta dkg/dag → g, dl/cl → ml, hrnček/šálka → ml (250 ml), nad 1000 na kg/l;
    hrnčeky v zátvorke za množstvom v ml (musaka „(0,25 hrnku)“) vynechá; desatinná bodka zdroja → čiarka. Platí pre suroviny,
    text krokov (aj „ĎALEJ“ vo varení), Pozor/Tip a názvy pri kroku. Originál v DB ostáva nezmenený, takže to platí aj pre
    ďalšie recepty. V šarži 4: sviečková 20 dkg slaniny → 200 g, veterníky 3,5 dl vody → 350 ml, musaka bez hrnčekov.
    **Fotky (20. 11.):** „Hovězí guláš v tlakáči“ (a cez neho dlaždice Mäso a Všetky recepty) mal ukážkovú fotku z mockupu
    („Hovädzí guláš“, `gulas_p`) – `recipeArt` v `src/mockup/kit.tsx` priraďoval fotky mockupu skutočným receptom podľa
    podobného názvu. Už nie: recept má len vlastné fotky knihy (`book.photos`, zatiaľ žiadne), inak emoji. Testovacia DB
    overená: len šarža 4 (18 receptov, 18 jedál, 18 zdrojov), žiadne recepty domácností, plány, obľúbené ani „páči sa mi“.
    **Slovenčina + originálne fotky (20. 11., pokyn majiteľa):** 15 českých receptov preložených do slovenčiny v relácii
    (názov, riadky surovín `orig` a `label`, kroky, nadpisy častí, Pozor/Tip), `lang = 'sk'`; český originál je celý vo
    `verification.original` (lang, name, ingredients, steps). Kontrola: čísla v 304 riadkoch/krokoch = originál, žiadne ř/ě/ů.
    Opravené priradenie 11 surovín (x_bravcove_pliecko → pliecko, baklažán, sóda, knedľa, kondenzované mlieko, lasagne,
    med, muškát, párky, krájané paradajky). Prázdne „Náradie“/„Skladovanie“ sa neukazujú.
    Fotky: dočasné originály zo stránok zdrojov v `public/kniha/<id>-<n>.webp` (+ `-1s` náhľad), 39 fotiek, ručne vybrané
    (`tools/kniha/sarza4/fotky18.py`, výber `vyber_fotiek18.txt`) – len fotky toho istého receptu (hlavná + fotky čitateľov),
    nie náhľady iných receptov; Lidl, Toprecepty a pri Apetite stránka viac fotiek receptu nemá (1–2). Migrácia
    `20261120000045_book_recipe_images` (TESTOVACIA DB): `image_count`, `image_status = 'source'` (= predloha, neskôr Gemini
    a originály zmazať). Ochutnávač sa tým vrátil (ukazuje recepty s fotkami).
    **Fotky verzia 2 (20. 11., „fotky sú otrasné – najkrajšie, v najlepšej kvalite“):** prvé boli malé náhľady (480–674 px)
    ešte zmenšené. Teraz najkrajšie fotky jedla (aj z iných kvalitných receptov toho istého jedla) v najväčšom rozlíšení:
    Apetit originál (až 5000 px), Recepty.cz 2000 px, Toprecepty 1200–1920 px, Víkendové pečení 1000 px; uložené do 2000 px
    (WebP 88), náhľad 800 px. 51 fotiek (2–3 na recept), `public/kniha/v2/` – priečinok s verziou, lebo service worker drží
    .webp v pamäti (pri zmene fotiek nový priečinok, adresa ide z `image_path`, `book.photoBase`). Výber
    `tools/kniha/sarza4/vyber_fotiek18.txt`, zdroj každej fotky `fotky_zdroje18.json`, zber `fotky_hq18.py`.
    Recepty.cz zamietnuté a nahradené (buchty bez teploty a času, plnené knedle bez množstiev plnky). Hodnotenia
    Víkendového pečenia a Lidla majú málo hlasov (8–20, laskonky 7). Časy pri Lidli a Víkendovom pečení odhadnuté z krokov
    (`verification.time_estimated`). Mapovanie potravín: `parse.py` zle priradil 26 surovín (napr. „olej na vymastenie plechu“
    → bravčové stehno, „sušená bazalka“ → sušienky) – opravené ručne v `sql18.py`; 41 surovín bez výživy (`x_…`), appka aj tak
    ukazuje kcal (výživa „neúplná“ je až vo fáze 1). Zápis do DB cez execute_sql (INSERT nežiada potvrdenie, len DELETE).
    Verzia 2 overená: `npm run check`, preklikanie lokálneho buildu `--mode staging` (testovacia DB) – Recepty, sviečková,
    laskonky, makové tortičky + varenie, 4 vzhľady: 0 nálezov; text surovín a postupu v appke prezretý.
    `testy/preklikanie.cjs` berie recept z `RECEPT=` (predvolene svieckova).
    **Šarža 5 – 25 cheesecakov (20. 11., pokyn majiteľa):** meranie 571 cheesecakov zo 6 webov (`tools/kniha/sarza4/
    cheesecake_meranie.py`): kvalitných 115 (Apetit 90, Vaření 13, Recepty.cz 8, Lidl 4; Víkendové pečení a Lidl čakajú na
    čítačku surovín z HTML). Vybraných 25 rôznych druhov (klasický, New York, baskický, japonský, čokoládový, nepečené, Lotus,
    karamelové, ovocné, brownies, tiramisu, pistáciový, mrkvový…), `cheesecake25.py` stiahne, `parse.py` priradí potraviny
    (opravené ručne: krémový syr, sušienky, mascarpone `x_`). Preložené do slovenčiny v relácii, zapísané cez execute_sql
    s pomocnými funkciami `pg_temp.ings/sts/add` (book_dishes rodina `cheesecake`, book_recipes batch 5, book_sources),
    podkategória cheesecaky, výťažok („1 cheesecake (forma Ø 24 cm)“), skupiny surovín a krokov (Korpus, Náplň, Poleva…),
    tipy zo zdroja pri kroku, bez výziev („Dobrou chuť“, „Recept převzat z…“, odkazy na obrázky v časopise). Kontrola čísel:
    24/25 zhodných, pri jablkovom chýbajú len odkazy „(obr. 3a/3b)“. Fotky: 43 (Apetit má len 1 vlastnú fotku receptu –
    doplnené fotky iných receptov toho istého druhu, zdroj každej v `fotky_zdroje_cheesecake25.json`), `public/kniha/v2/`.
    Pri koláčoch sa kalórie ukazujú „celý recept“. Chýbajúce potraviny v databáze (mascarpone, čokoláda, želatína, ovocie…)
    = alergény „a možno ďalšie“ a bez kalórií – doplniť do `foods.ts` s USDA hodnotami.
    **Šarža 6 – 14 ďalších cheesecakov (21. 11., pokyn majiteľa „doplň zaujímavé kvalitné“):** spolu 39 v podkategórii.
    10 z Víkendového pečenia (figy, hrušky so zázvorom a bielou čokoládou, tekvicový s pyré ako „ako sa robí“, tvarohové
    mini s lekvárom, mini so slivkovou omáčkou, vanilkový s penou z bielej čokolády, s čokoládovou penou, mini s arašidovým
    maslom, mini s citrónovým krémom, nepečené mini s jahodami a rebarborou + pyré z rebarbory) a 4 z Apetitu (ricotta
    s domácou ricottou ako „ako sa robí“, amaretto so slaným karamelom, levanduľový s čučoriedkami, matcha s Lotus).
    Staré články Víkendového pečenia nemajú štruktúru „Recept na“ → text a zoznam fotiek z HTML (`cheesecake15.py` + ručné
    čítanie), preklad v relácii, vynechané úvody blogu, značky obchodov (Lidl, Tasino…), „inspirace z webu…“, odbery.
    Hrnčeky/balenia zo zdroja prepočítané na g s pôvodnou mierou v zátvorke. Fotky: 34 (Víkendové pečenie má vlastné
    fotky receptu, staršie len 800 px; Apetit 1 vlastná), výber v `fotky_cheesecake15.py`, zdroje
    `fotky_zdroje_cheesecake15.json`. Kontrola čísel a češtiny (ř/ě/ů) bez nálezu. Makový cheesecake z Víkendového pečenia
    vynechaný (zlá adresa – zatiaľ nenájdený).
    **Koláče a dezerty – celá kategória (21. 11., pokyn majiteľa „naplň celú kategóriu, postupne cez 5-hodinové limity“):**
    **Cieľ 300 receptov** (majiteľ 21. 11.: mix SK/CZ klasík, sveta a „wow“ nápadov; torty 40, cheesecaky 40, koláče a rezy
    45, kysnuté 30, zákusky 30, cukrovie 30, muffiny a sušienky 25, dezerty 40, sladké jedlá 20). Stav 21. 11.: 71 hotových,
    230 naplánovaných (priorita 1 = SK/CZ klasika, 2 = svet, 3 = sezónne a slávnostné).
    Nové podkategórie `cukrovie` (Vianočné cukrovie) a `muffiny` (Muffiny a sušienky). Plán je v
    `tools/kniha/sarza4/dezerty.py` (ZOZNAM) aj v DB: `book_dishes` status `planned`, `notes = 'sub=<podkategória>'`,
    priorita 1 = klasika. Čo zostáva: `select name_sk, notes, priority from book_dishes where category = 'sladke'
    and status = 'planned' order by priority, notes`. Postup na ďalšiu várku: `OUT=<priečinok> python3 dezerty.py hladaj
    <id…>` (kandidáti zo 6 webov zoradení podľa hodnotenia/hlasov/množstiev), vybrať, `vypis.py <priečinok> id=url …`
    (suroviny, postup, fotka z JSON-LD – fotky z okolia stránky patria iným receptom), preložiť a zapísať cez
    `pg_temp.add(id, podkategória, …)` (batch 7+; pri existujúcom pláne prepne jedlo na `done`). Id receptu = id jedla.
    Várka 1 (batch 7, 12 receptov): Sacherova, Schwarzwaldská, orechová, čokoládová, mrkvová torta, jablkový koláč,
    jablková štrúdľa, bublanina, krémeše, brownies, tvarohový koláč, mramorová bábovka.
    Várka 2 (batch 8, 13 receptov): buchty, kysnutý koláč s tvarohom a jablkami, škoricové slimáky, makovník,
    orechovník, trubičky, linecké, vanilkové rožky, medovníčky, kokosky, rumové guľky, tiramisu, čokoládová pena.
    Várka 3 (batch 9, 12 receptov, každý 2–3 fotky): čokoládové, čučoriedkové a banánové muffiny, cookies, ovsené sušienky,
    palacinky, ovocné knedle, kysnuté knedle s čučoriedkami, žemľovka, šúľance s makom, lievance, vanilkový tvarohový krém.
    Várka 4 (batch 10, 9 receptov zo sveta): tarte Tatin, clafoutis, citrónový tart, venčeky, profiteroly, crème brûlée,
    pavlova, baklava, churros (citrónový tart má zatiaľ 1 fotku – iný tart sa nenašiel). Stav: 92 hotových, 209 naplánovaných.
    Várka 5 (batch 11–12, pokyn „naplň torty a cukrovinky“): torty Dobošova, red velvet, jahodová, punčová, tres leches,
    Victoria sponge, tiramisu, oblátková; cukrovie pracny, bezé pusinky, marokánky, čokoládová saláma, plnené orechy,
    vosie hniezda, škoricové hviezdičky, išelské. Torty 13 hotových / 26 v pláne, cukrovie 13 / 17 (+ medovník a pod.
    mimo plánu). Opera, Esterházy a citrónová torta s bezé – české weby nemajú kvalitný recept, hľadať v angličtine.
    Várka 6 (batch 13): torty banánová s karamelom, maková s citrónovým krémom, orieškovo-kávová, piškótová s malinovým
    mascarpone, ovocná so želé, smotanová Lotus; banoffee (koláče). Torty 19 hotových / 20 v pláne, cukrovie 13 / 17.
    Jogurtová a tvarohová želatínová torta – zdroje majú len hrnčeky/kelímky, hľadať iný recept.
    Várka 7 (batch 14): cukrovie biele kokosové guľky, kokosové pusinky, florentínske, kokosové rožky v čokoláde,
    marcipánové guľky, orechové kolieska s čokoládovým krémom. Cukrovie 19 / zostáva 11, torty 19 / zostáva 20.
    Zostávajúce torty a cukrovie majú na českých weboch slabé recepty (málo hodnotení, hrnčeky) – ďalší krok je
    hľadať ich na overených anglických weboch a preložiť.
    Várka 8 (batch 15): torty čokoládová bez múky, zmrzlinová malinovo-citrónová, kráľovská citrónová, karamelová
    hodvábna. Spolu v Koláčoch a dezertoch 125 receptov; torty 23 hotových / 16 v pláne, cukrovie 19 / 11.
    Tip na hľadanie: vzory v `dezerty.py` sú niekedy úzke (`^…`) – pri 0 kandidátoch hľadať v `data/urls.json` voľnejšie.
    Várka 9 (batch 16): torty gaštanová (zatiaľ bez fotky – žiadna fotka gaštanovej torty sa nenašla), hrušková s pudingom,
    malinová tvarohová, narodeninová s čokoládovou polevou (drip), pistáciovo-malinová, nugátová. Torty 29 / zostáva 10
    (Esterházy, Opera, kokosová, naked cake, bezé torta, jogurtová, čokoládovo-malinová, marcipánová, grilážová, Spartak),
    cukrovie 19 / zostáva 11 – na českých weboch slabé, treba anglické zdroje (WebSearch) alebo slovenské (Lidl).
    Várka 10 (batch 17): cukrovie orechové medové kocky, lieskovoorieškové koláčiky, mandľové rožky, zázvorové sušienky,
    čokoládové guľky s plnkou. Spolu 136 receptov. Cukrovie 24 / zostáva 6 (pracny so džemom, snehové guľky, plnené
    medovníčky, linecké s čokoládou, šachovnica, ovsené guľky – zdroje bez postupu alebo nejasné množstvá).
    Panna cotta: zdroje majú zlé hodnotenie (Vaření 3,3), treba hľadať inde (napr. anglické weby).
    Ďalej podľa plánu: zvyšok priority 1 (svadobné koláčiky, čokoládové a čučoriedkové muffiny, cookies, ovsené sušienky,
    panna cotta – Vaření má zlé hodnotenie, hľadať inde –, palacinky, ovocné a parené knedle, žemľovka, šúľance), potom priorita 2. Na zmazanie (majiteľ, SQL Editor):
    `delete from book_dishes where id = 'mramorova_babovka';` – duplicita omylom, recept patrí pod `babovka`.
    **Fotky receptov – pravidlo (21. 11., pokyn majiteľa):** každý recept má 2–3 pekné fotky, aspoň 1000 px. Ak zdroj má
    jednu alebo malú, `dopln_fotky.py` nájde rovnaké jedlo na iných weboch (len fotka receptu z JSON-LD, ≥ 1000 px),
    z kontaktného hárku sa ručne vyberie zhoda, `vyber_doplnenych.py` uloží (extrémne malá vlastná fotka sa vynechá).
    Zdroje: `fotky_zdroje_doplnene.json`. Keď sa zmení prvá fotka, súbory dostanú nový názov (`<id>_b-N.webp` +
    `image_path`), lebo service worker drží .webp v cache. Bez doplnenia zostali len mrkvový fit a tiramisu cheesecake
    (iná fotka toho istého jedla sa nenašla).
    **Fotky zo zahraničia – pravidlo (21. 11., pokyn majiteľa):** keď recept nemá fotku celého jedla, fotka nesedí k názvu
    alebo má nízke rozlíšenie, hľadaj rovnaké jedlo aj na zahraničných weboch (WebSearch, napr. lecker.de, recipetineats,
    foodnouveau, backenmitchristina.at). `zahranicie.py <priečinok> <id> <url…>` vypíše názov a suroviny cudzieho receptu
    a stiahne jeho fotku; fotku prevezmi len ak sedí NÁZOV, SUROVINY aj VZHĽAD (napr. Zimtsterne s bielkovou polevou ≠ naše
    škoricové hviezdičky obalené v cukre → nepoužiť). Uloženie `uloz_zahranicne.py` → `<id>_z-N.webp` + nový `image_path`.
    Prvé kolo: gaštanová torta, tiramisu torta, išelské, citrónový tart, Lotus torta, florentínky, tiramisu cheesecake,
    nugátová torta. Bez zhody zostali oblátková torta, lieskovoorieškové koláčiky a škoricové hviezdičky (1 vlastná fotka).
    **Ochutnávač:** fotka na šírku sa na obrazovke na výšku orezávala na úzky pás (vyzerala extrémne priblížená) – teraz sa
    ukáže celá (`object-fit: contain`, trieda `wide` podľa rozmerov) a pozadie vyplní rozmazaná kópia (`--bg`).
    **Ochutnávač – fotky dokola (21. 11., pokyn majiteľa):** fotky receptu sa samy posúvajú dokola (po poslednej znova
    prvá, skokom s krátkym prelínaním), kým je recept na obrazovke – predtým sa zastavili na poslednej a po prvom dotyku
    navždy. Prst na fotke posúvanie len pozdrží (pásik stojí, po pustení dobehne zvyšok času). `Photos.tsx` (`down`, `left`).
    Overené Playwrightom lokálne s testovacou DB: 1/3 → 2/3 → 3/3 → 1/3 → 2/3, podržanie 6 s stojí, ďalší recept tiež dokola.
    **Meranie webov (19. 11. 2026):** 15 náhodných receptov z každého webu + cielený test 13 klasických jedál (najlepší
    recept s ★≥4, ≥10 hodnoteniami, ≥60 % surovín s množstvom). Hlavné (JSON-LD, hodnotenia, celý katalóg zo sitemap):
    **Vaření.cz** 47 794 receptov, víťaz pri 13/13 jedál, medián 146 hodnotení, 91 % surovín s množstvom, ~130 slov postupu,
    kroky zvlášť; **Apetitonline.cz** 12 152 (redakčné), 11/13, medián 204 hodnotení, najdlhšie postupy (do 254 slov), málo
    dlhých odsekov; **Toprecepty.cz** 78 171, 12/13, medián 40; **Recepty.cz** 32 472, 8/13, medián 550 hodnotení, ale krátke
    postupy (~90 slov, často jeden odsek). Slovenské (bez prekladu): **Kuchyňa Lidla** 2 980 (kuchári, uvádza aj náradie;
    suroviny v JSON-LD ako jeden text → treba upraviť čítanie, hodnotenie 0–100 a málo hlasov, server občas vráti 500),
    **Varecha** (najdlhšie postupy, medián 210 slov, ale žiadne hodnotenia v dátach; robots.txt zakazuje ClaudeBot/GPTBot,
    Claude-User povoľuje), **Receptár.sk** 12 712 (mikrodáta, hodnotenia nesedia, ~84 slov), **recepty.aktuality.sk**
    (pekne štruktúrované, ale bez sitemap a hľadanie je cez JS – adresy len z kategórií, málo hlasov). Len s vlastnou
    čítačkou HTML: Víkendové pečení (581, JSON-LD bez surovín), Kuchařka pro dceru (505), Bonviváni (bez dát a sitemap).
    Nepoužiteľné: Labužník (medián 1 hodnotenie), Cooky.cz (12/15 bez receptu v dátach), fitrecepty.sk (403), kuchynelidla.cz
    (nedostupné). **Zoznam jedál zo sitemap:** 184 tis. adries zo 6 webov → 873 názvov jedál na ≥4 weboch, 3 310 na ≥3
    (treba zlúčiť CZ/SK názvy a obmeny, napr. jablkový/jablečný koláč). Skripty merania boli len v scratchpade.
    **Pred hromadným napĺňaním opraviť:** appka sťahuje celú knihu naraz (`useBookRecipes`: všetky recepty aj zdroje;
    `book_sources` má 497 riadkov pre 29 receptov a Supabase vráti najviac 1 000 → okolo 60 receptov sa zdroje stratia) –
    zoznam bez surovín/krokov + detail po otvorení; `light.py` berie z každého webu len 5 najkratších adries a víťaza len
    podľa počtu hlasov; kategórie receptov sú natvrdo v `previest.py` (`META`).
- **Recepty 2.0 (31. 10. 2026):** AI dnes recepty vymýšľa (rýchly model, bez opravy textu, fotka podľa slov v názve) –
  preto zlé výsledky („paprikas“). Plán verzia 2: jedna kniha bez delenia na krajiny, ~1 000 receptov (prvá várka 500),
  vyrobená raz výrobnou linkou (silný model píše → kritik porovná so zdrojmi → majiteľ schvaľuje), fotky od AI
  s kontrolou a označením „ilustračná“, jednorazovo do ~380 $. Cudzie API (Spoonacular, Edamam) neodporúčam –
  drahé pri tisícoch domácností a nesmie sa z neho stavať vlastná kniha. AI za behu len chápe dopyt:
  ~0,20–0,40 $ na domácnosť mesačne, z 3 € ostane ~1,7 € po DPH a poplatku obchodu. Ochutnávač len ako TikTok
  (rodinná zhoda). Verzia 3 (obsah): Varechu ani iné weby nekopírujeme (autorský zákon § 135–140, ochrana databázy);
  preberáme len štruktúru (skupiny surovín, kroky s „Hotové je, keď / Pozor / Tip“). Texty píšeme po várkach v Claude Code
  v rámci predplatného + kontrolný program + schválenie majiteľom; import receptu z odkazu (schema.org, Varecha ho má)
  súkromne pre domácnosť; skutočné fotky cez licenciu/vlastné/od rodín, bez AI fotiek; ~40 kariet „ako na to“ a režim
  „varím“ namiesto AI videí; Mapa knihy (čo chýba, „hľadali a nenašli“).
  Verzia 4 (podľa majiteľa): žiadni blogeri ani licencie. Recepty píše Claude po várkach (predplatné Pro, prípadne
  dočasne Max), 3 AI fotky na recept v jednotnom „domácom“ štýle cez existujúci Gemini kľúč (~180–360 $ za 1 000),
  označené „ilustračná fotka“. Varechu nesťahujeme: ich AI Content Policy (máj 2026) výslovne zakazuje hromadné
  sťahovanie a budovanie konkurenčnej appky či databázy; ponúkajú licenciu (redakcia@varecha.sk). Import z odkazu
  vypadol (ich pravidlá zakazujú appku ako zdroj obsahu). V dokumente je ukážka segedína podľa štandardu.
  Verzia 5 (systém knihy): Plán knihy v DB (jedlo → obmena, max 5 obmien, stavy, číslo várky), kategória + pevné
  značky, minimum 12 jedál na zobrazenie kategórie, priorita z bodov (hľadané bez výsledku +3/domácnosť, kategória
  pod minimom +10, sezóna +6, top 200 +8), várka 20 (max 4 z kategórie), z hľadania vzniká návrh (automaticky pri
  3 domácnostiach) a správa „recept je tu“, stráž proti duplicitám (názov + 70 % rovnakých surovín), Mapa knihy,
  ročný plán (200 → 500 a otvorenie → 1 000 → 1 500–2 000). Ukážka segedína sa majiteľovi páčila.
  https://claude.ai/artifact/XUqh2Un6H1ZgSbk9Q7m6xj (kópia: `prototyp/recepty-plan.html`) – čaká na 4 rozhodnutia v kap. 12.
  Skúšobná várka v prototype (31. 10.): 5 receptov podľa štandardu (segedín, kurací paprikáš s haluškami, medovník,
  kulajda, lasagne bolognese), každý s 3 AI fotkami (hlavná, porcia, detail) z `gemini-3.1-flash-image` cez kľúč
  testovacieho projektu – jednotný „domáci“ štýl (denné svetlo zľava, dubový stôl, biela keramika, šalvijová utierka).
  Fotky boli vytvorené dočasnou funkciou `proto-images` (chránená heslom, po použití vypnutá – vracia 410; dá sa zmazať
  v Supabase → Edge Functions). Recepty sú v `prototyp/src/book.js`, fotky v `prototyp/fotky-recepty/`. V prototype sú
  označené „AI recept · test“ a dajú sa ohodnotiť (Dobrý / Opraviť / Chyba). Ochutnávač (TikTok): zvislé listovanie,
  fotky do strany, dvojité ťuknutie = chcem, rodinná zhoda s Luciou, koniec po 15 receptoch. Hľadanie už recepty
  nevymýšľa – čo v knihe nie je, ide do plánu („hľadali a nenašli“). Mapa knihy: Viac → Mapa knihy receptov.

- **Basket Harmony 2.0 (26. 10. 2026):** vzhľad podľa mockupu z ChatGPT („Spíž“) na našom motore, 13 náhľadov
  obrazoviek, nová logika cien (medián posledných 3 × množstvo, základný názov produktu, ceny z dokladu späť k položkám),
  hlas, recepty zo 4 zdrojov, zoznam chýb, náklady AI, plán a 9 rozhodnutí: https://claude.ai/artifact/BegfzERBxhK4uRe1f3ubW9
  Po schválení: interaktívny mockup celej appky, potom fázy 0–4. Zistené chyby (nič z toho ešte nie je opravené):
  odhad ceny ignoruje množstvo, `list_price_hints` páruje „Mlieko“ na telové mlieko, `recipe-ai`/`parse-voice` bez
  kontroly domácnosti a limitu, `_auto_match_receipt`/`_receipt_list_score` volateľné prihláseným, testovacia DB má
  `store_key` prázdny pri všetkých dokladoch.

- **Nový vzhľad (29.–30. 10. 2026):** majiteľ si z viacerých návrhov vybral témy **Teplá kuchyňa** a **Fotky a sklo**
  (porovnanie tém: https://claude.ai/artifact/XV1Un8LGjhdSXRFasBDpVk). Interaktívny prototyp celej appky v oboch
  témach (svetlý/tmavý, prepínanie v časti Viac): https://claude.ai/artifact/RWbKSpqYnYPv2R2PQ2qfYT – zoznamy s odhadom
  ceny (medián posledných 3 nákupov × množstvo, značka obchodu), nákup so žiadosťou od Lucie, bloček → skutočné ceny
  späť k položkám, hlas a recepty cez Claude (bez neho miestne rozpoznávanie), výdavky z testovacej DB.
  Prototyp s appkou ani DB nesúvisí. Zdroj je v `prototyp/` (React bez balíčkovača; `python3 prototyp/build.py` zostaví
  `prototyp/dist/basket-harmony-prototyp.html`, ten sa publikuje na adresu vyššie). Ikony a obrázky sú už vložené
  v `prototyp/gen/`; nové ikony/emoji vie pridať `build_full.py` (potrebuje zdrojové obrázky a balík @phosphor-icons/core).
  1. 11. (schválené majiteľom, len v prototype): košík na karte zoznamu v Nákupoch (spustí nákup; pri rozbehnutom
  nákupe zelené „pokračovať“), pripnutá hlavička nákupu s pásikom – dielik = položka, vždy aj pri 50 položkách
  (namiesto kruhu), Hlasový nákup 2.0 (`prototyp/src/voicetalk.jsx`; návrh https://claude.ai/artifact/NHecpUar1srDgRvWcuwF3F):
  cieľ hore („Do: Lidl · zajtra“, dá sa povedať), živý prepis „Počujem“, padajúce položky, zlúčenie rovnakých,
  viditeľná oprava (mlieka → Mlieko polotučné, 500 g → 1 kg), neistota „syr“ s voľbami, ťuk = úprava hlasom
  („radšej kilo“, „zmaž“), „zmaž pivo“, Hotovo → uloží rovno (ak cieľ zaznel) alebo panel „Kam pridať?“,
  potom prechod do Nákupov s pulzom a „Späť“, rozdiktovaný koncept sa ukladá. Majiteľ ho neskôr upresní.
  Ďalej: sklo a veľkosti podľa iOS (`prototyp/css/polish.css`), nápovedy pre nových používateľov (`coach.jsx`),
  animácia odškrtnutia a zvýraznenie novej žiadosti. Do skutočnej appky zatiaľ nič z toho.
  1. 11. večer: v nákupe ikona produktu vľavo a fajka priamo v nej (bez krúžku). Rozpoznávanie pri písaní: slovo patrí
  k produktu len pri rovnakom slove alebo inej koncovke (mlieka/mlieko), nie pri spoločnom začiatku („silikon“ ≠
  „Silikónová lyžička“); všeobecné „syr“, „mäso“ nevyberú konkrétny produkt; preklep („zemaky“) ponúkne bublinu
  „Zemiaky? Preklep?“, nič sa nevymení samo. Skutočná appka to nemá (Enter tam pridá text tak, ako je).
  Po odškrtnutí poslednej položky sa samo otvorí „Nákup dokončený?“ s „Vrátiť sa k nákupu“. „Teraz nie“ zapíše
  nákup bez bločku (`missingReceipts`): červené číslo pri Výdavkoch na lište, karta „Chýba bloček“ vo Výdavkoch
  (Odfotiť / Bloček nemám) a na Domove. Uložený bloček sa spáruje sám: rovnaký zoznam, alebo rovnaký obchod do 3 dní.
  Lokalizácia (jazyk a krajina pri prvom spustení, pravopis podľa nej) – majiteľ ešte doriesi.
  Nápovedy 2.0 (`coach.jsx`): uvítanie pri prvom spustení (Ukážte mi to / Zvládnem to sám), nápovedy po obrazovkách
  s „1 z 3“, Ďalej, Preskočiť, nič nezmizne samo; „?“ vpravo hore na Domove, Nákupoch, zozname, Receptoch a Výdavkoch
  ich prehrá znova; Viac → Nápovedy (zap./vyp.) a Ukázať všetky znova; aj v nákupe a hlasovom nákupe. Oprava: na
  počítači je telefón zmenšený (scale) – poloha sa delí mierkou, čaká sa na dobehnutie animácie, sleduje sa pohyb.
  Ukončenie nákupu: kúpené idú do Histórie nákupov (`history`), zoznam sa zavrie (ostane len s nekúpenými, ak sa
  nechajú), appka skočí na Domov; Nákupy → História nákupov → detail (bloček/chýba, Odfotiť, Nakúpiť znova).
  „Mám doma“ v recepte: každá surovina sa dá prepnúť (aj bežne doma / z Nastavení) len pre daný recept
  (`recipeHave`), Nastavenia sa nemenia. „Čo mám doma“ v Nastaveniach: mriežka 2 stĺpce s vysvetlením.
  Domov – variant A (schválený z `prototyp/domov-varianty-navrh.html`): skupiny s nadpismi Treba vybaviť (chýbajúce
  bločky, len keď nejaké sú) / Nákupy (Lucia nakupuje, najbližší zoznam s Nakupovať) / Dnes večer (recept, ▶ Variť)
  / Rýchlo (3 dlaždice). Každý riadok má jednu hlavnú akciu vpravo. „Dnes večer“ premenované na „Naplánované
  recepty“: max. 2 najbližšie neuvarené z plánu (aj z posledných 3 dní, ak sa ešte nevarili; uvarené = `cooked`).
  Bloček: len Odfotiť / Z galérie. História nákupov v Nákupoch je tichší, priehľadný riadok.
  Návrh „Ukážka a sprievodca“ (`prototyp/ukazka-sprievodca-navrh.html`) čaká na súhlas majiteľa: Vitajte s 3 možnosťami,
  ukážková domácnosť na kópii údajov, 8 kapitol s kartou sprievodcu a „Ukáž mi to“, koniec → prázdna appka s Prvými
  krokmi, „?“ s ponukou (nápovedy / kapitola / celá ukážka), Viac → Pomoc a ukážka. Otvorené: meno domácnosti, dĺžka.
  Sprievodca je od 1. 11. spojený s hlavným prototypom (`prototyp/src/tour.jsx`; samostatná kópia zrušená):
  Vitajte, 8 kapitol s krokmi a „Ukáž mi to“, prestávka, pokračovanie po zavretí, koniec → prázdna appka (bez Lucie
  a bez reálnych bločkov) s Prvými krokmi, „?“ ponuka, Viac → Pomoc a ukážka. Okná nápovedy majú obrátený povrch.
  Pravidlo majiteľa: nápovedy a ukážka sa samy ukážu len pri prvom spustení (ukážka, alebo pri „Začať naprázdno“ tipy
  na Domove); potom nič samo – len cez „?“ (nápovedy obrazovky / kapitola / celá ukážka). Vitajte nemá „Mám pozvánku“:
  pozývanie je odkazom, ktorý hlavný člen pošle z appky a pozvaný ho len potvrdí (Viac → Pozvať do domácnosti → Poslať).
  Revízia rozhrania (`prototyp/revizia-rozhrania.html`, 2. 11.): 6 kritických a 10 dôležitých nálezov (kontrast tlačidiel
  v téme Fotky a sklo, ťukacie plochy < 44, písmo < 13 px, 2 tipy sa ukazujú samy, upozornenia bez vstupu, 2 chybné texty),
  návrh systému pohybu (5 dĺžok, 3 krivky), písma (8 veľkostí), upozornení a plán Fáza 1 (prototyp) / Fáza 2 (appka).
  Fáza 1 v prototype HOTOVÁ (2. 11.): tokeny pohybu `--dur-1…5`, `--ease-out/in/spring` (polish.css), písmo 12,5–34 + veľké sumy,
  rohy 8/12/16/22/28/plné, kontrast (--sec/--ter, tlačidlá #DC5A1C→#BF440D), ťukacie plochy 44, avatar s bodkou → Viac → Upozornenia
  (`src/notif.js`), „?“ aj v nákupe, hlase, sledovaní, varení, Ochutnávači, Histórii a Viac (+14 nápoved), žiadne samé tipy,
  sledovanie bez falošných tlačidiel, hlas do najbližšieho zoznamu, porovnanie v €, „Vrátiť“ pri odstránení odškrtnutých,
  slovník „V košíku“, „Recept od AI“, sprievodca pri prvom spustení „Základy“ (3 kapitoly, ~2 min) + „Ukážte mi aj zvyšok“.
  Pridávanie položiek (3. 11., pravidlo majiteľa): appka nič nedomýšľa – 3 úrovne podľa napísaného textu (`resolveName` v logic.js):
  všeobecná „pivo/smotana/chlieb/mlieko“ → virtuálna položka `g:<slovo>` s názvom ako napísané, cena = priemer nákupov všetkých
  druhov danej kategórie za 120 dní (druh bez bločku sa počíta orientačnou cenou); druh („kyslá smotana“, „pivo 12°“) len keď sú
  napísané všetky rozlišujúce slová; značka z bločkov („plzeň“, „radegast“, „kozel“) → `b:<značka>`, cena len z jej nákupov.
  Synonymá sa zjednotia („chleba“ = chlieb), široké slová (ovocie, mäso…) ostanú ako text bez ceny. PRODUCTS je Proxy, ktorá
  virtuálne položky dopočíta. Návrhy nad poľom sú zoznam riadkov (Enter ↵, druhy, značky, preklep); v detaile položky „Spresniť
  druh alebo značku“. Bloček páruje všeobecnú položku s ktorýmkoľvek jej druhom (`covers`). Do skutočnej appky treba preniesť
  rovnaké pravidlo (dnes Enter pridá text tak, ako je). Sprievodca: bezpečné okraje displeja, nezlomiteľné medzery, menšie displeje.
  Návrh jednej témy „Teplé sklo“ (`prototyp/tema-teple-sklo-navrh.html`) – spojenie Teplej kuchyne a Fotiek a skla:
  sklo nad fotkou trhu s teplým závojom, Fraunces + DM Sans, paprika = akcia, bazalka = hotovo, med = pozor, 3 hrúbky skla,
  overený kontrast. Čaká na súhlas; nič nie je implementované.
  30. 10.: prerobené rozloženie podľa pripomienok – 4 záložky s popisom (Domov, Nákupy, Recepty, Výdavky), bez
  záhadného akčného tlačidla; každá akcia má jedno miesto (hlas = mikrofón v poli zoznamu, bloček = Výdavky/Domov).
  Recepty ako kniha: Kniha receptov (kategórie, rýchly výber, zdroje) / Moje (obľúbené, pridané) / Plán týždňa,
  detail s listovaním Predchádzajúci/Ďalší. 38 receptov v 7 kategóriách.
  Do prototypu prenesené skutočné bločky z testovacej DB (snímka k 30. 10.): 66 bločkov aug–okt, 523 položiek,
  334 produktov; október 34 bločkov za 880,99 €. Výdavky, kategórie, obchody, história cien, ceny v zoznamoch,
  časté položky a „Oplatí sa vedieť“ sa počítajú z nich. Zoznamy a recepty ostávajú ukážkové.
  Návrat späť aj potiahnutím z ľavého okraja doprava (obrazovka ide za prstom, pod ňou predchádzajúca).
  Nový zoznam: obchod nie je predvolený, názov je presne ten napísaný; dlaždice obchodov (sklenené, podľa počtu nákupov),
  „Vybrať dátum“ a voľba Blahovci (predvolené) / Iba ja. Karty zoznamov bez ikon potravín a štvorcov s písmenom.
  Téma Fotky a sklo: všetky obrazovky majú rovnaké pozadie ako Nákupy (rozmazaná fotka trhu so závojom).
  Hlasový asistent ako sklenené tlačidlo v strede spodnej lišty. Písanie položiek: produkt sa vyberie len vtedy,
  keď k nemu patrí každé napísané slovo (inak nová položka presne podľa textu, doplní sa len diakritika);
  náhľad nad poľom ukazuje, čo pridá Enter. Pravidlo treba preniesť aj do skutočnej appky.
  Domov bez úvodnej hlavičky (fotka jedla, dátum, pozdrav); začína nadpisom Domov a rýchlymi akciami.
  Karty zoznamov: avatary skupiny pri názve, súkromný zoznam len so zámkom, bez nápisu „Spoločný“.
  Recept: v surovinách len „mám doma“; Pridať → predvolene nový zoznam s menom receptu, potom plynulo do Nákupov
  s rozsvietenou kartou (pulzuje ~5 s); karta zoznamu ukazuje recepty. Nový zoznam z receptu sa volá „Nákup k receptu“
  (názov sa dá zmeniť), názov receptu je v bubline na karte. Karty zoznamov sú užšie a kompaktnejšie.
  Recepty: každý má skutočnú fotku (aj nové z AI/importu – vyberie sa podľa názvu jedla, 33 nových fotiek z Openverse,
  licencie CC0/CC BY, autori v prototype v Nastaveniach → Zdroje fotiek). AI hľadanie receptov má animáciu čakania
  (krok sa mení, časovač, kostry kariet s plávajúcimi surovinami) a výsledky naskakujú postupne. Pri prenose do skutočnej
  appky treba vyriešiť zdroj fotiek (licencie) – v prototype sú vložené priamo.
  Posúvanie: zvislý ťah, ktorý začne na spodnej lište alebo v doku (karta „Kúpiť…“, pole zoznamu), posúva obsah pod nimi
  aj so zotrvačnosťou; vodorovný ťah po dlaždiciach a ťuk na tlačidlá fungujú ako predtým. Treba preniesť aj do appky. Výdavky: Kategória → Druh → Značka/výrobok → bloček so zvýrazneným riadkom.
  Množstvá (rozhodnutie majiteľa): číslo bez jednotky = počet kusov (kus, balík, strapec), nikdy sa neprepočítava;
  g/dkg/kg/ml/dl/l sa uložia presne, len keď ich niekto napíše („500g“, „pol kila“, „2 deci“). Kusy a presné množstvo
  sa nespájajú. Vážené veci v kusoch: pri položke cena za kg, do súčtu bežný nákup z bločkov (pri 3+ kusoch váha kusa).
  V detaile položky prepínač Kusy / Váha (Litre). Treba preniesť do skutočnej appky (položka má quantity + unit).
- Audit celej appky s plánom vo 4 fázach a návrhom tém Biela / Čierna / Farebná:
  https://claude.ai/artifact/6A4vJaWWJ7jEJrDTxqiztq
- Revízia zoznamov a nákupu (17 zistení): https://claude.ai/artifact/WgLwB1rLdQ8orYdv9Kv8Hv
- Návrhy dizajnu doku (plátno s mockupmi): https://claude.ai/code/artifact/6c26f3fa-644e-4fff-9edb-c171a81fb037
- Push upozornenia (iOS 16.4+ v appke z plochy) – majiteľ sa ešte nevyjadril.
- Známe nezrovnalosti: Obľúbené dlaždice „z 12“ vo Viac vs. max 11 v doku; nepoužité grafy
  `CumulativeChart`, `BarChart` (`features/analytics/charts.tsx`).

## Ako overovať

- `npm run check` (typy, testy, build) musí prejsť; `tsconfig.tsbuildinfo` po ňom vráť (`git checkout`).
- UI: postav `npx vite build --mode staging`, spusti `vite preview` a fotografuj Playwrightom
  (Chromium je v `/opt/pw-browsers`). Prihlásenie a odpovede Supabase sa dajú podvrhnúť cez
  `page.route` – nič sa vtedy nezapisuje do DB.
- Na skutočný iPhone (klávesnica, zvuky, vibrácie) treba majiteľa – tvrď len to, čo si overil.
