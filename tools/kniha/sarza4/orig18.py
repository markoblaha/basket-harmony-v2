# Recepty šarže 4 v presnom znení zdroja (bez prekladu): suroviny = riadky zdroja, kroky = text zdroja. Kontrola zhody + SQL UPDATE.
import sys, json, re
D = sys.argv[1]
src = {r["url"]: r for r in json.load(open(D + "/vybrane.json"))}
rows = json.load(open(D + "/rows18.json"))
ws = lambda s: re.sub(r"[\s ]+", " ", s).strip()
NUM = r"(?:\d+\s*/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])"
UNIT = (r"kg|dkg|g|ml|dl|l|ks|lžíce|lžic|lžička|lžičky|lžiček|PL|ČL|hrst|hrsti|špetka|špetky|stroužky|stroužek|plátky|plátek|kuliček|kuličky|"
        r"svazek|svazeček|konzerva|kelímek|balení|balíček|kostka|listy|list|lyžica|lyžice|lyžíc|lyžička|lyžičky|lyžičiek|strúčiky|strúčik|hrsť|vetvičky|vetvička|hlávka|litre|liter")
LAB = re.compile(r"^\s*(?:cca\.?\s*)?" + NUM + r"(?:\s*[-–]\s*" + NUM + r")?\s*(?:(?:" + UNIT + r")(?![\wáčďéěíňóřšťúůýžľĺŕô])\.?)?\s*")
LIDL_HEAD = {"Servírovanie", "Marinovanie", "Konfitovanie", "Pečenie"}
GLUE = re.compile(r"(?<=[.!?“\"])(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])")
sql, report = ["begin;"], []
def q(s):
    assert "$q$" not in s; return "$q$" + s + "$q$"
for r in rows:
    t, s = r["t"], src[r["t"]["url"]]; site = s["site"]; lang = "sk" if "lidla" in site else "cs"
    norm_ings = [i for i in r["ings"] if i.get("orig")]  # bez doplneného masla
    heads = set(t.get("group_lines", [])) | set(t.get("groups_src", {}))
    ings, grp, k = [], None, 0
    for n, line in enumerate(s["ing_list"]):
        L = ws(line)
        if not L: continue
        if L in heads or L.endswith(":"): grp = L.rstrip(":").strip(); continue
        if site == "vikendovepeceni.cz": grp = ws(s["groups_ing"][n]) or None
        ni = norm_ings[k]; k += 1
        assert ws(ni["orig"]) == L, (t["id"], L, ni["orig"])
        label = LAB.sub("", L, count=1).strip() or L
        ing = {"food": ni["food"], "qty": ni["qty"], "unit": ni["unit"], "label": label, "orig": L}
        if grp: ing["group"] = grp
        ings.append(ing)
    assert k == len(norm_ings), (t["id"], k, len(norm_ings))
    steps, tools, wait, sgrp, dropped = [], [], [], None, []
    drop = set(t.get("drop_steps", []))
    for n, st in enumerate(s["steps_list"]):
        S = ws(st)
        if not S: continue
        if site == "kuchynalidla.sk":
            if S.upper() in ("POSTUP", "POTREBUJEME"): dropped.append(S); continue
            if S in heads or S in LIDL_HEAD: sgrp = S; dropped.append(S); continue
            if S in drop: tools.append(S); dropped.append(S); continue
            if S.startswith("Čas "): wait.append(S); dropped.append(S); continue
            steps.append({"text": S, "timerMin": None, "src": "A", **({"group": sgrp} if sgrp else {})})
        elif site == "vikendovepeceni.cz":
            g = ws(s["groups_steps"][n]) or None
            steps.append({"text": S, "timerMin": None, "src": "A", **({"group": g} if g else {})})
        else:
            for part in GLUE.split(S):
                if part.strip(): steps.append({"text": part.strip(), "timerMin": None, "src": "A"})
    # kontrola: text krokov + vynechané nadpisy/náradie/časy = celý text zdroja (bez medzier), suroviny = riadky zdroja
    a = re.sub(r"\s", "", "".join(ws(x) for x in s["steps_list"]))
    b = re.sub(r"\s", "", "".join([x["text"] for x in steps] + dropped)) if site != "kuchynalidla.sk" else None
    if site == "kuchynalidla.sk":
        rebuilt = []
        for x in s["steps_list"]:
            X = ws(x)
            if X: rebuilt.append(X)
        ok_steps = sorted(rebuilt) == sorted([x["text"] for x in steps] + dropped)
    else:
        ok_steps = a == b
    src_ings = [ws(x) for x in s["ing_list"] if ws(x) and ws(x) not in heads and not ws(x).endswith(":")]
    ok_ings = src_ings == [i["orig"] for i in ings]
    report.append((t["id"], lang, len(ings), len(steps), ok_ings, ok_steps))
    unmapped = sorted({i["label"] for i in ings if i["food"].startswith("x_")})
    notes = []
    if t["id"] == "svieckova": notes.append("Zdroj uvádza v 5. kroku 100 g rozpusteného masla, ktoré v zozname surovín nie je – ponechané presne ako v zdroji.")
    if site == "kuchynalidla.sk": notes.append("Nadpisy častí postupu sú pri krokoch (group), náradie v tools, časy marinovania/konfitovania vo wait; riadky POSTUP a POTREBUJEME sú len nadpisy.")
    if "recepty.cz" in site: notes.append("Zdroj má postup ako jeden text; rozdelený na odseky presne tam, kde zdroj začína nový odsek, bez zmeny textu.")
    ver = {"kind": "copy", "batch": 4, "lang": lang, "method": "presná kópia receptu zo zdroja v pôvodnom jazyku (preklad sk↔cs neskôr samostatne)",
           "source": {"site": re.sub(r"^www\.", "", site), "name": s["name"], "rating": s["rating"], "votes": s["votes"]},
           "check": {"ingredients": "zhodné so zdrojom" if ok_ings else "NEZHODA", "steps": "zhodné so zdrojom" if ok_steps else "NEZHODA"},
           "unmapped": unmapped, "time_estimated": bool(t.get("minutes_est")), "notes": notes}
    j = lambda o: q(json.dumps(o, ensure_ascii=False)) + "::jsonb"
    arr = "array[" + ",".join(q(x) for x in tools) + "]::text[]" if tools else "'{}'::text[]"
    sql.append(f"update public.book_recipes set name = {q(s['name'])}, lang = {q(lang)}, ingredients = {j(ings)}, steps = {j(steps)}, tools = {arr}, wait = {q(' · '.join(wait)) if wait else 'null'}, verification = {j(ver)}, version = 2 where id = {q(t['id'])};")
sql.append("insert into public.book_runs (batch, kind, model, total, ok, quarantined, note) values (4, 'publish', 'claude (relácia)', 18, 18, 0, $q$šarža 4 prepísaná na presnú kópiu zdroja v pôvodnom jazyku (15 cs, 3 sk), verzia 2$q$);")
sql.append("commit;")
for x in report: print(("OK      " if x[4] and x[5] else "NEZHODA ") + f"{x[0]:28} {x[1]}  surovín {x[2]:2}  krokov {x[3]:2}  suroviny={x[4]} kroky={x[5]}")
body = sql[1:-2]
for n in range(3):
    part = ["begin;"] + body[n*6:(n+1)*6] + ([sql[-2]] if n == 2 else []) + ["commit;"]
    open(f"{D}/orig4_{n+1}.sql", "w").write("\n".join(part)); print("časť", n + 1, len("\n".join(part).encode()), "bajtov")
