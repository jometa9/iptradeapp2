# 🧪 Scripts de Testing y Mantenimiento

Scripts útiles para probar las funcionalidades del sistema de copy trading y realizar tareas de mantenimiento.

## 📋 Scripts Disponibles

### 🆕 **Scripts de Agregar Cuentas**

#### 1. Agregar Cuentas Pendientes (Básico)
```bash
node scripts/add-pending-accounts.js
```

#### 2. Agregar Cuentas Pendientes (Nuevo)
```bash
node scripts/add-pending-accounts-new.js
```

#### 3. Agregar Cuentas Pendientes de Prueba
```bash
node scripts/add-test-pending-accounts.js
```

#### 4. Agregar Cuentas Pendientes con Plataformas
```bash
node scripts/add-old-accounts-with-platforms.js
```

#### 5. Agregar Cuentas Pendientes Correctas
```bash
node scripts/add-correct-pending-accounts.js
```

#### 6. Agregar Test Slaves
```bash
node scripts/add-test-slaves.js
```

### 🧹 **Scripts de Limpieza**

#### 1. Limpiar Cuentas Pendientes
```bash
node scripts/clear-pending-accounts.js
```

#### 2. Limpiar Cuentas Antiguas
```bash
node scripts/clean-old-accounts.js
```

#### 3. Limpieza Final
```bash
node scripts/final-cleanup.js
```

### 🔧 **Scripts de Actualización y Configuración**

#### 1. Actualizar Configuración del Servidor con Cuentas Correctas
```bash
node scripts/update-server-config-with-correct-accounts.js
```

#### 2. Actualizar Configuración del Servidor con Plataformas
```bash
node scripts/update-server-config-with-platforms.js
```

#### 3. Actualizar Cuentas Antiguas con Plataformas
```bash
node scripts/update-old-accounts-platforms.js
```

#### 4. Actualizar Todas las Cuentas con Plataformas
```bash
node scripts/update-all-accounts-with-platforms.js
```

#### 5. Arreglar Cuentas Antiguas Directamente
```bash
node scripts/fix-old-accounts-direct.js
```

### 🔗 **Scripts de Conectividad**

#### 1. Arreglar Función de Conectividad
```bash
node scripts/fix-connectivity-function.js
```

#### 2. Arreglar Estadísticas de Conectividad
```bash
node scripts/fix-connectivity-stats.js
```

#### 3. Obtener Estadísticas de Conectividad (Temporal)
```bash
node scripts/temp-getConnectivityStats.js
```

### 🧪 **Scripts de Testing**

#### 1. Testing de Plataforma
```bash
node scripts/test-platform-fix.js
```

#### 2. Testing de Agregar Pendientes con Plataformas
```bash
node scripts/test-add-pending-with-platforms.js
```

#### 3. Testing de Conectividad
```bash
node scripts/test-connectivity-simple.js
node scripts/test-connectivity-simple.cjs
node scripts/test-connectivity-fix.js
node scripts/test-connectivity-stats.js
```

#### 4. Testing de Cuentas Pendientes
```bash
node scripts/test-pending-accounts.cjs
node scripts/test-pending-accounts-limits.js
```

#### 5. Testing de Suscripciones
```bash
node scripts/test-subscription.js
node scripts/test-subscription-limits.cjs
node scripts/test-new-subscription-structure.js
```

#### 6. Testing de Límites
```bash
node scripts/test-account-limit-message.js
node scripts/test-managed-vps-limits.js
```

#### 7. Testing de Eliminación
```bash
node scripts/test-delete-accounts.js
```

#### 8. Testing de Endpoints
```bash
node scripts/test-endpoint-simple.js
```

#### 9. Testing de Frontend
```bash
node scripts/test-frontend-numbers.js
```

#### 10. Testing de Tray
```bash
node scripts/test-tray.js
```

#### 11. Testing de Configuración
```bash
node scripts/test-load-config.cjs
```

#### 12. Testing de Offline
```bash
node scripts/test-offline-never-enabled.cjs
```

### 🐛 **Scripts de Debug**

#### 1. Debug de Números
```bash
node scripts/debug-numbers.js
```

#### 2. Debug de Conteo Offline
```bash
node scripts/debug-offline-count.cjs
```

### 🛠️ **Scripts de Utilidad**

#### 1. Arreglo Simple
```bash
node scripts/simple-fix.js
```

#### 2. Reemplazar Función
```bash
node scripts/replace-function.cjs
```

#### 3. Generar Entorno de Trading Realista
```bash
node scripts/generate-realistic-trading-environment.js
```

#### 4. Release
```bash
node scripts/release.js
```

## 🚀 Flujo de Testing Recomendado

### Paso 1: Agregar Cuentas de Prueba
```bash
node scripts/add-pending-accounts.js
```

### Paso 2: Abrir la Aplicación
```bash
npm run dev
```
Luego abre http://localhost:5173

### Paso 3: Probar Funcionalidades

#### ✅ **Panel de Cuentas Pendientes**
- Verifica que aparezcan las 6 cuentas pendientes
- Observa diferentes plataformas y brokers
- Nota los diferentes tiempos de "waiting since"

#### ✅ **Conversión de Cuentas**
- **Convertir a Master:** Haz clic en "Make Master" en cualquier cuenta
  - Llena el formulario con nombre, plataforma, broker
  - Verifica que aparezca en la sección "Master Accounts"

- **Convertir a Slave:** Haz clic en "Make Slave" en otra cuenta
  - Opcionalmente conecta a un master existente
  - Verifica que aparezca en la sección correspondiente

#### ✅ **Controles del Copier Status**
- **Control Global:**
  - Toggle el switch global ON/OFF
  - Verifica que afecte todos los masters y slaves

- **Control por Master:**
  - Toggle switches individuales de masters
  - Verifica que solo afecte slaves conectados a ese master

- **Control por Slave:**
  - Toggle switches individuales de slaves
  - Verifica que solo afecte esa cuenta específica

#### ✅ **Botones de Emergencia**
- **Emergency Stop:** Apaga todos los copiers inmediatamente
- **Reset All ON:** Enciende todos los copiers

### Paso 4: Limpiar para Nuevas Pruebas (Opcional)
```bash
node scripts/clear-pending-accounts.js
```

## 🔍 Verificar Estados mediante API

### Ver Cuentas Pendientes
```bash
curl -X GET http://localhost:3000/api/copier/status
```

### Ver Estado del Copier
```bash
curl -X GET http://localhost:3000/api/copier/status
```

### Cambiar Estado Global
```bash
curl -X POST http://localhost:3000/api/copier/global \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

## 🎯 Casos de Prueba Importantes

### 1. **Lógica Cascada del Copier**
- Global OFF → Todo debe estar OFF
- Master OFF → Sus slaves deben estar OFF
- Slave OFF → Solo esa cuenta OFF

### 2. **Conversión de Cuentas**
- Pending → Master (debe aparecer en gestión)
- Pending → Slave conectado a Master
- Pending → Slave no conectado

### 3. **UI Responsiva**
- Switches se deshabilitan apropiadamente
- Loading states durante operaciones
- Badges muestran estados correctos
- Alertas cuando global está OFF

## 🆘 Troubleshooting

### Si no aparecen las cuentas pendientes:
1. Verifica que el servidor esté corriendo (`npm run dev`)
2. Checa la consola del navegador por errores
3. Verifica endpoint: `curl http://localhost:3000/api/accounts/pending`

### Si los switches no funcionan:
1. Abre Network tab en DevTools
2. Observa las llamadas API al hacer toggle
3. Verifica que no haya errores CORS

### Para resetear completamente:
```bash
node scripts/clear-pending-accounts.js
node scripts/add-pending-accounts.js
```

## 🎉 ¡Listo para Testing!

Ahora tienes un entorno completo para probar todas las funcionalidades del sistema de copy trading. Las cuentas de prueba simulan diferentes escenarios reales que podrías encontrar en producción.

¡Diviértete probando! 🚀
