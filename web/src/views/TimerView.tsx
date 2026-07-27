import IntervalTimer from '../features/timer/IntervalTimer';

/**
 * タイマー専用ビュー。画面いっぱいに表示したいので ViewHeader は置かず、
 * IntervalTimer が main の余白ごと使い切る。
 */
export default function TimerView() {
  return <IntervalTimer />;
}
