# OBJECTIVE

1 - Cover all possible cases for copy trading bots, both for order copying configuration and for bot behavior as slave or master for existing cTrader, MetaTrader 5 and 4 bots.
3 - Add "TRANSLATE" functionality which I will describe later.
2 - Development of the same bot with the same functionality as the others but for NinjaTrader 8.

# OPERATION EXPLANATION
- Each bot works independently, through a local server I have, from an interface I write the configurations for that account in the csv and based on that the bot should behave one way or another.
- The format and options that the csv has are as follows:

## Bot CSV Format (IPTRADECSV2)

The current CSV format uses **4 main types of lines**:

### 1. **TYPE Line**
```
[TYPE] [PLATFORM] [ACCOUNT_ID]
```
- **PLATFORM**: `MT4`, `MT5`, `NT8`, or `CTRADER`
- **ACCOUNT_ID**: Account number (digits only)

**Example**: `[TYPE] [MT5] [3920392]`

### 2. **CONFIG Line** (The most complex)

#### For **MASTER** accounts:
```
[CONFIG] [MASTER] [ENABLED/DISABLED] [NULL] [NULL] [NULL] [NULL] [NULL] [PREFIX] [SUFFIX]
```

#### For **SLAVE** accounts:
- We should not copy open orders that exceed 5 seconds since opening

```
[CONFIG] [SLAVE] [ENABLED/DISABLED] [LOT_MULT] [FORCE_LOT] [REVERSE] [MASTER_ID] [MASTER_CSV_PATH] [PREFIX] [SUFFIX]
```

#### For **PENDING** accounts:
```
[CONFIG] [PENDING] [ENABLED/DISABLED] [other parameters...]
```

**Detailed explanation of each CONFIG field**:

- **[1] CONFIG**: Line identifier
- **[2] MASTER/SLAVE/PENDING**: Account type
- **[3] ENABLED/DISABLED**: Account permission to copy trades if slave or write trades if master
- **[4] LOT MULTIPLIER**: Lot multiplier (e.g.: `1.5`, `2.0`)
- **[5] FORCE LOT**: Forced lot (e.g.: `0.1`, `NULL` if not forced)
- **[6] REVERSE TRADING**: `TRUE` or `FALSE` for reverse trading
- **[7] MASTER ID**: ID of the master account to follow, `NULL` if no master is configured
- **[8] MASTER CSV PATH**: Path to the master's CSV where to look for and read orders
- **[9] PREFIX**: Prefix for symbols (e.g.: `"#"`, `NULL` if not used), this value in both master and slave is only removed if it exists
- **[10] SUFFIX**: Suffix for symbols (e.g.: `"pro"`, `NULL` if not used), this value in both master and slave is only removed if it exists

**SLAVE CONFIG Example**:
```
[CONFIG] [SLAVE] [ENABLED] [2.0] [NULL] [TRUE] [12345] [/path/to/master.csv] [EUR] [m]
```

### 3. **TRANSLATE Line**
- This line only applies for **SLAVE** accounts, if it's master we ignore this field
- Each translate field or value (what's inside the brackets, example: [US100:NQ100]) will be one of several translates it can have, making the value on the left side of the translate be the ticker we read from the master, in the example case the master writes the order with the ticker "US100" but in the slave we will copy the order on the ticker "NQ100"

- Example without configuration
```
[TRANSLATE] [NULL]
```

- Example with configuration
```
[TRANSLATE] [US100:NASDAQ] [US500:ES500] [ETC...]
```

### 4. **ORDER Lines** (Only for MASTER accounts with open trades)
```
[ORDER] [TICKET] [SYMBOL] [ORDER_TYPE] [VOLUME] [PRICE] [SL] [TP] [TIMESTAMP]
```

**ORDER Fields**:
- **TICKET**: Ticket number (digits only)
- **SYMBOL**: Instrument symbol (e.g.: `EURUSD`)
- **ORDER_TYPE**: `BUY`, `SELL`, `BUYLIMIT`, `SELLLIMIT`, `BUYSTOP`, `SELLSTOP`
- **VOLUME**: Lot size (e.g.: `0.1`, `1.5`)
- **PRICE**: Opening price
- **SL**: Stop Loss (0.0 if none)
- **TP**: Take Profit (0.0 if none)
- **TIMESTAMP**: Opening unix timestamp

**ORDER Example**:
```
[ORDER] [12345] [EURUSD] [BUY] [0.1] [1.0850] [1.0800] [1.0900] [1703123456]
```

## Bot Functionality

### **MASTER Accounts**:
- Write their open trades in ORDER lines if **ENABLED**, always replace order lines with the orders it currently has
- Only modify TYPE, STATUS and ORDER lines
- The server modifies the CONFIG line when you change configurations

### **SLAVE Accounts**:
- Read the specified master's CSV
- Apply transformations according to their CONFIG if **ENABLED**:
  - **LOT_MULT**: Multiplies the master's lot
  - **FORCE_LOT**: Uses a fixed lot (ignores LOT_MULT)
  - **REVERSE**: Reverses direction (BUY→SELL, etc.) and swaps SL/TP
  - **PREFIX/SUFFIX**: Modifies symbols (e.g.: #EURUSDpro → EREURUSD)

### **PENDING Accounts**:
- Don't execute trades, only report status

## Complete CSV Example

```
[TYPE] [MT5] [3920392]
[CONFIG] [SLAVE] [ENABLED] [2.0] [NULL] [TRUE] [12345] [/path/master.csv] [#] [pro]
[TRANSLATE] [US100:NASDAQ] [US500:ES500]
[ORDER] [12345] [EURUSD] [BUY] [0.1] [1.0850] [1.0800] [1.0900] [1703123456]
[ORDER] [12346] [GBPUSD] [SELL] [0.2] [1.2650] [1.2700] [1.2600] [1703123500]
```

This format allows bots to communicate in a structured manner with the server and between themselves for copy trading.


- It should be clarified that we should NOT modify the format in which the bot writes and add more labels/variables than we already have since the server is prepared for that.
- When the bot starts for the first time, it reads if it has any csv corresponding to it, if it exists it reads what it has and acts as such, otherwise it starts its process as pending
- None of the bots should have user inputs, since these are modified from the server interface
- All data and configuration of how it should behave is in the csv, depending on the type we will do most actions reading the csv (for example the slave, which if it has a master configured, must go and read the orders from the master's csv)

I need to cover all types of cases whether copying open orders / modifying them as well as copying pending orders / modifying them possible based on different combinations, that will be your job.

# CONSIDERATIONS

- When copying or modifying orders, we must take into account partial lot closures
- To test this, we need to open the csv through the file explorer and write in the csv everything we need for the bot to behave one way or another regarding the 4 lines, if we want to configure a master as well, we modify the slave's csv where the master's path is and it automatically connects because the bot already reads it.
