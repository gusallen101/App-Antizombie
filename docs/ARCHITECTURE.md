# Arquitectura de la Aplicación - ¿Soy Zombie?

## Índice
- [Visión General](#visión-general)
- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Arquitectura de Navegación](#arquitectura-de-navegación)
- [Sistema de Providers](#sistema-de-providers)
- [Manejo de Estado](#manejo-de-estado)
- [Sistema de Temas](#sistema-de-temas)
- [Internacionalización](#internacionalización)
- [Comunicación con API](#comunicación-con-api)
- [Gestión de Notificaciones](#gestión-de-notificaciones)
- [Componentes Clave](#componentes-clave)
- [Guías de Desarrollo](#guías-de-desarrollo)

---

## Visión General

**¿Soy Zombie?** es una aplicación móvil multiplataforma (iOS y Android) construida con React Native y Expo, diseñada para ayudar a los usuarios a gestionar sus tareas, objetivos y salud financiera.

### Datos Clave
- **Plataforma**: React Native con Expo SDK 54
- **Router**: Expo Router (file-based routing)
- **Lenguaje**: TypeScript 5.9
- **Versión Actual**: 5.0.1
- **Bundle Identifiers**:
  - iOS: `com.graphicsandcode.zombie`
  - Android: `com.zoyzombie.zombie`

---

## Stack Tecnológico

### Core Framework
- **React**: 19.1.0
- **React Native**: 0.81.5
- **Expo**: 54.0.24
- **Expo Router**: 6.0.15

### Navegación y UI
- `@react-navigation/native`: 7.1.8
- `@react-navigation/bottom-tabs`: 7.4.0
- `@expo/vector-icons`: 15.0.3
- `react-native-gesture-handler`: 2.28.0
- `react-native-reanimated`: 4.1.1

### Gestión de Datos
- `@react-native-async-storage/async-storage`: 2.2.0

### Funcionalidades Nativas
- `expo-notifications`: Notificaciones push
- `expo-calendar`: Integración con calendario
- `expo-image-picker`: Selección de imágenes
- `expo-haptics`: Retroalimentación háptica
- `expo-linear-gradient`: Gradientes

### Características Especiales
- **New Architecture Enabled**: Habilitada la nueva arquitectura de React Native
- **React Compiler**: Habilitado experimentalmente
- **Typed Routes**: Rutas tipadas automáticamente

---

## Estructura del Proyecto

```
zombieapp-reactnative/
│
├── app/                          # Rutas y páginas (Expo Router)
│   ├── _layout.tsx              # Layout raíz con providers
│   ├── index.tsx                # Página de entrada (redireccionamiento)
│   ├── login.tsx                # Pantalla de login
│   ├── register.tsx             # Pantalla de registro
│   ├── forgot-password.tsx      # Recuperación de contraseña
│   └── (tabs)/                  # Grupo de navegación con tabs
│       ├── _layout.tsx          # Configuración de tabs
│       ├── home.tsx             # Pantalla principal
│       ├── goals.tsx            # Gestión de objetivos
│       ├── financial-health.tsx # Salud financiera
│       ├── reminders.tsx        # Recordatorios
│       ├── pending.tsx          # Tareas pendientes
│       └── settings.tsx         # Configuración
│
├── components/                   # Componentes reutilizables
│   ├── layout/                  # Componentes de layout
│   │   ├── app-drawer.tsx       # Menú lateral
│   │   ├── app-header.tsx       # Encabezado de pantallas
│   │   └── app-screen.tsx       # Wrapper de pantallas
│   ├── ui/                      # Componentes UI básicos
│   └── [otros componentes]
│
├── providers/                    # Context Providers
│   ├── app-theme-provider.tsx   # Manejo de temas
│   ├── localization-provider.tsx # Internacionalización
│   └── navigation-menu-provider.tsx # Estado del menú
│
├── constants/                    # Constantes y configuración
│   ├── config.ts                # Configuración de API
│   ├── goals.ts                 # Constantes de objetivos
│   └── theme.ts                 # Paleta de colores
│
├── hooks/                        # Custom Hooks
│   ├── use-api-messages.ts      # Hook para mensajes de API
│   ├── use-color-scheme.ts      # Hook de tema
│   └── use-theme-color.ts       # Hook de colores
│
├── localization/                 # Traducciones
│   └── translations.ts          # Diccionarios de idiomas
│
├── lib/                          # Librerías y utilidades
│   └── api-messages.ts          # Manejo de mensajes API
│
└── assets/                       # Recursos estáticos
    └── images/                  # Imágenes e iconos
```

---

## Arquitectura de Navegación

La aplicación utiliza **Expo Router** con un sistema de navegación basado en archivos.

### Flujo de Navegación

```
Index (/)
  ↓
  ├─ Login (/login)
  │   ↓
  │   ├─ Register (/register)
  │   └─ Forgot Password (/forgot-password)
  │
  └─ Authenticated (/(tabs))
      ├─ Home (/(tabs)/home)
      ├─ Goals (/(tabs)/goals)
      ├─ Financial Health (/(tabs)/financial-health)
      ├─ Reminders (/(tabs)/reminders)
      ├─ Pending (/(tabs)/pending)
      └─ Settings (/(tabs)/settings)
```

### Lógica de Redireccionamiento

El archivo `app/index.tsx` implementa la lógica de redireccionamiento inicial:

1. Verifica el estado de autenticación en AsyncStorage (`@auth:isAuthenticated`)
2. Si está autenticado → redirige a `/(tabs)/home`
3. Si no está autenticado → redirige a `/login`

### Configuración de Tabs

Los tabs están configurados en `app/(tabs)/_layout.tsx` con:
- **Iconos**: Ionicons
- **Feedback háptico**: HapticTab component
- **Tematización dinámica**: Colores del theme provider
- **Internacionalización**: Títulos traducidos

Algunas pantallas están ocultas de la navegación (`href: null`):
- `complete-tasks`
- `task-reminders`
- `view-goals`

Estas son accesibles por navegación programática pero no aparecen en la barra de tabs.

---

## Sistema de Providers

La aplicación utiliza **React Context** para gestionar estado global mediante providers anidados.

### Jerarquía de Providers

```tsx
<LocalizationProvider>          // Idioma y traducciones
  <AppThemeProvider>             // Temas y colores
    <NavigationMenuProvider>     // Estado del menú lateral
      <Stack>                    // Navegación
        {/* Rutas */}
      </Stack>
      <AppDrawer />             // Menú lateral
      <AppStatusBar />          // Status bar
    </NavigationMenuProvider>
  </AppThemeProvider>
</LocalizationProvider>
```

### 1. LocalizationProvider

**Ubicación**: `providers/localization-provider.tsx`

**Responsabilidades**:
- Gestión de idioma actual (español/inglés)
- Función de traducción `t(key, replacements)`
- Persistencia de idioma en AsyncStorage
- Detección automática de idioma del dispositivo

**API**:
```typescript
const { language, setLanguage, availableLanguages, t } = useLocalization();

// Uso
const title = t('tabs.home');
const greeting = t('welcome.message', { name: 'Usuario' });
```

**Storage Key**: `@app-language:selected`

### 2. AppThemeProvider

**Ubicación**: `providers/app-theme-provider.tsx`

**Responsabilidades**:
- Gestión de tema (light/dark)
- Paleta de colores dinámica
- Personalización de colores por tema
- Integración con React Navigation
- Persistencia de preferencias en AsyncStorage

**API**:
```typescript
const { colorScheme, palette, setColorScheme, updatePalette, resetPalette } = useAppTheme();

// Cambiar tema
setColorScheme('dark');

// Personalizar colores
updatePalette('dark', { primary: '#FF5733' });

// Resetear personalizaciones
resetPalette('dark');
```

**Storage Keys**:
- `@app-theme:scheme`: Tema actual
- `@app-theme:overrides`: Personalizaciones de paleta

### 3. NavigationMenuProvider

**Ubicación**: `providers/navigation-menu-provider.tsx`

**Responsabilidades**:
- Control de apertura/cierre del menú lateral
- Estado del menú

**API**:
```typescript
const { isMenuOpen, openMenu, closeMenu, toggleMenu } = useNavigationMenu();
```

---

## Manejo de Estado

### Estado Local
- **useState**: Para estado de componentes
- **useReducer**: Para lógica compleja en componentes

### Estado Persistente
- **AsyncStorage**: Para persistir datos localmente
  - Autenticación: `@auth:isAuthenticated`
  - Tema: `@app-theme:scheme`, `@app-theme:overrides`
  - Idioma: `@app-language:selected`

### Estado de Servidor
- **Fetch API**: Llamadas HTTP a la API REST
- **Base URL**: `https://api.soyzombie.com/` (configurable en `constants/config.ts`)

### Patrón de Hidratación

Los providers implementan un patrón de hidratación:

```typescript
const isHydrated = useRef(false);

useEffect(() => {
  const hydrate = async () => {
    const storedValue = await AsyncStorage.getItem(KEY);
    setState(storedValue);
    isHydrated.current = true;
  };
  hydrate();
}, []);

// Solo persistir después de hidratar
const updateState = (newValue) => {
  setState(newValue);
  if (isHydrated.current) {
    AsyncStorage.setItem(KEY, newValue);
  }
};
```

Esto evita sobrescribir valores del storage durante la inicialización.

---

## Sistema de Temas

### Paleta de Colores

Definida en `constants/theme.ts`, la paleta incluye:

```typescript
type Palette = {
  primary: string;
  background: string;
  textPrimary: string;
  textSecondary: string;
  headerBackground: string;
  tabBarBackground: string;
  border: string;
  accent: string;
  buttonText: string;
  // ... más colores
};
```

### Temas Disponibles
- **Light**: Tema claro
- **Dark**: Tema oscuro

### Integración con React Navigation

El `AppThemeProvider` automáticamente configura el tema de React Navigation:

```typescript
const navigationTheme = {
  ...baseTheme,
  colors: {
    primary: palette.primary,
    background: palette.background,
    card: palette.headerBackground,
    text: palette.textPrimary,
    border: palette.border,
    notification: palette.accent,
  },
};
```

### Uso en Componentes

```typescript
import { useAppTheme } from '@/providers/app-theme-provider';

function MyComponent() {
  const { palette, colorScheme } = useAppTheme();
  
  return (
    <View style={{ backgroundColor: palette.background }}>
      <Text style={{ color: palette.textPrimary }}>
        Tema actual: {colorScheme}
      </Text>
    </View>
  );
}
```

---

## Internacionalización

### Idiomas Soportados
- **Español** (es) - Idioma por defecto
- **Inglés** (en)

### Estructura de Traducciones

Las traducciones están en `localization/translations.ts`:

```typescript
export const translations = {
  es: {
    tabs: {
      home: 'Inicio',
      goals: 'Objetivos',
      // ...
    },
    welcome: {
      message: 'Bienvenido, {{name}}',
    },
  },
  en: {
    tabs: {
      home: 'Home',
      goals: 'Goals',
      // ...
    },
  },
};
```

### Uso de Traducciones

```typescript
import { useLocalization } from '@/providers/localization-provider';

function MyComponent() {
  const { t, language, setLanguage } = useLocalization();
  
  return (
    <View>
      <Text>{t('tabs.home')}</Text>
      <Text>{t('welcome.message', { name: 'Juan' })}</Text>
      <Button onPress={() => setLanguage('en')} title="English" />
    </View>
  );
}
```

### Detección Automática

Si no hay idioma guardado, el sistema detecta el idioma del dispositivo:
- Si es inglés → `en`
- Cualquier otro → `es` (fallback)

---

## Comunicación con API

### Configuración

**Archivo**: `constants/config.ts`

```typescript
export const API_CONFIG = {
  baseUrl: 'https://api.soyzombie.com/',
};
```

### Patrón de Llamadas API

Aunque no hay un cliente centralizado visible, el patrón recomendado es:

```typescript
import { API_CONFIG } from '@/constants/config';

async function fetchUserData(userId: string) {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

### Manejo de Errores

El archivo `lib/api-messages.ts` probablemente contiene utilidades para:
- Formateo de mensajes de error
- Mensajes de éxito/error estandarizados
- Manejo de códigos HTTP

---

## Gestión de Notificaciones

### Configuración

**Ubicación**: `app/_layout.tsx`

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

### Plugin de Expo

Configurado en `app.json`:

```json
{
  "expo-notifications": {
    "icon": "./assets/images/app-icon.png",
    "color": "#6E1F7C",
    "sounds": []
  }
}
```

### Uso de Notificaciones

```typescript
import * as Notifications from 'expo-notifications';

// Programar notificación
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Recordatorio',
    body: 'Es hora de completar tu tarea',
    data: { taskId: '123' },
  },
  trigger: {
    seconds: 60,
  },
});

// Escuchar notificaciones
useEffect(() => {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notificación recibida:', notification);
  });
  
  return () => subscription.remove();
}, []);
```

---

## Componentes Clave

### AppScreen

**Ubicación**: `components/layout/app-screen.tsx`

Wrapper estándar para pantallas de la app.

**Características**:
- Header con título traducido
- ScrollView con RefreshControl opcional
- Tematización automática
- Padding y spacing consistente

**Uso**:
```typescript
import { AppScreen } from '@/components/layout/app-screen';

export default function MyScreen() {
  return (
    <AppScreen titleKey="screens.myScreen">
      {/* Contenido */}
    </AppScreen>
  );
}
```

### AppHeader

**Ubicación**: `components/layout/app-header.tsx`

Header consistente con:
- Título
- Botón de menú lateral
- Tematización

### AppDrawer

**Ubicación**: `components/layout/app-drawer.tsx`

Menú lateral con:
- Navegación
- Opciones de configuración
- Información del usuario

### HapticTab

**Ubicación**: `components/haptic-tab.tsx`

Botón de tab con retroalimentación háptica.

### LanguageSwitcher

**Ubicación**: `components/language-switcher.tsx`

Selector de idioma integrado con LocalizationProvider.

---

## Guías de Desarrollo

### Agregar una Nueva Pantalla

1. **Crear archivo en `app/`**:
   ```typescript
   // app/my-screen.tsx
   import { AppScreen } from '@/components/layout/app-screen';
   
   export default function MyScreen() {
     return (
       <AppScreen titleKey="screens.myScreen">
         {/* Contenido */}
       </AppScreen>
     );
   }
   ```

2. **Agregar traducciones**:
   ```typescript
   // localization/translations.ts
   export const translations = {
     es: {
       screens: {
         myScreen: 'Mi Pantalla',
       },
     },
     en: {
       screens: {
         myScreen: 'My Screen',
       },
     },
   };
   ```

3. **Configurar navegación** (si es tab):
   ```typescript
   // app/(tabs)/_layout.tsx
   <Tabs.Screen
     name="my-screen"
     options={{
       title: t('screens.myScreen'),
       tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
     }}
   />
   ```

### Usar el Theme System

```typescript
import { useAppTheme } from '@/providers/app-theme-provider';

function ThemedComponent() {
  const { palette, colorScheme } = useAppTheme();
  
  return (
    <View style={{
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderWidth: 1,
    }}>
      <Text style={{ color: palette.textPrimary }}>
        Texto tematizado
      </Text>
    </View>
  );
}
```

### Hacer Llamadas a la API

```typescript
import { API_CONFIG } from '@/constants/config';

async function myApiCall() {
  const token = await AsyncStorage.getItem('@auth:token');
  
  const response = await fetch(`${API_CONFIG.baseUrl}endpoint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ data: 'value' }),
  });
  
  const result = await response.json();
  return result;
}
```

### Implementar Persistencia

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Guardar
await AsyncStorage.setItem('@mykey:data', JSON.stringify(data));

// Leer
const stored = await AsyncStorage.getItem('@mykey:data');
const data = stored ? JSON.parse(stored) : null;

// Eliminar
await AsyncStorage.removeItem('@mykey:data');
```

### Convenciones de Código

1. **Imports**: Usar alias `@/` para imports relativos
   ```typescript
   import { useAppTheme } from '@/providers/app-theme-provider';
   ```

2. **Tipado**: Siempre tipar props y estados
   ```typescript
   type Props = {
     title: string;
     onPress?: () => void;
   };
   ```

3. **Componentes**: Usar function components con TypeScript
   ```typescript
   export function MyComponent({ title }: Props) {
     return <Text>{title}</Text>;
   }
   ```

4. **Hooks**: Usar `use` prefix
   ```typescript
   export function useMyCustomHook() {
     // ...
   }
   ```

5. **Archivos**: kebab-case para archivos
   ```
   my-component.tsx
   use-my-hook.ts
   ```

### Testing

1. **Ejecutar lint**:
   ```bash
   npm run lint
   ```

2. **Probar en dispositivo**:
   ```bash
   npm run ios     # iOS simulator
   npm run android # Android emulator
   npm start       # Dev server
   ```

### Debugging

1. **React Native Debugger**: Para debugging general
2. **Expo Dev Tools**: En `http://localhost:8081`
3. **Console Logs**: Visible en terminal y debugger
4. **AsyncStorage**: Usar React Native Debugger para inspeccionar

### Performance

1. **useCallback**: Para funciones pasadas como props
2. **useMemo**: Para cálculos costosos
3. **React.memo**: Para componentes puros
4. **FlatList**: Para listas largas en lugar de ScrollView

### Seguridad

1. **Tokens**: Nunca guardar tokens en código
2. **AsyncStorage**: Para datos sensibles considerar cifrado
3. **API Keys**: Usar variables de entorno
4. **HTTPS**: Siempre usar HTTPS para API

---

## Recursos Adicionales

### Documentación Oficial
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Navigation](https://reactnavigation.org/)

### Tools
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Expo Go](https://expo.dev/go)

### Contacto
Para preguntas sobre la arquitectura, contactar al equipo de desarrollo.

---

**Última actualización**: Enero 2026  
**Versión de la App**: 5.0.1

