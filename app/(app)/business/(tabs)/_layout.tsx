import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts } from '../../../../constants/theme';

export default function BusinessTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.surfaceBorderSubtle,
          height: 58,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Gigs',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="work" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="applicants"
        options={{
          title: 'Applicants',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="groups" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="storefront" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
