# Basket Harmony v2

Spoločný nákupný zoznam domácnosti: zdieľaný zoznam s okamžitou synchronizáciou,
režim nakupovania so žiadosťami o pridanie, neskôr bločky s AI a prehľady výdavkov.

## Z čoho sa aplikácia skladá

| Časť | Služba | Čo robí |
|---|---|---|
| **Kód** | GitHub – tento repozitár | História všetkých zmien. Každý `push` do `main` sa automaticky nasadí. |
| **Aplikácia (frontend)** | Cloudflare Workers | Rozosiela hotovú webovú aplikáciu do prehliadačov. |
| **Databáza a prihlasovanie** | Supabase – projekt `basket-harmony-v2` | Údaje, používatelia, pravidlá prístupu, živá synchronizácia. |

## Kde čo je

```
src/
  lib/            pripojenie k Supabase, kategórie, preklad chýb, pomocné funkcie
  components/     spoločné prvky rozhrania (tlačidlá, okná, navigácia)
  features/
    auth/         prihlásenie, registrácia, zabudnuté heslo
    household/    domácnosť, členovia, pozvánky, obrazovka „Viac“
    lists/        nákupný zoznam, režim nakupovania, žiadosti
    realtime/     živá synchronizácia medzi mobilmi
supabase/
  migrations/     databáza – tabuľky, pravidlá prístupu, funkcie (v poradí, ako vznikali)
  tests/          test pravidiel databázy (spúšťa sa priamo v databáze, nič nezanechá)
```

## Najdôležitejšie pravidlá (sú v databáze, nie v aplikácii)

- Každý vidí iba údaje svojej domácnosti (Row Level Security).
- Položku pridáva iba funkcia `add_item`, ktorá rozhodne:
  nikto nenakupuje → rovno do zoznamu · nakupujem ja → rovno do zoznamu ·
  nakupuje iný → žiadosť, ktorú nakupujúci schváli alebo odmietne.
- Jeden zoznam môže naraz nakupovať iba jeden človek. Nákup vyprší po 2 hodinách
  nečinnosti; žiadosti z vypršaného nákupu už nič nepridajú.
- Pozvánka platí 7 dní, iba raz; v databáze je uložený len jej odtlačok.

## Príkazy (pre vývoj)

```sh
npm install        # stiahne knižnice
npm run dev        # spustí aplikáciu lokálne
npm run check      # kontrola typov + testy + zostavenie (musí prejsť pred nasadením)
```
