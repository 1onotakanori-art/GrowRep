# GrowRep Web (Vercel フロントエンド)

既存の GitHub Pages 版（リポジトリ直下）はそのまま残しつつ、Vercel 上に構築した
**軽量・モダン UI の新フロントエンド**です。バックエンド（Firebase プロジェクト
`growrep-65c18`）と Firestore データは GitHub Pages 版と**完全共有**します。

- フレームワーク: Vite + React + TypeScript（純粋な静的 SPA / SSR なし）
- モード: **フリー** / **週間チャレンジ** の2種類
- ログイン仕様は既存アプリと同一（メール・ゲスト共有アカウント）
- 週間チャレンジのロジック（種目抽選・チャンプ確定・履歴・予想・月間ダービー）は
  既存 `app.js` を**忠実に移植**し、両アプリで共存

## セットアップ（ローカル）

```bash
cd web
cp .env.example .env   # 値を埋める（下記）
npm install
npm run dev            # http://localhost:5173
```

### 環境変数（`web/.env`）

`.env.example` を参照。Firebase 設定（`VITE_FIREBASE_*`）と、ゲストログイン用の
共有アカウント（`VITE_GUEST_EMAIL` / `VITE_GUEST_PASSWORD`）を設定します。
`VITE_FIREBASE_API_KEY` 以外の Firebase 値は公開情報で、`.env.example` に記載済みです。

## テスト / ビルド

```bash
npm test          # 移植ロジックの数値パリティ検証（Vitest）
npm run build     # tsc 型チェック + 本番ビルド（dist/）
```

## Vercel デプロイ

1. Vercel で新規プロジェクトを作成し、このリポジトリを接続。
2. **Root Directory** を `web` に設定（リポジトリ直下は GitHub Pages のため触らない）。
   Framework=Vite / Build=`npm run build` / Output=`dist` は自動検出されます。
3. **Environment Variables** に `.env.example` の各キーを登録。
4. デプロイ後、**Firebase Console → Authentication → Settings → 承認済みドメイン**
   に Vercel の本番/プレビュードメイン（例: `xxx.vercel.app`）を追加。
   これを行わないとログインできません。

## 構成

```
web/src/
  lib/          Firebase・移植ロジック（time-jst / scoring / weekly-select /
                weekly-engine / derby / posts / exercises / ratings / users /
                special-event / special-event-engine）
  context/      Theme / Auth / Mode / Data / Toast / SpecialEvent
  shell/        Header / BottomNav / AppShell
  views/        Home / Post / Ranking / Exercises / MyPage / Challenge
  features/     auth / feed / post / ranking / exercises / progress / timer /
                weekly / profile / special
```

## 特別イベントウィーク（ユーザー提案 → 3人の承認/否認）

マイページの「特別イベント提案」から、**4種目 / 開始日（月曜）/ 承認者3人**を選んで
週間チャレンジの差し替えを提案できます。

- **開始日**は月曜のみ。次週の月曜から4週分が選択肢（週境界は既存と同じ日曜17:00 JST）。
  夏休みなどの休止週（`raid-mode.ts` の `WEEKLY_PAUSE_WEEK_KEYS`）は週間チャレンジ自体が
  動かないので「休止週」と表示して選べません
- **承認者**は「過去5日以内に1回でも投稿したユーザー」から3人（自分とゲストは除外）。
  種目や曜日では絞らないため `posts_free` を1クエリ引くだけで済み、候補は
  マイページを開いた時点で先読み＋5分キャッシュされるので待ち時間がほぼ無い
- 承認者に選ばれた人は、**アプリを開くたびにポップアップ**で承認/否認を求められます。
  承認か否認を選ぶまで閉じられないため、回答漏れが起きません
  （判断できるよう、各種目の**名前とルール**をポップアップ内に表示）
- **否認するときは理由コメントが必須**です（200文字以内）。他の人が先に否認していても、
  提案者に3人ぶんの意見を返すため、残りの承認者にも最後まで回答を求めます
- **3人ぶんの回答が揃った時点で結果が確定**します。全員承認なら
  `settings_free/weekly_override_<対象週の月曜キー>`（例 `weekly_override_2026-09-07`）に
  書き込まれ、対象週の週間チャレンジがその4種目になります。**1人でも否認していれば却下**。
  上書き設定を**週ごとのドキュメントに分けている**のは、別々の週を狙った承認済みイベントを
  同時に生かしておくため（単一ドキュメントだと、あとから承認された週の設定が
  前の週の設定を消してしまう）
- 特別イベント週は**月曜から4種目すべて公開**します。通常の週にある
  「4種目目は水曜13:00解禁（それまで ？？？）」は適用しません
  （承認者に4種目すべてを見せて承認させているため）。得点計算は通常週と同じで、
  4種目のうち**下位3種目**の合計です
- **同じ週に複数の提案を出せます**。あとから承認確定した提案がその週の種目になり、
  先に確定していた提案は上書きされます。上書きされた側の提案者には結果ポップアップで
  「別のイベントに差し替えられました」と、上書きした側のラベルを添えて表示します
- **回答が揃わないまま対象週が始まった提案は「期限切れ」**になります。Firestore の
  `status` は `pending` のままで、`targetWeekStart` と現在時刻から毎回導出します
  （`resolveDisplayStatus`）。期限切れは取り下げできず、提案者には結果ポップアップで
  知らせます。対象週が始まったあとの承認/否認は受け付けません
  （承認だけ通って設定が書けない＝提案者に嘘をつく状態を作らないため）
- 確定すると、**提案者にポップアップで結果を通知**します。否認された場合は
  否認した人ごとの理由コメントをそのまま表示します。「確認しました」を押すと
  `resultSeenAt` が書かれ、二度と表示されません
- 回答状況・否認理由はマイページの「イベント承認」からいつでも確認できます
- **回答が揃う前なら、提案者は自分の提案を取り下げられます**。「イベント承認」の
  「自分の提案」で回答待ちの提案に出る「取り下げる」ボタンから、確認を挟んで
  `status: 'withdrawn'` を書き込みます。取り下げた提案は承認者のポップアップにも
  提案者の結果ポップアップにも出てこなくなり、対象週も空きに戻ります。
  確定後（承認/否認）は上書き設定へ反映済みの可能性があるため取り下げ不可

Firestore コレクション `special_event_proposals`（1提案 = 1ドキュメント）:

```javascript
{
  proposerId, proposerName,        // 提案者
  exercises: [key, key, key, key], // 種目キー4件
  exerciseNames: [...],            // 表示用スナップショット
  targetWeekStart: Timestamp,      // 対象週の開始（日曜17:00 JST）
  mondayKey: '2026-09-07',         // 対象週の月曜（JST）
  periodLabel: '9/7(月)〜9/11(金)',
  label,                           // 上書き設定の label に入る文言
  approverIds: [uid, uid, uid],
  approverNames: { uid: '名前' },
  responses: {
    uid: {
      decision: 'approved' | 'rejected',
      at,
      comment: '否認理由（承認時は空文字）'
    }
  },
  // 3人の回答が揃うまで pending。withdrawn は提案者が自分で取り下げたもの
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn',
  createdAt, updatedAt,
  resultSeenAt,                    // 提案者が結果ポップアップを確認した時刻
  withdrawnAt                      // 提案者が取り下げた時刻
}
```

種目の組み合わせに制限はありません。週間チャレンジの**自動選出**はタイムアタック
（barbarian）種目をちょうど1つ含める仕様ですが、特別イベントは提案者が選んだ4種目を
そのまま上書き設定に流すため、タイムアタックを2つ以上選んでも、逆に0にしても
構いません。

### 上書き設定（`settings_free/weekly_override_<月曜キー>`）

```javascript
{
  exercises: [key, ...],           // その週の種目（提案の4種目 or 管理画面の3種目）
  label,                           // 週間チャレンジに出るラベル
  targetWeekStart: Timestamp,      // 対象週の開始（日曜17:00 JST）
  mondayKey: '2026-09-07',
  invalidated: false,              // 週切り替えで適用したら true（merge で立てる）
  source: 'special_event_proposal' | 'admin',
  proposalId,                      // 承認された提案のID（管理画面の手動上書きでは無い）
  setAt, setBy
}
```

週切り替え（`getOrUpdateWeeklyChallenge`）はこの週ごとドキュメントを最優先で読み、
無ければ旧形式の単一 `settings_free/weekly_override` を見ます。旧形式を無効化するのは
**対象週が過ぎたときだけ**で、まだ来ていない週を狙った設定は消しません（判定は
`planWeeklyOverride`）。適用済みの印は `merge` で立てるので `exercises` / `proposalId` は
残り、「その週にどの提案が採用されたか」をあとから読めます。

管理画面（`admin.html`）の「来週のチャレンジを手動設定」も同じ週ごとドキュメントに
書きます。その週に承認済みの特別イベントがある場合は確認ダイアログを挟んでから
上書きし、「今週を強制再選定」は**今週ぶんの設定だけ**を無効化します（来週以降を
狙った承認済みイベントの予約には触りません）。

セキュリティルール（`firestore.rules`）では、作成は提案者本人のみ、更新は次の3つだけ
許可しています。

- **承認者本人**が `responses` / `status` / `updatedAt` を変更する場合
  （`status` が `pending` の間だけ。取り下げ済み・確定済みの提案は書き換えられない）
- **提案者本人**が `pending` → `withdrawn` の取り下げをする場合
  （`status` / `withdrawnAt` / `updatedAt` 以外は触れない）
- **提案者本人**が `resultSeenAt` だけを変更する場合

取り下げは「別の承認者の回答で確定する」のと競合しうるので、両アプリとも
トランザクションで `status` を読み直してから書き込みます。

⚠️ `firestore.rules` は GitHub Actions のフロントエンド配信では反映されません。
変更したら `./scripts/deploy-firestore-rules.sh` を実行してください。未反映のままだと
`special_event_proposals` への書き込みが `Missing or insufficient permissions.` で
失敗します。

### ⚠️ 週間ロジックの二重管理に関する注意

`lib/time-jst.ts` / `lib/scoring.ts` / `lib/weekly-select.ts` / `lib/weekly-engine.ts`
/ `lib/derby.ts` / `lib/special-event.ts` / `lib/special-event-engine.ts` は、
リポジトリ直下 `app.js` の同名関数の**ミラー**です。両アプリが
同じ `settings_free/weekly_challenge` などを読み書きするため、片方の仕様（JST 境界・
抽選重み・確定タイミング・フィールド形状）を変えたら、**必ずもう片方も同じに更新**して
ください。ズレると週データが破損する可能性があります。
