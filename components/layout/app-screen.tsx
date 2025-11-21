import React, { type ReactElement, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type Props = {
  titleKey: string;
  children?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
};

export function AppScreen({ titleKey, children, contentContainerStyle, refreshControl, scrollEnabled = true }: Props) {
  const { palette } = useAppTheme();
  const { t } = useLocalization();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
        },
      ]}>
      <AppHeader title={t(titleKey)} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            backgroundColor: palette.background,
          },
          contentContainerStyle,
        ]}
        scrollEnabled={scrollEnabled}
        refreshControl={refreshControl}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
  },
});

