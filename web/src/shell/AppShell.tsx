import { useEffect, useRef, useState } from 'react';
import { ModeProvider, useMode } from '../context/ModeContext';
import { DataProvider, useData } from '../context/DataContext';
import {
  SpecialEventProvider,
  useSpecialEvent,
} from '../context/SpecialEventContext';
import Header from './Header';
import BottomNav, { type NavKey } from './BottomNav';
import ProfileModal from '../features/profile/ProfileModal';
import HomeView from '../views/HomeView';
import DailyMissionView from '../views/DailyMissionView';
import TimerView from '../views/TimerView';
import PostView from '../views/PostView';
import RankingView from '../views/RankingView';
import MyPageView from '../views/MyPageView';
import ChallengeView from '../views/ChallengeView';
import ExercisesView from '../views/ExercisesView';
import RaidScoreView from '../views/RaidScoreView';
import SpecialEventApprovalModal from '../features/special/SpecialEventApprovalModal';
import styles from './AppShell.module.css';

function ShellInner() {
  const { mode } = useMode();
  const { dailyMission, dailyLoading, loading: dataLoading } = useData();
  const { pending, reload: reloadSpecialEvents } = useSpecialEvent();
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
        {nav === 'timer' && <TimerView />}
        {nav === 'post' && <PostView onNavigate={setNav} />}
        {nav === 'ranking' && <RankingView />}
        {nav === 'center' &&
          (mode === 'weekly' ? (
            <ChallengeView />
          ) : mode === 'raid' ? (
            <RaidScoreView />
          ) : (
            <ExercisesView />
          ))}
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

      {/*
        承認者に選ばれた提案は、承認/否認を選ぶまでアプリを開くたびに出す。
        閉じる手段を用意しないことで回答漏れを防ぐ（dismissible=false）。
      */}
      {!dataLoading && pending.length > 0 && (
        <SpecialEventApprovalModal
          key={pending.map((p) => p.id).join(',')}
          proposals={pending}
          mandatory
          onClose={reloadSpecialEvents}
          onResolved={reloadSpecialEvents}
        />
      )}
    </div>
  );
}

export default function AppShell() {
  return (
    <ModeProvider>
      <DataProvider>
        <SpecialEventProvider>
          <ShellInner />
        </SpecialEventProvider>
      </DataProvider>
    </ModeProvider>
  );
}
