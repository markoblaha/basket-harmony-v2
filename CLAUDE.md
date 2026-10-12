# Pokyny pre AI asistentov

Majiteľ projektu nie je programátor. Komunikuj po slovensky, vysvetľuj príčiny,
a pri krokoch, ktoré musí urobiť on, píš presne kam kliknúť a prečo.

## Princípy

- **Jednoduchosť.** Aplikácia je pre jednu domácnosť. Nepridávaj vrstvy, verzie,
  prepínače funkcií ani rozsiahle dokumenty „pre istotu“. README stačí; nové
  dokumenty len ak o ne majiteľ požiada.
- **Pravidlá patria do databázy.** Oprávnenia a stavové prechody (nákup, žiadosti,
  pozvánky) sú v SQL funkciách + RLS. Frontend ich len volá a zobrazuje výsledok.
- **Žiadne surové dotazy v komponentoch.** Prístup k dátam je v `features/*/api.ts`.
- **Každá chyba musí byť viditeľná** (toast/banner, text cez `lib/errors.ts`).
- Texty v rozhraní sú po slovensky; vyhýbaj sa skloňovaniu mien v šablónach
  (píš „Nakupuje: Lucia“, nie „Požiadať Lucia“).

## Databáza

- Supabase projekt: `kjadeylctafnmgembgev` (basket-harmony-v2, eu-central-1).
- Zmena databázy = nový súbor v `supabase/migrations/` (YYYYMMDDHHMMSS_nazov.sql)
  a jeho nasadenie. Staré migrácie neprepisuj.
- Po zmene funkcií/pravidiel spusti `supabase/tests/core_test.sql` (blok vždy skončí
  výnimkou `TEST_REPORT` a všetko vráti späť; hľadaj `fails=0`) a doplň testy.
- Po zmene schémy aktualizuj `src/lib/database.types.ts`.
- SQL s príkazom `delete` vyžaduje potvrdenie majiteľa – upozorni ho vopred.

## Overenie pred odovzdaním

`npm run check` (typy + testy + build) musí prejsť. Funkčnosť over v prehliadači
na nasadenej adrese; tvrď len to, čo si naozaj overil.
