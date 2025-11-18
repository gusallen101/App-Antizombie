import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';
import { useNavigationMenu } from '@/providers/navigation-menu-provider';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

type DrawerItem = {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: Href;
  action?: () => void | Promise<void>;
};

export function AppDrawer() {
  const router = useRouter();
  const { palette, colorScheme } = useAppTheme();
  const { t } = useLocalization();
  const { isOpen, close } = useNavigationMenu();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsVisible(false);
        }
      });
    }
  }, [backdropOpacity, isOpen, translateX]);

  const menuItems = useMemo<DrawerItem[]>(
    () => [
      {
        labelKey: 'tabs.home',
        icon: 'home-outline',
        route: '/(tabs)/home',
      },
      {
        labelKey: 'tabs.goals',
        icon: 'checkmark-done-outline',
        route: '/(tabs)/goals',
      },
      {
        labelKey: 'tabs.financialHealth',
        icon: 'wallet-outline',
        route: '/(tabs)/financial-health',
      },
      {
        labelKey: 'tabs.reminders',
        icon: 'time-outline',
        route: '/(tabs)/reminders',
      },
      {
        labelKey: 'tabs.pending',
        icon: 'list-outline',
        route: '/(tabs)/pending',
      },
      {
        labelKey: 'tabs.settings',
        icon: 'settings-outline',
        route: '/(tabs)/settings',
      },
      {
        labelKey: 'menu.signOut',
        icon: 'log-out-outline',
        action: async () => {
          try {
            await AsyncStorage.multiRemove([
              '@auth:isAuthenticated',
              '@auth:apikey',
              '@auth:email',
              '@auth:name',
              '@auth:avatar',
              '@auth:userId',
            ]);
          } catch (error) {
            console.warn('Failed to clear auth storage', error);
          } finally {
            router.replace('/login');
          }
        },
      },
    ],
    [router],
  );

  const handleNavigate = (item: DrawerItem) => {
    if (item.route) {
      router.replace(item.route);
    } else {
      item.action?.();
    }
    close();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.backdrop,
          {
            backgroundColor: palette.headerBackground,
            opacity: backdropOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.6],
            }),
          },
        ]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: palette.surface,
            transform: [{ translateX }],
          },
        ]}>
        <View style={styles.drawerHeader}>
          <View style={styles.brandMark}>
            <Ionicons name="sparkles" size={20} color={palette.buttonText} />
          </View>
          <Text style={[styles.drawerTitle, { color: palette.textPrimary }]}>
            {t('menu.title')}
          </Text>
          <TouchableOpacity onPress={close} style={styles.closeButton} accessibilityRole="button">
            <Ionicons name="close" size={22} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.separator,
            {
              backgroundColor:
                colorScheme === 'dark' ? '#FFFFFF30' : `${palette.textOnSurface}20`,
            },
          ]}
        />

        <View style={styles.itemList}>
          {menuItems.map((item) => (
            <Pressable
              key={item.labelKey}
              onPress={() => handleNavigate(item)}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: pressed ? `${palette.primary}20` : 'transparent',
                },
              ]}>
              <Ionicons name={item.icon} size={20} color={palette.primary} style={styles.itemIcon} />
              <Text
                style={[
                  styles.itemLabel,
                  {
                    color: colorScheme === 'dark' ? palette.textPrimary : palette.textOnSurface,
                  },
                ]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A86AE6',
  },
  drawerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeButton: {
    padding: 8,
  },
  separator: {
    marginVertical: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF30',
  },
  itemList: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  itemIcon: {
    marginRight: 12,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

