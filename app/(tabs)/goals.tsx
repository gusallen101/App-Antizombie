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

export default function GoalsScreen() {
  const { t } = useLocalization();
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();

  const horizontalPadding = 24;
  const cardWidth = width - horizontalPadding * 2;
  const gap = 12;

  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<GoalCategoryKey>(DEFAULT_GOAL_CATEGORY);
  const [goalName, setGoalName] = useState('');
  const [tasks, setTasks] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

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
    setGoalName('');
    setTasks(['']);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleTaskChange = useCallback((value: string, index: number) => {
    setTasks((prev) => prev.map((task, idx) => (idx === index ? value : task)));
  }, []);

  const handleAddTaskField = useCallback(() => {
    setTasks((prev) => [...prev, '']);
  }, []);

  const handleRemoveTaskField = useCallback((index: number) => {
    setTasks((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  }, []);

  const handleSaveGoal = useCallback(async () => {
    const trimmedName = goalName.trim();
    const formattedTasks = tasks.map((task) => task.trim()).filter(Boolean);

    if (!trimmedName) {
      Alert.alert(t('screens.goals.form.errorTitle'), t('screens.goals.form.validationName'));
      return;
    }

    if (formattedTasks.length === 0) {
      Alert.alert(t('screens.goals.form.errorTitle'), t('screens.goals.form.validationTask'));
      return;
    }

    try {
      setSaving(true);
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
      params.append('tipo', String(GOAL_CATEGORY_TYPE[selectedCategory]));
      params.append('tareas', formattedTasks.join('|'));

      const response = await fetch(`${API_CONFIG.baseUrl}meta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(t('screens.goals.form.errorTitle'));
      }

      Alert.alert(t('screens.goals.form.successTitle'), t('screens.goals.form.successMessage'));
      closeModal();
    } catch (error) {
      Alert.alert(
        t('screens.goals.form.errorTitle'),
        error instanceof Error ? error.message : t('auth.loginErrorFallback'),
      );
    } finally {
      setSaving(false);
    }
  }, [closeModal, goalName, selectedCategory, t, tasks]);

  const renderCard = ({
    item,
  }: {
    item: GoalCategoryDescriptor & { title: string; description: string };
  }) => (
    <LinearGradient
      colors={item.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width: cardWidth }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconPill, { backgroundColor: `${item.accent}20` }]}>
          <Ionicons name={item.icon} size={28} color={item.accent} />
        </View>
        <Text style={[styles.cardTitle, { color: item.accent }]}>{item.title}</Text>
        <Text style={[styles.cardDescription, { color: `${item.accent}cc` }]}>{item.description}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryButton, { backgroundColor: item.accent }]}
          onPress={() => openModal(item.key)}
          onPress={() => openModal(item.key)}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonLabel}>{t('screens.goals.add')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.secondaryButton, { borderColor: item.accent }]}
          onPress={() =>
            router.push({
              pathname: '/view-goals',
              params: { category: item.key },
            })
          }
        >
          <Ionicons name="eye-outline" size={18} color={item.accent} />
          <Text style={[styles.secondaryButtonLabel, { color: item.accent }]}>
            {t('screens.goals.view')}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderIndicator = () => (
    <View style={styles.dots}>
      {categories.map((category, index) => (
        <View
          key={category.key}
          style={[
            styles.dot,
            {
              backgroundColor:
                index === activeIndex ? palette.primary : `${palette.textSecondary}40`,
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <AppScreen titleKey="tabs.goals">
      <View style={[styles.heroCard, { backgroundColor: palette.surface }]}>
        <Text style={[styles.heroTitle, { color: palette.textOnSurface }]}>
          {t('screens.goals.headline')}
        </Text>
        <Text style={[styles.heroDescription, { color: palette.inputPlaceholder }]}>
          {t('screens.goals.intro')}
        </Text>
        <Text style={[styles.heroSubtitle, { color: palette.textOnSurface }]}>
          {t('screens.goals.subtitle')}
        </Text>
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
            snapToAlignment="start"
            decelerationRate="fast"
            snapToInterval={cardWidth + gap}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
        {renderIndicator()}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: palette.textOnSurface }]}>
                  {t('screens.goals.form.title')}
                </Text>
                <TouchableOpacity onPress={closeModal} hitSlop={16}>
                  <Ionicons name="close" size={20} color={palette.inputPlaceholder} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.label, { color: palette.textOnSurface }]}>
                  {t('screens.goals.form.categoryLabel')}
                </Text>
                <View style={styles.categoryRow}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.key}
                      style={[
                        styles.categoryPill,
                        {
                          borderColor:
                            selectedCategory === category.key ? palette.primary : palette.border,
                          backgroundColor:
                            selectedCategory === category.key ? `${palette.primary}15` : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedCategory(category.key as GoalCategory['key'])}
                    >
                      <Text
                        style={[
                          styles.categoryPillLabel,
                          {
                            color:
                              selectedCategory === category.key ? palette.primary : palette.textSecondary,
                          },
                        ]}
                      >
                        {category.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: palette.textOnSurface }]}>
                  {t('screens.goals.form.nameLabel')}
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: palette.border, color: palette.textOnSurface }]}
                  placeholder={t('screens.goals.form.namePlaceholder')}
                  placeholderTextColor={palette.textSecondary}
                  value={goalName}
                  onChangeText={setGoalName}
                />

                <Text style={[styles.label, { color: palette.textOnSurface }]}>
                  {t('screens.goals.form.taskLabel')}
                </Text>

                {tasks.map((task, index) => (
                  <View key={`task-${index}`} style={styles.taskRow}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.taskInput,
                        { borderColor: palette.border, color: palette.textOnSurface },
                      ]}
                      placeholder={t('screens.goals.form.taskPlaceholder')}
                      placeholderTextColor={palette.textSecondary}
                      value={task}
                      onChangeText={(value) => handleTaskChange(value, index)}
                    />
                    {tasks.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeTaskButton}
                        onPress={() => handleRemoveTaskField(index)}
                      >
                        <Ionicons name="trash-outline" size={18} color={palette.accent} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity style={styles.addTaskButton} onPress={handleAddTaskField}>
                  <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                  <Text style={[styles.addTaskLabel, { color: palette.primary }]}>
                    {t('screens.goals.form.taskAdd')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeModal} disabled={saving}>
                <Text style={[styles.cancelLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.goals.form.cancel')}
                </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: palette.primary }]}
                  onPress={handleSaveGoal}
                  disabled={saving}
                >
                  <Text style={[styles.saveLabel, { color: palette.buttonText }]}>
                    {saving ? '…' : t('screens.goals.form.save')}
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
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  carouselWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: 32,
    padding: 24,
    minHeight: 360,
    justifyContent: 'space-between',
  },
  cardHeader: {
    gap: 12,
  },
  iconPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  cardActions: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
  },
  primaryButtonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFFD0',
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  dots: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
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
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  categoryPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
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


