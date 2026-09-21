// ---------- Imports de librerías y utilidades principales ----------
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  InteractionManager,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Keyboard } from 'react-native';
import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

// ---------- Definición de Tipos para Categoría y Tareas ----------
type Category = {
  id: string;
  categoria: string;
};

type SharedUser = {
  id: string | number;
  nombre: string;
  avatar?: string;
};

type TodoItem = {
  id: string | number;
  texto: string;
  status: number;
  completed_by?: string;
  shared_with?: SharedUser[];
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
  shared_with?: SharedUser[];
  categoria_updated?: string;
};

// ---------- Constantes de endpoints y claves de almacenamiento ----------
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
const CATEGORY_NAME_MAX_LENGTH = 20;

// ---------- Funciones Auxiliares para manejo y parsing de datos en almacenamiento ----------
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

// ---------- Componente principal de la pantalla de pendientes ----------
export default function PendingScreen() {
  // -------- Hooks de tema y localización --------
  const { palette, colorScheme } = useAppTheme();
  const { t } = useLocalization();

  // -------- Definición de todos los estados del componente --------
  const [categories, setCategories] = useState<Category[]>([]);
  const [personalCategories, setPersonalCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [taskText, setTaskText] = useState('');
  const [personalLists, setPersonalLists] = useState<TodoList[]>([]);
  const [sharedLists, setSharedLists] = useState<TodoList[]>([]);
  const [currentTab, setCurrentTab] = useState<'personal' | 'shared'>('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para gestión de modales y entradas del usuario
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

  // Estado para detección de listas nuevas compartidas y colapsado de listas
  const [recentTimes, setRecentTimes] = useState<Date[]>([]);
  const [collapsedPersonal, setCollapsedPersonal] = useState<Record<string | number, boolean>>({});
  const [collapsedShared, setCollapsedShared] = useState<Record<string | number, boolean>>({});
  const [shareSearch, setShareSearch] = useState('');
  const [shareResults, setShareResults] = useState<any[]>([]);

  // Estados para modal de completar tareas
  const [completeTaskModalVisible, setCompleteTaskModalVisible] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<{ id: string | number; categoryId: string | number } | null>(null);
  const [completingTask, setCompletingTask] = useState(false);

  // Estados para ver miembros de lista compartida
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [selectedListMembers, setSelectedListMembers] = useState<{name: string, members: SharedUser[]} | null>(null);

  // --- LÓGICA DE TUTORIAL ---
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const checkTutorial = useCallback(async () => {
    const isActive = await AsyncStorage.getItem('@tutorial:active');
    const seenStepsRaw = (await AsyncStorage.getItem('@tutorial:seen_steps')) || '[]';
    const seenSteps: string[] = JSON.parse(seenStepsRaw);

    if (isActive === 'true' && !seenSteps.includes('pending')) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = async () => {
    setShowTutorial(false);
    const seenStepsRaw = (await AsyncStorage.getItem('@tutorial:seen_steps')) || '[]';
    const seenSteps: string[] = JSON.parse(seenStepsRaw);

    if (!seenSteps.includes('pending')) {
      seenSteps.push('pending');
      await AsyncStorage.setItem('@tutorial:seen_steps', JSON.stringify(seenSteps));
    }
  };

  const handleNextTutorial = () => {
    if (tutorialStep < tutorialSteps.length - 1) {
      const nextStep = tutorialStep + 1;
      setTutorialStep(nextStep);
      // Scroll automático para asegurar que el elemento resaltado sea visible
      if (nextStep === 1) { // Manage Categories button
        scrollViewRef.current?.scrollTo({ y: 100, animated: true });
      } else if (nextStep === 2) { // Tabs
        scrollViewRef.current?.scrollTo({ y: 300, animated: true });
      } else if (nextStep === 3) { // Complete Hint
        scrollViewRef.current?.scrollTo({ y: 400, animated: true });
      }
    } else {
      void dismissTutorial();
    }
  };

  const tutorialSteps = [
    { title: t('screens.pending.tutorialAddTitle'), desc: t('screens.pending.tutorialAddDesc'), icon: 'add-circle' },
    { title: t('screens.pending.tutorialManageTitle'), desc: t('screens.pending.tutorialManageDesc'), icon: 'create' },
    { title: t('screens.pending.tutorialTabsTitle'), desc: t('screens.pending.tutorialTabsDesc'), icon: 'swap-horizontal' },
    { title: t('screens.pending.tutorialCompleteHintTitle'), desc: t('screens.pending.tutorialCompleteHintDesc'), icon: 'checkmark-done-circle' },
  ];

  // refs para manejo programático de scroll
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);

  // -------- Funciones de ayuda para orden y normalización de datos --------
  // Ordena por categoría alfabéticamente
  const sortByName = useCallback(
    <T extends { categoria?: string }>(items: T[]): T[] =>
      [...items].sort((a, b) => (a.categoria ?? '').localeCompare(b.categoria ?? '', undefined, { sensitivity: 'base' })),
    [],
  );

  // Convierte a array en caso de recibir objeto en el payload (ajusta respuesta API)
  const normalizeArray = useCallback(<T,>(payload: unknown): T[] => {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload as T[];
    }
    return Object.values(payload as Record<string, T>);
  }, []);

  // Guarda estado de colapsado en AsyncStorage
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

  // Guarda/actualiza los timestamps recientes para marcar cambios en listas compartidas
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

  // Hidrata el estado de la UI desde el almacenamiento (pestaña activa, listas colapsadas, historial)
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

  // Ejecuta hidratación de estado (primer render o cuando vuelve la pantalla)
  useFocusEffect(
    useCallback(() => {
      void hydrateUiState();
    }, [hydrateUiState]),
  );

  // -------- Función para obtener todas las listas y categorías del backend --------
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

      // Pide categorías, categorías personales, listas personales y compartidas
      const [catRes, personalCatRes, personalRes, sharedRes] = await Promise.all([
        fetch(`${API_CONFIG.baseUrl}cattodos/${userId}`, { headers: { apikey } }),
        fetch(`${API_CONFIG.baseUrl}${PERSONAL_CATEGORY_ENDPOINT}/${userId}`, { headers: { apikey } }),
        fetch(`${API_CONFIG.baseUrl}todos/${userId}`, { headers: { apikey } }),
        fetch(`${API_CONFIG.baseUrl}sharedlists/${userId}`, { headers: { apikey } }),
      ]);

      if (!catRes.ok || !personalRes.ok || !sharedRes.ok || !personalCatRes.ok) {
        throw new Error(t('screens.home.zombieError'));
      }

      // Parsea y ordena todas las entidades
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

  // -------- Efecto para actualizar el category seleccionado si cambia la lista de categorías global --------
  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategory(null);
      return;
    }
    if (!selectedCategory || !categories.some((cat) => String(cat.id) === selectedCategory)) {
      setSelectedCategory(String(categories[0].id));
    }
  }, [categories, selectedCategory]);

  // -------- Efecto para cargar datos cuando la pantalla toma foco --------
  useFocusEffect(
    useCallback(() => {
      void fetchAll(); // Cargar datos
      void checkTutorial(); // Verificar tutorial al enfocar
    }, [fetchAll]),
  );

  // ----------- Handlers para UI y acciones de usuario ------------

  // Alterna colapsado de lista personal y guarda estado
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

  // Alterna colapsado de lista compartida y guarda estado
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

  // Cambia la pestaña actual (personal o compartida) y la persiste
  const handleSwitchTab = useCallback((tab: 'personal' | 'shared') => {
    setCurrentTab(tab);
    void AsyncStorage.setItem(CURRENT_TAB_KEY, tab).catch(() => {});
  }, []);

  // Crea una nueva tarea para la categoría seleccionada
  const handleAddTask = useCallback(async () => {
    //  Cierra teclado antes de cualquier lógica
    Keyboard.dismiss();
  
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
      void fetchAll(true);
  
    } catch (caughtError) {
      Alert.alert(
        t('screens.pending.errorSaveTask'),
        (caughtError as Error).message ?? t('screens.pending.errorSaveTask'),
      );
    }
  }, [fetchAll, selectedCategory, t, taskText]);

  // Abre modal para confirmar completar una tarea
  const handleCompleteTodo = useCallback(
    (todoId: string | number, categoryId: string | number) => {
      // Guardar posición del scroll antes de mostrar el modal
      // Eliminado el scrollTo para que NO salte al header al completar
      setTaskToComplete({ id: todoId, categoryId });
      setCompleteTaskModalVisible(true);
    },
    [],
  );

  // Cancela el proceso de completar tarea (modal)
  const handleCancelCompleteTask = useCallback(() => {
    setCompleteTaskModalVisible(false);
    setTaskToComplete(null);
  }, []);

  // Abre el modal para ver miembros
  const handleViewMembers = useCallback((list: TodoList) => {
    const rawMembers = list.shared_with || [];
    // Filtramos duplicados por ID para evitar el error de "duplicate keys" de React
    // y asegurar que cada persona aparezca solo una vez en la lista.
    const uniqueMembers = rawMembers.filter(
      (member, index, self) => index === self.findIndex((m) => m.id === member.id)
    );
    setSelectedListMembers({ name: list.categoria, members: uniqueMembers });
    setMembersModalVisible(true);
  }, []);

  // Confirma la acción de completar una tarea (marca como completada en backend y frontend)
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

      // Cerrar modal y limpiar estado temporal
      setCompleteTaskModalVisible(false);
      setTaskToComplete(null);

      // Sincronizar en segundo plano luego de completar tarea
      fetchAll(true).catch(() => {
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

  // Añade una categoría nueva para el usuario
  const handleAddCategory = useCallback(async () => {
    if (!categoryName.trim()) {
      Alert.alert(t('screens.pending.header'), t('screens.pending.categoryNamePlaceholder'));
      return;
    }

    if (categoryName.trim().length > CATEGORY_NAME_MAX_LENGTH) {
      Alert.alert(
        t('screens.pending.alertCaracter'),
        t('screens.pending.contentCaracterAlert', { max: CATEGORY_NAME_MAX_LENGTH })
      );
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

  // Elimina una categoría (luego de confirmar con el usuario)
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
                // IMPORTANTE: después de borrar una categoría, restaurar scroll a tope
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
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

  // Marca categoría para edición (abre modal)
  const handleEditCategory = useCallback(
    async (category: Category) => {
      setEditingCategory(category);
      setCategoryName(category.categoria);
      setCategoryModalVisible(true);
    },
    [],
  );

  // Guarda cambios de edición/nueva categoría (llamada desde modal)
  const handleSaveCategoryChanges = useCallback(async () => {
    if (!editingCategory) {
      await handleAddCategory();
      return;
    }
    if (!categoryName.trim()) {
      Alert.alert(t('screens.pending.header'), t('screens.pending.categoryNamePlaceholder'));
      return;
    }
    if (categoryName.trim().length > CATEGORY_NAME_MAX_LENGTH) {
      Alert.alert(
        t('screens.pending.alertCaracter'),
        t('screens.pending.contentCaracterAlert', { max: CATEGORY_NAME_MAX_LENGTH })
      );
      return;
    }
    try {
      const apikey = await AsyncStorage.getItem('@auth:apikey');
      if (!apikey) {
        throw new Error(t('auth.loginErrorFallback'));
      }
      const params = new URLSearchParams();
      params.append('id_cattodo', String(editingCategory.id));
      params.append('texto', categoryName.trim());

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

  // Acciones para compartir una lista (abre modal)
  const handleOpenShareModal = useCallback((list: TodoList) => {
    setShareTargetList(list);
    setShareEmail('');
    setShareLookup(null);
    setShareMessage(null);
    setShareModalVisible(true);
  }, []);

  // Busca usuario a compartir por email
  const handleLookupShare = useCallback(async () => {
    if (!shareSearch.trim()) return;

    try {

      setShareLoading(true);

      const apikey = await AsyncStorage.getItem('@auth:apikey');

      const response = await fetch(
        `${API_CONFIG.baseUrl}usuarios/buscar/${encodeURIComponent(shareSearch.trim())}`,
        {
          headers: {
            apikey: apikey ?? '',
          },
        }
      );

      const text = await response.text();

      let payload;

      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error (t('screens.pending.errorSearch'));
      }

      if (!response.ok) {
        throw new Error(payload?.message || t('screens.pending.errorSearch'));
      }

      setShareResults(payload);
      setShareMessage(null);

    } catch (error) {

      setShareResults([]);
      setShareMessage((error as Error).message);

    } finally {

      setShareLoading(false);

    }

  }, [shareSearch]);

  // Envía invitación para compartir una lista
  const handleSendShareInvite = useCallback(async (userId: string) => {

    if (!shareTargetList) return;

    try {

      setShareLoading(true);

      const apikey = await AsyncStorage.getItem('@auth:apikey');

      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('id_categoria', String(shareTargetList.category_id));
      

    const response = await fetch(`${API_CONFIG.baseUrl}listas/compartir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': apikey ?? ''
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(t('screens.pending.errorShareInvite'));
    }

    void fetchAll();

    Alert.alert(
      t('screens.pending.shareSuccessTitle'),
      t('screens.pending.shareSuccessMessage')
    );

    setShareModalVisible(false);
    setShareSearch('');
    setShareResults([]);


  } catch (error) {

    Alert.alert(
      t('screens.pending.shareTitle'),
      (error as Error).message
    );

  } finally {

    setShareLoading(false);

  }

}, [shareTargetList]);

  // Limpia todas las tareas completadas de una lista (tras confirmar)
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
  
                //  Guarda posición actual del scroll
                const currentScrollY = scrollPositionRef.current;
  
                const response = await fetch(
                  `${API_CONFIG.baseUrl}clearcompleted/${categoryId}`,
                  { headers: { apikey } }
                );
  
                if (!response.ok) {
                  throw new Error(t('screens.pending.errorDeleteTask'));
                }
  
                //  Recarga sin loading global
                await fetchAll(true);
  
                // Restaura scroll después del render
                InteractionManager.runAfterInteractions(() => {
                  scrollViewRef.current?.scrollTo({
                    y: currentScrollY,
                    animated: false,
                  });
                });
  
              } catch (caughtError) {
                Alert.alert(
                  t('screens.pending.errorDeleteTask'),
                  (caughtError as Error).message ??
                    t('screens.pending.errorDeleteTask'),
                );
              }
            },
          },
        ],
      );
    },
    [fetchAll, t],
  );

  // Marca tarea para edición (abre modal)
  const handleEditTodo = useCallback((todo: TodoItem, categoryId: string | number) => {
    setEditingTodo({ id: todo.id, categoryId });
    setEditingTodoText(todo.texto);
    setEditTodoModalVisible(true);
  }, []);

  // Guarda los cambios en texto de una tarea editada
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

      // Actualiza localmente el texto editado en tareas personales/compartidas
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

      // Actualiza datos en segundo plano por si hay cambios externos
      fetchAll(true).catch(() => {
        // Como fallback, recarga todo
        void fetchAll();
      });
    } catch (caughtError) {
      Alert.alert(
        t('screens.pending.errorSaveTask'),
        (caughtError as Error).message ?? t('screens.pending.errorSaveTask'),
      );
    }
  }, [editingTodo, editingTodoText, fetchAll, t]);

  // ----- Variables auxiliares para renderizado dinámico -----
  const currentLists = currentTab === 'personal' ? personalLists : sharedLists;
  const collapsedMap = currentTab === 'personal' ? collapsedPersonal : collapsedShared;
  const toggleList = currentTab === 'personal' ? togglePersonalList : toggleSharedList;

  const empty = !loading && currentLists.every((list) => list.todos.length === 0);
  const hasCategories = categories.length > 0;

  // ------------------- RENDER principal del componente -------------------
  return (
    <AppScreen titleKey="tabs.pending">
      {/* Scroll principal de la pantalla, con manejo de scrollRef */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        onScroll={(event) => {
          scrollPositionRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="always"
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
      >
        {/* Card para añadir nueva tarea/categoría */}
        <View style={[
          styles.card, 
          { backgroundColor: palette.surface,
            borderColor: (showTutorial && tutorialStep === 0) ? palette.primary : palette.border,
            borderWidth: (showTutorial && tutorialStep === 0) ? 3 : 1,
          }
        ]}>
          <Text style={[styles.cardTitle, { color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]}>
            {t('screens.pending.addNew')}
          </Text>

          {/* Selector de categoría */}
          <Text style={[styles.label, { color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]}>
            {t('screens.pending.selectCategory')}
          </Text>
          <View style={[styles.pickerWrapper, { borderColor: colorScheme === 'light' ? '#333333' : palette.border }]}>
            {hasCategories ? (
              <Picker {...({} as any)}
                selectedValue={selectedCategory ?? undefined}
                onValueChange={(value) => setSelectedCategory(String(value))}
                style={{ color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }}
                itemStyle={{ color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }}>
                {categories.map((cat) => (
                  <Picker.Item {...({} as any)} key={String(cat.id)} label={cat.categoria} value={String(cat.id)} color={colorScheme === 'light' ? '#000000' : palette.textOnSurface} />
                ))}
              </Picker>
            ) : (
              <Text style={[styles.placeholder, { color: palette.inputPlaceholder }]}>
                {t('screens.pending.categoryNamePlaceholder')}
              </Text>
            )}
          </View>

          {/* Botón para gestionar categorías (abre modal) */}
          <TouchableOpacity 
            style={[
              styles.secondaryButton, 
              { 
                borderColor: (showTutorial && tutorialStep === 1) ? palette.primary : palette.border,
                borderWidth: (showTutorial && tutorialStep === 1) ? 3 : 1,
              }
            ]}
            onPress={() => {
              if (!showTutorial) { // Deshabilitar durante el tutorial
                setEditingCategory(null); setCategoryName(''); setCategoryModalVisible(true);
              }
            }}
          >
            <Ionicons name="create-outline" size={18} color={palette.primary} />
            <Text style={[styles.secondaryButtonLabel, { color: palette.primary }]}>
              {t('screens.pending.manageCategories')}
            </Text>
          </TouchableOpacity>

          {/* Entrada de texto y botón para agregar nueva tarea */}
          <Text style={[styles.label, { color: colorScheme === 'light' ? '#000000' : palette.textOnSurface }]}>{t('screens.pending.addNew')}</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextInput
              style={[
                styles.input,
                { borderColor: colorScheme === 'light' ? '#333333' : palette.border, color: colorScheme === 'light' ? '#000000' : palette.textOnSurface, flex: 1 },
              ]}
              placeholder={t('screens.pending.addNew')}
              placeholderTextColor={colorScheme === 'light' ? '#666666' : palette.textSecondary}
              value={taskText}
              onChangeText={setTaskText}
              blurOnSubmit={false}
              returnKeyType="done"
              onSubmitEditing={handleAddTask}
            />
          </View>

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

        {/* Tabs para cambiar entre listas personales y compartidas */}
        <View 
          style={[
            styles.tabs, 
            { borderColor: palette.border },
            showTutorial && tutorialStep === 2 && {
              borderColor: palette.primary,
              borderWidth: 2,
            }
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              currentTab === 'personal' && { backgroundColor: palette.primary },
            ]}
            onPress={() => handleSwitchTab('personal')}
            activeOpacity={0.7}
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
              currentTab === 'shared' && { backgroundColor: palette.primary },
            ]}
            onPress={() => handleSwitchTab('shared')}
            activeOpacity={0.7}
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

        {/* Hint para el usuario sobre cómo marcar tareas como completadas */}
        <Text style={[
          styles.hint, 
          { 
            color: (showTutorial && tutorialStep === 3) ? palette.primary : palette.inputPlaceholder,
            fontWeight: (showTutorial && tutorialStep === 3) ? '700' : '400',
          }
        ]}>
          {t('screens.pending.completeHint')}
        </Text>

        {/* Feedback condicional: cargando, error, vacío o render de listas */}
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
          // Renderiza cada lista (personal o compartida) y sus tareas
          currentLists.map((list) => {
            if (!list.todos || list.todos.length === 0) {
              return null;
            }
            const collapsed = !!collapsedMap[list.category_id];
            // Destaca listas compartidas con cambios recientes
            const highlight =
              currentTab === 'shared' &&
              list.categoria_updated &&
                  recentTimes.some((time: Date) => {
                const updatedAt = new Date(list.categoria_updated ?? '');
                return updatedAt >= time;
              });

                // Detectamos si todas las tareas están marcadas como completadas (status === 1)
                const allCompleted = list.todos.length > 0 && list.todos.every((t) => t.status === 1);

                const safeKey = list.category_id !== undefined && list.category_id !== null 
                  ? String(list.category_id) 
                  : `synthetic-${list.categoria}`;

            return (
              <View
                    key={safeKey}
                style={[
                  styles.listCard,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                      // Si hay cambios recientes, aplicamos un tinte del color primario (transparente)
                      highlight && { 
                        borderColor: palette.primary,
                        backgroundColor: colorScheme === 'dark' ? `${palette.primary}20` : `${palette.primary}08` 
                      },
                      // Si la lista está completa, aplicamos el resplandor neón
                      allCompleted && {
                        shadowColor: palette.accent,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 12,
                        elevation: 10,
                        borderColor: palette.accent,
                        borderWidth: 2,
                      }
                ]}
              >
                <View style={styles.listHeader}>
                  <TouchableOpacity
                    style={styles.listHeaderLeft}
                    onPress={() => toggleList(list.category_id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listTitle, { color: palette.textOnSurface }]}>{list.categoria}</Text>
                      {list.shared_with && list.shared_with.length > 0 && (
                        <TouchableOpacity onPress={() => handleViewMembers(list)} hitSlop={10}>
                          <Text style={[styles.listSubtitle, { color: palette.primary, fontWeight: '700', marginTop: 4 }]}>
                            <Ionicons {...({} as any)} name="people-outline" size={14} />{' '}
                            {t('screens.pending.sharedInfo', { 
                              count: new Set(list.shared_with.map(m => m.id)).size 
                            })}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Ionicons {...({} as any)}
                      name={collapsed ? 'chevron-down' : 'chevron-up'}
                      size={20}
                      color={palette.inputPlaceholder}
                    />
                  </TouchableOpacity>
                  <View style={styles.listActions}>
                    {currentTab === 'personal' && (
                      <TouchableOpacity onPress={() => handleOpenShareModal(list)}>
                        <Ionicons {...({} as any)} name="share-social-outline" size={20} color={palette.inputPlaceholder} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleClearCompleted(list.category_id)}>
                      <Ionicons {...({} as any)} name="trash-outline" size={20} color={palette.accent} />
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
                        <Ionicons {...({} as any)}
                          name={todo.status === 1 ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={todo.status === 1 ? '#9CA3AF' : palette.inputPlaceholder}
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
                          <Ionicons {...({} as any)} name="create-outline" size={18} color={palette.inputPlaceholder} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal para alta y edición de categorías */}
      <Modal visible={categoryModalVisible} transparent animationType="fade" onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            {/* Header del modal de categoría */}
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
                <Ionicons {...({} as any)} name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            {/* Input para nombre de categoría */}
            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: colorScheme === 'light' ? '#333333' : palette.border, 
                  color: colorScheme === 'light' ? '#000000' : palette.textOnSurface 
                }
              ]}
              placeholder={t('screens.pending.categoryNamePlaceholder')}
              placeholderTextColor={colorScheme === 'light' ? '#666666' : palette.textSecondary}
              value={categoryName}
              onChangeText={setCategoryName}
            />
            {/* Botones guardar/cancelar en el modal */}
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

            {/* Lista de categorías existentes personales con acciones editar/borrar */}
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
                        <Ionicons {...({} as any)} name="trash-outline" size={18} color={palette.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEditCategory(category)}>
                        <Ionicons {...({} as any)} name="create-outline" size={18} color={palette.textSecondary} />
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

      {/* Modal para compartir lista (busca usuario e invita) */}
      <Modal visible={shareModalVisible} transparent animationType="fade" onRequestClose={() => setShareModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            {/* Header del modal de compartir */}
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
                <Ionicons {...({} as any)} name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDescription, { color: palette.inputPlaceholder }]}>
              {t('screens.pending.shareDescriptionSearch')}
            </Text>
            {/* Input de email para buscar usuario */}
            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: colorScheme === 'light' ? '#333333' : palette.border, 
                  color: colorScheme === 'light' ? '#000000' : palette.textOnSurface 
                }
              ]}
              placeholder={t('screens.pending.shareUser')}
              placeholderTextColor={colorScheme === 'light' ? '#666666' : palette.textSecondary}
              autoCapitalize="none"
              value={shareSearch}
              onChangeText={setShareSearch}
            />
            {/* Botones buscar/cancelar y resultados búsqueda/invitación */}
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
            {/* Mensaje de feedback búsqueda usuario al compartir */}
            {shareMessage ? (
              <Text style={[styles.feedbackText, { color: palette.inputPlaceholder }]}>{shareMessage}</Text>
            ) : null}
            {/* Resultado de búsqueda: permite invitar si encuentra usuario */}
            {shareResults && shareResults.length > 0 && (
              <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                <View style={styles.shareResult}>
                  {shareResults.map((user) => (
                    <View
                      key={user.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 10,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderColor: palette.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primary + '20', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {user.avatar ? (
                            <Image {...({} as any)}
                              source={{ uri: user.avatar.startsWith('http') ? user.avatar : `${API_CONFIG.baseUrl}${user.avatar}` }} 
                              style={{ width: 40, height: 40 }} 
                            />
                          ) : (
                            <Text style={{ color: palette.primary, fontWeight: '700' }}>{user.nombre?.charAt(0).toUpperCase() || '?'}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: palette.textOnSurface, fontWeight: '600' }}>
                            {user.nombre}
                          </Text>
                          <Text style={{ color: palette.inputPlaceholder, fontSize: 12 }} numberOfLines={1}>
                            {user.correo}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.secondaryButton,
                          { 
                            borderColor: palette.primary, 
                            paddingHorizontal: 10, 
                            paddingVertical: 6, // Altura flexible basada en padding
                            minWidth: 100,      // Más espacio para el texto en español
                          }
                        ]}
                        onPress={() => handleSendShareInvite(String(user.id))}
                      >
                        <Text style={[styles.secondaryButtonLabel, { color: palette.primary, fontSize: 12 }]} numberOfLines={1}>
                          {t('screens.pending.shareInvite')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal para editar texto de una tarea */}
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
                <Ionicons {...({} as any)} name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            {/* Input de edición de tarea */}
            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: colorScheme === 'light' ? '#333333' : palette.border, 
                  color: colorScheme === 'light' ? '#000000' : palette.textOnSurface 
                }
              ]}
              placeholder={t('screens.pending.editTask')}
              placeholderTextColor={colorScheme === 'light' ? '#666666' : palette.textSecondary}
              value={editingTodoText}
              onChangeText={setEditingTodoText}
            />
            {/* Botones para guardar/cancelar edición de tarea */}
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

      {/* Modal para confirmar el completado de una tarea */}
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
                <Ionicons {...({} as any)} name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDescription, { color: palette.inputPlaceholder }]}>
              {t('screens.pending.deleteTaskConfirm')}
            </Text>
            {/* Botones para cancelar o completar la tarea */}
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
                    backgroundColor: palette.primary,
                    flex: 1,
                  },
                ]}
                onPress={handleConfirmCompleteTask}
                disabled={completingTask}>
                <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                  {completingTask ? '…' : t('screens.pending.completeTask')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para ver miembros de la lista */}
      <Modal visible={membersModalVisible} transparent animationType="slide" onRequestClose={() => setMembersModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: palette.textOnSurface }]}>{selectedListMembers?.name}</Text>
                <Text style={[styles.label, { color: palette.inputPlaceholder, marginTop: 4 }]}>
                  {t('screens.pending.sharedTab')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMembersModalVisible(false)} hitSlop={12}>
                <Ionicons {...({} as any)} name="close-circle" size={28} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {selectedListMembers?.members && selectedListMembers.members.length > 0 ? (
                selectedListMembers.members.map((member) => (
                  <View key={member.id} style={[styles.categoryRow, { borderColor: palette.border, paddingVertical: 15 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primary + '20', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {member.avatar ? (
                          <Image {...({} as any)}
                            source={{ uri: member.avatar.startsWith('http') ? member.avatar : `${API_CONFIG.baseUrl}${member.avatar}` }} 
                            style={{ width: 40, height: 40 }} 
                          />
                        ) : (
                          <Text style={{ color: palette.primary, fontWeight: '700' }}>{member.nombre.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={[styles.categoryName, { color: palette.textOnSurface, fontWeight: '500' }]}>
                        {member.nombre}
                      </Text>
                    </View>
                    <Ionicons {...({} as any)} name="checkmark-circle" size={20} color={palette.primary} />
                  </View>
                ))
              ) : (
                <Text style={[styles.feedbackText, { color: palette.inputPlaceholder, paddingVertical: 20 }]}>
                  {t('screens.notifications.empty')}
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: palette.primary, marginTop: 10 }]}
              onPress={() => setMembersModalVisible(false)}>
              <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para el tutorial interactivo */}
      <Modal visible={showTutorial} transparent animationType="fade">
        <View style={styles.tutorialOverlay}>
          <View style={[styles.tutorialCard, { backgroundColor: palette.surface }]}>
            <View style={styles.tutorialHeader}>
              <Ionicons 
                name={
                  tutorialStep === 0 ? 'arrow-up' : 
                  tutorialStep === 1 ? 'arrow-up' : 
                  tutorialStep === 2 ? 'arrow-up' : 
                  'arrow-up'
                } 
                size={28} 
                color={palette.primary} 
              />
              <Text style={[styles.tutorialStepText, { color: palette.inputPlaceholder }]}>
                {tutorialStep + 1} / {tutorialSteps.length}
              </Text>
            </View>
            
            <View style={styles.tutorialContent}>
              <Ionicons 
                name={tutorialSteps[tutorialStep].icon as any} 
                size={48} 
                color={palette.primary} 
              />
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
                {tutorialStep === tutorialSteps.length - 1 ? t('common.ok') : t('screens.onboarding.next')}
              </Text>
            </TouchableOpacity>
          </View>
        </View> 
      </Modal>

    </AppScreen>
  );
}

// ---------- Definición de estilos del componente ----------
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 18,
  },
    card: {
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
    paddingVertical: 16,
    paddingHorizontal: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabLabel: {
    fontWeight: '700',
    fontSize: 14,
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
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  listSubtitle: {
    fontSize: 12,
  },
  todoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffffff20',
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
    lineHeight: 22,
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
    gap: 14,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 24,
    padding: 22,
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  tutorialCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  tutorialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  tutorialButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minWidth: 120,
  },
  tutorialButtonText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});