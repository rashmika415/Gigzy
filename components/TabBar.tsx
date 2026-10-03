import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius } from '../constants/theme';

interface TabItem {
  /** Route key or unique id */
  key: string;
  /** Display label */
  label: string;
  /** Ionicon name for the tab */
  icon: keyof typeof Ionicons.glyphMap;
  /** Ionicon name when the tab is active (filled variant) */
  activeIcon?: keyof typeof Ionicons.glyphMap;
  /** Optional unread badge count */
  badge?: number;
}

interface TabBarProps {
  /** Tab definitions — order determines render order */
  tabs: TabItem[];
  /** Currently active tab key */
  activeTab: string;
  /** Called when a tab is pressed */
  onTabPress: (key: string) => void;
}

export default function TabBar({ tabs, activeTab, onTabPress }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const iconName = isActive && tab.activeIcon ? tab.activeIcon : tab.icon;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <Ionicons
                name={iconName}
                size={22}
                color={isActive ? colors.primary : colors.textMuted}
              />
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingBottom: 20, // safe-area bottom padding
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryOnColor,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
