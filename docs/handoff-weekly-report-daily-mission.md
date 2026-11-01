# 引き継ぎメモ：週報（Cowork 定期タスク）をデイリーミッション対応にする

- 作成日: 2026-11-01
- 状態: **すべて実装済み**（①②⑤ = PR #63、③④ = 2026-11-01 の続き）。残りは運用での確認だけ（4. を参照）
- 関連ファイル: `analytics/PROMPT.md` / `analytics/REPORT_TEMPLATE.md`（2026-11 に v2 へ差し替え）

---

## 1. 依頼内容

週報の指示（`analytics/PROMPT.md`。定期タスク「Growrep」はこのファイルと `REPORT_TEMPLATE.md` を読んで週報を書く）は
2026-06 の仕様のまま。その後に増えた機能、特に **デイリーミッション** を週報で扱えるようにしたい。

## 2. 仕様と指示の乖離（調査結果）

| # | いまの仕様 | 旧指示・digest の状態 | 影響 |
|---|---|---|---|
| 1 | デイリーミッション（7/27〜）。毎日1種目、目標は人ごとに抽選、その日の合計でクリア | 指示に記載なし。**digest にデータなし**。export も `settings_free/daily_mission` を取っていなかった | 週報で一切触れられない |
| 2 | 平日はデイリー未クリアだと週間チャレンジに投稿できない（8/23〜） | 記載なし | 「本戦の入場券」という今の遊び方が伝わらない |
| 3 | 特別イベント週（4種目・低い3種目採用、`weekly_override_<月曜キー>`） | 指示は「3種目」前提 | 4種目週の説明がずれる。digest は下位3採用・`overrideLabel` 対応済み |
| 4 | 週間チャレンジの休止週（レイド期間など） | 記載なし | 休止週に空の本戦を実況しかねない |
| 5 | レイド（8/9〜8/16 の期間限定） | 記載なし | 次回開催時に扱えない（今は終了済みなので優先度低） |
| 6 | 月間ダービーは「翌月最初の月曜の前日（日曜）」まで | `monthOver = 今日 > derbyEnd`。週報は derbyEnd 当日の日曜に作るので **最終週の週報で monthOver が true にならない**（10月分も 11/1 時点で false） | 正式チャンプが週報で一度も戴冠されない |
| 7 | — | テンプレ冒頭「仲間内 {{activeUsers}}人」が登録者ベースの人数（11/1 版は 8人と書いたが実際に動いたのは 3人） | 冒頭の人数がずれる |
| 8 | ドロップセットモード（`posts_dropset`） | export 対象外 | 指示で「触れない」と明記して対処（集計は将来課題） |

## 3. やったこと・やること

### ① デイリーの日ごとの記録（済み）

`settings_free/daily_mission` は「今日の分」しか持たず、過去の日の種目を後から特定できなかったので、
同じドキュメントに `history.<日付キー>` を足した（Firestore ルールの変更なし。`settings_free` は認証済みなら書ける）。

```jsonc
"history": {
  "2026-11-02": {
    "exerciseKey": "free_...",   // その日に確定した種目（引き直し後の最終）
    "peak": 40,                  // その日のピーク。過去最高を引けていなければ null
    "bestValue": 40,             // ピークの根拠（その日 0:00 JST より前の全投稿の最大）
    "raidDay": null,             // レイド開催日なら何日目か
    "raidGoal": null,            // レイド開催日の固定目標（人数割りの日は null）
    "rerolledFrom": ["free_..."],// 管理画面で引き直したときだけ。使われなかった種目（古い順）
    "rerolledAt": "<timestamp>"  // 同上
  }
}
```

書く場所は3か所。どれも merge で自分が知っているフィールドだけを書くので、互いの値を消さない。

| 書き手 | いつ書くか |
|---|---|
| web（`web/src/lib/daily-mission-engine.ts`） | 日付が変わる書き込みに同乗／ピークを集計し直した書き込みに同乗／それ以外の読み込みでは、history が食い違っているときだけ書き足す（毎回は書かない） |
| 旧版（`app.js`） | web と同じ（ミラー） |
| 管理画面（`web/public/admin/app.js` の「今日の種目を引き直す」） | 種目を差し替え、peak を null に戻し、`rerolledFrom` / `rerolledAt` を残す。新しい種目のピークは次に開いた人のアプリが埋める |

- 古い日は **180日** で掃除する（日付が変わる書き込みのついでに `deleteField`）。週次の export にはその時点の全体が残る。
- 管理画面のデイリー欄に「記録」として直近7日分を出した。デプロイ後はここで溜まっているか確認できる。
- 判定・組み立ては `web/src/lib/daily-mission.ts` の純粋関数（`buildDailyHistoryEntry` / `buildRaidHistoryEntry` /
  `isDailyHistoryUpToDate` / `staleDailyHistoryKeys`）。テストは `web/src/lib/__tests__/daily-mission-history.test.ts`。
- **記録は誰かがその日にアプリを開いたときに書かれる**。誰も開かなかった日は history が無い（＝デイリーの成績も無い日なので集計上の問題はない）。

### ② export に追加（済み）

`analytics/export-firestore.js` が `settings_free/daily_mission`（history 込み）と `settings_free/raid_config` を
dataset の `dailyMission` / `raidConfig` に入れる。種目には `excludeFromDaily` も追加。

### ③ digest に `dailyMission` を追加（済み）

`analytics/daily-analytics.js`（`build-digest.js` から呼ぶ）。

- 対象週は **export 日以前で最も新しい日曜で終わる月〜日**（JST 暦日）。日曜夕方の export なら、その日曜は `inProgress: true`。
- 日ごとの種目・ピークは `dataset.dailyMission.history[dateKey]`。`peak` が null の日（引き直し直後など）は、その日 0:00 JST より前の全投稿の最大から再計算する（`peakSource: "recomputed"`）。
- history に無い日は推測で埋めず `missingDays` に出す。期間内に1日も無ければ `dailyMission: null`。
- 目標回数・確率は `web/src/lib/daily-mission.ts` の純粋関数をそのまま移植した（シード文字列・定数は同じ）。
  一致は `daily-analytics.test.js` の固定値（web 版の関数で作った値）で確かめている。
  10/26〜10/30 の実データでも、多くの人がちょうど目標の回数で投稿を止めており、アプリの抽選と一致していた。
- 参加者は「その日 posts_free に1件以上投稿した人」（アプリはその日ログインした人を並べるが、後から数え直せないため）。

主な項目（全体は `analytics/README.md` と digest の `dailyMission.note`）:

| 項目 | 中身 |
|---|---|
| `days[]` | 種目・`peak`・各人の `target` / `topPct` / `totalValue` / `cleared` / `ratio` / `status`（cleared・short・untouched）。`rerolled`、レイド日は `raid` |
| `perUser[]` | `clearDays` / `attemptDays` / `activeDays` / `weekdayClearDays` / `allWeekdaysCleared` / `clearStreak` |
| `highlights` | `rareClears`（上位10%以内の重い目標を突破）/ `nearMisses`（達成率80%以上で未達）/ `overkills`（1.5倍以上）/ `allClearDays` |
| `gate[]` | 平日にデイリーを突破した日数と、本戦種目に投稿した平日の数 |

**目標の重さについて:** アプリの確率（`probabilityPct`）は「その回数ぴったり」を引く確率なので、ピークが大きい種目ではどの回数も1%前後になり、重さの比較に使えなかった（実データで全員が「確率1%の鬼目標」になった）。そこで「その回数以上を引く確率」`topPct` を足し、鬼目標の判定と指示文はこちらを使う。

### ④ 週間チャレンジ・月間ダービーの修正（済み、`analytics/weekly-analytics.js`）

- `weeklyChallenge.paused`: 直近に終わった週が休止週（`WEEKLY_PAUSE_WEEK_KEYS`。web の raid-mode.ts のミラー）なら、`paused: true` の告知用の形を返す。これまでは休止週を飛ばして「その前の週」を先週として実況してしまう作りだった。
- `weeklyChallenge.overrideLabel`: 週ごとの上書き設定 `settings_free/weekly_override_<月曜キー>` のラベルを引く（export に `weeklyOverrides` を追加）。champion / history の記録はラベルを持たないため、特別イベント週でも null になっていた。
- `monthlyDerby.monthOver`: 最終週（derbyEnd の日曜で終わる週）の金曜が終わって確定していれば true。11/1 のデータで 10月ダービーが確定扱いになることを確認した。

### ⑤ 指示の差し替え（済み）

- `analytics/PROMPT.md` / `REPORT_TEMPLATE.md` を v2 に差し替えた。③が入るまでは、デイリーの節は「準備中」の1行になる。
- `analytics/README.md` の digest セクション表に `dailyMission` などを追記した。
- claude.ai の GrowRep プロジェクトの指示（旧 PROMPT.md の写し）は手で貼り替える。

## 4. 運用での確認

- 11/8（日）の announce の export ログで `daily_history=` の日数を見る。PR #63 のデプロイ（11/1）以降に誰かがアプリを開いた日だけ記録がある。
- 11/8 の digest では、11/2（月）〜11/7（土）が集計対象、11/8（日）は `inProgress`。
- 休止週の告知は `WEEKLY_PAUSE_WEEK_KEYS` に週を足したときだけ動く。休止を増やすときは web の raid-mode.ts と analytics/weekly-analytics.js の両方を直す。
