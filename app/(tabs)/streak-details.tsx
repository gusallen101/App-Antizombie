import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, Platform, TouchableOpacity, View, ScrollView, Modal } from 'react-native';
import { AppScreen } from '@/components/layout/app-screen';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

const STREAK_KEY = '@user_streak_data';
const INITIAL_ANTIDOTES = 3;

export default function StreakDetailsScreen() {
  const { palette, colorScheme } = useAppTheme();
  const { t } = useLocalization();
  const router = useRouter();

  const [streak, setStreak] = useState(0);
  const [antidotes, setAntidotes] = useState(INITIAL_ANTIDOTES);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [recoverableStreak, setRecoverableStreak] = useState(0);
  const [isSafeToday, setIsSafeToday] = useState(false);

  // --- LÓGICA DE TUTORIAL ---
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const checkTutorial = useCallback(async () => {
    const isActive = await AsyncStorage.getItem('@tutorial:active');
    const seenStepsRaw = (await AsyncStorage.getItem('@tutorial:seen_steps')) || '[]';
    const seenSteps: string[] = JSON.parse(seenStepsRaw);

    if (isActive === 'true' && !seenSteps.includes('streakDetails')) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = async () => {
    setShowTutorial(false);
    const seenStepsRaw = (await AsyncStorage.getItem('@tutorial:seen_steps')) || '[]';
    const seenSteps: string[] = JSON.parse(seenStepsRaw);

    if (!seenSteps.includes('streakDetails')) {
      seenSteps.push('streakDetails');
      await AsyncStorage.setItem('@tutorial:seen_steps', JSON.stringify(seenSteps));
    }
  };

  const handleNextTutorial = () => {
    if (tutorialStep < 3) {
      const nextStep = tutorialStep + 1;
      setTutorialStep(nextStep);
      // Scroll automático para asegurar que el elemento resaltado sea visible
      if (nextStep === 2) {
        scrollViewRef.current?.scrollTo({ y: 150, animated: true });
      } else if (nextStep === 3) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    } else {
      void dismissTutorial();
    }
  };

  const loadData = useCallback(async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
      if (jsonValue) {
        const data = JSON.parse(jsonValue);
        setStreak(data.currentStreak || 0);
        setAntidotes(data.antidoteCount !== undefined ? data.antidoteCount : INITIAL_ANTIDOTES);
        setRecoveryAvailable(data.recoveryAvailable || false);
        setRecoverableStreak(data.recoverableStreak || 0);

        // Verificar si ya completó tareas hoy
        if (data.lastCompletedDate) {
          const now = new Date();
          const lastDate = new Date(data.lastCompletedDate);
          const isToday = now.getFullYear() === lastDate.getFullYear() &&
                          now.getMonth() === lastDate.getMonth() &&
                          now.getDate() === lastDate.getDate();
          setIsSafeToday(isToday);
        }
      } else {
        // Inicializar por primera vez con 3 antídotos
        const initialData = { currentStreak: 0, antidoteCount: INITIAL_ANTIDOTES };
        await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(initialData));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      void checkTutorial();

      const timer = setInterval(() => {
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const diff = endOfDay.getTime() - now.getTime();

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        setTimeRemaining(`${hours}${t('screens.home.streakHours')} ${minutes}${t('screens.home.streakMinutes')}`);
      }, 1000);

      return () => clearInterval(timer);
    }, [loadData, t, checkTutorial])
  );

  const handleUseAntidote = async () => {
    if (antidotes <= 0) {
      Alert.alert(t('screens.home.restoreStreakTitle'), t('screens.home.streakNoAntidotes'));
      return;
    }

    try {
      const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
      if (jsonValue) {
        const data = JSON.parse(jsonValue);
        const restoredValue = (data.currentStreak || 0) + (data.recoverableStreak || 0);
        
        const updatedData = {
          ...data,
          currentStreak: restoredValue,
          recoveryAvailable: false,
          recoverableStreak: 0,
          antidoteCount: antidotes - 1
        };

        await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updatedData));
        setStreak(restoredValue);
        setAntidotes(antidotes - 1);
        setRecoveryAvailable(false);
        Alert.alert(t('screens.home.streakRecovered'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const tutorialSteps = [
    { title: t('screens.home.tutorialStreakTitle'), desc: t('screens.home.tutorialStreakDesc'), icon: 'flame' },
    { title: t('screens.home.tutorialTimeTitle'), desc: t('screens.home.tutorialTimeDesc'), icon: 'hourglass' },
    { title: t('screens.home.tutorialAntidoteTitle'), desc: t('screens.home.tutorialAntidoteDesc'), icon: 'flask' },
    { title: t('screens.home.tutorialExplainTitle'), desc: t('screens.home.tutorialExplainDesc'), icon: 'information-circle' },
  ];

  return (
    <AppScreen titleKey="screens.home.streakTitle">
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
      >

        <TouchableOpacity 
          style={styles.backLink} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={palette.primary} />
          <Text style={[styles.backLinkText, { color: palette.primary }]}>{t('common.goBack')}</Text>
        </TouchableOpacity>
        
        {/* --- HERO SECTION --- */}
        <View style={[
          styles.heroSection,
          showTutorial && tutorialStep === 0 && { 
            backgroundColor: palette.primary + '10', 
            borderRadius: 32,
            paddingVertical: 10,
            borderWidth: 2, 
            borderColor: palette.primary 
          }
        ]}>
          <View style={[styles.flameGlow, { backgroundColor: '#FF8C00' + '15' }]}>
            <Ionicons name="flame" size={110} color="#FF8C00" style={styles.flameIcon} />
          </View>
          <Text style={[styles.streakNumber, { color: palette.textOnSurface }]}>
            {streak}
          </Text>
          <Text style={[styles.streakText, { color: palette.primary }]}>
            {t('tabs.home')}
          </Text>
        </View>

        {/* --- TARJETA DE TIEMPO --- */}
        <View style={[
          styles.card, 
          { 
            backgroundColor: palette.surface, 
            borderColor: (showTutorial && tutorialStep === 1) ? palette.primary : (isSafeToday ? '#4CD964' : palette.border),
            borderWidth: (showTutorial && tutorialStep === 1) ? 3 : 1
          }
        ]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons 
              name={isSafeToday ? "checkmark-circle" : "hourglass-outline"} 
              size={20} 
              color={isSafeToday ? "#4CD964" : palette.inputPlaceholder} 
            />
            <Text style={[styles.cardLabel, { color: isSafeToday ? "#4CD964" : palette.inputPlaceholder }]}>
              {isSafeToday ? t('screens.home.streakSafe') : t('screens.home.streakTimeRemaining')}
            </Text>
          </View>
          <Text style={[styles.timerValue, { color: isSafeToday ? "#4CD964" : palette.textOnSurface }]}>
            {isSafeToday ? t('screens.completeTasks.yes') : timeRemaining}
          </Text>
        </View>

        {/* --- TARJETA DE ANTÍDOTOS --- */}
        <View style={[
          styles.card, 
          { backgroundColor: palette.surface, borderColor: (showTutorial && tutorialStep === 2) ? palette.primary : palette.border,
            borderWidth: (showTutorial && tutorialStep === 2) ? 3 : 1
          }
        ]}>
          <View style={styles.antidoteHeader}>
            <View style={[styles.iconContainer, { backgroundColor: palette.accent + '20' }]}>
              <Ionicons name="flask" size={24} color={palette.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.antidoteTitle, { color: palette.textOnSurface }]}>
                {t('screens.home.streakAntidotes')}
              </Text>
              <Text style={[styles.antidoteCountText, { color: palette.inputPlaceholder }]}>
                {antidotes} {t('screens.home.streakAntidotes').toLowerCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.antidoteGrid}>
            {[...Array(INITIAL_ANTIDOTES)].map((_, i) => {
              const isAvailable = i < antidotes;
              return (
                <View 
                  key={i} 
                  style={[
                    styles.antidoteItem, 
                    { 
                      backgroundColor: isAvailable ? palette.accent + '20' : palette.border + '50',
                      borderColor: isAvailable ? palette.accent + '40' : 'transparent',
                    }
                  ]}
                >
                  <Ionicons 
                    name={isAvailable ? "heart" : "heart-outline"} 
                    size={28} 
                    color={isAvailable ? palette.accent : palette.inputPlaceholder} 
                  />
                </View>
              );
            })}
          </View>

          <Text style={[styles.desc, { color: palette.inputPlaceholder }]}>
            {t('screens.home.streakAntidoteDesc')}
          </Text>

          <TouchableOpacity 
            activeOpacity={0.8}
            disabled={!recoveryAvailable || antidotes === 0}
            onPress={handleUseAntidote}
            style={[
              styles.useButton, 
              { 
                backgroundColor: (recoveryAvailable && antidotes > 0) 
                  ? palette.accent 
                  : (colorScheme === 'light' ? '#E5E7EB' : palette.border) 
              }
            ]}
          >
            <Ionicons 
              name="shield-checkmark" 
              size={20} 
              color={(recoveryAvailable && antidotes > 0) ? palette.buttonText : (colorScheme === 'light' ? '#9CA3AF' : '#FFFFFF')} 
            />
            <Text style={[
              styles.useButtonText, 
              { color: (recoveryAvailable && antidotes > 0) ? palette.buttonText : (colorScheme === 'light' ? '#9CA3AF' : '#FFFFFF') }
            ]}>
              {t('screens.home.streakUseAntidote')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- TARJETA EXPLICATIVA --- */}
        <View style={[
          styles.card, 
          { backgroundColor: palette.surface, borderColor: (showTutorial && tutorialStep === 3) ? palette.primary : palette.border, marginBottom: 20,
            borderWidth: (showTutorial && tutorialStep === 3) ? 3 : 1
          }
        ]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="information-circle-outline" size={22} color={palette.primary} />
            <Text style={[styles.cardLabel, { color: palette.textOnSurface }]}>
              {t('screens.home.streakExplainerTitle')}
            </Text>
          </View>
          <View style={styles.explainerContent}>
            <Text style={[styles.explainerText, { color: palette.textOnSurface }]}>
              {t('screens.home.streakExplainerStep1')}
            </Text>
            <Text style={[styles.explainerText, { color: palette.textOnSurface }]}>
              {t('screens.home.streakExplainerStep2')}
            </Text>
            <Text style={[styles.explainerText, { color: palette.textOnSurface }]}>
              {t('screens.home.streakExplainerStep3')}
            </Text>
            <Text style={[styles.explainerText, { color: palette.textOnSurface }]}>
              {t('screens.home.streakExplainerStep4')}
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Modal para el tutorial interactivo */}
      <Modal visible={showTutorial} transparent animationType="fade">
        <View style={styles.tutorialOverlay}>
          <View style={[styles.tutorialCard, { backgroundColor: palette.surface }]}>
            <View style={styles.tutorialHeader}>
              <Ionicons name="arrow-up" size={28} color={palette.primary} />
              <Text style={[styles.tutorialStepText, { color: palette.inputPlaceholder }]}>
                {tutorialStep + 1} / 4
              </Text>
            </View>
            
            <View style={styles.tutorialContent}>
              <Ionicons name={tutorialSteps[tutorialStep].icon as any} size={48} color={palette.primary} />
              <Text style={[styles.tutorialTitle, { color: palette.textOnSurface }]}>
                {tutorialSteps[tutorialStep].title}
              </Text>
              <Text style={[styles.tutorialDesc, { color: palette.inputPlaceholder }]}>
                {tutorialSteps[tutorialStep].desc}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.tutorialButton, { backgroundColor: palette.primary }]} 
              onPress={handleNextTutorial}
            >
              <Text style={[styles.tutorialButtonText, { color: palette.buttonText }]}>
                {tutorialStep === 3 ? t('common.ok') : t('screens.onboarding.next')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 24, 
    gap: 20, 
    paddingBottom: Platform.OS === 'ios' ? 120 : 100 
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  flameGlow: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  flameIcon: {
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  streakNumber: { 
    fontSize: 72, 
    fontWeight: '900', 
    lineHeight: 80,
    letterSpacing: -2,
  },
  streakText: { 
    fontSize: 20, 
    fontWeight: '800', 
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: -4,
  },

  // Cards genéricas
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardLabel: { 
    fontSize: 14, 
    fontWeight: '700', 
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Tarjeta de Tiempo
  timerValue: { 
    fontSize: 36, 
    fontWeight: '800', 
    textAlign: 'center',
    fontVariant: ['tabular-nums'], // Evita que los números "salten" al cambiar el segundo
  },

  // Tarjeta de Antídotos
  antidoteHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16 
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  antidoteTitle: { 
    fontSize: 20, 
    fontWeight: '800' 
  },
  antidoteCountText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  antidoteGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  antidoteItem: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: '30%',
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: { 
    fontSize: 15, 
    lineHeight: 22,
    textAlign: 'center',
  },
  useButton: {
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  useButtonText: { 
    fontWeight: '800', 
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: '600',
  },
  explainerContent: {
    gap: 12,
  },
  explainerText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: 24,
    paddingBottom: 40,
  },
  tutorialCard: {
    borderRadius: 32,
    padding: 24,
    gap: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  tutorialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tutorialStepText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tutorialContent: {
    gap: 12,
    alignItems: 'center',
  },
  tutorialTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  tutorialDesc: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  tutorialButton: {
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  tutorialButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});