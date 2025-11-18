import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type TaskProgress = {
  id_meta: number;
  meta: string;
  tarea: string;
  ambito: string;
};

export default function CompleteTasksScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const swiperRef = useRef<Swiper<TaskProgress>>(null);
  const authUserIdRef = useRef<string | null>(null);

  const [cards, setCards] = useState<TaskProgress[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentCard = cards[currentIndex];
  const progressIndex = currentCard ? currentIndex + 1 : totalCards;

  const fetchTasks = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const [apikey, userId] = await Promise.all([
          AsyncStorage.getItem('@auth:apikey'),
          AsyncStorage.getItem('@auth:userId'),
        ]);

        if (!apikey || !userId) {
          throw new Error(t('auth.loginErrorFallback'));
        }

        authUserIdRef.current = userId;

        const response = await fetch(`${API_CONFIG.baseUrl}avance_usuario/${userId}`, {
          headers: {
            apikey,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = payload?.message ?? payload?.error ?? 'Error';
          throw new Error(message);
        }

        const json = (await response.json()) as {
          array_no_revisadas: TaskProgress[];
        };

        const pendingTasks = (json.array_no_revisadas ?? []).slice().reverse();
        setCards(pendingTasks);
        setTotalCards(pendingTasks.length);
        setCurrentIndex(0);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('auth.loginErrorFallback');
        setError(message);
        setCards([]);
        setTotalCards(0);
        setCurrentIndex(0);
      } finally {
        if (mode === 'initial') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchTasks('initial');
    }, [fetchTasks]),
  );

  const sendSwipeResult = useCallback(
    async (task: TaskProgress, direction: 'like' | 'dislike') => {
      try {
        const [apikey, userId] = await Promise.all([
          AsyncStorage.getItem('@auth:apikey'),
          Promise.resolve(authUserIdRef.current),
        ]);

        if (!apikey || !userId) {
          throw new Error(t('auth.loginErrorFallback'));
        }

        const info = `${task.tarea}|${userId}|${task.id_meta}`;
        const endpoint = direction === 'like' ? 'lograrmeta' : 'nolograrmeta';

        const params = new URLSearchParams();
        params.append('info', info);

        await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            apikey,
          },
          body: params.toString(),
        });
      } catch (swipeError) {
        Alert.alert(
          t('screens.completeTasks.errorTitle'),
          swipeError instanceof Error ? swipeError.message : t('auth.loginErrorFallback'),
        );
      }
    },
    [t],
  );

  const handleSwipe = useCallback(
    (cardIdx: number, direction: 'like' | 'dislike') => {
      const swiped = cards[cardIdx];
      setCurrentIndex(cardIdx + 1);
      if (swiped) {
        void sendSwipeResult(swiped, direction);
      }
    },
    [cards, sendSwipeResult],
  );

  const handleRefresh = useCallback(() => {
    void fetchTasks('refresh');
  }, [fetchTasks]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.statusLabel, { color: palette.textSecondary }]}>
            {t('screens.completeTasks.loading')}
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={36} color={palette.accent} />
          <Text style={[styles.errorTitle, { color: palette.accent }]}>{error}</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[
              styles.retryButton,
              {
                backgroundColor: palette.primary,
              },
            ]}>
            <Ionicons name="refresh" size={16} color={palette.buttonText} />
            <Text style={[styles.retryLabel, { color: palette.buttonText }]}>
              {t('screens.taskReminders.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!currentCard) {
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={60} color={palette.accent} />
          <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
            {t('screens.completeTasks.emptyTitle')}
          </Text>
          <Text style={[styles.emptyMessage, { color: palette.textSecondary }]}>
            {t('screens.completeTasks.emptyMessage')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.cardWrapper}>
        {totalCards > 0 && (
          <Text style={[styles.counterLabel, { color: palette.textSecondary }]}>
            {progressIndex} / {totalCards}
          </Text>
        )}
        <View pointerEvents="box-none" style={styles.swiperContainer}>
          <Swiper
            ref={swiperRef}
            cards={cards}
            cardIndex={currentIndex}
            backgroundColor="transparent"
            stackSize={3}
            stackSeparation={10}
            stackScale={5}
            disableTopSwipe
            disableBottomSwipe
            animateCardOpacity
            cardStyle={{ width: '100%' }}
            cardHorizontalMargin={0}
            renderCard={(card) =>
              card ? (
              <View
                style={[
                  styles.cardBase,
                  {
                    backgroundColor: palette.surface,
                    borderColor: `${palette.border}80`,
                    shadowColor: palette.accent,
                  },
                ]}>
                  <Image source={require('@/assets/images/task.jpg')} style={styles.cardImage} />
                  <Text style={[styles.cardLabel, { color: palette.textSecondary }]}>{card.ambito}</Text>
                  <Text style={[styles.cardMeta, { color: palette.textOnSurface }]}>{card.meta}</Text>
                  <Text style={[styles.cardTask, { color: palette.textSecondary }]}>{card.tarea}</Text>
                </View>
              ) : (
              <View style={[styles.cardBase, styles.cardPlaceholder]}>
                  <Ionicons name="checkmark-done-circle" size={40} color={palette.accent} />
                  <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                    {t('screens.completeTasks.emptyTitle')}
                  </Text>
                </View>
              )
            }
            onSwipedLeft={(index) => handleSwipe(index, 'dislike')}
            onSwipedRight={(index) => handleSwipe(index, 'like')}
            onSwipedAll={() => setCurrentIndex(cards.length)}
            overlayLabels={{
              left: {
                title: t('screens.completeTasks.dislike'),
                style: {
                wrapper: styles.overlayWrapperLeft,
                label: [styles.overlayLabel, styles.overlayLabelLeft],
                },
              },
              right: {
                title: t('screens.completeTasks.like'),
                style: {
                wrapper: styles.overlayWrapperRight,
                label: [styles.overlayLabel, styles.overlayLabelRight],
                },
              },
            }}
          />
        </View>
        <View style={styles.instructions}>
          <Ionicons name="swap-horizontal" size={16} color={palette.inputPlaceholder} />
          <Text style={[styles.instructionsLabel, { color: palette.inputPlaceholder }]}>
            {t('screens.completeTasks.instructions')}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <AppScreen
      titleKey="tabs.completeTasks"
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
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
  },
  cardWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
  },
  counterLabel: {
    fontSize: 14,
    letterSpacing: 1,
  },
  cardLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardBase: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 10,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardMeta: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardTask: {
    fontSize: 16,
    lineHeight: 22,
  },
  swiperContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    maxHeight: 420,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 100,
  },
  instructionsLabel: {
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  cardImage: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  overlayLabel: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  overlayWrapperLeft: {
    position: 'absolute',
    top: 24,
    left: 16,
  },
  overlayWrapperRight: {
    position: 'absolute',
    top: 24,
    right: 16,
    alignItems: 'flex-end',
  },
  overlayLabelLeft: {
    color: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  overlayLabelRight: {
    color: '#2ECC71',
    borderColor: '#2ECC71',
  },
});

