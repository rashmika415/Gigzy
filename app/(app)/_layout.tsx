import { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { registerDeviceForPush } from '../../services/pushNotificationService';

export default function AppLayout() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || !userData) return;
    if (userData.suspended && pathname !== '/suspended') router.replace('/(app)/suspended');
    if (!userData.suspended && pathname === '/suspended') router.replace('/(app)/home');
  }, [loading, pathname, router, user, userData]);

  useEffect(() => {
    if (!loading && user && userData && !userData.suspended) {
      registerDeviceForPush(user.uid).catch((error) => console.warn('Push registration failed:', error));
    }
  }, [loading, user, userData]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
