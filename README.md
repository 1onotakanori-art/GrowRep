# GrowRep - 筋トレ成果報告アプリ

少人数で行う筋トレ大会に向けた成果報告・ランキング表示用のWebアプリです。

## 目次

- [機能概要](#機能概要)
- [技術スタック](#技術スタック)
- [開発環境](#開発環境)
- [セットアップ手順](#セットアップ手順)
- [セキュリティ](#セキュリティ)
- [コーディング規約](#コーディング規約)
- [開発ワークフロー](#開発ワークフロー)
- [使い方](#使い方)
- [トラブルシューティング](#トラブルシューティング)

## 機能概要

### MVP機能（現在実装済み）
- ✅ ログイン・新規登録（Firebase Authentication）
- ✅ トレーニング記録の投稿（種目・回数/秒数）
- ✅ 掲示板形式での投稿表示
- ✅ 種目別ランキング表示（最高記録）
- ✅ 個人の成長グラフ表示
- ✅ いいね機能
- ✅ コメント機能
- ✅ 投稿削除機能（投稿者本人のみ）

### 対応種目
1. 腕立て伏せ
2. ディップス
3. 片足スクワット
4. L-Sit（秒数）
5. 懸垂サーキット（セット数）

## セットアップ手順

### 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例：GrowRep）
4. Google アナリティクスは任意（オフでもOK）
5. プロジェクト作成完了

### 2. Firebase Authentication の設定

1. Firebase Console で「Authentication」を選択
2. 「始める」をクリック
3. 「Sign-in method」タブを開く
4. 「メール/パスワード」を有効化
5. 保存

### 3. Cloud Firestore の設定

1. Firebase Console で「Firestore Database」を選択
2. 「データベースの作成」をクリック
3. 「本番環境モードで開始」を選択
4. ロケーションを選択（asia-northeast1 推奨）
5. 「ルール」タブで以下のセキュリティルールを設定：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 認証済みユーザーのみアクセス可能
    match /posts/{postId} {
      // 誰でも読み取り可能
      allow read: if request.auth != null;
      // 認証済みユーザーは作成可能
      allow create: if request.auth != null;
      // 投稿者本人のみ更新・削除可能
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

### 4. Firebase設定情報の取得と設定

1. Firebase Console のプロジェクト設定（⚙️アイコン）を開く
2. 「マイアプリ」セクションで「Web」アプリを追加
3. アプリのニックネーム（例：GrowRep Web）を入力→「GrowRepWeb」で登録
4. Firebase Hosting は設定不要（スキップ）
5. 表示される設定情報をコピー

6. `firebase-config.js` を開き、以下の部分を書き換え：

```javascript
const firebaseConfig = {
    apiKey: "あなたのAPIキー",
    authDomain: "あなたのプロジェクトID.firebaseapp.com",
    projectId: "あなたのプロジェクトID",
    storageBucket: "あなたのプロジェクトID.appspot.com",
    messagingSenderId: "あなたのメッセージ送信者ID",
    appId: "あなたのアプリID"
};
```

### 5. ローカルでの動作確認

1. このプロジェクトフォルダをローカルサーバーで開く：

**方法1: VS Code の Live Server 拡張機能を使用**
- Live Server 拡張機能をインストール
- `index.html` を右クリック → "Open with Live Server"


2. ブラウザで動作確認
   - 新規登録でアカウント作成
   - ログイン
   - トレーニング記録を投稿
   - 掲示板、ランキング、グラフの表示確認

### 6. GitHub Pages へのデプロイ

1. GitHubで新しいリポジトリを作成

2. ローカルでGit初期化とプッシュ：
```bash
git init
git add .
git commit -m "Initial commit: GrowRep app"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
git push -u origin main
```

3. GitHubリポジトリの Settings を開く

4. 左サイドバーの「Pages」を選択

5. Source を「Deploy from a branch」に設定

6. Branch を「main」、フォルダを「/ (root)」に設定

7. Save をクリック

8. 数分後、`https://あなたのユーザー名.github.io/リポジトリ名/` でアクセス可能に

### 7. Firebase の認証ドメインにGitHub Pagesを追加

1. Firebase Console の Authentication を開く
2. 「Settings」タブ → 「承認済みドメイン」
3. 「ドメインを追加」をクリック
4. `あなたのユーザー名.github.io` を追加
5. 保存

## 使い方

### 参加者の登録
1. アプリにアクセス
2. 「新規登録」をクリック
3. メールアドレスとパスワードを入力（パスワードは6文字以上）
4. アカウント作成完了

### 記録の投稿
1. ログイン後、「投稿」タブを開く
2. 種目を選択
3. 回数または秒数を入力
4. 「投稿する」をクリック

### 掲示板の確認
- 「掲示板」タブで全員の投稿を確認
- いいねボタンで応援
- コメントで励まし合い

### ランキングの確認
- 「ランキング」タブで種目別の最高記録を確認
- 1位〜3位は特別な色で表示

### 成長グラフの確認
- 「成長グラフ」タブで自分の記録の推移を確認
- 種目を切り替えて表示

## 技術スタック

- **フロントエンド**: HTML, CSS, JavaScript (ES2021)
- **認証**: Firebase Authentication
- **データベース**: Cloud Firestore
- **グラフ**: Chart.js
- **ホスティング**: GitHub Pages
- **開発ツール**: VS Code + GitHub Copilot
セキュリティ

本アプリは以下のセキュリティ対策を実装しています：

### 1. Firebase セキュリティルール（必須）
- 認証済みユーザーのみが読み書き可能
- 投稿の削除は投稿者本人のみ許可
- いいねの重複防止

**重要**: Firestoreのセキュリティルールを必ず設定してください（`firestore.rules` を参照）

### 2. XSS対策
- すべてのユーザー入力値に対してHTMLエスケープ処理を実施
- `innerHTML` 使用時は必ずエスケープ済みデータを使用

### 3. バリデーション
- クライアント側での入力検証（種目、数値範囲、文字数制限）
- Firestoreルールでのサーバー側検証

### 4. APIキー管理
- Firebase APIキーはクライアント側使用を前提とした公開情報
- セキュリティはFirestoreルールとAuthenticationで制御
- 本番環境では以下を推奨：
  - Firebase ConsoleでAPIキー制限を設定
  - 承認済みドメインの制限
  - `.gitignore` で不要なファイルを除外

### 5. 依存パッケージの監査
```bash
# 定期的に実行を推奨
npm audit
```

## コーディング規約

### JavaScript
- **標準**: ES2021
- **命名規則**: 
  - 変数・関数: `camelCase`
  - 定数: `UPPER_SNAKE_CASE`（グローバルのみ）
- **フォーマット**: Prettier（`.prettierrc` 参照）
- **Lint**: ESLint（`.eslintrc.json` 参照）

### コミットメッセージ
Conventional Commits 形式を推奨：
```
feat: 新機能追加
fix: バグ修正
chore: 雑務（依存関係更新など）
docs: ドキュメント更新
style: コードスタイル修正
refactor: リファクタリング
test: テスト追加・修正
```

###QA / 動作確認チェックリスト

デプロイ前に以下を確認してください：

- [ ] 未ログイン状態でログイン画面が表示される
- [ ] メール/パスワードでログインできる
- [ ] 新規登録ができる
- [ ] 投稿フォームから記録を投稿できる
- [ ] 投稿が掲示板に反映される
- [ ] いいね機能が動作する
- [ ] コメント機能が動作する
- [ ] 投稿者本人のみ削除ボタンが表示される
- [ ] 種目別ランキングが正しく表示される
- [ ] 成長グラフが表示される
- [ ] Firestoreセキュリティルールが設定されている

## 今後の拡張予定

- [ ] プロフィール画像の設定
- [ ] 通知機能
- [ ] 大会モード（期間限定の集計）
- [ ] 目標設定機能
- [ ] バッジ・実績システム
- [ ] GitHub Actions（CI/CD）

## プロジェクトファイル

```
GrowRep/
├── index.html                  # メインHTML
├── styles.css                  # スタイルシート
├── app.js                      # アプリケーションロジック
├── firebase-config.js          # Firebase設定（要編集）
├── firestore.rules             # Firestoreセキュリティルール
├── .gitignore                  # Git除外設定
├── .prettierrc                 # Prettierフォーマット設定
├── .eslintrc.json              # ESLint設定
├── README.md                   # このファイル
├── ENV_AND_RULES.md            # プロジェクト構想・開発ルール
└── DEVELOPMENT_WORKFLOW.md     # GitHub開発フロー・ブランチ戦略
```

## 参考リンク

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [GitHub Pages Documentation](https://docs.github.com/pages)
- [Chart.js Documentation](https://www.chartjs.org/docs/)

## ライセンス

このプロジェクトは個人利用を目的としています。

## サポート・貢献

質問や提案がある場合は、GitHub Issuesを作成してください。

---

作成日: 2026年1月23日  
💪 Let's Grow Together!
# 新機能開発
git checkout -b feature/add-notification
# ... 開発作業 ...
git add .
git commit -m "feat: 通知機能を追加"
git push origin feature/add-notification
# GitHub でPR作成 → レビュー → マージ
```

## 料金について

- Firebase無料プラン（Spark）で運用可能
- 参加者6人、テキストデータのみで無料枠内に収まる想定
- 詳細: [Firebase料金プラン](https://firebase.google.com/pricing)

**注意**: 将来的にユーザー数やデータ量が増える場合はプラン変更を検討
- **エディタ**: VS Code
- **バージョン管理**: Git
- 直接 `index.html` を編集 → GitHub Pages に push

### 推奨構成（軽量モダン開発）
- **Node.js**: LTS推奨（18.x以上）
- **パッケージマネージャ**: npm（デフォルト）/ yarn / pnpm
- **開発サーバー**: Vite（軽量）または http-server
- **フォーマッター**: Prettier（`.prettierrc` 提供済み）
- **Lint**: ESLint（`.eslintrc.json` 提供済み）

**推奨セットアップ:**
```bash
# Node環境を使う場合
npm install -D vite prettier eslint

# 開発サーバー起動
npx vite

# コードフォーマット
npx prettier --write .

# Lint実行
npx eslint .
```

**注意**: 最小構成でも問題なく動作します。Node環境はオプションです。

## 料金について

- Firebase無料プラン（Spark）で運用可能
- 参加者6人、テキストデータのみで無料枠内に収まる想定
- 詳細: [Firebase料金プラン](https://firebase.google.com/pricing)

## トラブルシューティング

### ログインできない
- Firebase Authentication が有効化されているか確認
- メール/パスワード認証が有効になっているか確認
- ブラウザのコンソールでエラーを確認

### 投稿が表示されない
- Cloud Firestore が作成されているか確認
- セキュリティルールが正しく設定されているか確認
- ブラウザのコンソールでエラーを確認

### GitHub Pages で動作しない
- Firebase の承認済みドメインに GitHub Pages のドメインを追加
- firebase-config.js の設定が正しいか確認

## 今後の拡張予定

- [ ] プロフィール画像の設定
- [ ] 通知機能
- [ ] 大会モード（期間限定の集計）
- [ ] 目標設定機能
- [ ] バッジ・実績システム

## ライセンス

このプロジェクトは個人利用を目的としています。

---

作成日: 2026年1月23日
