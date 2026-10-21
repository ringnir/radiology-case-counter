# 専門医症例カウンター（radiology-case-counter）

放射線科専門医・診断専門医・治療専門医の申請に必要な症例数を数えて、**学会が配布している研修手帳の様式（経験症例記録のExcel）に書き込んで出力する**ためのWebアプリです。ビルド不要で、`index.html` を開くだけで動きます。

> 非公式のツールです。学会とは関係ありません。提出前に、出力されたExcelの内容は必ず目で確認してください。

## できること

- 症例を1件ずつ登録（検査日・区分・年齢・性別・部位・種別・診断名・疾患群の枠など）。患者ID・氏名・生年月日は扱いません
- 疾患群100枠をタップして割り当て、領域ごとの充足状況を表示
- 3つの専門医（放射線科専門医／診断専門医／治療専門医）ごとの進捗、入学年度、受験予定日、残り日数・不足件数・週あたりのペース。目標症例数は学会資料（研修手帳・研修プログラム）に基づき、根拠は画面にも書いてあります（[根拠にした資料](docs/sources.md)）
- 読影レポートの一覧（CSV/Excel）から、必要な列だけを読み込んで自動取り込み（患者情報の列は読まない）
- **研修手帳の様式に書き込んで出力**（書式・結合セル・入力規則・シートの保護は元のまま）。**放射線科専門医（基本領域）の経験症例記録、診断専門医・治療専門医の「専攻医研修手帳」の3種類**に対応し、それぞれの様式に書き込みます。様式の種類は、選んだファイルの中身から自動で判別します。放射線治療は、手帳の項目（依頼科・目的・1回線量・照射回数・有害事象・核種など）も登録できます
- 複数人での管理（Googleスプレッドシート＋Apps Script、Googleサイトに埋め込み可）。管理者は全員の進捗を閲覧し、入学年度で絞り込めます

## ドキュメント

| 読むもの | 内容 |
|---|---|
| [使い方ガイド](docs/usage.md) | 画面の見方、症例の登録、取り込み、進捗、出力、よくある質問 |
| [複数人で使う手順（Apps Script）](docs/apps-script-setup.md) | Googleスプレッドシート＋Apps Script のセットアップ、運用、更新、トラブル対応 |
| [根拠にした資料](docs/sources.md) | 目標症例数・受験要件の出典（学会の資料のURLと、確認できたこと・できなかったこと） |

## 始め方

### 1. 個人で使う（いちばん簡単）

1. このリポジトリの `index.html` を手元にダウンロードして、ブラウザで開く。または、下の「GitHub Pagesで公開する」で、URLから開く
2. 「出力・バックアップ」タブで、**学会・機構が配布している様式ファイル（.xlsx）を、出したい専門医の分だけ選ぶ**（基本領域・診断・治療のどれでも可）。このブラウザに保存されるので、次回からは不要です
3. 症例を登録する
4. 専門医ごとの「…の様式に書き込んで出力」を押す

データはこのブラウザの中（localStorage）にだけ保存されます。ブラウザの設定を消すと失われるので、ときどき「バックアップ」（JSON）を保存してください。端末やブラウザを変えるときも、バックアップから復元できます。詳しくは[使い方ガイド](docs/usage.md)へ。

### 2. 複数人で使う（Googleスプレッドシート＋Apps Script）

メンバーが各自のパスコードで登録し、管理者が全員の進捗を見られる版です。Googleサイトに埋め込めます。**手順が長いので、[複数人で使う手順](docs/apps-script-setup.md)に分けて書きました**。各手順に「確認（画面で何が見えるはずか）」と「うまくいかないとき」を付けています（ファイルの用意、Apps Script プロジェクトの作成、`ADMIN_PASSCODE`・`JOIN_CODE` の設定と決め方、`setup` の実行と権限承認、ウェブアプリとしてのデプロイ、動作確認、Googleサイトへの埋め込み、公開前のチェックリスト、メンバーへの案内文、更新のしかた、管理者の交代、よくあるエラー）。

要点だけ書くと、次のとおりです。

1. Apps Script に `apps-script/Code.gs` と `apps-script/Index.html` を貼り付ける
2. `Code.gs` 冒頭の `ADMIN_PASSCODE`（8文字以上）と `JOIN_CODE`（6文字以上）を書き換える
3. 関数 `setup` を実行（初回は権限の承認が必要）
4. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」（実行: 自分／アクセス: 全員）
5. 表示されたURLを、Googleサイトの「埋め込み」→「URL」に貼る

**注意**: 管理者パスコードと招待コードは `Code.gs` に書く値です。書き換えたものを公開リポジトリに載せないでください（このリポジトリの `Code.gs` は空欄です）。

### 3. 様式を内蔵した私用版（公開しないこと）

毎回様式を選ぶのが面倒な場合、様式ファイルを埋め込んだ版を手元で作れます。

```
python3 tools/gen-template.py 様式.xlsx --embed
python3 tools/build.py          # dist/Index.embedded.html ができる
```

`dist/Index.embedded.html` には学会の様式が含まれるため、**公開リポジトリに置いたり、第三者に配布したりしないでください**。`.gitignore` で除外してあります。

## GitHubでの公開・更新の手順

### GitHub Pagesで公開する

このリポジトリの `index.html` を、そのままWebページとして公開できます。

1. GitHubでリポジトリを開き、**Settings**（設定）を押す
2. 左のメニューの **Pages** を押す
3. **Build and deployment** の **Source** を「**Deploy from a branch**」にする
4. **Branch** を「**main**」、フォルダを「**/ (root)**」にして **Save**
5. 1〜数分待つ。同じページの上のほうに、公開URLが表示される（このリポジトリなら `https://ringnir.github.io/radiology-case-counter/`。一般には `https://<ユーザー名>.github.io/<リポジトリ名>/`）

公開されるのは、リポジトリにあるものです。**様式ファイルや、パスコードを書き込んだ `Code.gs` を、コミットしないでください。**

### 変更して更新する

ソースは `src/` にあります。`index.html` と `apps-script/Index.html` は、そこから作る生成物です。

```
python3 tools/build.py      # src/ → index.html と apps-script/Index.html
npm test                    # 動作確認（様式が必要な試験は TPL_XLSX / TPL_DIAG / TPL_RT を指定）
git add -A
git commit -m "変更の内容"
git push
```

GitHub Pages は、`main` に push すると自動で更新されます（反映まで数分）。複数人用（Apps Script）の方は、Apps Script 側に貼り直して、新しいバージョンでデプロイし直す必要があります（[手順](docs/apps-script-setup.md)の「新しい版に更新するとき」）。

### 自分用にコピーして使う

- **Fork**：リポジトリ右上の Fork で、自分のアカウントにコピーできます。自分用の変更や、自分のPagesでの公開に使えます
- **ZIPでダウンロード**：Code → Download ZIP。展開して `index.html` を開くだけで使えます

## 様式ファイルについて

- このリポジトリには**様式ファイルそのものは含まれません**。各自が学会の配布物を読み込みます
- 対応している様式は、次の3種類です
  - **放射線科専門医（基本領域）の「経験症例記録」**：疾患100枠・B.検査・IVR・放射線治療の9シート
  - **診断専門医の「専攻医研修手帳（放射線診断領域）」**：B.単純・消化管・超音波・CT・MRI・核医学、C.IVR の7シート（目標が様式の行数を超える分は、行を自動で追加します）
  - **治療専門医の「専攻医研修手帳（放射線治療領域）」**：A.部位別4シートと、B.治療技術4シート（部位別と技術別は重複して書き込みます）
- 読み込み時に、想定している様式かを確認します（シート名、行数、見出し、疾患群・領域などの名前）。違う場合は理由を表示して受け付けません。**様式のバージョンが変わった**ときは、`python3 tools/gen-template.py 新しい様式.xlsx` で構造定義（`src/template.js`）を作り直し、`python3 tools/build.py` で再ビルドしてください
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
TPL_XLSX=/path/to/様式.xlsx TPL_DIAG=/path/to/診断手帳.xlsx TPL_RT=/path/to/治療手帳.xlsx CHROME=/path/to/chrome npm test
```

- `src/` が元のソースです（`head.html`・`body.html`・`style.css`・`logic.js`・`template.js`・`case.js`・`core.js`・`render.js`・`actions.js`）。`index.html` と `apps-script/Index.html` は**生成物**で、リポジトリにも含めてあります（GitHub Pages 用）
- 画面の部品は `vendor/jszip.min.js`（JSZip 3.10.1、MIT/GPLv3 のデュアルライセンス）をHTMLに埋め込んで使います。通常のExcel出力だけ SheetJS 0.18.5 を cdnjs から読み込みます（読めない場合はCSV出力にフォールバック）
- テストは3種類: `tests/logic.test.js`（ロジック）、`tests/server.test.js`（Apps Script側。モック）、`tests/e2e.js`（Playwright）。様式ファイルが必要な試験は、基本領域は `TPL_XLSX`、診断専門医の手帳は `TPL_DIAG`、治療専門医の手帳は `TPL_RT` が無いと省略されます（`tests/fixtures/template.xlsx`・`diag.xlsx`・`rt.xlsx` に置いてもよい。コミットされません）
- `APP=dist/Index.embedded.html npm run test` のように `APP` を指定すると、様式内蔵版でe2eを実行できます
- `CHROME` は Chromium/Chrome の実行ファイル。未指定なら Playwright の既定を探します（`npx playwright-core install chromium` で入ります）

## 構成

```
index.html              生成物（GitHub Pages・手元で開く用。様式を含まない）
apps-script/            Googleスプレッドシート＋Apps Script 用（Code.gs / Index.html）
src/                    ソース
docs/                   使い方ガイド・Apps Script の手順・根拠にした資料
tools/build.py          src/ → HTML
tools/gen-template.py   様式.xlsx → 構造定義（src/template.js）
vendor/                 JSZip
tests/                  テスト
```

## ライセンス

[MIT License](LICENSE)。自由に使用・改変・再配布できます。無保証です。症例数の集計や出力の誤りによる不利益について、作者は責任を負いません。

同梱の JSZip（`vendor/`）は MIT または GPLv3 の二重ライセンスで、MIT を選んで使用しています。学会の研修手帳の様式（xlsx）は含まれず、その権利は配布元の学会に帰属します。
