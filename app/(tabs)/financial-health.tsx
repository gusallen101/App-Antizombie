import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type Movement = {
  id: number;
  etiqueta: string;
  tipo: number;
  cantidad: number;
};

type EntryMode = 'income' | 'expense';
type EntrySubtype = 'fixed' | 'variable';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, index) => CURRENT_YEAR - 3 + index);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const TYPE_LABELS: Record<number, string> = {
  1: 'GF',
  2: 'GV',
  3: 'IF',
  4: 'IV',
};

const incomeType = (subtype: EntrySubtype) => (subtype === 'fixed' ? 3 : 4);
const expenseType = (subtype: EntrySubtype) => (subtype === 'fixed' ? 1 : 2);

export default function FinancialHealthScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [markup, setMarkup] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entryMode, setEntryMode] = useState<EntryMode>('income');
  const [entryConcept, setEntryConcept] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entrySubtype, setEntrySubtype] = useState<EntrySubtype | null>('fixed');
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }),
    [],
  );

  const handleOpenModal = useCallback(
    (mode: EntryMode, movement?: Movement) => {
      setEntryMode(mode);
      if (movement) {
        setEditingMovement(movement);
        setEntryConcept(movement.etiqueta);
        setEntryAmount(String(movement.cantidad));
        if (movement.tipo === 1 || movement.tipo === 3) {
          setEntrySubtype('fixed');
        } else {
          setEntrySubtype('variable');
        }
      } else {
        setEditingMovement(null);
        setEntryConcept('');
        setEntryAmount('');
        setEntrySubtype('fixed');
      }
      setEntryModalVisible(true);
    },
    [],
  );

  const closeEntryModal = useCallback(() => {
    if (savingEntry) {
      return;
    }
    setEntryModalVisible(false);
    setEditingMovement(null);
  }, [savingEntry]);

  const parseMovements = useCallback((payload: unknown): Movement[] => {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map((item) => ({
        id: Number(item?.id) || Date.now(),
        etiqueta: String(item?.etiqueta ?? ''),
        tipo: Number(item?.tipo) || 0,
        cantidad: Number(item?.cantidad) || 0,
      }))
      .filter((movement) => movement.etiqueta.length > 0 && movement.tipo > 0);
  }, []);

  const fetchMovements = useCallback(
    async (targetMonth: number, targetYear: number) => {
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

        const response = await fetch(
          `${API_CONFIG.baseUrl}movimientos/${userId}/${targetMonth}/${targetYear}`,
          {
            headers: { apikey },
          },
        );

        if (!response.ok) {
          throw new Error(t('screens.home.zombieError'));
        }

        const payload = await response.json();
        const parsed = parseMovements(payload);
        const computedMarkup = parsed.reduce((acc, movement) => {
          if (movement.tipo === 1 || movement.tipo === 2) {
            return acc - movement.cantidad;
          }
          if (movement.tipo === 3 || movement.tipo === 4) {
            return acc + movement.cantidad;
          }
          return acc;
        }, 0);

        setMovements(parsed);
        setMarkup(computedMarkup);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : t('screens.home.zombieError'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [parseMovements, refreshing, t],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchMovements(month, year);
    }, [fetchMovements, month, year]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchMovements(month, year);
  }, [fetchMovements, month, year]);

  const handleChangeMonth = useCallback(
    (nextMonth: number) => {
      setMonth(nextMonth);
      setLoading(true);
      void fetchMovements(nextMonth, year);
    },
    [fetchMovements, year],
  );

  const handleChangeYear = useCallback(
    (nextYear: number) => {
      setYear(nextYear);
      setLoading(true);
      void fetchMovements(month, nextYear);
    },
    [fetchMovements, month],
  );

  const handleSaveEntry = useCallback(async () => {
    if (!entryConcept.trim() || !entryAmount.trim() || !entrySubtype) {
      Alert.alert(t('screens.goals.form.errorTitle'), t('screens.goals.form.validationName'));
      return;
    }

    const amountValue = Number(entryAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      Alert.alert(t('screens.goals.form.errorTitle'), t('screens.financialHealth.amountLabel'));
      return;
    }

    try {
      setSavingEntry(true);
      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);

      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }

      const params = new URLSearchParams();
      params.append('etiqueta', entryConcept.trim());
      params.append('cantidad', entryAmount.trim());
      params.append(
        'tipo',
        String(entryMode === 'income' ? incomeType(entrySubtype) : expenseType(entrySubtype)),
      );

      let targetUrl = `${API_CONFIG.baseUrl}movimiento`;
      if (editingMovement) {
        params.append('id_gasto', String(editingMovement.id));
      } else {
        params.append('mes', String(month));
        params.append('anio', String(year));
        params.append('id_usuario', userId);
      }

      const response = await fetch(targetUrl + (editingMovement ? '-edit' : ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(t('screens.home.zombieError'));
      }

      closeEntryModal();
      void fetchMovements(month, year);
    } catch (caughtError) {
      Alert.alert(
        t('screens.viewGoals.errorTitle'),
        caughtError instanceof Error ? caughtError.message : t('screens.home.zombieError'),
      );
    } finally {
      setSavingEntry(false);
    }
  }, [
    closeEntryModal,
    entryAmount,
    entryConcept,
    entryMode,
    entrySubtype,
    fetchMovements,
    month,
    editingMovement,
    t,
    year,
  ]);

  const handleDeleteMovement = useCallback(
    (movement: Movement) => {
      Alert.alert(
        t('screens.financialHealth.delete'),
        t('screens.financialHealth.confirmDelete', { concept: movement.etiqueta }),
        [
          {
            text: t('screens.financialHealth.cancel'),
            style: 'cancel',
          },
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
                  `${API_CONFIG.baseUrl}eliminar-movimiento-financiero/${movement.id}`,
                  {
                    headers: { apikey },
                  },
                );

                if (!response.ok) {
                  throw new Error(t('screens.home.zombieError'));
                }

                void fetchMovements(month, year);
              } catch (caughtError) {
                Alert.alert(
                  t('screens.viewGoals.errorTitle'),
                  caughtError instanceof Error ? caughtError.message : t('screens.home.zombieError'),
                );
              }
            },
          },
        ],
      );
    },
    [fetchMovements, month, t, year],
  );

  const renderMovementRow = useCallback(
    (movement: Movement) => (
      <View key={movement.id} style={[styles.tableRow, { borderColor: palette.border }]}>
        <View style={styles.rowDetails}>
          <Text style={[styles.cellConcept, { color: palette.textOnSurface }]}>{movement.etiqueta}</Text>
          <Text style={[styles.cellType, { color: palette.inputPlaceholder }]}>
            {TYPE_LABELS[movement.tipo] ?? movement.tipo}
          </Text>
        </View>
        <View style={styles.rowAmount}>
          <Text style={[styles.cellAmount, { color: palette.textOnSurface }]}>
            {currencyFormatter.format(movement.cantidad)}
          </Text>
          <View style={styles.rowActions}>
            <TouchableOpacity
              onPress={() => handleOpenModal(movement.tipo >= 3 ? 'income' : 'expense', movement)}
              style={styles.rowActionButton}
            >
              <Ionicons name="create-outline" size={18} color={palette.inputPlaceholder} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteMovement(movement)}
              style={styles.rowActionButton}
            >
              <Ionicons name="trash-outline" size={18} color={palette.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ),
    [
      currencyFormatter,
      handleDeleteMovement,
      handleOpenModal,
      palette.accent,
      palette.border,
      palette.textPrimary,
      palette.textSecondary,
    ],
  );

  const emptyState = !loading && movements.length === 0;

  return (
    <AppScreen
      titleKey="tabs.financialHealth"
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />
      }
    >
      <View style={[styles.filtersCard, { backgroundColor: palette.surface }]}>
        <Text style={[styles.filtersHeading, { color: palette.textOnSurface }]}>
          {t('screens.financialHealth.headline')}
        </Text>
        <Text style={[styles.filtersSubheading, { color: palette.inputPlaceholder }]}>
          {t('screens.financialHealth.subheadline')}
        </Text>
        <View style={styles.pickersRow}>
          <View style={[styles.pickerWrapper, { borderColor: palette.border }]}>
            <Text style={[styles.pickerLabel, { color: palette.inputPlaceholder }]}>
              {t('screens.financialHealth.yearLabel')}
            </Text>
            <Picker
              selectedValue={year}
              onValueChange={(value) => handleChangeYear(Number(value))}
              dropdownIconColor={palette.textOnSurface}
              style={[styles.picker, { color: palette.textOnSurface }]}
              itemStyle={{ color: palette.textOnSurface }}>
              {YEARS.map((availableYear) => (
                <Picker.Item key={availableYear} label={String(availableYear)} value={availableYear} color={palette.textOnSurface} />
              ))}
            </Picker>
          </View>
          <View style={[styles.pickerWrapper, { borderColor: palette.border }]}>
            <Text style={[styles.pickerLabel, { color: palette.inputPlaceholder }]}>
              {t('screens.financialHealth.monthLabel')}
            </Text>
            <Picker
              selectedValue={month}
              onValueChange={(value) => handleChangeMonth(Number(value))}
              dropdownIconColor={palette.textOnSurface}
              style={[styles.picker, { color: palette.textOnSurface }]}
              itemStyle={{ color: palette.textOnSurface }}>
              {MONTHS.map((availableMonth) => (
                <Picker.Item
                  key={availableMonth}
                  label={t(`screens.financialHealth.months.${availableMonth}`)}
                  value={availableMonth}
                  color={palette.textOnSurface}
                />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <View style={[styles.markupCard, { backgroundColor: palette.surface }]}>
        <Text style={[styles.markupLabel, { color: palette.inputPlaceholder }]}>
          {t('screens.financialHealth.markupLabel')}
        </Text>
        <Text style={[styles.markupValue, { color: palette.textOnSurface }]}>
          {currencyFormatter.format(markup)}
        </Text>
      </View>

      {loading ? (
        <View style={styles.feedbackWrapper}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : error ? (
        <View style={styles.feedbackWrapper}>
          <Ionicons name="alert-circle-outline" size={36} color={palette.accent} />
          <Text style={[styles.feedbackText, { color: palette.textOnSurface }]}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={[styles.retryLabel, { color: palette.primary }]}>
              {t('screens.viewGoals.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : emptyState ? (
        <View style={[styles.emptyState, { borderColor: palette.border }]}>
          <SvgXml xml={markupIllustration} width={200} height={180} />
          <Text style={[styles.emptyTitle, { color: palette.textOnSurface }]}>
            {t('screens.financialHealth.emptyTitle')}
          </Text>
          <Text style={[styles.emptyDescription, { color: palette.inputPlaceholder }]}>
            {t('screens.financialHealth.emptyDescription')}
          </Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: palette.surface }]}>
          <View style={[styles.tableHeader, { backgroundColor: `${palette.primary}12` }]}>
            <Text style={[styles.headerCell, { color: palette.textOnSurface }]}>
              {t('screens.financialHealth.listHeading.concept')}
            </Text>
            <Text style={[styles.headerCell, { color: palette.textOnSurface }]}>
              {t('screens.financialHealth.listHeading.type')}
            </Text>
            <Text style={[styles.headerCell, { color: palette.textOnSurface }]}>
              {t('screens.financialHealth.listHeading.amount')}
            </Text>
          </View>
          <ScrollView>
            {movements.map((movement) => renderMovementRow(movement))}
          </ScrollView>
        </View>
      )}

      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.fabExpense]}
          onPress={() => handleOpenModal('expense')}
        >
          <Ionicons name="remove" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.fabIncome]} onPress={() => handleOpenModal('income')}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Modal transparent visible={entryModalVisible} animationType="fade" onRequestClose={closeEntryModal}>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.textOnSurface }]}>
                {entryMode === 'income'
                  ? t('screens.financialHealth.addIncome')
                  : t('screens.financialHealth.addExpense')}
              </Text>
              <TouchableOpacity onPress={closeEntryModal} hitSlop={16}>
                <Ionicons name="close" size={20} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: palette.textOnSurface }]}>
                {t('screens.financialHealth.conceptLabel')}
              </Text>
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.textOnSurface }]}
                placeholder={t('screens.financialHealth.conceptLabel')}
                placeholderTextColor={palette.textSecondary}
                value={entryConcept}
                onChangeText={setEntryConcept}
              />

              <Text style={[styles.label, { color: palette.textOnSurface }]}>
                {t('screens.financialHealth.typeLabel')}
              </Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={[
                    styles.radioPill,
                    {
                      borderColor: palette.border,
                      backgroundColor: entrySubtype === 'fixed' ? `${palette.primary}15` : 'transparent',
                    },
                  ]}
                  onPress={() => setEntrySubtype('fixed')}
                >
                  <Text
                    style={[
                      styles.radioLabel,
                      {
                        color: entrySubtype === 'fixed' ? palette.primary : palette.inputPlaceholder,
                      },
                    ]}
                  >
                    {t('screens.financialHealth.fixed')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioPill,
                    {
                      borderColor: palette.border,
                      backgroundColor:
                        entrySubtype === 'variable' ? `${palette.primary}15` : 'transparent',
                    },
                  ]}
                  onPress={() => setEntrySubtype('variable')}
                >
                  <Text
                    style={[
                      styles.radioLabel,
                      {
                        color: entrySubtype === 'variable' ? palette.primary : palette.inputPlaceholder,
                      },
                    ]}
                  >
                    {t('screens.financialHealth.variable')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: palette.textOnSurface }]}>
                {t('screens.financialHealth.amountLabel')}
              </Text>
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.textOnSurface }]}
                placeholder="0.00"
                placeholderTextColor={palette.textSecondary}
                value={entryAmount}
                onChangeText={setEntryAmount}
                keyboardType="numeric"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeEntryModal} disabled={savingEntry}>
                <Text style={[styles.cancelLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.financialHealth.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: palette.primary }]}
                onPress={handleSaveEntry}
                disabled={savingEntry}
              >
                <Text style={[styles.saveLabel, { color: palette.buttonText }]}>
                  {savingEntry ? '…' : t('screens.financialHealth.save')}
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
  screenContent: {
    flexGrow: 1,
    paddingBottom: 96,
    gap: 16,
  },
  filtersCard: {
    borderRadius: 32,
    padding: 20,
    gap: 8,
  },
  filtersHeading: {
    fontSize: 22,
    fontWeight: '700',
  },
  filtersSubheading: {
    fontSize: 15,
  },
  pickersRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  pickerWrapper: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  picker: {
    width: '100%',
  },
  pickerLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  markupCard: {
    borderRadius: 28,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  markupLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  markupValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  feedbackWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  feedbackText: {
    marginTop: 12,
    textAlign: 'center',
  },
  emptyState: {
    borderWidth: 1.5,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
  },
  tableCard: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  headerCell: {
    flex: 1,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowDetails: {
    flex: 1,
    gap: 4,
  },
  cellConcept: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cellType: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cellAmount: {
    width: 100,
    textAlign: 'right',
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowActionButton: {
    padding: 6,
  },
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  fabExpense: {
    backgroundColor: '#E67C73',
  },
  fabIncome: {
    backgroundColor: '#4CD964',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    borderRadius: 28,
    padding: 20,
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
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  radioRow: {
    flexDirection: 'row',
    gap: 12,
  },
  radioPill: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  radioLabel: {
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

const markupIllustration = `<svg id="aadec279-818b-408a-a9a2-133d1084e5d4" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 784.39764 733.6066"><path d="M832.54583,604.41452s97.0406,5.017,74.43777,35.56514-81.99491-17.91975-81.99491-17.91975Z" transform="translate(-207.80118 -83.1967)" fill="#ffb8b8"/><path d="M653.71677,313.44812l19.75208,4.938s11.52205,34.56615,19.75209,65.84028S717.91105,509.323,717.91105,509.323L845.5213,598.75563,830.30118,632.8033l-170-67L622.44263,417.14657Z" transform="translate(-207.80118 -83.1967)" fill="#575a89"/><polygon points="464.5 291.607 457.138 445.772 472.5 491.607 427.5 458.607 464.5 291.607" opacity="0.2"/><path d="M698.982,648.41057s21.3981,57.61025,24.69011,97.11442,6.584,70.77831,6.584,70.77831H629.84966l-19.75208-29.62813V816.3033H493.23107S460.31093,709.31284,473.479,696.14478s138.26461-69.1323,138.26461-69.1323Z" transform="translate(-207.80118 -83.1967)" fill="#2f2e41"/><rect x="101.5" y="731.6066" width="581" height="2" fill="#3f3d56"/><circle cx="365.26124" cy="105.15487" r="62.54827" fill="#ffb8b8"/><path d="M525.32821,214.68769l-4.938,72.42431,62.54827,83.94637L614.2126,292.05s-27.98213-18.10608-11.522-55.96424Z" transform="translate(-207.80118 -83.1967)" fill="#ffb8b8"/><path d="M708.03116,662.4c0,14.82-41.15,37.86005-41.15,37.86005v8.23l-16.46,8.23-36.21-72.42-9.87,79s-72.43,11.53-95.47,0c-23.05-11.52-34.57-6.58-67.49-18.1s13.17-166.25,13.17-166.25l-32.92-238.67,71.92-35.96,3.79-1.9,9.89-1.82,15.16-2.8,50.67,34.25,4.08,21.4,2.51,13.17,13.16-14.82,9.94-32.69,70.72,39.28-19.75,158.01S708.03116,647.59,708.03116,662.4Z" transform="translate(-207.80118 -83.1967)" fill="#575a89"/><path d="M466.072,713.42785s75.71633,60.90227,39.50417,72.42432-55.96424-62.54827-55.96424-62.54827Z" transform="translate(-207.80118 -83.1967)" fill="#ffb8b8"/><path d="M438.08983,303.57207l-16.46007-3.292s-24.69011,13.16806-26.33612,39.50417-23.0441,210.68892-23.0441,210.68892l69.1323,185.9988,55.96425-21.39809L443.02785,540.5971,484.178,389.16445Z" transform="translate(-207.80118 -83.1967)" fill="#575a89"/><circle cx="372.5" cy="264.6066" r="6" fill="#2f2e41"/><circle cx="372.5" cy="303.6066" r="6" fill="#2f2e41"/><circle cx="406.5" cy="560.6066" r="6" fill="#2f2e41"/><path d="M520.2536,124.27371l-11.56241-4.62895S532.86707,93.02848,566.50336,95.343L557.043,84.92787s23.1248-9.25775,44.14733,15.044c11.05115,12.77485,23.83743,27.7911,31.80833,44.70667h12.38253l-5.168,11.37937,18.088,11.37937-18.5656-2.044a63.589,63.589,0,0,1,.50381,18.8748,24.42141,24.42141,0,0,1-8.94287,15.976h0S616.957,170.56276,616.957,165.93382v11.57231s-11.5624-10.415-11.5624-17.35836l-6.3067,8.10061H557.043l6.3067-10.415L539.17377,161.305l9.46041-12.72959-37.431,52.56492S489.771,141.63206,520.2536,124.27371Z" transform="translate(-207.80118 -83.1967)" fill="#2f2e41"/><circle cx="684.39764" cy="383.54509" r="100" fill="#3f3d56"/><circle cx="684.39764" cy="383.54509" r="86" opacity="0.1"/><path d="M888.07791,517.48969V504.97263c-6.32734-.12344-12.87306-2.355-16.69109-5.45315l2.618-8.30316a26.68127,26.68127,0,0,0,15.70942,5.3285c7.74578,0,12.98225-5.081,12.98225-12.14493,0-6.81644-4.2548-11.02974-12.32763-14.74807-11.12757-4.957-18.00034-10.6582-18.00034-21.43985,0-10.28667,6.43653-18.09426,16.47324-19.95312V415.74179h6.76357v12.02149a26.54268,26.54268,0,0,1,14.18232,4.33734l-2.7277,8.17972a24.10675,24.10675,0,0,0-13.74554-4.2139c-8.39987,0-11.56381,5.70063-11.56381,10.6582,0,6.4443,4.03641,9.66645,13.52769,14.12845,11.23623,5.205,16.90947,11.64935,16.90947,22.67908,0,9.7905-6.00029,18.962-17.237,21.06772v12.8898Z" transform="translate(-207.80118 -83.1967)" fill="#763289"/><polygon points="250.005 504.87 290 629.803 258 499.803 250.005 504.87" opacity="0.2"/><path d="M253.89444,344H228.50772a4.178,4.178,0,0,1-4.17334-4.17334V303.3335a4.178,4.178,0,0,1,4.17334-4.17334h25.38672a4.178,4.178,0,0,1,4.17334,4.17334v36.49316A4.178,4.178,0,0,1,253.89444,344Zm-25.38672-42.83984a2.176,2.176,0,0,0-2.17334,2.17334v36.49316A2.176,2.176,0,0,0,228.50772,342h25.38672a2.176,2.176,0,0,0,2.17334-2.17334V303.3335a2.176,2.176,0,0,0-2.17334-2.17334Z" transform="translate(-207.80118 -83.1967)" fill="#3f3d56"/><path d="M300.26407,344H277.33829a5.41016,5.41016,0,0,1-5.40381-5.40381V264.897a5.41016,5.41016,0,0,1,5.40381-5.40381h22.92578a5.41016,5.41016,0,0,1,5.40381,5.40381v73.69922A5.41016,5.41016,0,0,1,300.26407,344Zm-22.92578-82.50684a3.40756,3.40756,0,0,0-3.40381,3.40381v73.69922A3.40756,3.40756,0,0,0,277.33829,342h22.92578a3.40756,3.40756,0,0,0,3.40381-3.40381V264.897a3.40756,3.40756,0,0,0-3.40381-3.40381Z" transform="translate(-207.80118 -83.1967)" fill="#3f3d56"/><path d="M346.97892,344H325.82364a6.29622,6.29622,0,0,1-6.28906-6.28906V229.28906A6.29622,6.29622,0,0,1,325.82364,223h21.15528a6.29622,6.29622,0,0,1,6.28906,6.28906V337.71094A6.29622,6.29622,0,0,1,346.97892,344ZM325.82364,225a4.29393,4.29393,0,0,0-4.28906,4.28906V337.71094A4.29393,4.29393,0,0,0,325.82364,342h21.15528a4.29393,4.29393,0,0,0,4.28906-4.28906V229.28906A4.29393,4.29393,0,0,0,325.82364,225Z" transform="translate(-207.80118 -83.1967)" fill="#3f3d56"/><rect x="23.88" y="222.9133" width="19.04" height="30.94" fill="#763289"/><rect x="71.48" y="183.6433" width="19.04" height="70.21" fill="#763289"/><rect x="119.08" y="147.14997" width="19.04" height="106.70333" fill="#763289"/><path d="M930.80118,229h-133a.99974.99974,0,0,1-1-1V93a1,1,0,0,1,2,0V227h132a1,1,0,0,1,0,2Z" transform="translate(-207.80118 -83.1967)" fill="#3f3d56"/><path d="M366.80118,358h-158a.99974.99974,0,0,1-1-1V200a1,1,0,0,1,2,0V356h157a1,1,0,0,1,0,2Z" transform="translate(-207.80118 -83.1967)" fill="#3f3d56"/><path d="M843.69962,216.46729H818.3129a4.17807,4.17807,0,0,1-4.17383-4.17334V175.80078a4.17806,4.17806,0,0,1,4.17383-4.17334h25.38672a4.17786,4.17786,0,0,1,4.17285,4.17334V212.294A4.17786,4.17786,0,0,1,843.69962,216.46729ZM818.3129,173.62744a2.17641,2.17641,0,0,0-2.17383,2.17334V212.294a2.17641,2.17641,0,0,0,2.17383,2.17334h25.38672a2.17557,2.17557,0,0,0,2.17285-2.17334V175.80078a2.17557,2.17557,0,0,0-2.17285-2.17334Z" transform="translate(-207.80118 -83.1967)" fill="#3f3d56"/><path d="M895.68888,216.46729H872.32267a5.18969,5.18969,0,0,1-5.1836-5.18409V145.18359A5.18927,5.18927,0,0,1,872.32267,140h23.36621a5.18927,5.18927,0,0,1,5.18359,5.18359V211.2832A5.18969,5.18969,0,0,1,895.68888,216.46729ZM872.32267,142a3.187,3.187,0,0,0-3.1836,3.18359V211.2832a3.18709,3.18709,0,0,0,3.1836,3.18409h23.36621a3.18708,3.18708,0,0,0,3.18359-3.18409V145.18359A3.187,3.187,0,0,0,895.68888,142Z" transform="translate(-207.80118 -83.1967)" fill="#3f3d56"/><rect x="613.22803" y="95.727" width="19.04" height="30.94" fill="#763289"/><rect x="666.68472" y="65.10507" width="19.04" height="59.8637" fill="#763289"/><circle cx="623" cy="68.8033" r="9" fill="#763289"/><circle cx="676" cy="34.8033" r="9" fill="#763289"/></svg>`;

