// 共有ドメイン型（既存 Firestore データモデルに準拠）
import type { Timestamp } from 'firebase/firestore';

export type Mode = 'free' | 'weekly';

export interface UserData {
  userName?: string;
  email?: string;
  isGuest?: boolean;
  /** 最後にアプリを開いた JST の暦日（YYYY-MM-DD）。デイリーミッションの表示対象判定に使う */
  lastActiveDateKey?: string;
  // 作成者評価（種目作成者の平均評価）関連
  creatorRatingSum?: number;
  creatorRatingCount?: number;
  creatorAvgRating?: number;
}

export interface Comment {
  userId: string;
  userName?: string;
  text: string;
  createdAt?: Timestamp | null;
}

export interface Post {
  id: string;
  userId: string;
  userEmail?: string;
  exerciseType: string;
  value: number; // 回数 / 秒数 / セット数
  likes?: string[];
  comments?: Comment[];
  timestamp?: Timestamp | null; // serverTimestamp（既存 posts_free の実フィールド名）
}

export interface FreeExercise {
  name: string;
  rule: string;
  icon: string; // 'fa-dumbbell' など
  tags: string[];
  barbarian?: boolean; // タイムアタック（短いほど高得点）
  excludeFromWeekly?: boolean;
  createdBy?: string; // 作成者 uid
}

export type FreeExerciseMap = Record<string, FreeExercise>;

export interface WeeklyChallenge {
  weekStart: Date;
  weekEnd: Date;
  exercises: string[];
  selectionHistory: Record<string, number>;
  creatorSelectionHistory: Record<string, number>;
  isManualOverride?: boolean;
  overrideLabel?: string | null;
  /** 夏休みなどで種目を選出せず休止している週か（raid-mode.ts の休止週）。 */
  paused?: boolean;
  pauseLabel?: string | null;
}

export interface WeeklyConfig {
  weightExponent: number;
  fairnessMode: 'two_stage' | 'legacy';
  normalCount: number;
  barbarianCount: number;
  exerciseCount: number;
  enableStreak: boolean;
  streakBonusPerDay: number;
  streakBonusCap: number;
  enablePrediction: boolean;
}

export interface UserScore {
  userId: string;
  userName: string;
  totalScore: number;
  exerciseScores: Record<string, number>;
}

export interface ExerciseRatingSummary {
  avgRating: number;
  ratingCount: number;
  ratingSum: number;
}
