// =====================================================================
// 種目まとめ — Firestore の読み込み（読むだけ。どこにも書かない）
//
// - posts_free 全件 → 種目ごとの投稿数（累計・直近7日・その前の7日）
// - settings_free/weekly_challenge → 今週の種目・選出回数・作成者選出回数
// - settings_free/weekly_config → 抽選の設定
// 週間チャレンジの更新（getOrUpdateWeeklyChallenge）は呼ばない。
// フリーモードで開いても抽選や書き込みが起きないようにするため。
// =====================================================================
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getAllPosts } from './posts';
import { getWeeklyConfig } from './weekly-engine';
import { computePostStats, type PostStat } from './exercise-insights';
import type { WeeklyConfig } from './types';

export interface InsightsData {
  postStats: Record<string, PostStat>;
  /** 今週の週間チャレンジの種目キー */
  currentWeekKeys: string[];
  /** 種目キー → これまでに週間チャレンジで選ばれた回数 */
  history: Record<string, number>;
  creatorHistory: Record<string, number>;
  config: WeeklyConfig;
}

export async function loadInsightsData(): Promise<InsightsData> {
  const [posts, wcSnap, config] = await Promise.all([
    getAllPosts(),
    getDoc(doc(db, 'settings_free', 'weekly_challenge')),
    getWeeklyConfig(),
  ]);
  const wc = (wcSnap.exists() ? wcSnap.data() : {}) as {
    exercises?: string[];
    selectionHistory?: Record<string, number>;
    creatorSelectionHistory?: Record<string, number>;
  };
  return {
    postStats: computePostStats(
      posts.map((p) => ({
        exerciseType: p.exerciseType,
        timestamp: (p.timestamp as Timestamp | null)?.toDate?.() || null,
      })),
    ),
    currentWeekKeys: Array.isArray(wc.exercises) ? wc.exercises : [],
    history: wc.selectionHistory || {},
    creatorHistory: wc.creatorSelectionHistory || {},
    config,
  };
}
