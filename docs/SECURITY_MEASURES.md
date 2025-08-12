# Medidas de Seguridad - Teclas de Acceso Rápido

## Descripción

Este documento describe las medidas de seguridad implementadas en la aplicación Electron para prevenir que los usuarios accedan a funcionalidades del navegador que podrían comprometer la seguridad o la experiencia de usuario.

## Teclas de Acceso Rápido Deshabilitadas

### Refresh/Recarga
- `Ctrl+R` (Windows/Linux) / `Cmd+R` (macOS) - Refresh normal
- `F5` - Refresh
- `Ctrl+Shift+R` (Windows/Linux) / `Cmd+Shift+R` (macOS) - Hard refresh

### Herramientas de Desarrollo (DevTools)
- `F12` - Abrir DevTools
- `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Shift+I` (macOS) - Abrir DevTools
- `Ctrl+Shift+C` (Windows/Linux) / `Cmd+Shift+C` (macOS) - Inspector de elementos
- `Ctrl+Shift+J` (Windows/Linux) / `Cmd+Shift+J` (macOS) - Consola de JavaScript
- `Ctrl+Shift+M` (Windows/Linux) / `Cmd+Shift+M` (macOS) - Modo responsive design
- `Cmd+Option+I` (macOS) - Abrir DevTools (combinación específica de macOS)

### Ver Código Fuente
- `Ctrl+U` (Windows/Linux) / `Cmd+U` (macOS) - Ver código fuente de la página

### Navegación del Navegador
- `Ctrl+L` (Windows/Linux) / `Cmd+L` (macOS) - Ir a la barra de direcciones
- `Ctrl+T` (Windows/Linux) / `Cmd+T` (macOS) - Nueva pestaña
- `Ctrl+W` (Windows/Linux) / `Cmd+W` (macOS) - Cerrar pestaña
- `Ctrl+N` (Windows/Linux) / `Cmd+N` (macOS) - Nueva ventana

### Zoom
- `Ctrl+=` (Windows/Linux) / `Cmd+=` (macOS) - Zoom in
- `Ctrl+-` (Windows/Linux) / `Cmd+-` (macOS) - Zoom out
- `Ctrl+0` (Windows/Linux) / `Cmd+0` (macOS) - Reset zoom

## Otras Medidas de Seguridad

### Menú Contextual
- El menú contextual del navegador (clic derecho) está completamente deshabilitado

### DevTools
- Las DevTools están completamente deshabilitadas en producción
- Si se intenta abrir las DevTools, se cierran automáticamente
- En modo desarrollo, las DevTools permanecen habilitadas para facilitar el debugging

### Ventanas Pop-up
- Se previene la apertura de nuevas ventanas del navegador
- Todos los enlaces externos se abren en el navegador del sistema operativo

## Implementación Técnica

### Archivo Principal
- `electron/main.cjs` - Contiene toda la lógica de seguridad

### Eventos Interceptados
1. `before-input-event` - Intercepta todas las combinaciones de teclas
2. `context-menu` - Previene el menú contextual
3. `devtools-opened` - Cierra las DevTools si se abren
4. `window-open` - Previene nuevas ventanas

### Configuración de WebPreferences
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.cjs'),
  devTools: isDev, // Solo habilitar en desarrollo
}
```

## Logs de Seguridad

Todas las acciones bloqueadas se registran en la consola con el prefijo `[SECURITY]`:

```
[SECURITY] Blocked shortcut: Ctrl+R (Refresh)
[SECURITY] DevTools attempted to open - closing immediately
[SECURITY] Blocked window open attempt: https://example.com
```

## Consideraciones

### Modo Desarrollo
- En modo desarrollo (`NODE_ENV=development`), las DevTools permanecen habilitadas
- Las teclas de acceso rápido siguen bloqueadas para mantener consistencia

### Compatibilidad Multiplataforma
- Las combinaciones de teclas se adaptan automáticamente según el sistema operativo
- En macOS, `Cmd` se mapea a `Ctrl` para mantener consistencia
- Se incluyen combinaciones específicas de macOS como `Cmd+Option+I`

### Experiencia de Usuario
- Los usuarios no pueden acceder a funcionalidades del navegador que podrían confundirlos
- Se mantiene la funcionalidad esencial de la aplicación
- Los enlaces externos siguen funcionando normalmente

## Mantenimiento

Para agregar nuevas teclas de acceso rápido bloqueadas:

1. Agregar la nueva condición en el array `disabledShortcuts`
2. Incluir un nombre descriptivo para el logging
3. Probar en todas las plataformas soportadas
4. Actualizar esta documentación

## Ejemplo de Agregar Nueva Tecla Bloqueada

```javascript
const disabledShortcuts = [
  // ... teclas existentes ...
  { condition: isCtrl && key === 'nueva-tecla', name: 'Ctrl+Nueva (Descripción)' },
];
```
