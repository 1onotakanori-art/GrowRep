# GrowRep - 筋トレ成果報告アプリ

少人数（6人程度）の筋トレ仲間で、記録を投稿・共有して競い合うための Web アプリです。
フリー（自由種目）・週間チャレンジ・レイド・ドロップセットの4モードと、デイリーミッション、
週報（ウィークリー）などがあります。

- **メインのアプリ: [`web/`](web/)**（Vite + React + TypeScript、Vercel で配信）
- バックエンド: Firebase（Authentication + Cloud Firestore、プロジェクト `growrep-65c18`）
- 旧版（リポジトリ直下の `index.html` / `app.js`、GitHub Pages で配信）は閉じる予定です。
  移行が終わるまで、Pages が読むファイルは直下に置いたままにしています（動かすと旧版の URL が切れるため）。

## フォルダ構成

```
GrowRep/
├── web/                     # ★ メインのアプリ（Vercel）。開発・テストの手順は web/README.md
│   └── src/
│       ├── views/           #   画面（ボトムナビの各タブ）
│       ├── features/        #   画面の部品（機能ごと）
│       ├── lib/             #   ロジック。〇〇.ts＝純粋関数（テストあり）、〇〇-engine.ts＝Firestore 読み書き
│       ├── context/ hooks/  #   共有状態
│       └── shell/ components/ styles/
├── analytics/               # 週次の分析・週報配信・意見箱の回収（手元PCで実行）。手順は analytics/README.md
├── docs/                    # 設計メモ・開発ルール（docs/README.md に一覧）
├── scripts/                 # 手元から流すスクリプト（Firestore ルールのデプロイなど）。scripts/README.md
├── .claude/skills/          # Claude Code 用の手順（意見箱の対応など）
├── .github/workflows/       # CI（Web CI＝web のテスト、Pages 配信、ルール配信）
├── firestore.rules          # Firestore セキュリティルール（変更したら scripts/deploy-firestore-rules.sh）
├── firebase.json / .firebaserc
│
│   ── 以下は旧版（GitHub Pages）。Pages を閉じるときにまとめて片付ける ──
├── index.html  app.js  styles.css  icon-style.css
├── firebase-config.js  firebase-config.template.js
├── admin.html               # 管理画面（週間チャレンジの手動調整・レイドの目標など）
├── exercises.html           # 種目 & 評価（web の「種目 & ルール」に移植済み）
├── report.html  report.js   # 週報（web の「ウィークリー」に移植済み）
└── icon-preview.html        # 種目アイコンの確認用
```

## よく使うコマンド

```bash
# アプリの開発（web/）
cd web && npm install && npm run dev      # http://localhost:5173
cd web && npm test                        # ユニットテスト（vitest）
cd web && npm run build                   # 型チェック + ビルド

# Firestore ルールを本番へ反映（CI では配信されない）
./scripts/deploy-firestore-rules.sh
```

週次の分析・週報の配信・意見箱の回収は [`analytics/README.md`](analytics/README.md) を参照。

## 開発の流れ

- `main` へは PR 経由で入れる。`main` は Web CI（`test`）の通過が必須で、PR に自動マージを設定しておけば通った時点でマージされる
- 設計メモ・開発ルールは [`docs/`](docs/README.md)
- 旧版のセットアップ手順（GitHub Pages・Firebase の初期設定）は
  [`docs/legacy/README-github-pages.md`](docs/legacy/README-github-pages.md) に残してある
