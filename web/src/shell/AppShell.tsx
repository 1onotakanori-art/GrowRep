import { useState } from 'react';
import { ModeProvider, useMode } from '../context/ModeContext';
import { DataProvider } from '../context/DataContext';
import Header from './Header';
import BottomNav, { type NavKey } from './BottomNav';
import ProfileModal from '../features/profile/ProfileModal';
import HomeView from '../views/HomeView';
import PostView from '../views/PostView';
import RankingView from '../views/RankingView';
import MyPageView from '../views/MyPageView';
import ChallengeView from '../views/ChallengeView';
import ExercisesView from '../views/ExercisesView';
import styles from './AppShell.module.css';

function ShellInner() {
  const { mode } = useMode();
  const [nav, setNav] = useState<NavKey>('home');
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className={`app-shell ${styles.shell} mode-${mode}`}>
      <Header onOpenProfile={() => setProfileOpen(true)} />

      <main className={styles.main}>
        {nav === 'home' && <HomeView onNavigate={setNav} />}
        {nav === 'post' && <PostView />}
        {nav === 'ranking' && <RankingView />}
        {nav === 'center' &&
          (mode === 'weekly' ? <ChallengeView /> : <ExercisesView />)}
        {nav === 'mypage' && (
          <MyPageView onOpenProfile={() => setProfileOpen(true)} />
        )}
      </main>

      <BottomNav active={nav} onChange={setNav} mode={mode} />

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
