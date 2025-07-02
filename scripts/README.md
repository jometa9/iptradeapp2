# 🧪 Testing Scripts

Scripts útiles para probar las funcionalidades del sistema de copy trading.

## 📋 Scripts Disponibles

### 1. 🆕 Agregar Cuentas Pendientes
```bash
node scripts/add-pending-accounts.js
```

**Qué hace:**
- Agrega 6 cuentas pendientes de prueba con diferentes plataformas
- Incluye MT4, MT5, cTrader y NinjaTrader
- Cada cuenta tiene diferentes tiempos de actividad para simular EAs reales
- Las cuentas aparecerán en el panel "Pending Accounts" del UI

**Cuentas que agrega:**
- `PENDING_MT4_001` - IC Markets (MT4) - Scalping EA
- `PENDING_MT5_002` - FTMO (MT5) - Swing Trading EA
- `PENDING_CTRADER_003` - Pepperstone (cTrader) - Grid Trading
- `PENDING_MT4_004` - XM (MT4) - EUR/USD Specialist
- `PENDING_MT5_005` - Admiral Markets (MT5) - Multi-Currency EA
- `PENDING_NINJA_006` - AMP Futures (NinjaTrader) - Futures Algorithm

### 2. 🧹 Limpiar Cuentas Pendientes
```bash
node scripts/clear-pending-accounts.js
```

**Qué hace:**
- Elimina todas las cuentas pendientes existentes
- Útil para resetear el estado y hacer pruebas frescas
- No afecta cuentas master/slave ya configuradas

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
