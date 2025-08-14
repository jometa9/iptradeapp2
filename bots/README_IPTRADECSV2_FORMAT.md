# Formato IPTRADECSV2.csv para Bots IPTRADE

## 📄 Ubicación del Archivo

Cada bot escribe en su propio archivo `IPTRADECSV2.csv` en la carpeta Files de MetaTrader:
- **MT4**: `MQL4/Files/IPTRADECSV2.csv`
- **MT5**: `MQL5/Files/IPTRADECSV2.csv`

## 📝 Formato del Archivo

El bot debe **reescribir completamente** el archivo en cada ping con todas las líneas necesarias:

### Ejemplo para una cuenta MASTER:
```
[TYPE][MASTER][MT4][12345]
[STATUS][ONLINE][1755131092]
[CONFIG][MASTER][ENABLED][Master Principal]
[TICKET][123001][EURUSD][BUY][0.1][1.0850][1.0750][1.0950][1755131000]
[TICKET][123002][GBPUSD][SELL][0.2][1.2500][1.2600][1.2400][1755131050]
```

### Ejemplo para una cuenta SLAVE:
```
[TYPE][SLAVE][MT5][67890]
[STATUS][ONLINE][1755131092]
[CONFIG][SLAVE][ENABLED][1.5][NULL][FALSE][10][0.01][12345]
```

### Ejemplo para una cuenta PENDING (no configurada):
```
[TYPE][PENDING][MT4][250062001]
[STATUS][ONLINE][1755131092]
[CONFIG][PENDING]
```

## 📋 Descripción de Líneas

### [TYPE] - Información básica de la cuenta
```
[TYPE][TIPO_CUENTA][PLATAFORMA][ACCOUNT_ID]
```
- **TIPO_CUENTA**: MASTER, SLAVE o PENDING
- **PLATAFORMA**: MT4, MT5, CTRADER, etc.
- **ACCOUNT_ID**: Número de cuenta

### [STATUS] - Estado de conectividad
```
[STATUS][ESTADO][TIMESTAMP]
```
- **ESTADO**: ONLINE o OFFLINE
- **TIMESTAMP**: Unix timestamp en segundos (ej: 1755131092)

### [CONFIG] - Configuración de la cuenta

#### Para MASTER:
```
[CONFIG][MASTER][ENABLED/DISABLED][NOMBRE]
```
- **ENABLED/DISABLED**: Estado del master
- **NOMBRE**: Nombre descriptivo del master

#### Para SLAVE:
```
[CONFIG][SLAVE][ENABLED/DISABLED][LOT_MULT][FORCE_LOT][REVERSE][MAX_LOT][MIN_LOT][MASTER_ID]
```
- **ENABLED/DISABLED**: Estado del slave
- **LOT_MULT**: Multiplicador de lote (ej: 1.5)
- **FORCE_LOT**: Lote fijo o NULL
- **REVERSE**: TRUE o FALSE para trading inverso
- **MAX_LOT**: Lote máximo o NULL
- **MIN_LOT**: Lote mínimo o NULL
- **MASTER_ID**: ID del master al que está conectado

#### Para PENDING:
```
[CONFIG][PENDING]
```
Solo indica que es una cuenta pendiente de configuración.

### [TICKET] - Trades abiertos (solo para MASTER)
```
[TICKET][TICKET_ID][SYMBOL][TYPE][LOTS][PRICE][SL][TP][OPEN_TIME]
```
- **TICKET_ID**: Número único del ticket
- **SYMBOL**: Par de divisas (ej: EURUSD)
- **TYPE**: BUY o SELL
- **LOTS**: Tamaño del lote
- **PRICE**: Precio de apertura
- **SL**: Stop Loss (0 si no tiene)
- **TP**: Take Profit (0 si no tiene)
- **OPEN_TIME**: Unix timestamp de apertura

## 🔄 Proceso de Lectura/Escritura

### En cada ping (1-5 segundos):

1. **LEER la línea CONFIG** del archivo existente (si existe)
2. **MANTENER la configuración** que viene del servidor
3. **ESCRIBIR todo el archivo** con:
   - Línea TYPE actualizada
   - Línea STATUS con timestamp actual
   - Línea CONFIG (la que leyó o default)
   - Líneas TICKET para trades abiertos (solo masters)

### ⚠️ IMPORTANTE:
- **El bot NO debe modificar la línea CONFIG**
- **Solo el servidor IPTRADE modifica CONFIG**
- **El bot debe preservar CONFIG al reescribir**

## 💡 Ejemplo de Código (MQL5)

```mql5
string ReadConfigLine() {
    string filename = "IPTRADECSV2.csv";
    int handle = FileOpen(filename, FILE_READ|FILE_CSV|FILE_ANSI);
    string configLine = "[CONFIG][MASTER][ENABLED][Master Account]"; // Default

    if(handle != INVALID_HANDLE) {
        while(!FileIsEnding(handle)) {
            string line = FileReadString(handle);
            if(StringFind(line, "[CONFIG]") == 0) {
                configLine = line;
                break;
            }
        }
        FileClose(handle);
    }

    return configLine;
}

void WriteIPTRADECSV2() {
    string filename = "IPTRADECSV2.csv";
    int handle = FileOpen(filename, FILE_WRITE|FILE_CSV|FILE_ANSI);

    if(handle != INVALID_HANDLE) {
        // TYPE line
        string accountType = IsMasterAccount() ? "MASTER" : "SLAVE";
        FileWrite(handle, "[TYPE][" + accountType + "][MT5][" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "]");

        // STATUS line
        FileWrite(handle, "[STATUS][ONLINE][" + IntegerToString(TimeCurrent()) + "]");

        // CONFIG line - leer la existente o usar default
        FileWrite(handle, ReadConfigLine());

        // TICKET lines - solo para masters con trades abiertos
        if(IsMasterAccount()) {
            for(int i = 0; i < PositionsTotal(); i++) {
                if(PositionSelectByTicket(PositionGetTicket(i))) {
                    string line = "[TICKET][" + IntegerToString(PositionGetInteger(POSITION_TICKET)) + "]";
                    line += "[" + PositionGetString(POSITION_SYMBOL) + "]";
                    line += "[" + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL") + "]";
                    line += "[" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + "]";
                    line += "[" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5) + "]";
                    line += "[" + DoubleToString(PositionGetDouble(POSITION_SL), 5) + "]";
                    line += "[" + DoubleToString(PositionGetDouble(POSITION_TP), 5) + "]";
                    line += "[" + IntegerToString(PositionGetInteger(POSITION_TIME)) + "]";
                    FileWrite(handle, line);
                }
            }
        }

        FileClose(handle);
    }
}
```

## 📊 Notas Importantes

1. **Un archivo por plataforma**: Cada instancia de MT4/MT5 tiene su propio `IPTRADECSV2.csv`
2. **Reescritura completa**: NO hacer append, siempre reescribir todo
3. **Preservar CONFIG**: El bot debe leer y mantener la línea CONFIG
4. **Solo trades abiertos**: No incluir histórico de trades cerrados
5. **Timestamp Unix**: En segundos, no milisegundos
6. **NULL para valores vacíos**: Usar la palabra NULL, no dejar vacío
