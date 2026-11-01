# Interaktívny prototyp ako samostatná stránka v testovacej appke: public/prototyp/index.html
# Cloudflare ho potom ukáže na adrese …/prototyp/ (dá sa pridať na plochu telefónu ako appka).
# Spustenie: python3 prototyp/build.py && python3 prototyp/web.py
import os, json
P = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(P, '..', 'public', 'prototyp')
os.makedirs(OUT, exist_ok=True)
body = open(P + '/dist/basket-harmony-prototyp.html').read()
head = '''<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BH prototyp">
<meta name="theme-color" content="#111111">
<meta name="robots" content="noindex">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="manifest" href="/prototyp/manifest.webmanifest">
<style>
html, body { margin: 0; height: 100%; background: #111; }
/* v telefóne: hlavička a spodná lišta ustúpia výrezu displeja a pásiku na spodku */
.app:not(.framed) { --sat: max(10px, env(safe-area-inset-top, 0px)); --sab: max(12px, env(safe-area-inset-bottom, 0px)); }
.intro { padding-top: max(24px, env(safe-area-inset-top, 0px)) !important; }
</style>
</head>
<body>
'''
open(os.path.join(OUT, 'index.html'), 'w').write(head + body + '\n</body>\n</html>\n')
manifest = {
  "name": "Basket Harmony – prototyp", "short_name": "BH prototyp", "lang": "sk",
  "start_url": "/prototyp/", "scope": "/prototyp/", "display": "standalone", "orientation": "portrait",
  "background_color": "#111111", "theme_color": "#111111",
  "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"}],
}
open(os.path.join(OUT, 'manifest.webmanifest'), 'w').write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('public/prototyp/index.html', os.path.getsize(os.path.join(OUT, 'index.html')) // 1024, 'KB')
