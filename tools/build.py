#!/usr/bin/env python3
"""src/ の部品を1枚のHTMLにまとめます。

  python3 tools/build.py

出力:
  index.html                  GitHub Pages / 手元で開く用（様式ファイルは含まない・利用者が読み込む）
  apps-script/Index.html      Apps Script 用（同じ内容）
  dist/Index.embedded.html    src/template-b64.js がある場合のみ。様式ファイルを内蔵した私用版（公開しない）
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

def embedded_b64():
    if not os.path.exists(os.path.join(ROOT, 'src', 'template-b64.js')):
        return ''
    m = re.search(r'const TPL_B64 = "([^"]*)"', rd('src', 'template-b64.js'))
    return m.group(1) if m else ''

html, ps = build('')
wr(html, 'index.html')
wr(html, 'apps-script', 'Index.html')
wr(ps, 'dist', 'page-script.js')
print('index.html', len(html.encode('utf8')), 'bytes（様式ファイルなし）')
b64 = embedded_b64()
if b64:
    h2, ps2 = build(b64)
    wr(h2, 'dist', 'Index.embedded.html')
    wr(ps2, 'dist', 'page-script.embedded.js')
    print('dist/Index.embedded.html', len(h2.encode('utf8')), 'bytes（様式ファイル内蔵・公開しない）')
