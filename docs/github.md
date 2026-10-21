# GitHubでの公開・更新

このリポジトリを、**自分のGitHubで公開したい人・更新したい人**向けの手順です。アプリを使うだけの人は、読まなくて構いません。

## 目次

- [いちばん大事なこと：公開しないもの](#いちばん大事なこと公開しないもの)
- [GitHub Pagesで公開する](#github-pagesで公開する)
- [変更して更新する](#変更して更新する)
- [自分用にコピーして使う](#自分用にコピーして使う)
- [公開前のチェックリスト](#公開前のチェックリスト)

---

## いちばん大事なこと：公開しないもの

次のものは、**GitHub（公開リポジトリ）に載せないでください。**

| 載せないもの | 理由 | 対策 |
|---|---|---|
| **学会・機構の様式ファイル（.xlsx）** | 権利は配布元にあります。このアプリは、様式を同梱せず、使う人が自分で選ぶ作りです | `.gitignore` で `*.xlsx` を除外してあります |
| **様式の中身を文字列にしたもの**（base64など） | 上と同じ。ファイルの形を変えただけでも、同梱になります | ビルドの仕組みに、そもそも入れない作りです。`tests/no-template.test.js` が、出力に混ざっていないかを、毎回検査します |
| **管理者パスコード・招待コードを書いた `Code.gs`** | 公開すると、誰でも管理者になれます | リポジトリの `Code.gs` は空欄のままにします。書き込むのは、Apps Script の画面の中だけです |
| 患者さんの情報・実際の症例データ | 個人情報です | テスト・画面のサンプルは、すべて架空のデータです |

> [!IMPORTANT]
> 手元のテスト用に、様式のExcelを `tests/fixtures/` に置くことがあります。そこは `.gitignore` で除外されていますが、**コミットする前に `git status` で、`.xlsx` が含まれていないかを、必ず見てください。**

---

## GitHub Pagesで公開する

`index.html` を、そのままWebページとして公開できます（無料）。メンバーに、URLだけを渡せば使えるようになります。

<table>
<tr><th width="40">手順</th><th>やること</th></tr>
<tr><td align="center">1</td><td>GitHubでリポジトリを開き、上のタブの <strong>Settings</strong>（設定）を押す</td></tr>
<tr><td align="center">2</td><td>左のメニューの <strong>Pages</strong> を押す</td></tr>
<tr><td align="center">3</td><td><strong>Build and deployment</strong> の <strong>Source</strong> を「<strong>Deploy from a branch</strong>」にする</td></tr>
<tr><td align="center">4</td><td><strong>Branch</strong> を「<strong>main</strong>」、フォルダを「<strong>/ (root)</strong>」にして <strong>Save</strong> を押す</td></tr>
<tr><td align="center">5</td><td>1〜数分待つ。同じページの上のほうに、公開URLが表示される</td></tr>
</table>

公開URLの形は、`https://<ユーザー名>.github.io/<リポジトリ名>/` です。このリポジトリなら、`https://ringnir.github.io/radiology-case-counter/` です。

**確認**：公開URLを開いて、「専門医症例カウンター」の画面が出る。

**うまくいかないとき**

- 404（見つかりません）と出る：公開の反映まで、数分かかることがあります。Settings → Pages の画面で、「Your site is live at …」と出ているかを確認してください
- リポジトリが **Private** のとき：無料のGitHubアカウントでは、Privateリポジトリで Pages は使えません。Public にするか、`index.html` をダウンロードして、手元で開いて使ってください
- 画面が出ても、動かない：ブラウザの更新（強制再読み込み：Ctrl＋Shift＋R。Macは ⌘＋Shift＋R）を試してください

> [!NOTE]
> 公開されるのは、**リポジトリにあるもの**です。上の「公開しないもの」を、コミットしていないことを確認してから、公開してください。

---

## 変更して更新する

ソースは `src/` にあります。`index.html` と `apps-script/Index.html` は、そこから作る**生成物**です（直接は編集しません）。詳しくは、[開発者向けの資料](development.md)へ。

```
python3 tools/build.py      # src/ → index.html と apps-script/Index.html
npm test                    # 動作確認
git status                  # コミットするファイルを確認（.xlsx が無いこと）
git add -A
git commit -m "変更の内容"
git push
```

- GitHub Pages は、`main` に push すると、**自動で更新**されます（反映まで数分）
- **複数人用（Apps Script）の方は、自動では更新されません。** Apps Script の画面で、`Index.html` を貼り直して、新しいバージョンでデプロイし直します（[新しい版に更新するとき](apps-script-admin.md#新しい版に更新するとき)）

---

## 自分用にコピーして使う

| 方法 | やること | 向いている人 |
|---|---|---|
| **Fork** | リポジトリ右上の **Fork** を押す。自分のアカウントに、コピーができる | 自分用の変更をしたい。自分のGitHub Pagesで公開したい |
| **ZIPでダウンロード** | 緑の **Code → Download ZIP** を押して、解凍する。中の `index.html` を開くだけで使える | とにかく使いたい。GitHubのアカウントは持っていない |

---

## 公開前のチェックリスト

- [ ] `git status` に、`.xlsx` ファイルが**含まれていない**
- [ ] `npm test` が、最後まで通る（`no-template` の検査を含みます）
- [ ] `apps-script/Code.gs` の `ADMIN_PASSCODE` と `JOIN_CODE` が、**空欄のまま**である
- [ ] 画面のスクリーンショットや、テストのデータに、**実在の患者さん・メンバーの情報が無い**
