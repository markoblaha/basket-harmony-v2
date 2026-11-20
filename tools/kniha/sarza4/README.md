# Šarža 4 (20. 11. 2026) – prototyp linky v2

18 komplikovaných receptov, po 3 zo 6 webov (Vaření, Apetit, Toprecepty, Recepty.cz, Kuchyňa Lidla, Víkendové pečení).
Základ pre `linka.py` z návrhu systému (fáza 2). Pracovné dáta (kandidáti, preklady, SQL) sú mimo gitu.

- `web.py` – sťahovanie, sitemap, čítanie receptu z JSON-LD a mikrodát
- `vyber18.py` – kandidáti z webov + čítačky pre Kuchyňu Lidla (suroviny ako jeden text) a Víkendové pečení (HTML)
- `build18.py` – kontrola prekladu proti zdroju: zoznam surovín, množstvá (cez `parse.py`), čísla v postupe, české písmená, doslovná kópia pri SK zdroji
- `sql18.py` – opravy priradenia potravín a SQL pre `book_*`
