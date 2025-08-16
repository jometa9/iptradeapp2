//+------------------------------------------------------------------+
//|                                                         MQL4.mq4 |
//|                                  Copyright 2024, IPTRADE Copier |
//|                                             https://iptrade.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, IPTRADE Copier"
#property link      "https://iptrade.com"
#property version   "1.00"
#property strict

// Global variables
int lastUpdateTime = 0;
int updateInterval = 5; // Update every 5 seconds
string csvFileName = "IPTRADECSV2.csv";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("IPTRADE Copier MQL4 Bot Initialized");
   Print("Account: ", AccountNumber());
   Print("Server: ", AccountServer());
   Print("CSV File: ", csvFileName);

   // Create initial CSV file
   WriteIPTRADECSV2();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("IPTRADE Copier MQL4 Bot Deinitialized");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   int currentTime = (int)TimeCurrent();

   // Update CSV every updateInterval seconds
   if (currentTime - lastUpdateTime >= updateInterval)
   {
      WriteIPTRADECSV2();
      lastUpdateTime = currentTime;
   }
}

//+------------------------------------------------------------------+
//| Expert start function                                            |
//+------------------------------------------------------------------+
void OnStart()
{
   Print("IPTRADE Copier MQL4 Bot Started");
   WriteIPTRADECSV2();
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   WriteIPTRADECSV2();
}

//+------------------------------------------------------------------+
//| Read existing CONFIG line from CSV file                          |
//+------------------------------------------------------------------+
string ReadConfigLine()
{
   string configLine = "[CONFIG] [PENDING]"; // Default config

   int handle = FileOpen(csvFileName, FILE_CSV|FILE_READ);
   if (handle != INVALID_HANDLE)
   {
      Print("DEBUG: Reading existing CSV file for CONFIG line");

      while (!FileIsEnding(handle))
      {
         string line = FileReadString(handle);
         Print("DEBUG: Line: ", line);

         if (StringFind(line, "[CONFIG]") == 0)
         {
            configLine = line;
            Print("DEBUG: Found CONFIG line: ", configLine);
            break;
         }
      }
      FileClose(handle);
   }
   else
   {
      Print("DEBUG: No existing CSV file found, using default CONFIG");
   }

   return configLine;
}

//+------------------------------------------------------------------+
//| Write IPTRADECSV2.csv file in new format                         |
//+------------------------------------------------------------------+
void WriteIPTRADECSV2()
{
   int handle = FileOpen(csvFileName, FILE_CSV|FILE_WRITE);

   if (handle != INVALID_HANDLE)
   {
      int currentTime = (int)TimeCurrent();
      string accountId = IntegerToString(AccountNumber());

      Print("DEBUG: Writing IPTRADECSV2.csv for account: ", accountId);
      Print("DEBUG: Current time: ", currentTime);

      // Read existing CONFIG line or use default
      string configLine = ReadConfigLine();
      Print("DEBUG: Estado actual en CONFIG: ", configLine);

      // TYPE line
      string typeLine = "[TYPE] [PENDING] [MT4] [" + accountId + "]";
      FileWrite(handle, typeLine);
      Print("DEBUG: Written TYPE line: ", typeLine);

      // STATUS line
      string statusLine = "[STATUS] [ONLINE] [" + IntegerToString(currentTime) + "]";
      FileWrite(handle, statusLine);
      Print("DEBUG: Written STATUS line: ", statusLine);

      // CONFIG line (preserve existing or use default)
      FileWrite(handle, configLine);
      Print("DEBUG: Written CONFIG line: ", configLine);

      // TICKET lines (only for masters with open positions)
      int ordersCount = OrdersTotal();
      if (ordersCount > 0)
      {
         Print("DEBUG: Found ", ordersCount, " open orders");

         for (int i = 0; i < ordersCount; i++)
         {
            if (OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
            {
               string ticketLine = "[TICKET] [" + IntegerToString(OrderTicket()) + "]";
               ticketLine += " [" + OrderSymbol() + "]";
               ticketLine += " [" + (OrderType() == OP_BUY ? "BUY" : "SELL") + "]";
               ticketLine += " [" + DoubleToString(OrderLots(), 2) + "]";
               ticketLine += " [" + DoubleToString(OrderOpenPrice(), 5) + "]";
               ticketLine += " [" + DoubleToString(OrderStopLoss(), 5) + "]";
               ticketLine += " [" + DoubleToString(OrderTakeProfit(), 5) + "]";
               ticketLine += " [" + IntegerToString(OrderOpenTime()) + "]";

               FileWrite(handle, ticketLine);
               Print("DEBUG: Written TICKET line: ", ticketLine);
            }
         }
      }
      else
      {
         Print("DEBUG: No open orders found");
      }

      FileClose(handle);

      Print("=== PENDING CSV UPDATE ===");
      Print("Account: ", accountId);
      Print("Platform: MT4");
      Print("Status: PENDING");
      Print("Timestamp: ", currentTime);
      Print("UTC Time: ", TimeToString(currentTime, TIME_DATE|TIME_SECONDS));
      Print("File: ", csvFileName);
      Print("DEBUG: Timer - Status es PENDING - ejecutando UpdatePendingCSV");
      Print("DEBUG: UpdatePendingCSV - Leyendo estado actual:");
   }
   else
   {
      Print("ERROR: Failed to open CSV file for writing: ", csvFileName);
      Print("Error code: ", GetLastError());
   }
}
