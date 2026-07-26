import { useAuth } from './context/AuthContext';
import LoginScreen from './features/auth/LoginScreen';
import AppShell from './shell/AppShell';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-3)',
          fontSize: 28,
        }}
      >
        <i className="fa-solid fa-dumbbell spin" />
      </div>
    );
  }

  return user ? <AppShell /> : <LoginScreen />;
}
