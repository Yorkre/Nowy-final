# Nowy-final

Este repositorio contiene la versión del proyecto **Nowy** organizada en Pull Requests separadas:

- **PR 1:** subida de la carpeta del proyecto (`nowy/`), excluyendo artefactos generados.
- **PR 2:** subida del APK de debug.

## Estructura principal

- `nowy/`: código fuente del proyecto.
- `nowy/src/`: frontend y lógica principal.
- `nowy/android/`: proyecto Android (Capacitor).

## Requisitos

- Node.js 20+
- npm
- Android Studio (para compilar APK en Android)

## Ejecutar en local

1. Entra en la carpeta del proyecto:
   `cd nowy`
2. Instala dependencias:
   `npm install`
3. Arranca en desarrollo:
   `npm run dev`

## Scripts útiles

- `npm run dev` — entorno local
- `npm run build` — build web
- `npm test` — tests
- `npm run lint` — chequeo de tipos

## Nota

El APK se gestiona en una PR independiente para mantener el historial limpio y facilitar revisiones.
