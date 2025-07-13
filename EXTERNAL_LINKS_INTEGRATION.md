# Integración de Enlaces Externos en Electron

## Descripción

Esta aplicación Electron ahora tiene configurada la funcionalidad para abrir enlaces externos en el navegador del usuario de manera segura y consistente.

## Funcionalidades Implementadas

### 1. Configuración en el Main Process (`electron/main.cjs`)

- **Importación de `shell`**: Se agregó `shell` a las importaciones de Electron
- **Handler IPC**: Se creó un handler `open-external-link` que usa `shell.openExternal()`
- **Window Open Handler**: Se configuró `setWindowOpenHandler` para interceptar enlaces y abrirlos externamente

### 2. API en el Preload Script (`electron/preload.cjs`)

- Se expuso la función `openExternalLink` al renderer process de forma segura
- Mantiene el contexto aislado para seguridad

### 3. Hook Personalizado (`src/hooks/useExternalLink.ts`)

- Hook `useExternalLink` que proporciona una interfaz consistente
- Fallback automático a `window.open` cuando no está en Electron
- Manejo de errores integrado

### 4. Tipos TypeScript (`src/types/electron.d.ts`)

- Definición completa de la interfaz `electronAPI`
- Tipado seguro para todas las funciones expuestas

## Uso en Componentes

### Ejemplo Básico

```typescript
import { useExternalLink } from '../hooks/useExternalLink';

export const MyComponent = () => {
  const { openExternalLink } = useExternalLink();

  const handleClick = () => {
    openExternalLink('https://example.com');
  };

  return <button onClick={handleClick}>Abrir Enlace</button>;
};
```

### En Enlaces HTML

```typescript
<a
  href="https://example.com"
  target="_blank"
  rel="noopener noreferrer"
  onClick={(e) => {
    e.preventDefault();
    openExternalLink('https://example.com');
  }}
>
  Enlace Externo
</a>
```

## Componentes Actualizados

Los siguientes componentes han sido actualizados para usar la nueva funcionalidad:

1. **Dashboard.tsx**: Enlace de ayuda
2. **LoginScreen.tsx**: Enlace de gestión de suscripción
3. **AccountInfoCard.tsx**: Enlaces de suscripción
4. **CtraderManager.tsx**: URLs de autenticación OAuth

## Ventajas de la Implementación

### Seguridad
- Context isolation habilitado
- API expuesta de forma segura a través del preload script
- Validación de URLs en el main process

### Consistencia
- Mismo comportamiento en desarrollo y producción
- Fallback automático cuando no está en Electron
- Interfaz unificada a través del hook

### Experiencia de Usuario
- Los enlaces se abren en el navegador predeterminado del usuario
- No se crean ventanas adicionales de Electron
- Comportamiento nativo del sistema operativo

## Configuración Técnica

### Main Process
```javascript
// Handler para abrir enlaces externos
ipcMain.handle('open-external-link', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external link:', error);
    return { success: false, error: error.message };
  }
});

// Manejar enlaces externos automáticamente
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url);
  return { action: 'deny' };
});
```

### Preload Script
```javascript
// API para abrir enlaces externos
openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
```

### Hook
```typescript
export const useExternalLink = () => {
  const openExternalLink = useCallback((url: string) => {
    if (window.electronAPI?.openExternalLink) {
      return window.electronAPI.openExternalLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve({ success: true });
    }
  }, []);

  return { openExternalLink };
};
```

## Consideraciones de Seguridad

1. **Validación de URLs**: El main process puede validar URLs antes de abrirlas
2. **Context Isolation**: Mantenido para prevenir acceso directo a APIs del sistema
3. **Error Handling**: Manejo robusto de errores en todos los niveles
4. **Fallback Seguro**: Funciona tanto en Electron como en navegador web

## Pruebas

Para probar la funcionalidad:

1. Ejecutar la aplicación en modo Electron
2. Hacer clic en cualquier enlace externo (ayuda, suscripción, etc.)
3. Verificar que se abra en el navegador predeterminado
4. Probar en modo desarrollo para verificar el fallback
