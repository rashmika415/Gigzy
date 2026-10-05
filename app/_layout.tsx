import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import {
  useFonts as useSyneFonts,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  useFonts as useHankenFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
} from '@expo-google-fonts/hanken-grotesk';
import { AuthProvider, useAuth } from '../context/AuthContext';
import LanguageProvider from '../localization/LanguageProvider';
import { useFonts } from 'expo-font';
import { NotoSansSinhala_400Regular, NotoSansSinhala_700Bold } from '@expo-google-fonts/noto-sans-sinhala';
import { NotoSansTamil_400Regular, NotoSansTamil_700Bold } from '@expo-google-fonts/noto-sans-tamil';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Hide splash screen once auth state is resolved
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch(() => {});
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not logged in → send to welcome screen
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      // Logged in → send to app home
      router.replace('/(app)/(tabs)/home');
    }
  }, [user, loading, segments, router]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  const [syneLoaded] = useSyneFonts({ Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold });
  const [hankenLoaded] = useHankenFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium });
  const [localFontsLoaded] = useFonts({ NotoSansSinhala_400Regular, NotoSansSinhala_700Bold, NotoSansTamil_400Regular, NotoSansTamil_700Bold });

  if (!syneLoaded || !hankenLoaded || !localFontsLoaded) {
    return null;
  }

  return (
    <LanguageProvider><AuthProvider>
      <RootLayoutNav />
    </AuthProvider></LanguageProvider>
  );
}
