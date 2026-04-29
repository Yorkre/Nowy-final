# Nowy-final

Documentación técnica del proyecto **Nowy** y del proceso seguido para convertir una app generada desde **AI Studio** en una aplicación Android instalable (**APK**).

## 1. Origen del proyecto

La aplicación fue desarrollada a partir de un proyecto generado en **AI Studio** (exportado en formato ZIP).  
El proyecto de origen es una **web app** con stack **React + Vite + TypeScript**.

## 2. Alcance de plataformas

- **Android:** completado, con generación de APK de pruebas.
- **iOS:** no implementado en esta entrega, ya que la distribución/compilación para iPhone requiere cuenta de desarrollador de Apple de pago.

## 3. Contenido de este repositorio

- `nowy/`: código fuente del proyecto.
- `apk/app-debug.apk`: APK Android generado para pruebas.
- `apk/README.md`: guía breve de descarga e instalación del APK.

## 4. Proceso seguido: de ZIP de AI Studio a APK Android

### 4.1 Preparar el proyecto

1. Descargar y descomprimir el ZIP exportado desde AI Studio.
2. Abrir una terminal en la carpeta del proyecto.

```bash
cd ruta/del/proyecto
```

### 4.2 Instalar dependencias

```bash
npm install
```

Si aparece conflicto de dependencias:

```bash
npm install --legacy-peer-deps
```

### 4.3 Incidencias resueltas en Windows

Si aparece el error:

```text
spawn /bin/bash ENOENT
```

se corrige con:

```bash
npm config set script-shell "C:\\Windows\\System32\\cmd.exe"
```

Si PowerShell bloquea scripts, ejecutar PowerShell como administrador:

```powershell
Set-ExecutionPolicy RemoteSigned
```

y confirmar con `Y`.

### 4.4 Ejecutar la app web en local

```bash
npm run dev
```

URL local habitual:

```text
http://localhost:5173
```

### 4.5 Integrar Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
```

Configuración utilizada:

- **App name:** `Nowy`
- **App ID:** `com.tunombre.app`

### 4.6 Generar build web

```bash
npm run build
```

Esto crea la carpeta `dist/`.

### 4.7 Añadir plataforma Android

```bash
npm install @capacitor/android
npx cap add android
```

### 4.8 Sincronizar cambios web con Android

```bash
npx cap sync
```

### 4.9 Abrir proyecto Android

```bash
npx cap open android
```

### 4.10 Probar en dispositivo físico

En el móvil Android:

1. Activar modo desarrollador (7 pulsaciones sobre “Número de compilación”).
2. Activar:
   - Depuración USB
   - Depuración USB (seguridad)
   - Instalar vía USB
3. Conectar por USB y aceptar la huella de depuración.

En Android Studio:

1. Seleccionar el dispositivo.
2. Pulsar **Run** (▶).

### 4.11 Generar APK

En Android Studio:

```text
Build -> Build Bundle(s) / APK(s) -> Build APK(s)
```

Si el menú no aparece:

- pulsar `Alt` para mostrar menú clásico, o
- usar `Ctrl + Shift + A` y buscar `Build APK`.

### 4.12 Ruta del APK generado

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 5. Cómo descargar y usar esta entrega

### Descargar código fuente (`nowy/`)

1. Botón **Code** en GitHub.
2. **Download ZIP**.
3. Descomprimir y entrar en `nowy/`.

### Descargar APK (`apk/app-debug.apk`)

1. Entrar en carpeta `apk/`.
2. Abrir `app-debug.apk`.
3. Pulsar **Download raw file**.

### Instalar APK en Android

1. Copiar `app-debug.apk` al móvil.
2. Permitir instalación de apps desconocidas para la app desde la que se abre el archivo.
3. Ejecutar el APK e instalar.

## 6. Nota técnica

El archivo incluido es un **APK de tipo debug** (válido para pruebas).  
Para distribución en tienda se debe generar una **versión release firmada**.
