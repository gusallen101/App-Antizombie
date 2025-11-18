import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type Props = {
  descriptionKey?: string;
};

export function PlaceholderMessage({ descriptionKey = 'common.emptyState' }: Props) {
  const { palette } = useAppTheme();
  const { t } = useLocalization();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.title,
          {
            color: palette.textPrimary,
          },
        ]}>
        {t('common.comingSoon')}
      </Text>
      <Text
        style={[
          styles.subtitle,
          {
            color: palette.textSecondary,
          },
        ]}>
        {t(descriptionKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 320,
  },
});

