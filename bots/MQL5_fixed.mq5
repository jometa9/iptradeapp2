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
        long timestamp = TimeGMT();
        string line1 = "[TYPE] [PENDING] [MT5] [" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "]";
        string line2 = "[STATUS] [ONLINE] [" + IntegerToString(timestamp) + "]";
        string line3 = "[CONFIG] [PENDING] [DISABLED] [1.0] [NULL] [FALSE] [NULL] [NULL] [NULL] [NULL]";
        
        FileWriteString(handle, line1 + "\r\n");
        FileWriteString(handle, line2 + "\r\n");
        FileWriteString(handle, line3 + "\r\n");
        
        FileClose(handle);
        Print("Created default CSV file: ", csvFileName);
    }
}

//+------------------------------------------------------------------+
//| Read and validate CSV - MÉTODO COMPATIBLE CON SERVIDOR         |
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
    if(StringFind(line1, "[TYPE]") >= 0 && StringFind(line2, "[STATUS]") >= 0 && StringFind(line3, "[CONFIG]") >= 0)
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
        accountType = StringSubstr(parts[1], 1, StringLen(parts[1])-2);
        copyTrading = StringSubstr(parts[2], 1, StringLen(parts[2])-2);
        lotMultiplier = StringToDouble(StringSubstr(parts[3], 1, StringLen(parts[3])-2));
        forceLot = StringSubstr(parts[4], 1, StringLen(parts[4])-2);
        reverseTrading = StringSubstr(parts[5], 1, StringLen(parts[5])-2);
        masterId = StringSubstr(parts[6], 1, StringLen(parts[6])-2);
        masterCsvPath = StringSubstr(parts[7], 1, StringLen(parts[7])-2);
        prefix = StringSubstr(parts[8], 1, StringLen(parts[8])-2);
        suffix = StringSubstr(parts[9], 1, StringLen(parts[9])-2);
        
        Print("Variables actualizadas: AccountType=", accountType, ", CopyTrading=", copyTrading);
    }
}

//+------------------------------------------------------------------+
//| Write ping timestamp - COMPATIBLE CON SERVIDOR                 |
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
    
    if(lineCount >= 2)
    {
        // Actualizar timestamp en línea STATUS
        long timestamp = TimeGMT();
        string parts[];
        StringSplit(lines[1], ' ', parts);
        if(ArraySize(parts) >= 3)
        {
            parts[2] = "[" + IntegerToString(timestamp) + "]";
            lines[1] = parts[0] + " " + parts[1] + " " + parts[2];
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
//| Process master account                                           |
//+------------------------------------------------------------------+
void ProcessMasterAccount()
{
    Print("Master account processing - compatible version");
    // Implementación simplificada para testing
}

//+------------------------------------------------------------------+
//| Process slave account                                            |
//+------------------------------------------------------------------+
void ProcessSlaveAccount()
{
    Print("Slave account processing - compatible version");
    // Implementación simplificada para testing
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

//+------------------------------------------------------------------+
//| OnTick function                                                  |
//+------------------------------------------------------------------+
void OnTick()
{
    // Not used in this implementation
}
