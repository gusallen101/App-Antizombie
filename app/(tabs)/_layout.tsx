import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

export default function TabLayout() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: palette.tabBarBackground,
          borderTopColor: palette.border,
        },
        tabBarActiveTintColor: palette.buttonText,
        tabBarInactiveTintColor: palette.textSecondary,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="complete-tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="task-reminders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="view-goals"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: t('tabs.goals'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="financial-health"
        options={{
          title: t('tabs.financialHealth'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t('tabs.reminders'),
          tabBarIcon: ({ color, size }) => <Ionicons name="alarm" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pending"
        options={{
          title: t('tabs.pending'),
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
