# 開発者向けの資料

アプリを改造する人・自分のリポジトリで管理する人向けの資料です。使うだけの人は、読まなくて構いません。

## 目次

- [しくみ](#しくみ)
- [準備](#準備)
- [ビルド](#ビルド)
- [テスト](#テスト)
- [様式のバージョンが変わったとき](#様式のバージョンが変わったとき)
- [画面キャプチャ・図の作り直し](#画面キャプチャ図の作り直し)
- [ファイル構成](#ファイル構成)
- [様式（Excel）を同梱しない約束](#様式excelを同梱しない約束)

---

## しくみ

- アプリは、**1枚のHTML**（`index.html`）で動きます。サーバーは要りません。データは、ブラウザの localStorage に保存されます
- ソースは `src/` に分けてあり、`tools/build.py` が、1枚のHTMLにまとめます（CSS・JavaScript・JSZipを、すべて埋め込みます）
- 複数人用は、同じHTMLを、Apps Script の `Index.html` として使います。サーバー側は `apps-script/Code.gs` です。ブラウザからは `google.script.run` で呼びます（Apps Script の中でだけ使えます）
- 様式（Excel）への書き込みは、ブラウザの中で、JSZipで xlsx の中身（XML）を直接書き換えて行います。**元の書式・結合セル・入力規則は、そのまま残ります**
- 様式の**構造**（100枠の番号・疾患群名・領域名など）は、`src/template.js` にデータとして入っています。**様式のファイルそのものは、入っていません**

## 準備

必要なもの：Python 3、Node.js、Chromium（またはChrome）。

```
npm install
```

- 試験用のブラウザは、環境変数 `CHROME` で、実行ファイルの場所を指定できます。未指定なら、Playwright の既定の場所を探します（`npx playwright-core install chromium` で入ります）

## ビルド

```
python3 tools/build.py      # または npm run build
```

| 出力 | 内容 |
|---|---|
| `index.html` | GitHub Pages・手元で開く用 |
| `apps-script/Index.html` | Apps Script 用（中身は同じ） |
| `dist/page-script.js` | 構文チェック用（`node --check`）。`.gitignore` で除外 |

`index.html` と `apps-script/Index.html` は**生成物**ですが、GitHub Pages のために、リポジトリにも含めます。`src/` を直したら、**必ずビルドし直して**ください。

## テスト

```
npm test
```

`npm test` は、ビルドしたあとに、次の4つを順に実行します。

| ファイル | 内容 | 様式ファイル |
|---|---|---|
| `tests/no-template.test.js` | 配布物・リポジトリに、様式（Excel）が混ざっていないことの検査 | 不要 |
| `tests/logic.test.js` | 集計・取り込み・日付などのロジック | 不要 |
| `tests/server.test.js` | `Code.gs`（Apps Script側）の試験。Googleのサービスは、モックで代用 | 不要 |
| `tests/e2e.js` | ブラウザ（Playwright）での、画面の操作の試験 | 一部の試験に必要 |

### 様式ファイルが必要な試験

様式への書き込みの試験は、配布されている様式のExcelが手元にあるときだけ動きます。**ファイルの場所を、環境変数で指定してください**（なければ、その試験は省略されます）。

```
TPL_XLSX=/path/to/基本領域の様式.xlsx \
TPL_DIAG=/path/to/診断専攻医研修手帳.xlsx \
TPL_RT=/path/to/治療専攻医研修手帳.xlsx \
CHROME=/path/to/chrome \
npm test
```

| 環境変数 | 内容 |
|---|---|
| `TPL_XLSX` | 放射線科専門医（基本領域）の経験症例記録 |
| `TPL_DIAG` | 診断専門医の専攻医研修手帳 |
| `TPL_RT` | 治療専門医の専攻医研修手帳 |
| `CHROME` | Chromium/Chrome の実行ファイル |

`tests/fixtures/` に、`template.xlsx`・`diag.xlsx`・`rt.xlsx` の名前で置いても使われます。この置き場は `.gitignore` で除外してあり、コミットされません。

## 様式のバージョンが変わったとき

学会・機構が様式を改訂して、アプリが「想定している様式ではありません」と判定するようになったときの手順です。

1. 新しい様式の、**構造定義**を作り直す（基本領域の様式の場合）

   ```
   python3 tools/gen-template.py 新しい様式.xlsx
   ```

   `src/template.js`（100枠の番号・疾患群名・領域名など、**構造だけ**）が、書き換わります。**様式ファイルそのものは、出力されません。**
2. ビルドして、試験を通す

   ```
   python3 tools/build.py
   TPL_XLSX=新しい様式.xlsx npm test
   ```
3. 診断・治療の手帳は、`src/case.js` の、様式の定義（シート名・書き込みを始める行・行数の上限・見出しの照合）を、新しい様式に合わせて直します。シート名や見出しの位置は、新しい様式を Excel や openpyxl で開いて、確認してください
4. 変更を、[GitHubに反映](github.md#変更して更新する)する。**様式ファイルは、コミットしないでください**

## 画面キャプチャ・図の作り直し

[README](../README.md) や各資料の画像は、`docs/images/` にあります。**アプリの画面は、実際の画面を、架空のデモデータで撮ったもの**です。**Google側の画面（Apps Script のエディタなど）は、模式図**です（実際の画面とは見た目が違います）。

| 画像 | 作り方 |
|---|---|
| `app-*.png`、`gas-login.png`、`gas-register.png`、`gas-admin-*.png`、`gas-member.png`（アプリの画面） | `npm run shots` |
| `gas-overview.png`、`gas-steps.png`、`gas-editor.png`、`gas-code-edit.png`、`gas-add-html.png`、`gas-permission.png`、`gas-deploy.png`、`gas-update.png`、`gas-sites.png`（模式図） | `node tools/render-diagrams.js`（元は `tools/diagrams/diagrams.html`） |

- `npm run shots` は、`tests/shots.js` で撮ります。デモデータは、疑似乱数を固定してあるので、毎回同じ内容になります。患者さん・実在の人の情報は使いません
- 様式を読み込んだ状態の画面（出力タブ）は、`TPL_XLSX`・`TPL_DIAG`・`TPL_RT` を指定したときだけ撮れます。写るのは、ファイル名と件数だけで、**様式の中身は写りません**
- Googleの画面は、更新で見た目が変わります。模式図の文言や位置は、`tools/diagrams/diagrams.html` を直して、作り直してください
- 画像の容量を減らすには、ImageMagick で、色数を減らせます（例：`convert 元.png -dither None -colors 160 -strip PNG8:出力.png`）

## ファイル構成

```
index.html              生成物（GitHub Pages・手元で開く用。様式を含まない）
apps-script/
  Code.gs               Apps Script のサーバー側（管理者パスコード・招待コードは空欄のまま）
  Index.html            生成物（index.html と同じ内容）
src/
  head.html body.html style.css   画面の骨組み・スタイル
  logic.js              集計・取り込み・日付などのロジック（画面に依存しない）
  template.js           様式の構造データ（100枠など。様式ファイルは含まない）
  case.js               症例のデータ構造、様式への書き込み
  core.js               保存（localStorage / Apps Script）、状態管理
  render.js actions.js  画面の描画、操作
docs/                   使い方ガイド・Apps Script の手順・根拠にした資料・この資料
  images/               画面キャプチャ・模式図
tools/
  build.py              src/ → index.html, apps-script/Index.html
  gen-template.py       様式.xlsx → 構造定義（src/template.js）
  render-diagrams.js    模式図 → docs/images/gas-*.png
  diagrams/             模式図のソース
tests/                  テスト（no-template / logic / server / e2e）と、画面キャプチャの生成
vendor/                 JSZip（MIT または GPLv3 のデュアルライセンス。MITを選んで使用）
```

## 様式（Excel）を同梱しない約束

学会・機構の様式ファイルの権利は、配布元にあります。このリポジトリは、**様式を、どの形でも同梱しません**（ファイル・base64・ビルド出力のどれも）。

- `.gitignore` が、`*.xlsx`・`dist/`・`tests/out/`・`tests/fixtures/*` を除外します
- ビルドは、様式を埋め込む出力を、**持ちません**（`index.html` の `TPL_B64` は、いつも空です）
- `tests/no-template.test.js` が、`npm test` のたびに、配布するHTMLとソースに、xlsx（zip）のbase64が混ざっていないこと、リポジトリが追跡するファイルにExcel・zip形式のものが無いことを、検査します
- 様式を使う人は、**ブラウザで、自分で様式ファイルを選びます**（ブラウザの IndexedDB に保存され、外部には送られません）
