import { useCallback } from 'react';

import { getErrorTranslationKey, getSuccessTranslationKey } from '@/lib/api-messages';
import { useLocalization } from '@/providers/localization-provider';

/**
 * Hook para traducir mensajes de la API automáticamente
 * 
 * La API responde en inglés, y este hook traduce esos mensajes
 * al idioma actual de la app usando translations.ts
 * 
 * @example
 * ```tsx
 * const { translateError } = useApiMessages();
 * 
 * const response = await fetch('...');
 * const data = await response.json();
 * 
 * if (data.error) {
 *   // Traduce "Incorrect user or password." a "Usuario o contraseña incorrectos."
 *   const errorMessage = translateError(data.error);
 *   Alert.alert('Error', errorMessage);
 * }
 * ```
 */
export function useApiMessages() {
  const { t } = useLocalization();

  /**
   * Traduce un mensaje de error de la API al idioma actual
   * @param apiMessage - Mensaje en inglés que viene de la API
   * @param fallback - Mensaje de fallback si no se encuentra traducción (opcional)
   * @returns El mensaje traducido al idioma actual
   */
  const translateError = useCallback(
    (apiMessage: string, fallback?: string): string => {
      if (!apiMessage) {
        return fallback || apiMessage || '';
      }

      // Buscar la translation key correspondiente
      const translationKey = getErrorTranslationKey(apiMessage);

      if (translationKey) {
        // Si encontramos la key, traducir usando el sistema de traducciones
        return t(translationKey);
      }

      // Si no hay traducción, usar el fallback o el mensaje original
      return fallback || apiMessage;
    },
    [t],
  );

  /**
   * Traduce un mensaje de éxito de la API al idioma actual
   * @param apiMessage - Mensaje en inglés que viene de la API
   * @param fallback - Mensaje de fallback si no se encuentra traducción (opcional)
   * @returns El mensaje traducido al idioma actual
   */
  const translateSuccess = useCallback(
    (apiMessage: string, fallback?: string): string => {
      if (!apiMessage) {
        return fallback || apiMessage || '';
      }

      const translationKey = getSuccessTranslationKey(apiMessage);

      if (translationKey) {
        return t(translationKey);
      }

      return fallback || apiMessage;
    },
    [t],
  );

  return {
    translateError,
    translateSuccess,
  };
}

