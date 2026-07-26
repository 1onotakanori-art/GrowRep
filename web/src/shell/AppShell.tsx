import { useEffect, useRef, useState } from 'react';
import { ModeProvider, useMode } from '../context/ModeContext';
import { DataProvider, useData } from '../context/DataContext';
import Header from './Header';
import BottomNav, { type NavKey } from './BottomNav';
import ProfileModal from '../features/profile/ProfileModal';
import HomeView from '../views/HomeView';
import DailyMissionView from '../views/DailyMissionView';
import PostView from '../views/PostView';
import RankingView from '../views/RankingView';
import MyPageView from '../views/MyPageView';
import ChallengeView from '../views/ChallengeView';
import ExercisesView from '../views/ExercisesView';
import styles from './AppShell.module.css';

function ShellInner() {
  const { mode } = useMode();
  const { dailyMission, dailyLoading } = useData();
  const [nav, setNav] = useState<NavKey>('home');
  const [profileOpen, setProfileOpen] = useState(false);
  const autoNavDone = useRef(false);

  // 起動時、今日のデイリーミッションが未クリアならまずその画面を開く。
  // 一度きり（ユーザーが自分でタブを移った後に引き戻さない）。
  useEffect(() => {
    if (autoNavDone.current || dailyLoading) return;
    autoNavDone.current = true;
    if (dailyMission && !dailyMission.cleared) setNav('daily');
  }, [dailyLoading, dailyMission]);

  return (
    <div className={`app-shell ${styles.shell} mode-${mode}`}>
      <Header onOpenProfile={() => setProfileOpen(true)} />

      <main className={styles.main}>
        {nav === 'home' && <HomeView onNavigate={setNav} />}
        {nav === 'daily' && <DailyMissionView />}
        {nav === 'post' && <PostView />}
        {nav === 'ranking' && <RankingView />}
        {nav === 'center' &&
          (mode === 'weekly' ? <ChallengeView /> : <ExercisesView />)}
        {nav === 'mypage' && (
          <MyPageView onOpenProfile={() => setProfileOpen(true)} />
        )}
      </main>

      <BottomNav
        active={nav}
        onChange={setNav}
        mode={mode}
        dailyPending={!!dailyMission && !dailyMission.cleared}
      />

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

export default function AppShell() {
  return (
    <ModeProvider>
      <DataProvider>
        <ShellInner />
      </DataProvider>
    </ModeProvider>
  );
}
