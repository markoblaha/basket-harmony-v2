# Nahrá recepty do databázy knihy (tabuľky book_*). Kľúč a adresa z prostredia (nikdy nie zo súboru v gite):
#   SUPABASE_URL, SUPABASE_SERVICE_KEY   (testovací projekt; ostrý len s výslovným súhlasom majiteľa)
# Použitie: nahraj.py <súbor.json s poľom receptov v tvare appky (Recipe)> [stav=published]
import os, sys, json, urllib.request
URL, KEY = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}
def post(table, rows, on):
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?on_conflict={on}", json.dumps(rows).encode(), H, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r: return r.status
recipes = json.load(open(sys.argv[1])); status = sys.argv[2] if len(sys.argv) > 2 else "published"
dishes, recs, srcs = [], [], []
for r in recipes:
    b = r["book"]; ch = b.get("check")
    dishes.append({"id": r["id"], "name_sk": r["name"], "category": r["category"], "cuisine": "SK-CZ", "status": "done"})
    recs.append({"id": r["id"], "dish_id": r["id"], "variant_key": "classic", "status": status, "batch": b.get("batch"), "name": r["name"],
        "category": r["category"], "meat": r["meat"], "cuisine": b.get("cuisine"), "minutes": r["minutes"], "active_minutes": b.get("active"),
        "difficulty": r["difficulty"], "portions": r["portions"], "scale": b.get("scale"), "portions_guess": bool(b.get("portionsGuess")),
        "tags": r.get("tags", []), "tools": b.get("tools", []), "store": b.get("store"), "wait": b.get("wait"),
        "ingredients": r["ingredients"], "steps": r["steps"], "check_data": ch, "verification": b.get("verification", {"kind": "full" if ch else "light"}),
        "image_path": f"/kniha/{r['id']}-1.webp" if b.get("photos") else None, "image_status": "batch_label" if b.get("batch") else "generated"})
    for s in b["sources"]:
        srcs.append({"recipe_id": r["id"], "k": s["k"], "site": s["site"], "name": s["name"], "url": s["url"],
                     "portions": (ch or {}).get("portions", {}).get(s["k"]), "rating": s.get("rating"), "votes": s.get("votes"), "is_anchor": bool(ch and ch.get("anchor") == s["k"])})
print("jedlá", post("book_dishes", dishes, "id"), "recepty", post("book_recipes", recs, "id"))
for i in range(0, len(srcs), 200): print("zdroje", post("book_sources", srcs[i:i + 200], "recipe_id,k"))
print("nahraté:", len(recs), "receptov,", len(srcs), "zdrojov")
