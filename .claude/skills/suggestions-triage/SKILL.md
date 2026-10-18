---
name: suggestions-triage
description: アプリの意見箱に届いた意見（毎週日曜に analytics/suggestions/BACKLOG.md へ回収済み）を読み、改修案にまとめて対応し、状態を更新する。「意見箱を見て」「意見箱の対応」「ユーザーの要望を確認」などと言われたときに使う。
---

# 意見箱の対応

アプリの「意見箱」（Firestore `suggestions`）は、毎週日曜の `npm run announce`（タスクスケジューラ）の最後に
`analytics/collect-suggestions.js` で手元へ回収されている。ここから改修につなげる手順。

## 1. バックログを読む

回収結果は **メインのチェックアウト** の `analytics/suggestions/` にある（.gitignore 済み。worktree には無い）。

```bash
git worktree list --porcelain | head -1   # 1行目の worktree がメインのチェックアウト
```

- `<メイン>/analytics/suggestions/BACKLOG.md` … 全件を状態ごとに整理したもの
- `<メイン>/analytics/suggestions/inbox/<日付>.md` … その週の新着だけ

最新を取り込みたいときは、メインの analytics で回収し直す（読むだけ。Firestore には書かない）:

```bash
node <メイン>/analytics/collect-suggestions.js
```

鍵が無いと言われたら、worktree から `GROWREP_SA_KEY=<メイン>/analytics/serviceAccountKey.json` を付けて実行する（鍵はコピーしない）。

## 2. 改修案にまとめる（ここで一度ユーザーに確認）

`未対応（新着）` と `検討済み・未着手` を対象に、1件ずつ:

- 種類: 不具合 / 機能追加 / 使い勝手 / 質問・相談 / 対応不要
- 対象: どの画面・どのファイルか（`web/src/...`。旧 GitHub Pages 版 `app.js` は閉じる予定なので原則触らない）
- 案: 何をどう変えるか、規模（小・中・大）
- 似た意見はまとめる（重複は `duplicate`）

まとめた一覧をユーザーに見せ、**どれに着手するか決めてもらってから**実装する。勝手に全部やらない。
見送り・重複にするものも、その理由と一緒に確認する。

## 3. 実装する

通常の開発と同じ（ブランチ → 実装 → テスト → PR → 自動マージ）。
着手したら状態を `in_progress` に、PR を作ったら URL を付けておく:

```bash
node <メイン>/analytics/collect-suggestions.js --offline --set=<id>:in_progress --pr="https://github.com/..."
```

## 4. 状態を更新する

| 状態 | 使う場面 |
|---|---|
| `new` | 未対応（回収直後） |
| `triaged` | 検討して案は出したが未着手 |
| `in_progress` | 対応中（PR あり） |
| `done` | マージ済み |
| `wontfix` | 見送り（`--note` に理由） |
| `duplicate` | 他の意見と同じ（`--note` にまとめ先の id） |

```bash
node <メイン>/analytics/collect-suggestions.js --offline --set=<id>:done --note="ストリーク表示を追加" --pr="https://github.com/..."
```

`--offline` は Firestore を読まずに手元の控えから BACKLOG.md を作り直す。`status.json` を手で編集しないこと。

## 守ること

- **意見の本文・投稿者名をリポジトリに書き写さない。** リポジトリは公開。PR 本文・コミットメッセージ・コード中のコメントでは
  「意見箱の要望（id: xxxx）に対応」のように id か要約だけにする。
- `analytics/suggestions/` を git に追加しない（.gitignore 済み）。
- Firestore の `suggestions` を書き換えない（ルールでも更新・削除は禁止）。状態は手元の `status.json` だけで管理する。
