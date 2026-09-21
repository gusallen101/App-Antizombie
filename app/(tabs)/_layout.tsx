import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // <-- NUEVA IMPORTACIÓN

import { HapticTab } from '@/components/haptic-tab';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

export default function TabLayout() {
  const { palette, colorScheme } = useAppTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets(); // <-- OBTENEMOS LAS MEDIDAS DEL SISTEMA

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: palette.tabBarBackground,
          borderTopWidth: Platform.OS === 'android' ? 1 : 0,
          borderTopColor: `${palette.border}40`,
          ...Platform.select({
            ios: {
              height: 58 + Math.max(insets.bottom, 16),
              paddingBottom: Math.max(insets.bottom, 16),
              paddingTop: 10,
              zIndex: 999,
              backfaceVisibility: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
            },
            android: {
              height: 62 + insets.bottom, // Altura base + la barra del sistema de Android
              paddingBottom: 8 + insets.bottom, // Empuja los iconos hacia arriba
              paddingTop: 8,
              elevation: 8,
            },
          }),
        },
        tabBarHideOnKeyboard: Platform.OS === 'android', // Evita glitches de animación en iOS
        tabBarSafeAreaInsets: { bottom: 0 },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          ...Platform.select({
            ios: {
              marginBottom: 0,
            },
            android: {
              marginBottom: 4,
            },
          }),
        },
        tabBarActiveTintColor:
          palette.tabBarBackground === palette.primary
            ? palette.inputPlaceholder
            : palette.primary,
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
        name="streak-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size + 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: t('tabs.goals'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-circle" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="financial-health"
        options={{
          title: t('tabs.financialHealth'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size + 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t('tabs.reminders'),
          tabBarIcon: ({ color, size }) => <Ionicons name="alarm" size={size + 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="curso-antizombie"
        options={{
          title: 'Curso Antizombie',
          tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size + 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pending"
        options={{
          title: t('tabs.pending'),
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size + 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="faq"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}