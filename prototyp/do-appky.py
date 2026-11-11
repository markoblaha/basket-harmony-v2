# Prenesie vzhľad mockupu do skutočnej appky 1:1 (mockup je jediný vzor).
#
# Vytvorí (súbory sa necommitujú ručne upravené – vždy sa generujú odtiaľto):
#   src/mockup/mockup.css  – štýly mockupu (shell.css bez rámu telefónu, base, w, g, polish),
#                            obmedzené na prenesené časti appky (obal .bhm), animácie s predponou mk-
#   src/mockup/icons.ts    – ikony Phosphor z prototyp/gen/icons.js
#   src/mockup/assets.css  – 3D emoji (.em-*) a fotky (.pic-*) ako odkazy na súbory
#   public/mk/em/*.webp, public/mk/pic/*.webp – samotné obrázky (stiahnu sa, až keď sú na obrazovke)
#
# Ako to funguje v appke: na <html> je trieda témy (w / g) a pri tmavom režime t-d – presne ako
# na .app v mockupe. Časť appky prenesená z mockupu je v obale <div class="bhm">, ktorý v mockupe
# zodpovedá .app. Staré obrazovky (ešte neprenesené) sú mimo obalu, štýly mockupu ich neovplyvnia.
#
# Spustenie: python3 prototyp/do-appky.py
import base64, os, re

P = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(P)
OUT = os.path.join(ROOT, 'src', 'mockup')
PUB = os.path.join(ROOT, 'public', 'mk')
os.makedirs(OUT, exist_ok=True)

THEME = {'w', 'g', 't-d', 't-l'}
# Rám telefónu a panel vedľa neho (shell.css) do appky nepatria.
SKIP = re.compile(r'^(html|body|#root|:root|\.boot|\.desk|\.phone-|\.dev\b|\.sbar|\.panel|\.p-[a-z])')


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def blocks(css):
    """Rozdelí CSS na (hlavička, telo) na najvyššej úrovni; telo môže obsahovať vnorené bloky."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        out.append((head, css[j + 1:k - 1]))
        i = k
    return out


def split_selectors(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur.strip())
            cur = ''
        else:
            cur += ch
    parts.append(cur.strip())
    return [p for p in parts if p]


def first_compound(sel):
    """Prvá zložená časť selektora (po prvú medzeru/kombinátor mimo zátvoriek)."""
    depth = 0
    for i, ch in enumerate(sel):
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        elif depth == 0 and ch in ' >+~':
            return sel[:i], sel[i:]
    return sel, ''


def theme_classes(compound):
    found = [c for c in re.findall(r'\.([\w-]+)', compound) if c in THEME]
    rest = compound
    for c in found:
        rest = re.sub(r'\.' + re.escape(c) + r'(?![\w-])', '', rest)
    return ''.join('.' + c for c in found), rest


def scope(sel):
    sel = re.sub(r'\.app(?![\w-])', '.bhm', sel)
    first, rest = first_compound(sel)
    themes, first_rest = theme_classes(first)
    if re.search(r'\.bhm(?![\w-])', sel):
        # .bhm.t-d #x → .t-d .bhm #x (téma je na <html>, nie na obale)
        if themes and re.search(r'\.bhm(?![\w-])', first):
            return themes + ' ' + first_rest + rest
        return sel
    if themes and not first_rest:
        if not rest.strip():
            return sel  # samotná téma (.w, .g.t-d) = premenné na <html>
        return themes + ' .bhm' + rest
    if themes:
        return themes + ' .bhm ' + first_rest + rest
    return '.bhm ' + sel


def transform(css, keyframes):
    out = []
    for head, body in blocks(css):
        if head.startswith('@property') or head.startswith('@font-face'):
            out.append('%s {%s}' % (head, body))
        elif head.startswith('@keyframes'):
            name = head.split()[1]
            out.append('@keyframes mk-%s {%s}' % (name, body))
        elif head.startswith('@media') or head.startswith('@supports'):
            inner = transform(body, keyframes)
            if inner.strip():
                out.append('%s {\n%s\n}' % (head, inner))
        else:
            sels = [s for s in split_selectors(head) if not SKIP.match(s)]
            if not sels:
                continue
            out.append('%s {%s}' % (', '.join(scope(s) for s in sels), rename_anims(body, keyframes)))
    return '\n'.join(out)


def rename_anims(body, keyframes):
    def fix(m):
        prop, val = m.group(1), m.group(2)
        for k in keyframes:
            val = re.sub(r'(?<![\w-])' + re.escape(k) + r'(?![\w-])', 'mk-' + k, val)
        return prop + val
    return re.sub(r'(animation(?:-name)?\s*:)([^;}]*)', fix, body)


css = ''
for f in ('shell.css', 'base.css', 'w.css', 'g.css', 'polish.css'):
    css += '\n' + strip_comments(open(os.path.join(P, 'css', f)).read())
# písma sú v appke pod menami balíkov @fontsource-variable
css = css.replace('"DM Sans"', '"DM Sans Variable", "DM Sans"').replace('"Fraunces"', '"Fraunces Variable", "Fraunces"').replace('"Inter"', '"Inter Variable", "Inter"')
keyframes = sorted(set(re.findall(r'@keyframes\s+([\w-]+)', css)), key=len, reverse=True)
scoped = transform(css, keyframes)
header = '/* VYGENEROVANÉ z prototyp/css (shell, base, w, g, polish) skriptom prototyp/do-appky.py – needitovať ručne. */\n'
open(os.path.join(OUT, 'mockup.css'), 'w').write(header + scoped + '\n')

# ikony
icons = open(os.path.join(P, 'gen', 'icons.js')).read()
icons = re.sub(r'^export const ICONS\s*=\s*', 'export const ICONS: Record<string, string> = ', icons.strip(), flags=re.M)
open(os.path.join(OUT, 'icons.ts'), 'w').write('// VYGENEROVANÉ z prototyp/gen/icons.js skriptom prototyp/do-appky.py – ikony Phosphor (cesty SVG 256 × 256).\n' + icons + '\n')

# obrázky
assets = open(os.path.join(P, 'gen', 'assets.css')).read()
lines = []
for sel, kind, data in re.findall(r'\.((?:em|pic)-[\w-]+)\{background-image:url\(data:image/(\w+);base64,([^)]+)\)\}', assets):
    folder = 'em' if sel.startswith('em-') else 'pic'
    name = sel.split('-', 1)[1]
    os.makedirs(os.path.join(PUB, folder), exist_ok=True)
    open(os.path.join(PUB, folder, name + '.' + kind), 'wb').write(base64.b64decode(data))
    # Fotky (pic-) s :root – inak ich v appke prebije napr. „.bhm .th { background: … }“ (štýly mockupu tam majú .bhm navyše).
    lines.append('%s.%s { background-image: url("/mk/%s/%s.%s"); }' % (':root ' if folder == 'pic' else '', sel, folder, name, kind))
open(os.path.join(OUT, 'assets.css'), 'w').write('/* VYGENEROVANÉ z prototyp/gen/assets.css skriptom prototyp/do-appky.py. */\n' + '\n'.join(lines) + '\n')
print('mockup.css', len(scoped) // 1024, 'KB ·', len(lines), 'obrázkov ·', len(keyframes), 'animácií')

# katalóg z mockupu: produkty (názov, synonymá, 3D emoji, kategória), kategórie a obchody – na ikony skutočných položiek
import json, shutil, subprocess, tempfile
tmp = tempfile.mkdtemp()
shutil.copy(os.path.join(P, 'src', 'data.js'), os.path.join(tmp, 'data.mjs'))
dump = subprocess.run(['node', '-e', 'import(process.argv[1]).then((m) => process.stdout.write(JSON.stringify({ products: Object.values(m.PRODUCTS).map((p) => ({ n: p.n, syn: p.syn, e: p.e, c: p.c })), cats: m.CATS, stores: m.STORES, recipes: m.RECIPES.map((r) => ({ id: r.id, n: r.n, e: r.e, pic: r.pic || null, bg: r.bg })) })))', os.path.join(tmp, 'data.mjs')], capture_output=True, text=True, check=True).stdout
cat = json.loads(dump)
open(os.path.join(OUT, 'catalog.ts'), 'w').write(
    '// VYGENEROVANÉ z prototyp/src/data.js skriptom prototyp/do-appky.py – 3D emoji produktov, kategórie a farby obchodov z mockupu.\n'
    'export const PRODUCTS: { n: string; syn: string; e: string; c: string }[] = ' + json.dumps(cat['products'], ensure_ascii=False) + ';\n'
    'export const CATS: Record<string, { n: string; e: string; col: string }> = ' + json.dumps(cat['cats'], ensure_ascii=False) + ';\n'
    'export const STORES: Record<string, { n: string; s: string; c1: string; c2: string }> = ' + json.dumps(cat['stores'], ensure_ascii=False) + ';\n'
    'export const RECIPES: { id: string; n: string; e: string; pic: string | null; bg: string }[] = ' + json.dumps(cat['recipes'], ensure_ascii=False) + ';\n')
print('catalog.ts', len(cat['products']), 'produktov')
