import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { useApiMessages } from '@/hooks/use-api-messages';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

// Se eliminó la opción 'o'
type GenderOption = 'h' | 'm';

export default function RegisterScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const { translateError } = useApiMessages();
  
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
        const apiMessage = payload?.message ?? payload?.error;
        const message = translateError(apiMessage, t('register.error'));
        throw new Error(message);
      }

      const data = (await response.json()) as { status: string; message?: string };

      if (data.status !== 'success') {
        const errorMessage = translateError(data.message || '', t('register.error'));
        //throw new Error(errorMessage);
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

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        try {
          router.replace('/(tabs)/home');
        } catch (navigationError) {
          console.error('Navigation error after registration:', navigationError);
          setTimeout(() => {
            router.replace('/(tabs)/home');
          }, 500);
        }
      }, 1500);
    } catch (caughtError) {
      const message = caughtError instanceof Error 
        ? translateError(caughtError.message, t('register.errorFallback'))
        : t('register.errorFallback');
      setError(message);
      setSuccess(false);
      console.error('Registration error:', caughtError);
    } finally {
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
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Selector de idioma */}
        <View style={styles.languageContainer}>
          <LanguageSwitcher />
        </View>

        {/* Hero / Encabezado (Moderno alineado a la izquierda) */}
        <View style={styles.heroContainer}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            {t('register.title')}
          </Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          
          <View style={[styles.inputContainer, { backgroundColor: palette.inputBackground, borderColor: palette.border + '50' }]}>
            <Ionicons name="person-outline" size={22} color={palette.inputPlaceholder} style={styles.inputIcon} />
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('register.fullNamePlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[styles.input, { color: palette.inputText }]}
              autoCapitalize="words"
              textContentType="name"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: palette.inputBackground, borderColor: palette.border + '50' }]}>
            <Ionicons name="mail-outline" size={22} color={palette.inputPlaceholder} style={styles.inputIcon} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('register.emailPlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[styles.input, { color: palette.inputText }]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: palette.inputBackground, borderColor: palette.border + '50' }]}>
            <Ionicons name="lock-closed-outline" size={22} color={palette.inputPlaceholder} style={styles.inputIcon} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('register.passwordPlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[styles.input, { color: palette.inputText }]}
              secureTextEntry
              textContentType="password"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: palette.inputBackground, borderColor: palette.border + '50' }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color={palette.inputPlaceholder} style={styles.inputIcon} />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('register.confirmPasswordPlaceholder')}
              placeholderTextColor={palette.inputPlaceholder}
              style={[styles.input, { color: palette.inputText }]}
              secureTextEntry
              textContentType="password"
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setTempGender(gender);
              setShowGenderPicker(true);
            }}
            style={[styles.inputContainer, { backgroundColor: palette.inputBackground, borderColor: palette.border + '50' }]}>
            <Ionicons name="male-female-outline" size={22} color={palette.inputPlaceholder} style={styles.inputIcon} />
            <View style={styles.pickerTextContainer}>
              <Text style={[styles.pickerText, { color: palette.inputText }]}>
                {t(`register.genderOptions.${gender}`)}
              </Text>
            </View>
            <Ionicons name="chevron-down-outline" size={20} color={palette.inputPlaceholder} />
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
                <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
                  {t('register.selectGender')}
                </Text>
                <View style={[styles.pickerWrapper, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <Picker
                    selectedValue={tempGender}
                    onValueChange={(value) => setTempGender(value as GenderOption)}
                    style={{ color: palette.textPrimary, backgroundColor: palette.background }}
                    dropdownIconColor={palette.textPrimary}>
                    <Picker.Item label={t('register.genderOptions.h')} value="h" />
                    <Picker.Item label={t('register.genderOptions.m')} value="m" />
                  </Picker>
                </View>
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: palette.border }]}
                    onPress={() => setShowGenderPicker(false)}>
                    <Text style={[styles.modalButtonText, { color: palette.textSecondary }]}>
                      {t('common.cancel')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: palette.primary }]}
                    onPress={() => {
                      setGender(tempGender);
                      setShowGenderPicker(false);
                    }}>
                    <Text style={[styles.modalButtonText, { color: palette.buttonText }]}>
                      {t('common.ok')}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Botón Principal con efecto GLOW */}
          <View style={[styles.glowWrapper, { shadowColor: palette.primary, marginTop: 8 }]}>
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: loading ? 0.8 : 1 }]}>
              {loading ? (
                <ActivityIndicator size="small" color={palette.buttonText} />
              ) : (
                <Text style={[styles.buttonLabel, { color: palette.buttonText }]}>
                  {t('register.registerButton')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Link para volver a Login */}
          <TouchableOpacity onPress={handleGoToLogin} style={styles.loginLinkContainer}>
            <Text style={[styles.loginLink, { color: palette.textSecondary }]}>
              {t('register.alreadyHaveAccount')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Banners de Éxito / Error */}
        {success && (
          <View style={[styles.successBanner, { backgroundColor: `${palette.primary}15`, borderColor: palette.primary }]}>
            <Ionicons name="checkmark-circle" size={20} color={palette.primary} />
            <Text style={[styles.successText, { color: palette.primary }]}>
              {t('register.successMessage')}
            </Text>
          </View>
        )}

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: `${palette.accent}15`, borderColor: palette.accent }]}>
            <Ionicons name="alert-circle" size={20} color={palette.accent} />
            <Text style={[styles.errorText, { color: palette.accent }]}>
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
    paddingVertical: 40,
    paddingHorizontal: 28,
    gap: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  languageContainer: {
    alignItems: 'flex-end',
    marginBottom: -10,
  },
  
  // Encabezado
  heroContainer: {
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Formulario
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16, // Bordes más redondeados
    paddingHorizontal: 16,
    height: 58, // Más alto, estilo premium
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '500',
  },
  pickerTextContainer: {
    flex: 1,
    justifyContent: 'center',
    height: '100%',
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '500',
    includeFontPadding: false,
  },

  // Modal del Picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  pickerWrapper: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    maxHeight: 200,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {
    borderWidth: 1.5,
  },
  modalButtonPrimary: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Botones
  glowWrapper: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12, 
    borderRadius: 16,
  },
  primaryButton: {
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Link de Login
  loginLinkContainer: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Banners de Éxito / Error
  successBanner: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});