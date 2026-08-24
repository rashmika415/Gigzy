
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function AppIndex() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={profile?.role === 'business' ? '/business' : '/youth'} />;
}
