# Configuración de Límites para Usuarios Managed VPS

## Descripción

Los usuarios con plan `managed_vps` tienen acceso ilimitado a cuentas de trading, igual que los usuarios `unlimited` y `admin`. Esta configuración está implementada tanto en el frontend como en el backend.

## Configuración Actual

### 1. Frontend (src/lib/subscriptionUtils.ts)

```typescript
export const PLAN_LIMITS: Record<string, SubscriptionLimits> = {
  'free': {
    maxAccounts: 3,
    maxLotSize: 0.01,
    features: ['basic_copy_trading'],
  },
  'premium': {
    maxAccounts: 5,
    maxLotSize: null, // No limit
    features: ['advanced_copy_trading', 'custom_lot_sizes'],
  },
  'unlimited': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'advanced_features'],
  },
  'managed_vps': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support'],
  },
  'admin': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support', 'admin_access'],
  },
};
```

### 2. Backend (server/src/middleware/subscriptionAuth.js)

```javascript
const PLAN_LIMITS = {
  free: {
    maxAccounts: 3,
    maxLotSize: 0.01,
    features: ['basic_copy_trading'],
  },
  premium: {
    maxAccounts: 5,
    maxLotSize: null, // No limit
    features: ['advanced_copy_trading', 'custom_lot_sizes'],
  },
  unlimited: {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'advanced_features'],
  },
  managed_vps: {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support'],
  },
  admin: {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support', 'admin_access'],
  },
};
```

## Funciones de Validación

### 1. Frontend - canCreateMoreAccounts

```typescript
export const canCreateMoreAccounts = (userInfo: UserInfo, currentAccountCount: number): boolean => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);

  // If no limit (unlimited plan), allow creation
  if (limits.maxAccounts === null) {
    return true;
  }

  return currentAccountCount < limits.maxAccounts;
};
```

### 2. Backend - checkAccountLimits Middleware

```javascript
export const checkAccountLimits = (req, res, next) => {
  const limits = req.subscriptionLimits;

  // If no account limit (unlimited plan), allow creation
  if (limits.maxAccounts === null) {
    return next();
  }

  // Count existing accounts and check limits
  const accountCounts = countUserAccounts(req.apiKey);

  if (accountCounts.total >= limits.maxAccounts) {
    return res.status(403).json({
      error: 'Account limit exceeded',
      message: `Your ${displayPlanName} plan allows maximum ${limits.maxAccounts} accounts.`,
    });
  }

  next();
};
```

## Comportamiento por Tipo de Usuario

### ✅ Usuarios con Límites Ilimitados

| Tipo de Usuario | maxAccounts | Puede Crear Cuentas |
|-----------------|-------------|---------------------|
| `unlimited` | `null` | ✅ Sin límites |
| `managed_vps` | `null` | ✅ Sin límites |
| `admin` | `null` | ✅ Sin límites |

### ⚠️ Usuarios con Límites

| Tipo de Usuario | maxAccounts | Límite de Cuentas |
|-----------------|-------------|-------------------|
| `free` | `3` | Máximo 3 cuentas |
| `premium` | `5` | Máximo 5 cuentas |

## Verificación de Configuración

### 1. Test Script

Ejecutar el script de prueba:

```bash
node test-managed-vps-limits.js
```

### 2. Verificación Manual

1. **Frontend**: Verificar que `canCreateMoreAccounts` retorna `true` para usuarios `managed_vps`
2. **Backend**: Verificar que el middleware `checkAccountLimits` permite creación para `maxAccounts: null`
3. **UI**: Verificar que no se muestren límites en la interfaz para usuarios `managed_vps`

### 3. Logs de Verificación

```bash
# Frontend logs
🔍 isUnlimitedPlan: User is managed_vps, returning true
✅ isUnlimitedPlan: User is managed_vps, returning true

# Backend logs (solo en desarrollo)
📋 Using cached subscription validation for key: managed_vps_...
🔄 Cache miss or expired, validating subscription for: managed_vps_...
```

## Componentes de UI

### 1. SubscriptionLimitsCard

Los usuarios `managed_vps` NO ven la tarjeta de límites:

```typescript
export const shouldShowSubscriptionLimitsCard = (subscriptionType: string): boolean => {
  // Managed VPS users should never see limits card
  if (subscriptionType === 'managed_vps') {
    console.log('🖥️ Managed VPS user detected, subscription limits card should NOT be shown');
    return false;
  }

  // Only show the card for free users and Premium plan
  const typesToShow = ['free', 'premium'];
  return typesToShow.includes(subscriptionType);
};
```

### 2. TradingAccountsConfig

Los usuarios `managed_vps` pueden crear cuentas sin restricciones:

```typescript
const canAddMoreAccounts = userInfo ? canCreateMoreAccounts(userInfo, accounts.length) : false;

// Para usuarios managed_vps, canAddMoreAccounts siempre será true
if (!canAddMoreAccounts) {
  // Este bloque nunca se ejecuta para usuarios managed_vps
  toastUtil({
    title: 'Account Limit Reached',
    description: `Your ${planDisplayName} plan has reached the maximum number of accounts allowed.`,
    variant: 'destructive',
  });
  return;
}
```

## Características Especiales

### 1. Features Incluidas

Los usuarios `managed_vps` tienen acceso a:

- ✅ `unlimited_copy_trading`: Copy trading ilimitado
- ✅ `managed_vps`: Acceso a características de VPS gestionado
- ✅ `priority_support`: Soporte prioritario
- ✅ `custom_lot_sizes`: Tamaños de lot personalizados
- ✅ `advanced_features`: Características avanzadas

### 2. Validación de Lot Size

```typescript
export const canSetCustomLotSizes = (userInfo: UserInfo): boolean => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);
  return limits.maxLotSize === null; // true para managed_vps
};
```

## Consideraciones de Seguridad

1. **Validación Backend**: Siempre se valida en el servidor, no solo en el frontend
2. **Cache Seguro**: Los límites se almacenan en cache pero se validan en cada request
3. **Middleware Protegido**: Todas las rutas de creación de cuentas usan `checkAccountLimits`
4. **Logs de Auditoría**: Se registran todas las validaciones para auditoría

## Troubleshooting

### Problema: Usuario managed_vps no puede crear cuentas

**Solución:**
1. Verificar que `subscriptionType` sea exactamente `'managed_vps'`
2. Verificar que el backend esté usando la configuración correcta
3. Limpiar cache del backend: `POST /api/clear-subscription-cache`
4. Verificar logs del middleware `checkAccountLimits`

### Problema: Se muestra límite de cuentas en la UI

**Solución:**
1. Verificar que `shouldShowSubscriptionLimitsCard` retorne `false` para `managed_vps`
2. Verificar que `isUnlimitedPlan` retorne `true` para `managed_vps`
3. Limpiar cache del frontend: `localStorage.removeItem('iptrade_license_key_last_validation')`

## Pruebas

### Para verificar la configuración:

1. **Crear usuario managed_vps**:
   - Debería poder crear cuentas sin límites
   - No debería ver tarjeta de límites
   - Debería tener acceso a todas las características

2. **Verificar logs**:
   - Backend: `maxAccounts: null` en logs de validación
   - Frontend: `isUnlimitedPlan: true` para managed_vps

3. **Test de límites**:
   - Intentar crear 100+ cuentas
   - Verificar que no se bloquee
   - Verificar que no se muestren mensajes de límite
