# Úplné zostavenie aj s vytvorením ikon a obrázkov (potrebuje priečinok S so zdrojovými obrázkami a npm4 s @phosphor-icons/core).
# Bežne stačí prototyp/build.py.
import os, re, json, base64, io, subprocess, sys
from PIL import Image

S = os.environ['S']; P = S + '/proto'
PH = S + '/npm4/node_modules/@phosphor-icons/core/assets'
ESB = '/home/user/basket-harmony-v2/node_modules/.bin/esbuild'
src = ''.join(open(os.path.join(P, 'src', f)).read() for f in sorted(os.listdir(P + '/src')))

# ---------- ikony ----------
icons = set()
for m in re.finditer(r'<I\s+n="([\w-]+)"([^>]*)>', src):
    w = re.search(r'w="(\w+)"', m.group(2)); icons.add((m.group(1), w.group(1) if w else 'fill'))
for m in re.finditer(r'<IB\s+n="([\w-]+)"([^>]*)>', src):
    w = re.search(r'w="(\w+)"', m.group(2)); icons.add((m.group(1), w.group(1) if w else 'bold'))
for m in re.finditer(r'/\*\s*icons:([^*]+)\*/', src):
    for n in m.group(1).split():
        icons.add((n, 'fill')); icons.add((n, 'bold'))
for n in "check-circle trash warning-circle heart calendar-blank paint-brush prohibit timer info hand-swipe-right microphone shopping-cart receipt cooking-pot chart-pie caret-right arrow-counter-clockwise sun basket fork-knife wallet house plus pause check caret-up caret-down".split():
    icons.add((n, 'fill')); icons.add((n, 'bold')); icons.add((n, 'regular'))
out = {}; miss = []
for n, w in sorted(icons):
    f = f"{PH}/{w}/{n}{'' if w == 'regular' else '-' + w}.svg"
    if not os.path.exists(f): miss.append(f'{n}:{w}'); continue
    inner = re.sub(r'^<svg[^>]*>|</svg>$', '', open(f).read().strip())
    inner = re.sub(r'<rect width="256" height="256" fill="none"/>', '', inner)
    out[n if w == 'fill' else f'{n}:{w}'] = inner
if miss: print('CHÝBAJÚ IKONY:', [m for m in miss if not m.endswith(':regular')])
os.makedirs(P + '/gen', exist_ok=True)
open(P + '/gen/icons.js', 'w').write('export const ICONS = ' + json.dumps(out, ensure_ascii=False) + ';\n')

# ---------- emoji (WebP) ----------
avail = {}
for d in ('emoji', 'emoji2'):
    for f in os.listdir(S + '/' + d):
        avail.setdefault(f[:-4], S + '/' + d + '/' + f)
used = set(re.findall(r"""['"]([a-z0-9]+)['"]""", src)) & set(avail)
used |= set(re.findall(r'k="([a-z0-9]+)"', src)) & set(avail)
BIG = {'pot', 'rice', 'pancakes', 'poultry', 'curry', 'salad', 'spaghetti', 'fish', 'tomato', 'stew', 'sweetpotato', 'meat', 'carrot', 'bread', 'chicken', 'bowl', 'cart', 'bags', 'party', 'cooking'}
css = []
tot = 0
for k in sorted(used):
    im = Image.open(avail[k]).convert('RGBA')
    sz = 256 if k in BIG else 144
    im = im.resize((sz, sz), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=88, method=6)
    tot += b.tell()
    css.append(f'.em-{k}{{background-image:url(data:image/webp;base64,{base64.b64encode(b.getvalue()).decode()})}}')
print(f'emoji: {len(used)} ks, {tot // 1024} KB')

# ---------- fotky (WebP) ----------
PHOTOS = json.load(open(S + '/photos.json'))
EXTRA = {'p_paradajkova': 'photos2/1547592166-23ac45744acd.jpg', 'p_gulasova': 'photos2/1534939561126-855b8675edd7.jpg', 'p_strips': 'photos2/1569058242253-92a9c755a0ec.jpg',
         'p_tekvicova': 'photos2/1604152135912-04a022e23696.jpg', 'p_steak': 'photos2/1594041680534-e8c8cdebd659.jpg', 'p_zeleninova': 'photos2/1603105037880-880cd4edfb0d.jpg', 'p_toasty': 'photos2/1484723091739-30a097e8f929.jpg', 'x_rebra': 'photos/1544025162-d76694265947.jpg', 'x_spizy': 'photos/1555939594-58d7cb561ad1.jpg', 'x_kura': 'photos/1610057099443-fde8c4d50f91.jpg', 'x_kurwok': 'photos/1604908176997-125f25cc6f3d.jpg', 'x_rizoto': 'photos/1476124369491-e7addf5db371.jpg', 'x_krevety': 'photos/1563379926898-05f4575a45d8.jpg', 'x_cestsalat': 'photos/1473093295043-cdd812d0e601.jpg', 'x_pizza': 'photos/1565299624946-b28f40a0ae38.jpg', 'x_hrianka': 'photos/1525351484163-7529414344d8.jpg'}
NEW = {'n_' + f[:-4]: 'photos3/' + f for f in os.listdir(S + '/photos3') if f.endswith('.jpg')}
EXTRA.update(NEW)
EXTRA.update({'a_' + f[:-4]: 'aiph/' + f for f in os.listdir(S + '/aiph') if re.match(r'^[a-z]+\d\.png$', f)})
pics = set(re.findall(r"pic-([a-z0-9_]+)", src)) | set(re.findall(r"pic: '([a-z_]+)'", src)) | set(re.findall(r"'((?:x|p|n|a)_[a-z0-9]+)'", src))
pics = {p for p in pics if p in PHOTOS or p in EXTRA}
ptot = 0
for k in sorted(pics):
    raw = base64.b64decode(PHOTOS[k]) if k in PHOTOS else open(S + '/' + EXTRA[k], 'rb').read()
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    W = 820 if k.endswith('_p') else 720 if k.startswith('a_') else 640
    if im.width > W: im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=68 if k.startswith('a_') else 70, method=6); ptot += b.tell()
    css.append(f'.pic-{k}{{background-image:url(data:image/webp;base64,{base64.b64encode(b.getvalue()).decode()})}}')
print(f'fotky: {sorted(pics)}, {ptot // 1024} KB')
open(P + '/gen/assets.css', 'w').write('\n'.join(css))

# ---------- JS ----------
r = subprocess.run([ESB, P + '/src/main.jsx', '--bundle', '--format=iife', '--jsx-factory=React.createElement', '--jsx-fragment=React.Fragment',
                    '--loader:.js=jsx', '--target=es2020', '--minify', '--legal-comments=none', '--outfile=' + P + '/gen/app.js'], capture_output=True, text=True)
if r.returncode: print(r.stderr); sys.exit(1)
print(r.stderr.strip())

# ---------- HTML ----------
cssall = '\n'.join(open(P + '/css/' + f).read() for f in ('shell.css', 'base.css', 'w.css', 'g.css', 'polish.css')) + '\n' + open(P + '/gen/assets.css').read()
js = open(P + '/gen/app.js').read().replace('</script', '<\\/script')
html = f'''<title>Basket Harmony prototyp</title>
<meta name="description" content="Interaktívny prototyp aplikácie Basket Harmony v dvoch témach">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..800&family=Fraunces:opsz,wght@9..144,400..700&family=Inter:opsz,wght@14..32,400..800&display=swap">
<style>
{cssall}
</style>
<div id="root"><div class="boot">Načítavam prototyp…</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
{js}
</script>
'''
open(P + '/dist/basket-harmony-prototyp.html', 'w').write(html)
print('HTML', len(html) // 1024, 'KB')
