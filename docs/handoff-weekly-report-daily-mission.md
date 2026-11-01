# 引き継ぎメモ：週報（Cowork 定期タスク）をデイリーミッション対応にする

- 作成日: 2026-11-01
- 状態: **①②⑤済み**（デイリーの日ごとの記録・export・指示文の差し替え）。**③④が残り**
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

### ③ digest に `dailyMission` を追加（残り）

`analytics/build-digest.js` か新規 `daily-analytics.js`。対象期間は週報の対象週の **月曜〜日曜（JST 暦日）**。
export 時点で終わっていない日は `inProgress: true`。

- 日ごとの種目・ピークは `dataset.dailyMission.history[dateKey]` を使う。
  `peak` が null の日は「その日 0:00 JST より前の、その種目の全投稿の最大値」から `resolveDailyPeak` で再計算する。
- history に無い日は `source: "none"` として扱い、その日は days に入れない（推測で埋めない）。
- 目標回数・確率は `web/src/lib/daily-mission.ts` の純粋関数を **そのまま移植**する
  （`hashStringToSeed` / `createSeededRandom` / `seededNormal` / `resolveDailyPeak` /
  `generateDailyMissionTarget` / `dailyTargetProbability`）。シード文字列・定数を変えないこと。
- 合計はその日の `posts_free` のうち、その日の種目の value の足し上げ。

```jsonc
"dailyMission": {
  "period": { "from": "2026-11-02", "to": "2026-11-08" },
  "days": [{
    "dateKey": "2026-11-02", "weekdayLabel": "月", "isWeekday": true, "inProgress": false,
    "exerciseKey": "...", "exerciseName": "...", "peak": 40, "rerolled": false,
    "raid": null,                 // レイド日なら { day, goal, teamTotal, cleared }
    "activeCount": 3,             // その日フリーに1件以上投稿した人数
    "clearedCount": 2,
    "participants": [{            // その日フリーに1件以上投稿した人（ログイン者は後から数え直せないため）
      "userName": "渡邉", "target": 38, "probability": 0.041,
      "totalValue": 40, "cleared": true, "ratio": 1.05,
      "status": "cleared"         // cleared / short（挑んだが未達）/ untouched（その種目は0回）
    }]
  }],
  "perUser": [{
    "userName": "渡邉", "clearDays": 6, "attemptDays": 6,
    "weekdayClearDays": 5, "allWeekdaysCleared": true,
    "clearStreak": 6              // 期間内の最長連続クリア日数
  }],
  "highlights": {
    "rareClears":  [{ "userName", "dateKey", "exerciseName", "target", "probability" }],  // cleared かつ probability < 0.05、確率の低い順に最大3件
    "nearMisses":  [{ "userName", "dateKey", "exerciseName", "target", "totalValue", "short" }], // 未達かつ totalValue >= target×0.8
    "overkills":   [{ "userName", "dateKey", "exerciseName", "target", "totalValue", "ratio" }],  // ratio >= 1.5、大きい順に最大3件
    "allClearDays": ["2026-11-04"]  // activeCount >= 2 かつ全員クリア
  },
  "gate": [{ "userName": "渡邉", "weekdayClearDays": 5, "weeklyPostDays": 5 }]  // weeklyPostDays = 本戦種目に投稿した平日の数
}
```

期間内に history のある日が1日も無ければ `dailyMission: null` にする。指示側は null なら「準備中」と1行で済ませる。

### ④ 週間チャレンジ・月間ダービーの小修正（残り、`analytics/weekly-analytics.js`）

- `weeklyChallenge.paused`: 休止週（`isWeeklyPausedWeekStart` 相当）なら true。
- `monthlyDerby.monthOver`: 「集めた最後の週がダービー最終週（その週の日曜 = derbyEnd）で、かつ確定済み」なら true にする。
  今の `todayUTC > derbyEnd` だと最終週の週報（derbyEnd 当日の日曜）で必ず false になる。

### ⑤ 指示の差し替え（済み）

- `analytics/PROMPT.md` / `REPORT_TEMPLATE.md` を v2 に差し替えた。③が入るまでは、デイリーの節は「準備中」の1行になる。
- 残り: `analytics/README.md` の digest セクション表に `dailyMission` を追記（③と一緒に）。
- claude.ai の GrowRep プロジェクトの指示（旧 PROMPT.md の写し）は手で貼り替える。

## 4. テスト

- ③で移植した目標回数・確率が web と一致すること: `web` 側の関数の出力を数件（ユーザー×日付×種目×ピーク）固定値として
  analytics の `node --test` に書き、同じ値になるか照合する。
- ①のデプロイ後、最初の週報（丸1週間たった日曜）の export で `daily_history=7日` 前後になっていること（export のログに出る）。
