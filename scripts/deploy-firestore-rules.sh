#!/bin/bash
# =====================================================================
# Firestore セキュリティルールを本番へデプロイする
#
# GitHub Actions（deploy.yml）は GitHub Pages のフロントエンドしか配信
# しないため、firestore.rules を書き換えたらこのスクリプトを必ず実行する。
# 実行しないと、新しいコレクションはルール未定義（＝全拒否）のままになり、
# アプリには "Missing or insufficient permissions." としか表示されない。
#
# 使い方:
#   ./scripts/deploy-firestore-rules.sh
# =====================================================================
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$(dirname "$0")/.."

echo -e "${BLUE}🔒 Firestore ルールをデプロイします (project: prod)${NC}"
echo ""

npx --yes firebase-tools deploy --only firestore:rules --project prod

echo ""
echo -e "${GREEN}✅ firestore.rules を本番へ反映しました${NC}"
echo -e "${BLUE}💡 反映には数十秒かかることがあります。ブラウザを再読み込みして確認してください。${NC}"
