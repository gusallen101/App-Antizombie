import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Calendar from 'expo-calendar';
import * as IntentLauncher from 'expo-intent-launcher';
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

export default function RemindersScreen() {
  const { palette, colorScheme } = useAppTheme();
  const { t } = useLocalization();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [pickerValue, setPickerValue] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const formattedDate = useMemo(() => {
    if (!date) return '––';
    return date.toLocaleDateString();
  }, [date]);

  const formattedTime = useMemo(() => {
    if (!time) return '––';
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [time]);

  const ensureCalendarPermissions = useCallback(async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('PERMISSION_DENIED');
    }
  }, []);

  const getDefaultCalendarId = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      return defaultCalendar.id;
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const primaryCalendar = calendars.find(
      (cal) => cal.source?.isLocalAccount || cal.source?.name === 'Phone',
    );

    if (primaryCalendar) {
      return primaryCalendar.id;
    }

    const defaultSource =
      calendars.find((cal) => cal.accessLevel === Calendar.CalendarAccessLevel.OWNER)?.source ??
      (await Calendar.getSourcesAsync())[0];

    const newCalendarId = await Calendar.createCalendarAsync({
      title: 'ZombieApp Reminders',
      color: palette.primary,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultSource?.id,
      source: defaultSource,
      name: 'ZombieApp',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    return newCalendarId;
  }, [palette.primary]);

  const handleSaveReminder = useCallback(async () => {
    if (!title.trim() || !description.trim() || !date || !time) {
      Alert.alert(t('screens.remindersScreen.errorTitle'), t('screens.remindersScreen.missingFields'));
      return;
    }

    try {
      setSaving(true);
      await ensureCalendarPermissions();
      const calendarId = await getDefaultCalendarId();

      const startDate = new Date(date);
      startDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

      await Calendar.createEventAsync(calendarId, {
        title: title.trim(),
        notes: description.trim(),
        startDate,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      Alert.alert(t('screens.remindersScreen.successTitle'), t('screens.remindersScreen.successMessage'));
      setTitle('');
      setDescription('');
      setDate(null);
      setTime(null);
    } catch (error) {
      if ((error as Error).message === 'PERMISSION_DENIED') {
        Alert.alert(
          t('screens.remindersScreen.permissionDeniedTitle'),
          t('screens.remindersScreen.permissionDeniedMessage'),
        );
      } else {
        Alert.alert(
          t('screens.remindersScreen.errorTitle'),
          (error as Error).message ?? t('screens.remindersScreen.errorTitle'),
        );
      }
    } finally {
      setSaving(false);
    }
  }, [date, description, ensureCalendarPermissions, getDefaultCalendarId, t, time, title]);

  const handleOpenCalendar = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('calshow:');
    } else {
      try {
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.EVENTS);
      } catch {
        await Linking.openURL('content://com.android.calendar/time/');
      }
    }
  }, []);

  const openPicker = useCallback(
    (mode: 'date' | 'time') => {
      setPickerValue((mode === 'date' ? date : time) ?? new Date());
      setPickerMode(mode);
    },
    [date, time],
  );

  const handlePickerChange = useCallback(
    (_: unknown, selectedDate?: Date) => {
      if (selectedDate) {
        setPickerValue(selectedDate);
      }
    },
    [],
  );

  const handlePickerCancel = useCallback(() => {
    setPickerMode(null);
  }, []);

  const handlePickerConfirm = useCallback(() => {
    if (pickerMode === 'date') {
      const normalized = new Date(pickerValue);
      normalized.setHours(0, 0, 0, 0);
      setDate(normalized);
    } else if (pickerMode === 'time') {
      setTime(new Date(pickerValue));
    }
    setPickerMode(null);
  }, [pickerMode, pickerValue]);

  return (
    <AppScreen titleKey="tabs.reminders">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Platform.OS === 'ios' ? 108 : 96 }, // Ajustado para la barra de pestañas flotante
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.description, { color: palette.textSecondary }]}>
            {t('screens.remindersScreen.description')}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.textPrimary }]}>
              {t('screens.remindersScreen.nameLabel')}
            </Text>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.textPrimary }]}
              placeholder={t('screens.remindersScreen.nameLabel')}
              placeholderTextColor={palette.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.textPrimary }]}>
              {t('screens.remindersScreen.descriptionLabel')}
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                { borderColor: palette.border, color: palette.textPrimary },
              ]}
              placeholder={t('screens.remindersScreen.descriptionLabel')}
              placeholderTextColor={palette.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.rowItem]}>
              <Text style={[styles.label, { color: palette.textPrimary }]}>
                {t('screens.remindersScreen.dateLabel')}
              </Text>
              <TouchableOpacity
                style={[styles.selector, { borderColor: palette.border }]}
                onPress={() => openPicker('date')}
              >
                <Text style={[styles.selectorLabel, { color: palette.textPrimary }]}>
                  {formattedDate}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>

            <View style={[styles.fieldGroup, styles.rowItem]}>
              <Text style={[styles.label, { color: palette.textPrimary }]}>
                {t('screens.remindersScreen.timeLabel')}
              </Text>
              <TouchableOpacity
                style={[styles.selector, { borderColor: palette.border }]}
                onPress={() => openPicker('time')}
              >
                <Text style={[styles.selectorLabel, { color: palette.textPrimary }]}>
                  {formattedTime}
                </Text>
                <Ionicons name="time-outline" size={18} color={palette.inputPlaceholder} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: palette.primary }]}
            onPress={handleSaveReminder}
            disabled={saving}
          >
            <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
              {saving ? '…' : t('screens.remindersScreen.save')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: palette.primary }]}
            onPress={handleOpenCalendar}
          >
            <Ionicons name="eye-outline" size={18} color={palette.primary} />
            <Text style={[styles.secondaryButtonLabel, { color: palette.primary }]}>
              {t('screens.remindersScreen.viewCalendar')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerMode && (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: palette.surface }]}>
            <DateTimePicker
              value={pickerValue}
              mode={pickerMode}
              display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
              onChange={handlePickerChange}
              textColor={palette.textPrimary}
              themeVariant={colorScheme}
            />

            <View style={styles.pickerButtons}>
              <TouchableOpacity style={styles.pickerButton} onPress={handlePickerCancel}>
                <Text style={[styles.pickerButtonLabel, { color: palette.textSecondary }]}>
                  {t('screens.financialHealth.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pickerButton, styles.pickerButtonPrimary]}
                onPress={handlePickerConfirm}
              >
                <Text style={[styles.pickerButtonLabel, { color: palette.buttonText }]}>
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 16,
  },
  description: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  selector: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorLabel: {
    fontSize: 16,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000070',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCard: {
    width: '90%',
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  pickerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  pickerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pickerButtonPrimary: {
    backgroundColor: '#763289',
  },
  pickerButtonLabel: {
    fontWeight: '600',
  },
});
