import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { type Palette } from '@/constants/theme';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type PaletteOverride = Partial<Palette>;
type GenderOption = 'h' | 'm' | 'o';
const REMINDER_TIME_KEY = '@settings:reminderTime';
const REMINDER_NOTIFICATION_ID_KEY = '@settings:reminderNotificationId';
const REMINDER_ENABLED_KEY = '@settings:reminderEnabled';

const buildAvatarUrl = (path?: string | null) => {
  if (!path) {
    return null;
  }
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_CONFIG.baseUrl}${path}`;
};

const palettePresets: Array<{
  id: string;
  labelKey: string;
  light: PaletteOverride;
  dark: PaletteOverride;
}> = [
  {
    id: 'sunset',
    labelKey: 'screens.settings.presetSunset',
    light: {
      background: '#F3D1DC',
      primary: '#C9488A',
      secondary: '#F6A8D7',
      headerBackground: '#C9488A',
      tabBarBackground: '#C9488A',
      textPrimary: '#FFFFFF',
      textSecondary: '#5B1C38',
    },
    dark: {
      background: '#2B1122',
      primary: '#F6A8D7',
      secondary: '#C9488A',
      headerBackground: '#491333',
      tabBarBackground: '#491333',
      textPrimary: '#FFFFFF',
      textSecondary: '#F3D1DC',
    },
  },
  {
    id: 'forest',
    labelKey: 'screens.settings.presetForest',
    light: {
      background: '#2F5741',
      primary: '#3C8D61',
      secondary: '#94DDBC',
      textPrimary: '#FFFFFF',
      textSecondary: '#D6EFE3',
      headerBackground: '#3C8D61',
      tabBarBackground: '#3C8D61',
    },
    dark: {
      background: '#152C21',
      primary: '#94DDBC',
      secondary: '#3C8D61',
      textPrimary: '#F4FFF8',
      textSecondary: '#C2E4D4',
      headerBackground: '#1E4B33',
      tabBarBackground: '#1E4B33',
    },
  },
];

export default function SettingsScreen() {
  const { colorScheme, setColorScheme, updatePalette, resetPalette, palette } = useAppTheme();
  const { t } = useLocalization();
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [gender, setGender] = useState<GenderOption>('h');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingGender, setSavingGender] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [tempReminderTime, setTempReminderTime] = useState<Date>(new Date());

  const genderOptions: Array<{ value: GenderOption; label: string }> = useMemo(
    () => [
      { value: 'h', label: t('screens.settings.genderOptions.h') },
      { value: 'm', label: t('screens.settings.genderOptions.m') },
      { value: 'o', label: t('screens.settings.genderOptions.o') },
    ],
    [t],
  );

  const formattedReminderTime = useMemo(() => {
    if (!reminderTime) {
      return t('screens.settings.reminderPlaceholder');
    }
    return reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [reminderTime, t]);

  const handleApplyPreset = (presetId: string) => {
    const preset = palettePresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    updatePalette('light', preset.light);
    updatePalette('dark', preset.dark);
  };

  const handleReset = () => {
    resetPalette();
  };

  const getAuthContext = useCallback(async () => {
    const [apikey, userId] = await Promise.all([
      AsyncStorage.getItem('@auth:apikey'),
      AsyncStorage.getItem('@auth:userId'),
    ]);
    if (!apikey || !userId) {
      throw new Error(t('auth.loginErrorFallback'));
    }
    return { apikey, userId };
  }, [t]);

  const loadProfile = useCallback(async () => {
    try {
      const [[, storedName], [, storedEmail], [, storedAvatar], [, storedReminder], [, storedEnabled]] = await AsyncStorage.multiGet([
        '@auth:name',
        '@auth:email',
        '@auth:avatar',
        REMINDER_TIME_KEY,
        REMINDER_ENABLED_KEY,
      ]);
      setProfileName(storedName ?? '');
      setProfileEmail(storedEmail ?? '');
      setAvatarUrl(buildAvatarUrl(storedAvatar));
      if (storedReminder) {
        setReminderTime(new Date(storedReminder));
      }
      if (storedEnabled === 'true') {
        setReminderEnabled(true);
        // Verify that the notification is still scheduled
        const storedNotificationId = await AsyncStorage.getItem(REMINDER_NOTIFICATION_ID_KEY);
        if (storedNotificationId) {
          const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
          const notificationExists = allScheduled.some((n) => n.identifier === storedNotificationId);
          if (!notificationExists) {
            // Notification was lost, disable the toggle
            setReminderEnabled(false);
            await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
          }
        } else {
          // No notification ID stored, disable
          setReminderEnabled(false);
          await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
        }
      }

      const { apikey, userId } = await getAuthContext();
      const response = await fetch(`${API_CONFIG.baseUrl}avance_usuario/${userId}`, {
        headers: { apikey },
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.nombre) {
          setProfileName(data.nombre);
          await AsyncStorage.setItem('@auth:name', data.nombre);
        }
        if (data?.correo) {
          setProfileEmail(data.correo);
          await AsyncStorage.setItem('@auth:email', data.correo);
        }
        if (data?.avatar) {
          setAvatarUrl(buildAvatarUrl(data.avatar));
          await AsyncStorage.setItem('@auth:avatar', data.avatar);
        }
        if (data?.sexo) {
          setGender((data.sexo as GenderOption) ?? 'h');
        }
      }
    } catch (error) {
      console.warn('Failed to load profile', error);
    }
  }, [getAuthContext]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleChangeAvatar = useCallback(async () => {
    try {
      setSavingAvatar(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('screens.settings.saveChanges'), t('screens.settings.mediaPermissionMessage'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.length || !result.assets[0].base64) {
        return;
      }
      const { apikey, userId } = await getAuthContext();
      const params = new URLSearchParams();
      const asset = result.assets[0];
      const dataUrl = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
      params.append('id_usuario', userId);
      params.append('avatar', dataUrl);
      const response = await fetch(`${API_CONFIG.baseUrl}cambiaravatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || t('screens.settings.saveError'));
      }
      let data: { avatar?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.warn('Failed to parse avatar response', parseError);
      }
      const url = buildAvatarUrl(data?.avatar ?? result.assets[0].uri);
      setAvatarUrl(url);
      await AsyncStorage.setItem('@auth:avatar', data?.avatar ?? '');
      Alert.alert(t('screens.settings.saveChanges'), t('screens.settings.saveSuccess'));
    } catch (error) {
      Alert.alert(t('screens.settings.saveChanges'), (error as Error).message ?? t('screens.settings.saveError'));
    } finally {
      setSavingAvatar(false);
    }
  }, [getAuthContext, t]);

  const handleSaveName = useCallback(async () => {
    if (!profileName.trim()) {
      Alert.alert(t('screens.settings.saveChanges'), t('screens.pending.errorMissingFields'));
      return;
    }
    try {
      setSavingName(true);
      const { apikey, userId } = await getAuthContext();
      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('user_name', profileName.trim());
      const response = await fetch(`${API_CONFIG.baseUrl}username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(t('screens.settings.saveError'));
      }
      await AsyncStorage.setItem('@auth:name', profileName.trim());
      Alert.alert(t('screens.settings.saveChanges'), t('screens.settings.saveSuccess'));
    } catch (error) {
      Alert.alert(t('screens.settings.saveChanges'), (error as Error).message ?? t('screens.settings.saveError'));
    } finally {
      setSavingName(false);
    }
  }, [getAuthContext, profileName, t]);

  const handleSaveEmail = useCallback(async () => {
    if (!profileEmail.trim()) {
      Alert.alert(t('screens.settings.saveChanges'), t('screens.pending.errorMissingFields'));
      return;
    }
    try {
      setSavingEmail(true);
      const { apikey, userId } = await getAuthContext();
      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('email', profileEmail.trim());
      const response = await fetch(`${API_CONFIG.baseUrl}editemail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(t('screens.settings.saveError'));
      }
      await AsyncStorage.setItem('@auth:email', profileEmail.trim());
      Alert.alert(t('screens.settings.saveChanges'), t('screens.settings.saveSuccess'));
    } catch (error) {
      Alert.alert(t('screens.settings.saveChanges'), (error as Error).message ?? t('screens.settings.saveError'));
    } finally {
      setSavingEmail(false);
    }
  }, [getAuthContext, profileEmail, t]);

  const handleSaveGender = useCallback(async () => {
    try {
      setSavingGender(true);
      const { apikey, userId } = await getAuthContext();
      const params = new URLSearchParams();
      params.append('id_usuario', userId);
      params.append('sexo', gender);
      const response = await fetch(`${API_CONFIG.baseUrl}updategender`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(t('screens.settings.saveError'));
      }
      Alert.alert(t('screens.settings.saveChanges'), t('screens.settings.saveSuccess'));
    } catch (error) {
      Alert.alert(t('screens.settings.saveChanges'), (error as Error).message ?? t('screens.settings.saveError'));
    } finally {
      setSavingGender(false);
    }
  }, [gender, getAuthContext, t]);

  const cancelAllReminders = useCallback(async () => {
    try {
      // Cancel the stored notification ID
      const existingId = await AsyncStorage.getItem(REMINDER_NOTIFICATION_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem(REMINDER_NOTIFICATION_ID_KEY);
      }
      
      // Also cancel all scheduled notifications to prevent duplicates
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of allScheduled) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (error) {
      console.warn('Error canceling reminders:', error);
    }
  }, []);

  const handleSaveReminder = useCallback(async () => {
    if (!reminderTime) {
      Alert.alert(t('screens.settings.reminderTitle'), t('screens.pending.errorMissingFields'));
      return;
    }
    try {
      setSavingReminder(true);
      
      // Cancel all existing notifications first to prevent duplicates
      await cancelAllReminders();
      
      // Request permissions
      const permission = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      if (permission.status !== 'granted') {
        Alert.alert(
          t('screens.settings.reminderPermissionTitle'),
          t('screens.settings.reminderPermissionMessage'),
        );
        return;
      }

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6E1F7C',
          sound: 'default',
        });
      }

      // Create trigger for daily notification (repeats every day at the same time)
      const trigger: Notifications.CalendarTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: reminderTime.getHours(),
        minute: reminderTime.getMinutes(),
        repeats: true,
        ...(Platform.OS === 'android' && { channelId: 'default' }),
      };

      // Schedule the notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: t('screens.settings.reminderNotificationTitle'),
          body: t('screens.settings.reminderNotificationBody'),
          sound: true,
          ...(Platform.OS === 'android' && {
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
        },
        trigger,
      });
      
      // Store the notification ID and enabled state
      await AsyncStorage.multiSet([
        [REMINDER_TIME_KEY, reminderTime.toISOString()],
        [REMINDER_NOTIFICATION_ID_KEY, notificationId],
        [REMINDER_ENABLED_KEY, 'true'],
      ]);
      
      setReminderEnabled(true);
      Alert.alert(
        t('screens.settings.reminderSuccessTitle'),
        t('screens.settings.reminderSuccessMessage'),
      );
    } catch (error) {
      Alert.alert(t('screens.settings.reminderTitle'), (error as Error).message ?? t('screens.settings.saveError'));
    } finally {
      setSavingReminder(false);
    }
  }, [reminderTime, cancelAllReminders, t]);

  const handleToggleReminder = useCallback(async () => {
    if (reminderEnabled) {
      // Disable reminder
      await cancelAllReminders();
      setReminderEnabled(false);
      await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
      Alert.alert(
        t('screens.settings.reminderTitle'),
        t('screens.settings.reminderDisabledMessage'),
      );
    } else {
      // Enable reminder - need to have a time set first
      if (!reminderTime) {
        Alert.alert(
          t('screens.settings.reminderTitle'),
          t('screens.settings.reminderNeedTimeMessage'),
        );
        return;
      }
      await handleSaveReminder();
    }
  }, [reminderEnabled, reminderTime, cancelAllReminders, handleSaveReminder, t]);

  return (
    <AppScreen titleKey="tabs.settings">
      <View style={[styles.section, styles.profileCard, { backgroundColor: palette.surface }]}>
        <Text style={[styles.sectionTitle, { color: palette.textOnSurface }]}>{t('screens.settings.profileTitle')}</Text>
        <Image
          source={avatarUrl ? { uri: avatarUrl } : require('@/assets/images/icon.png')}
          style={styles.avatar}
        />
        <Pressable
          style={[
            styles.secondaryButton,
            { borderColor: palette.primary, alignSelf: 'center', paddingHorizontal: 24 },
          ]}
          onPress={handleChangeAvatar}
        >
          {savingAvatar ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <Text style={[styles.secondaryButtonLabel, { color: palette.primary }]}>
              {t('screens.settings.avatarChange')}
            </Text>
          )}
        </Pressable>

        <View style={styles.editRow}>
          <Text style={[styles.label, { color: palette.inputPlaceholder }]}>{t('screens.settings.nameLabel')}</Text>
          <View style={styles.inlineForm}>
            <TextInput
              style={[styles.input, styles.inlineInput, { borderColor: palette.border, color: palette.textOnSurface }]}
              value={profileName}
              onChangeText={setProfileName}
            />
            <Pressable
              style={[styles.primaryButton, styles.inlineButton, { backgroundColor: palette.primary }]}
              onPress={handleSaveName}
              disabled={savingName}
            >
              <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                {savingName ? '…' : t('screens.settings.saveChanges')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.editRow}>
          <Text style={[styles.label, { color: palette.inputPlaceholder }]}>{t('screens.settings.emailLabel')}</Text>
          <View style={styles.inlineForm}>
            <TextInput
              style={[styles.input, styles.inlineInput, { borderColor: palette.border, color: palette.textOnSurface }]}
              keyboardType='email-address'
              autoCapitalize='none'
              value={profileEmail}
              onChangeText={setProfileEmail}
            />
            <Pressable
              style={[styles.primaryButton, styles.inlineButton, { backgroundColor: palette.primary }]}
              onPress={handleSaveEmail}
              disabled={savingEmail}
            >
              <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                {savingEmail ? '…' : t('screens.settings.saveChanges')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.editRow}>
          <Text style={[styles.label, { color: palette.inputPlaceholder }]}>{t('screens.settings.genderLabel')}</Text>
          <View style={styles.inlineForm}>
            <View style={[styles.pickerWrapper, styles.inlineInput, { borderColor: palette.border }, ]}>
              <Picker
                selectedValue={gender}
                onValueChange={(value) => setGender(value as GenderOption)}
                style={{ color: palette.textOnSurface }}
                itemStyle={{ color: palette.textOnSurface }}>
                {genderOptions.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} color={palette.textOnSurface} />
                ))}
              </Picker>
            </View>
            <Pressable
              style={[styles.primaryButton, styles.inlineButton, { backgroundColor: palette.primary }]}
              onPress={handleSaveGender}
              disabled={savingGender}
            >
              <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                {savingGender ? '…' : t('screens.settings.saveChanges')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          {t('screens.settings.themeSectionTitle')}
        </Text>
        <View style={styles.themeToggle}>
          <Text style={[styles.body, { color: palette.inputPlaceholder }]}>
            {colorScheme === 'dark'
              ? t('screens.settings.themeModeDark')
              : t('screens.settings.themeModeLight')}
          </Text>
          <Pressable
            onPress={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
            style={[
              styles.toggleButton,
              {
                backgroundColor: palette.primary,
              },
            ]}>
            <Text style={[styles.toggleLabel, { color: palette.buttonText }]}>
              {colorScheme === 'dark'
                ? t('screens.settings.switchToLight')
                : t('screens.settings.switchToDark')}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          {t('screens.settings.presetsTitle')}
        </Text>
        <View style={styles.grid}>
          {palettePresets.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => handleApplyPreset(preset.id)}
              style={[
                styles.presetButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}>
              <View
                style={[
                  styles.colorPreview,
                  {
                    backgroundColor: preset.light.background,
                  },
                ]}
              />
              <Text style={[styles.presetLabel, { color: palette.textPrimary }]}>
                {t(preset.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={handleReset}
          style={[
            styles.resetButton,
            {
              borderColor: palette.border,
            },
          ]}>
          <Text style={[styles.resetLabel, { color: palette.inputPlaceholder }]}>
            {t('screens.settings.reset')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.section, styles.profileCard, { backgroundColor: palette.surface }]}>
        <View style={styles.reminderHeader}>
          <Text style={[styles.sectionTitle, { color: palette.textOnSurface }]}>{t('screens.settings.reminderTitle')}</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={handleToggleReminder}
            trackColor={{ false: palette.border, true: palette.primary }}
            thumbColor={reminderEnabled ? palette.buttonText : palette.inputPlaceholder}
            ios_backgroundColor={palette.border}
            disabled={savingReminder}
          />
        </View>
        <Text style={[styles.body, { color: palette.inputPlaceholder }]}>{t('screens.settings.reminderDescription')}</Text>
        <View style={[styles.reminderRow, { borderColor: palette.border }]}>
          <Text style={{ color: palette.textOnSurface }}>{formattedReminderTime}</Text>
          <Pressable
            style={[styles.secondaryButton, { borderColor: palette.primary }]}
            onPress={() => {
              setTempReminderTime(reminderTime ?? new Date());
              setShowTimePicker(true);
            }}
          >
            <Text style={[styles.secondaryButtonLabel, { color: palette.primary }]}>
              {t('screens.settings.reminderSelect')}
            </Text>
          </Pressable>
        </View>
        {reminderTime && !reminderEnabled && (
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
            ]}
            onPress={handleSaveReminder}
            disabled={savingReminder}
          >
            {savingReminder ? (
              <ActivityIndicator color={palette.buttonText} />
            ) : (
              <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                {t('screens.settings.reminderActivate')}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {showTimePicker && (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: palette.surface }]}>
            <DateTimePicker
              value={tempReminderTime}
              mode='time'
              display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
              onChange={(_, date) => date && setTempReminderTime(date)}
              textColor={palette.textOnSurface}
              themeVariant={colorScheme}
            />
            <View style={styles.pickerButtons}>
              <Pressable
                style={[styles.secondaryButton, styles.pickerButton]}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={[styles.secondaryButtonLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.financialHealth.cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.pickerButton, { backgroundColor: palette.primary }]}
                onPress={async () => {
                  setReminderTime(tempReminderTime);
                  setShowTimePicker(false);
                  // If reminder is enabled, automatically reschedule with new time
                  if (reminderEnabled) {
                    await handleSaveReminder();
                  }
                }}
              >
                <Text style={[styles.primaryButtonLabel, { color: palette.buttonText }]}>
                  {t('screens.settings.reminderSelect')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    marginBottom: 16,
  },
  profileCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '600',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetButton: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  colorPreview: {
    height: 60,
    borderRadius: 8,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  resetButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  resetLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
  },
  editRow: {
    gap: 6,
  },
  inlineForm: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  inlineInput: {
    flex: 1,
  },
  inlineButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reminderRow: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    borderWidth: 1.5,
    borderRadius: 20,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    alignItems: 'center',
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
    flex: 0,
  },
});

