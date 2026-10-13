import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../constants/theme';

export default function AdminLayout() {
  const { user, userData, loading } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>;
  }
  if (!user || !userData) return <Redirect href="/(auth)/login" />;
  if (userData?.suspended) return <Redirect href="/(app)/suspended" />;
  if (userData?.role !== 'admin') return <Redirect href="/(app)/(tabs)/home" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
