# Kontrola AI prepisu: čísla z originálu (kroky aj suroviny) musia byť aj v preklade, počet surovín a krokov sedí, nič navyše.
# Výstup: data/out/<id>.json → ok / karanténa s dôvodom. Použitie: overit.py [id ...]
import os, sys, json, re
from pathlib import Path
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data")); os.chdir(DATA)
nums = lambda s: sorted(x.replace(",", ".") for x in re.findall(r"\d+(?:[.,]\d+)?", s))
def check(id):
    i = json.load(open(f"in/{id}.json"))["winner"]; o = json.load(open(f"out/{id}.json")); bad = []
    if not o.get("name_sk"): bad.append("bez názvu")
    if len(o["ingredients"]) != len(i["ing"]): bad.append(f"surovín {len(o['ingredients'])} z {len(i['ing'])}")
    for a, b in zip(i["ing"], o["ingredients"]):
        if b.get("orig", "").strip() != a.strip(): bad.append(f"zmenený riadok suroviny: {a[:30]}")
        if nums(a) and b.get("qty") is None and not (b["unit"] in ("podla_chuti", "podla_potreby")): bad.append(f"chýba množstvo: {a[:30]}")
    steps_in = [s for s in i["steps"] if not re.match(r"\s*(!?TIP|Foto|->|Poznámka)", s)]
    if abs(len(o["steps"]) - len(steps_in)) > 2: bad.append(f"krokov {len(o['steps'])} z {len(steps_in)}")
    for s in o["steps"]:
        a, b = nums(s["orig"]), nums(s["sk"])
        miss = [x for x in a if x not in b and not (x.replace(".0","") in b)]
        extra = [x for x in b if x not in a and x.replace(".0","") not in a]
        if miss or extra: bad.append(f"čísla v kroku: chýba {miss} navyše {extra}: {s['sk'][:40]}")
    return bad
for id in (sys.argv[1:] or [p.stem for p in Path("out").glob("*.json")]):
    try: b = check(id)
    except Exception as e: b = [f"chyba súboru: {e}"]
    print(("OK       " if not b else "KARANTÉNA ") + id, "" if not b else " | ".join(b[:4]))
