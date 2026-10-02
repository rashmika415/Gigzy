import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { colors, borderRadius } from '../../../constants/theme';

/**
 * Role-based tab layout.
 *
 * Freelancer tabs: Home, Browse, Messages, Profile
 * Business  tabs: Home, My Gigs, Messages, Profile
 *
 * Tabs that don't belong to the current role are hidden via `href: null`.
 */
export default function TabLayout() {
  const { userData } = useAuth();
  const role = userData?.role ?? 'freelancer';
  const isClient = role === 'client';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
      }}
    >
      {/* ── Home — both roles ── */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />

      {/* ── Browse — freelancer only ── */}
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          href: isClient ? null : '/browse',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <Ionicons
                name={focused ? 'compass' : 'compass-outline'}
                size={22}
                color={color}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />

      {/* ── My Gigs — business only ── */}
      <Tabs.Screen
        name="my-gigs"
        options={{
          title: 'My Gigs',
          href: isClient ? '/my-gigs' : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <Ionicons
                name={focused ? 'briefcase' : 'briefcase-outline'}
                size={22}
                color={color}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />

      {/* ── Messages — both roles ── */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <Ionicons
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                size={22}
                color={color}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />

      {/* ── Profile — both roles ── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    height: 70,
    paddingBottom: 12,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabIcon: {
    marginBottom: 0,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
