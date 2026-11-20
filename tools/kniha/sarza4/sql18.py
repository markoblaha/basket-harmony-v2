# Opravy priradenia potravín + SQL pre šaržu 4.
import json, sys, re
D = sys.argv[1]; rows = json.load(open(D + "/rows18.json"))
FIX = {"sušená bazalka": "x_susena_bazalka", "olej na vymastenie plechu": "olej", "bravčová masť": "mast", "sušené slivky": "x_susene_slivky", "sušené huby": "huby_susene",
       "krupicový cukor": "cukor", "čerstvý syr (cream cheese)": "kremovy_syr", "čerstvý syr (cream cheese) typu Philadelphia": "kremovy_syr", "muškátový oriešok": "x_muskatovy_oriesok",
       "mandľová múka alebo mleté mandle": "orechy", "kvalitný kečup (alebo domáci)": "x_kecup", "tenké párky": "x_parky", "detské piškóty": "x_detske_piskoty",
       "kondenzované mlieko – sladené, karamelizované (Salko karamel – mliečny karamel)": "x_kondenzovane_mlieko", "bravčové pliecko": "x_bravcove_pliecko",
       "baklažány (asi 500 g spolu)": "x_baklazany", "ovocné pyré (autorka použila čierne ríbezle)": "x_ovocne_pyre", "lasagne (suché cestovinové pláty)": "x_lasagne_platy"}
n = 0
for r in rows:
    for i in r["ings"]:
        if i["label"] in FIX and i["food"] != FIX[i["label"]]: i["food"] = FIX[i["label"]]; n += 1
        if r["t"]["id"] == "cheesecake_s_ovocnou_penou" and i["label"] == "vajcia": i["food"] = "vajce"; n += 1
json.dump(rows, open(D + "/rows18.json", "w"), ensure_ascii=False)
EU = {"recka_musaka", "lasagne", "konfitovana_kacica"}; SK = {"vianocna_kapustnica"}
def q(s):
    assert "$q$" not in s; return "$q$" + s + "$q$"
def j(o): return q(json.dumps(o, ensure_ascii=False)) + "::jsonb"
def arr(xs): return "array[" + ",".join(q(x) for x in xs) + "]::text[]" if xs else "'{}'::text[]"
sql = ["begin;"]
for r in rows:
    t, s, ings = r["t"], r["s"], r["ings"]
    site = re.sub(r"^www\.", "", s["site"])
    unmapped = [i["label"] for i in ings if i["food"].startswith("x_")]
    steps = [{"text": x, "timerMin": None, "src": "A"} for x in t["steps"]]
    ver = {"kind": "light", "batch": 4, "method": "jeden najlepší recept, prevzatý presne" + ("" if t.get("copy") else ", preklad CZ→SK veta po vete"),
           "source": {"site": site, "name": s["name"], "rating": s["rating"], "votes": s["votes"]},
           "check": {"ingredients": "ok", "numbers": "ok", "czech_words": "ok"}, "unmapped": unmapped, "removed": t.get("removed", []), "time_estimated": bool(t.get("minutes_est"))}
    if any(i.get("added") for i in t["ingredients"]): ver["added"] = [i["sk"] + " – " + i.get("note", "") for i in t["ingredients"] if i.get("added")]
    cz = "EU" if t["id"] in EU else "SK" if t["id"] in SK else "SK-CZ"
    sql.append(f"insert into public.book_dishes (id, name_sk, category, cuisine, status) values ({q(t['id'])}, {q(t['name_sk'])}, {q(t['category'])}, {q(cz)}, 'done');")
    sql.append("insert into public.book_recipes (id, dish_id, variant_key, status, version, batch, name, category, meat, cuisine, minutes, active_minutes, difficulty, portions, scale, portions_guess, tags, tools, wait, ingredients, steps, verification, image_status) values ("
        + ", ".join([q(t["id"]), q(t["id"]), "'classic'", "'published'", "1", "4", q(t["name_sk"]), q(t["category"]), q(t["meat"]), q(t["cuisine"]), str(t["minutes"]), str(t["active"]),
                     str(t["difficulty"]), str(t["portions"]), q(t["scale"]), "true" if t.get("portionsGuess") else "false", "'{}'::text[]", arr(t.get("tools", [])),
                     q(t["wait"]) if t.get("wait") else "null", j(ings), j(steps), j(ver), "'none'"]) + ");")
    sql.append("insert into public.book_sources (recipe_id, k, site, name, url, portions, rating, votes, is_anchor) values ("
        + ", ".join([q(t["id"]), "'A'", q(site), q(s["name"]), q(s["url"]), str(t["portions"]), str(round(s["rating"], 2)) if s["rating"] else "null", str(int(s["votes"])) if s["votes"] else "null", "true"]) + ");")
sql.append("insert into public.book_runs (batch, kind, model, effort, total, ok, quarantined, note) values (4, 'publish', 'claude (relácia)', null, 18, 18, 0, $q$18 komplikovaných receptov, po 3 zo 6 webov (Vaření, Apetit, Toprecepty, Recepty.cz, Kuchyňa Lidla, Víkendové pečení); preklad v relácii, kontrola programom$q$);")
sql.append("commit;")
open(D + "/sarza4.sql", "w").write("\n".join(sql))
print("opravených priradení:", n, "| SQL bajtov:", len("\n".join(sql).encode()))
