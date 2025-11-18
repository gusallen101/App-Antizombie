import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type TaskItem = {
  label: string;
  entries: string[];
};

type CategorySection = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tasks: TaskItem[];
};

const CATEGORY_METADATA: Record<
  string,
  {
    titleKey: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  espiritual: {
    titleKey: 'categories.espiritual',
    icon: 'sparkles',
  },
  circulocercano: {
    titleKey: 'categories.circulocercano',
    icon: 'people-circle-outline',
  },
  fisica: {
    titleKey: 'categories.fisica',
    icon: 'body-outline',
  },
  laboral: {
    titleKey: 'categories.laboral',
    icon: 'briefcase-outline',
  },
  responsabilidad: {
    titleKey: 'categories.responsabilidad',
    icon: 'shield-checkmark-outline',
  },
  academico: {
    titleKey: 'categories.academico',
    icon: 'school-outline',
  },
};

export default function TaskRemindersScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const [categories, setCategories] = useState<CategorySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveCategoryMeta = useCallback(
    (key: string) => {
      const fallback = {
        titleKey: 'categories.default',
        icon: 'list-outline' as const,
      };
      const meta = CATEGORY_METADATA[key] ?? fallback;

      return {
        title: t(meta.titleKey),
        icon: meta.icon,
      };
    },
    [t],
  );

  const transformResponse = useCallback(
    (payload: Array<Record<string, Array<{ etiqueta: string; tareas: string[] }>>>) => {
      return payload
        .map((entry) => {
          const categoryKey = Object.keys(entry)[0];
          if (!categoryKey) {
            return null;
          }

          const items = entry[categoryKey];
          const meta = resolveCategoryMeta(categoryKey);

          return {
            id: categoryKey,
            title: meta.title,
            icon: meta.icon,
            tasks: Array.isArray(items)
              ? items.map((task) => ({
                  label: task.etiqueta,
                  entries: Array.isArray(task.tareas) ? task.tareas.filter(Boolean) : [],
                }))
              : [],
          } satisfies CategorySection;
        })
        .filter(Boolean) as CategorySection[];
    },
    [resolveCategoryMeta],
  );

  const fetchReminders = useCallback(
    async (showLoader: 'initial' | 'refresh' = 'initial') => {
      if (showLoader === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        setError(null);

        const [apikey, userId] = await Promise.all([
          AsyncStorage.getItem('@auth:apikey'),
          AsyncStorage.getItem('@auth:userId'),
        ]);

        if (!apikey || !userId) {
          throw new Error(t('auth.loginErrorFallback'));
        }

        const response = await fetch(`${API_CONFIG.baseUrl}metas/${userId}`, {
          headers: {
            apikey,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload?.message ?? payload?.error ?? t('screens.taskReminders.errorTitle');
          throw new Error(message);
        }

        const json = (await response.json()) as Array<
          Record<string, Array<{ etiqueta: string; tareas: string[] }>>
        >;

        setCategories(transformResponse(json));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('screens.taskReminders.errorTitle');
        setError(message);
        setCategories([]);
      } finally {
        if (showLoader === 'initial') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [t, transformResponse],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchReminders('initial');
    }, [fetchReminders]),
  );

  const handleRefresh = useCallback(() => {
    void fetchReminders('refresh');
  }, [fetchReminders]);

  const hasTasks = useMemo(() => categories.some((category) => category.tasks.length > 0), [categories]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.statusLabel, { color: palette.inputPlaceholder }]}>
            {t('screens.taskReminders.header')}
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={32} color={palette.accent} />
          <Text style={[styles.errorTitle, { color: palette.accent }]}>
            {t('screens.taskReminders.errorTitle')}
          </Text>
          <Text style={[styles.errorMessage, { color: palette.inputPlaceholder }]}>{error}</Text>
          <TouchableOpacity
            style={[
              styles.retryButton,
              {
                backgroundColor: palette.primary,
              },
            ]}
            onPress={handleRefresh}>
            <Ionicons name="refresh" size={18} color={palette.buttonText} />
            <Text style={[styles.retryLabel, { color: palette.buttonText }]}>
              {t('screens.taskReminders.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!hasTasks) {
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={palette.accent} />
          <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
            {t('screens.taskReminders.emptyTitle')}
          </Text>
          <Text style={[styles.emptyMessage, { color: palette.inputPlaceholder }]}>
            {t('screens.taskReminders.emptyMessage')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.listWrapper}>
        {categories.map((category) => (
          <View key={category.id} style={styles.categorySection}>
            <View
              style={[
                styles.categoryHeader,
                {
                  backgroundColor: palette.secondary,
                },
              ]}>
              <Ionicons name={category.icon} size={18} color={palette.buttonText} />
              <Text style={[styles.categoryTitle, { color: palette.buttonText }]}>{category.title}</Text>
            </View>
            {category.tasks.length === 0 ? (
              <View style={styles.noTasksContainer}>
                <Text style={[styles.noTasksLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.taskReminders.emptyTitle')}
                </Text>
              </View>
            ) : (
              <View style={styles.categoryBody}>
                {category.tasks.map((task, index) => (
                  <View
                    key={`${category.id}-${task.label}-${index}`}
                    style={[
                      styles.taskCard,
                      {
                        backgroundColor: palette.surface,
                        borderColor: `${palette.border}80`,
                      },
                    ]}>
                    <Text style={[styles.taskLabel, { color: palette.textOnSurface }]}>{task.label}</Text>
                    {task.entries.map((entry, entryIndex) => (
                      <Text
                        key={`${category.id}-${task.label}-${entryIndex}`}
                        style={[styles.taskEntry, { color: palette.inputPlaceholder }]}>
                        {entry}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <AppScreen
      titleKey="tabs.taskReminders"
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={palette.primary}
          colors={[palette.primary]}
        />
      }>
      {renderContent()}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 24,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  screenContent: {
    paddingBottom: 32,
  },
  listWrapper: {
    gap: 20,
  },
  categorySection: {
    gap: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  categoryBody: {
    gap: 12,
  },
  noTasksContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  noTasksLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  taskCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  taskLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  taskEntry: {
    fontSize: 14,
    lineHeight: 20,
  },
});

