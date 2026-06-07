# GrowRep 週次ローカル分析パイプライン

Firestore の投稿データを週イチでローカルに取り込み → 集計 → 可視化し、
Claude Cowork（デスクトップ版）で分析させるための一式です。

```
Firestore ──①export──> dataset.json ──②digest──> digest.json + dashboard.html
                                                        │              │
                                                   Cowork が読む    人間が見る
```

設計方針: **数値の集計はスクリプトで決定論的に確定**し、Cowork には「集計済みの事実」を
渡して解釈・物語化・提案に専念させる（LLM に算数をさせないことで毎週の精度を担保）。

---

## 初回セットアップ（1回だけ）

1. **サービスアカウント鍵を取得**
   - [Firebase Console](https://console.firebase.google.com/) → プロジェクト `growrep-65c18`
   - 歯車 → プロジェクトの設定 → 「サービスアカウント」タブ
   - 「新しい秘密鍵の生成」→ ダウンロードした JSON を
     **`analytics/serviceAccountKey.json`** という名前で保存
   - ⚠️ この鍵は全権限を持つ。`.gitignore` 済みだが絶対に共有・コミットしない。

2. **依存をインストール**
   ```powershell
   cd analytics
   npm install
   ```

---

## 毎週の運用フロー（日曜の流れ）

週間チャレンジの週境界は **日曜17:00 JST**。この時刻に来週の種目を確定し、その総決算＋来週発表を
日曜夜にアプリへ配信する。タイムラインは次のとおり:

```powershell
cd analytics

# ① 16:45〜16:55  来週の3種目を選出 → weekly_override に書込（アプリへ反映）
#                 さらに export→digest（確定種目が digest.nextWeekConfirmed に入る）
npm run announce          # = select-weekly.js → export → digest

# ② 18:00  Claude Cowork で PROMPT.md を貼り、report_<exportDate>.md を生成（確定カードを実況）

# ③ 18:30  週報＋ダッシュボードを Firestore に配信
npm run publish           # = publish-report.js
```

> **なぜ日曜夜か:** 17時に種目を確定してから Cowork を回すので、「次週予想（確率）」が
> 「来週の確定カード解説」に格上げされる。デプロイ不要・auth ゲート内で完結する。

`announce` 実行後、`exports\YYYY-MM-DD\` に以下が生成されます：

| ファイル | 用途 |
|---|---|
| `dataset.json` | 正規化済みの生データ（全件） |
| `digest.json` | **Cowork に渡す**事前集計済みデータ（`nextWeekConfirmed` に来週の確定3種目） |
| `posts.flat.jsonl` | 1行1投稿の denormalize 済み（必要なら） |
| `dashboard.html` | **ダブルクリックで開く**所有者向けのフル分析ツール（手元用） |

個別に実行したい場合：
```powershell
npm run select                       # 来週ぶんを選出（weekly_override 書込）
npm run select -- --dry-run          # 書込まず選出結果だけ確認
npm run select -- --label="特別回"    # ラベル付き
npm run weekly                       # export→digest（選出を反映するため select の後に）
npm run publish                      # 最新日付の週報を Firestore に配信
npm run publish -- --date=2026-06-07 # 日付指定で配信
```

> Windows でダブルクリック運用したい場合は、`npm run announce` / `npm run publish` を呼ぶ
> `.bat` を2つ作ると楽です。

---

## ダッシュボードで見られるもの（人間向け）

`exports\YYYY-MM-DD\dashboard.html` をブラウザで開くと:

- **今週のサマリー** … 投稿数 / 活動人数 / 人気種目 / 今週のMVP
- **二つ名・ペルソナ** … 投稿王・継続の鬼・急成長株・人気者・いいね職人・種目クリエイター・万能型/一点特化型・朝型/夜型 など称号の保有者
- **ユーザー別カルテ** … タグ別レーダー（相対実力）/ 得意トップ3・苦手ワースト3 / 急成長中 / 未開拓タグ / 曜日別投稿 / ソーシャル指標
- **種目ランキング** … 累計・今週・勢い(momentum)・トップ・評価・作成者
- **タグ別の傾向** … タグごとの種目数・投稿数・タグ王
- **注目ライバル対決** … ベスト記録が僅差(15%以内)の2人

※ グラフ描画に Chart.js を CDN から読むため、表示時はネット接続が必要です。

---

## digest.json の主要セクション

レポートの**主役**は週間チャレンジ／月間ダービー。フリーモードの相対分析は味付けです。

| セクション | 内容 |
|---|---|
| `weeklyChallenge` | 今週の3種目・順位表(`standings`)・王者(`champion`)・各人の逆転材料(`perUser`)。**本体と同じ得点ロジックを再現**（平日・今週の3種目、通常=self/max×100、バーバリアン=min/self×100、合計） |
| `monthlyDerby` | その月の各週の週間チャレンジ得点を合計した総合順位。`leader`/`leadMargin`/週別推移(`weeklyScores`)。`monthOver` が false の間は暫定 |
| `offChallenge` | 今週あえてチャレンジ3種目以外をやった人（個性・偏愛のシグナル。`challengeDoneCount` 付き） |
| `nextWeekConfirmed` | **日曜17時に確定した来週の3種目**（`select-weekly.js` が書いた `weekly_override` 由来）。各種目に出たら本命(`favorite`)・対抗(`contenders`)。選出前は `null` |
| `nextWeekForecast` | 次週に出やすい種目の**確率予想**（本体の選出アルゴリズムを再現）。候補ごとに本命記録保持者つき。`nextWeekConfirmed` が無いときのフォールバック用 |
| `ratingScene` | 種目作成・評価・コメントの交流（`creators`/`mostLoved`/`topEvaluators`/`engagement`/`notableComments`/`freshExercises`） |
| `users` / `exercises` / `tags` / `rivalries` | フリーモード全体の実力・成長・キャラ付け（味付け用） |

> 週間チャレンジ／ダービーの計算は `weekly-analytics.js` に分離（app.js のロジックを移植）。
> 現在進行中の週は、古い種目が残った履歴より **ライブの `weekly_challenge` を優先**します。

## 指標の定義（フリーモード分析）

- **percentile（パーセンタイル）**: 同一種目の全員ベスト値の中での相対位置（0〜100、高いほど得意）。
  比較には2人以上の記録が必要。「得意・苦手」判定の基礎。
- **tagStrength**: その人がやった種目のパーセンタイルを**タグごとに平均**したもの（レーダーの各軸）。
- **slopePerWeek / relSlopeWeekPct**: value の時系列単回帰の傾き（3投稿以上）。
  相対成長率(%/週)で「成長中 / 停滞 / 下降」を判定（±2%/週が閾値）。
- **streak**: 連続投稿日数（JST基準）。`longestStreak` と `currentStreak`。
- **social**: likes/comments の「与えた数(Given)」「もらった数(Received)」。
- **rivalry**: 種目ごとのベスト1位と2位の差が15%以内のペア。

> 投稿時刻の曜日・時間帯は JST(UTC+9) に変換して集計しています。

---

## ④ Claude Cowork で分析（エンタメ週報を出す）

数値は集計済みなので、Cowork には解釈・実況・物語化だけさせます。

1. `npm run weekly` 実行後、Claude Cowork（デスクトップ版）で `analytics\` フォルダを開く
2. **`PROMPT.md` の中身を Cowork に貼り付ける**
3. Cowork が `exports\YYYY-MM-DD\digest.json` を読み、`REPORT_TEMPLATE.md` の構成に従って
   **`report_YYYY-MM-DD.md`**（エンタメ寄りの週報）を同じフォルダに生成

| ファイル | 役割 |
|---|---|
| `PROMPT.md` | Cowork に貼る固定プロンプト（役割・厳守ルール・データの読みどころ） |
| `REPORT_TEMPLATE.md` | 週報の見出し・構成テンプレ（毎週ブレないため） |

> サンプル: `exports\2099-01-01\report_2099-01-01.md`（合成データでの出力見本）

### 設計上のポイント
- **数値は digest.json の値だけを使い、LLM に再計算・推測させない**（PROMPT.md で厳守ルール化）。
- percentile は「上位%＝100−percentile」で表示。
- 比較材料が少ない項目は断定せず「判定材料が少ない」と正直に書かせる。

---

## ⑤ アプリへ配信（publish）

Cowork が `report_<exportDate>.md` を生成したら、Firestore に配信します。

```powershell
npm run publish     # exports 内の最新日付を weekly_reports/<exportDate> へ
```

`publish-report.js` が行うこと:
- `report_<exportDate>.md` を **HTML 化**（marked）して `reportHtml` に格納
- `digest.json` 全量を `digest` に格納（アプリのダッシュボード描画用）
- 来週の確定種目を `nextWeekExercises` に格納
- `weekly_reports/<exportDate>` ドキュメントとして **サービスアカウントで書き込み**

アプリ側はトップの **「📊 ウィークリー」**（[`report.html`](../report.html)）でこれを auth 越しに読み、
週報＋ダッシュボードを表示します。新着があるとトップに NEW バッジ／バナーが出ます。

| 仕組み | 内容 |
|---|---|
| 配信先 | Firestore `weekly_reports`（read: 認証ユーザー / write: **不可**＝サービスアカウントのみ） |
| 反映 | アップロード即時。GitHub Pages のデプロイは不要 |
| プライバシー | 個人の記録は公開リポジトリに出さず auth ゲート内に留まる |
| 既読管理 | `localStorage['growrep_lastSeenWeekly']`（report.html を開くと最新を既読化） |

> Firestore は1ドキュメント1MB 上限。6人規模では digest 全量でも十分収まるが、
> `publish-report.js` は概算サイズが 950KB を超えると警告を出す（その時は分離を検討）。
