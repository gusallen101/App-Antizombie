import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

export default function LoginScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const { t } = useLocalization();
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
        const message =
          payload?.message ??
          payload?.error ??
          t('auth.loginError') ??
          'There was a problem signing in.';
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

      // TODO: replace with secure storage/session handling as needed.
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
      const message =
        caughtError instanceof Error ? caughtError.message : t('auth.loginErrorFallback');
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
            {t('login.welcome')}
          </Text>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.avatar}
            resizeMode="contain"
          />
        </View>
        <Text
          style={[
            styles.description,
            {
              color: palette.textSecondary,
            },
          ]}>
          {t('login.description')}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: palette.textSecondary,
            },
          ]}>
          {t('login.subtitle')}
        </Text>

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
              name="mail-outline"
              size={20}
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

          <TouchableOpacity
            onPress={handleLogin}
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
              {loading ? t('auth.loggingIn') : t('common.login')}
            </Text>
            {loading && <ActivityIndicator size="small" color={palette.buttonText} />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRegister}
            style={[
              styles.button,
              {
                backgroundColor: palette.secondary,
              },
            ]}>
            <Text
              style={[
                styles.buttonLabel,
                {
                  color: palette.buttonText,
                },
              ]}>
              {t('common.register')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('forgot-password' as any)}>
          <Text
            style={[
              styles.forgotPassword,
              {
                color: palette.textSecondary,
              },
            ]}>
            {t('common.forgotPassword')}
          </Text>
        </TouchableOpacity>

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
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
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
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  forgotPassword: {
    textAlign: 'center',
    fontSize: 14,
    textDecorationLine: 'underline',
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

