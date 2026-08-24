import { Stack } from 'expo-router';
import { colors } from '../../../constants/theme';

export default function YouthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="gig/[id]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
