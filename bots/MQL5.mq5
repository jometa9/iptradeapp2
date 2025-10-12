//+------------------------------------------------------------------+
//|                                                       IPTRADE.mq5 |
//|                        Copyright 2024, IPTrade Copy Trading Bot |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, IPTrade"
#property link      ""
#property version   "1.00"

#include <Trade\Trade.mqh>
CTrade trade;

// Import Windows API functions
#import "kernel32.dll"
   bool CopyFileW(string lpExistingFileName, string lpNewFileName, bool bFailIfExists);
   int GetLastError();
#import

// Global variables
string accountType = "PENDING";
string copyTrading = "DISABLED";
double lotMultiplier = 1.0;
string forceLot = "NULL";
string reverseTrading = "FALSE";
string masterId = "NULL";
string masterCsvPath = "NULL";
string prefix = "NULL";
string suffix = "NULL";

string csvFileName;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    csvFileName = "IPTRADECSV2" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + ".csv";

    // Initialize CSV file
    InitializeCsv();

    // Set timer for 1 second intervals
    EventSetTimer(1);

    Print("IPTrade Copy Trading Bot initialized for account: ", AccountInfoInteger(ACCOUNT_LOGIN));
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                               |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    EventKillTimer();
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
    // Read and validate CSV
    ReadAndValidateCsv();

    // Write ping
    WritePing();

    // Process based on account type
    ProcessAccountType();
}

//+------------------------------------------------------------------+
//| Initialize CSV file                                              |
//+------------------------------------------------------------------+
void InitializeCsv()
{
    // SOLO crear archivo si NO existe - NUNCA sobrescribir
    // Usar FILE_ANSI + FILE_SHARE para compatibilidad con servidor
    int handle = FileOpen(csvFileName, FILE_READ|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
    if(handle == INVALID_HANDLE)
    {
        // File doesn't exist, create it
        CreateDefaultCsv();
    }
    else
    {
        FileClose(handle);
    }
}

//+------------------------------------------------------------------+
//| Create default CSV structure                                     |
//+------------------------------------------------------------------+
void CreateDefaultCsv()
{
    // ESCRITURA COMPATIBLE CON SERVIDOR - FILE_ANSI + SHARE
    int handle = FileOpen(csvFileName, FILE_WRITE|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
    if(handle != INVALID_HANDLE)
    {
        string line1 = "[TYPE] [MT5] [" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "]";
        string line2 = "[CONFIG] [PENDING] [DISABLED] [1.0] [NULL] [FALSE] [NULL] [NULL] [NULL] [NULL]";
        string line3 = "[TRANSLATE] [NULL]";

        FileWriteString(handle, line1 + "\r\n");
        FileWriteString(handle, line2 + "\r\n");
        FileWriteString(handle, line3 + "\r\n");

        FileClose(handle);
        Print("Created default CSV file: ", csvFileName);
    }
}

//+------------------------------------------------------------------+
//| Read and validate CSV                                            |
//+------------------------------------------------------------------+
void ReadAndValidateCsv()
{
    // LECTURA COMPATIBLE - FILE_ANSI + SHARE para leer archivos del servidor
    int handle = FileOpen(csvFileName, FILE_READ|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
    if(handle == INVALID_HANDLE) return;

    string line1 = "", line2 = "", line3 = "";

    // Leer líneas completas como strings
    if(!FileIsEnding(handle)) line1 = FileReadString(handle);
    if(!FileIsEnding(handle)) line2 = FileReadString(handle);
    if(!FileIsEnding(handle)) line3 = FileReadString(handle);

    FileClose(handle);

    Print("=== COMPATIBLE CSV READ ===");
    Print("Line 1: ", line1);
    Print("Line 2: ", line2);
    Print("Line 3: ", line3);
    Print("=== END ===");

    // Validación básica
    if(StringFind(line1, "[TYPE]") >= 0 && StringFind(line3, "[CONFIG]") >= 0)
    {
        ParseConfigLine(line3);
    }
    else
    {
        Print("ADVERTENCIA: Formato CSV inesperado - NO sobrescribiendo");
    }
}

//+------------------------------------------------------------------+
//| Parse CONFIG line and update global variables                   |
//+------------------------------------------------------------------+
void ParseConfigLine(string configLine)
{
    string parts[];
    int count = StringSplit(configLine, ' ', parts);

    if(count >= 10)
    {
        // Solo actualizar variables globales con valores del CSV para lectura
        // No sobrescribir - solo leer y actualizar variables globales
        string csvAccountType = StringSubstr(parts[1], 1, StringLen(parts[1])-2);
        string csvCopyTrading = StringSubstr(parts[2], 1, StringLen(parts[2])-2);
        double csvLotMultiplier = StringToDouble(StringSubstr(parts[3], 1, StringLen(parts[3])-2));
        string csvForceLot = StringSubstr(parts[4], 1, StringLen(parts[4])-2);
        string csvReverseTrading = StringSubstr(parts[5], 1, StringLen(parts[5])-2);
        string csvMasterId = StringSubstr(parts[6], 1, StringLen(parts[6])-2);
        string csvMasterCsvPath = StringSubstr(parts[7], 1, StringLen(parts[7])-2);
        string csvPrefix = StringSubstr(parts[8], 1, StringLen(parts[8])-2);
        string csvSuffix = StringSubstr(parts[9], 1, StringLen(parts[9])-2);

        // Actualizar variables globales solo para lectura (no sobrescribir en CSV)
        accountType = csvAccountType;
        copyTrading = csvCopyTrading;
        lotMultiplier = csvLotMultiplier;
        forceLot = csvForceLot;
        reverseTrading = csvReverseTrading;
        masterId = csvMasterId;
        masterCsvPath = csvMasterCsvPath;
        prefix = csvPrefix;
        suffix = csvSuffix;

        Print("Variables globales actualizadas desde CSV (solo lectura)");
        Print("AccountType: ", accountType, ", CopyTrading: ", copyTrading);
        Print("LotMultiplier: ", lotMultiplier, ", ForceLot: ", forceLot);
        Print("ReverseTrading: ", reverseTrading, ", MasterId: ", masterId);
        Print("MasterCsvPath: ", masterCsvPath, ", Prefix: ", prefix, ", Suffix: ", suffix);
    }
}

//+------------------------------------------------------------------+
//| Write ping timestamp                                             |
//+------------------------------------------------------------------+
void WritePing()
{
    if(accountType == "CORRUPTED") return;

    // Leer archivo completo con FILE_ANSI + SHARE
    int handle = FileOpen(csvFileName, FILE_READ|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
    if(handle == INVALID_HANDLE) return;

    string lines[];
    int lineCount = 0;
    while(!FileIsEnding(handle))
    {
        ArrayResize(lines, lineCount + 1);
        lines[lineCount] = FileReadString(handle);
        lineCount++;
    }
    FileClose(handle);

    if(ArraySize(lines) >= 2)
    {
        // Update timestamp in STATUS line - UTC0 with seconds (Unix timestamp)
        long timestamp = TimeGMT(); // Full Unix timestamp in seconds

        string parts[];
        StringSplit(lines[1], ' ', parts);
        if(ArraySize(parts) >= 3)
        {
            // Update the timestamp part
            parts[2] = "[" + IntegerToString(timestamp) + "]";
            lines[1] = parts[0] + " " + parts[1] + " " + parts[2];

            Print("Updated ping timestamp to: ", timestamp, " (Unix UTC0 seconds)");
        }

        // Escribir de vuelta con FILE_ANSI + SHARE
        handle = FileOpen(csvFileName, FILE_WRITE|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
        if(handle != INVALID_HANDLE)
        {
            for(int i = 0; i < lineCount; i++)
            {
                if(lines[i] != "")
                    FileWriteString(handle, lines[i] + "\r\n");
            }
            FileClose(handle);
        }
    }
}

//+------------------------------------------------------------------+
//| Process based on account type                                   |
//+------------------------------------------------------------------+
void ProcessAccountType()
{
    if(accountType == "PENDING" || accountType == "CORRUPTED") return;

    if(accountType == "MASTER" && copyTrading == "ENABLED")
    {
        ProcessMasterAccount();
    }
    else if(accountType == "SLAVE" && copyTrading == "ENABLED")
    {
        ProcessSlaveAccount();
    }
}

//+------------------------------------------------------------------+
//| Process master account - write orders to CSV                    |
//+------------------------------------------------------------------+
void ProcessMasterAccount()
{
    // Read first 4 lines (TYPE, STATUS, CONFIG, TRANSLATE)
    string headerLines[4];
    int handle = FileOpen(csvFileName, FILE_READ|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
    if(handle == INVALID_HANDLE) return;

    for(int i = 0; i < 4 && !FileIsEnding(handle); i++)
    {
        headerLines[i] = FileReadString(handle);
    }
    FileClose(handle);

    // Write header + orders
    handle = FileOpen(csvFileName, FILE_WRITE|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
    if(handle == INVALID_HANDLE) return;

    // Write header lines
    for(int i = 0; i < 4; i++)
    {
        FileWriteString(handle, headerLines[i] + "\r\n");
    }

    // Write current orders
    int totalOrders = OrdersTotal() + PositionsTotal();

    // Process pending orders
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            string symbol = OrderGetString(ORDER_SYMBOL);

            // Apply prefix/suffix cleaning for master
            if(prefix != "NULL" && StringFind(symbol, prefix) == 0)
            {
                symbol = StringSubstr(symbol, StringLen(prefix));
            }
            if(suffix != "NULL" && StringFind(symbol, suffix) == StringLen(symbol) - StringLen(suffix))
            {
                symbol = StringSubstr(symbol, 0, StringLen(symbol) - StringLen(suffix));
            }

            string orderType = "";
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            switch(type)
            {
                case ORDER_TYPE_BUY_LIMIT: orderType = "BUYLIMIT"; break;
                case ORDER_TYPE_SELL_LIMIT: orderType = "SELLLIMIT"; break;
                case ORDER_TYPE_BUY_STOP: orderType = "BUYSTOP"; break;
                case ORDER_TYPE_SELL_STOP: orderType = "SELLSTOP"; break;
            }

            long openTime = OrderGetInteger(ORDER_TIME_SETUP); // Unix timestamp UTC

            string orderLine = "[ORDER] [" + IntegerToString(ticket) + "] [" + symbol + "] [" + orderType + "] [" +
                              DoubleToString(OrderGetDouble(ORDER_VOLUME_INITIAL), 2) + "] [" +
                              DoubleToString(OrderGetDouble(ORDER_PRICE_OPEN), _Digits) + "] [" +
                              DoubleToString(OrderGetDouble(ORDER_SL), _Digits) + "] [" +
                              DoubleToString(OrderGetDouble(ORDER_TP), _Digits) + "] [" +
                              IntegerToString(openTime) + "]";

            FileWriteString(handle, orderLine + "\r\n");
        }
    }

    // Process open positions
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            string symbol = PositionGetString(POSITION_SYMBOL);

            // Apply prefix/suffix cleaning for master
            if(prefix != "NULL" && StringFind(symbol, prefix) == 0)
            {
                symbol = StringSubstr(symbol, StringLen(prefix));
            }
            if(suffix != "NULL" && StringFind(symbol, suffix) == StringLen(symbol) - StringLen(suffix))
            {
                symbol = StringSubstr(symbol, 0, StringLen(symbol) - StringLen(suffix));
            }

            string orderType = "";
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            switch(type)
            {
                case POSITION_TYPE_BUY: orderType = "BUY"; break;
                case POSITION_TYPE_SELL: orderType = "SELL"; break;
            }

            long openTime = PositionGetInteger(POSITION_TIME); // Unix timestamp UTC

            string orderLine = "[ORDER] [" + IntegerToString(ticket) + "] [" + symbol + "] [" + orderType + "] [" +
                              DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + "] [" +
                              DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), _Digits) + "] [" +
                              DoubleToString(PositionGetDouble(POSITION_SL), _Digits) + "] [" +
                              DoubleToString(PositionGetDouble(POSITION_TP), _Digits) + "] [" +
                              IntegerToString(openTime) + "]";

            FileWriteString(handle, orderLine + "\r\n");
        }
    }

    FileClose(handle);
}

//+------------------------------------------------------------------+
//| Process slave account - read master CSV and copy orders         |
//+------------------------------------------------------------------+
void ProcessSlaveAccount()
{
    if(masterCsvPath == "NULL") return;

    Print("=== Reading Master CSV: ", masterCsvPath, " ===");

    // Try multiple read attempts with different flags for better compatibility
    string csvContent = ReadMasterCsvFile(masterCsvPath);
    if(csvContent == "")
    {
        Print("ERROR: Cannot read master CSV file: ", masterCsvPath);
        return;
    }

    // Split content into lines
    string lines[];
    int lineCount = StringSplit(csvContent, "\n", lines);

    Print("Successfully read ", lineCount, " lines from master CSV");

    // Collect all master order tickets
    string masterTickets[];
    int masterTicketCount = 0;

    // Process lines
    int orderCount = 0;
    for(int i = 0; i < lineCount; i++)
    {
        string line = lines[i];
        StringTrimRight(line);
        StringTrimLeft(line);
        if(line == "") continue;

        if(i < 3)
        {
            Print("Master Line ", (i+1), ": ", line);
        }
        else if(StringFind(line, "[ORDER]") == 0)
        {
            Print("Master Order Line: ", line);

            // Extract master ticket from order line
            string parts[];
            StringSplit(line, " ", parts);
            if(ArraySize(parts) >= 2)
            {
                string masterTicket = StringSubstr(parts[1], 1, StringLen(parts[1])-2);
                ArrayResize(masterTickets, masterTicketCount + 1);
                masterTickets[masterTicketCount] = masterTicket;
                masterTicketCount++;
            }

            ProcessMasterOrder(line);
            orderCount++;
        }
    }

    // Close orders that are no longer in master
    CloseOrphanedOrders(masterTickets, masterTicketCount);

    Print("=== End Master CSV reading. Found ", orderCount, " orders ===");
}

//+------------------------------------------------------------------+
//| Read master CSV file using Windows API copy                     |
//+------------------------------------------------------------------+
string ReadMasterCsvFile(string filePath)
{
    Print("Attempting to read master CSV: ", filePath);

    // Método 1: Usar Windows API para copiar el archivo
    string tempFileName = "temp_master_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + IntegerToString(GetTickCount()) + ".csv";
    string tempFilePath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + tempFileName;

    Print("Trying Windows API copy to: ", tempFilePath);

    // Usar CopyFileW de Windows API
    bool copyResult = CopyFileW(filePath, tempFilePath, false);

    if(copyResult)
    {
        Print("Windows API copy successful");
        Sleep(50); // Pequeña pausa para asegurar que la copia termine

        // Leer el archivo temporal
        int handle = FileOpen(tempFileName, FILE_READ|FILE_ANSI);
        if(handle != INVALID_HANDLE)
        {
            string content = "";
            string lines[];
            int lineCount = 0;

            while(!FileIsEnding(handle))
            {
                string line = FileReadString(handle);
                if(line != "")
                {
                    ArrayResize(lines, lineCount + 1);
                    lines[lineCount] = line;
                    lineCount++;
                }
            }
            FileClose(handle);

            // Eliminar archivo temporal
            FileDelete(tempFileName);

            // Reconstruir contenido
            for(int j = 0; j < lineCount; j++)
            {
                if(j == 0)
                    content = lines[j];
                else
                    content = content + "\n" + lines[j];
            }

            if(StringLen(content) > 0)
            {
                Print("Successfully read master CSV via Windows API copy, length: ", StringLen(content), " lines: ", lineCount);
                return content;
            }
        }
        else
        {
            Print("Failed to open temporary file after Windows API copy");
            FileDelete(tempFileName); // Limpiar en caso de error
        }
    }
    else
    {
        int error = GetLastError();
        Print("Windows API copy failed, error: ", error);
    }

    // Método 2: Fallback - lectura directa con múltiples intentos
    Print("Fallback: trying direct read with multiple modes...");

    int modes[] = {
        FILE_READ|FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_ANSI,
        FILE_READ|FILE_SHARE_READ|FILE_ANSI,
        FILE_READ|FILE_ANSI,
        FILE_READ|FILE_SHARE_READ|FILE_SHARE_WRITE,
        FILE_READ|FILE_SHARE_READ,
        FILE_READ
    };

    for(int i = 0; i < ArraySize(modes); i++)
    {
        int handle = FileOpen(filePath, modes[i]);
        if(handle != INVALID_HANDLE)
        {
            Print("Opened file with mode: ", modes[i]);

            string content = "";
            string lines[];
            int lineCount = 0;

            while(!FileIsEnding(handle))
            {
                string line = FileReadString(handle);
                if(line != "")
                {
                    ArrayResize(lines, lineCount + 1);
                    lines[lineCount] = line;
                    lineCount++;
                }
            }
            FileClose(handle);

            // Reconstruir contenido
            for(int j = 0; j < lineCount; j++)
            {
                if(j == 0)
                    content = lines[j];
                else
                    content = content + "\n" + lines[j];
            }

            if(StringLen(content) > 0)
            {
                Print("Successfully read master CSV via direct read, length: ", StringLen(content), " lines: ", lineCount);
                return content;
            }
        }
        else
        {
            Print("Failed to open with mode: ", modes[i]);
        }
    }

    Print("All methods failed for: ", filePath);
    return "";
}

//+------------------------------------------------------------------+
//| Process individual master order                                  |
//+------------------------------------------------------------------+
void ProcessMasterOrder(string orderLine)
{
    string parts[];
    StringSplit(orderLine, ' ', parts);

    if(ArraySize(parts) < 9) return;

    // Extract order data
    string masterTicket = StringSubstr(parts[1], 1, StringLen(parts[1])-2);
    string symbol = StringSubstr(parts[2], 1, StringLen(parts[2])-2);
    string orderType = StringSubstr(parts[3], 1, StringLen(parts[3])-2);
    double lots = StringToDouble(StringSubstr(parts[4], 1, StringLen(parts[4])-2));
    double price = StringToDouble(StringSubstr(parts[5], 1, StringLen(parts[5])-2));
    double sl = StringToDouble(StringSubstr(parts[6], 1, StringLen(parts[6])-2));
    double tp = StringToDouble(StringSubstr(parts[7], 1, StringLen(parts[7])-2));
    long timestamp = StringToInteger(StringSubstr(parts[8], 1, StringLen(parts[8])-2));

    // Time validation moved to after order existence check

    // Apply lot calculation
    if(forceLot != "NULL")
    {
        lots = StringToDouble(forceLot);
    }
    else
    {
        lots = lots * lotMultiplier;
    }

    // Apply reverse trading
    if(reverseTrading == "TRUE")
    {
        if(orderType == "BUY") orderType = "SELL";
        else if(orderType == "SELL") orderType = "BUY";
        else if(orderType == "BUYSTOP") orderType = "SELLLIMIT";
        else if(orderType == "BUYLIMIT") orderType = "SELLSTOP";
        else if(orderType == "SELLSTOP") orderType = "BUYLIMIT";
        else if(orderType == "SELLLIMIT") orderType = "BUYSTOP";

        // Swap SL and TP
        double temp = sl;
        sl = tp;
        tp = temp;
    }

    // Apply prefix/suffix for slave
    string slaveSymbol = symbol;
    if(prefix != "NULL") slaveSymbol = prefix + slaveSymbol;
    if(suffix != "NULL") slaveSymbol = slaveSymbol + suffix;

    // Check if order already exists and if it needs modification
    bool orderExists = false;

    // Check positions for modification
    Print("=== Checking all positions for master ticket: '", masterTicket, "' ===");
    Print("Total positions: ", PositionsTotal());
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            string comment = PositionGetString(POSITION_COMMENT);
            Print("Position ", ticket, " - Comment: '", comment, "' (Length: ", StringLen(comment), ")");
            Print("Checking position ", ticket, " - Comment: '", comment, "' vs MasterTicket: '", masterTicket, "'");

            if(comment == masterTicket)
            {
                orderExists = true;

                Print("Position ", ticket, " found matching master ticket");

                // Check if position needs SL/TP modification and partial close
                double currentSL = PositionGetDouble(POSITION_SL);
                double currentTP = PositionGetDouble(POSITION_TP);
                double currentLots = PositionGetDouble(POSITION_VOLUME);
                double expectedLots = lots; // This already has lot multiplier applied

                Print("Position ", ticket, " - Current SL: ", currentSL, ", New SL: ", sl, ", Current TP: ", currentTP, ", New TP: ", tp);
                Print("Position ", ticket, " - Current Lots: ", currentLots, ", Expected Lots: ", expectedLots);

                double slDiff = MathAbs(currentSL - sl);
                double tpDiff = MathAbs(currentTP - tp);
                double lotsDiff = MathAbs(currentLots - expectedLots);
                Print("Position ", ticket, " - SL difference: ", slDiff, ", TP difference: ", tpDiff, ", Lots difference: ", lotsDiff);

                // Check if partial close is needed
                Print("Checking partial close: currentLots > expectedLots? ", currentLots, " > ", expectedLots, " = ", (currentLots > expectedLots));
                Print("Lots difference > 0.01? ", lotsDiff, " > 0.01 = ", (lotsDiff > 0.01));

                if(currentLots > expectedLots && lotsDiff > 0.01)
                {
                    double volumeToClose = currentLots - expectedLots;
                    Print("Position ", ticket, " needs partial close - Volume to close: ", volumeToClose, " lots");
                    ClosePartialPosition(ticket, volumeToClose);
                }
                else
                {
                    Print("Position ", ticket, " does not need partial close");
                }

                // Check if SL/TP modification is needed
                if(slDiff > 0.00001 || tpDiff > 0.00001)
                {
                    Print("Position ", ticket, " needs SL/TP modification - Current SL: ", currentSL, ", New SL: ", sl);

                    MqlTradeRequest request;
                    MqlTradeResult result;
                    ZeroMemory(request);
                    ZeroMemory(result);

                    request.action = TRADE_ACTION_SLTP;
                    request.position = ticket;
                    request.symbol = PositionGetString(POSITION_SYMBOL);
                    request.sl = sl;
                    request.tp = tp;

                    if(OrderSend(request, result))
                    {
                        Print("Successfully modified position ", ticket);
                    }
                    else
                    {
                        Print("Failed to modify position ", ticket, " Error: ", result.retcode);
                    }
                }
                break;
            }
        }
    }

    // Check pending orders for modification
    if(!orderExists)
    {
        Print("=== Checking all pending orders for master ticket: '", masterTicket, "' ===");
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket > 0)
            {
                string comment = OrderGetString(ORDER_COMMENT);
                Print("Pending order ", ticket, " - Comment: '", comment, "' (Length: ", StringLen(comment), ")");
                Print("Checking pending order ", ticket, " - Comment: '", comment, "' vs MasterTicket: '", masterTicket, "'");

                if(comment == masterTicket)
                {
                    orderExists = true;

                    Print("Pending order ", ticket, " found matching master ticket");

                    // Check if pending order needs modification
                    double currentPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                    double currentSL = OrderGetDouble(ORDER_SL);
                    double currentTP = OrderGetDouble(ORDER_TP);

                    Print("Pending order ", ticket, " - Current Price: ", currentPrice, ", New Price: ", price);
                    Print("Pending order ", ticket, " - Current SL: ", currentSL, ", New SL: ", sl, ", Current TP: ", currentTP, ", New TP: ", tp);

                    if(MathAbs(currentPrice - price) > 0.00001 ||
                       MathAbs(currentSL - sl) > 0.00001 ||
                       MathAbs(currentTP - tp) > 0.00001)
                    {
                        Print("Pending order ", ticket, " needs modification - Current Price: ", currentPrice, ", New Price: ", price);

                        MqlTradeRequest request;
                        MqlTradeResult result;
                        ZeroMemory(request);
                        ZeroMemory(result);

                        request.action = TRADE_ACTION_MODIFY;
                        request.order = ticket;
                        request.price = price;
                        request.sl = sl;
                        request.tp = tp;

                        if(OrderSend(request, result))
                        {
                            Print("Successfully modified pending order ", ticket);
                        }
                        else
                        {
                            Print("Failed to modify pending order ", ticket, " Error: ", result.retcode);
                        }
                    }
                    break;
                }
            }
        }
    }

    // Open new order if it doesn't exist
    if(!orderExists)
    {
        // Check if order is too old (more than 5 seconds for market orders)
        if((orderType == "BUY" || orderType == "SELL") && (TimeGMT() - timestamp) > 5)
        {
            Print("Order too old, not opening new order. Current time: ", TimeGMT(), ", Order time: ", timestamp);
            return;
        }

        Print("Executing order with comment: '", masterTicket, "'");

        if(orderType == "BUY")
        {
            trade.Buy(lots, slaveSymbol, 0, sl, tp, masterTicket);
        }
        else if(orderType == "SELL")
        {
            trade.Sell(lots, slaveSymbol, 0, sl, tp, masterTicket);
        }
        else if(orderType == "BUYLIMIT")
        {
            trade.BuyLimit(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, masterTicket);
        }
        else if(orderType == "SELLLIMIT")
        {
            trade.SellLimit(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, masterTicket);
        }
        else if(orderType == "BUYSTOP")
        {
            trade.BuyStop(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, masterTicket);
        }
        else if(orderType == "SELLSTOP")
        {
            trade.SellStop(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, masterTicket);
        }
    }
}

//+------------------------------------------------------------------+
//| String split function for MQL5                                  |
//+------------------------------------------------------------------+
int StringSplit(string str, string separator, string &result[])
{
    int pos = 0;
    int count = 0;

    while(pos < StringLen(str))
    {
        int nextPos = StringFind(str, separator, pos);
        if(nextPos == -1) nextPos = StringLen(str);

        ArrayResize(result, count + 1);
        result[count] = StringSubstr(str, pos, nextPos - pos);
        count++;

        pos = nextPos + StringLen(separator);
        if(pos >= StringLen(str)) break;
    }

    return count;
}

//+------------------------------------------------------------------+
//| Close orphaned orders that no longer exist in master            |
//+------------------------------------------------------------------+
void CloseOrphanedOrders(string &masterTickets[], int masterTicketCount)
{
    Print("=== Checking for orphaned orders ===");
    Print("Master tickets count: ", masterTicketCount);

    // Print all master tickets
    for(int j = 0; j < masterTicketCount; j++)
    {
        Print("Master ticket [", j, "]: '", masterTickets[j], "'");
    }

    // Check all current positions
    Print("Total positions to check: ", PositionsTotal());
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            string positionComment = PositionGetString(POSITION_COMMENT);
            Print("Position ", ticket, " - Comment: '", positionComment, "' (Length: ", StringLen(positionComment), ")");

            if(positionComment != "")
            {
                // Check if this position's comment (master ticket) still exists in master
                bool masterExists = false;
                for(int j = 0; j < masterTicketCount; j++)
                {
                    if(masterTickets[j] == positionComment)
                    {
                        masterExists = true;
                        Print("Position ", ticket, " found matching master ticket: ", positionComment);
                        break;
                    }
                }

                // If master order no longer exists, close this position
                if(!masterExists)
                {
                    Print("Closing orphaned position: ", ticket, " (master ticket: ", positionComment, ")");

                    // Get position data from current iteration (position is already selected by PositionGetTicket)
                    string symbol = PositionGetString(POSITION_SYMBOL);
                    double volume = PositionGetDouble(POSITION_VOLUME);
                    ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

                    MqlTradeRequest request;
                    MqlTradeResult result;
                    ZeroMemory(request);
                    ZeroMemory(result);

                    request.action = TRADE_ACTION_DEAL;
                    request.position = ticket;
                    request.symbol = symbol;
                    request.volume = volume;
                    request.price = (posType == POSITION_TYPE_BUY) ?
                                   SymbolInfoDouble(symbol, SYMBOL_BID) :
                                   SymbolInfoDouble(symbol, SYMBOL_ASK);
                    request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
                    request.deviation = 10;
                    request.comment = "Close orphaned";

                    // Get the filling mode allowed by the symbol
                    int filling = (int)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
                    if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
                        request.type_filling = ORDER_FILLING_FOK;
                    else if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
                        request.type_filling = ORDER_FILLING_IOC;
                    else
                        request.type_filling = ORDER_FILLING_RETURN;

                    if(OrderSend(request, result))
                    {
                        Print("Successfully closed position ", ticket);
                    }
                    else
                    {
                        Print("Failed to close position ", ticket, " Error: ", result.retcode);
                    }
                }
                else
                {
                    Print("Position ", ticket, " still has master ticket in CSV, keeping open");
                }
            }
            else
            {
                Print("Position ", ticket, " has no comment, skipping");
            }
        }
    }

    // Check all pending orders
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            string orderComment = OrderGetString(ORDER_COMMENT);
            if(orderComment != "")
            {
                // Check if this order's comment (master ticket) still exists in master
                bool masterExists = false;
                for(int j = 0; j < masterTicketCount; j++)
                {
                    if(masterTickets[j] == orderComment)
                    {
                        masterExists = true;
                        break;
                    }
                }

                // If master order no longer exists, delete this pending order
                if(!masterExists)
                {
                    Print("Deleting orphaned pending order: ", ticket, " (master ticket: ", orderComment, ")");

                    MqlTradeRequest request;
                    MqlTradeResult result;
                    ZeroMemory(request);
                    ZeroMemory(result);

                    request.action = TRADE_ACTION_REMOVE;
                    request.order = ticket;

                    if(OrderSend(request, result))
                    {
                        Print("Successfully deleted pending order ", ticket);
                    }
                    else
                    {
                        Print("Failed to delete pending order ", ticket, " Error: ", result.retcode);
                    }
                }
                else
                {
                    Print("Pending order ", ticket, " still has master ticket in CSV, keeping open");
                }
            }
        }
    }

    Print("=== End orphaned orders check ===");
}

//+------------------------------------------------------------------+
//| Close partial position                                           |
//+------------------------------------------------------------------+
void ClosePartialPosition(ulong ticket, double volumeToClose)
{
    Print("Attempting to close ", volumeToClose, " lots of position ", ticket);

    // Get position info by index, not by ticket selection
    for(int i = 0; i < PositionsTotal(); i++)
    {
        if(PositionGetTicket(i) == ticket)
        {
            string symbol = PositionGetString(POSITION_SYMBOL);
            double currentVolume = PositionGetDouble(POSITION_VOLUME);
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

            Print("Found position - Symbol: ", symbol, ", Current volume: ", currentVolume, ", Volume to close: ", volumeToClose);

            if(volumeToClose >= currentVolume)
            {
                Print("Volume to close >= current volume, closing entire position");
                volumeToClose = currentVolume;
            }

            // Use global CTrade for partial close in MT5
            trade.SetDeviationInPoints(100);

            if(trade.PositionClosePartial(ticket, volumeToClose))
            {
                Print("Successfully closed ", volumeToClose, " lots of position ", ticket);
            }
            else
            {
                // Fallback to manual method if CTrade fails
                MqlTradeRequest request;
                MqlTradeResult result;
                ZeroMemory(request);
                ZeroMemory(result);

                request.action = TRADE_ACTION_DEAL;
                request.position = ticket;
                request.symbol = symbol;
                request.volume = volumeToClose;
                request.price = (posType == POSITION_TYPE_BUY) ?
                               SymbolInfoDouble(symbol, SYMBOL_BID) :
                               SymbolInfoDouble(symbol, SYMBOL_ASK);
                request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
                request.deviation = 100;

                // Get the filling mode allowed by the symbol
                int filling = (int)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
                if(filling == SYMBOL_FILLING_FOK)
                    request.type_filling = ORDER_FILLING_FOK;
                else if(filling == SYMBOL_FILLING_IOC)
                    request.type_filling = ORDER_FILLING_IOC;
                else
                    request.type_filling = ORDER_FILLING_RETURN;

                if(OrderSend(request, result))
                {
                    Print("Successfully closed ", volumeToClose, " lots of position ", ticket, " - Deal: ", result.deal);
                }
                else
                {
                    Print("Failed to close partial position ", ticket, " Error: ", result.retcode);
                    Print("Error description: ", result.comment);
                }
            }
            return;
        }
    }

    Print("Position ", ticket, " not found for partial close");
}
