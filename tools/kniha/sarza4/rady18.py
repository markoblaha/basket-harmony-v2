# Rady a tipy zo zdroja ku kroku, ktorého sa týkajú (pokyn majiteľa 20. 11.: „tipy a rady v postupe tam, kam patria, nie na koniec“).
# Text rady ostane doslovne; zahodí sa len nadpis bloku („NEJČASTĚJŠÍ CHYBY…:“, „Tip:“), ktorý nahradí označenie Pozor/Tip v appke.
# warn = chyba/upozornenie (Pozor), tip = rada (Tip); viac rád pri jednom kroku sa oddelí novým riadkom (appka ich ukáže zvlášť).
# Kontroluje: z odstránených krokov sa nestratilo nič okrem nadpisov. Výstup: SQL (rady sa berú priamo z textu v DB cez split_part,
# nič sa neprepisuje ručne) a odtlačky na overenie zápisu.  Spustenie: python3 rady18.py <priečinok s orig4_*.sql>
import sys, re, json, hashlib

D = sys.argv[1]
# recept: {cieľový krok (od 0): [(pole, zdrojový krok, výber)]}; výber: "all", "b<n>" = n-tá odrážka (•), "re:<vzor>" = bez nadpisu
# drop: kroky, ktoré sa odstránia celé (zvyšky bez textu rady, napr. „!“ a nadpis „TIP k použití…“).
SPEC = {
    "svieckova": ({11: [("tip", 12, "all")]}, []),
    "pecena_kacica": ({2: [("tip", 6, "all")]}, [4, 5]),
    "karamelove_veterniky": ({7: [("tip", 8, "re:^Váš domácí fondán")]}, []),
    "hovadzi_gulas": ({0: [("warn", 3, "b1")], 1: [("warn", 3, "b2")], 2: [("warn", 3, "b3"), ("tip", 4, "b1"), ("tip", 4, "b2"), ("tip", 4, "b3")]}, []),
    "kulajda": ({0: [("warn", 3, "b2"), ("tip", 4, "b2")], 1: [("warn", 3, "b1")], 2: [("warn", 3, "b3"), ("tip", 4, "b1"), ("tip", 4, "b3")]}, []),
    "moravsky_vrabec": ({0: [("warn", 2, "b2"), ("tip", 3, "b1")], 1: [("warn", 2, "b1")]}, []),
    "laskonky": ({0: [("tip", 1, r"re:^Tip:\s*")], 2: [("tip", 3, r"re:^Tip:\s*")], 5: [("tip", 6, r"re:^Tip:\s*")]}, []),
    "cheesecake_s_ovocnou_penou": ({5: [("tip", 6, r"re:^TIP –\s*")]}, []),
    "makove_torticky_s_mangom": ({5: [("tip", 6, "all")]}, []),
}
NOTE = "Rady a tipy zo zdroja (napr. „Nejčastější chyby“, „Tipy“, „Tip:“) sú pri kroku, ku ktorému patria (Pozor/Tip), text bez zmeny; nadpisy blokov nahradilo označenie Pozor/Tip."


def load():
    out = {}
    for n in (1, 2, 3):
        for line in open(f"{D}/orig4_{n}.sql", encoding="utf-8"):
            if line.startswith("update"):
                rid = re.search(r"where id = \$q\$(.*?)\$q\$;", line).group(1)
                out[rid] = json.loads(re.search(r"steps = \$q\$(.*?)\$q\$", line).group(1))
    return out


def pick(text, how):  # rovnako ako SQL nižšie (trim v Postgres odstráni len medzery)
    if how == "all":
        return text
    if how.startswith("b"):
        return text.split("•")[int(how[1:])].strip(" ")
    return re.sub(how[3:], "", text, count=1)


def sql_pick(k, how):
    t = f"steps->{k}->>'text'"
    if how == "all":
        return t
    if how.startswith("b"):
        return f"trim(split_part({t}, '•', {int(how[1:]) + 1}))"
    return f"regexp_replace({t}, '{how[3:]}', '')"


md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
fp = lambda st: md5("\n".join("|".join([s["text"], s.get("group", ""), s.get("warn", ""), s.get("tip", "")]) for s in st))
steps = load()
sql = ["begin;"]
for rid, (spec, drop) in SPEC.items():
    st = steps[rid]
    used = {k for adds in spec.values() for _, k, _ in adds}
    gone = used | set(drop)
    new, parts = [], []
    for i, s in enumerate(st):
        if i in gone:
            continue
        s = dict(s)
        fields = {}
        for f, k, how in spec.get(i, []):
            fields.setdefault(f, []).append((k, how))
        exprs = []
        for f, srcs in fields.items():
            s[f] = "\n".join(pick(st[k]["text"], how) for k, how in srcs)
            exprs.append(f"'{f}', " + " || E'\\n' || ".join(sql_pick(k, how) for k, how in srcs))
        new.append(s)
        parts.append(f"steps->{i} || jsonb_build_object({', '.join(exprs)})" if exprs else f"steps->{i}")
    # Kontrola: text odstránených krokov = rady + nadpisy (nič iné sa nestratilo).
    for k in sorted(gone):
        t = st[k]["text"]
        taken = [pick(t, how) for adds in spec.values() for f, kk, how in adds if kk == k]
        rest = t
        for x in taken:
            assert x and x in rest, (rid, k, x[:40])
            rest = rest.replace(x, "", 1)
        print(f"{rid} krok {k + 1}: presunuté {len(taken)}, zahodené: {rest.strip(' •')!r}")
    sql.append(f"update public.book_recipes set steps = jsonb_build_array({', '.join(parts)}), version = 3, "
               f"verification = jsonb_set(verification, '{{notes}}', coalesce(verification->'notes', '[]'::jsonb) || to_jsonb($q${NOTE}$q$::text)) "
               f"where id = '{rid}' and version = 2;")
    print(f"  {rid}: {len(st)} → {len(new)} krokov, odtlačok {fp(new)}")
sql.append("commit;")
open(f"{D}/rady18.sql", "w", encoding="utf-8").write("\n".join(sql))
json.dump({rid: fp(steps[rid]) if rid not in SPEC else None for rid in steps}, open(f"{D}/rady18_bez_zmeny.json", "w"))
print("SQL:", f"{D}/rady18.sql")
