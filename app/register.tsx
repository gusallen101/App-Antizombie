import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { LanguageSwitcher } from '@/components/language-switcher';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type GenderOption = 'h' | 'm' | 'o';

export default function RegisterScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<GenderOption>('h');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [tempGender, setTempGender] = useState<GenderOption>('h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toStringOrEmpty = (value: unknown) => {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  const validateEmail = (emailValue: string): boolean => {
    const regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    return regex.test(emailValue);
  };

  const checkPasswordValidity = (inputPassword: string): boolean => {
    const decimal = /^(?!.* )([A-z0-9!@#$%^&*().,<>{}[\]<>?_=+\-|;:\'\"\/]).{3,25}$/;
    return inputPassword.match(decimal) !== null;
  };

  const checkNameValidity = (userName: string): boolean => {
    const validPattern = /^[a-zA-Z-.'\ ]{2,30}$/;
    return userName.match(validPattern) !== null;
  };

  const handleRegister = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validaciones
      if (!checkNameValidity(fullName.trim())) {
        throw new Error(t('register.validationName'));
      }

      if (!validateEmail(email.trim())) {
        throw new Error(t('register.validationEmail'));
      }

      if (!fullName.trim() || !email.trim() || !password.trim()) {
        throw new Error(t('register.validationRequired'));
      }

      if (!checkPasswordValidity(password)) {
        throw new Error(t('register.validationPassword'));
      }

      if (password !== confirmPassword) {
        throw new Error(t('register.validationPasswordMatch'));
      }

      // Registrar usuario
      const response = await fetch(`${API_CONFIG.baseUrl}registrar`, {
        method: 'POST',
        headers: {
          nombre: fullName.trim(),
          correo: email.trim(),
          password,
          sexo: gender,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.message ?? payload?.error ?? t('register.error') ?? 'There was a problem registering.';
        throw new Error(message);
      }

      const data = (await response.json()) as { status: string; message?: string };

      if (data.status !== 'success') {
        throw new Error(data.message ?? t('register.error'));
      }

      // Login automático después del registro
      const loginResponse = await fetch(`${API_CONFIG.baseUrl}login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          correo: email.trim(),
          password,
        },
      });

      if (!loginResponse.ok) {
        throw new Error(t('register.loginAfterError'));
      }

      const loginData = (await loginResponse.json()) as Array<{
        apikey: string;
        correo: string;
        nombre: string;
        avatar: string;
        user_id: string;
      }>;

      const user = loginData?.[0];

      if (!user) {
        throw new Error(t('register.loginAfterError'));
      }

      // Guardar sesión
      await Promise.all([
        AsyncStorage.setItem('@auth:isAuthenticated', 'true'),
        AsyncStorage.setItem('@auth:apikey', toStringOrEmpty(user.apikey)),
        AsyncStorage.setItem('@auth:email', toStringOrEmpty(user.correo)),
        AsyncStorage.setItem('@auth:name', toStringOrEmpty(user.nombre)),
        AsyncStorage.setItem('@auth:avatar', toStringOrEmpty(user.avatar)),
        AsyncStorage.setItem('@auth:userId', toStringOrEmpty(user.user_id)),
        AsyncStorage.setItem('personal_closed_lists', '[]'),
        AsyncStorage.setItem('shared_closed_lists', '[]'),
        AsyncStorage.setItem('now-is', '[]'),
      ]);

      // Mostrar mensaje de éxito visual
      setSuccess(true);
      setLoading(false);

      // Navegar automáticamente después de un breve delay para asegurar que todo se guardó
      // Esto evita problemas con Alert.alert en Android (especialmente Xiaomi/HyperOS)
      setTimeout(() => {
        try {
          router.replace('/(tabs)/home');
        } catch (navigationError) {
          console.error('Navigation error after registration:', navigationError);
          // Fallback: intentar navegar de nuevo después de otro breve delay
          setTimeout(() => {
            router.replace('/(tabs)/home');
          }, 500);
        }
      }, 1500);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : t('register.errorFallback');
      setError(message);
      setSuccess(false);
      console.error('Registration error:', caughtError);
    } finally {
      // No cambiar loading aquí si fue exitoso, ya que se maneja arriba
      if (!success) {
        setLoading(false);
      }
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.languageContainer}>
          <LanguageSwitcher />
        </View>
        <View style={styles.heroContainer}>
          <Text
            style={[
              styles.title,
              {
                color: palette.textPrimary,
              },
            ]}>
            {t('register.title')}
          </Text>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.avatar}
            resizeMode="contain"
          />
        </View>

        <View style={styles.form}>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: palette.inputBackground,
                borderColor: palette.inputBorder,
              },
            ]}>
            <Ionicons
              name="person-outline"
              size={20}
              color={palette.inputPlaceholder}
              style={styles.inputIcon}
            />
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('register.fullNamePlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[
                styles.input,
                {
                  color: palette.inputText,
                },
              ]}
              autoCapitalize="words"
              textContentType="name"
            />
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: palette.inputBackground,
                borderColor: palette.inputBorder,
              },
            ]}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={palette.inputPlaceholder}
              style={styles.inputIcon}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('register.emailPlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[
                styles.input,
                {
                  color: palette.inputText,
                },
              ]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: palette.inputBackground,
                borderColor: palette.inputBorder,
              },
            ]}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={palette.inputPlaceholder}
              style={styles.inputIcon}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('register.passwordPlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[
                styles.input,
                {
                  color: palette.inputText,
                },
              ]}
              secureTextEntry
              textContentType="password"
            />
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: palette.inputBackground,
                borderColor: palette.inputBorder,
              },
            ]}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={palette.inputPlaceholder}
              style={styles.inputIcon}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('register.confirmPasswordPlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[
                styles.input,
                {
                  color: palette.inputText,
                },
              ]}
              secureTextEntry
              textContentType="password"
            />
          </View>

          <TouchableOpacity
            onPress={() => {
              setTempGender(gender);
              setShowGenderPicker(true);
            }}
            style={[
              styles.inputContainer,
              {
                backgroundColor: palette.inputBackground,
                borderColor: palette.inputBorder,
              },
            ]}>
            <Ionicons
              name="person-outline"
              size={20}
              color={palette.inputPlaceholder}
              style={styles.inputIcon}
            />
            <View style={styles.pickerTextContainer}>
              <Text
                style={[
                  styles.pickerText,
                  {
                    color: palette.inputText,
                  },
                ]}>
                {t(`register.genderOptions.${gender}`)}
              </Text>
            </View>
            <Ionicons
              name="chevron-down-outline"
              size={20}
              color={palette.inputPlaceholder}
            />
          </TouchableOpacity>

          <Modal
            visible={showGenderPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowGenderPicker(false)}>
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowGenderPicker(false)}>
              <Pressable
                style={[styles.modalContent, { backgroundColor: palette.surface }]}
                onPress={(e) => e.stopPropagation()}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: palette.textPrimary,
                    },
                  ]}>
                  {t('register.selectGender')}
                </Text>
                <View
                  style={[
                    styles.pickerWrapper,
                    {
                      backgroundColor: palette.background,
                      borderColor: palette.border,
                    },
                  ]}>
                  <Picker
                    selectedValue={tempGender}
                    onValueChange={(value) => setTempGender(value as GenderOption)}
                    style={{ color: palette.textPrimary }}
                    itemStyle={{ color: palette.textPrimary }}>
                    <Picker.Item label={t('register.genderOptions.h')} value="h" color={palette.textPrimary} />
                    <Picker.Item label={t('register.genderOptions.m')} value="m" color={palette.textPrimary} />
                    <Picker.Item label={t('register.genderOptions.o')} value="o" color={palette.textPrimary} />
                  </Picker>
                </View>
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.modalButtonSecondary,
                      { borderColor: palette.border },
                    ]}
                    onPress={() => setShowGenderPicker(false)}>
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: palette.textSecondary },
                      ]}>
                      {t('common.cancel')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.modalButtonPrimary,
                      { backgroundColor: palette.primary },
                    ]}
                    onPress={() => {
                      setGender(tempGender);
                      setShowGenderPicker(false);
                    }}>
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: palette.buttonText },
                      ]}>
                      {t('common.ok')}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            style={[
              styles.button,
              {
                backgroundColor: palette.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}>
            <Text
              style={[
                styles.buttonLabel,
                {
                  color: palette.buttonText,
                },
              ]}>
              {loading ? t('register.registering') : t('register.registerButton')}
            </Text>
            {loading && <ActivityIndicator size="small" color={palette.buttonText} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleGoToLogin}>
          <Text
            style={[
              styles.loginLink,
              {
                color: palette.textSecondary,
              },
            ]}>
            {t('register.alreadyHaveAccount')}
          </Text>
        </TouchableOpacity>

        {success && (
          <View
            style={[
              styles.successBanner,
              {
                backgroundColor: `${palette.primary}22`,
                borderColor: palette.primary,
              },
            ]}>
            <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
            <Text
              style={[
                styles.successText,
                {
                  color: palette.primary,
                },
              ]}>
              {t('register.successMessage')}
            </Text>
          </View>
        )}

        {error && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: `${palette.accent}22`,
                borderColor: palette.accent,
              },
            ]}>
            <Ionicons name="alert-circle" size={18} color={palette.accent} />
            <Text
              style={[
                styles.errorText,
                {
                  color: palette.accent,
                },
              ]}>
              {error}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 16,
    flexGrow: 1,
  },
  languageContainer: {
    alignItems: 'flex-end',
  },
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  avatar: {
    width: 140,
    height: 140,
  },
  form: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  pickerTextContainer: {
    flex: 1,
    justifyContent: 'center',
    height: 44,
  },
  pickerText: {
    fontSize: 16,
    includeFontPadding: false,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  pickerWrapper: {
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    maxHeight: 200,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {
    borderWidth: 1.5,
  },
  modalButtonPrimary: {},
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  loginLink: {
    textAlign: 'center',
    fontSize: 14,
  },
  successBanner: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});

