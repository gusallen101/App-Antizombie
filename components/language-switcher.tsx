import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

export function LanguageSwitcher() {
  const { availableLanguages, language, setLanguage } = useLocalization();
  const {
    palette: { surface, border, primary, buttonText, textOnSurface },
  } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: surface,
          borderColor: border,
          shadowColor: primary,
        },
      ]}>
      {availableLanguages.map((option) => {
        const isActive = option === language;

        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={option.toUpperCase()}
            onPress={() => setLanguage(option)}
            style={[
              styles.button,
              isActive && {
                backgroundColor: primary,
              },
            ]}>
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? buttonText : textOnSurface,
                },
              ]}>
              {option.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});

