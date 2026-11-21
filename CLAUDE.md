# Pokyny pre AI asistentov

**Na začiatku každej relácie si prečítaj `docs/STAV-PROJEKTU.md`** – čo je hotové, čo beží kde,
rozhodnutia majiteľa a čo treba spraviť pred zlúčením do `main`. Na konci väčšej práce ho aktualizuj.

Majiteľ projektu nie je programátor. Komunikuj po slovensky, vysvetľuj príčiny,
a pri krokoch, ktoré musí urobiť on, píš presne kam kliknúť a prečo.

**Kriticky hodnoť (pokyn majiteľa 21. 11.).** Keď majiteľ niečo navrhne alebo sa pýta, nesúhlas automaticky:
zhodnoť návrh aj vlastné riešenie – je to správne, najlepšie, dá sa to urobiť kvalitnejšie či profesionálnejšie?
Ak nie, povedz to otvorene s dôvodom a navrhni lepšiu cestu. Rovnako priznaj slabiny vlastného riešenia.

## Princípy

- **Jednoduchosť.** Aplikácia je pre jednu domácnosť. Nepridávaj vrstvy, verzie,
  prepínače funkcií ani rozsiahle dokumenty „pre istotu“. README stačí; nové
  dokumenty len ak o ne majiteľ požiada.
- **Pravidlá patria do databázy.** Oprávnenia a stavové prechody (nákup, žiadosti,
  pozvánky) sú v SQL funkciách + RLS. Frontend ich len volá a zobrazuje výsledok.
- **Žiadne surové dotazy v komponentoch.** Prístup k dátam je v `features/*/api.ts`.
- **Každá chyba musí byť viditeľná** (toast/banner, text cez `lib/errors.ts`).
- **Každý text v rozhraní ide cez `t("kľúč")`** (`src/i18n`), nikdy natvrdo v komponente.
  Nový text = kľúč v slovenskom aj anglickom slovníku (`src/i18n/sk/<modul>.ts` a
  `src/i18n/en/<modul>.ts`); slovenský je zdroj pravdy a test v `i18n.test.ts` zlyhá,
  ak niečo v angličtine chýba. Kľúče majú predponu modulu (`more.`, `shop.`, `stmt.`…),
  množné číslo sa rieši cez `tn("kľúč", n)` s tvarmi `.one/.few/.other`.
  Dátumy, čísla a eurá formátuj cez `formatDateTime`/`formatNumber`/`formatEuro`, nie ručne.
- Predvolený jazyk je slovenčina; jazyk a vzhľad (svetlý/tmavý/podľa systému) sa ukladajú
  v zariadení (`bh.locale`, `bh.theme`). Farby používaj len cez role z `styles.css`,
  aby fungovali v oboch vzhľadoch.
- Texty z databázy a edge funkcií sú kódy, ktoré sa mapujú na `error.*` kľúče
  (`lib/errors.ts`); do DB nepíš texty určené pre rozhranie.
- Vyhýbaj sa skloňovaniu mien v šablónach (píš „Nakupuje: Lucia“, nie „Požiadať Lucia“).

## Kniha receptov

- Recept sa preberá z textu, ktorý je **na stránke naozaj vidieť** (v prehliadači `document.body.innerText`), nie zo
  skrytých dát (JSON-LD, HTML pre vyhľadávače) – tie sa môžu líšiť (tekvicové rezy: v dátach „lžíce“, na stránke „lžička“).
  Skryté dáta slúžia len na rýchle nájdenie surovín; pri rozdiele platí viditeľný text.
- **Nič vymyslené (pokyn majiteľa 21. 11.):** suroviny, postup, tipy, čas, náročnosť a ďalšie údaje len tak, ako sú
  na stránke. Žiadne vlastné rady, odhady času práce ani náročnosti. Čas a náročnosť zo stránky sa ukladajú do
  `verification.page` ({time: „< 90 min“ | „60 min“, difficulty: 1–3}); keď ich stránka neuvádza, appka ich neukáže.
- Fotky len zo stránky pôvodného receptu. Lyžice podľa originálu: skratky PL/ČL celým slovom, slová lžíce/lžička
  ako „lyžica/lyžička“. Podrobnosti v `docs/STAV-PROJEKTU.md`.

## Databáza

- Supabase projekt: `kjadeylctafnmgembgev` (basket-harmony-v2, eu-central-1).
- Testovací projekt: `esftqxrdrlldvpmwirrx` (basket-harmony-v2-test). Používa ho každá vetva okrem
  `main` (`.env.staging`, režim „staging“ vo `vite.config.ts`). Novú migráciu nasaď najprv sem,
  vyskúšaj v testovacej appke a do ostrého projektu až pri zlúčení do `main`.
- Zmena databázy = nový súbor v `supabase/migrations/` (YYYYMMDDHHMMSS_nazov.sql)
  a jeho nasadenie. Staré migrácie neprepisuj.
- Po zmene funkcií/pravidiel spusti `supabase/tests/core_test.sql` (blok vždy skončí
  výnimkou `TEST_REPORT` a všetko vráti späť; hľadaj `fails=0`) a doplň testy.
- Po zmene schémy aktualizuj `src/lib/database.types.ts`.
- SQL s príkazom `delete` vyžaduje potvrdenie majiteľa – upozorni ho vopred.

## Overenie pred odovzdaním

`npm run check` (typy + testy + build) musí prejsť. Funkčnosť over v prehliadači
na nasadenej adrese; tvrď len to, čo si naozaj overil.
