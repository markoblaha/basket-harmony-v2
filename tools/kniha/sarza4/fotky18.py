# Dočasné originálne fotky receptov (pokyn majiteľa 20. 11.): zo stránky zdroja stiahne až 3 fotky jedla
# (JSON-LD image, og:image, veľké obrázky v článku), uloží public/kniha/<id>-<n>.webp (1200 px) a <id>-1s.webp (480 px).
# Sú to len predlohy – neskôr ich nahradia vlastné fotky z Gemini a originály sa zmažú (image_status = 'source').
# Spustenie: python3 fotky18.py <súbor so zoznamom "id url" na riadok> <cieľový priečinok public/kniha>
import sys, re, json, io, html as H, urllib.request
from PIL import Image

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"}


def fetch(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


def candidates(page, base):
    out = []
    for m in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        try:
            data = json.loads(m.strip())
        except Exception:
            continue
        for o in walk(data):
            t = o.get("@type")
            if t == "Recipe" or (isinstance(t, list) and "Recipe" in t):
                img = o.get("image")
                for x in img if isinstance(img, list) else [img]:
                    if isinstance(x, dict):
                        x = x.get("url") or x.get("contentUrl")
                    if isinstance(x, str):
                        out.append(x)
    out += re.findall(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', page)
    # obrázky v obsahu (srcset → najväčší, data-src pri lenivom načítaní)
    for tag in re.findall(r"<img\b[^>]*>", page, re.S):
        srcset = re.search(r'(?:data-)?srcset="([^"]+)"', tag)
        if srcset:
            best = max((p.strip().split(" ") for p in srcset.group(1).split(",") if p.strip()), key=lambda p: int(re.sub(r"\D", "", p[1]) or 0) if len(p) > 1 else 0)
            out.append(best[0])
        src = re.search(r'(?:data-src|data-lazy-src|src)="([^"]+)"', tag)
        if src:
            out.append(src.group(1))
    seen, res = set(), []
    for u in out:
        u = H.unescape(u).strip()
        if u.startswith("//"):
            u = "https:" + u
        elif u.startswith("/"):
            u = re.match(r"https?://[^/]+", base).group(0) + u
        if not u.startswith("http") or re.search(r"logo|icon|avatar|sprite|placeholder|\.svg|\.gif|banner|author|profil", u, re.I):
            continue
        key = re.sub(r"[-_]\d+x\d+(?=\.\w+$)|\?.*$", "", u)
        if key not in seen:
            seen.add(key)
            res.append(u)
    return res


def save(raw, path, w):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=82)


def main(lst, out):
    for line in open(lst, encoding="utf-8"):
        if not line.strip():
            continue
        rid, url = line.split()
        try:
            page = fetch(url).decode("utf-8", "replace")
        except Exception as e:
            print(rid, "STRÁNKA ZLYHALA", e)
            continue
        got, sigs = 0, []
        for u in candidates(page, url):
            if got == 3:
                break
            try:
                raw = fetch(u)
                im = Image.open(io.BytesIO(raw))
            except Exception:
                continue
            if im.width < 500 or im.height < 330 or im.width / im.height > 2.6:
                continue  # malé obrázky, ikony a pásy nie sú fotky jedla
            sig = im.convert("L").resize((16, 16)).tobytes()
            if any(sum(abs(a - b) for a, b in zip(sig, s)) < 16 * 16 * 12 for s in sigs):
                continue  # ten istý záber v inej veľkosti
            sigs.append(sig)
            got += 1
            save(raw, f"{out}/{rid}-{got}.webp", 1200)
            if got == 1:
                save(raw, f"{out}/{rid}-1s.webp", 480)
            print(rid, got, im.width, "x", im.height, u[:110])
        print(rid, "SPOLU", got)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
