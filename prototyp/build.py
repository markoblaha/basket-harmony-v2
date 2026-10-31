# Zostaví prototyp do jedného HTML súboru: prototyp/dist/basket-harmony-prototyp.html
# Ikony a obrázky sú už vložené v gen/icons.js a gen/assets.css. build_full.py ich vie vytvoriť
# nanovo zo zdrojových obrázkov (tie v repozitári nie sú, boli v dočasnom priečinku relácie).
import os, subprocess, sys
P = os.path.dirname(os.path.abspath(__file__))
ESB = os.path.join(P, '..', 'node_modules', '.bin', 'esbuild')
os.makedirs(P + '/dist', exist_ok=True)
r = subprocess.run([ESB, P + '/src/main.jsx', '--bundle', '--format=iife', '--jsx=transform', '--tsconfig-raw={}', '--jsx-factory=React.createElement', '--jsx-fragment=React.Fragment',
                    '--loader:.js=jsx', '--target=es2020', '--minify', '--legal-comments=none', '--outfile=' + P + '/gen/app.js'], capture_output=True, text=True)
if r.returncode: print(r.stderr); sys.exit(1)
css = '\n'.join(open(P + '/css/' + f).read() for f in ('shell.css', 'base.css', 'w.css', 'g.css')) + '\n' + open(P + '/gen/assets.css').read()
js = open(P + '/gen/app.js').read().replace('</script', '<\\/script')
os.remove(P + '/gen/app.js')
html = f'''<title>Basket Harmony prototyp</title>
<meta name="description" content="Interaktívny prototyp aplikácie Basket Harmony v dvoch témach">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..800&family=Fraunces:opsz,wght@9..144,400..700&family=Inter:opsz,wght@14..32,400..800&display=swap">
<style>
{css}
</style>
<div id="root"><div class="boot">Načítavam prototyp…</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
{js}
</script>
'''
open(P + '/dist/basket-harmony-prototyp.html', 'w').write(html)
print('HTML', len(html) // 1024, 'KB → prototyp/dist/basket-harmony-prototyp.html')
