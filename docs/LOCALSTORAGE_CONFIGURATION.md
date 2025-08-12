# Configuraciones de localStorage

## Descripción General

La aplicación ahora guarda automáticamente las preferencias del usuario en localStorage para que persistan entre sesiones. Esto incluye:

1. **Visibilidad de la sección de cuentas pendientes**
2. **Visibilidad de la dirección IP en la barra superior**

## Configuraciones Implementadas

### 1. Sección de Cuentas Pendientes (`pendingAccountsCollapsed`)

**Ubicación**: `src/components/PendingAccountsManager.tsx`

**Funcionalidad**: Controla si la sección de cuentas pendientes está colapsada o expandida.

**Clave localStorage**: `'pendingAccountsCollapsed'`

**Valores**:
- `true`: La sección está colapsada (oculta)
- `false`: La sección está expandida (visible)

**Valor por defecto**: `false` (visible)

**Implementación**:
```typescript
// Inicialización desde localStorage
const [isCollapsed, setIsCollapsed] = useState(() => {
  const saved = localStorage.getItem('pendingAccountsCollapsed');
  return saved ? JSON.parse(saved) : false;
});

// Guardar cambios en localStorage
useEffect(() => {
  localStorage.setItem('pendingAccountsCollapsed', JSON.stringify(isCollapsed));
}, [isCollapsed]);
```

### 2. Visibilidad de IP (`showIP`)

**Ubicación**: `src/components/Dashboard.tsx`

**Funcionalidad**: Controla si la dirección IP del usuario se muestra en la barra superior.

**Clave localStorage**: `'showIP'`

**Valores**:
- `true`: La IP se muestra
- `false`: La IP está oculta (se muestra como `••••••••`)

**Valor por defecto**: `true` (visible)

**Implementación**:
```typescript
// Inicialización desde localStorage
const [showIP, setShowIP] = useState<boolean>(() => {
  const saved = localStorage.getItem('showIP');
  return saved ? JSON.parse(saved) : true;
});

// Guardar cambios en localStorage
useEffect(() => {
  localStorage.setItem('showIP', JSON.stringify(showIP));
}, [showIP]);
```

## Comportamiento del Usuario

### Al iniciar la aplicación:
1. Se cargan las configuraciones guardadas desde localStorage
2. Si no hay configuración guardada, se usan los valores por defecto
3. La interfaz se renderiza con el estado guardado

### Al cambiar configuraciones:
1. El usuario hace clic en los botones de mostrar/ocultar
2. El estado se actualiza inmediatamente en la interfaz
3. El cambio se guarda automáticamente en localStorage
4. La configuración persiste para la próxima sesión

## Estructura de localStorage

```json
{
  "pendingAccountsCollapsed": "false",
  "showIP": "true"
}
```

## Ventajas de la Implementación

1. **Persistencia**: Las preferencias del usuario se mantienen entre sesiones
2. **Experiencia de usuario mejorada**: No necesita reconfigurar sus preferencias cada vez
3. **Implementación simple**: Usa localStorage nativo del navegador
4. **Valores por defecto sensatos**: Si no hay configuración, usa valores que hacen sentido
5. **Sincronización automática**: Los cambios se guardan inmediatamente

## Consideraciones Técnicas

- **Compatibilidad**: localStorage está disponible en todos los navegadores modernos
- **Límites**: localStorage tiene un límite de ~5-10MB por dominio
- **Seguridad**: Los datos se almacenan localmente en el navegador del usuario
- **Privacidad**: Las configuraciones son específicas del navegador/dispositivo

## Pruebas

Se incluye un script de prueba en `scripts/test-localStorage-config.js` que verifica:

- Inicialización correcta de estados
- Guardado de configuraciones
- Valores por defecto
- Diferentes escenarios de localStorage

Para ejecutar las pruebas:
```bash
node scripts/test-localStorage-config.js
```

## Futuras Mejoras

- Sincronización entre dispositivos (si se implementa autenticación en la nube)
- Configuraciones adicionales como tema, idioma, etc.
- Backup/restore de configuraciones
- Configuraciones específicas por usuario (si se implementa multi-usuario)
