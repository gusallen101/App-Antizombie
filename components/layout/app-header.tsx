import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageSwitcher } from '@/components/language-switcher';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';
import { useNavigationMenu } from '@/providers/navigation-menu-provider';

type Props = {
  title: string;
};

export function AppHeader({ title }: Props) {
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const { toggle } = useNavigationMenu();
  const router = useRouter();

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: palette.headerBackground,
        },
      ]}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.menu')}
          onPress={toggle}
          style={styles.menuButton}>
          <Ionicons name="menu" size={26} color={palette.headerText} />
        </Pressable>
        <Text
          style={[
            styles.title,
            {
              color: palette.headerText,
            },
          ]}>
          {title}
        </Text>
        <View style={styles.rightActions}>
          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color={palette.headerText} />
          </Pressable>
          <LanguageSwitcher />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  menuButton: {
    padding: 10,
    marginRight: 12,
    borderRadius: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerButton: {
    padding: 8,
  },
});
