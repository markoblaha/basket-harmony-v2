# Širší výber adries (vzor + vylúčené obmeny), zoradený od najkratšieho názvu; max N na web.
import os
from pathlib import Path
# Pracovné dáta (zoznamy adries z webov, stiahnuté recepty, výsledky) nie sú v gite: priečinok KNIHA_DATA (predvolene tools/kniha/data).
DATA = Path(os.environ.get("KNIHA_DATA", Path(__file__).resolve().parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
os.chdir(DATA)
import json, re, unicodedata
SP=str(DATA)+"/"
def fold(s): return unicodedata.normalize("NFKD", s.lower()).encode("ascii","ignore").decode()
SITES={"apetit":r"apetitonline\.cz/recept/","toprecepty":r"toprecepty\.cz/recept/\d+","vareni":r"vareni\.cz/recepty/[^/]+/?$","labuznik":r"labuznik\.cz/recept/"}
idx={s:[u for u in json.load(open(SP+f"idx_{s}.json")) if re.search(p,u)] for s,p in SITES.items()}
idx["receptar"]=[u for u in open(SP+"receptar_urls.txt").read().split() if "/recepty/" in u]
L={
 "cesnakova":(r"cesnec|cesnekov\w*-polevk|cesnakov\w*-polievk",r"spanel|krab|krem|kroup|hliv|houb|jahl|cerven|instant|mobil|zoo|detsk|japon|kurec|fazol|cock|safran|pork|cibul|rajsk|vin|aljas|kastil|franc|zakys|parmaz|bagetk|knedl|mrkv|hrach|zel|klobas|uzen|vegan|bramborack|kari|histor|barbar|vojen|pikant|korenen|majorank|provens|fliac|odvaz|special|jitul|vylepsen|chlebov|svatecn"),
 "gulas":(r"^(hovezi|hovadzi)-gulas(?!ov)",r"houb|zampion|fazol|piv|med|jabl|repou|kapi|chili|mexic|dyn|okurk|hrask|jatr|knedl|kari|klobas|smetan|zakys|papin|ph$|-ph-|pomal|tlak|troub|zelen|celer|rajc|oregano|slanin|lehka|nejmens|porci|janin|acokc|tymian|vin|segedin|bramb|jinak|lubik|terk|lorn|majorank|divok|houb|rycl"),
 "rezen":(r"(smazen|vyprazan|veprov|bravcov|trojobal)\w*-(vepr\w*-)?(rizek|rizky|rezen|rezne)|^(rizek|rizky|rezen|rezne)$|^(rizek|rizky|rezen|rezne)-(smazen|vyprazan|veprov|bravcov|klasick|domac)",r"kurec|kurac|krut|morc|telec|syr|zelenin|celer|cuket|lilk|soj|tofu|kvetak|brokol|sampion|zampion|houb|parizsk|cornfl|chips|bramborak|lupin|mandl|orech|sezam|kari|kecup|pivn|slanin|ryb|kapr|tresk|losos|hermel|sunk|plnen|cordon|natural|prirodn|cesnek|horcic|vidensk|wiener|salat|pecen|troub|airfry|horkovz|bez-|fit|light|parmaz|pikant|mexic|chilli|chili|kmin"),
 "paprikas":(r"(kurec|kurac|kure|kurc)\w*-(paprikas|na-paprice|stehna-na-paprice)|^paprikas$|^kure-na-paprice",r"krut|morc|tlak|papin|rychl|zampion|houb|bez-smet|light|fit|cuket|vepr|telec|zverin|pomal|troub|jatr|srdick|zaludk|halusk|nokk|vegan|kari|chilli|cesnek"),
 "halusky":(r"bryndzov\w*-halusk",r"alergik|bezlep|spenat|cuket|vegan|kvetak|zemiakovo|kapust|pecen|zapec|torta|salat|recept-na-$"),
 "carbonara":(r"carbonar",r"kurec|kurac|losos|tun|cuket|chrest|brokol|hrask|houb|zampion|spenat|vegan|tofu|zelenin|gnocch|nok|pizz|rizot|salat|tortil|lasagn|krevet|dyn|cizrn|cock|smetan|pork|cesnek|klobas|sunk|parky|bez-|light|fit|celozrn|spald|zapek|zapec|mascarp|zeli|kapust|rybi|kvetak|ryz|brambor|bagety|chleb|polevk|cok|kari|lilk"),
 "salat":(r"(bramborov|zemiakov)\w*-salat",r"tepl|nemeck|bavor|vidensk|rakous|jogurt|bez-|light|fit|sled|tunak|losos|ryb|klobas|uzen|grilov|pecen|americk|francouz|reck|rusk|orient|rukol|avokad|cuket|reduk|dietn|vegan|zakysan|smetan|horcic|kopr|pazitk|chrest|olivov|ocet|octov|sunk|vajic|hrask|celer|lehk|slanin|majonezy|bez|sled|kraut|kapust|zeli|cervene|batat|sladk|moje-|nas-|svatec"),
 "palacinky":(r"^(palacinky|palacinkove-testo|testo-na-palacinky|zakladni-palacinky|tenke-palacinky|klasicke-palacinky|domaci-palacinky|palacinky-zakladni|palacinky-klasicke|palacinky-tenke|palacinky-domaci|babiccin\w*-palacinky|palacinky-od-babicky|palacinky-podle-babicky|jednoduche-palacinky|palacinky-jednoduche|nejlepsi-palacinky|tradicni-palacinky)(-\d+|-i+|-v)?$",r"$^"),
 "babovka":(r"^(babovka|mramorova-babovka|babovka-mramorova|klasicka-babovka|babovka-klasicka|domaci-babovka|babiccina-babovka|tradicni-babovka|nadychana-babovka|vlacna-babovka|kakaova-babovka|jednoducha-babovka|nejlepsi-babovka|babovka-od-babicky|babovka-podle-babicky|mramorovana-babovka|obycejna-babovka|klasicka-mramorova-babovka|tradicni-mramorova-babovka)(-\d+|-i+|-v)?$",r"$^"),
 "cheesecake":(r"cheesecake",r"nepec|bez-pec|nepecen|jahod|malin|boruvk|cokol|oreo|karamel|citron|limet|dyn|mango|tresn|visn|banan|kokos|matcha|kav|tiramisu|mini|kosick|tycink|rez|mufin|muffin|brownie|lotus|pistac|kesu|fit|vegan|bez-|zmrzl|lesn|ovoc|marakuj|merunk|broskv|jabl|hrus|svestk|kiwi|baileys|nutell|slan|kozi|sklenic|pohar|tvaroh|dort|jogurt|ricott|mascarp|keks|susenk|pern|mak|rebarb|vanoc|perni|skoric|puding|protein|bily|bile|cervent|rum|caj|chai|mrkv|hrnk|sneh|meruk|mandl|orech|lavend|rasp|blue|marbl|mramor|salted|kuk|med|kvark|sir|syrn|nebe|cuket|ruz|bram|pastel|cuprin|basque|baskick|japon|lehk")
}
N=35
out={}
for k,(pat,neg) in L.items():
    P=re.compile(pat); Q=re.compile(neg); res={}
    for s,us in idx.items():
        seen={}
        for u in us:
            slug=re.sub(r"^\d+-","",fold(u).split("?")[0].rstrip("/").split("/")[-1])
            key=fold(u).split("?")[0].rstrip("/")
            if P.search(slug) and not Q.search(slug) and key not in seen: seen[key]=(slug,u)
        res[s]=[u for _,(sl,u) in sorted(seen.items(),key=lambda kv:(len(kv[1][0].split("-")),len(kv[1][0])))][:N]
    out[k]=res
    print(f"{k:11}",{s:len(h) for s,h in res.items()}, sum(len(h) for h in res.values()))
json.dump(out,open("loose.json","w"),indent=1)
