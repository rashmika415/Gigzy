import { Stack } from 'expo-router';
import { authColors } from '../../constants/authTheme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: authColors.background },
      }}
    />
  );
}
