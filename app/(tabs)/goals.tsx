import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import {
  DEFAULT_GOAL_CATEGORY,
  GOAL_CATEGORIES,
  GOAL_CATEGORY_TYPE,
  type GoalCategoryDescriptor,
  type GoalCategoryKey,
} from '@/constants/goals';

import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type GoalForm = {
  name: string;
  tasks: string[];
  frequency: string;
};

const MAX_GOALS = 5;

export default function GoalsScreen() {
  const { t } = useLocalization();
  const { colorScheme, palette } = useAppTheme();
  const { width } = useWindowDimensions();

  const horizontalPadding = 24;
  const cardWidth = width - horizontalPadding * 2;
  const gap = 12;

  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<GoalCategoryKey>(DEFAULT_GOAL_CATEGORY);
  const [saving, setSaving] = useState(false);
  const [goalsForm, setGoalsForm] = useState<GoalForm[]>([
    { name: '', tasks: [''], frequency: '1' },
  ]);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const categories = useMemo(
    () =>
      GOAL_CATEGORIES.map((item) => ({
        ...item,
        title: t(item.titleKey),
        description: t(item.descriptionKey),
      })),
    [t],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const openModal = useCallback((category: GoalCategoryKey) => {
    setSelectedCategory(category);
    setGoalsForm([{ name: '', tasks: [''], frequency: '1' }]);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const addGoalForm = () => {
    if (goalsForm.length >= MAX_GOALS) return;
    setGoalsForm((prev) => [...prev, { name: '', tasks: [''], frequency: '1' }]);
  };

  const removeGoalForm = (index: number) => {
    setGoalsForm((prev) => prev.filter((_, i) => i !== index));
  };

  const updateGoalNameForm = (value: string, index: number) => {
    setGoalsForm((prev) =>
      prev.map((g, i) => (i === index ? { ...g, name: value } : g)),
    );
  };

  const updateFrequencyForm = (value: string, index: number) => {
    let numericValue = value.replace(/[^0-9]/g, '');
    const val = Number(numericValue);
    if (val > 7) numericValue = '7';
    if (numericValue !== '' && val < 1) numericValue = '1';
    
    setGoalsForm((prev) =>
      prev.map((g, i) => (i === index ? { ...g, frequency: numericValue } : g)),
    );
  };

  const addTaskForm = (goalIndex: number) => {
    setGoalsForm((prev) =>
      prev.map((g, i) =>
        i === goalIndex ? { ...g, tasks: [...g.tasks, ''] } : g,
      ),
    );
  };

  const updateTaskForm = (goalIndex: number, taskIndex: number, value: string) => {
    setGoalsForm((prev) =>
      prev.map((g, i) =>
        i === goalIndex
          ? { ...g, tasks: g.tasks.map((t, ti) => (ti === taskIndex ? value : t)) }
          : g,
      ),
    );
  };

  const removeTaskForm = (goalIndex: number, taskIndex: number) => {
    setGoalsForm((prev) =>
      prev.map((g, i) =>
        i === goalIndex
          ? { ...g, tasks: g.tasks.length === 1 ? g.tasks : g.tasks.filter((_, ti) => ti !== taskIndex) }
          : g,
      ),
    );
  };

  const handleSaveGoal = useCallback(async () => {
    const validGoals = goalsForm
      .map((goal) => ({
        name: goal.name.trim(),
        tasks: goal.tasks.map((t) => t.trim()).filter(Boolean),
        frequency: goal.frequency || '1',
      }))
      .filter((goal) => goal.name && goal.tasks.length > 0);

    if (validGoals.length === 0) {
      Alert.alert(t('screens.goals.form.errorTitle'), t('screens.goals.form.validationName'));
      return;
    }

    try {
      setSaving(true);
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);

      if (!apikey || !userId) throw new Error(t('auth.loginErrorFallback'));

      for (const goal of validGoals) {
        const params = new URLSearchParams();
        params.append('id_usuario', userId);
        params.append('etiqueta', goal.name);
        params.append('tareas', goal.tasks.join('|'));
        params.append('tipo', String(GOAL_CATEGORY_TYPE[selectedCategory]));
        params.append('frecuencia', goal.frequency);

        const response = await fetch(`${API_CONFIG.baseUrl}meta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            apikey,
          },
          body: params.toString(),
        });

        if (!response.ok) throw new Error(t('screens.goals.form.errorTitle'));
      }

      Alert.alert(t('screens.goals.form.successTitle'), t('screens.goals.form.successMessage'));
      closeModal();
      setGoalsForm([{ name: '', tasks: [''], frequency: '1' }]);
    } catch (error) {
      Alert.alert(t('screens.goals.form.errorTitle'), error instanceof Error ? error.message : t('auth.loginErrorFallback'));
    } finally {
      setSaving(false);
    }
  }, [closeModal, selectedCategory, t, goalsForm]);

  const renderCard = ({ item }: { item: GoalCategoryDescriptor & { title: string; description: string } }) => (
    <LinearGradient
      colors={item.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width: cardWidth }]}
    >
      <View style={[styles.cardBgCircle, { backgroundColor: `${item.accent}15` }]} />
      
      <View style={styles.cardHeader}>
        <View style={[styles.mainIconWrapper, { shadowColor: item.accent }]}>
          <LinearGradient colors={[`${item.accent}40`, 'transparent']} style={styles.iconGlow} />
          <Ionicons name={item.icon} size={64} color={item.accent} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.cardTitle, { color: item.accent }]}>{item.title}</Text>
          <Text style={[styles.cardDescription, { color: `${item.accent}cc` }]}>{item.description}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.primaryButton, { backgroundColor: item.accent }]}
          onPress={() => openModal(item.key)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonLabel}>{t('screens.goals.add')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.secondaryButton, { borderColor: `${item.accent}40` }]}
          onPress={() => router.push({ pathname: '/view-goals', params: { category: item.key } })}
        >
          <Text style={[styles.secondaryButtonLabel, { color: item.accent }]}>{t('screens.goals.view')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  return (
    <AppScreen titleKey="tabs.goals" contentContainerStyle={styles.screenContent}>
      <View style={[styles.heroCard, { backgroundColor: palette.surface }]}>
        <Text style={[styles.heroTitle, { color: palette.textOnSurface }]}>{t('screens.goals.headline')}</Text>
        <Text style={[styles.heroDescription, { color: palette.inputPlaceholder }]}>{t('screens.goals.intro')}</Text>
      </View>

      <View style={styles.carouselWrapper}>
        <FlatList
          data={categories}
          renderItem={renderCard}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ width: gap }} />}
          pagingEnabled
          snapToInterval={cardWidth + gap}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
        <View style={styles.dots}>
          {categories.map((cat, i) => (
            <View key={cat.key} style={[styles.dot, { backgroundColor: i === activeIndex ? palette.primary : `${palette.textSecondary}40` }]} />
          ))}
        </View>
      </View>

      {/* MODAL FORMULARIO */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]}>
                  {t('screens.goals.form.title')}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={24} color={colorScheme === 'light' ? '#000000' : palette.inputPlaceholder} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {goalsForm.map((goal, goalIndex) => (
                  <View key={`goal-${goalIndex}`} style={styles.goalSection}>
                    <Text style={[styles.label, { color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]}>
                      {t('screens.goals.form.nameLabel')}
                    </Text>
                    <TextInput 
                      style={[styles.input, { borderColor: colorScheme === 'light' ? '#333333' : palette.border, color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]} 
                      value={goal.name} 
                      onChangeText={(v) => updateGoalNameForm(v, goalIndex)}
                      placeholderTextColor={colorScheme === 'light' ? '#666666' : palette.textSecondary}
                    />
                    
                    <Text style={[styles.label, { color: colorScheme === 'light' ? '#000000' : palette.textOnSurface, marginTop: 12 }]}>
                      {t('screens.goals.form.frequencyLabel')}
                    </Text>
                    <TextInput 
                      style={[styles.input, { borderColor: colorScheme === 'light' ? '#333333' : palette.border, color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]} 
                      value={goal.frequency} 
                      onChangeText={(v) => updateFrequencyForm(v, goalIndex)} 
                      keyboardType="number-pad" 
                      maxLength={1} 
                      placeholderTextColor={colorScheme === 'light' ? '#666666' : palette.textSecondary}
                    />
                    
                    {goal.tasks.map((task, taskIndex) => (
                      <View key={`task-${goalIndex}-${taskIndex}`} style={styles.taskRow}>
                        <TextInput 
                          style={[styles.input, styles.taskInput, { borderColor: colorScheme === 'light' ? '#333333' : palette.border, color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]} 
                          value={task} 
                          onChangeText={(v) => updateTaskForm(goalIndex, taskIndex, v)} 
                          placeholder={t('screens.goals.form.taskPlaceholder')} 
                          placeholderTextColor={colorScheme === 'light' ? '#666666' : palette.textSecondary}
                        />
                        {goal.tasks.length > 1 && <TouchableOpacity onPress={() => removeTaskForm(goalIndex, taskIndex)}><Ionicons name="trash" size={20} color={palette.accent} /></TouchableOpacity>}
                      </View>
                    ))}
                    <TouchableOpacity style={styles.addTaskButton} onPress={() => addTaskForm(goalIndex)}><Ionicons name="add" size={20} color={palette.primary} /><Text style={{ color: palette.primary }}>{t('screens.goals.form.taskAdd')}</Text></TouchableOpacity>
                  </View>
                ))}
                {goalsForm.length < MAX_GOALS && <TouchableOpacity style={styles.addGoalButton} onPress={addGoalForm}><Text style={{ color: palette.primary, fontWeight: 'bold' }}>{t('screens.goals.form.addGoal')}</Text></TouchableOpacity>}
              </ScrollView>

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: palette.primary }]} onPress={handleSaveGoal} disabled={saving}>
                <Text style={{ color: palette.buttonText, fontWeight: 'bold' }}>{saving ? '...' : t('screens.goals.form.save')}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingBottom: 100 },
  heroCard: { borderRadius: 28, padding: 24, marginBottom: 24, marginHorizontal: 24 },
  heroTitle: { fontSize: 26, fontWeight: '800' },
  heroDescription: { fontSize: 15, marginTop: 8 },
  carouselWrapper: { flex: 1, minHeight: 450 },
  card: { borderRadius: 40, padding: 30, height: 420, justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' },
  cardBgCircle: { position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100 },
  cardHeader: { alignItems: 'center', zIndex: 2 },
  mainIconWrapper: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginBottom: 20, elevation: 8, shadowOpacity: 0.2 },
  iconGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  textContainer: { alignItems: 'center' },
  cardTitle: { fontSize: 32, fontWeight: '900', marginBottom: 8 },
  cardDescription: { fontSize: 16, textAlign: 'center', fontWeight: '500' },
  cardActions: { width: '100%', gap: 10, zIndex: 2 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 20 },
  primaryButtonLabel: { color: '#FFF', fontSize: 16, fontWeight: '800', textTransform: 'uppercase' },
  secondaryButton: { paddingVertical: 14, borderRadius: 20, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center' },
  secondaryButtonLabel: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  dots: { marginTop: 20, flexDirection: 'row', gap: 10, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 32, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  goalSection: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 16, padding: 14, fontSize: 16 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  taskInput: { flex: 1 },
  addTaskButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  addGoalButton: { padding: 16, alignItems: 'center', marginTop: 10 },
  saveButton: { paddingVertical: 16, borderRadius: 20, alignItems: 'center', marginTop: 10 },
});