import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  InteractionManager,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type Category = {
  id: string;
  categoria: string;
};

type TodoItem = {
  id: string | number;
  texto: string;
  status: number;
  completed_by?: string;
  nombre?: string;
  created_at?: string;
  updated_at?: string;
  avatar?: string;
  avatar_share?: string;
};

type TodoList = {
  category_id: string | number;
  categoria: string;
  todos: TodoItem[];
  categoria_updated?: string;
};

const CATEGORY_EDIT_ENDPOINT = 'update/cattodo';
const EDIT_TODO_ENDPOINT = 'edit-todo';
const PERSONAL_CATEGORY_ENDPOINT = 'cattodos-personal';
const SHARE_ASSIGN_ENDPOINT = 'sharedtodoslist';
const SHARE_INVITE_ENDPOINT = 'invite';
const SHARE_LOOKUP_ENDPOINT = 'email';
const PERSONAL_CLOSED_KEY = '@pending:personalClosed';
const SHARED_CLOSED_KEY = '@pending:sharedClosed';
const NOW_IS_KEY = '@pending:nowIs';
const CURRENT_TAB_KEY = '@pending:currentTab';
const PERSONAL_PREFIX = 'personal_todo_list';
const SHARED_PREFIX = 'shared-todo-list';

const parseCollapsedMap = (raw: string | null, prefix: string) => {
  if (!raw) {
    return {};
  }
  try {
    const parsed: string[] = JSON.parse(raw);
    return parsed.reduce<Record<string | number, boolean>>((acc, value) => {
      if (value.startsWith(prefix)) {
        const id = value.replace(prefix, '');
        acc[id] = true;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const collapsedMapToArray = (map: Record<string | number, boolean>, prefix: string) =>
  Object.entries(map)
    .filter(([, isCollapsed]) => isCollapsed)
    .map(([id]) => `${prefix}${id}`);

const parseDateArray = (raw: string | null) => {
  if (!raw) {
    return [];
  }
  try {
    const parsed: string[] = JSON.parse(raw);
    return parsed.map((iso) => new Date(iso));
  } catch {
    return [];
  }
};

export default function PendingScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();

  const [categories, setCategories] = useState<Category[]>([]);
  const [personalCategories, setPersonalCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [taskText, setTaskText] = useState('');
  const [personalLists, setPersonalLists] = useState<TodoList[]>([]);
  const [sharedLists, setSharedLists] = useState<TodoList[]>([]);
  const [currentTab, setCurrentTab] = useState<'personal' | 'shared'>('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editTodoModalVisible, setEditTodoModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<{ id: string | number; categoryId: string | number } | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareLookup, setShareLookup] = useState<{ name: string; invitedId: string } | null>(null);
  const [shareTargetList, setShareTargetList] = useState<TodoList | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [recentTimes, setRecentTimes] = useState<Date[]>([]);
  const [collapsedPersonal, setCollapsedPersonal] = useState<Record<string | number, boolean>>({});
  const [collapsedShared, setCollapsedShared] = useState<Record<string | number, boolean>>({});
  const [completeTaskModalVisible, setCompleteTaskModalVisible] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<{ id: string | number; categoryId: string | number } | null>(null);
  const [completingTask, setCompletingTask] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);

  const sortByName = useCallback(
    <T extends { categoria?: string }>(items: T[]): T[] =>
      [...items].sort((a, b) => (a.categoria ?? '').localeCompare(b.categoria ?? '', undefined, { sensitivity: 'base' })),
    [],
  );

  const normalizeArray = useCallback(<T,>(payload: unknown): T[] => {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload as T[];
    }
    return Object.values(payload as Record<string, T>);
  }, []);

  const persistCollapsedState = useCallback(
    async (storageKey: string, map: Record<string | number, boolean>, prefix: string) => {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(collapsedMapToArray(map, prefix)));
      } catch {
        // ignore
      }
    },
    [],
  );

  const updateRecentTimestamps = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NOW_IS_KEY);
      const parsed: string[] = stored ? JSON.parse(stored) : [];
      const now = new Date().toISOString();
      const next = parsed.slice(-1);
      next.push(now);
      await AsyncStorage.setItem(NOW_IS_KEY, JSON.stringify(next));
      return next.map((iso) => new Date(iso));
    } catch {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(NOW_IS_KEY, JSON.stringify([now]));
      return [new Date(now)];
    }
  }, []);

  const hydrateUiState = useCallback(async () => {
    try {
      const [storedTab, storedPersonal, storedShared, storedRecent] = await Promise.all([
        AsyncStorage.getItem(CURRENT_TAB_KEY),
        AsyncStorage.getItem(PERSONAL_CLOSED_KEY),
        AsyncStorage.getItem(SHARED_CLOSED_KEY),
        AsyncStorage.getItem(NOW_IS_KEY),
      ]);
      if (storedTab === 'shared') {
        setCurrentTab('shared');
      }
      setCollapsedPersonal(parseCollapsedMap(storedPersonal, PERSONAL_PREFIX));
      setCollapsedShared(parseCollapsedMap(storedShared, SHARED_PREFIX));
      setRecentTimes(parseDateArray(storedRecent));
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void hydrateUiState();
    }, [hydrateUiState]),
  );

  const fetchAll = useCallback(async (preserveScrollPosition = false) => {
    try {
      setError(null);
      // Solo mostrar loading si no estamos preservando la posición del scroll
      if (!preserveScrollPosition) {
        setLoading(true);
      }
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);

      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }

      const [catRes, personalCatRes, personalRes, sharedRes] = await Promise.all([
        fetch(`${API_CONFIG.baseUrl}cattodos/${userId}`, { headers: { apikey } }),
        fetch(`${API_CONFIG.baseUrl}${PERSONAL_CATEGORY_ENDPOINT}/${userId}`, { headers: { apikey } }),
        fetch(`${API_CONFIG.baseUrl}todos/${userId}`, { headers: { apikey } }),
        fetch(`${API_CONFIG.baseUrl}sharedlists/${userId}`, { headers: { apikey } }),
      ]);

      if (!catRes.ok || !personalRes.ok || !sharedRes.ok || !personalCatRes.ok) {
        throw new Error(t('screens.home.zombieError'));
      }

      const cats = sortByName(normalizeArray<Category>(await catRes.json()));
      const personalCats = sortByName(normalizeArray<Category>(await personalCatRes.json()));
      const personal = sortByName(normalizeArray<TodoList>(await personalRes.json()));
      const shared = sortByName(normalizeArray<TodoList>(await sharedRes.json()));

      setCategories(cats);
      setPersonalCategories(personalCats);
      setPersonalLists(personal);
      setSharedLists(shared);
      if (!selectedCategory && cats.length > 0) {
        setSelectedCategory(String(cats[0].id));
      }
      const times = await updateRecentTimestamps();
      setRecentTimes(times);
    } catch (caughtError) {
      setError((caughtError as Error).message ?? t('screens.home.zombieError'));
    } finally {
      if (!preserveScrollPosition) {
        setLoading(false);
      }
    }
  }, [normalizeArray, selectedCategory, sortByName, t, updateRecentTimestamps]);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategory(null);
      return;
    }
    if (!selectedCategory || !categories.some((cat) => String(cat.id) === selectedCategory)) {
      setSelectedCategory(String(categories[0].id));
    }
  }, [categories, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      void fetchAll();
    }, [fetchAll]),
  );

  const togglePersonalList = useCallback(
    (id: string | number) => {
      setCollapsedPersonal((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        void persistCollapsedState(PERSONAL_CLOSED_KEY, next, PERSONAL_PREFIX);
        return next;
      });
    },
    [persistCollapsedState],
  );

  const toggleSharedList = useCallback(
    (id: string | number) => {
      setCollapsedShared((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        void persistCollapsedState(SHARED_CLOSED_KEY, next, SHARED_PREFIX);
        return next;
      });
    },
    [persistCollapsedState],
  );

  const handleSwitchTab = useCallback((tab: 'personal' | 'shared') => {
    setCurrentTab(tab);
    void AsyncStorage.setItem(CURRENT_TAB_KEY, tab).catch(() => {});
  }, []);

  const handleAddTask = useCallback(async () => {
    if (!taskText.trim() || !selectedCategory) {
      Alert.alert(t('screens.pending.header'), t('screens.pending.errorMissingFields'));
      return;
    }
    try {
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);
      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }
      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('texto', taskText.trim());
      params.append('categoria', selectedCategory);

      const response = await fetch(`${API_CONFIG.baseUrl}todo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(t('screens.pending.errorSaveTask'));
      }
      setTaskText('');
      void fetchAll();
    } catch (caughtError) {
      Alert.alert(
        t('screens.pending.errorSaveTask'),
        (caughtError as Error).message ?? t('screens.pending.errorSaveTask'),
      );
    }
  }, [fetchAll, selectedCategory, t, taskText]);

  const handleCompleteTodo = useCallback(
    (todoId: string | number, categoryId: string | number) => {
      // Guardar posición del scroll antes de mostrar el modal
      scrollViewRef.current?.scrollTo({ y: scrollPositionRef.current, animated: false });
      setTaskToComplete({ id: todoId, categoryId });
      setCompleteTaskModalVisible(true);
    },
    [],
  );

  const handleCancelCompleteTask = useCallback(() => {
    setCompleteTaskModalVisible(false);
    setTaskToComplete(null);
  }, []);

  const handleConfirmCompleteTask = useCallback(async () => {
    if (!taskToComplete) {
      return;
    }

    try {
      setCompletingTask(true);

      const [apikey, userId, name] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
        AsyncStorage.getItem('@auth:name'),
      ]);

      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }

      const params = new URLSearchParams();
      params.append('nombre', name ?? '');
      params.append('id_todo', String(taskToComplete.id));
      params.append('user_id_done', userId);
      params.append('id_categoria', String(taskToComplete.categoryId));

      const response = await fetch(`${API_CONFIG.baseUrl}completetask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(t('screens.pending.errorDeleteTask'));
      }

      // Actualizar estado local primero para feedback inmediato sin recargar todo
      // Esto evita el re-render completo que causa el reset del scroll
      setPersonalLists((prevLists) =>
        prevLists.map((list) => {
          if (String(list.category_id) === String(taskToComplete.categoryId)) {
            return {
              ...list,
              todos: list.todos.map((todo) =>
                String(todo.id) === String(taskToComplete.id)
                  ? { ...todo, status: 1 }
                  : todo
              ),
            };
          }
          return list;
        })
      );

      setSharedLists((prevLists) =>
        prevLists.map((list) => {
          if (String(list.category_id) === String(taskToComplete.categoryId)) {
            return {
              ...list,
              todos: list.todos.map((todo) =>
                String(todo.id) === String(taskToComplete.id)
                  ? { ...todo, status: 1 }
                  : todo
              ),
            };
          }
          return list;
        })
      );

      // Cerrar modal
      setCompleteTaskModalVisible(false);
      setTaskToComplete(null);

      // Sincronizar con servidor en segundo plano (sin afectar el scroll)
      // Esto asegura que los datos estén actualizados pero no causa re-render completo
      fetchAll(true).catch(() => {
        // Si falla, recargar todo como fallback
        void fetchAll();
      });
    } catch (caughtError) {
      Alert.alert(
        t('screens.pending.errorDeleteTask'),
        (caughtError as Error).message ?? t('screens.pending.errorDeleteTask'),
      );
    } finally {
      setCompletingTask(false);
    }
  }, [fetchAll, taskToComplete, t]);

  const handleAddCategory = useCallback(async () => {
    if (!categoryName.trim()) {
      Alert.alert(t('screens.pending.header'), t('screens.pending.categoryNamePlaceholder'));
      return;
    }
    try {
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);
      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }
      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('texto', categoryName.trim());

      const response = await fetch(`${API_CONFIG.baseUrl}categoria`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(t('screens.pending.errorSaveCategory'));
      }
      setCategoryName('');
      setEditingCategory(null);
      setCategoryModalVisible(false);
      void fetchAll();
    } catch (caughtError) {
      Alert.alert(
        t('screens.pending.errorSaveCategory'),
        (caughtError as Error).message ?? t('screens.pending.errorSaveCategory'),
      );
    }
  }, [categoryName, fetchAll, t]);

  const handleDeleteCategory = useCallback(
    (category: Category) => {
      Alert.alert(
        t('screens.pending.deleteCategory'),
        t('screens.pending.deleteCategoryConfirm'),
        [
          { text: t('screens.financialHealth.cancel'), style: 'cancel' },
          {
            text: t('screens.financialHealth.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                const apikey = await AsyncStorage.getItem('@auth:apikey');
                if (!apikey) {
                  throw new Error(t('auth.loginErrorFallback'));
                }
                const response = await fetch(
                  `${API_CONFIG.baseUrl}eliminar-cattodo/${category.id}`,
                  {
                    headers: { apikey },
                  },
                );
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || payload?.status === 'error') {
                  throw new Error(
                    payload?.message ?? t('screens.pending.errorDeleteCategory'),
                  );
                }
                Alert.alert(
                  t('screens.pending.successCategoryDeleted'),
                  payload?.message ?? '',
                );
                void fetchAll();
              } catch (caughtError) {
                Alert.alert(
                  t('screens.pending.errorDeleteCategory'),
                  (caughtError as Error).message ?? t('screens.pending.errorDeleteCategory'),
                );
              }
            },
          },
        ],
      );
    },
    [fetchAll, t],
  );

  const handleEditCategory = useCallback(
    async (category: Category) => {
      setEditingCategory(category);
      setCategoryName(category.categoria);
      setCategoryModalVisible(true);
    },
    [],
  );

  const handleSaveCategoryChanges = useCallback(async () => {
    if (!editingCategory) {
      await handleAddCategory();
      return;
    }
    if (!categoryName.trim()) {
      Alert.alert(t('screens.pending.header'), t('screens.pending.categoryNamePlaceholder'));
      return;
    }
    try {
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);
      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }
      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('texto', categoryName.trim());
      params.append('id_categoria', String(editingCategory.id));

      const response = await fetch(`${API_CONFIG.baseUrl}${CATEGORY_EDIT_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(t('screens.pending.errorSaveCategory'));
      }
      setCategoryModalVisible(false);
      setEditingCategory(null);
      setCategoryName('');
      void fetchAll();
    } catch (caughtError) {
      Alert.alert(
        t('screens.pending.errorSaveCategory'),
        (caughtError as Error).message ?? t('screens.pending.errorSaveCategory'),
      );
    }
  }, [categoryName, editingCategory, fetchAll, t]);

  const handleOpenShareModal = useCallback((list: TodoList) => {
    setShareTargetList(list);
    setShareEmail('');
    setShareLookup(null);
    setShareMessage(null);
    setShareModalVisible(true);
  }, []);

  const handleLookupShare = useCallback(async () => {
    if (!shareEmail.trim()) {
      return;
    }
    try {
      setShareLoading(true);
      const apikey = await AsyncStorage.getItem('@auth:apikey');
      if (!apikey) {
        throw new Error(t('auth.loginErrorFallback'));
      }
      const response = await fetch(`${API_CONFIG.baseUrl}${SHARE_LOOKUP_ENDPOINT}/${shareEmail.trim()}`, {
        headers: { apikey },
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload) || payload.length === 0) {
        setShareLookup(null);
        setShareMessage(t('screens.pending.shareNotFound'));
        return;
      }
      setShareLookup({
        name: payload[0].nombre,
        invitedId: String(payload[0].id_invited),
      });
      setShareMessage(null);
    } catch (error) {
      setShareLookup(null);
      setShareMessage((error as Error).message ?? t('screens.pending.shareNotFound'));
    } finally {
      setShareLoading(false);
    }
  }, [shareEmail, t]);

  const handleSendShareInvite = useCallback(async () => {
    if (!shareLookup || !shareTargetList) {
      return;
    }
    try {
      setShareLoading(true);
      const [apikey, userId, senderName] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
        AsyncStorage.getItem('@auth:name'),
      ]);
      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }
      const assignParams = new URLSearchParams();
      assignParams.append('id_usuario', userId);
      assignParams.append('id_categoria', String(shareTargetList.category_id));
      await fetch(`${API_CONFIG.baseUrl}${SHARE_ASSIGN_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: assignParams.toString(),
      });

      const inviteParams = new URLSearchParams();
      inviteParams.append('l', String(shareTargetList.category_id));
      inviteParams.append('u', shareEmail.trim());
      inviteParams.append('n', senderName ?? '');
      inviteParams.append('sid', userId);
      inviteParams.append('s', shareLookup.name);
      inviteParams.append('iid', shareLookup.invitedId);

      await fetch(`${API_CONFIG.baseUrl}${SHARE_INVITE_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: inviteParams.toString(),
      });

      void fetchAll();
      Alert.alert(t('screens.pending.shareSuccessTitle'), t('screens.pending.shareSuccessMessage'));
      setShareModalVisible(false);
      setShareEmail('');
      setShareLookup(null);
      setShareTargetList(null);
    } catch (error) {
      Alert.alert(t('screens.pending.shareTitle'), (error as Error).message ?? t('screens.pending.shareNotFound'));
    } finally {
      setShareLoading(false);
    }
  }, [shareEmail, shareLookup, shareTargetList, t]);

  const handleClearCompleted = useCallback(
    (categoryId: string | number) => {
      Alert.alert(
        t('screens.pending.clearCompleted'),
        t('screens.pending.clearCompletedConfirm'),
        [
          { text: t('screens.financialHealth.cancel'), style: 'cancel' },
          {
            text: t('screens.financialHealth.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                const apikey = await AsyncStorage.getItem('@auth:apikey');
                if (!apikey) {
                  throw new Error(t('auth.loginErrorFallback'));
                }
                const response = await fetch(`${API_CONFIG.baseUrl}clearcompleted/${categoryId}`, {
                  headers: { apikey },
                });
                if (!response.ok) {
                  throw new Error(t('screens.pending.errorDeleteTask'));
                }
                void fetchAll();
              } catch (caughtError) {
                Alert.alert(
                  t('screens.pending.errorDeleteTask'),
                  (caughtError as Error).message ?? t('screens.pending.errorDeleteTask'),
                );
              }
            },
          },
        ],
      );
    },
    [fetchAll, t],
  );

  const handleEditTodo = useCallback((todo: TodoItem, categoryId: string | number) => {
    setEditingTodo({ id: todo.id, categoryId });
    setEditingTodoText(todo.texto);
    setEditTodoModalVisible(true);
  }, []);

  const handleSaveTodoEdit = useCallback(async () => {
    if (!editingTodo || !editingTodoText.trim()) {
      Alert.alert(t('screens.pending.editTask'), t('screens.pending.errorMissingFields'));
      return;
    }
    try {
      const apikey = await AsyncStorage.getItem('@auth:apikey');
      if (!apikey) {
        throw new Error(t('auth.loginErrorFallback'));
      }
      const params = new URLSearchParams();
      params.append('edited_todo', editingTodoText.trim());
      params.append('id_todo', String(editingTodo.id));
      params.append('id_categoria', String(editingTodo.categoryId));

      const response = await fetch(`${API_CONFIG.baseUrl}${EDIT_TODO_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(t('screens.pending.errorSaveTask'));
      }

      // Actualizar estado local primero para evitar re-render completo que causa reset del scroll
      setPersonalLists((prevLists) =>
        prevLists.map((list) => {
          if (String(list.category_id) === String(editingTodo.categoryId)) {
            return {
              ...list,
              todos: list.todos.map((todo) =>
                String(todo.id) === String(editingTodo.id)
                  ? { ...todo, texto: editingTodoText.trim() }
                  : todo
              ),
            };
          }
          return list;
        })
      );

      setSharedLists((prevLists) =>
        prevLists.map((list) => {
          if (String(list.category_id) === String(editingTodo.categoryId)) {
            return {
              ...list,
              todos: list.todos.map((todo) =>
                String(todo.id) === String(editingTodo.id)
                  ? { ...todo, texto: editingTodoText.trim() }
                  : todo
              ),
            };
          }
          return list;
        })
      );

      setEditTodoModalVisible(false);
      setEditingTodo(null);
      setEditingTodoText('');

      // Sincronizar con servidor en segundo plano (sin afectar el scroll)
      fetchAll(true).catch(() => {
        // Si falla, recargar todo como fallback
        void fetchAll();
      });
    } catch (caughtError) {
      Alert.alert(
        t('screens.pending.errorSaveTask'),
        (caughtError as Error).message ?? t('screens.pending.errorSaveTask'),
      );
    }
  }, [editingTodo, editingTodoText, fetchAll, t]);

  const currentLists = currentTab === 'personal' ? personalLists : sharedLists;
  const collapsedMap = currentTab === 'personal' ? collapsedPersonal : collapsedShared;
  const toggleList = currentTab === 'personal' ? togglePersonalList : toggleSharedList;

  const empty = !loading && currentLists.every((list) => list.todos.length === 0);
  const hasCategories = categories.length > 0;

  return (
    <AppScreen titleKey="tabs.pending">
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        onScroll={(event) => {
          scrollPositionRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.cardTitle, { color: palette.textOnSurface }]}>
            {t('screens.pending.addNew')}
          </Text>

          <Text style={[styles.label, { color: palette.textOnSurface }]}>
            {t('screens.pending.selectCategory')}
          </Text>
          <View style={[styles.pickerWrapper, { borderColor: palette.border }]}>
            {hasCategories ? (
              <Picker
                selectedValue={selectedCategory ?? undefined}
                onValueChange={(value) => setSelectedCategory(String(value))}
                style={{ color: palette.textOnSurface }}
                itemStyle={{ color: palette.textOnSurface }}>
                {categories.map((cat) => (
                  <Picker.Item key={String(cat.id)} label={cat.categoria} value={String(cat.id)} color={palette.textOnSurface} />
                ))}
              </Picker>
            ) : (
              <Text style={[styles.placeholder, { color: palette.inputPlaceholder }]}>
                {t('screens.pending.categoryNamePlaceholder')}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: palette.primary }]}
            onPress={() => {
              setEditingCategory(null);
              setCategoryName('');
              setCategoryModalVisible(true);
            }}
          >
            <Ionicons name="create-outline" size={18} color={palette.primary} />
            <Text style={[styles.secondaryButtonLabel, { color: palette.primary }]}>
              {t('screens.pending.manageCategories')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.label, { color: palette.textOnSurface }]}>{t('screens.pending.addNew')}</Text>
          <TextInput
            style={[styles.input, { borderColor: palette.border, color: palette.textOnSurface }]}
            placeholder={t('screens.pending.addNew')}
            placeholderTextColor={palette.textSecondary}
            value={taskText}
            onChangeText={setTaskText}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: hasCategories ? palette.primary : `${palette.primary}60`,
              },
            ]}
            onPress={handleAddTask}
            disabled={!hasCategories}
          >
            <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
              {t('screens.pending.saveTask')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.tabs, { borderColor: palette.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              currentTab === 'personal' && { backgroundColor: palette.primary, borderColor: palette.primary },
            ]}
            onPress={() => handleSwitchTab('personal')}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: currentTab === 'personal' ? palette.buttonText : palette.textPrimary },
              ]}
            >
              {t('screens.pending.personalTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              currentTab === 'shared' && { backgroundColor: palette.primary, borderColor: palette.primary },
            ]}
            onPress={() => handleSwitchTab('shared')}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: currentTab === 'shared' ? palette.buttonText : palette.textPrimary },
              ]}
            >
              {t('screens.pending.sharedTab')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: palette.inputPlaceholder }]}>
          {t('screens.pending.completeHint')}
        </Text>

        {loading ? (
          <View style={styles.feedback}>
            <Ionicons name="hourglass-outline" size={24} color={palette.primary} />
          </View>
        ) : error ? (
          <View style={styles.feedback}>
            <Text style={[styles.feedbackText, { color: palette.textPrimary }]}>{error}</Text>
          </View>
        ) : empty ? (
          <View style={styles.feedback}>
            <Text style={[styles.feedbackText, { color: palette.inputPlaceholder }]}>
              {t('screens.pending.emptyList')}
            </Text>
          </View>
        ) : (
          currentLists.map((list) => {
            if (!list.todos || list.todos.length === 0) {
              return null;
            }
            const collapsed = !!collapsedMap[list.category_id];
            const highlight =
              currentTab === 'shared' &&
              list.categoria_updated &&
              recentTimes.some((time) => {
                const updatedAt = new Date(list.categoria_updated ?? '');
                return updatedAt >= time;
              });
            return (
              <View
                key={String(list.category_id)}
                style={[
                  styles.listCard,
                  { backgroundColor: palette.surface },
                  highlight && styles.listCardHighlight,
                ]}
              >
                <View style={styles.listHeader}>
                  <TouchableOpacity
                    style={styles.listHeaderLeft}
                    onPress={() => toggleList(list.category_id)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={[styles.listTitle, { color: palette.textOnSurface }]}>{list.categoria}</Text>
                      {currentTab === 'shared' && list.categoria_updated ? (
                        <Text style={[styles.listSubtitle, { color: palette.inputPlaceholder }]}>
                          {t('screens.pending.sharedInfo', { count: list.todos.length })}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={collapsed ? 'chevron-down' : 'chevron-up'}
                      size={20}
                      color={palette.inputPlaceholder}
                    />
                  </TouchableOpacity>
                  <View style={styles.listActions}>
                    {currentTab === 'personal' && (
                      <TouchableOpacity onPress={() => handleOpenShareModal(list)}>
                        <Ionicons name="share-social-outline" size={20} color={palette.inputPlaceholder} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleClearCompleted(list.category_id)}>
                      <Ionicons name="trash-outline" size={20} color={palette.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
                {!collapsed &&
                  list.todos.map((todo) => (
                    <View key={`${list.category_id}-${todo.id}`} style={styles.todoRow}>
                      <TouchableOpacity
                        style={styles.todoMain}
                        onPress={() => handleCompleteTodo(todo.id, list.category_id)}
                      >
                        <Ionicons
                          name={todo.status === 1 ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={todo.status === 1 ? '#5fed85' : palette.inputPlaceholder}
                        />
                        <Text
                          style={[
                            styles.todoText,
                            {
                              color: todo.status === 1 ? palette.inputPlaceholder : palette.textOnSurface,
                              textDecorationLine: todo.status === 1 ? 'line-through' : 'none',
                            },
                          ]}
                          numberOfLines={0}
                          ellipsizeMode="tail">
                          {todo.texto}
                        </Text>
                      </TouchableOpacity>
                      {todo.status !== 1 && (
                        <TouchableOpacity
                          style={styles.todoEditButton}
                          onPress={() => handleEditTodo(todo, list.category_id)}
                        >
                          <Ionicons name="create-outline" size={18} color={palette.inputPlaceholder} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={categoryModalVisible} transparent animationType="fade" onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: palette.textOnSurface }]}>
                {editingCategory ? t('screens.pending.editCategory') : t('screens.pending.addCategory')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCategoryModalVisible(false);
                  setEditingCategory(null);
                  setCategoryName('');
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.textOnSurface }]}
              placeholder={t('screens.pending.categoryNamePlaceholder')}
              placeholderTextColor={palette.textSecondary}
              value={categoryName}
              onChangeText={setCategoryName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setCategoryModalVisible(false);
                  setEditingCategory(null);
                  setCategoryName('');
                }}
              >
                <Text style={[styles.secondaryButtonLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.financialHealth.cancel')}
                </Text>
              </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: palette.primary }]}
                  onPress={handleSaveCategoryChanges}
                >
                <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                  {editingCategory ? t('screens.financialHealth.update') : t('screens.pending.saveCategory')}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoryList} keyboardShouldPersistTaps="handled">
              <View style={styles.categoryTableHeader}>
                <Text style={[styles.tableHeaderLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.pending.categoryListName')}
                </Text>
                <Text style={[styles.tableHeaderLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.pending.categoryListManage')}
                </Text>
              </View>
              {personalCategories.map((category) => (
                <View key={String(category.id)} style={[styles.categoryRow, { borderColor: palette.border }]}>
                  <Text style={[styles.categoryName, { color: palette.textOnSurface }]}>
                    {category.categoria}
                  </Text>
                  <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => handleDeleteCategory(category)}>
                      <Ionicons name="trash-outline" size={18} color={palette.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEditCategory(category)}>
                      <Ionicons name="create-outline" size={18} color={palette.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {personalCategories.length === 0 && (
                <Text style={[styles.feedbackText, { color: palette.inputPlaceholder }]}>
                  {t('screens.pending.emptyList')}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={shareModalVisible} transparent animationType="fade" onRequestClose={() => setShareModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: palette.textOnSurface }]}>
                {t('screens.pending.shareTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShareModalVisible(false);
                  setShareLookup(null);
                  setShareMessage(null);
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDescription, { color: palette.inputPlaceholder }]}>
              {t('screens.pending.shareDescription')}
            </Text>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.textOnSurface }]}
              placeholder={t('screens.pending.shareEmailPlaceholder')}
              placeholderTextColor={palette.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={shareEmail}
              onChangeText={setShareEmail}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => {
                  setShareModalVisible(false);
                  setShareLookup(null);
                  setShareMessage(null);
                }}
              >
                <Text style={[styles.secondaryButtonLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.financialHealth.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1, backgroundColor: palette.primary }]}
                onPress={handleLookupShare}
                disabled={shareLoading}
              >
                <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                  {shareLoading ? '…' : t('screens.pending.shareSearch')}
                </Text>
              </TouchableOpacity>
            </View>
            {shareMessage ? (
              <Text style={[styles.feedbackText, { color: palette.inputPlaceholder }]}>{shareMessage}</Text>
            ) : null}
            {shareLookup && (
              <View style={styles.shareResult}>
                <Text style={{ color: palette.textOnSurface }}>
                  {t('screens.pending.shareUserFound', { name: shareLookup.name })}
                </Text>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: palette.primary }]}
                  onPress={handleSendShareInvite}
                  disabled={shareLoading}
                >
                  <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                    {shareLoading ? '…' : t('screens.pending.shareInvite')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={editTodoModalVisible} transparent animationType="fade" onRequestClose={() => setEditTodoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: palette.textOnSurface }]}>{t('screens.pending.editTask')}</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditTodoModalVisible(false);
                  setEditingTodo(null);
                  setEditingTodoText('');
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.textOnSurface }]}
              placeholder={t('screens.pending.editTask')}
              placeholderTextColor={palette.textSecondary}
              value={editingTodoText}
              onChangeText={setEditingTodoText}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setEditTodoModalVisible(false);
                  setEditingTodo(null);
                  setEditingTodoText('');
                }}
              >
                <Text style={[styles.secondaryButtonLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.financialHealth.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: palette.primary }]}
                onPress={handleSaveTodoEdit}
              >
                <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                  {t('screens.financialHealth.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={completeTaskModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelCompleteTask}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: palette.textOnSurface }]}>
                {t('screens.pending.header')}
              </Text>
              <TouchableOpacity onPress={handleCancelCompleteTask} hitSlop={8}>
                <Ionicons name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDescription, { color: palette.inputPlaceholder }]}>
              {t('screens.pending.deleteTaskConfirm')}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: palette.accent,
                    flex: 1,
                  },
                ]}
                onPress={handleCancelCompleteTask}
                disabled={completingTask}>
                <Text style={[styles.secondaryButtonLabel, { color: palette.accent }]}>
                  {t('screens.financialHealth.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: '#5fed85',
                    flex: 1,
                  },
                ]}
                onPress={handleConfirmCompleteTask}
                disabled={completingTask}>
                <Text style={[styles.primaryButtonLabel, { color: '#ffffff' }]}>
                  {completingTask ? '…' : t('screens.pending.completeTask')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 16,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 28,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '600',
  },
  pickerWrapper: {
    borderWidth: 1.5,
    borderRadius: 20,
  },
  placeholder: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  tabLabel: {
    fontWeight: '600',
  },
  feedback: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  feedbackText: {
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    fontSize: 13,
  },
  listCard: {
    borderRadius: 24,
    padding: 12,
    gap: 8,
  },
  listCardHighlight: {
    borderWidth: 1.5,
    borderColor: '#84E882',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  listSubtitle: {
    fontSize: 12,
  },
  todoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffffff30',
  },
  todoMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  todoText: {
    fontSize: 16,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  todoEditButton: {
    padding: 6,
    flexShrink: 0,
  },
  listActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryList: {
    maxHeight: 300,
  },
  categoryTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderLabel: {
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryName: {
    fontSize: 16,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: '85%',
    borderRadius: 24,
    padding: 16,
  },
  pickerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  pickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pickerButtonPrimary: {
    backgroundColor: '#763289',
  },
  pickerButtonLabel: {
    fontWeight: '600',
  },
  shareResult: {
    gap: 12,
  },
});

