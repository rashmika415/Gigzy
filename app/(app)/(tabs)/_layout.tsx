import { Tabs } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { LoadingState, TabBar } from '../../../components';
import { colors } from '../../../constants/theme';
import type { ComponentProps } from 'react';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const icons: Record<string, ComponentProps<typeof TabBar>['tabs'][number]['icon']> = {
  home: 'home-outline', browse: 'compass-outline', saved: 'bookmark-outline', 'my-gigs': 'briefcase-outline', messages: 'chatbubbles-outline', profile: 'person-outline',
};
function SharedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return <TabBar activeTab={state.routes[state.index].key}
    tabs={state.routes.map(route => ({ key: route.key, label: descriptors[route.key].options.title ?? route.name,
      icon: icons[route.name] ?? 'ellipse-outline' }))}
    onTabPress={key => {
      const route = state.routes.find(item => item.key === key);
      if (!route) return;
      const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
      if (state.routes[state.index].key !== key && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    }} />;
}
export default function TabLayout() {
  const { userData, loading } = useAuth();
  if (loading || !userData) return <LoadingState message="Loading your account?" />;
  return <Tabs initialRouteName="home" tabBar={props => <SharedTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
    <Tabs.Screen name="home" options={{ title: 'Home' }} />
    <Tabs.Protected guard={userData.role === 'freelancer'}>
      <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
    </Tabs.Protected>
    <Tabs.Protected guard={userData.role === 'client'}>
      <Tabs.Screen name="my-gigs" options={{ title: 'My Gigs' }} />
    </Tabs.Protected>
    <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
  </Tabs>;
}
