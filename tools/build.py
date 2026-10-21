#!/usr/bin/env python3
"""src/ の部品を1枚のHTMLにまとめます。

  python3 tools/build.py

出力:
  index.html                  GitHub Pages / 手元で開く用（様式ファイルは含まない・利用者が読み込む）
  apps-script/Index.html      Apps Script 用（同じ内容）
  dist/page-script.js         構文チェック用（node --check）
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(*p):
    with open(os.path.join(ROOT, *p), encoding='utf8') as f:
        return f.read()
def wr(text, *p):
    path = os.path.join(ROOT, *p)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as f:
        f.write(text)

HEAD = rd('src', 'head.html')
CSS = rd('src', 'style.css')
BODY = rd('src', 'body.html')
JSZIP = rd('vendor', 'jszip.min.js')
assert '</script' not in JSZIP.lower() and '<!--' not in JSZIP, 'jszip を <script> に埋め込めません'

PARTS = ['logic.js', 'template.js', 'case.js', 'core.js', 'render.js', 'actions.js']

def page_script(b64):
    js = ''.join(rd('src', f) for f in PARTS)
    tpl = ('const TPL_B64 = "' + b64 + '";\n') if b64 else 'const TPL_B64 = "";\n'
    return '(function(){\n"use strict";\n' + tpl + js + '\n})();\n'     # TPL_B64 は他の部品より先に定義する

def build(b64):
    ps = page_script(b64)
    html = ('<!doctype html>\n<html lang="ja">\n<head>\n' + HEAD + '<style>\n' + CSS + '\n</style>\n</head>\n<body>\n' + BODY +
            '<script>\n' + JSZIP + '\n</script>\n<script>\n' + ps + '</script>\n</body>\n</html>\n')
    return html, ps

html, ps = build('')
wr(html, 'index.html')
wr(html, 'apps-script', 'Index.html')
wr(ps, 'dist', 'page-script.js')
print('index.html', len(html.encode('utf8')), 'bytes（様式ファイルは含みません）')
