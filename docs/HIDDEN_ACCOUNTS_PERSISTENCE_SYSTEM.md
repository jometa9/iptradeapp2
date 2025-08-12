# Sistema de Persistencia para Cuentas Pendientes Ocultas

## 🎯 Objetivo

Implementar un sistema de persistencia local que permita ocultar cuentas pendientes de forma temporal, manteniendo esta información en localStorage hasta que se ejecute el proceso de Link Platforms o se reinicie la aplicación.

## 📋 Problema Resuelto

**Problema anterior**: Las cuentas "eliminadas" del frontend reaparecían inmediatamente debido a las actualizaciones SSE y el escaneo automático del sistema CSV.

**Solución**: Sistema de persistencia que mantiene las cuentas ocultas hasta que sea apropiado mostrarlas nuevamente, con manejo inteligente de actualizaciones SSE que respeta las cuentas ocultas.

## 🔧 Componentes Implementados

### 1. Hook `useHiddenPendingAccounts` (`src/hooks/useHiddenPendingAccounts.ts`)

#### Funcionalidades principales:
- **Persistencia**: Guarda cuentas ocultas en localStorage
- **Filtrado**: Filtra cuentas visibles automáticamente
- **Gestión**: Funciones para ocultar, mostrar y limpiar cuentas

#### API del hook:
```typescript
const {
  hiddenAccounts,        // Estado actual de cuentas ocultas
  hideAccount,          // Ocultar una cuenta específica
  showAccount,          // Mostrar una cuenta específica
  clearHiddenAccounts,  // Limpiar todas las cuentas ocultas
  isAccountHidden,      // Verificar si una cuenta está oculta
  filterVisibleAccounts, // Filtrar cuentas visibles
} = useHiddenPendingAccounts();
```

#### Estructura de datos en localStorage:
```json
{
  "hiddenPendingAccounts": {
    "250062001": {
      "hiddenAt": "2024-01-15T10:30:00Z",
      "platform": "MT4"
    },
    "11219046": {
      "hiddenAt": "2024-01-15T10:31:00Z",
      "platform": "MT5"
    }
  }
}
```

### 2. Hook `usePendingAccounts` Actualizado

#### Cambios principales:
- **Integración**: Usa `useHiddenPendingAccounts` para filtrar cuentas
- **Filtrado automático**: Las cuentas ocultas no aparecen en la lista
- **Persistencia**: Las cuentas ocultas se mantienen entre sesiones

#### Flujo de carga:
1. Cargar datos del servidor
2. Filtrar cuentas ocultas usando `filterVisibleAccounts`
3. Actualizar estadísticas con cuentas visibles únicamente
4. Mostrar solo cuentas no ocultas

#### Manejo de actualizaciones SSE:
- **Actualizaciones inteligentes**: Las actualizaciones SSE respetan las cuentas ocultas
- **Filtrado automático**: Cada actualización SSE filtra automáticamente las cuentas ocultas
- **Sin recarga completa**: Evita recargar todos los datos del servidor en cada actualización SSE

### 3. Hook `useLinkPlatforms` Actualizado

#### Limpieza automática:
- **Inicio manual**: Limpia cuentas ocultas inmediatamente cuando se hace clic en el botón
- **Evento `completed`**: Limpia cuentas ocultas cuando se completa Link Platforms
- **Background scan**: Limpia cuentas ocultas cuando se completa el escaneo en segundo plano
- **Logging**: Registra cuando se limpian las cuentas ocultas

### 4. Hook `useAutoLinkPlatforms` Actualizado

#### Limpieza automática:
- **Detección de cambios**: Limpia cuentas ocultas cuando se detectan cambios en las cuentas
- **Ejecución automática**: Se ejecuta automáticamente cuando cambian las cuentas master/slave
- **Logging**: Registra cuando se limpian las cuentas ocultas por cambios automáticos

### 5. Componente `PendingAccountsManager` Actualizado

#### Cambios en la UI:
- **Botones**: Cambiaron de "Delete" a "Hide" / "Confirm Hide"
- **Mensajes**: Indicaciones claras sobre que las cuentas pueden reaparecer
- **Tooltips**: Actualizados para reflejar la funcionalidad de ocultar

### 6. `AuthContext` Actualizado

#### Limpieza en logout:
- **localStorage**: Se limpia `hiddenPendingAccounts` al hacer logout
- **Consistencia**: Mantiene la limpieza completa de datos de usuario

## 🔄 Flujo del Sistema

### Ocultar una cuenta:
1. **Usuario hace clic** en "Hide" / "Confirm Hide"
2. **Frontend** oculta la cuenta del estado local
3. **localStorage** guarda la cuenta como oculta
4. **Estadísticas** se recalculan automáticamente
5. **Toast** confirma que la cuenta fue oculta

### Reaparición de cuentas:
1. **Link Platforms manual** (botón de la UI) → Se limpian inmediatamente al iniciar
2. **Link Platforms automático** (cambios en cuentas) → Se limpian cuando se detectan cambios
3. **Evento `completed`** → Se limpian cuando se completa el proceso
4. **localStorage** se limpia automáticamente
5. **Todas las cuentas** vuelven a ser visibles

### Persistencia entre sesiones:
1. **App se inicia** → Se cargan cuentas ocultas desde localStorage
2. **Datos del servidor** → Se filtran automáticamente las cuentas ocultas
3. **Usuario ve** → Solo cuentas no ocultas
4. **App se cierra** → Las cuentas ocultas permanecen en localStorage

## 🧪 Pruebas

### Script de prueba: `scripts/test-hidden-accounts-system.js`

#### Verificaciones incluidas:
- ✅ Ocultar cuentas persistentemente
- ✅ Filtrar cuentas ocultas de la vista
- ✅ Persistencia entre reinicios de app
- ✅ Limpieza automática con Link Platforms
- ✅ Integración correcta con localStorage

### Script de prueba SSE: `scripts/test-sse-hidden-accounts.js`

#### Verificaciones específicas para SSE:
- ✅ Cuentas ocultas permanecen ocultas durante actualizaciones SSE
- ✅ Múltiples actualizaciones SSE no revelan cuentas ocultas
- ✅ Nuevas cuentas aparecen correctamente
- ✅ Filtrado automático en cada actualización SSE

### Ejecutar pruebas:
```bash
cd scripts
node test-hidden-accounts-system.js
node test-sse-hidden-accounts.js
```

## 📝 Beneficios

1. **Mejor UX**: Las cuentas ocultas no reaparecen inmediatamente
2. **Persistencia**: Las preferencias del usuario se mantienen
3. **Flexibilidad**: Las cuentas pueden reaparecer cuando sea apropiado
4. **Integridad**: El sistema CSV permanece intacto
5. **Automatización**: Limpieza automática cuando se ejecuta Link Platforms

## 🔮 Casos de Uso

### Caso 1: Usuario oculta cuentas temporalmente
- **Acción**: Usuario oculta cuentas que no quiere ver
- **Resultado**: Cuentas permanecen ocultas hasta Link Platforms
- **Beneficio**: Interfaz más limpia

### Caso 2: Link Platforms se ejecuta
- **Acción**: Proceso de Link Platforms se completa
- **Resultado**: Todas las cuentas ocultas vuelven a aparecer
- **Beneficio**: Usuario puede ver nuevas cuentas detectadas

### Caso 3: App se reinicia
- **Acción**: Usuario cierra y abre la app
- **Resultado**: Cuentas ocultas permanecen ocultas
- **Beneficio**: Preferencias del usuario se mantienen

### Caso 4: Logout del usuario
- **Acción**: Usuario hace logout
- **Resultado**: Todas las cuentas ocultas se limpian
- **Beneficio**: Limpieza completa de datos de usuario

## ⚙️ Configuración

### Variables de entorno:
- No se requieren variables adicionales
- El sistema usa localStorage nativo del navegador

### Claves de localStorage:
- `hiddenPendingAccounts`: Almacena las cuentas ocultas
- Se limpia automáticamente en logout
- Se limpia cuando se ejecuta Link Platforms

## 🚀 Implementación

### Archivos modificados:
1. `src/hooks/useHiddenPendingAccounts.ts` (nuevo)
2. `src/hooks/usePendingAccounts.ts` (actualizado)
3. `src/hooks/useLinkPlatforms.ts` (actualizado)
4. `src/components/PendingAccountsManager.tsx` (actualizado)
5. `src/context/AuthContext.tsx` (actualizado)

### Archivos de prueba:
1. `scripts/test-hidden-accounts-system.js` (nuevo)
2. `scripts/test-sse-hidden-accounts.js` (nuevo)

### Documentación:
1. `docs/HIDDEN_ACCOUNTS_PERSISTENCE_SYSTEM.md` (nuevo)

## 📊 Métricas

### Logs del sistema:
- `👻 Hidden pending account: {accountId} ({platform})`
- `👁️ Filtered {count} hidden accounts`
- `👁️ SSE update: {count} hidden accounts filtered`
- `🔄 Updating pending accounts from SSE while respecting hidden accounts`
- `🧹 Clearing hidden pending accounts after Link Platforms completion`
- `📋 Loaded {count} hidden pending accounts from localStorage`

### Monitoreo:
- Número de cuentas ocultas en localStorage
- Frecuencia de limpieza automática
- Persistencia entre sesiones
