import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    // Keep the two personas isolated — if a business user lands on a youth
    // route (or vice versa), send them to their own persona's home instead.
    const persona = segments[1];
    const expectedPersona = profile?.role === 'business' ? 'business' : 'youth';
    if ((persona === 'youth' || persona === 'business') && persona !== expectedPersona) {
      router.replace(expectedPersona === 'business' ? '/business' : '/youth');
    }
  }, [user, profile, loading, segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
