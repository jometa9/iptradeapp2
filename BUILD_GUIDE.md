# 🚀 Guía de Compilación IPTRADE

Esta guía te ayudará a compilar y generar el instalador de IPTRADE para Windows.

## 📋 Requisitos Previos

### 1. Node.js
- Versión 18 o superior
- Descarga: https://nodejs.org/

### 2. NSIS (Nullsoft Scriptable Install System)
Para generar el instalador necesitas NSIS instalado en tu sistema.

**Opción 1 - Instalación manual:**
```bash
# Descarga desde: https://nsis.sourceforge.io/Download
```

**Opción 2 - Con Chocolatey (recomendado):**
```powershell
choco install nsis
```

**Opción 3 - Con WinGet:**
```powershell
winget install NSIS.NSIS
```

Después de instalar NSIS, asegúrate de que esté en tu PATH. Para verificar:
```powershell
makensis /VERSION
```

### 3. Neutralino CLI
```bash
npm install -g @neutralinojs/neu
```

## 🔨 Comandos de Compilación

### Desarrollo
```bash
# Instalar dependencias
npm install
cd server && npm install && cd ..

# Ejecutar en modo desarrollo
npm run dev
```

### Compilación Completa

#### Opción 1: Compilar todo (incluyendo instalador)
```bash
npm run release
```
Esto ejecuta:
1. Limpia directorios anteriores
2. Compila el frontend (React + Vite)
3. Compila el servidor (Node.js)
4. Prepara los recursos para Neutralino
5. Construye el ejecutable de Neutralino
6. Genera el instalador NSIS

**Resultado:** `release/IPTRADE-Setup.exe`

#### Opción 2: Solo el ejecutable (sin instalador)
```bash
npm run build:windows
```

**Resultado:** `dist/IPTRADE/IPTRADE-win_x64.exe`

#### Opción 3: Solo el instalador (si ya compilaste antes)
```bash
npm run build:installer
```

**Requisito:** Debes haber ejecutado `npm run build:windows` primero.

## 📁 Estructura de Archivos Generados

```
📦 Después de compilar:
├── dist/
│   └── IPTRADE/
│       ├── IPTRADE-win_x64.exe     ← Ejecutable principal
│       ├── resources.neu            ← Recursos empaquetados
│       └── (otros binarios para Linux/Mac)
├── resources/
│   ├── dist/                        ← Frontend compilado
│   ├── server/                      ← Backend compilado
│   └── js/                          ← APIs de Neutralino
└── release/
    └── IPTRADE-Setup.exe            ← 🎉 INSTALADOR FINAL
```

## 🎯 ¿Qué archivo distribuir?

### Para instalación en máquinas de usuarios:
✅ **`release/IPTRADE-Setup.exe`** ← Este es el que necesitas!

Este instalador:
- Instala la aplicación en `C:\Program Files\IPTRADE`
- Crea accesos directos en el escritorio
- Crea entradas en el menú inicio
- Registra el protocolo `iptrade://`
- Crea un desinstalador
- Se registra en "Agregar o quitar programas"

### Para testing rápido (sin instalación):
📦 **`dist/IPTRADE/IPTRADE-win_x64.exe`**

Este ejecutable standalone:
- Se puede ejecutar directamente desde cualquier carpeta
- No requiere instalación
- Ideal para pruebas rápidas

## 🔧 Solución de Problemas

### Error: "NSIS not found"
```powershell
# Instala NSIS con Chocolatey
choco install nsis

# O agrega NSIS manualmente al PATH
$env:Path += ";C:\Program Files (x86)\NSIS"
```

### Error: "dist directory not found"
```bash
# Primero construye el proyecto
npm run build:windows
```

### Error: "localhost refused to connect"
Este error ocurre si ejecutas el .exe directamente sin haber configurado correctamente.
Solución: Los cambios ya están aplicados en `neutralino.config.json` (url: "/")

### Problemas con el servidor Node.js
Si el instalador no inicia el servidor correctamente:
1. Verifica que la carpeta `resources/server` tenga los archivos compilados
2. Ejecuta `npm run build:server` manualmente

## 📝 Notas Importantes

1. **Modo Desarrollo vs Producción:**
   - Desarrollo: Carga desde `localhost:31000` (Vite dev server)
   - Producción: Carga desde recursos locales empaquetados

2. **Versión:**
   - La versión se controla en `package.json` y `neutralino.config.json`
   - Debe coincidir en ambos archivos

3. **Icono:**
   - El icono de la aplicación está en `public/iconShadow025.png`
   - Para cambiar el icono, reemplaza este archivo

4. **Configuración:**
   - El instalador crea carpetas automáticamente: `config/`, `csv_data/`, `accounts/`, `logs/`
   - Estos directorios se mantienen al actualizar

## 🚀 Proceso Completo Recomendado

```powershell
# 1. Asegúrate de tener todas las dependencias
npm install
cd server && npm install && cd ..

# 2. Prueba que todo funciona en desarrollo
npm run dev

# 3. Compila todo y genera el instalador
npm run release

# 4. El instalador estará en:
# release/IPTRADE-Setup.exe
```

## 📊 Comparación de Comandos

| Comando | Frontend | Backend | Recursos | Neutralino | Instalador | Tiempo |
|---------|----------|---------|----------|------------|------------|--------|
| `npm run dev` | ✅ Dev | ✅ Dev | ❌ | ✅ Dev | ❌ | Rápido |
| `npm run build:frontend` | ✅ | ❌ | ❌ | ❌ | ❌ | Rápido |
| `npm run build:windows` | ✅ | ✅ | ✅ | ✅ | ❌ | Medio |
| `npm run release` | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |

---

**¿Preguntas?** Revisa el archivo `TODO.md` o contacta al equipo de desarrollo.

