# Uloží vybrané fotky (pôvodná + zahraničné z zahranicie.py) do public/kniha/v2 a zapíše zdroje do fotky_zdroje_doplnene.json.
# Nová sada má nový názov súborov (<id>_z-N.webp), lebo service worker drží staré .webp v cache → treba zmeniť image_path.
#   python3 uloz_zahranicne.py <priečinok zahranicie> <id> "<výber>" <url z1> <url z2> …   výber napr. "z2 own z3"
import sys, json, os
from PIL import Image
D, rid, sel, urls = sys.argv[1], sys.argv[2], sys.argv[3].split(), sys.argv[4:]
OUT = "public/kniha/v2"
def save(im, p, w):
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(p, "WEBP", quality=88, method=6)
own = [f for f in (f"{OUT}/{rid}-1.webp", f"{OUT}/{rid}_b-1.webp") if os.path.exists(f)]
ims, z = [], []
for s in sel:
    if s == "own": ims.append(Image.open(own[0]).convert("RGB")); z.append("pôvodná fotka receptu")
    else: n = int(s[1:]); ims.append(Image.open(f"{D}/{rid}-z{n}.bin").convert("RGB")); z.append(urls[n - 1])
for k, im in enumerate(ims, 1):
    save(im, f"{OUT}/{rid}_z-{k}.webp", 2000)
    if k == 1: save(im, f"{OUT}/{rid}_z-1s.webp", 800)
p = "tools/kniha/sarza4/fotky_zdroje_doplnene.json"; zz = json.load(open(p)); zz[rid] = z; json.dump(zz, open(p, "w"), ensure_ascii=False, indent=1)
print(f"('{rid}', {len(ims)})")
