# Porovná suroviny zo skrytých dát (JSON-LD) s viditeľným textom stránky (innerText z prehliadača).
# Použitie: python3 porovnaj_viditelne.py zdroje.json viditelne_text.json  (najprv node viditelne.cjs zdroje.json viditelne_text.json)
# Vypíše suroviny, ktorých množstvo alebo druh lyžice zo skrytých dát nesedí s viditeľným textom. Iný zápis (1/2 vs 0,5) je falošný poplach.
import sys, re, json, html as H
sys.path.insert(0, "/home/user/basket-harmony-v2/tools/kniha/sarza4")
from web import get, recipe
from concurrent.futures import ThreadPoolExecutor
raw = json.loads(open(sys.argv[1]).read())["result"]
data = json.loads(raw[raw.index("[{"): raw.rindex("}]") + 2])[0]["json_agg"]
vis = json.load(open(sys.argv[2]))
TOK = re.compile(r"\d+(?:[.,]\d+)?(?:/\d+)?|[^\W\d_]+")
def toks(s): return [t.lower().replace(",", ".") for t in TOK.findall(H.unescape(s))]
SPOON = {"lžíce": "T", "lžic": "T", "lžíci": "T", "pl": "T", "tbsp": "T", "lžička": "t", "lžičky": "t", "lžiček": "t", "lžičku": "t", "čl": "t", "tsp": "t"}
def one(r):
    try:
        _, _, p = get(r["url"]); _, rc = recipe(p)
    except Exception as e: return r["id"], [f"chyba {e}"[:60]]
    ing = (rc or {}).get("recipeIngredient") or []
    if isinstance(ing, str): ing = ing.split("\n")
    v = vis.get(r["url"], "")
    if not v or v.startswith("!!"): return r["id"], ["stránka sa nenačítala"]
    vt = toks(v); bad = []
    for x in ing:
        t = toks(x)
        if not t: continue
        nums = [a for a in t if a[0].isdigit()]
        words = sorted([a for a in t if not a[0].isdigit() and len(a) > 3 and a not in SPOON], key=len, reverse=True)[:2]
        kinds = {SPOON[a] for a in t if a in SPOON}
        if not words: continue
        ok, near = False, None
        for i, a in enumerate(vt):
            if a != words[0]: continue
            win = vt[max(0, i - 10): i + 12]
            near = near or " ".join(win)
            wk = {SPOON[b] for b in win if b in SPOON}
            if all(n in win for n in nums) and (not kinds or kinds & wk):
                # druh lyžice musí sedieť: ak v okne je len iný druh, je to rozdiel
                if kinds and wk and not (kinds <= wk): continue
                ok = True; break
        if not ok: bad.append(f"„{x.strip()}“  ⟂  stránka: …{near or '—'}…"[:260])
    return r["id"], bad
with ThreadPoolExecutor(10) as ex:
    for rid, bad in ex.map(one, data):
        for b in bad: print(f"XX {rid}: {b}")
