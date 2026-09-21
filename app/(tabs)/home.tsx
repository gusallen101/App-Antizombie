import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
  View,
  Platform,
  type ImageSourcePropType,
} from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

// --- Constantes ---
const STREAK_KEY = '@user_streak_data';
const ONBOARDING_KEY = '@app:hasSeenOnboarding';

type Gender = 'h' | 'm';
const DEFAULT_LEVEL = 1;
const MAX_LEVEL = 3;

const ZOMBIE_IMAGES: Record<Gender, Record<number, ImageSourcePropType>> = {
  h: { 1: require('@/assets/images/h/1.png'), 2: require('@/assets/images/h/2.png'), 3: require('@/assets/images/h/3.png') },
  m: { 1: require('@/assets/images/m/1.png'), 2: require('@/assets/images/m/2.png'), 3: require('@/assets/images/m/3.png') },
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
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // --- Estado para la racha ---
  const [streak, setStreak] = useState(0);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [recoverableStreak, setRecoverableStreak] = useState(0);

  // --- Cargar racha local ---
  const loadLocalStreak = useCallback(async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
      if (jsonValue) {
        const data = JSON.parse(jsonValue);
        let currentStreak = data.currentStreak || 0;
        let recStreak = data.recoverableStreak || 0;
        let isRecoverable = data.recoveryAvailable || false;
        const lastDateStr = data.lastCompletedDate;

        if (lastDateStr) {
          const now = new Date();
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const lastDate = new Date(lastDateStr);
          const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime();
          const diffInDays = (todayMidnight - lastMidnight) / (1000 * 60 * 60 * 24);

          if (diffInDays > 1 && currentStreak > 0) {
            recStreak = currentStreak;
            currentStreak = 0;
            isRecoverable = true;
            
            const updatedData = {
              ...data,
              currentStreak: 0,
              recoverableStreak: recStreak,
              recoveryAvailable: true
            };
            await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updatedData));
          }
        }

        setStreak(currentStreak);
        setRecoverableStreak(recStreak);
        setRecoveryAvailable(isRecoverable);
      }
    } catch (e) {
      console.error("Error cargando racha", e);
    }
  }, []);

  const handleRestoreStreak = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
      if (jsonValue) {
        const data = JSON.parse(jsonValue);
        const restoredValue = (data.currentStreak || 0) + (data.recoverableStreak || 0);
        
        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lastDate = data.lastCompletedDate ? new Date(data.lastCompletedDate) : null;
        const lastMidnight = lastDate ? new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime() : 0;

        const updatedData = {
          ...data,
          currentStreak: restoredValue,
          recoveryAvailable: false,
          recoverableStreak: 0
        };

        if (lastMidnight < todayMidnight) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          updatedData.lastCompletedDate = yesterday.toISOString();
        }

        await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updatedData));
        setStreak(restoredValue);
        setRecoveryAvailable(false);
        setRecoverableStreak(0);
        Alert.alert(t('screens.home.restoreStreakTitle'), t('screens.home.restoreSuccess'));
      }
    } catch (e) {
      console.error("Error restaurando racha", e);
    }
  };

  const checkOnboarding = useCallback(async () => {
    try {
      const hasSeen = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!hasSeen) {
        setShowOnboarding(true);
        setOnboardingStep(0);
      }
      if (hasSeen) setShowOnboarding(false);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const resolveZombieInfo = useCallback((payload: ZombieResponse | null | undefined) => {
    const genderValue = payload?.sexo === 'm' ? 'm' : 'h';
    const parsedLevel = Number(payload?.nivel_zombie ?? DEFAULT_LEVEL);
    const parsedSuccess = Number(payload?.porcentaje_exito_total ?? 0);
    let nextLevel = Number.isFinite(parsedLevel) && parsedLevel >= 1 ? Math.round(parsedLevel) : DEFAULT_LEVEL;
    if (parsedSuccess === 0) nextLevel = 2;
    nextLevel = Math.min(Math.max(nextLevel, 1), MAX_LEVEL);
    return { gender: genderValue as Gender, level: nextLevel };
  }, []);

  const fetchZombieStatus = useCallback(async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);
      
      await loadLocalStreak();
      await checkOnboarding();

      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);

      if (!apikey || !userId) throw new Error(t('auth.loginErrorFallback'));

      const response = await fetch(`${API_CONFIG.baseUrl}avance_usuario/${userId}`, {
        headers: { apikey },
      });

      if (!response.ok) throw new Error(t('screens.home.zombieError'));

      const data: ZombieResponse = await response.json();
      const { gender: resolvedGender, level: resolvedLevel } = resolveZombieInfo(data);

      setGender(resolvedGender);
      setZombieLevel(resolvedLevel);
      await AsyncStorage.setItem('@profile:gender', resolvedGender);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('screens.home.zombieError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, resolveZombieInfo, t, loadLocalStreak, checkOnboarding]);

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

  const illustrationSource = ZOMBIE_IMAGES[gender][zombieLevel] ?? ZOMBIE_IMAGES.h[DEFAULT_LEVEL];

  const onboardingSteps = [
    { title: t('screens.onboarding.welcomeTitle'), desc: t('screens.onboarding.welcomeDesc'), icon: 'hand-left-outline' as const },
    { title: t('screens.onboarding.step1Title'), desc: t('screens.onboarding.step1Desc'), icon: 'skull-outline' as const },
    { title: t('screens.onboarding.stepStreakTitle'), desc: t('screens.onboarding.stepStreakDesc'), icon: 'flame-outline' as const },
    { title: t('screens.onboarding.stepSwipeTitle'), desc: t('screens.onboarding.stepSwipeDesc'), icon: 'swap-horizontal-outline' as 'swap-horizontal-outline' },
    { title: t('screens.onboarding.step2Title'), desc: t('screens.onboarding.step2Desc'), icon: 'checkmark-done-circle-outline' as const },
    { title: t('screens.onboarding.stepProgressTitle'), desc: t('screens.onboarding.stepProgressDesc'), icon: 'pie-chart-outline' as 'pie-chart-outline' },
    { title: t('screens.onboarding.step3Title'), desc: t('screens.onboarding.step3Desc'), icon: 'cash-outline' as const },
    { title: t('screens.onboarding.step4Title'), desc: t('screens.onboarding.step4Desc'), icon: 'list-outline' as const },
    { title: t('screens.onboarding.step5Title'), desc: t('screens.onboarding.step5Desc'), icon: 'alarm-outline' as const },
    { title: t('screens.onboarding.step6Title'), desc: t('screens.onboarding.step6Desc'), icon: 'notifications-outline' as const },
    { title: t('screens.onboarding.step7Title'), desc: t('screens.onboarding.step7Desc'), icon: 'settings-outline' as const },
  ];

  const handleNextOnboarding = async () => {
    if (onboardingStep < onboardingSteps.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
    }
  };

  return (
    <AppScreen 
      titleKey="tabs.home" 
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />
      }
    >
      {/* --- Racha (Tarjeta Separada) --- */}
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => router.push('/streak-details')}
        style={[styles.card, styles.streakCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <View style={styles.streakIconWrapper}>
            <Ionicons name="flame" size={32} color="#FF4500" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={[styles.streakLabel, { color: palette.inputPlaceholder }]}>{t('screens.home.streakTitle')}</Text>
            <Text style={[styles.streakValue, { color: palette.textOnSurface }]}>{streak}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={palette.inputPlaceholder} />
      </TouchableOpacity>

      {/* --- Zombie/Avatar (Tarjeta Separada y más grande) --- */}
      <View style={[styles.card, styles.zombieCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.textOnSurface }]}>{t('screens.home.zombieHeading')}</Text>
        <View style={styles.zombieRow}>
          <Image source={illustrationSource} style={styles.illustration} resizeMode="contain" />
          <View style={styles.levelInfo}>
            {loading ? (
              <ActivityIndicator color={palette.primary} />
            ) : error ? (
              <TouchableOpacity onPress={fetchZombieStatus}>
                <Text style={[styles.retryLabel, { color: palette.primary }]}>{t('screens.home.zombieTryAgain')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={[styles.levelTitle, { color: palette.textOnSurface }]}>{levelDescriptor.title}</Text>
                <Text style={[styles.levelDescription, { color: palette.inputPlaceholder }]}>{levelDescriptor.description}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* --- Recuperación --- */}
      {recoveryAvailable && (
        <View style={[styles.recoveryCard, { backgroundColor: palette.accent + '15', borderColor: palette.accent }]}>
          <View style={styles.recoveryInfo}>
            <Ionicons name="medical-outline" size={28} color={palette.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recoveryTitle, { color: palette.textOnSurface }]}>{t('screens.home.restoreStreakTitle')}</Text>
              <Text style={[styles.recoveryDesc, { color: palette.inputPlaceholder }]}>{t('screens.home.restoreStreakDesc', { count: recoverableStreak })}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.recoveryButton, { backgroundColor: palette.accent }]} onPress={handleRestoreStreak}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('screens.home.restoreStreakButton')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- Acciones --- */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => router.push('/complete-tasks')} style={[styles.actionButton, { backgroundColor: palette.primary }]}>
          <Ionicons name="checkbox-outline" size={20} color={palette.buttonText} />
          <Text style={[styles.actionLabel, { color: palette.buttonText }]}>{t('screens.home.completeTasks')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => router.push('/task-reminders')} style={[styles.actionButton, { backgroundColor: palette.secondary }]}>
          <Ionicons name="notifications-outline" size={20} color={palette.buttonText} />
          <Text style={[styles.actionLabel, { color: palette.buttonText }]}>{t('screens.home.rememberTasks')}</Text>
        </TouchableOpacity>
      </View>

      {/* --- Modales --- */}
      <Modal visible={showOnboarding} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.onboardingCard, { backgroundColor: palette.surface }]}>
            <Ionicons name={onboardingSteps[onboardingStep].icon as any} size={64} color={palette.primary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.onboardingTitle, { color: palette.textOnSurface }]}>{onboardingSteps[onboardingStep].title}</Text>
            <Text style={[styles.onboardingDesc, { color: palette.inputPlaceholder }]}>{onboardingSteps[onboardingStep].desc}</Text>
            <TouchableOpacity style={[styles.onboardingButton, { backgroundColor: palette.primary }]} onPress={handleNextOnboarding}>
              <Text style={{ color: palette.buttonText, fontWeight: '700' }}>{onboardingStep === onboardingSteps.length - 1 ? t('screens.onboarding.finish') : t('screens.onboarding.next')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1, padding: 24, gap: 20, paddingBottom: Platform.OS === 'ios' ? 108 : 96 },
  card: { borderRadius: 28, padding: 24, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  
  // Estilo Racha
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streakIconWrapper: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF450015' },
  streakValue: { fontSize: 32, fontWeight: '900' },
  streakLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  // Estilo Zombie
  heading: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12 },
  zombieRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  illustration: { width: 160, height: 160 }, // Avatar más grande
  levelInfo: { flex: 1, gap: 4 },
  levelTitle: { fontSize: 22, fontWeight: '800' },
  levelDescription: { fontSize: 15, lineHeight: 22 },
  retryLabel: { fontWeight: '700' },

  actions: { width: '100%', gap: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 20 },
  actionLabel: { fontSize: 16, fontWeight: '700' },
  
  // Recuperación
  recoveryCard: { padding: 20, borderRadius: 24, borderWidth: 1.5, gap: 16 },
  recoveryInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recoveryTitle: { fontSize: 16, fontWeight: '800' },
  recoveryDesc: { fontSize: 14, lineHeight: 20 },
  recoveryButton: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },

  // Modales
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  onboardingCard: { padding: 32, borderRadius: 32, gap: 16 },
  onboardingTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  onboardingDesc: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  onboardingButton: { marginTop: 16, paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
});