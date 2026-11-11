# Stav projektu (odovzdanie pre ďalšiu reláciu)

Aktualizované 2. 11. 2026 (Fáza 0 prestavby). Pred prácou si prečítaj celé – je to krátke.

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

## Otvorené (návrhy čakajú na rozhodnutie majiteľa)

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
