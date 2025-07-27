# Test Completo de Funcionalidad del Servidor

Este conjunto de scripts permite probar toda la funcionalidad del servidor desde cero hasta el final, siguiendo el flujo completo de operaciones.

## 📋 Funcionalidades Probadas

El test completo incluye las siguientes funcionalidades:

1. **Agregar cuentas pending** - Registro automático de cuentas pendientes
2. **Conectar masters** - Registro y configuración de cuentas master
3. **Conectar slaves** - Registro y conexión de cuentas slave a masters
4. **Simular cuentas offline y reactivarlas** - Prueba del sistema de polling
5. **Prender/apagar global status** - Control del estado global del copier
6. **Copiar desde master** - Envío de órdenes desde cuentas master
7. **Escuchar desde slave** - Recepción de órdenes en cuentas slave

## 🚀 Scripts Disponibles

### 1. `test-complete-server-functionality.js`
**Test completo de todas las funcionalidades**

```bash
node scripts/test-complete-server-functionality.js
```

Este script ejecuta todos los pasos del test pero **NO limpia** los datos de prueba.

### 2. `cleanup-test-data.js`
**Limpieza de datos de prueba**

```bash
node scripts/cleanup-test-data.js
```

Este script elimina todos los datos de prueba creados durante el test.

### 3. `run-complete-test.js`
**Test completo + limpieza automática**

```bash
node scripts/run-complete-test.js
```

Este script ejecuta el test completo y luego limpia automáticamente todos los datos de prueba.

## 📊 Cuentas de Prueba Utilizadas

El test utiliza las siguientes cuentas de prueba:

```javascript
const TEST_ACCOUNTS = {
  master1: '5038002547',    // Master Account 1 (MT4)
  master2: '94424443',      // Master Account 2 (MT5)
  slave1: '123456789',      // Slave Account 1 (MT4)
  slave2: '987654321',      // Slave Account 2 (MT5)
  pending1: '111111111',    // Pending Account 1 (MT5)
  pending2: '222222222',    // Pending Account 2 (MT4)
  pending3: '333333333'     // Pending Account 3 (cTrader)
};
```

## 🔧 Configuración

### Variables de Configuración

```javascript
const BASE_URL = 'http://localhost:30/api';
const API_KEY = 'iptrade_89536f5b9e643c0433f3';
```

### Requisitos

- Servidor corriendo en `localhost:30`
- API key válida configurada
- Node.js con soporte para ES modules

## 📝 Flujo Detallado del Test

### Paso 1: Agregar Cuentas Pending
- Registra 3 cuentas pending con diferentes plataformas
- Verifica que se registren correctamente
- **Endpoint**: `POST /accounts/register-pending`

### Paso 2: Conectar Masters
- Registra 2 cuentas master (MT4 y MT5)
- Configura nombres, descripciones y brokers
- **Endpoint**: `POST /accounts/master`

### Paso 3: Conectar Slaves
- Registra 2 cuentas slave
- Conecta cada slave a un master específico
- **Endpoint**: `POST /accounts/slave`

### Paso 4: Simular Offline/Online
- Simula actividad de cuentas pending
- Espera 6 segundos para que se marquen como offline
- Simula reconexión enviando pings
- Verifica reactivación automática
- **Endpoint**: `POST /accounts/ping`

### Paso 5: Probar Global Status
- Obtiene estado global actual
- Deshabilita global status
- Verifica deshabilitación
- Habilita global status
- Verifica habilitación
- **Endpoint**: `POST /copier/global`

### Paso 6: Copiar desde Master
- Activa cuenta master con ping
- Habilita copy trading para el master
- Envía orden de trading desde master
- Verifica que la orden se procese
- **Endpoint**: `POST /orders/neworder`

### Paso 7: Escuchar desde Slave
- Activa cuenta slave con ping
- Habilita copy trading para el slave
- Consulta órdenes disponibles para el slave
- Verifica configuración del slave
- **Endpoint**: `GET /orders/neworder`

## 🧹 Limpieza Automática

El script de limpieza elimina:

- ✅ Cuentas master de prueba
- ✅ Cuentas slave de prueba
- ✅ Cuentas pending de prueba
- ✅ Configuraciones de trading
- ✅ Estados de copier
- ✅ Conexiones master-slave

## 📈 Resultados Esperados

### Test Exitoso
```
🚀 INICIANDO TEST COMPLETO DE FUNCIONALIDAD DEL SERVIDOR
✅ Servidor está funcionando correctamente

📋 PASO 1: AGREGAR CUENTAS PENDING
✅ Cuenta pending 111111111 registrada exitosamente
✅ Cuenta pending 222222222 registrada exitosamente
✅ Cuenta pending 333333333 registrada exitosamente
✅ Se encontraron 3 cuentas pending

📋 PASO 2: CONECTAR MASTERS
✅ Cuenta master 5038002547 registrada exitosamente
✅ Cuenta master 94424443 registrada exitosamente
✅ Se encontraron 2 cuentas master

📋 PASO 3: CONECTAR SLAVES
✅ Cuenta slave 123456789 registrada y conectada a master 5038002547
✅ Cuenta slave 987654321 registrada y conectada a master 94424443
✅ Se encontraron 2 conexiones master-slave

📋 PASO 4: SIMULAR CUENTAS OFFLINE Y REACTIVARLAS
✅ Ping exitoso para cuenta pending 111111111
✅ Ping exitoso para cuenta pending 222222222
✅ Ping exitoso para cuenta pending 333333333
✅ Cuenta 111111111 correctamente marcada como offline
✅ Cuenta 222222222 correctamente marcada como offline
✅ Cuenta 333333333 correctamente marcada como offline
✅ Ping de reconexión exitoso para cuenta 111111111
✅ Ping de reconexión exitoso para cuenta 222222222
✅ Ping de reconexión exitoso para cuenta 333333333
✅ Cuenta 111111111 correctamente reactivada
✅ Cuenta 222222222 correctamente reactivada
✅ Cuenta 333333333 correctamente reactivada

📋 PASO 5: PROBAR GLOBAL STATUS
✅ Global status deshabilitado exitosamente
✅ Global status correctamente deshabilitado
✅ Global status habilitado exitosamente
✅ Global status correctamente habilitado

📋 PASO 6: COPIAR DESDE MASTER
✅ Master activado exitosamente
✅ Copy trading habilitado para el master
✅ Orden enviada desde master exitosamente
✅ Configuración de trading del master obtenida

📋 PASO 7: ESCUCHAR DESDE SLAVE
✅ Slave activado exitosamente
✅ Copy trading habilitado para el slave
✅ Consulta de órdenes desde slave exitosa
✅ Configuración del slave obtenida

📊 RESUMEN FINAL DEL TEST
✅ Todos los pasos del test se completaron
✅ El servidor está funcionando correctamente con todas las funcionalidades

🧹 LIMPIANDO DATOS DE PRUEBA
✅ Cuenta master 5038002547 eliminada exitosamente
✅ Cuenta master 94424443 eliminada exitosamente
✅ Cuenta slave 123456789 eliminada exitosamente
✅ Cuenta slave 987654321 eliminada exitosamente
✅ Cuenta pending 111111111 eliminada exitosamente
✅ Cuenta pending 222222222 eliminada exitosamente
✅ Cuenta pending 333333333 eliminada exitosamente
✅ Limpieza completada exitosamente

📊 RESUMEN FINAL
✅ Test completo ejecutado exitosamente en 45 segundos
✅ El servidor está funcionando correctamente con todas las funcionalidades
✅ Todos los datos de prueba han sido eliminados
✅ El sistema está listo para uso normal
```

## ⚠️ Notas Importantes

1. **Servidor Requerido**: El servidor debe estar corriendo en `localhost:30`
2. **API Key**: Usa la API key de prueba configurada
3. **Tiempo de Ejecución**: El test completo toma aproximadamente 30-60 segundos
4. **Datos Temporales**: Los datos de prueba se eliminan automáticamente
5. **Logs Detallados**: El script proporciona logs coloridos y detallados

## 🔍 Troubleshooting

### Error de Conexión
```
❌ No se pudo conectar al servidor
```
**Solución**: Verificar que el servidor esté corriendo en `localhost:30`

### Error de API Key
```
❌ Error obteniendo cuentas: 401
```
**Solución**: Verificar que la API key sea válida

### Error de Endpoint
```
❌ Error registrando cuenta master: 404
```
**Solución**: Verificar que todos los endpoints estén disponibles

## 📚 Scripts Relacionados

- `list-scripts.js` - Lista todos los scripts disponibles
- `run.js` - Script principal para ejecutar otros scripts
- `debug-numbers.js` - Debug de números y estadísticas
- `test-connectivity-simple.js` - Test simple de conectividad

## 🎯 Uso Recomendado

Para testing completo del servidor:

```bash
# Ejecutar test completo con limpieza automática
node scripts/run-complete-test.js
```

Para testing sin limpieza:

```bash
# Solo ejecutar el test
node scripts/test-complete-server-functionality.js

# Luego limpiar manualmente si es necesario
node scripts/cleanup-test-data.js
```
