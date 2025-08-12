# Implementación: Eliminación Solo Frontend para Cuentas Pendientes

## 🎯 Objetivo

Actualizar el sistema de cuentas pendientes para que el botón de eliminar solo borre desde el frontend, sin hacer llamadas al servidor. Esto permite que las cuentas puedan reaparecer cuando el usuario inicie el proceso de link platforms, manteniendo la integridad del nuevo sistema CSV.

## 📋 Cambios Implementados

### 1. Hook `usePendingAccounts` (`src/hooks/usePendingAccounts.ts`)

#### Antes:
```typescript
const deletePendingAccount = useCallback(
  async (accountId: string) => {
    // Hacer llamada al servidor para eliminar del CSV
    const response = await fetch(`${baseUrl}/api/csv/pending/${accountId}`, {
      method: 'DELETE',
      headers: { 'x-api-key': secretKey },
    });
    // Refresh data después de la eliminación
    await loadPendingAccounts();
  },
  [secretKey, baseUrl, loadPendingAccounts]
);
```

#### Después:
```typescript
const deletePendingAccount = useCallback(
  async (accountId: string) => {
    // Solo eliminar del estado local del frontend
    if (pendingData && pendingData.accounts) {
      const updatedAccounts = pendingData.accounts.filter(
        account => account.account_id !== accountId
      );

      // Actualizar estado local y estadísticas
      const updatedPendingData = {
        ...pendingData,
        accounts: updatedAccounts,
        summary: {
          ...pendingData.summary,
          totalAccounts: updatedAccounts.length,
          platformStats: updatedAccounts.reduce((stats, account) => {
            // Recalcular estadísticas por plataforma
            const platform = account.platform || 'Unknown';
            if (!stats[platform]) {
              stats[platform] = { total: 0, online: 0, offline: 0 };
            }
            stats[platform].total++;
            if (account.current_status === 'online') {
              stats[platform].online++;
            } else {
              stats[platform].offline++;
            }
            return stats;
          }, {})
        }
      };

      setPendingData(updatedPendingData);
    }
  },
  [secretKey, pendingData]
);
```

### 2. Componente `PendingAccountsManager` (`src/components/PendingAccountsManager.tsx`)

#### Cambios en la función de eliminación:
```typescript
// Delete pending account from frontend only
const deletePendingAccount = async (accountId: string) => {
  setIsConverting(true);
  setConfirmingDeleteId(null);

  try {
    await deletePendingFromCSV(accountId);
    console.log(`✅ Successfully removed pending account from frontend: ${accountId}`);
    toast({
      title: 'Account Removed',
      description: 'Account removed from view. It may reappear if you start the link platforms process.',
      variant: 'default',
    });
  } catch (error) {
    console.error('Error removing pending account:', error);
    toast({
      title: 'Error',
      description: 'Error removing pending account from view',
      variant: 'destructive',
    });
  } finally {
    setIsConverting(false);
  }
};
```

#### Cambios en la UI:
- **Botón de confirmación**: Cambió de "Delete" a "Confirm Remove"
- **Botón de eliminación offline**: Tooltip actualizado a "Remove Pending Offline Account from View"
- **Estado de carga**: Cambió de "Deleting..." a "Removing..."
- **Mensaje de éxito**: Ahora indica que la cuenta fue removida de la vista y puede reaparecer

### 3. Script de Prueba (`scripts/test-frontend-only-delete.js`)

Nuevo script para verificar la funcionalidad:
- Simula eliminaciones frontend sin llamadas al servidor
- Verifica que los archivos CSV permanecen sin cambios
- Prueba múltiples eliminaciones consecutivas
- Valida que las estadísticas se actualizan correctamente

## 🔄 Comportamiento del Sistema

### Flujo de Eliminación:
1. **Usuario hace clic en "Remove from View"**
2. **Frontend filtra la cuenta del estado local**
3. **Se actualizan las estadísticas en tiempo real**
4. **Se muestra toast de confirmación**
5. **Los archivos CSV permanecen sin cambios**

### Reaparición de Cuentas:
- Cuando el usuario ejecuta "Link Platforms", el sistema escanea los archivos CSV
- Las cuentas que fueron "eliminadas" solo del frontend reaparecen automáticamente
- Esto mantiene la integridad del sistema CSV mientras mejora la experiencia del usuario

## ✅ Beneficios

1. **Mejor UX**: Eliminación instantánea sin esperar respuesta del servidor
2. **Integridad CSV**: Los archivos permanecen intactos
3. **Flexibilidad**: Las cuentas pueden reaparecer cuando sea necesario
4. **Rendimiento**: No hay llamadas HTTP innecesarias
5. **Consistencia**: Mantiene el nuevo sistema CSV simplificado

## 🧪 Pruebas

### Ejecutar el script de prueba:
```bash
cd scripts
node test-frontend-only-delete.js
```

### Verificaciones incluidas:
- ✅ Eliminación frontend funciona sin llamadas al servidor
- ✅ Archivos CSV permanecen sin cambios
- ✅ Estadísticas se actualizan correctamente
- ✅ Múltiples eliminaciones funcionan
- ✅ Cuentas pueden reaparecer con link platforms

## 📝 Notas Importantes

1. **No es eliminación permanente**: Las cuentas solo se ocultan del frontend
2. **Reaparición automática**: Al ejecutar link platforms, las cuentas vuelven a aparecer
3. **Estado local**: Los cambios solo afectan la sesión actual del usuario
4. **Compatibilidad**: Mantiene compatibilidad con el sistema CSV existente

## 🔮 Consideraciones Futuras

- Si se necesita eliminación permanente, se puede implementar un endpoint separado
- Se podría agregar una opción para "ocultar permanentemente" vs "ocultar temporalmente"
- Considerar persistencia local (localStorage) para mantener las eliminaciones entre sesiones
