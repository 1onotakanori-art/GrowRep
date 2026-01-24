# GrowRep - 筋トレ成果報告アプリ

## プロジェクト構想

このアプリは、少人数（6人程度）で行う筋トレ大会に向けた成果報告・ランキング表示用のWebアプリです。

### 開発の背景
- 2026年5月に筋トレ大会を予定
- 参加者: 6人（変動の可能性あり）
- 競技種目: 5種類
- 目的: 日々のトレーニング成果を記録・共有し、モチベーション維持・向上

### 開発方針
1. **シンプルさ重視**: 使いやすさを最優先
2. **段階的実装**: MVP → 機能追加
3. **SNS的機能は最小限**: いいね・コメント程度
4. **不正防止は不要**: 参加者間の信頼ベース

## 技術構成

### フロントエンド
- HTML / CSS / JavaScript
- Chart.js（グラフ表示）

### バックエンド
- Firebase Authentication（ログイン管理）
- Cloud Firestore（データ保存）

### ホスティング
- GitHub Pages

### コスト
- Firebase 無料プラン（Spark）で運用
- 6人規模、テキストデータのみで無料枠内想定

## 機能一覧

### MVP機能（✅ 実装済み）
1. ログイン・新規登録
2. トレーニング記録の投稿（種目・回数/秒数）
3. 掲示板形式での投稿表示
4. 種目別最高記録の表示（ランキング）
5. 個人の成長グラフ表示

### 追加機能（✅ 実装済み）
1. いいね機能
2. コメント機能
3. 投稿削除機能（投稿者本人のみ）

### 今後の拡張候補
- [ ] プロフィール画像
- [ ] 通知機能
- [ ] 大会モード（期間限定集計）
- [ ] 目標設定機能
- [ ] バッジ・実績システム

## 対応種目

1. **腕立て伏せ** (pushup) - 回数
2. **ディップス** (dips) - 回数
3. **片足スクワット(左右合計)** (squat) - 回数
4. **Lシット** (Lsit) - 秒数
5. **懸垂** (pullup) - セット数

## データ構造

### 現在の実装（配列ベース）

#### users コレクション
```javascript
{
  userId: string,           // ユーザーID（認証UIDと同じ）
  email: string,            // メールアドレス
  userName: string,         // ユーザー名（2〜20文字、一意）
  createdAt: Timestamp,     // アカウント作成日時
  updatedAt: Timestamp      // 最終更新日時
}
```

#### posts コレクション
```javascript
{
  userId: string,           // ユーザーID
  userEmail: string,        // ユーザーのメールアドレス
  exerciseType: string,     // 種目（pushup, dips, squat, Lsit, pullup）
  value: number,            // 回数または秒数またはセット数（1〜10000）
  timestamp: Timestamp,     // 投稿日時
  likes: [string],          // いいねしたユーザーIDの配列
  comments: [               // コメントの配列（最大500文字）
    {
      userId: string,
      userEmail: string,
      text: string,
      timestamp: string
    }
  ]
}
```

**注意**: 提供いただいた要件ではサブコレクション構造が提案されていますが、現在の実装は配列ベースです。将来的にスケールが必要な場合は以下の構造への移行を検討してください。

### 代替案（サブコレクション構造）

```javascript
// posts/{postId}
{
  userId: string,
  userEmail: string,
  exerciseType: string,
  value: number,
  createdAt: timestamp,
  likeCount: number
}

// posts/{postId}/likes/{userId}
{
  createdAt: timestamp
}

// posts/{postId}/comments/{commentId}
{
  userId: string,
  userEmail: string,
  text: string,
  createdAt: timestamp
}

// users/{userId} (未実装)
{
  name: string,
  email: string,
  createdAt: timestamp
}
```

**利点**: 
- 大量のいいね/コメントでもパフォーマンス維持
- クエリの柔軟性向上

**欠点**: 
- 実装が複雑
- トランザクション処理が必要
```

## 開発スタンス

- VS Code + GitHub Copilot を活用
- 設計意図を日本語で伝えながら開発
- まずは動くものを作り、段階的に改善

## セキュリティ考慮事項

### Firestore セキュリティルール
- 認証済みユーザーのみアクセス可能
- 投稿者本人のみ自分の投稿を削除可能
- 詳細は `firestore.rules` を参照

### 認証
- Firebase Authentication でメール/パスワード認証
- 参加者のみがアクセスできる想定

## 運用上の注意点

1. **Firebase設定の秘匿化**
   - 公開リポジトリの場合、API キーは公開される
   - Firebase のセキュリティルールで保護
   - 必要に応じて環境変数化を検討（Vite使用時は `.env.local` を使用）
   - `.gitignore` で環境変数ファイルを除外

2. **ドメイン承認**
   - GitHub Pages のドメインを Firebase の承認済みドメインに追加

3. **無料枠の監視**
   - Firebase Console で使用量を定期的に確認
   - 参加者6人規模では問題ないはず

4. **定期的なセキュリティチェック**
   - 依存パッケージの脆弱性チェック（`npm audit`）
   - Firestoreセキュリティルールの見直し
   - Firebase Console での異常なアクセスログの確認

## 実装済みのセキュリティ対策

### XSS対策
- `escapeHtml()` 関数によるユーザー入力のエスケープ
- すべての表示箇所でエスケープ処理を実施

### バリデーション
- 種目の検証（定義済み種目のみ許可）
- 数値範囲の検証（1〜10000）
- コメント文字数制限（500文字以内）

### Firebase セキュリティ
- 認証済みユーザーのみアクセス可能
- 投稿者本人のみ削除可能
- API キー制限推奨（Firebase Console で設定）

## ファイル構成

```
GrowRep/
├── index.html                  # メインHTML
├── styles.css                  # スタイルシート
├── app.js                      # アプリケーションロジック
├── firebase-config.js          # Firebase設定
├── firestore.rules             # Firestoreセキュリティルール
├── .gitignore                  # Git除外設定
├── .prettierrc                 # Prettierフォーマット設定
├── .eslintrc.json              # ESLint設定
├── README.md                   # セットアップ手順
├── ENV_AND_RULES.md            # このファイル（構想・ルール）
└── DEVELOPMENT_WORKFLOW.md     # GitHub開発フロー・ブランチ戦略
```

## 開発履歴

- 2026年1月23日: プロジェクト初期化、MVP実装完了

---

💪 一緒に成長しよう！ Let's Grow Together!
