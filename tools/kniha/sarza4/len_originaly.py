# Len originálne fotky receptu (pokyn majiteľa 21. 11.: „nová fotografia musí byť rovnaká ako reálny originál receptu,
# nemôže to byť iná torta alebo iný koláč“). Zo sád fotiek vyhodí tie, ktoré pochádzajú z iného receptu (podľa
# fotky_zdroje_doplnene.json a fotky_zdroje_cheesecake25.json) a nechá len fotky zo stránky pôvodného receptu.
# Nová sada má koncovku _o (service worker drží staré súbory v cache). Vypíše SQL na úpravu image_path/image_count.
#   python3 len_originaly.py <scratchpad s pôvodnými .bin fotkami>
import sys, os, json, glob
from PIL import Image
S = sys.argv[1]; OUT = "public/kniha/v2"; HERE = os.path.dirname(os.path.abspath(__file__))
def base(rid):
    for suf in ("_z", "_b", ""):
        if os.path.exists(f"{OUT}/{rid}{suf}-1.webp"): return f"{OUT}/{rid}{suf}"
def save(im, p, w):
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(p, "WEBP", quality=88, method=6)
own_bin = {}
for f in glob.glob(f"{S}/*/*-1.bin"):
    own_bin.setdefault(os.path.basename(f)[:-6], f)
own_bin.update({"tvarohova_vianocka": f"{S}/k1/_tv.bin", "lotus_kosicky": f"{S}/z1/karamelove_kosicky-1.bin"})
plan = {}
d = json.load(open(f"{HERE}/fotky_zdroje_doplnene.json"))
for rid, lst in d.items():
    keep = [i for i, x in enumerate(lst, 1) if x == "pôvodná fotka receptu"]
    if len(keep) == len(lst): continue
    plan[rid] = ("disk", keep)
c = json.load(open(f"{HERE}/fotky_zdroje_cheesecake25.json"))
for rid, lst in c.items():
    if rid in plan: continue
    keep = [i for i, x in enumerate(lst, 1) if "name" not in x]
    if len(keep) == len(lst): continue
    plan[rid] = ("disk", keep)
sql, chyba = [], []
for rid, (_, keep) in plan.items():
    b = base(rid); ims = []
    for i in keep:
        p = f"{b}-{i}.webp"
        if os.path.exists(p): ims.append(Image.open(p).convert("RGB"))
    if not ims and rid in own_bin: ims = [Image.open(own_bin[rid]).convert("RGB")]
    if not ims: chyba.append(rid); continue
    for k, im in enumerate(ims, 1):
        save(im, f"{OUT}/{rid}_o-{k}.webp", 2000)
        if k == 1: save(im, f"{OUT}/{rid}_o-1s.webp", 800)
    sql.append(f"('{rid}',{len(ims)})")
print("-- bez originálnej fotky:", chyba)
print("update book_recipes r set image_path = '/kniha/v2/' || v.id || '_o-1.webp', image_count = v.n, verification = jsonb_set(verification, '{photos,note}', '\"len originálne fotky zo stránky receptu\"') from (values " + ",".join(sql) + ") v(id,n) where r.id = v.id;")
