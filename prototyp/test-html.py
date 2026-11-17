# Pre automatické testy: obalí prototyp do stránky prototyp/dist/test.html (spúšťa sa po build.py)
import os
P = os.path.dirname(os.path.abspath(__file__))
c = open(P + '/dist/basket-harmony-prototyp.html').read()
open(P + '/dist/test.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + c + '</body></html>')
os.makedirs(P + '/dist/shots', exist_ok=True)
