# Optimización de Logs - IPTRADE App

## Problema Identificado

Los logs repetidos de validación de suscripción se deben a múltiples llamadas simultáneas al endpoint de validación. Esto ocurre por:

1. **Múltiples requests simultáneos** al cargar la página
2. **Polling frecuente** en el frontend (cada 1 segundo)
3. **Middleware de autenticación** que se ejecuta en cada request
4. **Falta de sistema de debounce** para evitar validaciones duplicadas

## Soluciones Implementadas

### 1. Sistema de Promesas en Vuelo (Backend)

Se implementó un sistema que evita validaciones duplicadas simultáneas:

```javascript
// En server/src/middleware/subscriptionAuth.js
const ongoingValidations = new Map();

export const validateSubscription = async apiKey => {
  // Si ya hay una validación en progreso, esperar el resultado
  if (ongoingValidations.has(apiKey)) {
    return await ongoingValidations.get(apiKey);
  }
  
  // Crear nueva promesa de validación
  const validationPromise = performValidation(apiKey);
  ongoingValidations.set(apiKey, validationPromise);
  
  try {
    return await validationPromise;
  } finally {
    ongoingValidations.delete(apiKey);
  }
};
```

### 2. Reducción de Polling (Frontend)

Se redujo el polling de 1 segundo a 5 segundos:

```javascript
// En src/hooks/useCSVData.ts
const pollingInterval = setInterval(() => {
  loadData();
}, 5000); // Cada 5 segundos en lugar de 1 segundo
```

### 3. Sistema de Debounce (Frontend)

Se implementó un sistema de debounce en el AuthContext:

```javascript
// En src/context/AuthContext.tsx
const validationInProgress = useRef<boolean>(false);
const validationPromise = useRef<Promise<any> | null>(null);

const validateLicense = async (apiKey) => {
  if (validationInProgress.current && validationPromise.current) {
    return await validationPromise.current;
  }
  
  validationInProgress.current = true;
  validationPromise.current = performValidation(apiKey);
  
  try {
    return await validationPromise.current;
  } finally {
    validationInProgress.current = false;
    validationPromise.current = null;
  }
};
```

### 4. Optimización de Logging

Se redujo el logging innecesario:

- Solo se loguea cuando se hace una validación nueva
- Se eliminó el logging cuando se usa cache
- Se agregaron logs más informativos para debugging

## Scripts de Utilidad

### Limpiar Cache

```bash
node clear_cache.js
```

Este script limpia:
- Archivos de cache locales
- Cache de validación de suscripción via API

### Verificar Estado del Cache

```bash
node scripts/check-cache-status.js
```

Este script muestra:
- Tamaño del cache de validación
- Validaciones en progreso
- Entradas en cache con detalles
- Estado de archivos de cache locales

## Endpoints de Debugging

### Limpiar Cache de Validación

```bash
POST /api/clear-subscription-cache
```

Opciones:
- Sin parámetros: Limpia todo el cache
- Con `apiKey`: Limpia cache específico

### Ver Estado del Cache

```bash
GET /api/subscription-cache-status
```

Retorna información detallada del cache de validación.

## Beneficios

1. **Menos logs repetidos**: Solo una validación por API key simultáneamente
2. **Mejor rendimiento**: Menos llamadas a la API externa
3. **Cache eficiente**: Validaciones se cachean por 12 horas
4. **Debugging mejorado**: Scripts y endpoints para monitorear el estado

## Monitoreo

Para verificar que las optimizaciones funcionan:

1. Ejecuta `node scripts/check-cache-status.js`
2. Observa los logs del servidor - deberían ser menos repetitivos
3. Verifica que el cache se está usando correctamente

## Troubleshooting

Si sigues viendo logs repetidos:

1. **Limpia el cache**: `node clear_cache.js`
2. **Reinicia el servidor**
3. **Verifica el estado**: `node scripts/check-cache-status.js`
4. **Revisa los logs** para identificar patrones específicos

## Notas Importantes

- El cache de validación dura 12 horas
- Las validaciones simultáneas del mismo API key se deduplican automáticamente
- El polling se redujo de 1s a 5s para reducir la carga
- Los scripts de debugging están disponibles para monitoreo continuo

