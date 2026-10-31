# Stav projektu (odovzdanie pre ďalšiu reláciu)

Aktualizované 23. 10. 2026. Pred prácou si prečítaj celé – je to krátke.

## Kde čo beží

| Čo | Kde |
|---|---|
| Ostrá appka | vetva `main` → Cloudflare Worker `basket-harmony-v2`, DB `kjadeylctafnmgembgev` |
| Testovacia appka | vetva `design/v2-mobile-redesign` → https://design-v2-mobile-redesign-basket-harmony-v2.markoblaha.workers.dev, DB `esftqxrdrlldvpmwirrx` (režim „staging“, `.env.staging`) |
| Nasadenie | každý `push` – Cloudflare postaví vetvu sám (1–3 min). Overenie: zmení sa `assets/index-*.js` v HTML testovacej adresy. |
| Starý repozitár | `markoblaha/basket-harmony` (pôvodná appka z Lovable) – s v2 nesúvisí |

Majiteľ nechce: push do `main` ani Pull Request bez výslovného pokynu. Do ostrej DB len pri zlúčení.

Testovacia DB má kópiu dokladov domácnosti Blahovci z ostrej DB (23. 10. 2026: 66 dokladov, 523 položiek,
416 produktov + aliasy; všetky doklady pripísané Markovi). Fotky dokladov ani `receipt_pages` sa nekopírovali.

## Pred zlúčením testovacej vetvy do `main` (nedokončené)

1. **`main` má 1 zmenu navyše** (`9aba9fb` – doklady sa čítajú na pozadí, migrácie
   `20261020000024_receipt_queue`, `20261020000025_worker_secret`, funkcia `ai-eval`).
   Najprv ju zlúč do testovacej vetvy a nasaď tie migrácie do testovacej DB.
2. Do ostrej DB chýbajú migrácie testovacej vetvy: `20261021000024_item_unavailable`,
   `…025_shopping_time_finish`, `…026_receipt_match`, `…027_recipes`, `20261022000028_staple_items`,
   `20261030000029_product_kinds` (v testovacej DB nasadená ako 3 kroky: product_kinds, product_kinds_units,
   product_kinds_by_name – súbor v repozitári je ich súčet). Funkciu `normalize-products` v3 (druh) nasadiť aj do ostrej.
   Históriu migrácií oboch DB porovnaj (`list_migrations`) – ostrá má niektoré pod inými menami.
3. Edge funkcie len v testovacej DB: `recipe-ai` (recepty), `parse-voice` v4 (zvuk cez
   gemini-3.6-flash + slovník domácnosti). Pri zlúčení nasadiť aj do ostrej.
4. `supabase/tests/core_test.sql` celý nebežal (obsahuje `delete` → treba súhlas majiteľa).

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

## Rozhodnutia majiteľa (nemeniť bez opýtania)

- Plánovanie bez kategórií; kategórie až v nákupe. Kategória sa priraďuje pri pridaní. Poradie trasy je všeobecné, nie podľa obchodu.
- Ťuk = +1, pridanie po 2 s, položka v doku sa nahradí ďalšou. V režime písania presne 6 bublín (3×2), bez posúvania.
- Hlas nesmie vydávať žiadne zvuky. Pásik ˄ ˅ ✓ nad klávesnicou iPhonu z webu skryť nejde (len natívna appka).
- Texty po slovensky, jednoduché, bez skloňovania mien („Nakupuje: Lucia“).

## Otvorené (návrhy čakajú na rozhodnutie majiteľa)

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
  Prototyp je samostatný súbor mimo repozitára, s appkou ani DB nesúvisí. Čaká sa na výber témy a pripomienky.
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
