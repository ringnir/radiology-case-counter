# 専門医症例カウンター（radiology-case-counter）

放射線科専門医・診断専門医・治療専門医の申請に必要な症例数を数えて、**学会が配布している研修手帳の様式（経験症例記録のExcel）に書き込んで出力する**ためのWebアプリです。ビルド不要で、`index.html` を開くだけで動きます。

> 非公式のツールです。学会とは関係ありません。提出前に、出力されたExcelの内容は必ず目で確認してください。

## できること

- 症例を1件ずつ登録（検査日・区分・年齢・性別・部位・種別・診断名・疾患群の枠など）。患者ID・氏名・生年月日は扱いません
- 疾患群100枠をタップして割り当て、領域ごとの充足状況を表示
- 3つの専門医（専門医試験／診断／治療）ごとの進捗、入学年度、受験予定日、残り日数・不足件数・週あたりのペース
- 読影レポートの一覧（CSV/Excel）から、必要な列だけを読み込んで自動取り込み（患者情報の列は読まない）
- **研修手帳の様式に書き込んで出力**（書式・結合セル・入力規則は元のまま）
- 複数人での管理（Googleスプレッドシート＋Apps Script、Googleサイトに埋め込み可）。管理者は全員の進捗を閲覧し、入学年度で絞り込めます

## 使い方

### 1. 個人で使う（いちばん簡単）

`index.html` をブラウザで開く、または GitHub Pages で公開して開きます（Settings → Pages → Deploy from a branch → `main` / `(root)`）。

1. 「出力・バックアップ」タブで、**学会配布の様式ファイル（.xlsx）を一度だけ選ぶ**。このブラウザに保存されるので、次回からは不要です
2. 症例を登録する
3. 「様式に書き込んで出力」を押す

データはこのブラウザの中（localStorage）にだけ保存されます。ブラウザの設定を消すと失われるので、ときどき「バックアップ」（JSON）を保存してください。端末やブラウザを変えるときも、バックアップから復元できます。

### 2. 複数人で使う（Googleスプレッドシート＋Apps Script）

1. Googleドライブで新しい Apps Script プロジェクトを作る
2. `apps-script/Code.gs` と `apps-script/Index.html` を貼り付ける
3. `Code.gs` 冒頭の `ADMIN_PASSCODE`（8文字以上）と `JOIN_CODE`（6文字以上）を書き換える
4. 関数 `setup` を実行（初回は権限の承認が必要）
5. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」（実行: 自分／アクセス: 全員）
6. 表示されたURLを、Googleサイトの「埋め込み」→「URL」に貼る

メンバーは氏名＋自分のパスコード＋招待コードで登録します。データは管理者のドライブのスプレッドシートに保存され、管理者は全員分を閲覧できます。

**注意**: 管理者パスコードと招待コードは `Code.gs` に書く値です。書き換えたものを公開リポジトリに載せないでください（このリポジトリの `Code.gs` は空欄です）。

### 3. 様式を内蔵した私用版（公開しないこと）

毎回様式を選ぶのが面倒な場合、様式ファイルを埋め込んだ版を手元で作れます。

```
python3 tools/gen-template.py 様式.xlsx --embed
python3 tools/build.py          # dist/Index.embedded.html ができる
```

`dist/Index.embedded.html` には学会の様式が含まれるため、**公開リポジトリに置いたり、第三者に配布したりしないでください**。`.gitignore` で除外してあります。

## 様式ファイルについて

- このリポジトリには**様式ファイルそのものは含まれません**。各自が学会の配布物を読み込みます
- 読み込み時に、想定している様式かを確認します（9つのシート名、行数、疾患群・領域・放射線治療の部位の名前）。違う場合は理由を表示して受け付けません。**様式のバージョンが変わった**ときは、`python3 tools/gen-template.py 新しい様式.xlsx` で構造定義（`src/template.js`）を作り直し、`python3 tools/build.py` で再ビルドしてください
- アプリに入っているのは、100枠の番号・疾患群名・領域名など**様式の構造（データ）だけ**です
- 選んだ様式はブラウザの IndexedDB に保存され、外部には送られません。Googleサイト（Apps Script の埋め込み）の中など、ブラウザが保存を許さない環境では、開き直すたびに選び直しになります（画面にそう表示されます）

## 個人情報の扱い

- 患者ID・患者氏名・生年月日などの列は読み込みません（取り込み画面で列を選ぶ段階でも拒否）
- 診断名・依頼内容などの自由記述は、メールアドレス・ID様の数字列・「○○様」などを取り除いて保存します。それでも**個人が特定できる内容は書かない**でください
- 出力するExcelに患者IDは含まれません

## 開発

```
npm install
python3 tools/build.py                 # src/ → index.html, apps-script/Index.html
TPL_XLSX=/path/to/様式.xlsx CHROME=/path/to/chrome npm test
```

- `src/` が元のソースです（`head.html`・`body.html`・`style.css`・`logic.js`・`template.js`・`case.js`・`core.js`・`render.js`・`actions.js`）。`index.html` と `apps-script/Index.html` は**生成物**で、リポジトリにも含めてあります（GitHub Pages 用）
- 画面の部品は `vendor/jszip.min.js`（JSZip 3.10.1、MIT/GPLv3 のデュアルライセンス）をHTMLに埋め込んで使います。通常のExcel出力だけ SheetJS 0.18.5 を cdnjs から読み込みます（読めない場合はCSV出力にフォールバック）
- テストは3種類: `tests/logic.test.js`（ロジック）、`tests/server.test.js`（Apps Script側。モック）、`tests/e2e.js`（Playwright）。様式ファイルが必要な試験は、`TPL_XLSX` が無いと省略されます（`tests/fixtures/template.xlsx` に置いてもよい。コミットされません）
- `APP=dist/Index.embedded.html npm run test` のように `APP` を指定すると、様式内蔵版でe2eを実行できます
- `CHROME` は Chromium/Chrome の実行ファイル。未指定なら Playwright の既定を探します（`npx playwright-core install chromium` で入ります）

## 構成

```
index.html              生成物（GitHub Pages・手元で開く用。様式を含まない）
apps-script/            Googleスプレッドシート＋Apps Script 用（Code.gs / Index.html）
src/                    ソース
tools/build.py          src/ → HTML
tools/gen-template.py   様式.xlsx → 構造定義（src/template.js）
vendor/                 JSZip
tests/                  テスト
```

## ライセンス

[MIT License](LICENSE)。自由に使用・改変・再配布できます。無保証です。症例数の集計や出力の誤りによる不利益について、作者は責任を負いません。

同梱の JSZip（`vendor/`）は MIT または GPLv3 の二重ライセンスで、MIT を選んで使用しています。学会の研修手帳の様式（xlsx）は含まれず、その権利は配布元の学会に帰属します。
