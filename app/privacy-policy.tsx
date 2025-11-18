import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

export default function PrivacyPolicyScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();

  return (
    <AppScreen titleKey="menu.privacyPolicy">
      <View style={styles.container}>
        <Text style={[styles.heading, { color: palette.textPrimary }]}>
          {t('menu.privacyPolicy')}
        </Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          {t('menu.privacyPolicyMessage')}
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
});

