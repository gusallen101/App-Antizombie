import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import { AppDrawer } from '@/components/layout/app-drawer';
import { AppThemeProvider, useAppTheme } from '@/providers/app-theme-provider';
import { LocalizationProvider } from '@/providers/localization-provider';
import { NavigationMenuProvider } from '@/providers/navigation-menu-provider';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppStatusBar() {
  const { colorScheme } = useAppTheme();

  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

function RootLayoutContent() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const type = data?.type as string | undefined;

      if (type === 'shared-task') {
        const categoryId = data?.categoryId ? String(data.categoryId) : '';
        router.push({ pathname: '/(tabs)/pending', params: { highlightCategoryId: categoryId, highlightListType: 'shared' } });
      } else if (type === 'task-reminder') {
        const categoryId = data?.categoryId ? String(data.categoryId) : '';
        const taskId = data?.taskId ? String(data.taskId) : '';
        router.push({ pathname: '/(tabs)/pending', params: { highlightCategoryId: categoryId, highlightTaskId: taskId } });
      } else if (type === 'streak-milestone') {
        router.push('/(tabs)/streak-details');
      }
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <LocalizationProvider>
      <AppThemeProvider>
        <NavigationMenuProvider>
          <RootLayoutContent />
          <Stack initialRouteName="login">
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <AppDrawer />
          <AppStatusBar />
        </NavigationMenuProvider>
      </AppThemeProvider>
    </LocalizationProvider>
  );
}
