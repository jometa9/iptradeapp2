//+------------------------------------------------------------------+
//|                                                       IPTRADE.mq4 |
//|                        Copyright 2024, IPTrade Copy Trading Bot |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, IPTrade"
#property link      ""
#property version   "1.00"
#property strict

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
int timerInterval = 1000; // 1 second

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    csvFileName = "IPTRADECSV2" + IntegerToString(AccountNumber()) + ".csv";
    
    // Initialize CSV file
    InitializeCsv();
    
    // Set timer for 1 second intervals
    EventSetTimer(1);
    
    Print("IPTrade Copy Trading Bot initialized for account: ", AccountNumber());
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
    int handle = FileOpen(csvFileName, FILE_READ|FILE_TXT);
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
    int handle = FileOpen(csvFileName, FILE_WRITE|FILE_TXT);
    if(handle != INVALID_HANDLE)
    {
        long timestamp = TimeGMT(); // UTC timestamp with seconds
        FileWriteString(handle, "[TYPE] [MT4] [" + IntegerToString(AccountNumber()) + "]\n");
        FileWriteString(handle, "[STATUS] [ONLINE] [" + IntegerToString(timestamp) + "]\n");
        FileWriteString(handle, "[CONFIG] [PENDING] [DISABLED] [1.0] [NULL] [FALSE] [NULL] [NULL] [NULL] [NULL]\n");
        FileClose(handle);
        Print("Created default CSV file: ", csvFileName);
    }
}

//+------------------------------------------------------------------+
//| Read and validate CSV                                            |
//+------------------------------------------------------------------+
void ReadAndValidateCsv()
{
    int handle = FileOpen(csvFileName, FILE_READ|FILE_TXT);
    if(handle == INVALID_HANDLE) return;
    
    Print("=== Reading CSV lines ===");
    
    string line1 = "", line2 = "", line3 = "";
    
    // Read first three lines
    if(!FileIsEnding(handle)) line1 = FileReadString(handle);
    if(!FileIsEnding(handle)) line2 = FileReadString(handle);
    if(!FileIsEnding(handle)) line3 = FileReadString(handle);
    
    // Log all lines read
    Print("Line 1 (TYPE): ", line1);
    Print("Line 2 (STATUS): ", line2);
    Print("Line 3 (CONFIG): ", line3);
    
    // Read and log any additional lines (orders)
    int lineCount = 4;
    while(!FileIsEnding(handle))
    {
        string additionalLine = FileReadString(handle);
        if(additionalLine != "")
        {
            Print("Line ", lineCount, " (ORDER): ", additionalLine);
            lineCount++;
        }
    }
    
    FileClose(handle);
    Print("=== End CSV reading ===");
    
    // Validate format - NO recrear archivo existente, solo leer lo que hay
    if(StringFind(line1, "[TYPE]") == -1 || StringFind(line2, "[STATUS]") == -1 || StringFind(line3, "[CONFIG]") == -1)
    {
        // Formato inesperado pero NO sobrescribir - el servidor maneja el CSV
        Print("ADVERTENCIA: Formato CSV inesperado, pero NO sobrescribiendo archivo existente");
        Print("El servidor es responsable del formato del CSV");
        return;
    }
    
    // Parse CONFIG line to extract variables
    ParseConfigLine(line3);
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
        double csvLotMultiplier = StrToDouble(StringSubstr(parts[3], 1, StringLen(parts[3])-2));
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
    // Read all lines
    string lines[];
    int handle = FileOpen(csvFileName, FILE_READ|FILE_TXT);
    if(handle == INVALID_HANDLE) return;
    
    int lineCount = 0;
    while(!FileIsEnding(handle))
    {
        ArrayResize(lines, lineCount + 1);
        lines[lineCount] = FileReadString(handle);
        lineCount++;
    }
    FileClose(handle);
    
    if(lineCount >= 2)
    {
        // Update timestamp in STATUS line - UTC0 with seconds (Unix timestamp)
        long timestamp = TimeGMT(); // Full Unix timestamp in seconds
        
        // Find and replace the timestamp in the STATUS line
        string statusLine = lines[1];
        string parts[];
        StringSplit(statusLine, ' ', parts);
        
        if(ArraySize(parts) >= 3)
        {
            // Update the timestamp part
            parts[2] = "[" + IntegerToString(timestamp) + "]";
            lines[1] = parts[0] + " " + parts[1] + " " + parts[2];
            
            Print("Updated ping timestamp to: ", timestamp, " (Unix UTC0 seconds)");
        }
        
        // Write back to file
        handle = FileOpen(csvFileName, FILE_WRITE|FILE_TXT);
        if(handle != INVALID_HANDLE)
        {
            for(int i = 0; i < lineCount; i++)
            {
                FileWriteString(handle, lines[i] + "\n");
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
    if(accountType == "PENDING") return;
    
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
    // Read first 3 lines
    string headerLines[3];
    int handle = FileOpen(csvFileName, FILE_READ|FILE_TXT);
    if(handle == INVALID_HANDLE) return;
    
    for(int i = 0; i < 3 && !FileIsEnding(handle); i++)
    {
        headerLines[i] = FileReadString(handle);
    }
    FileClose(handle);
    
    // Write header + orders
    handle = FileOpen(csvFileName, FILE_WRITE|FILE_TXT);
    if(handle == INVALID_HANDLE) return;
    
    // Write header lines
    for(int i = 0; i < 3; i++)
    {
        FileWriteString(handle, headerLines[i] + "\n");
    }
    
    // Write current orders
    for(int i = 0; i < OrdersTotal(); i++)
    {
        if(OrderSelect(i, SELECT_BY_POS))
        {
            string symbol = OrderSymbol();
            
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
            switch(OrderType())
            {
                case OP_BUY: orderType = "BUY"; break;
                case OP_SELL: orderType = "SELL"; break;
                case OP_BUYLIMIT: orderType = "BUYLIMIT"; break;
                case OP_SELLLIMIT: orderType = "SELLLIMIT"; break;
                case OP_BUYSTOP: orderType = "BUYSTOP"; break;
                case OP_SELLSTOP: orderType = "SELLSTOP"; break;
            }
            
            long openTime = OrderOpenTime(); // Unix timestamp UTC
            
            string orderLine = StringConcatenate(
                "[ORDER] [", IntegerToString(OrderTicket()), "] [", symbol, "] [", orderType, "] [",
                DoubleToString(OrderLots(), 2), "] [", DoubleToString(OrderOpenPrice(), Digits), "] [",
                DoubleToString(OrderStopLoss(), Digits), "] [", DoubleToString(OrderTakeProfit(), Digits), "] [",
                IntegerToString(openTime), "]"
            );
            
            FileWriteString(handle, orderLine + "\n");
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
            ProcessMasterOrder(line);
            orderCount++;
        }
    }
    
    Print("=== End Master CSV reading. Found ", orderCount, " orders ===");
}

//+------------------------------------------------------------------+
//| Read master CSV file using Windows API copy                     |
//+------------------------------------------------------------------+
string ReadMasterCsvFile(string filePath)
{
    Print("Attempting to read master CSV: ", filePath);
    
    // Método 1: Usar Windows API para copiar el archivo
    string tempFileName = "temp_master_" + IntegerToString(AccountNumber()) + "_" + IntegerToString(GetTickCount()) + ".csv";
    string tempFilePath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL4\\Files\\" + tempFileName;
    
    Print("Trying Windows API copy to: ", tempFilePath);
    
    // Usar CopyFileW de Windows API
    bool copyResult = CopyFileW(filePath, tempFilePath, false);
    
    if(copyResult)
    {
        Print("Windows API copy successful");
        Sleep(50); // Pequeña pausa para asegurar que la copia termine
        
        // Leer el archivo temporal
        int handle = FileOpen(tempFileName, FILE_READ|FILE_TXT);
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
    double lots = StrToDouble(StringSubstr(parts[4], 1, StringLen(parts[4])-2));
    double price = StrToDouble(StringSubstr(parts[5], 1, StringLen(parts[5])-2));
    double sl = StrToDouble(StringSubstr(parts[6], 1, StringLen(parts[6])-2));
    double tp = StrToDouble(StringSubstr(parts[7], 1, StringLen(parts[7])-2));
    long timestamp = StrToInteger(StringSubstr(parts[8], 1, StringLen(parts[8])-2));
    
    // Check if order is too old (more than 5 seconds for market orders)
    if((orderType == "BUY" || orderType == "SELL") && (TimeGMT() - timestamp) > 5) // More than 5 seconds
    {
        return;
    }
    
    // Apply lot calculation
    if(forceLot != "NULL")
    {
        lots = StrToDouble(forceLot);
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
    
    // Check if order already exists
    bool orderExists = false;
    for(int i = 0; i < OrdersTotal(); i++)
    {
        if(OrderSelect(i, SELECT_BY_POS))
        {
            if(StringFind(OrderComment(), masterTicket) >= 0)
            {
                orderExists = true;
                // Could add order modification logic here
                break;
            }
        }
    }
    
    // Open new order if it doesn't exist
    if(!orderExists)
    {
        int cmd = -1;
        if(orderType == "BUY") cmd = OP_BUY;
        else if(orderType == "SELL") cmd = OP_SELL;
        else if(orderType == "BUYLIMIT") cmd = OP_BUYLIMIT;
        else if(orderType == "SELLLIMIT") cmd = OP_SELLLIMIT;
        else if(orderType == "BUYSTOP") cmd = OP_BUYSTOP;
        else if(orderType == "SELLSTOP") cmd = OP_SELLSTOP;
        
        if(cmd >= 0)
        {
            OrderSend(slaveSymbol, cmd, lots, price, 3, sl, tp, masterTicket, 0, 0, clrNONE);
        }
    }
}

//+------------------------------------------------------------------+
//| String split function                                            |
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
