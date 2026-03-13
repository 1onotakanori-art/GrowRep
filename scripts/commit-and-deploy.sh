#!/bin/bash
set -e

echo "🚀 GrowRep Deploy Skill実行開始..."
echo ""

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ステップ1: Git status確認
echo -e "${BLUE}📋 Step 1/3: Git ステータス確認中...${NC}"
git status

# ステップ2: コミット
echo ""
echo -e "${BLUE}📝 Step 2/3: 変更をコミット中...${NC}"
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  コミットメッセージが指定されていません。${NC}"
    echo "使用方法: ./scripts/commit-and-deploy.sh '変更内容'"
    exit 1
fi

COMMIT_MSG="$1"
git add .
git commit -m "$COMMIT_MSG"
echo -e "${GREEN}✅ コミット完了: $COMMIT_MSG${NC}"

# ステップ3: GitHub にプッシュ
echo ""
echo -e "${BLUE}🚀 Step 3/3: GitHub にプッシュ中...${NC}"
git push
echo -e "${GREEN}✅ プッシュ完了${NC}"

echo ""
echo -e "${GREEN}🎉 すべての処理が完了しました！${NC}"
echo -e "${YELLOW}💡 GitHub Actions が自動実行されています...${NC}"
echo ""
echo "📊 デプロイ状況確認: https://github.com/1onotakanori-art/GrowRep/actions"
