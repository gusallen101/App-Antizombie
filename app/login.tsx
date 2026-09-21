import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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

export default function LoginScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const { translateError } = useApiMessages();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const toStringOrEmpty = (value: unknown) => {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedAuth = await AsyncStorage.getItem('@auth:isAuthenticated');
        if (storedAuth === 'true') {
          setIsAuthenticated(true);
          router.replace('/(tabs)/home');
        }
      } catch (error) {
        console.warn('Failed to restore session', error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    void checkSession();
  }, [router]);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          correo: email.trim(),
          password,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const apiMessage = payload?.message ?? payload?.error;
        const message = translateError(apiMessage, t('auth.loginError'));
        throw new Error(message);
      }

      const data = (await response.json()) as Array<{
        apikey: string;
        correo: string;
        nombre: string;
        avatar: string;
        user_id: string;
      }>;

      const user = data?.[0];

      if (!user) {
        throw new Error(t('auth.loginError'));
      }

      await Promise.all([
        AsyncStorage.setItem('@auth:isAuthenticated', 'true'),
        AsyncStorage.setItem('@auth:apikey', toStringOrEmpty(user.apikey)),
        AsyncStorage.setItem('@auth:email', toStringOrEmpty(user.correo)),
        AsyncStorage.setItem('@auth:name', toStringOrEmpty(user.nombre)),
        AsyncStorage.setItem('@auth:avatar', toStringOrEmpty(user.avatar)),
        AsyncStorage.setItem('@auth:userId', toStringOrEmpty(user.user_id)),
      ]);

      router.replace('/(tabs)/home');
    } catch (caughtError) {
      const message = caughtError instanceof Error 
        ? translateError(caughtError.message, t('auth.loginErrorFallback'))
        : t('auth.loginErrorFallback');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  if (isCheckingSession || isAuthenticated) {
    return (
      <View
        style={[
          styles.loadingOverlay,
          {
            backgroundColor: palette.background,
          },
        ]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

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
        
        {/* Selector de idioma en la parte superior derecha */}
        <View style={styles.languageContainer}>
          <LanguageSwitcher />
        </View>

        {/* Sección del Encabezado (Moderno y alineado a la izquierda) */}
        <View style={styles.heroContainer}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            {t('login.welcome')}
          </Text>
          <Text style={[styles.description, { color: palette.textSecondary }]}>
            {t('login.description')}
          </Text>
          {t('login.subtitle') ? (
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
              {t('login.subtitle')}
            </Text>
          ) : null}
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: palette.inputBackground,
                borderColor: palette.border + '50', // Borde muy sutil
              },
            ]}>
            <Ionicons
              name="mail-outline"
              size={22}
              color={palette.inputPlaceholder}
              style={styles.inputIcon}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('common.emailPlaceholder')}
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
                borderColor: palette.border + '50',
              },
            ]}>
            <Ionicons
              name="lock-closed-outline"
              size={22}
              color={palette.inputPlaceholder}
              style={styles.inputIcon}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('common.passwordPlaceholder')}
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

          {/* Recuperar contraseña alineado a la derecha */}
          <TouchableOpacity onPress={() => router.push('forgot-password' as any)} style={styles.forgotPasswordContainer}>
            <Text
              style={[
                styles.forgotPassword,
                {
                  color: palette.primary,
                },
              ]}>
              {t('common.forgotPassword')}
            </Text>
          </TouchableOpacity>

          {/* Botón Principal de Login con efecto GLOW */}
          <View style={[styles.glowWrapper, { shadowColor: palette.primary }]}>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: palette.primary,
                  opacity: loading ? 0.8 : 1,
                },
              ]}>
              {loading ? (
                <ActivityIndicator size="small" color={palette.buttonText} />
              ) : (
                <Text
                  style={[
                    styles.buttonLabel,
                    {
                      color: palette.buttonText,
                    },
                  ]}>
                  {t('common.login')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Botón de Registro Secundario y Limpio */}
          <TouchableOpacity
            onPress={handleRegister}
            style={styles.secondaryButton}>
            <Text style={[styles.secondaryButtonText, { color: palette.textSecondary }]}>
              {t('common.register')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Banner de Errores */}
        {error && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: `${palette.accent}15`,
                borderColor: palette.accent,
              },
            ]}>
            <Ionicons name="alert-circle" size={20} color={palette.accent} />
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
    paddingVertical: 40,
    paddingHorizontal: 28,
    gap: 32,
    flexGrow: 1,
    justifyContent: 'center', // Centra el contenido verticalmente si hay espacio
  },
  languageContainer: {
    alignItems: 'flex-end',
    marginBottom: -10, // Acerca un poco el selector al título
  },
  
  // Hero / Encabezado
  heroContainer: {
    alignItems: 'flex-start', // Alineación moderna a la izquierda
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
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
    height: 58, // Más altos para una sensación premium
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

  // Olvidé mi contraseña
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 8,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Botones
  glowWrapper: {
    // Efecto de resplandor (Neon Glow)
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12, // Glow para Android
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
  secondaryButton: {
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Errores y Loading
  errorBanner: {
    marginTop: 16,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});