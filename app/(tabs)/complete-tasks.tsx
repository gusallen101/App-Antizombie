import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Swiper from 'react-native-deck-swiper';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';
import { scheduleStreakMilestoneNotification } from '@/lib/notifications';

const STREAK_KEY = '@user_streak_data';

type TaskProgress = {
  id_meta: number;
  meta: string;
  tarea: string;
  ambito: string;
};

export default function CompleteTasksScreen() {
  const { palette, colorScheme } = useAppTheme();
  const { t } = useLocalization();
  const router = useRouter();
  const swiperRef = useRef<Swiper<TaskProgress>>(null);
  const authUserIdRef = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; color: string } | null>(null);
  const feedbackTimeoutRef = useRef<any>(null);

  const [cards, setCards] = useState<TaskProgress[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentCard = cards[currentIndex];
  const progressIndex = currentCard ? currentIndex + 1 : totalCards;

  const showFeedback = useCallback((message: string, color: string) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback({ message, color });
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 2000); // El mensaje durará 2 segundos
  }, []);

  // LOGICA DE RACHA
  const updateStreakProgress = useCallback(async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
      const data = jsonValue != null ? JSON.parse(jsonValue) : { currentStreak: 0, lastCompletedDate: null };
      
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      let lastDate = data.lastCompletedDate ? new Date(data.lastCompletedDate) : null;
      let lastMidnight = lastDate ? new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime() : 0;

      const diffInDays = (todayMidnight - lastMidnight) / (1000 * 60 * 60 * 24);

      let newStreak = data.currentStreak;
      let recoverableStreak = data.recoverableStreak || 0;
      let recoveryAvailable = data.recoveryAvailable || false;

      if (diffInDays === 1) {
        newStreak += 1;
        recoveryAvailable = false; // Continuó normalmente, no hay nada que recuperar
      } else if (diffInDays > 1 || lastMidnight === 0) {
        if (diffInDays > 1 && newStreak > 0) {
          // Guardamos la racha que se acaba de perder
          recoverableStreak = newStreak;
          recoveryAvailable = true;
        }
        newStreak = 1;
      }
      // Si diffInDays === 0, no aumentamos (ya lo hizo hoy)

      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({
        currentStreak: newStreak,
        lastCompletedDate: now.toISOString(),
        recoverableStreak,
        recoveryAvailable,
      }));
      await scheduleStreakMilestoneNotification(newStreak);
    } catch (e) {
      console.error("Error actualizando racha", e);
    }
  }, []);

  const fetchTasks = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);
      if (!apikey || !userId) throw new Error(t('auth.loginErrorFallback'));
      authUserIdRef.current = userId;
      const response = await fetch(`${API_CONFIG.baseUrl}avance_usuario/${userId}`, { headers: { apikey } });
      if (!response.ok) throw new Error('Error al obtener tareas');
      const json = await response.json();
      // Obtenemos las tareas pendientes. Invertimos el orden para que las más nuevas
      // (o relevantes según tu API) queden arriba.
      const pendingTasks = (json.array_no_revisadas ?? []).slice();
      setCards(pendingTasks);
      setTotalCards(pendingTasks.length);
      setCurrentIndex(0);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('auth.loginErrorFallback'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void fetchTasks('initial'); }, [fetchTasks]));

  const sendSwipeResult = useCallback(async (task: TaskProgress, direction: 'like' | 'dislike') => {
    try {
      const apikey = await AsyncStorage.getItem('@auth:apikey');
      const userId = authUserIdRef.current;
      if (!apikey || !userId) throw new Error(t('auth.loginErrorFallback'));
      const endpoint = direction === 'like' ? 'lograrmeta' : 'nolograrmeta';
      const params = new URLSearchParams();
      params.append('info', `${task.tarea}|${userId}|${task.id_meta}`);
      await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', apikey },
        body: params.toString(),
      });
    } catch (swipeError) {
      Alert.alert(t('screens.completeTasks.errorTitle'), t('screens.completeTasks.saveError'));
    }
  }, [t]);

  const handleSwipe = useCallback((cardIdx: number, direction: 'like' | 'dislike') => {
    const swiped = cards[cardIdx];
    setCurrentIndex(cardIdx + 1);

    if (direction === 'like') {
      showFeedback(t('screens.completeTasks.likeFeedback'), '#26de81'); // Verde
      void updateStreakProgress();
    } else {
      showFeedback(t('screens.completeTasks.dislikeFeedback'), '#FF4757'); // Rojo/Coral
    }

    if (swiped) {
      void sendSwipeResult(swiped, direction);
    }
  }, [cards, sendSwipeResult, updateStreakProgress, showFeedback, t]);

  const renderContent = () => {
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>;
    if (error) return <View style={styles.center}><Text style={{ color: palette.accent }}>{error}</Text></View>;
    if (!currentCard) return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={60} color={palette.accent} />
        <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
          {t('screens.completeTasks.emptyTitle')}
        </Text>
        <TouchableOpacity 
          style={[styles.backButtonFinish, { backgroundColor: palette.primary }]} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonFinishText}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={styles.cardWrapper}>
        {feedback && (
          <View style={[styles.feedbackPopup, { backgroundColor: feedback.color }]}>
            <Text style={styles.feedbackPopupText}>{feedback.message}</Text>
          </View>
        )}
        <Text style={[
          styles.counterLabel, 
          { color: colorScheme === 'light' ? '#666666' : palette.textSecondary }
        ]}>
          {progressIndex} / {totalCards}
        </Text>
        <View pointerEvents="box-none" style={styles.swiperContainer}>
          <Swiper
            ref={swiperRef}
            cards={cards}
            cardIndex={currentIndex}
            backgroundColor="transparent"
            stackSize={3}
            disableTopSwipe
            disableBottomSwipe
            cardHorizontalMargin={60}
            cardVerticalMargin={30}
            containerStyle={{ backgroundColor: 'transparent' }}
            renderCard={(card) => card ? (
              <View style={[
                styles.cardBase, 
                { 
                  backgroundColor: palette.surface, 
                  borderColor: colorScheme === 'light' ? '#333333' : palette.border 
                }
              ]}>
                <Image source={require('@/assets/images/task.jpg')} style={styles.cardImage} />
                <Text style={[
                  styles.cardLabel, 
                  { color: colorScheme === 'light' ? '#666666' : palette.textSecondary }
                ]}>{card.ambito}</Text>
                <Text style={[
                  styles.cardMeta, 
                  { color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }
                ]}>{card.meta}</Text>
                <Text style={[
                  styles.cardTask, 
                  { color: colorScheme === 'light' ? '#333333' : palette.textSecondary }
                ]}>{card.tarea}</Text>
              </View>
            ) : null}
            onSwipedLeft={(index) => handleSwipe(index, 'dislike')}
            onSwipedRight={(index) => handleSwipe(index, 'like')}
            overlayLabels={{
              left: { title: t('screens.completeTasks.no'), style: { label: styles.overlayLabelLeft, wrapper: styles.overlayWrapperLeft } },
              right: { title: t('screens.completeTasks.yes'), style: { label: styles.overlayLabelRight, wrapper: styles.overlayWrapperRight } }
            }}
          />
        </View>
      </View>
    );
  };

  return (
    <AppScreen titleKey="tabs.completeTasks" contentContainerStyle={styles.screenContent} scrollEnabled={!currentCard}>
      {renderContent()}
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  screenContent: { flexGrow: 1, paddingBottom: 100, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  cardWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 0 },
  counterLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10, opacity: 0.6 },
  cardBase: { 
    width: '100%', 
    height: 400,
    borderRadius: 30, 
    borderWidth: 1, 
    padding: 20, 
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    justifyContent: 'flex-start'
  },
  cardImage: { 
    width: '100%', 
    height: 160, 
    borderRadius: 16, 
    marginBottom: 10 
  },
  cardLabel: { fontSize: 12, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  cardMeta: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  cardTask: { fontSize: 16, lineHeight: 24, opacity: 0.8 },
  swiperContainer: { 
    width: '100%', 
    height: 520,
  },
  feedbackPopup: {
    position: 'absolute',
    top: -20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    zIndex: 999,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  feedbackPopupText: { color: '#FFF', fontWeight: '700', textAlign: 'center' },
  overlayWrapperLeft: { position: 'absolute', top: 40, left: 30 },
  overlayWrapperRight: { position: 'absolute', top: 40, right: 30 },
  overlayLabelLeft: { color: '#FFF', backgroundColor: '#FF4757', padding: 10, borderRadius: 10 },
  overlayLabelRight: { color: '#FFF', backgroundColor: '#26de81', padding: 10, borderRadius: 10 },
  backButtonFinish: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  backButtonFinishText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});