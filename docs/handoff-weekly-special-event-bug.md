# 引き継ぎメモ：週間チャレンジが毎週「特別イベント」扱いになるバグ

- 作成日: 2026-10-21
- 状態: **調査完了・未修正**（コード変更なし）
- 次の担当がやること: 下の「未確認事項」を確認 → 「修正方針」に沿って実装

---

## 1. 依頼内容（ユーザーの要望）

1. 特別イベントを設定していないのに、毎週「特別イベント」として認識されている。原因を調べて直したい。
2. 今後も週間チャレンジは **1週間に3種目（通常2種目＋タイムアタック1種目）** を基本とする。今の運用がこの形なので、それを続けたい。
3. 特別イベントは **最大4種目まで設定できる** 今の仕様を維持する。

## 2. 結論（原因）

ローカルPCで毎週日曜に動く `analytics/select-weekly.js` が、**通常の自動選出の結果**を、特別イベントや管理画面からの手動設定と同じ「上書き設定」ドキュメント `settings_free/weekly_override` に書き込んでいる。アプリ側はこの書き込みを本物の上書きと区別できず、特別イベント週として扱っている。

特別イベントの提案・承認の仕組み自体に不具合はない。

### 発生の流れ

1. 毎週日曜16:45ごろ、タスクスケジューラが `analytics/announce.bat` → `npm run announce` を実行する
   （`= select-weekly.js → export-firestore.js → build-digest.js → collect-suggestions.js`）
2. `select-weekly.js` が来週の3種目を加重ランダムで選び、次の内容で `settings_free/weekly_override` に書き込む（`analytics/select-weekly.js:293`）
   ```js
   { exercises, targetWeekStart, label: null, invalidated: false,
     generatedBy: 'select-weekly.js', generatedAt }
   ```
   - `source` フィールドは無い
   - `label` は `--label` を付けなければ `null`
3. 日曜17:00の週の切り替え後に誰かがアプリを開くと、`getOrUpdateWeeklyChallenge` が上書き設定を読む
   - `planWeeklyOverride`（`web/src/lib/special-event.ts:233`）の判定で、対象週が一致するので `use: 'legacy'` になる（`:248`）
4. `applyOverride` が `weekly_challenge` に次の内容を書き込む
   - `isManualOverride: true`
   - `overrideLabel: label || '特別イベント'`
   - `overrideSource: 'admin'`（`source` が無いため既定値になる）
   - 該当箇所: React版 `web/src/lib/weekly-engine.ts:320`、旧版 `app.js:6758`
5. 画面に「特別イベント」バッジが出る
   - React版 `web/src/features/weekly/ThisWeek.tsx:155`
   - 旧版 `app.js:7002`

PCでスクリプトが動いた週は必ず発生するため「毎週」に見える。PCの電源が切れていてスクリプトが動かなかった週は、アプリが自分で選出するので発生しないはず（未検証）。

### 経緯（git 履歴）

- 2026-06-07 ごろ: `select-weekly.js` を追加（PR #11）。日曜17時の選出をローカルPCに移した
- 2026-06-08 `e3b59c5`: 上書き設定を適用したときの既定ラベル「特別イベント」とバッジ表示が入る。この時点で、ラベル無しのスクリプト書き込みもバッジ付きで表示されるようになった
- 2026-08-29 `f707ffe`: 上書き設定を週ごとのドキュメント `weekly_override_<月曜キー>` に分割。旧来の単一ドキュメント `weekly_override` は後方互換として読み続けている。あわせて、特別イベント週（`isManualOverride`）は「水曜解禁なし」「種目の補充なし」になった

### バッジ以外の副作用

`isManualOverride: true` になると、次の2つの処理も止まる。

- 4種目目の水曜13時の解禁（`getActiveWeeklyKeys` の `revealAll`）
  - React版 `web/src/lib/time-jst.ts:99`、旧版 `app.js:6210`
- 進行中の週の種目数の補充（`maybeUpgradeCurrentWeekExercises`）
  - React版 `web/src/lib/weekly-engine.ts:108`、旧版 `app.js:6591`

## 3. 修正時の注意点：種目数の既定値が食い違っている

`weekly_config` に種目数（`exerciseCount`）が無いときの既定値が、場所によって違う。

| 場所 | 既定値 |
|---|---|
| `app.js:6348`（getWeeklyConfig） | **4** |
| `web/src/lib/weekly-engine.ts:79`（getWeeklyConfig） | **4** |
| `analytics/select-weekly.js`（`cfg.exerciseCount \|\| 3`） | 3 |
| `admin.html:869` 付近（設定画面の表示） | 3 |
| `web/src/lib/exercise-insights.ts:179`（選出確率） | 3 |

今「3種目」で回っている理由として、次の2つが考えられる。

- (a) `weekly_config.exerciseCount = 3` が明示的に設定されている → 問題なし
- (b) 未設定のまま、「スクリプトの既定値が3」と「特別イベント扱いで補充が止まっている」が偶然かみ合って3種目になっている

(b) の場合、バッジの不具合だけを直すと補充が動き出し、水曜に4種目目が追加されてしまう。**既定値を3に揃える修正をセットで入れること。**

## 4. 未確認事項（次の担当が最初に確認する）

- [ ] Firestore の `settings_free/weekly_config` に `exerciseCount` があるか。値は3か
  - このセッションからは本番の Firestore を読めなかった（サービスアカウント鍵は `analytics/serviceAccountKey.json` のローカルPCにしか無い）
- [ ] `settings_free/weekly_override` の現在の中身。`generatedBy: 'select-weekly.js'` が入っているか
- [ ] 今週の `settings_free/weekly_challenge` が `isManualOverride: true` / `overrideSource: 'admin'` になっているか
- [ ] スクリプトが動かなかった週は、本当にバッジが出ていないか（任意。`weekly_challenge_history` には上書きのフラグが残らないので、確認するならユーザーへの聞き取りで）

## 5. 修正方針（ユーザーの承認待ち）

### ① 選出スクリプトの書き込みは通常週として扱う（本命の修正）

- 上書き設定に `generatedBy === 'select-weekly.js'` が付いていれば「自動選出の予約」とみなす
  - `weekly_challenge` には `isManualOverride: false`、`overrideLabel: null` で書き込む
  - 種目はスクリプトが選んだものをそのまま使う
  - 選出履歴の加算は今までどおり行う
- 印はすでに既存データに付いているので、**アプリ側の修正だけで次の週の切り替えから直る**。ローカルPCのスクリプトを更新しなくても効く
- React版と旧版の両方を直すこと。両方が同じ Firestore を読み書きしている
  - `web/src/lib/weekly-engine.ts`: `applyOverride` 付近、`OverrideDoc` 型に `generatedBy` を追加
  - `app.js`: `applyOverride` 付近
  - 判定を純粋関数にするなら `web/src/lib/special-event.ts`（`planWeeklyOverride` か、新しい関数）に置き、`web/src/lib/__tests__/special-event.test.ts` にテストを追加する
- 任意: `select-weekly.js` 側にも `source: 'auto_select'` などを明示的に書き足すと、意図が読みやすくなる。ただしアプリ側は `generatedBy` で判定できるので必須ではない
- 書き込み先を別ドキュメントに移す案もある。しかし `analytics/weekly-analytics.js:842`（`buildNextWeekConfirmed`）、`export-firestore.js:118`、`publish-report.js:136` が `weekly_override` を読んでいて影響範囲が広いので、採用しない

### ② 通常週は3種目に固定する

- `app.js:6348` と `web/src/lib/weekly-engine.ts:79` の既定値 `exerciseCount` を 4 → 3 に変える
- 通常週の構成は `normalCount: 2` と `barbarianCount: 1`（タイムアタック）に、水曜解禁の追加枠（`revealCount = exerciseCount - 3`）を足したもの。`exerciseCount` を3にすれば追加枠は0になる

### ③ 特別イベントは現状のまま

- `SPECIAL_EVENT_EXERCISE_COUNT = 4`（`web/src/lib/special-event.ts:32`、旧版は `app.js:12099` 付近）は変えない
- 本物の特別イベントの書き込み先は週ごとのドキュメント `weekly_override_<月曜キー>` で、`source: 'special_event_proposal'` と `proposalId` が付く。区別は確実にできる
- 管理画面からの手動上書き（`admin.html` の `saveWeeklyOverride`）も週ごとのドキュメントに `source: 'admin'` 付きで書かれる。こちらは引き続き特別イベント扱いでよい

### ④ 今週ぶんの後始末（手作業）

- 今週はすでに `isManualOverride: true` で保存済みなので、コードを直しても来週の切り替えまでバッジが残る
- すぐ消したい場合: Firestore コンソールで `settings_free/weekly_challenge` の `isManualOverride` を `false`、`overrideLabel` を `null` にする
- 管理画面の「今週を強制再選定」は**使わない**。種目まで選び直されてしまう

## 6. 修正後に確認すること

- `cd web && npm test`（vitest）と型チェックが通る
- ケースごとの期待結果
  - スクリプト由来の上書き設定（`generatedBy: 'select-weekly.js'`）→ 通常週。バッジなし、3種目
  - 週ごとのドキュメントの承認済み特別イベント → 特別イベント週。バッジあり、4種目、月曜から全公開
  - 両方が同じ週にある → 特別イベントが優先される（`planWeeklyOverride` の既存の挙動）
  - 上書き設定が無い → アプリが自分で選出し、3種目
- `analytics` 側（digest の `nextWeekConfirmed`）は `weekly_override` の読み方を変えないので影響なし

## 7. 関連ファイル一覧

| ファイル | 役割 |
|---|---|
| `analytics/select-weekly.js` | 日曜の自動選出 → `weekly_override` への書き込み（原因の発生源） |
| `analytics/announce.bat` / `analytics/package.json` | タスクスケジューラから実行される `npm run announce` |
| `web/src/lib/weekly-engine.ts` | React版の週の切り替え・上書きの適用・設定の既定値 |
| `web/src/lib/special-event.ts` | `planWeeklyOverride`、特別イベントの定数（4種目） |
| `web/src/lib/special-event-engine.ts` | 承認された特別イベントを週ごとのドキュメントへ書き込む処理 |
| `web/src/lib/time-jst.ts` | 水曜解禁の判定（`activeWeeklyKeysOf`） |
| `web/src/features/weekly/ThisWeek.tsx` | 「特別イベント」バッジの表示 |
| `app.js` | 旧版。同じロジックの写し（6348, 6591, 6655〜, 6758, 7002 行付近） |
| `admin.html` | 管理画面（手動上書き・強制再選定・種目数の設定） |
| `firestore.rules` | `settings_free` は認証済みなら読み書きできる（今回の原因ではない） |
