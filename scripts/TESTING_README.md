# 🧪 IPTRADE - Scripts de Testing

Este directorio contiene scripts para facilitar el testing de la aplicación IPTRADE con datos realistas.

## 📋 Scripts Disponibles

### 🎯 Gestión de Cuentas de Prueba

#### Comando Principal
```bash
npm run test:accounts [comando] [cantidad]
```

#### Comandos Específicos

**Generar cuentas pendientes:**
```bash
npm run test:accounts:generate    # Genera 8 cuentas (por defecto)
npm run test:accounts generate 5  # Genera 5 cuentas específicas
```

**Limpiar cuentas de prueba:**
```bash
npm run test:accounts:cleanup     # Elimina todas las cuentas de prueba
```

**Reset completo:**
```bash
npm run test:accounts:reset       # Limpia y genera 8 nuevas cuentas
npm run test:accounts reset 10    # Limpia y genera 10 nuevas cuentas
```

**Ayuda:**
```bash
npm run test:accounts help        # Muestra todas las opciones disponibles
```

## 🏗️ Qué Generan los Scripts

### Cuentas Pendientes Realistas

Los scripts crean cuentas con datos que simulan un entorno real:

**Plataformas Soportadas:**
- MT4 (MetaTrader 4)
- MT5 (MetaTrader 5)
- cTrader
- TradingView
- NinjaTrader

**Brokers Realistas:**
- ICMarkets
- Pepperstone
- XM
- FTMO
- MyForexFunds
- TheFundedTrader
- FivePercentOnline

**Tipos de Cuenta:**
- Live (Cuentas reales)
- Demo (Cuentas de demostración)
- Challenge (Cuentas de desafío)
- Funded (Cuentas financiadas)

### Estructura de Archivos CSV

Cada cuenta genera un archivo CSV con:
```csv
timestamp,account_id,account_type,status,action,data,master_id,platform
2024-01-15T10:30:00Z,12345678,unknown,connecting,connect,{},,MT4
2024-01-15T10:30:01Z,12345678,unknown,online,ping,{},,MT4
2024-01-15T10:30:02Z,12345678,unknown,online,config,"{\"accountType\":\"Live\",\"broker\":\"ICMarkets\"...}",,MT4
```

### Datos de Configuración Realistas

Cada cuenta incluye:
- **ID de cuenta realista** (basado en la plataforma)
- **Configuración del servidor**
- **Balance y equity** aleatorios
- **Apalancamiento** según la plataforma
- **Timestamps** recientes (últimas 24 horas)
- **Secuencia de eventos** realista

## 🔄 Flujo de Testing Recomendado

1. **Limpiar ambiente:**
   ```bash
   npm run test:accounts:cleanup
   ```

2. **Generar cuentas de prueba:**
   ```bash
   npm run test:accounts:generate 6
   ```

3. **Verificar en la aplicación:**
   - Abrir http://localhost:5174
   - Ir a "Pending Accounts"
   - Verificar que aparecen las 6 cuentas

4. **Probar funcionalidades:**
   - Convertir cuentas a Master
   - Convertir cuentas a Slave
   - Eliminar cuentas
   - Probar límites de suscripción

5. **Reset para nuevas pruebas:**
   ```bash
   npm run test:accounts:reset 8
   ```

## 📁 Archivos Generados

Los scripts crean archivos en `/accounts/`:
- `account_[ID].csv` - Archivo CSV por cada cuenta
- `generated_accounts_summary.json` - Resumen de cuentas generadas

## 🔍 Debugging

Si las cuentas no aparecen:

1. **Verificar servidor:**
   ```bash
   curl http://localhost:30/api/status
   ```

2. **Verificar archivos CSV:**
   ```bash
   ls -la accounts/
   ```

3. **Verificar logs del servidor:**
   - Revisar la consola donde corre `npm run dev`
   - Buscar mensajes sobre "CSV files found"

4. **Forzar escaneo:**
   - Los archivos deberían ser detectados automáticamente
   - El servidor escanea cada 10 segundos

## 🎯 Casos de Uso Específicos

### Testing de Límites de Suscripción
```bash
# Para usuarios con límite de 10 cuentas
npm run test:accounts:generate 12   # Genera más del límite
```

### Testing de Plataformas Específicas
- Genera múltiples cuentas para ver diversidad de plataformas
- Cada ejecución mezcla aleatoriamente plataformas y brokers

### Testing de Conversiones Masivas
```bash
npm run test:accounts:generate 20   # Genera muchas cuentas
# Luego convertir varias en la UI
```

## 📋 Notas Importantes

- **Los archivos CSV se detectan automáticamente** - no necesitas reiniciar el servidor
- **Las cuentas aparecen como "pending"** hasta que las conviertas
- **Cada cuenta tiene un ID único** basado en patrones realistas
- **Los timestamps son recientes** para simular actividad actual
- **Los datos son completamente ficticios** pero realistas

## 🛠️ Desarrollo de Scripts

Para agregar nuevos scripts de testing:

1. Crea el script en `/scripts/`
2. Agrega el comando en `package.json`
3. Documenta en este README
4. Usa patrones realistas de datos
