# GrowRep Deploy Skill

このスキルは、GrowRep プロジェクトの**変更をコミット→プッシュ→GitHub Actions実行**を一括で行うスキルです。

## 📋 使用方法

### **方法1: VS Code Task（推奨）**
VS Code 内で使用できます。

```
Ctrl+Shift+B キーを押す（macOS: Cmd+Shift+B）
→ "commit-and-push" タスクを選択
→ 実行
```

### **方法2: シェルスクリプト**
ターミナルから直接実行します。

```bash
./scripts/commit-and-deploy.sh 'feat: 新機能を追加'
```

**使用例:**
```bash
./scripts/commit-and-deploy.sh 'fix: バグ修正'
./scripts/commit-and-deploy.sh 'refactor: コード整理'
./scripts/commit-and-deploy.sh 'feat: UIサイズダウン'
```

### **方法3: Git エイリアス**
グローバル git エイリアスを設定します（オプション）

```bash
git config --global alias.growrep '!bash ./scripts/commit-and-deploy.sh'
```

その後、以下で実行できます：
```bash
git growrep '変更内容'
```

## 🔄 処理の流れ

1. **Git ステータス確認** - 現在の変更内容を表示
2. **コミット** - 全変更をステージング＆コミット（メッセージはスクリプト引数）
3. **プッシュ** - GitHub にプッシュ
4. **GitHub Actions 自動実行** - deploy.yml が自動実行されます

## 📊 実行状況の確認

プッシュ後、以下で実行状況を確認できます：

- **GitHub Actions 画面**: https://github.com/1onotakanori-art/GrowRep/actions
- **デプロイ状況**: https://github.com/1onotakanori-art/GrowRep/actions/workflows/deploy.yml

## ✅ 確認事項

- ✅ ローカル変更がすべてコミットされること
- ✅ GitHub の認証が完了していること（SSH キーまたはPAT）
- ✅ `.github/workflows/deploy.yml` が存在すること

## 🎯 GitHub Actions ワークフロー

**deploy.yml** が以下を自動実行します：

1. リポジトリをチェックアウト
2. Firebase API キーを環境変数から注入
3. GitHub Pages の設定
4. 成果物をアップロード
5. **GitHub Pages にデプロイ**

**実行トリガー:**
- `main` ブランチへの `push`
- 手動実行（workflow_dispatch）

## 📝 注意事項

- コミットメッセージは **Conventional Commits 形式** を推奨します：
  - `feat:` - 新機能
  - `fix:` - バグ修正
  - `refactor:` - コード整理
  - `style:` - スタイル調整
  - `docs:` - ドキュメント更新

## 🆘 トラブルシューティング

**問題: 「permission denied」エラーが出る**
```bash
chmod +x ./scripts/commit-and-deploy.sh
```

**問題: GitHub にプッシュできない**
- SSH キーの設定を確認
- または Personal Access Token (PAT) を用いた認証を確認

**問題: GitHub Actions が実行されない**
- https://github.com/1onotakanori-art/GrowRep/settings/actions で Actions が有効化されていることを確認

---

**作成日**: 2026年3月13日  
**用途**: GrowRep 開発ワークフロー自動化
