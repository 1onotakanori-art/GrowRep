# ドロップセットモード 設計

ベンチプレスのようなウェイト種目で、**同じ重量で 10回 → 8回 → 6回** をこなせたら
その重量を「クリア」とし、次の重量へ進む。クリアできなければ「停滞」として
同じ重量に挑戦し続ける。GrowRep の4つ目のモードとして追加する。

---

## 1. 決定事項

| 項目 | 決定 |
|---|---|
| 実装対象 | **`web/`（Vercel 版）のみ**。`app.js` / `index.html` は一切変更しない |
| モード | `free` / `weekly` / `raid` に続く4つ目 `dropset` |
| セット構成 | 全種目共通で**同一重量の 10-8-6 固定** |
| クリア判定 | 3セットすべて目標回数以上で、その重量をクリア |
| 未達（停滞） | 記録は残るが未クリア。次回も同じ重量が提案される |
| 次の重量 | 種目ごとの**刻み幅**（既定 2.5kg）を加算して提案。**入力欄は編集可** |
| ランキング | 種目ごとに**クリア済み最大重量の絶対値**で降順。得点化・レーダーはしない |
| 見え方 | 専用モード内で完結 ＋ **フィード（掲示板）にも流す** ＋ **重量推移グラフ** |

---

## 2. なぜ種目マスタを別ドキュメントに分けるのか

「他モードに影響しないフラグ」を `settings_free/exercises` に
`dropset: true` として持たせる案は **採れない**。

週間チャレンジの種目抽選とデイリーミッションの種目選出は `app.js` と `web/` の
**二重実装**であり、どちらが先に走っても同じ結果になるよう、同じ
`settings_free/exercises` を読んでいる（`app.js: selectWeeklyExercisesWithBarbarianSlot`、
`web/src/lib/weekly-engine.ts`）。フラグ方式にすると **`app.js` 側の抽選プールにも
除外処理を入れないと、ドロップセット種目が週間チャレンジに選ばれてしまう**。
これは「`web/` のみを変更する」という前提を壊す。

そこで **`settings_dropset/exercises` という独立したドキュメント**に分離する。
`app.js` はその存在を知らないため、週間チャレンジ・デイリーミッション・レイド・
フリー投稿・種目評価のどのプールにも**構造的に入りようがない**。
除外コードがゼロで済むのが最大の利点。

---

## 3. データモデル

### `settings_dropset/exercises`（新規コレクション）

```js
{
  exercises: {
    "ds_1758400000000": {
      name: "ベンチプレス",
      rule: "尻を浮かせない。バーが胸に触れるまで下ろす。",
      icon: "fa-dumbbell",
      tags: ["胸", "ウェイト"],
      startWeight: 40,      // kg: 初挑戦時に提案される重量
      step: 2.5,            // kg: クリア時の増加幅（種目ごと）
      createdBy: "<uid>",
      createdByName: "たかのり",
      createdAt: "2026-09-21T..."
    }
  },
  updatedAt: <serverTimestamp>
}
```

### `posts_dropset/{postId}`（新規コレクション）

```js
{
  userId: "<uid>",
  userEmail: "...",
  exerciseType: "ds_1758400000000",
  weight: 60,               // 挑戦した重量(kg)
  reps: [10, 8, 5],         // 実際にできた回数
  target: [10, 8, 6],       // 判定時の目標（将来変更しても過去記録が壊れないよう保存）
  cleared: false,           // reps[i] >= target[i] を全て満たすか
  timestamp: <serverTimestamp>,
  likes: [],
  comments: []
}
```

設計上のポイント2つ:

- **`value` フィールドを持たせない。** 既存の集計はすべて `value: number` を前提に
  動くため、万一コレクションが混線しても数値として拾われない形にしておく安全策。
- **種目キーの接頭辞は `ds_`。** `app.js` には「`posts_free` に残っているが種目マスタに
  ない `free_` キーを拾って復元を促す」機能があり（`app.js: findDeletedExercises`）、
  接頭辞が違えば仮に混入しても拾われない。二重の保険。

### 進捗（今の重量）はドキュメントを持たない

ユーザーごとの「今の重量」は `posts_dropset` から導出する。

```
clearedMax = max(weight)  where userId一致 && cleared === true
提案重量   = clearedMax != null ? clearedMax + step : startWeight
```

進捗ドキュメントを別途持つと投稿との同期ズレが必ず起きるため、**投稿を単一の真実**
とする。6人規模なので読み込み量は問題にならない。

---

## 4. 判定ロジック（`web/src/lib/dropset.ts`）

純粋関数のみ。Firestore に依存しないのでユニットテスト可能
（`web/src/lib/__tests__/dropset.test.ts`）。

```ts
export const TARGET_REPS = [10, 8, 6];
export const DEFAULT_STEP = 2.5;
export const DEFAULT_START_WEIGHT = 20;

isCleared(reps, target?)          // reps[i] >= target[i] を全て満たすか
shortfallOf(reps, target?)        // 目標に届かなかったセットの「あと何回」
progressOf(posts, userId, exKey, ex)
  // → { clearedMax, suggestedWeight, lastAttempt, attempts, stalledCount }
rankByClearedWeight(posts, exKey) // クリア重量の降順（同値は達成が早い順）
weightHistory(posts, userId, exKey)
  // → 重量推移グラフ用の階段データ（クリアした瞬間の履歴）
buildStepChart(points, geom)      // 階段グラフの座標と SVG パス
validateAttempt(weight, reps)     // 入力検証
```

グラフの座標計算も描画から切り離してここに置く。SVG の見た目は目視でしか
確認できないが、階段の形・時間軸のスケール・Y軸の range はテストで固定できる。

**停滞カウント** (`stalledCount`) は、現在の提案重量で連続して失敗した回数。
「あと1回」の表示や、何回も止まっている種目の見せ方に使う。

---

## 5. 画面構成

ボトムナビの7枠はそのまま使い、モードで中身を差し替える。

| タブ | `dropset` モードでの中身 |
|---|---|
| ホーム | 種目ごとの「現在 60kg / 次 62.5kg」サマリーカード一覧 |
| デイリー | 既存のまま（デイリーミッションはモード非依存の共通機能） |
| タイマー | 既存のインターバルタイマー（セット間レストに流用） |
| 投稿 | **挑戦フォーム**＋フィード |
| ランキング | 種目別・クリア重量の降順 |
| 中央（種目） | ドロップセット専用の種目管理 |
| マイページ | **重量推移グラフ**（`dropset` モードのときのみ差し替え） |

### 挑戦フォーム

1. 種目カードを開く
2. 重量入力（提案値が初期値として入っており、編集可）
3. 3セット分の回数をまとめて入力（目標 10 / 8 / 6 が各欄に表示される）
4. 送信 → 判定

判定フィードバック:

- `10-8-6` → **「60kg クリア！次は 62.5kg」**
- `10-8-5` → **「あと1回。次も 60kg に挑戦」**

### 重量推移グラフ

既存の `ProgressChart` と同じ**手書きインライン SVG**（チャートライブラリなし）。
クリアした重量の**階段グラフ**（`stepAfter`）として描画する。

- 横軸: クリアした日時
- 縦軸: クリア重量(kg)
- 種目セレクタで切り替え
- 統計: クリア回数 / 現在の重量 / 初回からの伸び (+◯kg)

未クリアの挑戦（停滞）は階段には現れない。重量が上がった瞬間だけが残る。

---

## 6. フィード統合と、その制約

`getPosts()` を `posts_free` と `posts_dropset` の両方から取得して
`timestamp` でマージする形に拡張し、`LoadedPost` に `kind`（`'free'` /
`'dropset'`）を持たせて、いいね・コメント・削除の書き込み先を出し分ける。

⚠️ **`posts_dropset` 側の取得失敗はフィード全体を落とさない。** ルールが
未デプロイの環境では権限エラーになるため、そこでフリー/週間/レイドの
フィードまで止まると影響が大きい。失敗時は警告を出してフリーの投稿だけ表示する。

カードはドロップセット専用の見た目:

```
ベンチプレス    60kg
                10-8-6  クリア
```

**制約**: `app.js`（GitHub Pages 版）の掲示板は `posts_free` しか読まないため、
**ドロップセットの記録はそちらには表示されない**。`web/` のみの実装という
前提の必然的な帰結。両方に出したい場合は `app.js` の改修が必要。

---

## 7. Firestore ルール

`posts_dropset` と `settings_dropset` を、既存の `posts_free` / `settings_free` と
同じパターンで追加する。

> **ルールは GitHub Actions では配信されない。**
> 追加後に `./scripts/deploy-firestore-rules.sh` の手動実行が必須。
> 忘れると `Missing or insufficient permissions.` としか出ず原因が分かりにくい。

---

## 8. 他モードへの非干渉（保証される理由）

| 機能 | 読む場所 | ドロップセット種目が混ざるか |
|---|---|---|
| 週間チャレンジ抽選 | `settings_free/exercises` | ✗ 別ドキュメント |
| デイリーミッション選出 | `settings_free/exercises` | ✗ 別ドキュメント |
| レイドの種目解決 | `settings_free/exercises` + タグ | ✗ 別ドキュメント |
| フリーモード投稿・ランキング・得点 | `settings_free` + `posts_free` | ✗ 別コレクション |
| 種目評価（★） | `exercise_ratings` | ✗ 評価 UI を出さない |
| `app.js` の削除種目復元 | `posts_free` の `free_` 接頭辞 | ✗ 別コレクション＋別接頭辞 |

---

## 9. 実装順

1. `lib/dropset.ts`（純ロジック）＋ 型追加 ＋ `lib/__tests__/dropset.test.ts`
2. `lib/dropset-engine.ts`（Firestore アクセス）＋ `firestore.rules`
3. `context/DropsetContext.tsx`（種目マスタ＋挑戦記録を5画面に供給）
4. `Mode` 型に `'dropset'` 追加 → Header のモードトグル（4つになるため折り返し対策）、
   BottomNav の中央タブ分岐、AppShell のビュー分岐
5. ドロップセット種目管理ビュー（追加・編集・削除）
6. 挑戦フォーム＋判定表示
7. ランキングビュー
8. 重量推移グラフ
9. フィード統合（2コレクションのマージ）

### データの読み方

`DropsetContext` は、**種目マスタ（ドキュメント1件）はどのモードでも読む**が、
**挑戦記録はドロップセットモードのときだけ読む**。フィードには全モードで
ドロップセットの投稿が流れるので種目名の解決が要る一方、進捗の計算に使う
挑戦記録は他モードでは不要なため。

---

## 10. スコープ外（今回は入れない）

- 単位は kg 固定。自重＋加重やマシンのピン番号は扱わない
- 「何回連続で停滞したら重量を下げる」といったデロード機能
- ドロップセット種目への種目評価（★）
- レップ構成のカスタマイズ（10-8-6 固定。`target` は保存しているので将来拡張可）
- `app.js`（GitHub Pages 版）への反映

---

## 11. 前提

- 種目の登録・編集・削除は全員が可能（既存のフリー種目と同じ「6人全員が管理者」方針）
- 挑戦する重量は自由入力。提案値はあくまで初期値なので、人によって開始重量が
  違っても、飛び級しても自然に扱える
