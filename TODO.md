
el prefijo siempre se quita, nunca se agrega y en otro se quita.
pair translate tener nueva linea

---------------------------------------------------

# OBJETIVO

1 - Cubrir todos los casos posibles de los bots de copy trading, tanto como configuracion de copi de ordenes como la de el bot comportandose como slave o comportandose como master de los bots para cTrader, MetaTrader 5 y 4 que ya existen.
3 - Agregar funcionalida de "TRANSLADE" que describiré luego.
2 - Desarrollo del mismo bot con misma funcionalidad que los demas pero para NinjaTrader 8.

# EXPLICACION DE FUNCIONAMIENTO
- Cada bot fucnioan de forma independiente, mediante un servidor local que tengo, yo desde una interfaz escribo las conifuraciones de esa cuenta en el csv y en base a eso el bot debe comportarse de una forma u ota.
- El formato y opciones que tiene el csv es el siguiente:

## Formato CSV de los Bots (IPTRADECSV2)

El formato CSV actual usa **4 tipos de líneas** principales:

### 1. **Línea TYPE**
```
[TYPE] [PLATFORM] [ACCOUNT_ID]
```
- **PLATFORM**: `MT4`, `MT5`, `NT8`, o `CTRADER`
- **ACCOUNT_ID**: Número de cuenta (solo dígitos)

**Ejemplo**: `[TYPE] [MT5] [3920392]`

### 2. **Línea STATUS**
```
[STATUS] [ONLINE/OFFLINE] [TIMESTAMP]
```
- **STATUS**: `ONLINE` o `OFFLINE`
- **TIMESTAMP**: Unix timestamp (solo dígitos)

**Ejemplo**: `[STATUS] [ONLINE] [1703123456]`

### 3. **Línea CONFIG** (La más compleja)

#### Para cuentas **MASTER**:
```
[CONFIG] [MASTER] [ENABLED/DISABLED] [NULL] [NULL] [NULL] [NULL] [NULL] [PREFIX] [SUFFIX]
```

#### Para cuentas **SLAVE**:
- No debemos copiar ordenes abiertas que excedan los 5 segundos de apertura

```
[CONFIG] [SLAVE] [ENABLED/DISABLED] [LOT_MULT] [FORCE_LOT] [REVERSE] [MASTER_ID] [MASTER_CSV_PATH] [PREFIX] [SUFFIX]
```

#### Para cuentas **PENDING**:
```
[CONFIG] [PENDING] [ENABLED/DISABLED] [otros parámetros...]
```

**Explicación detallada de cada campo CONFIG**:

- **[1] CONFIG**: Identificador de línea
- **[2] MASTER/SLAVE/PENDING**: Tipo de cuenta
- **[3] ENABLED/DISABLED**: Permiso de la cuenta para copiar trades si es slave o escribir trades si es master
- **[4] LOT MULTIPLIER**: Multiplicador de lotes (ej: `1.5`, `2.0`)
- **[5] FORCE LOT**: Lote forzado (ej: `0.1`, `NULL` si no se fuerza)
- **[6] REVERSE TRADING**: `TRUE` o `FALSE` para trading reverso
- **[7] MASTER ID**: ID de la cuenta master a seguir, `NULL` si no tiene ninguna master configurada
- **[8] MASTER CSV PATH**: Ruta del CSV del master donde ir a buscar y leer las ordenes
- **[9] PREFIX**: Prefijo para símbolos (ej: `"#"`, `NULL` si no se usa), este valor tanto en master como slave solo se quita si existe
- **[10] SUFFIX**: Sufijo para símbolos (ej: `"pro"`, `NULL` si no se usa), este valor tanto en master como slave solo se quita si existe

**Ejemplo CONFIG SLAVE**:
```
[CONFIG] [SLAVE] [ENABLED] [2.0] [NULL] [TRUE] [12345] [/path/to/master.csv] [EUR] [m]
```

### 3. **Linea TRANSLATE**
- Esta linea solo aplica su uso para cuentas **SLAVE**, si es master ignoramos este campo
- Cada campo o valor del translate (lo que esta dentro de los corchetes, ejemplo: [US100:NQ100]) sera uno de varios translate que puede tener, haciendo que el valor del lado izquierdo del translate sea el ticker que leemos desde el master, en el caso ejemplo el master escribe la orden con el ticker "US100" pero en el slave copiaremos la orden en el ticker "NQ100"

- Ejemplo sin configuración
```
[TRANSLATE] [NULL]
```

- Ejemplo con configuracion
```
[TRANSLATE] [US100:NASDAQ] [US500:ES500] [ETC...]
```

### 5. **Líneas ORDER** (Solo para cuentas MASTER con trades abiertos)
```
[ORDER] [TICKET] [SYMBOL] [ORDER_TYPE] [VOLUME] [PRICE] [SL] [TP] [TIMESTAMP]
```

**Campos ORDER**:
- **TICKET**: Número de ticket (solo dígitos)
- **SYMBOL**: Símbolo del instrumento (ej: `EURUSD`)
- **ORDER_TYPE**: `BUY`, `SELL`, `BUYLIMIT`, `SELLLIMIT`, `BUYSTOP`, `SELLSTOP`
- **VOLUME**: Tamaño del lote (ej: `0.1`, `1.5`)
- **PRICE**: Precio de apertura
- **SL**: Stop Loss (0.0 si no hay)
- **TP**: Take Profit (0.0 si no hay)
- **TIMESTAMP**: Unix timestamp de apertura

**Ejemplo ORDER**:
```
[ORDER] [12345] [EURUSD] [BUY] [0.1] [1.0850] [1.0800] [1.0900] [1703123456]
```

## Funcionamiento de los Bots

### **Cuentas MASTER**:
- Escriben sus trades abiertos en líneas ORDER si esta **ENABLED**, siempre remplaza las lineas de order por las orders que tiene actualmente
- Solo modifican las líneas TYPE, STATUS y ORDER
- El servidor modifica la línea CONFIG cuando cambias configuraciones

### **Cuentas SLAVE**:
- Leen el CSV del master especificado
- Aplican transformaciones según su CONFIG si esta en **ENABLED**:
  - **LOT_MULT**: Multiplica el lote del master
  - **FORCE_LOT**: Usa un lote fijo (ignora LOT_MULT)
  - **REVERSE**: Invierte la dirección (BUY→SELL, etc.) y intercambia SL/TP
  - **PREFIX/SUFFIX**: Modifica símbolos (ej: #EURUSDpro → EREURUSD)

### **Cuentas PENDING**:
- No ejecutan trades, solo reportan estado

## Ejemplo Completo de CSV

```
[TYPE] [MT5] [3920392]
[STATUS] [ONLINE] [1703123456]
[CONFIG] [SLAVE] [ENABLED] [2.0] [NULL] [TRUE] [12345] [/path/master.csv] [#] [pro]
[TRANSLATE] [US100:NASDAQ] [US500:ES500]
[ORDER] [12345] [EURUSD] [BUY] [0.1] [1.0850] [1.0800] [1.0900] [1703123456]
[ORDER] [12346] [GBPUSD] [SELL] [0.2] [1.2650] [1.2700] [1.2600] [1703123500]
```

Este formato permite que los bots se comuniquen de manera estructurada con el servidor y entre ellos para el copy trading.


- Cabe aclarar que NO debemos modificar el formato en el que el bot escribe y agregar mas labels / variables de las que tenemos ya que el server esta preparado para eso.
- Cuando el bot inicia por primera vez, lee si tiene algun csv correspondiente a el, si existe lee que tiene y actual como tal, sino inicia su proceso como pendiente
- Los bots siempre en cada intervalo escriben un timestamp que uso a modo de ping para saber si el bot esta online u offline
- Ninguno de los bots debe tener inputs del usuario, ya que estos se modifican desde la interfaz del server
- Toda la data y configuracion de como se debe comportar el mismo esta en el csv, dependiendo del tipo haremos la mayoria de acciones lectura del csv (por ejemplo la slave, que si tiene master configurada, debe ir y leer las ordenes del csv del master)

Necesito cubrir todo tipo de casos ya sea copi de ordenes abiertas / modificarlas como el copi de ordenes pendientes / modificarlas posible en base a las distintas convinaciones, ese sera tu trabajo.


Consideraciones:
- A la hroa de copiar als ordenes o modificarlas, debemos tener een cuenta el cierre parcial de lotes
- Para poder probar esto, necesitamos nosotros abrir mediante el explorador de archivos el csv y escribir en el csv todo lo que necesitemos para que el bot se comporte de una forma u otra en lo que respecta las 4 lineas, si queremos configurar una master tambien, modificamos el csv de la slave donde esta el path de la master y automaticamente se conecta porque el bot ya lo lee.
