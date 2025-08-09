# Multi-OS Link Platforms Implementation

## 🎯 Objetivo
Implementar detección automática de sistema operativo (Windows, macOS, Linux) en el proceso de Link Platforms para ejecutar comandos específicos según el OS y buscar carpetas MQL4/MQL5 de manera optimizada.

## 🔧 Cambios Implementados

### 1. Detección Automática de OS
- **Archivo**: `server/src/controllers/linkPlatformsController.js`
- **Funcionalidad**: Detecta automáticamente el sistema operativo usando `os.platform()`
- **Soporte**: Windows (`win32`), macOS (`darwin`), Linux (`linux`)

```javascript
detectOperatingSystem() {
  const platform = os.platform();
  switch (platform) {
    case 'win32': return 'windows';
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    default: return 'linux';
  }
}
```

### 2. Comandos Específicos por OS

#### Windows
- **Detección de drives**: `wmic logicaldisk get caption`
- **Búsqueda de carpetas**: `dir /s /b /ad [path] | findstr /i "\\\\[folder]$"`
- **Timeout**: 30 segundos para evitar bloqueos

#### macOS
- **Detección de volúmenes**: `ls /Volumes`
- **Búsqueda de carpetas**: `find [path] -maxdepth 10 -type d -iname "[folder]" 2>/dev/null`
- **Rutas específicas**: `~/Library/Application Support/MetaQuotes`, `/Applications/MetaTrader*`

#### Linux
- **Detección de mount points**: `mount | grep -E "^/dev" | awk '{print $3}'`
- **Búsqueda de carpetas**: `find [path] -maxdepth 10 -type d -iname "[folder]" 2>/dev/null`
- **Soporte Wine**: `~/.wine/drive_c/Program Files*`

### 3. Rutas Específicas por Plataforma

#### Windows
- Drives principales: `C:\`, `D:\`
- AppData del usuario: `%USERPROFILE%\AppData`

#### macOS
- Home directory: `~/`
- Applications: `/Applications`
- Library Support: `~/Library/Application Support`
- MetaTrader específico: `~/Library/Application Support/MetaQuotes`
- Volúmenes externos: `/Volumes/*`

#### Linux
- Home directory: `~/`
- Directorios del sistema: `/opt`, `/usr/local`
- Wine: `~/.wine/drive_c`, `~/.wine/drive_c/Program Files*`
- Snap/Flatpak: `/snap`, `/var/lib/flatpak`

### 4. Sistema de Fallback
- Cada OS tiene rutas de fallback específicas
- Si los comandos del OS fallan, usa búsqueda recursiva simple
- Filtros inteligentes para evitar carpetas del sistema

### 5. Optimizaciones
- **Cache válido por 24 horas** para evitar búsquedas repetitivas
- **Background scanning** para nuevas instalaciones
- **Timeouts de 30 segundos** para evitar bloqueos
- **Filtros de carpetas del sistema** específicos por OS

## 🎨 Mejoras en el Frontend

### 1. Indicador Visual de OS
- **Archivo**: `src/components/Dashboard.tsx`
- **Icono del OS** en el botón Link Platforms:
  - Windows: 🪟
  - macOS: 🍎
  - Linux: 🐧

### 2. Tooltip Informativo
- Muestra el OS detectado en el tooltip del botón
- Ejemplo: "Link Platforms - Scan macOS for MQL4/MQL5 folders"

### 3. Logs Mejorados
- Incluye información del OS en los logs de consola
- Mejor debugging y troubleshooting

## 🧪 Script de Pruebas

### Archivo de Test
`scripts/test-multi-os-link-platforms.js`

### Funcionalidades Probadas
- ✅ Detección de OS
- ✅ Comandos específicos por plataforma
- ✅ Rutas de fallback
- ✅ Integración con el servidor

### Ejecutar Tests
```bash
node scripts/test-multi-os-link-platforms.js
```

## 📁 Archivos Modificados

1. **`server/src/controllers/linkPlatformsController.js`**
   - Detección automática de OS
   - Comandos específicos por plataforma
   - Rutas optimizadas para cada OS

2. **`src/components/Dashboard.tsx`**
   - Integración con hook `useOperatingSystem`
   - Indicador visual del OS
   - Logs mejorados

3. **`scripts/test-multi-os-link-platforms.js`** (nuevo)
   - Script de pruebas completo
   - Verificación de funcionalidad multi-OS

## 🚀 Beneficios

### Antes
- ❌ Solo funcionaba en Windows
- ❌ Comandos hardcodeados (`wmic`, `dir`)
- ❌ No detectaba rutas específicas de macOS/Linux

### Después
- ✅ Funciona en Windows, macOS y Linux
- ✅ Comandos específicos y optimizados por OS
- ✅ Rutas inteligentes para MetaTrader en cada plataforma
- ✅ Sistema de fallback robusto
- ✅ Feedback visual del OS en el frontend
- ✅ Timeouts y filtros para mejor rendimiento

## 📝 Notas de Uso

### Para Usuarios de macOS
- El sistema buscará en `~/Library/Application Support/MetaQuotes`
- También en `/Applications/MetaTrader*`
- Incluye volúmenes externos montados

### Para Usuarios de Linux
- Soporte completo para Wine
- Busca en directorios estándar de Linux
- Compatible con Snap y Flatpak

### Para Usuarios de Windows
- Mantiene la funcionalidad original
- Mejorado con timeouts y filtros
- Mejor manejo de errores

## 🔄 Compatibilidad Hacia Atrás
- ✅ 100% compatible con implementación anterior
- ✅ No requiere cambios en configuración existente
- ✅ Mejoras transparentes para el usuario

## 🎉 Resultado Final
El sistema Link Platforms ahora detecta automáticamente el sistema operativo y ejecuta los comandos más eficientes para cada plataforma, proporcionando una experiencia optimizada sin importar si el usuario está en Windows, macOS o Linux.
