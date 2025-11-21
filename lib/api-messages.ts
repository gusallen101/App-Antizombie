/**
 * Mapeo de mensajes de la API (en inglés) a keys de translations
 * 
 * La API siempre responde en inglés, y aquí mapeamos esos mensajes
 * a las traducciones correspondientes en translations.ts
 */

/**
 * Mapeo de mensajes exactos de la API a translation keys
 */
export const API_ERROR_MAP: Record<string, string> = {
  // Mensajes reales de la API (exactamente como vienen)
  'Validate that name, email and password are correct.': 'api.errors.validateNameEmailPassword',
  'Incorrect email format.': 'api.errors.incorrectEmailFormat',
  'There was a problem processing your request. Please try again later.': 'api.errors.processingError',
  'Validate that the email and password are correct.': 'api.errors.validateEmailPassword',
  'Incorrect user or password.': 'api.errors.incorrectUserOrPassword',
  'Avatar data is empty.': 'api.errors.avatarDataEmpty',
  'Email is empty.': 'api.errors.emailEmpty',
  'Email is empty': 'api.errors.emailEmpty', // Variante sin punto
  'The user id and category id are in the table.': 'api.errors.userCategoryInTable',
  'Incorrect email or token.': 'api.errors.incorrectEmailOrToken',
};

/**
 * Mapeo de mensajes de éxito de la API a translation keys
 */
export const API_SUCCESS_MAP: Record<string, string> = {
  'Success': 'api.success.generic',
  'Created successfully': 'api.success.created',
  'Updated successfully': 'api.success.updated',
  'Deleted successfully': 'api.success.deleted',
  'Saved successfully': 'api.success.saved',
};

/**
 * Busca la translation key correspondiente al mensaje de la API
 * Busca coincidencia exacta primero, luego coincidencia parcial
 */
export function getTranslationKeyForApiMessage(
  apiMessage: string,
  messageMap: Record<string, string> = API_ERROR_MAP,
): string | null {
  if (!apiMessage) {
    return null;
  }

  // 1. Buscar coincidencia exacta
  if (messageMap[apiMessage]) {
    return messageMap[apiMessage];
  }

  // 2. Buscar coincidencia exacta sin considerar mayúsculas/minúsculas
  const lowerMessage = apiMessage.toLowerCase();
  const exactMatchKey = Object.keys(messageMap).find(
    (key) => key.toLowerCase() === lowerMessage,
  );

  if (exactMatchKey) {
    return messageMap[exactMatchKey];
  }

  // 3. Buscar coincidencia parcial (el mensaje contiene la key o viceversa)
  const partialMatchKey = Object.keys(messageMap).find(
    (key) =>
      lowerMessage.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lowerMessage),
  );

  if (partialMatchKey) {
    return messageMap[partialMatchKey];
  }

  // 4. No se encontró traducción
  return null;
}

/**
 * Obtiene la translation key para un error de la API
 */
export function getErrorTranslationKey(apiError: string): string | null {
  return getTranslationKeyForApiMessage(apiError, API_ERROR_MAP);
}

/**
 * Obtiene la translation key para un mensaje de éxito de la API
 */
export function getSuccessTranslationKey(apiSuccess: string): string | null {
  return getTranslationKeyForApiMessage(apiSuccess, API_SUCCESS_MAP);
}

