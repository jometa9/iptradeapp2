//+------------------------------------------------------------------+
//|                                                       IPTRADE.mq5 |
//|                        Copyright 2024, IPTrade Copy Trading Bot |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, IPTrade"
#property link      ""
#property version   "1.00"

#include <Trade\Trade.mqh>
CTrade trade;

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
        FileWriteString(handle, "[TYPE] [PENDING] [MT5] [" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "]\n");
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
    
    // Validate format
    if(StringFind(line1, "[TYPE]") == -1 || StringFind(line2, "[STATUS]") == -1 || StringFind(line3, "[CONFIG]") == -1)
    {
        // Invalid format, recreate
        CreateDefaultCsv();
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
        accountType = StringSubstr(parts[1], 1, StringLen(parts[1])-2); // Remove brackets
        copyTrading = StringSubstr(parts[2], 1, StringLen(parts[2])-2);
        lotMultiplier = StringToDouble(StringSubstr(parts[3], 1, StringLen(parts[3])-2));
        forceLot = StringSubstr(parts[4], 1, StringLen(parts[4])-2);
        reverseTrading = StringSubstr(parts[5], 1, StringLen(parts[5])-2);
        masterId = StringSubstr(parts[6], 1, StringLen(parts[6])-2);
        masterCsvPath = StringSubstr(parts[7], 1, StringLen(parts[7])-2);
        prefix = StringSubstr(parts[8], 1, StringLen(parts[8])-2);
        suffix = StringSubstr(parts[9], 1, StringLen(parts[9])-2);
    }
}

//+------------------------------------------------------------------+
//| Write ping timestamp                                             |
//+------------------------------------------------------------------+
void WritePing()
{
    // Read all content
    int handle = FileOpen(csvFileName, FILE_READ|FILE_TXT);
    if(handle == INVALID_HANDLE) return;
    
    string content = "";
    while(!FileIsEnding(handle))
    {
        content += FileReadString(handle) + "\n";
    }
    FileClose(handle);
    
    string lines[];
    StringSplit(content, "\n", lines);
    
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
        
        // Write back to file
        handle = FileOpen(csvFileName, FILE_WRITE|FILE_TXT);
        if(handle != INVALID_HANDLE)
        {
            for(int i = 0; i < ArraySize(lines); i++)
            {
                if(lines[i] != "")
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
            
            FileWriteString(handle, orderLine + "\n");
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
    
    // Read master CSV orders
    int handle = FileOpen(masterCsvPath, FILE_READ|FILE_TXT);
    if(handle == INVALID_HANDLE) 
    {
        Print("ERROR: Cannot open master CSV file: ", masterCsvPath);
        return;
    }
    
    // Read and log first 3 lines
    for(int i = 0; i < 3 && !FileIsEnding(handle); i++)
    {
        string headerLine = FileReadString(handle);
        Print("Master Line ", (i+1), ": ", headerLine);
    }
    
    // Process order lines
    int orderCount = 0;
    while(!FileIsEnding(handle))
    {
        string line = FileReadString(handle);
        if(line != "")
        {
            Print("Master Order Line: ", line);
            if(StringFind(line, "[ORDER]") == 0)
            {
                ProcessMasterOrder(line);
                orderCount++;
            }
        }
    }
    
    Print("=== End Master CSV reading. Found ", orderCount, " orders ===");
    FileClose(handle);
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
    
    // Check if order is too old (more than 5 seconds for market orders)
    if((orderType == "BUY" || orderType == "SELL") && (TimeGMT() - timestamp) > 5) // More than 5 seconds
    {
        return;
    }
    
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
    
    // Check if order already exists
    bool orderExists = false;
    
    // Check positions
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, masterTicket) >= 0)
            {
                orderExists = true;
                break;
            }
        }
    }
    
    // Check pending orders
    if(!orderExists)
    {
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket > 0)
            {
                string comment = OrderGetString(ORDER_COMMENT);
                if(StringFind(comment, masterTicket) >= 0)
                {
                    orderExists = true;
                    break;
                }
            }
        }
    }
    
    // Open new order if it doesn't exist
    if(!orderExists)
    {
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
