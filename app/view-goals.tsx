import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import {
    DEFAULT_GOAL_CATEGORY,
    GOAL_CATEGORIES,
    GOAL_CATEGORY_TYPE,
    type GoalCategoryDescriptor,
    type GoalCategoryKey,
    isGoalCategoryKey,
} from '@/constants/goals';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type GoalPayload = {
  id: number;
  etiqueta: string;
  tareas: string[] | string;
  porcentaje: number | string;
  tipo: number;
};

type Goal = {
  id: number;
  etiqueta: string;
  tasks: string[];
  progress: number;
  tipo: number;
};

const CIRCLE_RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export default function ViewGoalsScreen() {
  const { t } = useLocalization();
  const { palette } = useAppTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ category?: GoalCategoryKey }>();
  const initialCategory = useMemo(
    () => (isGoalCategoryKey(params.category) ? params.category : DEFAULT_GOAL_CATEGORY),
    [params.category],
  );

  const [category, setCategory] = useState<GoalCategoryKey>(initialCategory);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editName, setEditName] = useState('');
  const [editTasks, setEditTasks] = useState<string[]>(['']);
  const [savingEdit, setSavingEdit] = useState(false);

  const hasFocusedOnce = useRef(false);
  const categoryRef = useRef(category);

  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  const selectedCategory = useMemo<GoalCategoryDescriptor>(() => {
    return GOAL_CATEGORIES.find((item) => item.key === category) ?? GOAL_CATEGORIES[0];
  }, [category]);

  const normalizePayload = useCallback(
    (payload: GoalPayload): Goal => ({
      id: payload.id,
      etiqueta: payload.etiqueta ?? '',
      tasks: Array.isArray(payload.tareas)
        ? payload.tareas.filter(Boolean)
        : String(payload.tareas ?? '')
            .split('|')
            .map((task) => task.trim())
            .filter(Boolean),
      progress: Number.parseFloat(String(payload.porcentaje ?? '0')) || 0,
      tipo: payload.tipo,
    }),
    [],
  );

  const fetchGoals = useCallback(
    async (targetCategory: GoalCategoryKey, options?: { skipLoading?: boolean }) => {
      try {
        setError(null);
        if (!options?.skipLoading) {
          setLoading(true);
        }

        const [apikey, userId] = await Promise.all([
          AsyncStorage.getItem('@auth:apikey'),
          AsyncStorage.getItem('@auth:userId'),
        ]);

        if (!apikey || !userId) {
          throw new Error(t('auth.loginErrorFallback'));
        }

        const response = await fetch(
          `${API_CONFIG.baseUrl}metas/${GOAL_CATEGORY_TYPE[targetCategory]}/${userId}`,
          {
            headers: {
              apikey,
            },
          },
        );

        if (!response.ok) {
          throw new Error(t('screens.viewGoals.errorTitle'));
        }

        const data: GoalPayload[] = await response.json();
        const normalized = Array.isArray(data) ? data.map(normalizePayload) : [];
        setGoals(normalized);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : t('screens.viewGoals.errorTitle'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [normalizePayload, t],
  );

  useEffect(() => {
    void fetchGoals(category);
  }, [category, fetchGoals]);

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) {
        void fetchGoals(categoryRef.current);
      } else {
        hasFocusedOnce.current = true;
      }
    }, [fetchGoals]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchGoals(categoryRef.current, { skipLoading: true });
  }, [fetchGoals]);

  const openEditModal = useCallback(
    (goal: Goal) => {
      setEditingGoal(goal);
      setEditName(goal.etiqueta);
      setEditTasks(goal.tasks.length ? goal.tasks : ['']);
      setEditModalVisible(true);
    },
    [],
  );

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingGoal(null);
  }, []);

  const handleEditTaskChange = useCallback((value: string, index: number) => {
    setEditTasks((prev) => prev.map((task, idx) => (idx === index ? value : task)));
  }, []);

  const handleAddEditTask = useCallback(() => {
    setEditTasks((prev) => [...prev, '']);
  }, []);

  const handleRemoveEditTask = useCallback((index: number) => {
    setEditTasks((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  }, []);

  const handleUpdateGoal = useCallback(async () => {
    if (!editingGoal) {
      return;
    }

    const trimmedName = editName.trim();
    const formattedTasks = editTasks.map((task) => task.trim()).filter(Boolean);

    if (!trimmedName) {
      Alert.alert(t('screens.goals.form.errorTitle'), t('screens.goals.form.validationName'));
      return;
    }

    if (formattedTasks.length === 0) {
      Alert.alert(t('screens.goals.form.errorTitle'), t('screens.goals.form.validationTask'));
      return;
    }

    try {
      setSavingEdit(true);
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);

      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }

      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('etiqueta', trimmedName);
      params.append('tipo', String(editingGoal.tipo ?? GOAL_CATEGORY_TYPE[category]));
      params.append('tareas', formattedTasks.join('|'));

      const response = await fetch(`${API_CONFIG.baseUrl}meta/${editingGoal.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(t('screens.viewGoals.errorTitle'));
      }

      Alert.alert(
        t('screens.viewGoals.editSuccessTitle'),
        t('screens.viewGoals.editSuccessMessage'),
      );
      closeEditModal();
      void fetchGoals();
    } catch (caughtError) {
      Alert.alert(
        t('screens.goals.form.errorTitle'),
        caughtError instanceof Error ? caughtError.message : t('screens.viewGoals.errorTitle'),
      );
    } finally {
      setSavingEdit(false);
    }
  }, [category, closeEditModal, editName, editTasks, editingGoal, fetchGoals, t]);

  const handleCompleteGoal = useCallback(() => {
    Alert.alert(
      t('screens.viewGoals.completeUnavailableTitle'),
      t('screens.viewGoals.completeUnavailableMessage'),
    );
  }, [t]);

  const renderProgressRing = useCallback(
    (value: number) => {
      const progress = Math.min(Math.max(value, 0), 100);
      const strokeDashoffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

      return (
        <View style={styles.progressWrapper}>
          <Svg height={(CIRCLE_RADIUS + 8) * 2} width={(CIRCLE_RADIUS + 8) * 2}>
            <Circle
              stroke={`${palette.border}60`}
              fill="transparent"
              strokeWidth={10}
              cx={CIRCLE_RADIUS + 8}
              cy={CIRCLE_RADIUS + 8}
              r={CIRCLE_RADIUS}
            />
            <Circle
              stroke={palette.primary}
              fill="transparent"
              strokeWidth={10}
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              cx={CIRCLE_RADIUS + 8}
              cy={CIRCLE_RADIUS + 8}
              r={CIRCLE_RADIUS}
              transform={`rotate(-90 ${CIRCLE_RADIUS + 8} ${CIRCLE_RADIUS + 8})`}
            />
          </Svg>
          <View style={styles.progressInner}>
            <Text style={[styles.progressValue, { color: palette.textPrimary }]}>
              {progress.toFixed(0)}%
            </Text>
            <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
              {t('screens.viewGoals.progressLabel', { value: progress.toFixed(0) })}
            </Text>
          </View>
        </View>
      );
    },
    [palette.border, palette.primary, palette.textPrimary, palette.textSecondary, t],
  );

  const heroDescription = t('screens.viewGoals.heroDescription', {
    category: t(selectedCategory.titleKey),
  });

  return (
    <AppScreen
      titleKey="screens.viewGoals.title"
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={palette.primary}
        />
      }
    >
      <View style={[styles.heroCard, { backgroundColor: palette.surface }]}>
        <TouchableOpacity style={styles.heroBack} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.heroIcon, { backgroundColor: `${selectedCategory.accent}20` }]}>
          <Ionicons name={selectedCategory.icon as keyof typeof Ionicons.glyphMap} size={28} color={selectedCategory.accent} />
        </View>
        <Text style={[styles.heroHeading, { color: palette.textPrimary }]}>
          {t('screens.viewGoals.heroTitle')}
        </Text>
        <Text style={[styles.heroDescription, { color: palette.textSecondary }]}>{heroDescription}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {GOAL_CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.categoryTab,
              {
                backgroundColor: category === item.key ? palette.primary : 'transparent',
                borderColor: category === item.key ? palette.primary : palette.border,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => {
              if (category !== item.key) {
                setCategory(item.key);
              }
            }}
          >
            <Text
              style={[
                styles.categoryTabLabel,
                { color: category === item.key ? palette.buttonText : palette.textPrimary },
              ]}
            >
              {t(item.titleKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.feedbackWrapper}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.feedbackLabel, { color: palette.textSecondary }]}>
            {t('screens.viewGoals.loading')}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.feedbackWrapper}>
          <Ionicons name="alert-circle-outline" size={32} color={palette.accent} />
          <Text style={[styles.feedbackLabel, { color: palette.textPrimary }]}>{error}</Text>
          <TouchableOpacity onPress={() => void fetchGoals()}>
            <Text style={[styles.retryLabel, { color: palette.primary }]}>
              {t('screens.viewGoals.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : goals.length === 0 ? (
        <View style={[styles.feedbackWrapper, { paddingVertical: 48 }]}>
          <Ionicons name="sparkles-outline" size={42} color={palette.accent} />
          <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
            {t('screens.viewGoals.emptyTitle')}
          </Text>
          <Text style={[styles.feedbackLabel, { color: palette.textSecondary, textAlign: 'center' }]}>
            {t('screens.viewGoals.emptyMessage', { category: t(selectedCategory.titleKey) })}
          </Text>
        </View>
      ) : (
        goals.map((goal) => (
          <View key={goal.id} style={[styles.goalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.goalHeader}>
              <Text style={[styles.goalTitle, { color: palette.textPrimary }]}>{goal.etiqueta}</Text>
              <View style={styles.goalActions}>
                <TouchableOpacity onPress={() => openEditModal(goal)} style={styles.goalActionButton}>
                  <Ionicons name="create-outline" size={18} color={palette.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCompleteGoal} style={styles.goalActionButton}>
                  <Ionicons name="checkmark-done-outline" size={18} color={palette.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.goalBody}>
              {renderProgressRing(goal.progress)}
              <View style={styles.taskList}>
                <Text style={[styles.taskHeading, { color: palette.textPrimary }]}>
                  {t('screens.viewGoals.tasksHeading')}
                </Text>
                {goal.tasks.map((task, index) => (
                  <View key={`${goal.id}-task-${index}`} style={styles.taskItem}>
                    <View style={[styles.taskBullet, { backgroundColor: palette.primary }]} />
                    <Text style={[styles.taskLabel, { color: palette.textSecondary }]}>{task}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))
      )}

      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
                  {t('screens.viewGoals.editTitle')}
                </Text>
                <TouchableOpacity onPress={closeEditModal} hitSlop={16}>
                  <Ionicons name="close" size={20} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <Text style={[styles.label, { color: palette.textSecondary }]}>
                  {t('screens.goals.form.categoryLabel')}
                </Text>
                <View style={[styles.selectedCategoryBadge, { borderColor: palette.border }]}>
                  <Ionicons
                    name={selectedCategory.icon as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={selectedCategory.accent}
                  />
                  <Text style={[styles.selectedCategoryLabel, { color: palette.textPrimary }]}>
                    {t(selectedCategory.titleKey)}
                  </Text>
                </View>

                <Text style={[styles.label, { color: palette.textPrimary }]}>
                  {t('screens.goals.form.nameLabel')}
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: palette.border, color: palette.textPrimary }]}
                  placeholder={t('screens.goals.form.namePlaceholder')}
                  placeholderTextColor={palette.textSecondary}
                  value={editName}
                  onChangeText={setEditName}
                />

                <Text style={[styles.label, { color: palette.textPrimary }]}>
                  {t('screens.goals.form.taskLabel')}
                </Text>

                {editTasks.map((task, index) => (
                  <View key={`edit-task-${index}`} style={styles.taskRow}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.taskInput,
                        { borderColor: palette.border, color: palette.textPrimary },
                      ]}
                      placeholder={t('screens.goals.form.taskPlaceholder')}
                      placeholderTextColor={palette.textSecondary}
                      value={task}
                      onChangeText={(value) => handleEditTaskChange(value, index)}
                    />
                    {editTasks.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeTaskButton}
                        onPress={() => handleRemoveEditTask(index)}
                      >
                        <Ionicons name="trash-outline" size={18} color={palette.accent} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity style={styles.addTaskButton} onPress={handleAddEditTask}>
                  <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                  <Text style={[styles.addTaskLabel, { color: palette.primary }]}>
                    {t('screens.goals.form.taskAdd')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeEditModal} disabled={savingEdit}>
                  <Text style={[styles.cancelLabel, { color: palette.textSecondary }]}>
                    {t('screens.goals.form.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: palette.primary }]}
                  onPress={handleUpdateGoal}
                  disabled={savingEdit}
                >
                  <Text style={[styles.saveLabel, { color: palette.buttonText }]}>
                    {savingEdit ? '…' : t('screens.goals.form.update')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 48,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    position: 'relative',
  },
  heroBack: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: 6,
    borderRadius: 999,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 20,
  },
  categoryTabs: {
    marginHorizontal: -4,
  },
  categoryTabsContent: {
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  categoryTab: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabLabel: {
    fontWeight: '600',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  feedbackWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  feedbackLabel: {
    fontSize: 15,
  },
  retryLabel: {
    fontWeight: '700',
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  goalCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 16,
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalActionButton: {
    padding: 8,
    borderRadius: 999,
  },
  goalBody: {
    flexDirection: 'row',
    gap: 16,
  },
  progressWrapper: {
    width: (CIRCLE_RADIUS + 8) * 2,
    height: (CIRCLE_RADIUS + 8) * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  progressLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  taskList: {
    flex: 1,
    gap: 6,
  },
  taskHeading: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  taskBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 8,
  },
  taskLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 28,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalContent: {
    gap: 12,
    paddingVertical: 4,
  },
  selectedCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  selectedCategoryLabel: {
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskInput: {
    flex: 1,
  },
  removeTaskButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FDECEC',
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  addTaskLabel: {
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelLabel: {
    textAlign: 'center',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
});


