# Výber doplnených fotiek (ručne z kontaktných hárkov dopln_fotky.py). „own“ = pôvodná fotka receptu, kN = kandidát N.
# Malá vlastná fotka (< 1000 px) ide na druhé miesto, pri extrémne malej (buchty, 500 px) sa vynechá.
# Spustenie: python3 vyber_doplnenych.py <priečinok dopln_fotky> → prepíše public/kniha/v2/<id>-N.webp, vypíše SQL
import sys, io, json, os
from PIL import Image
D = sys.argv[1]; OUT = "public/kniha/v2"
VYBER = {
 "japonsky_cheesecake": "own k2 k3", "jogurtovy_cheesecake": "own k2", "kokosovy_cheesecake_biela_cokolada": "own k1",
 "malinovy_cheesecake": "own k6 k3", "nepeceny_cokoladovy_cheesecake": "own k2", "nepeceny_cucoriedkovy_cheesecake": "own k2",
 "pistaciovy_cheesecake": "own k1 k3", "amaretto_cheesecake_slany_karamel": "own k1 k2", "levandulovy_cheesecake_cucoriedky": "own k2 k3",
 "matcha_cheesecake_lotus": "own k2 k3", "ricotta_cheesecake": "own k2", "brownies": "own k2 k4",
 "bublanina": "k1 own k3", "cokoladova_torta": "own k3 k6", "jablkova_strudla": "own k1 k4", "jablkovy_kolac": "k6 own k4",
 "kremes": "own k2", "mramorova_babovka": "own k4", "mrkvova_torta": "own k4 k3", "orechova_torta": "k2 own k3",
 "sacherova_torta": "k2 own k1", "schwarzwaldska_torta": "own k2", "tvarohovy_kolac": "own k1 k3", "buchty": "k1 k4 k5",
 "cokoladova_pena": "own k2 k4", "kokosky": "k6 own k3", "kysnuty_kolac": "k2 own k4", "linecke_kolieska": "own k1",
 "makovnik": "own k5", "medovnicky": "own k4 k1", "orechovnik": "own k5 k4", "rumove_gulky": "own k3 k4",
 "skoricove_slimaky": "own k1 k2", "tiramisu": "k5 own k6", "trubicky": "own k2", "vanilkove_rozky": "k4 own k5",
}
src = json.load(open(f"{D}/zdroje.json")); zdroje = {}
def save(im, p, w):
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(p, "WEBP", quality=88, method=6)
sql = []
for rid, sel in VYBER.items():
    own = Image.open(f"{OUT}/{rid}-1.webp").convert("RGB"); ims = []; z = []
    for s in sel.split():
        if s == "own": ims.append(own); z.append("pôvodná fotka receptu")
        else: n = int(s[1:]); ims.append(Image.open(f"{D}/{rid}-k{n}.bin").convert("RGB")); z.append(src[rid][n - 1])
    for k, im in enumerate(ims, 1):
        save(im, f"{OUT}/{rid}-{k}.webp", 2000)
        if k == 1: save(im, f"{OUT}/{rid}-1s.webp", 800)
    zdroje[rid] = z; sql.append(f"('{rid}', {len(ims)})")
json.dump(zdroje, open("tools/kniha/sarza4/fotky_zdroje_doplnene.json", "w"), ensure_ascii=False, indent=1)
print("update book_recipes r set image_count = v.n from (values " + ", ".join(sql) + ") v(id, n) where r.id = v.id;")
