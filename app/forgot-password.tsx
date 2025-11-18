import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (loading) {
      return;
    }

    if (!email.trim()) {
      Alert.alert(t('auth.forgotPasswordTitle'), t('auth.emailRequired'));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t('auth.forgotPasswordTitle'), t('auth.invalidEmail'));
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('email_input', email.trim());

      const response = await fetch(`${API_CONFIG.baseUrl}recuperar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.message ??
          payload?.error ??
          `Server returned ${response.status}: ${response.statusText}`;
        throw new Error(message);
      }

      // Check if response has success status
      const data = await response.json().catch(() => null);
      if (data && data.status === 'success') {
        setSuccess(true);
      } else if (data && data.status === 'error') {
        throw new Error(data.message ?? t('auth.forgotPasswordError'));
      } else {
        setSuccess(true);
      }
    } catch (caughtError) {
      console.error('Forgot password error:', caughtError);
      let message: string;
      
      if (caughtError instanceof Error) {
        message = caughtError.message;
        // If it's a network error, provide a more user-friendly message
        if (caughtError.message.includes('Network') || caughtError.message.includes('fetch')) {
          message = t('auth.networkError') ?? 'Network error. Please check your connection.';
        }
      } else {
        message = t('auth.forgotPasswordErrorFallback');
      }
      
      Alert.alert(t('auth.forgotPasswordTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  if (success) {
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
            <View
              style={[
                styles.successIconContainer,
                {
                  backgroundColor: `${palette.primary}22`,
                },
              ]}>
              <Ionicons name="checkmark-circle" size={64} color={palette.primary} />
            </View>
            <Text
              style={[
                styles.title,
                {
                  color: palette.textPrimary,
                },
              ]}>
              {t('auth.forgotPasswordSuccessTitle')}
            </Text>
            <Text
              style={[
                styles.description,
                {
                  color: palette.textSecondary,
                },
              ]}>
              {t('auth.forgotPasswordSuccessMessage', { email: email.trim() })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleBackToLogin}
            style={[
              styles.button,
              {
                backgroundColor: palette.primary,
              },
            ]}>
            <Text
              style={[
                styles.buttonLabel,
                {
                  color: palette.buttonText,
                },
              ]}>
              {t('auth.backToLogin')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
            {t('auth.forgotPasswordTitle')}
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
          {t('auth.forgotPasswordDescription')}
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
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            onPress={handleResetPassword}
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
              {loading ? t('auth.sending') : t('auth.sendResetLink')}
            </Text>
            {loading && <ActivityIndicator size="small" color={palette.buttonText} />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBackToLogin}
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
              {t('auth.backToLogin')}
            </Text>
          </TouchableOpacity>
        </View>
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
    textAlign: 'center',
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
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
});

