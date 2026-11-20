# Šarža 4 (20. 11. 2026) – prototyp linky v2

18 komplikovaných receptov, po 3 zo 6 webov (Vaření, Apetit, Toprecepty, Recepty.cz, Kuchyňa Lidla, Víkendové pečení).
Základ pre `linka.py` z návrhu systému (fáza 2). Pracovné dáta (kandidáti, preklady, SQL) sú mimo gitu.

- `web.py` – sťahovanie, sitemap, čítanie receptu z JSON-LD a mikrodát
- `vyber18.py` – kandidáti z webov + čítačky pre Kuchyňu Lidla (suroviny ako jeden text) a Víkendové pečení (HTML)
- `build18.py` – (prvá verzia s prekladom do slovenčiny, už sa nepoužíva) kontrola prekladu proti zdroju
- `sql18.py` – opravy priradenia potravín a SQL pre `book_*`
- `orig18.py` – **platná verzia (pokyn majiteľa 20. 11.)**: recept v presnom znení a jazyku zdroja (cs/sk). Suroviny = riadky
  zdroja (`orig`), kroky = text zdroja (nadpisy častí v `group`), kontrola zhody so zdrojom a SQL UPDATE (verzia 2, stĺpec `lang`).
  Spustenie: `python3 orig18.py <priečinok s vybrane.json a rows18.json>`.
- `rady18.py` – rady a tipy zo zdroja ku kroku, ktorého sa týkajú (Pozor/Tip), doslovne; kontrola, že sa stratili len nadpisy
  blokov; SQL berie text rád priamo z DB. Spustenie: `python3 rady18.py <priečinok s orig4_*.sql>`.
