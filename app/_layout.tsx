import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts as useSyneFonts, Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { useFonts as useHankenFonts, HankenGrotesk_400Regular, HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk';
import { AuthProvider, useAuth } from '../context/AuthContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Hide splash screen once auth state is resolved
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not logged in → send to welcome screen
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      // Logged in → send to app home
      router.replace('/(app)/home');
    }
  }, [user, loading, segments]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  const [syneLoaded] = useSyneFonts({ Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold });
  const [hankenLoaded] = useHankenFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium });

  if (!syneLoaded || !hankenLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
