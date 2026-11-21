# Šarža 6: uloží vybrané fotky 14 cheesecakov (výber z kontaktných hárkov) do public/kniha/v2/<id>-<n>.webp + <id>-1s.webp.
# Spustenie: python3 fotky_cheesecake15.py <priečinok so stiahnutými kandidátmi> <public/kniha/v2>
import sys, io, json, os
from PIL import Image
S, OUT = sys.argv[1], sys.argv[2]
VYBER = {  # id receptu → súbory kandidátov v poradí (prvá = titulná)
 "cheesecake_s_figami": ["ccold/cheesecake_s_figami-3", "ccold/cheesecake_s_figami-0", "ccold/cheesecake_s_figami-4"],
 "cheesecake_s_hruskami_zazvorom": ["ccold/cheesecake_s_hruskami_zazvorom-1", "ccold/cheesecake_s_hruskami_zazvorom-3", "ccold/cheesecake_s_hruskami_zazvorom-2"],
 "tekvicovy_cheesecake": ["ccold/tekvicovy_cheesecake-3", "ccold/tekvicovy_cheesecake-0", "ccold/tekvicovy_cheesecake-4"],
 "tvarohove_mini_cheesecaky_s_lekvarom": ["ccold/tvarohovy_cheesecake_s_lekvarom-0", "ccold/tvarohovy_cheesecake_s_lekvarom-5", "ccold/tvarohovy_cheesecake_s_lekvarom-3"],
 "mini_cheesecaky_so_slivkovou_omackou": ["ccold/cheesecake_so_slivkovou_omackou-0", "ccold/cheesecake_so_slivkovou_omackou-3", "ccold/cheesecake_so_slivkovou_omackou-5"],
 "vanilkovy_cheesecake_pena_biela_cokolada": ["ccold/vanilkovy_cheesecake_pena_biela_cokolada-0", "ccold/vanilkovy_cheesecake_pena_biela_cokolada-1", "ccold/vanilkovy_cheesecake_pena_biela_cokolada-3"],
 "cheesecake_s_cokoladovou_penou": ["ccold/cheesecake_s_cokoladovou_penou-0", "ccold/cheesecake_s_cokoladovou_penou-2", "ccold/cheesecake_s_cokoladovou_penou-1"],
 "mini_cheesecaky_arasidove_maslo": ["ccold/mini_cheesecakes_arasidove_maslo-2", "ccold/mini_cheesecakes_arasidove_maslo-0", "ccold/mini_cheesecakes_arasidove_maslo-3"],
 "mini_cheesecaky_citronovy_krem": ["ccold/mini_cheesecakes_citronovy_krem-1", "ccold/mini_cheesecakes_citronovy_krem-0", "ccold/mini_cheesecakes_citronovy_krem-4"],
 "cheesecake_s_jahodami_rebarborou": ["cc15/09-1", "cc15/09-4", "cc15/09-3"],
 "ricotta_cheesecake": ["cc15/11-1"], "amaretto_cheesecake_slany_karamel": ["cc15/12-1"],
 "levandulovy_cheesecake_cucoriedky": ["cc15/13-1"], "matcha_cheesecake_lotus": ["cc15/14-1"],
}
def save(im, path, w):
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=88, method=6)
for rid, files in VYBER.items():
    for n, f in enumerate(files, 1):
        im = Image.open(f"{S}/{f}.bin").convert("RGB")
        save(im, f"{OUT}/{rid}-{n}.webp", 2000)
        if n == 1: save(im, f"{OUT}/{rid}-1s.webp", 800)
    print(rid, len(files))
