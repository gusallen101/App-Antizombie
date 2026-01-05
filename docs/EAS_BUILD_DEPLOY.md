# Guía de Build y Despliegue con EAS

## Índice
- [Introducción](#introducción)
- [Pre-requisitos](#pre-requisitos)
- [Configuración Inicial](#configuración-inicial)
- [Configuración de Cuentas](#configuración-de-cuentas)
- [Proceso de Build](#proceso-de-build)
- [Despliegue a Tiendas](#despliegue-a-tiendas)
- [Troubleshooting](#troubleshooting)
- [Comandos Rápidos](#comandos-rápidos)

---

## Introducción

Esta guía documenta el proceso completo para generar builds de producción y desplegarlos a las tiendas de aplicaciones (Google Play Store y Apple App Store) utilizando **EAS (Expo Application Services)**.

### ¿Qué es EAS?

EAS es un servicio de Expo que permite:
- Construir binarios nativos (APK/AAB para Android, IPA para iOS) en la nube
- Subir aplicaciones a las tiendas automáticamente
- Gestionar certificados y perfiles de provisioning
- Crear diferentes perfiles de build (development, preview, production)

### Datos del Proyecto

- **Nombre**: ¿Soy Zombie?
- **Slug**: soy-zombie
- **Project ID**: `a1a4f88b-2b4b-44ed-8541-c1c45822dd45`
- **Bundle ID (iOS)**: `com.graphicsandcode.zombie`
- **Package (Android)**: `com.zoyzombie.zombie`
- **Versión actual**: 5.0.1

---

## Pre-requisitos

### Software Necesario

1. **Node.js** (v18 o superior)
   ```bash
   node --version
   ```

2. **npm** o **yarn**
   ```bash
   npm --version
   ```

3. **Expo CLI**
   ```bash
   npm install -g expo-cli
   ```

4. **EAS CLI** (v16.27.0 o superior)
   ```bash
   npm install -g eas-cli
   eas --version
   ```

### Cuentas Requeridas

#### 1. Cuenta de Expo
- Crear en: https://expo.dev/signup
- Necesaria para usar EAS Build y Submit

#### 2. Apple Developer Account
- Crear en: https://developer.apple.com/
- **Costo**: $99 USD/año
- Necesaria para publicar en App Store
- Roles requeridos: Account Holder o Admin

#### 3. Google Play Developer Account
- Crear en: https://play.google.com/console/signup
- **Costo**: $25 USD (pago único)
- Necesaria para publicar en Play Store

### Acceso al Repositorio

Asegúrate de tener acceso al código fuente del proyecto:
```bash
git clone [URL_DEL_REPOSITORIO]
cd zombieapp-reactnative
npm install
```

---

## Configuración Inicial

### 1. Autenticación con Expo

```bash
eas login
```

Se te pedirá:
- **Email/Username**: Tu email o username de Expo
- **Password**: Tu contraseña

Para verificar que estás autenticado:
```bash
eas whoami
```

### 2. Vincular el Proyecto

Si es la primera vez que trabajas con el proyecto:

```bash
# Verificar que el proyecto está vinculado
eas project:info
```

Deberías ver:
```
Project ID: a1a4f88b-2b4b-44ed-8541-c1c45822dd45
Project Name: soy-zombie
```

Si no está vinculado:
```bash
eas init
```

### 3. Verificar Configuración

Revisa que `app.json` tenga la configuración correcta:

```json
{
  "expo": {
    "name": "¿Soy Zombie?",
    "slug": "soy-zombie",
    "version": "5.0.1",
    "ios": {
      "bundleIdentifier": "com.graphicsandcode.zombie",
      "buildNumber": "13"
    },
    "android": {
      "package": "com.zoyzombie.zombie",
      "versionCode": 100
    },
    "extra": {
      "eas": {
        "projectId": "a1a4f88b-2b4b-44ed-8541-c1c45822dd45"
      }
    }
  }
}
```

Revisa la configuración de EAS en `eas.json`:

```json
{
  "cli": {
    "version": ">= 16.27.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "simulator": false,
        "autoIncrement": true
      },
      "android": {
        "buildType": "app-bundle",
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## Configuración de Cuentas

### Configuración de Android (Google Play)

#### Paso 1: Crear una Aplicación en Google Play Console

1. Ve a https://play.google.com/console/
2. Inicia sesión con tu cuenta de Google Play Developer
3. Click en **"Crear aplicación"**
4. Completa:
   - **Nombre**: ¿Soy Zombie?
   - **Idioma predeterminado**: Español (España)
   - **Aplicación o juego**: Aplicación
   - **Gratuita o de pago**: Según tu modelo
5. Acepta las políticas y crea la app

#### Paso 2: Configurar la App

En el Panel de Google Play Console:

1. **Categoría**: Establece la categoría apropiada (ej: Productividad)
2. **Detalles de la app**:
   - Descripción corta
   - Descripción completa
   - Capturas de pantalla (mínimo 2)
   - Icono de alta resolución (512x512 px)
   - Gráfico destacado (1024x500 px)

3. **Clasificación de contenido**: Completa el cuestionario

4. **Público objetivo**: Define tu público

5. **Política de privacidad**: Proporciona URL (si aplica)

#### Paso 3: Crear una Cuenta de Servicio (Service Account)

Para que EAS pueda subir builds automáticamente:

1. Ve a **Google Cloud Console**: https://console.cloud.google.com/
2. Selecciona tu proyecto de Play Console
3. Ve a **IAM y administración** > **Cuentas de servicio**
4. Click en **Crear cuenta de servicio**
5. Completa:
   - **Nombre**: EAS Submit
   - **ID**: eas-submit
6. Click en **Crear y continuar**
7. Asigna rol: **Service Account User**
8. Click en **Continuar** y luego **Listo**

9. Click en la cuenta de servicio creada
10. Ve a la pestaña **Claves**
11. Click en **Agregar clave** > **Crear nueva clave**
12. Selecciona **JSON** y descarga el archivo

13. Ve a **Google Play Console** > **Configuración** > **Acceso a la API**
14. Click en **Vincular** en tu cuenta de servicio
15. Otorga permisos: **Admin (all permissions)**

#### Paso 4: Configurar EAS para Android

Guarda la clave JSON descargada como `google-play-service-account.json` en un lugar seguro (NO EN EL REPOSITORIO).

```bash
# Configurar el service account con EAS
eas submit --platform android --profile production
```

Se te pedirá la ruta al archivo JSON la primera vez.

O puedes configurarlo en `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./path/to/google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**⚠️ IMPORTANTE**: Agrega el archivo JSON a `.gitignore`:
```
# Google Play Service Account
google-play-service-account.json
```

---

### Configuración de iOS (App Store)

#### Paso 1: Apple Developer Program

1. Ve a https://developer.apple.com/
2. Inicia sesión con tu Apple ID
3. Enroll en el Apple Developer Program ($99/año)
4. Completa el proceso de verificación

#### Paso 2: Crear el App ID

1. Ve a https://developer.apple.com/account/
2. Click en **Certificates, Identifiers & Profiles**
3. Click en **Identifiers** > **+** (Add)
4. Selecciona **App IDs** > **Continue**
5. Selecciona **App** > **Continue**
6. Completa:
   - **Description**: Soy Zombie App
   - **Bundle ID**: `com.graphicsandcode.zombie` (Explicit)
7. Selecciona capabilities necesarias:
   - Push Notifications
   - Associated Domains (si usas deep linking)
8. Click en **Continue** y luego **Register**

#### Paso 3: Crear la App en App Store Connect

1. Ve a https://appstoreconnect.apple.com/
2. Inicia sesión con tu cuenta de desarrollador
3. Click en **Mis Apps** > **+** > **Nueva app**
4. Completa:
   - **Plataformas**: iOS
   - **Nombre**: ¿Soy Zombie?
   - **Idioma principal**: Español (España)
   - **Bundle ID**: Selecciona el creado anteriormente
   - **SKU**: Un identificador único (ej: soy-zombie-2026)
   - **Acceso de usuario**: Full Access
5. Click en **Crear**

#### Paso 4: Completar Información de la App

En App Store Connect:

1. **Información de la app**:
   - Categoría
   - Subcategoría (opcional)
   - URL de política de privacidad
   - Idiomas soportados

2. **Precios y disponibilidad**:
   - Precio: Gratis o de pago
   - Disponibilidad: Selecciona países

3. **Preparar para el envío**:
   - Capturas de pantalla (diferentes tamaños de iPhone/iPad)
   - Descripción
   - Palabras clave
   - URL de soporte
   - URL de marketing (opcional)
   - Icono de app (1024x1024 px)

#### Paso 5: Configurar Autenticación con App Store Connect

EAS necesita una **API Key** para subir builds:

1. Ve a https://appstoreconnect.apple.com/
2. Click en **Usuarios y acceso** > **Claves** (pestaña)
3. Click en **Generar clave de API** o **+**
4. Completa:
   - **Nombre**: EAS Submit
   - **Acceso**: Admin o App Manager
5. Click en **Generar**
6. **Descarga la clave** (solo se puede descargar una vez)
   - Archivo: `AuthKey_[KEY_ID].p8`
7. Anota:
   - **Key ID**: (ej: AB12CD34EF)
   - **Issuer ID**: Arriba de la tabla de claves (ej: 12345678-1234-1234-1234-123456789012)

#### Paso 6: Configurar EAS para iOS

Guarda la clave `.p8` en un lugar seguro (NO EN EL REPOSITORIO).

Configura las credenciales:

```bash
eas credentials
```

Selecciona:
1. **iOS**
2. **Production**
3. **App Store Connect API Key** > **Setup**
4. Proporciona:
   - Key ID
   - Issuer ID
   - Ruta al archivo `.p8`

O puedes configurarlo en `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "tu-email@ejemplo.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDE12345"
      }
    }
  }
}
```

**⚠️ IMPORTANTE**: Agrega el archivo `.p8` a `.gitignore`:
```
# Apple API Key
AuthKey_*.p8
```

---

## Proceso de Build

### Build de Android

#### Paso 1: Verificar Versión

Antes de crear un build de producción, incrementa la versión en `app.json`:

```json
{
  "expo": {
    "version": "5.0.2",
    "android": {
      "versionCode": 101
    }
  }
}
```

- **version**: Versión visible para usuarios (semantic versioning)
- **versionCode**: Número entero que debe incrementarse con cada build

**Nota**: Con `"autoIncrement": true` en `eas.json`, el `versionCode` se incrementa automáticamente.

#### Paso 2: Ejecutar el Build

```bash
eas build --platform android --profile production
```

El proceso:
1. Sube tu código a EAS
2. Instala dependencias
3. Genera el keystore (primera vez) o usa el existente
4. Compila la aplicación
5. Genera el AAB (Android App Bundle)

**Tiempo estimado**: 10-20 minutos

#### Paso 3: Descargar el Build (Opcional)

```bash
eas build:list
```

Muestra los builds recientes. Para descargar:

```bash
eas build:download --platform android
```

El archivo `.aab` se descarga en el directorio actual.

#### Paso 4: Probar el Build Localmente (Opcional)

Para probar antes de enviar a la tienda:

```bash
# Crear un APK de prueba en modo preview
eas build --platform android --profile preview
```

Instala el APK generado en un dispositivo de prueba.

---

### Build de iOS

#### Paso 1: Verificar Versión

Incrementa la versión en `app.json`:

```json
{
  "expo": {
    "version": "5.0.2",
    "ios": {
      "buildNumber": "14"
    }
  }
}
```

- **version**: Versión visible (semantic versioning)
- **buildNumber**: String que debe incrementarse con cada build

**Nota**: Con `"autoIncrement": true` en `eas.json`, el `buildNumber` se incrementa automáticamente.

#### Paso 2: Ejecutar el Build

```bash
eas build --platform ios --profile production
```

El proceso:
1. Sube tu código a EAS
2. Instala dependencias
3. Genera certificados y perfiles de provisioning (primera vez)
4. Compila la aplicación para App Store
5. Genera el archivo `.ipa`

**Tiempo estimado**: 15-25 minutos

#### Paso 3: Gestión de Certificados

La primera vez que hagas un build de iOS, EAS te preguntará:

```
? Would you like EAS to handle the creation of your Distribution Certificate? (y/N)
```

Responde **Yes** para que EAS gestione automáticamente los certificados.

También preguntará por el Provisioning Profile:

```
? Would you like EAS to handle the creation of your Provisioning Profile? (y/N)
```

Responde **Yes**.

EAS creará y registrará automáticamente:
- Distribution Certificate
- App Store Provisioning Profile

#### Paso 4: Descargar el Build (Opcional)

```bash
eas build:list
```

Para descargar:

```bash
eas build:download --platform ios
```

El archivo `.ipa` se descarga en el directorio actual.

---

### Build Simultáneo (Android + iOS)

Para crear builds de ambas plataformas a la vez:

```bash
eas build --platform all --profile production
```

---

## Despliegue a Tiendas

### Subir a Google Play Store

#### Opción 1: Con EAS Submit (Automático)

```bash
eas submit --platform android --profile production
```

EAS:
1. Toma el último build exitoso
2. Lo sube a Google Play Console
3. Lo publica en el track configurado (ej: internal, alpha, beta, production)

#### Opción 2: Especificar un Build

```bash
# Listar builds
eas build:list --platform android

# Enviar un build específico
eas submit --platform android --id [BUILD_ID]
```

#### Opción 3: Manual

1. Descarga el archivo `.aab`:
   ```bash
   eas build:download --platform android
   ```

2. Ve a https://play.google.com/console/
3. Selecciona tu app
4. Ve a **Producción** > **Crear nueva versión**
5. Sube el archivo `.aab`
6. Completa las notas de la versión
7. Click en **Revisar versión**
8. Click en **Iniciar lanzamiento**

#### Tracks de Distribución

- **Internal**: Para pruebas internas (hasta 100 usuarios)
- **Alpha**: Pruebas cerradas (usuarios específicos)
- **Beta**: Pruebas abiertas (cualquiera con el enlace)
- **Production**: Producción (disponible públicamente)

Para cambiar el track en `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "track": "internal"  // o "alpha", "beta", "production"
      }
    }
  }
}
```

---

### Subir a Apple App Store

#### Opción 1: Con EAS Submit (Automático)

```bash
eas submit --platform ios --profile production
```

EAS:
1. Toma el último build exitoso de iOS
2. Lo sube a App Store Connect usando Transporter API
3. Lo asocia a tu app en App Store Connect

#### Opción 2: Especificar un Build

```bash
# Listar builds
eas build:list --platform ios

# Enviar un build específico
eas submit --platform ios --id [BUILD_ID]
```

#### Opción 3: Manual con Transporter

1. Descarga el archivo `.ipa`:
   ```bash
   eas build:download --platform ios
   ```

2. Descarga **Transporter** desde la Mac App Store

3. Abre Transporter y arrastra el archivo `.ipa`

4. Click en **Entregar**

#### Paso Adicional: Enviar a Revisión

Después de subir el build con EAS Submit o Transporter:

1. Ve a https://appstoreconnect.apple.com/
2. Selecciona tu app
3. Ve a **Versiones de iOS**
4. Debería aparecer el nuevo build bajo **Build**
5. Si no aparece, espera 5-10 minutos y recarga la página
6. Selecciona el build
7. Completa la información requerida:
   - ¿Qué hay de nuevo?
   - Palabras clave (si cambiaron)
   - Capturas de pantalla (si cambiaron)
8. Responde las preguntas de cumplimiento:
   - **Criptografía**: Selecciona si tu app usa encriptación
   - **IDFA**: Selecciona si usas el identificador de publicidad
9. Click en **Agregar para revisión**
10. Click en **Enviar a revisión**

**Tiempo de revisión**: 1-3 días (puede variar)

---

## Troubleshooting

### Problemas Comunes de Android

#### Error: "No valid Android keystore"

**Solución**:
```bash
eas credentials
# Selecciona Android > Production > Keystore > Setup
```

EAS generará un nuevo keystore.

#### Error: "Version code conflict"

El `versionCode` en `app.json` debe ser mayor que el de la versión anterior.

**Solución**:
```json
{
  "android": {
    "versionCode": 102  // Incrementa este número
  }
}
```

#### Error: "Service account does not have permission"

El Service Account de Google Play no tiene los permisos correctos.

**Solución**:
1. Ve a Google Play Console > Configuración > Acceso a la API
2. Asegúrate de que el Service Account tenga permisos de **Admin**

---

### Problemas Comunes de iOS

#### Error: "No distribution certificate"

**Solución**:
```bash
eas credentials
# Selecciona iOS > Production > Distribution Certificate > Setup
```

EAS generará un nuevo certificado.

#### Error: "Build number conflict"

El `buildNumber` en `app.json` debe ser mayor que el de la versión anterior.

**Solución**:
```json
{
  "ios": {
    "buildNumber": "15"  // Incrementa este número
  }
}
```

#### Error: "Missing compliance"

Apple requiere información de cumplimiento sobre encriptación.

**Solución**:
En `app.json`:
```json
{
  "ios": {
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false
    }
  }
}
```

O responde las preguntas en App Store Connect al enviar la app.

#### Error: "Invalid provisioning profile"

**Solución**:
```bash
eas credentials
# Selecciona iOS > Production > Provisioning Profile > Remove
# Luego vuelve a crear un build
eas build --platform ios --profile production
```

---

### Problemas Generales

#### Build falla por dependencias

**Solución**:
```bash
# Limpia node_modules y reinstala
rm -rf node_modules
npm install

# Verifica que package.json no tenga errores
npm audit fix
```

#### Build tarda demasiado

Los builds de EAS son en la nube y pueden tardar:
- Android: 10-20 minutos
- iOS: 15-25 minutos

Si tarda más de 30 minutos, verifica:
```bash
eas build:list
# Revisa el status y los logs
```

#### Error de autenticación

**Solución**:
```bash
# Re-autentícate
eas logout
eas login
```

#### Revisar logs de build

```bash
# Ver detalles de un build específico
eas build:view [BUILD_ID]

# Ver logs en tiempo real durante el build
# (se muestra automáticamente al ejecutar eas build)
```

---

## Comandos Rápidos

### Cheatsheet

```bash
# Autenticación
eas login
eas whoami
eas logout

# Builds
eas build --platform android --profile production
eas build --platform ios --profile production
eas build --platform all --profile production
eas build:list
eas build:view [BUILD_ID]
eas build:download --platform [android|ios]

# Submits
eas submit --platform android --profile production
eas submit --platform ios --profile production
eas submit --platform android --id [BUILD_ID]

# Credentials
eas credentials

# Project
eas project:info
eas init

# Actualización
npm install -g eas-cli
eas --version
```

### Workflow Completo (Android)

```bash
# 1. Verificar versión en app.json (incrementar versionCode)
# 2. Crear build
eas build --platform android --profile production

# 3. Esperar a que termine (10-20 min)
# 4. Enviar a Play Store
eas submit --platform android --profile production

# 5. Revisar en Google Play Console y publicar
```

### Workflow Completo (iOS)

```bash
# 1. Verificar versión en app.json (incrementar buildNumber)
# 2. Crear build
eas build --platform ios --profile production

# 3. Esperar a que termine (15-25 min)
# 4. Enviar a App Store Connect
eas submit --platform ios --profile production

# 5. Ir a App Store Connect
# 6. Seleccionar el build y enviar a revisión
# 7. Esperar aprobación de Apple (1-3 días)
```

### Script de Deploy Completo

Puedes crear un script `deploy.sh`:

```bash
#!/bin/bash

echo "🚀 Iniciando proceso de deploy..."

# Verificar autenticación
echo "📝 Verificando autenticación..."
eas whoami || eas login

# Build de Android
echo "📱 Creando build de Android..."
eas build --platform android --profile production --non-interactive

# Build de iOS
echo "🍎 Creando build de iOS..."
eas build --platform ios --profile production --non-interactive

echo "✅ Builds completados!"
echo "🚀 Enviando a tiendas..."

# Submit a Google Play
echo "📱 Enviando a Google Play..."
eas submit --platform android --profile production --latest

# Submit a App Store
echo "🍎 Enviando a App Store..."
eas submit --platform ios --profile production --latest

echo "✅ ¡Proceso completado!"
echo "📝 No olvides:"
echo "  - Revisar Google Play Console para publicar"
echo "  - Enviar a revisión en App Store Connect"
```

Hazlo ejecutable:
```bash
chmod +x deploy.sh
```

Úsalo:
```bash
./deploy.sh
```

---

## Mejores Prácticas

### 1. Versioning

- Usa **semantic versioning**: `MAJOR.MINOR.PATCH`
  - MAJOR: Cambios incompatibles
  - MINOR: Nuevas funcionalidades compatibles
  - PATCH: Bug fixes
- Ejemplo: `5.0.1` → `5.0.2` (patch), `5.1.0` (minor), `6.0.0` (major)

### 2. Testing

Antes de crear un build de producción:
- Prueba la app localmente
- Crea un build de preview para testing interno
- Verifica que no haya linter errors

### 3. Changelog

Mantén un archivo `CHANGELOG.md` con los cambios de cada versión:

```markdown
## [5.0.2] - 2026-01-15
### Added
- Nueva funcionalidad X

### Fixed
- Bug en pantalla Y

### Changed
- Mejorado rendimiento de Z
```

### 4. Documentación

- Documenta cambios importantes en la configuración
- Mantén actualizadas las capturas de pantalla en las tiendas
- Actualiza las descripciones cuando agregues funcionalidades

### 5. Seguridad

- **NUNCA** subas credenciales al repositorio
- Usa `.gitignore` para archivos sensibles
- Rota las API keys periódicamente
- Limita los permisos de Service Accounts al mínimo necesario

### 6. Monitoreo

- Revisa regularmente los logs de EAS Build
- Monitorea las reseñas de las tiendas
- Verifica las métricas de crashes en App Store Connect y Play Console

---

## Recursos Adicionales

### Documentación Oficial

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)

### Herramientas Útiles

- [EAS Dashboard](https://expo.dev/): Ver builds y gestionar proyecto
- [App Store Connect](https://appstoreconnect.apple.com/): Gestión de iOS
- [Google Play Console](https://play.google.com/console/): Gestión de Android

### Contactos de Soporte

- **Expo Support**: https://expo.dev/support
- **Apple Developer Support**: https://developer.apple.com/contact/
- **Google Play Support**: https://support.google.com/googleplay/android-developer/

---

## Apéndice: Configuraciones Avanzadas

### Custom Build Configurations

Puedes agregar configuraciones personalizadas en `eas.json`:

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "env": {
        "API_URL": "https://api.soyzombie.com"
      },
      "ios": {
        "simulator": false,
        "autoIncrement": true,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle",
        "autoIncrement": true,
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

### Pre-build y Post-build Scripts

En `package.json`:

```json
{
  "scripts": {
    "eas-build-pre-install": "echo 'Running before dependencies install'",
    "eas-build-post-install": "echo 'Running after dependencies install'"
  }
}
```

### Multiple Submit Profiles

```json
{
  "submit": {
    "beta": {
      "android": {
        "track": "beta"
      },
      "ios": {
        "appleId": "tu-email@ejemplo.com",
        "ascAppId": "1234567890"
      }
    },
    "production": {
      "android": {
        "track": "production"
      },
      "ios": {
        "appleId": "tu-email@ejemplo.com",
        "ascAppId": "1234567890"
      }
    }
  }
}
```

Uso:
```bash
eas submit --platform android --profile beta
eas submit --platform android --profile production
```

---

**Última actualización**: Enero 2026  
**Versión de la App**: 5.0.1  
**EAS CLI Version**: ≥ 16.27.0

---

## Notas Finales

Esta guía cubre el proceso completo de build y deploy. Si encuentras problemas no documentados aquí, consulta:

1. Los logs de EAS Build
2. La documentación oficial de Expo
3. Los foros de la comunidad de Expo
4. El soporte de Expo

Para actualizaciones de esta guía o sugerencias, contacta al equipo de desarrollo.

