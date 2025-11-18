import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type Gender = 'h' | 'm';

const DEFAULT_LEVEL = 1;
const MAX_LEVEL = 3;

const ZOMBIE_IMAGES: Record<Gender, Record<number, ImageSourcePropType>> = {
  h: {
    1: require('@/assets/images/h/1.png'),
    2: require('@/assets/images/h/2.png'),
    3: require('@/assets/images/h/3.png'),
  },
  m: {
    1: require('@/assets/images/m/1.png'),
    2: require('@/assets/images/m/2.png'),
    3: require('@/assets/images/m/3.png'),
  },
};

type ZombieResponse = {
  sexo?: string | null;
  nivel_zombie?: number | string | null;
  porcentaje_exito_total?: number | string | null;
};

export default function HomeScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const router = useRouter();
  const [zombieLevel, setZombieLevel] = useState(DEFAULT_LEVEL);
  const [gender, setGender] = useState<Gender>('h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveZombieInfo = useCallback(
    (payload: ZombieResponse | null | undefined) => {
      const genderValue = payload?.sexo === 'm' ? 'm' : 'h';
      const parsedLevel = Number(payload?.nivel_zombie ?? DEFAULT_LEVEL);
      const parsedSuccess = Number(payload?.porcentaje_exito_total ?? 0);

      let nextLevel =
        Number.isFinite(parsedLevel) && parsedLevel >= 1 ? Math.round(parsedLevel) : DEFAULT_LEVEL;

      if (parsedSuccess === 0) {
        nextLevel = 2;
      }

      nextLevel = Math.min(Math.max(nextLevel, 1), MAX_LEVEL);

      return {
        gender: genderValue as Gender,
        level: nextLevel,
      };
    },
    [],
  );

  const fetchZombieStatus = useCallback(async () => {
    try {
      setError(null);
      if (!refreshing) {
        setLoading(true);
      }

      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);

      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }

      const response = await fetch(`${API_CONFIG.baseUrl}avance_usuario/${userId}`, {
        headers: {
          apikey,
        },
      });

      if (!response.ok) {
        throw new Error(t('screens.home.zombieError'));
      }

      const data: ZombieResponse = await response.json();
      const { gender: resolvedGender, level: resolvedLevel } = resolveZombieInfo(data);

      setGender(resolvedGender);
      setZombieLevel(resolvedLevel);
      await AsyncStorage.setItem('@profile:gender', resolvedGender);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : t('screens.home.zombieError'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, resolveZombieInfo, t]);

  useFocusEffect(
    useCallback(() => {
      void fetchZombieStatus();
    }, [fetchZombieStatus]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchZombieStatus();
  }, [fetchZombieStatus]);

  const levelDescriptor = useMemo(() => {
    const title = t(`screens.home.zombieLevels.${zombieLevel}.title`);
    const description = t(`screens.home.zombieLevels.${zombieLevel}.description`);

    return { title, description };
  }, [t, zombieLevel]);

  const illustrationSource =
    ZOMBIE_IMAGES[gender][zombieLevel] ?? ZOMBIE_IMAGES.h[DEFAULT_LEVEL];

  return (
    <AppScreen
      titleKey="tabs.home"
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />
      }
    >
      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.heading, { color: palette.textOnSurface }]}>
          {t('screens.home.zombieHeading')}
        </Text>
        <Text style={[styles.levelLabel, { color: palette.inputPlaceholder }]}>
          {t('screens.home.zombieLevelLabel', { level: String(zombieLevel).padStart(2, '0') })}
        </Text>
        <View style={styles.zombieRow}>
          <Image source={illustrationSource} style={styles.illustration} resizeMode="contain" />
          <View style={styles.levelInfo}>
            {loading ? (
              <ActivityIndicator color={palette.primary} />
            ) : error ? (
              <>
                <Text style={[styles.levelTitle, { color: palette.textOnSurface }]}>
                  {t('screens.home.status')}
                </Text>
                <Text style={[styles.levelDescription, { color: palette.inputPlaceholder }]}>
                  {t('screens.home.zombieError')}
                </Text>
                <TouchableOpacity onPress={fetchZombieStatus}>
                  <Text style={[styles.retryLabel, { color: palette.primary }]}>
                    {t('screens.home.zombieTryAgain')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.levelTitle, { color: palette.textOnSurface }]}>
                  {levelDescriptor.title}
                </Text>
                <Text style={[styles.levelDescription, { color: palette.inputPlaceholder }]}>
                  {levelDescriptor.description}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      <Text style={[styles.question, { color: palette.inputPlaceholder }]}>
        {t('screens.home.question')}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => router.push('/complete-tasks')}
          style={[styles.actionButton, { backgroundColor: palette.primary }]}
        >
          <Ionicons name="checkbox-outline" size={20} color={palette.buttonText} />
          <Text style={[styles.actionLabel, { color: palette.buttonText }]}>
            {t('screens.home.completeTasks')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/task-reminders')}
          style={[styles.actionButton, { backgroundColor: palette.secondary }]}
        >
          <Ionicons name="notifications-outline" size={20} color={palette.buttonText} />
          <Text style={[styles.actionLabel, { color: palette.buttonText }]}>
            {t('screens.home.rememberTasks')}
          </Text>
        </TouchableOpacity>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    padding: 24,
    gap: 24,
  },
  card: {
    borderRadius: 32,
    padding: 20,
    gap: 8,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  levelLabel: {
    fontSize: 14,
    letterSpacing: 2,
  },
  zombieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  illustration: {
    width: 160,
    height: 160,
  },
  levelInfo: {
    flex: 1,
    gap: 8,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  levelDescription: {
    fontSize: 15,
    lineHeight: 20,
  },
  retryLabel: {
    marginTop: 8,
    fontWeight: '600',
  },
  question: {
    fontSize: 16,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

