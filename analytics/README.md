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

## 毎週の実行（これだけ）

```powershell
cd analytics
npm run weekly
```

`npm run weekly` = エクスポート → 集計 を一括実行。
`exports\YYYY-MM-DD\` に以下が生成されます：

| ファイル | 用途 |
|---|---|
| `dataset.json` | 正規化済みの生データ（全件） |
| `digest.json` | **Cowork に渡す**事前集計済みデータ |
| `posts.flat.jsonl` | 1行1投稿の denormalize 済み（必要なら） |
| `dashboard.html` | **ダブルクリックで開く**人間向けダッシュボード |

個別に実行したい場合：
```powershell
npm run export                      # 今日の日付で取得
npm run export -- --date=2026-06-06 # 日付指定
npm run digest                      # exports 内の最新日付を集計
npm run digest -- --date=2026-06-06 # 日付指定
```

> Windows でダブルクリック運用したい場合は、`npm run weekly` を呼ぶ `.bat` を作ると楽です。

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

## 指標の定義（digest.json）

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

## 次のステップ（未実装）

- Cowork に渡す固定プロンプト（`PROMPT.md`）と定型レポート様式
- `digest.json` を入力に、ユーザー別カルテ＋優勝予想＋珍記録を Markdown 出力させる
