import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

export default function RootLayout() {
  return (
    <LocalizationProvider>
      <AppThemeProvider>
        <NavigationMenuProvider>
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
