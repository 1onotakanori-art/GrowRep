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

## 特別イベントウィーク（ユーザー提案 → 3人承認）

マイページの「特別イベント提案」から、**4種目 / 開始日（月曜）/ 承認者3人**を選んで
週間チャレンジの差し替えを提案できます。

- **開始日**は月曜のみ。次週の月曜から4週分が選択肢（週境界は既存と同じ日曜17:00 JST）
- **承認者**は「前週の週間チャレンジに投稿したユーザー」から3人（自分とゲストは除外）
- 承認者に選ばれた人は、**アプリを開くたびにポップアップ**で承認/否認を求められます。
  承認か否認を選ぶまで閉じられないため、回答漏れが起きません
  （判断できるよう、各種目の**名前とルール**をポップアップ内に表示）
- **3人全員が承認**すると `settings_free/weekly_override` に書き込まれ、対象週の
  週間チャレンジがその4種目になります。**1人でも否認すれば却下**
- 回答状況はマイページの「イベント承認」から確認できます

Firestore コレクション `special_event_proposals`（1提案 = 1ドキュメント）:

```javascript
{
  proposerId, proposerName,        // 提案者
  exercises: [key, key, key, key], // 種目キー4件
  exerciseNames: [...],            // 表示用スナップショット
  targetWeekStart: Timestamp,      // 対象週の開始（日曜17:00 JST）
  mondayKey: '2026-09-07',         // 対象週の月曜（JST）
  periodLabel: '9/7(月)〜9/11(金)',
  label,                           // weekly_override.label に入る文言
  approverIds: [uid, uid, uid],
  approverNames: { uid: '名前' },
  responses: { uid: { decision: 'approved' | 'rejected', at } },
  status: 'pending' | 'approved' | 'rejected',
  createdAt, updatedAt
}
```

セキュリティルール（`firestore.rules`）では、作成は提案者本人のみ、更新は
**承認者本人が `responses` / `status` / `updatedAt` を変更する場合のみ**許可しています。

### ⚠️ 週間ロジックの二重管理に関する注意

`lib/time-jst.ts` / `lib/scoring.ts` / `lib/weekly-select.ts` / `lib/weekly-engine.ts`
/ `lib/derby.ts` / `lib/special-event.ts` / `lib/special-event-engine.ts` は、
リポジトリ直下 `app.js` の同名関数の**ミラー**です。両アプリが
同じ `settings_free/weekly_challenge` などを読み書きするため、片方の仕様（JST 境界・
抽選重み・確定タイミング・フィールド形状）を変えたら、**必ずもう片方も同じに更新**して
ください。ズレると週データが破損する可能性があります。
