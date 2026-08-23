import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

/**
 * Initial route — shows a loading indicator while auth resolves,
 * then declaratively redirects to onboarding (if unauthenticated) or home (if logged in).
 */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(app)/home" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}

