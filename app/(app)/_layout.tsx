import { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { SavedGigsProvider } from '../../context/SavedGigsContext';
import { registerDeviceForPush } from '../../services/pushNotificationService';

/**
 * App layout — wraps the tab navigator and all stack-pushed screens.
 *
 * Structure:
 *   Stack
 *   ├── (tabs)      → Tab navigator (Home, Browse/My Gigs, Messages, Profile)
 *   ├── post-gig    → Pushes on top of tabs
 *   ├── edit-profile → Pushes on top of tabs
 *   ├── notifications → Pushes on top of tabs
 *   ├── suspended   → Redirect screen
 *   ├── chat/[id]   → Pushes on top of tabs
 *   └── profile/[id] → Pushes on top of tabs
 */
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
    if (!userData.suspended && pathname === '/suspended') router.replace('/(app)/(tabs)/home');
  }, [loading, pathname, router, user, userData]);

  useEffect(() => {
    if (!loading && user && userData && !userData.suspended) {
      registerDeviceForPush(user.uid).catch((error) => console.warn('Push registration failed:', error));
    }
  }, [loading, user, userData]);

  return (
    <SavedGigsProvider>
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      {/* Tab navigator — rendered as the initial/default screen */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Stack-pushed screens (slide in from right, cover the tabs) */}
      <Stack.Screen name="post-gig" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="suspended" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="gig" options={{ headerShown: false }} />
      <Stack.Screen name="applications" options={{ headerShown: false }} />
    </Stack>
    </SavedGigsProvider>
  );
}
