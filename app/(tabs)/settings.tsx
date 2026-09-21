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
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { type Palette } from '@/constants/theme';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type PaletteOverride = Partial<Palette>;
type GenderOption = 'h' | 'm';
const REMINDER_TIME_KEY = '@settings:reminderTime';
const REMINDER_NOTIFICATION_ID_KEY = '@settings:reminderNotificationId';
const REMINDER_ENABLED_KEY = '@settings:reminderEnabled';
const CHECK_TIME_KEY = '@settings:checkTime';

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
  const [checkTime, setCheckTime] = useState<Date | null>(null);
  const [isSelectingCheckTime, setIsSelectingCheckTime] = useState(false);

  const genderOptions: Array<{ value: GenderOption; label: string }> = useMemo(
    () => [
      { value: 'h', label: t('screens.settings.genderOptions.h') },
      { value: 'm', label: t('screens.settings.genderOptions.m') },
    ],
    [t],
  );

  const formattedReminderTime = useMemo(() => {
    if (!reminderTime) {
      return t('screens.settings.reminderPlaceholder');
    }
    return reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [reminderTime, t]);
  
  const formattedCheckTime = useMemo(() => {
    if (!checkTime) {
      return t('screens.settings.checkReminderPlaceholder');
    }
    return checkTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [checkTime, t]);

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
      const [[, storedName], [, storedEmail], [, storedAvatar], [, storedReminder], [, storedEnabled], [, storedCheckTime]] = await AsyncStorage.multiGet([
        '@auth:name',
        '@auth:email',
        '@auth:avatar',
        REMINDER_TIME_KEY,
        REMINDER_ENABLED_KEY,
        CHECK_TIME_KEY,
      ]);
      setProfileName(storedName ?? '');
      setProfileEmail(storedEmail ?? '');
      setAvatarUrl(buildAvatarUrl(storedAvatar));
      if (storedReminder) {
        setReminderTime(new Date(storedReminder));
      }
      if (storedCheckTime) {
        setCheckTime(new Date(storedCheckTime));
      }
      if (storedEnabled === 'true') {
        setReminderEnabled(true);
        const storedNotificationId = await AsyncStorage.getItem(REMINDER_NOTIFICATION_ID_KEY);
        if (storedNotificationId) {
          const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
          const notificationExists = allScheduled.some((n) => n.identifier === storedNotificationId);
          if (!notificationExists) {
            setReminderEnabled(false);
            await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
          }
        } else {
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
          setGender(data.sexo === 'm' ? 'm' : 'h');
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
      const existingId = await AsyncStorage.getItem(REMINDER_NOTIFICATION_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem(REMINDER_NOTIFICATION_ID_KEY);
      }
      
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of allScheduled) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (error) {
      console.warn('Error canceling reminders:', error);
    }
  }, []);

  const handleSaveReminder = useCallback(async (newReminderTime?: Date, newCheckTime?: Date) => {
    const effectiveReminderTime = newReminderTime ?? reminderTime;
    const effectiveCheckTime = newCheckTime ?? checkTime;

    if (!effectiveReminderTime) {
      Alert.alert(t('screens.settings.reminderTitle'), t('screens.pending.errorMissingFields'));
      return;
    }
    try {
      setSavingReminder(true);
      
      await cancelAllReminders();
      
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

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6E1F7C',
          sound: 'default',
        });
      }

      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: effectiveReminderTime.getHours(),
        minute: effectiveReminderTime.getMinutes(),
        channelId: 'default',
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: t('screens.settings.reminderNotificationTitle'),
          body: t('screens.settings.reminderNotificationBody'),
          sound: true,
        },
        trigger,
      });

      if (effectiveCheckTime) {
        const checkTrigger: Notifications.NotificationTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: effectiveCheckTime.getHours(),
          minute: effectiveCheckTime.getMinutes(),
          channelId: 'default',
        };

        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('screens.settings.reminderCheckTitle'),
            body: t('screens.settings.reminderCheckBody'),
            sound: true,
          },
          trigger: checkTrigger,
        });
      }

      const storageItems: [string, string][] = [
        [REMINDER_TIME_KEY, effectiveReminderTime.toISOString()],
        [REMINDER_NOTIFICATION_ID_KEY, notificationId],
        [REMINDER_ENABLED_KEY, 'true'],
      ];

      if (effectiveCheckTime) {
        storageItems.push([CHECK_TIME_KEY, effectiveCheckTime.toISOString()]);
      }

      await AsyncStorage.multiSet(storageItems);
      
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
  }, [reminderTime, checkTime, cancelAllReminders, t]);

  const handleToggleReminder = useCallback(async () => {
    if (reminderEnabled) {
      await cancelAllReminders();
      setReminderEnabled(false);
      await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
      Alert.alert(
        t('screens.settings.reminderTitle'),
        t('screens.settings.reminderDisabledMessage'),
      );
    } else {
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
    <>
      <AppScreen titleKey="tabs.settings" contentContainerStyle={styles.screenContent}>
        
        {/* --- SECCIÓN AVATAR --- */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : require('@/assets/images/icon.png')}
              style={[styles.avatar, { borderColor: palette.surface }]}
            />
            <Pressable
              style={[styles.avatarEditBadge, { backgroundColor: palette.primary, borderColor: palette.background }]}
              onPress={handleChangeAvatar}
            >
              {savingAvatar ? (
                <ActivityIndicator size="small" color={palette.buttonText} />
              ) : (
                <Ionicons name="camera" size={20} color={palette.buttonText} />
              )}
            </Pressable>
          </View>
        </View>

        {/* --- SECCIÓN PERFIL --- */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitleOutside, { color: palette.inputPlaceholder }]}>
            {t('screens.settings.profileTitle')}
          </Text>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            
            {/* Nombre */}
            <View style={styles.cardRow}>
              <View style={styles.cardRowIcon}>
                <Ionicons name="person-outline" size={22} color={colorScheme === 'light' ? '#000000' : palette.textSecondary} />
              </View>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowLabel, { color: palette.inputPlaceholder }]}>{t('screens.settings.nameLabel')}</Text>
                <TextInput
                  style={[styles.cardRowInput, { color: palette.textOnSurface }]}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholderTextColor={palette.inputPlaceholder}
                />
              </View>
              <Pressable
                style={[styles.savePill, { backgroundColor: palette.primary + '15' }]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Text style={[styles.savePillText, { color: palette.primary }]}>{t('screens.settings.saveChanges')}</Text>
                )}
              </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            {/* Email */}
            <View style={styles.cardRow}>
              <View style={styles.cardRowIcon}>
                <Ionicons name="mail-outline" size={22} color={colorScheme === 'light' ? '#000000' : palette.textSecondary} />
              </View>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowLabel, { color: palette.inputPlaceholder }]}>{t('screens.settings.emailLabel')}</Text>
                <TextInput
                  style={[styles.cardRowInput, { color: palette.textOnSurface }]}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  value={profileEmail}
                  onChangeText={setProfileEmail}
                  placeholderTextColor={palette.inputPlaceholder}
                />
              </View>
              <Pressable
                style={[styles.savePill, { backgroundColor: palette.primary + '15' }]}
                onPress={handleSaveEmail}
                disabled={savingEmail}
              >
                {savingEmail ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Text style={[styles.savePillText, { color: palette.primary }]}>{t('screens.settings.saveChanges')}</Text>
                )}
              </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            {/* Género */}
            <View style={styles.cardRow}>
              <View style={styles.cardRowIcon}>
                <Ionicons name="male-female-outline" size={22} color={colorScheme === 'light' ? '#000000' : palette.textSecondary} />
              </View>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowLabel, { color: palette.inputPlaceholder }]}>{t('screens.settings.genderLabel')}</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={gender}
                    onValueChange={(value) => setGender(value as GenderOption)}
                    style={{ color: palette.textOnSurface, margin: -10 }}
                    itemStyle={{ color: palette.textOnSurface, fontSize: 16 }}>
                    {genderOptions.map((option) => (
                      <Picker.Item key={option.value} label={option.label} value={option.value} color={palette.textOnSurface} />
                    ))}
                  </Picker>
                </View>
              </View>
              <Pressable
                style={[styles.savePill, { backgroundColor: palette.primary + '15' }]}
                onPress={handleSaveGender}
                disabled={savingGender}
              >
                {savingGender ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Text style={[styles.savePillText, { color: palette.primary }]}>{t('screens.settings.saveChanges')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* --- SECCIÓN APARIENCIA --- */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitleOutside, { color: palette.inputPlaceholder }]}>
            {t('screens.settings.themeSectionTitle')}
          </Text>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            
            {/* Modo Oscuro/Claro */}
            <View style={styles.cardRow}>
              <View style={styles.cardRowIcon}>
                <Ionicons name={colorScheme === 'dark' ? 'moon-outline' : 'sunny-outline'} size={22} color={colorScheme === 'light' ? '#000000' : palette.textSecondary} />
              </View>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowValue, { color: palette.textOnSurface }]}>
                  {colorScheme === 'dark' ? t('screens.settings.themeModeDark') : t('screens.settings.themeModeLight')}
                </Text>
              </View>
              <Switch
                value={colorScheme === 'dark'}
                onValueChange={(value) => setColorScheme(value ? 'dark' : 'light')}
                trackColor={{ 
                  false: colorScheme === 'light' ? '#D1D5DB' : palette.border, 
                  true: palette.primary 
                }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (colorScheme === 'dark' ? palette.buttonText : '#F3F4F6')}
                ios_backgroundColor={colorScheme === 'light' ? '#D1D5DB' : palette.border}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            {/* Paletas de Color */}
            <View style={[styles.cardRow, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 16 }]}>
              <Text style={[styles.cardRowLabel, { color: palette.inputPlaceholder, marginBottom: 12 }]}>
                {t('screens.settings.presetsTitle')}
              </Text>
              <View style={styles.presetsGrid}>
                {palettePresets.map((preset) => (
                  <Pressable
                    key={preset.id}
                    onPress={() => handleApplyPreset(preset.id)}
                    style={[styles.presetItem, { backgroundColor: palette.background, borderColor: palette.border }]}
                  >
                    <View style={[styles.presetColorCircle, { backgroundColor: preset.light.background }]} />
                    <Text style={[styles.presetItemText, { color: palette.textOnSurface }]} numberOfLines={1}>
                      {t(preset.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={handleReset}
                style={[styles.resetButton, { backgroundColor: palette.border + '50' }]}
              >
                <Ionicons name="refresh-outline" size={16} color={colorScheme === 'light' ? '#000000' : palette.textOnSurface} />
                <Text style={[styles.resetButtonText, { color: palette.textOnSurface }]}>
                  {t('screens.settings.reset')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* --- SECCIÓN RECORDATORIOS --- */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitleOutside, { color: palette.inputPlaceholder }]}>
            {t('screens.settings.reminderTitle')}
          </Text>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            
            {/* Activar Recordatorios */}
            <View style={styles.cardRow}>
              <View style={styles.cardRowIcon}>
                <Ionicons name="notifications-outline" size={22} color={colorScheme === 'light' ? '#000000' : palette.textSecondary} />
              </View>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowValue, { color: palette.textOnSurface }]}>
                  {t('screens.settings.reminderTitle')}
                </Text>
                <Text style={[styles.cardRowSubtitle, { color: palette.inputPlaceholder }]}>
                  {t('screens.settings.reminderDescription')}
                </Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={handleToggleReminder}
                trackColor={{ 
                  false: colorScheme === 'light' ? '#D1D5DB' : palette.border, 
                  true: palette.primary 
                }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (reminderEnabled ? palette.buttonText : '#F3F4F6')}
                ios_backgroundColor={colorScheme === 'light' ? '#D1D5DB' : palette.border}
                disabled={savingReminder}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            {/* Hora Recordatorio */}
            <View style={styles.cardRow}>
              <View style={styles.cardRowIcon}>
                <Ionicons name="time-outline" size={22} color={colorScheme === 'light' ? '#000000' : palette.textSecondary} />
              </View>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowValue, { color: palette.textOnSurface }]}>
                  {formattedReminderTime}
                </Text>
                <Text style={[styles.cardRowLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.settings.reminderSelect')}
                </Text>
              </View>
              <Pressable
                style={[styles.iconButton, { backgroundColor: palette.primary + '15' }]}
                onPress={() => {
                  setTempReminderTime(reminderTime ?? new Date());
                  setIsSelectingCheckTime(false);
                  setShowTimePicker(true);
                }}
              >
                <Ionicons name="pencil" size={18} color={palette.primary} />
              </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            {/* Hora de Chequeo */}
            <View style={styles.cardRow}>
              <View style={styles.cardRowIcon}>
                <Ionicons name="alarm-outline" size={22} color={colorScheme === 'light' ? '#000000' : palette.textSecondary} />
              </View>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowValue, { color: palette.textOnSurface }]}>
                  {formattedCheckTime}
                </Text>
                <Text style={[styles.cardRowLabel, { color: palette.inputPlaceholder }]}>
                  {t('screens.settings.checkReminderSelect')}
                </Text>
              </View>
              <Pressable
                style={[styles.iconButton, { backgroundColor: palette.primary + '15' }]}
                onPress={() => {
                  setTempReminderTime(checkTime ?? new Date());
                  setIsSelectingCheckTime(true);
                  setShowTimePicker(true);
                }}
              >
                <Ionicons name="pencil" size={18} color={palette.primary} />
              </Pressable>
            </View>

            {/* Botón de Guardado extra si está inactivo */}
            {reminderTime && !reminderEnabled && (
              <Pressable
                style={[styles.activateButton, { backgroundColor: palette.primary }]}
                onPress={() => handleSaveReminder()}
                disabled={savingReminder}
              >
                {savingReminder ? (
                  <ActivityIndicator color={palette.buttonText} />
                ) : (
                  <Text style={[styles.activateButtonText, { color: palette.buttonText }]}>
                    {t('screens.settings.reminderActivate')}
                  </Text>
                )}
              </Pressable>
            )}

          </View>
        </View>

      </AppScreen>

      {/* --- MODALES NATIVOS DE TIEMPO --- */}
      {Platform.OS === 'ios' && showTimePicker && (
        <Modal
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowTimePicker(false)}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => {
              setIsSelectingCheckTime(false);
              setShowTimePicker(false);
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={[styles.pickerCard, { backgroundColor: palette.surface }]}>
                <DateTimePicker
                  value={tempReminderTime}
                  mode="time"
                  display="spinner"
                  onChange={(_, date) => date && setTempReminderTime(date)}
                  textColor={palette.textOnSurface}
                  themeVariant={colorScheme}
                />

                <View style={styles.pickerButtons}>
                  <Pressable
                    style={[styles.pickerCancelButton]}
                    onPress={() => {
                      setIsSelectingCheckTime(false);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerButtonText, { color: palette.inputPlaceholder }]}>
                      {t('screens.financialHealth.cancel')}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.pickerConfirmButton, { backgroundColor: palette.primary }]}
                    onPress={async () => {
                      if (isSelectingCheckTime) {
                        setCheckTime(tempReminderTime);
                        await AsyncStorage.setItem(CHECK_TIME_KEY, tempReminderTime.toISOString());
                        if (reminderEnabled) {
                          await handleSaveReminder(undefined, tempReminderTime);
                        }
                      } else {
                        setReminderTime(tempReminderTime);
                        await AsyncStorage.setItem(REMINDER_TIME_KEY, tempReminderTime.toISOString());
                        if (reminderEnabled) {
                          await handleSaveReminder(tempReminderTime);
                        }
                      }
                      setIsSelectingCheckTime(false);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerButtonText, { color: palette.buttonText, fontWeight: '700' }]}>
                      {t('common.ok')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={tempReminderTime}
          mode="time"
          display="spinner"
          onChange={(event, date) => {
            if (event.type !== 'set') {
              setIsSelectingCheckTime(false);
              setShowTimePicker(false);
              return;
            }

            if (!date) return;

            if (isSelectingCheckTime) {
              setCheckTime(date);
              void AsyncStorage.setItem(CHECK_TIME_KEY, date.toISOString());
              if (reminderEnabled) {
                void handleSaveReminder(undefined, date);
              }
            } else {
              setReminderTime(date);
              void AsyncStorage.setItem(REMINDER_TIME_KEY, date.toISOString());
              if (reminderEnabled) {
                void handleSaveReminder(date);
              }
            }

            setIsSelectingCheckTime(false);
            setShowTimePicker(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: Platform.OS === 'ios' ? 108 : 96,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  
  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections & Cards
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitleOutside: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginLeft: 16,
    marginBottom: 8,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 70,
  },
  cardRowIcon: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  cardRowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardRowValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardRowSubtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
    paddingRight: 16,
  },
  cardRowInput: {
    fontSize: 16,
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  divider: {
    height: 1,
    marginLeft: 52,
  },
  pickerContainer: {
    justifyContent: 'center',
    marginLeft: -16,
  },

  // Botones estilo Píldora e Íconos
  savePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 12,
  },
  savePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  // Grid Presets
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  presetItem: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  presetColorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  presetItemText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Botón largo final
  activateButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  activateButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Modales
  pickerOverlay: {
    flex: 1,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '90%',
    borderRadius: 28,
    padding: 20,
    gap: 16,
  },
  pickerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  pickerCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  pickerConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});