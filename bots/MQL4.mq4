//+------------------------------------------------------------------+
//|                                                     IPTRADE_MT4 |
//|                                      Copyright 2025, Joaquin Metayer |
//|                                       http://jometa.dev |
//+------------------------------------------------------------------+
#property copyright "Copyright © 2025, Joaquin Metayer"
#property link      "http://jometa.dev"
#property version   "1.0"
#property description "IPTRADE MT4 Trade Copier"

// Resource for the program icon (will be loaded from IPTRADE/logo.ico)
// #resource "logo.ico"
// #property icon "logo.ico"

// External parameters
extern int PENDING_UPDATE_INTERVAL_MS = 500; // milisegundos para actualización de cuentas pendientes
extern int MASTER_UPDATE_INTERVAL_MS = 1000; // milisegundos para actualización de cuentas master
extern int STATUS_PROTECTION_SECONDS = 3; // segundos de protección para evitar sobrescritura de estados MASTER/SLAVE
extern bool FORCE_PENDING_ON_START = false; // force PENDING status on startup (overwrites existing CSV)

// Global variables
string csvFileName = "IPTRADECSV2.csv";
string currentStatus = "PENDING";
datetime lastFileCheck = 0;
datetime lastPendingUpdate = 0;
int pendingUpdateInterval = 1; // segundos (para 500ms sería 0.5, pero usamos 1 segundo para debug)

// Master tracking variables
int masterCounter = 0;
datetime lastMasterUpdate = 0;
int lastOrderCount = 0;
datetime lastOrderCheck = 0;

// Protection variables to prevent MASTER/SLAVE state overwrite
datetime lastStatusChange = 0;
string lastReadStatus = "PENDING";
bool isStatusProtected = false;
int statusProtectionSeconds = STATUS_PROTECTION_SECONDS; // Usar parámetro externo

// Slave configuration variables
double slaveMultiplier = 1.0;     // Multiplicador de lote (default 1.0)
double slaveForceLot = 0.0;       // Lote fijo (0.0 = usar multiplicador)
bool slaveReverseTrading = false; // Trading inverso
long slaveMasterAccount = 0;      // ID de la cuenta master

//+------------------------------------------------------------------+
//| Print all CSV content line by line                               |
//+------------------------------------------------------------------+
void PrintCSVContent()
{
   int handle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_COMMON);
   if(handle != INVALID_HANDLE)
   {
      while(!FileIsEnding(handle))
      {
         string line = FileReadString(handle);
         if(StringLen(line) > 0) // Solo imprime líneas no vacías
         {
            Print(line);
         }
      }
      FileClose(handle);
   }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int init()
{
   lastPendingUpdate = 0;

   if(FORCE_PENDING_ON_START)
   {
      CreateSimpleCSV();
      currentStatus = "PENDING";
   }
   else
   {
      ReadSimpleCSV();
   }

   lastFileCheck = TimeCurrent();
   EventSetMillisecondTimer(PENDING_UPDATE_INTERVAL_MS);

   return(0);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
int deinit()
{
   EventKillTimer();
   Comment("");

   return(0);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
int start()
{
   // Check file every 5 seconds
   if(TimeCurrent() - lastFileCheck >= 5)
   {
      ReadSimpleCSV();
      lastFileCheck = TimeCurrent();
   }

   return(0);
}

//+------------------------------------------------------------------+
//| Timer function - se ejecuta según PENDING_UPDATE_INTERVAL_MS      |
//+------------------------------------------------------------------+
void OnTimer()
{
   static int timerCount = 0;
   timerCount++;

   // Print CSV content on every ping
   PrintCSVContent();

   // Check if MASTER protection is still active
   if(isStatusProtected && TimeCurrent() - lastStatusChange >= statusProtectionSeconds)
   {
      isStatusProtected = false;
   }

      // Update chart info first
   string chartInfo;
   if(currentStatus == "SLAVE")
   {
      chartInfo = StringFormat(
         "IPTRADE Account Status: SLAVE\n" +
         "----------------------------\n" +
         "Multiplier: %.2f\n" +
         "Force Lot: %.2f\n" +
         "Reverse Trading: %s\n" +
         "Master Account: %d",
         slaveMultiplier,
         slaveForceLot,
         slaveReverseTrading ? "TRUE" : "FALSE",
         slaveMasterAccount
      );
   }
   else
   {
      chartInfo = "IPTRADE Account Status: " + currentStatus;
   }
   Comment(chartInfo);

   // Execute PENDING logic according to configured interval
   if(currentStatus == "PENDING")
   {
      // Only update if not in MASTER protection period
      if(!isStatusProtected)
   {

      UpdatePendingCSV();
      }
      else
      {

      }
   }
   // Execute MASTER logic according to configured interval
   else if(currentStatus == "MASTER")
   {
      if(TimeCurrent() - lastMasterUpdate >= MASTER_UPDATE_INTERVAL_MS/1000)
      {

         UpdateMasterCSV();
         lastMasterUpdate = TimeCurrent();
      }
   }
   // Execute SLAVE logic according to configured interval
   else if(currentStatus == "SLAVE")
   {
      // Only update if not in status protection period
      if(!isStatusProtected)
      {

         UpdateSlaveCSV();
      }
      else
      {
      }
   }
}

//+------------------------------------------------------------------+
//| Check for order changes and return true if there are changes     |
//+------------------------------------------------------------------+
bool CheckOrderChanges()
{
   int currentOrderCount = OrdersTotal();

   // If order count changed, there are definitely changes
   if(currentOrderCount != lastOrderCount)
   {
      lastOrderCount = currentOrderCount;
      return true;
   }

   // Check for modifications in existing orders
   for(int i = 0; i < currentOrderCount; i++)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         // Check if order was modified recently (within last few seconds)
         if(TimeCurrent() - OrderOpenTime() < 10 ||
            (OrderStopLoss() != 0 && TimeCurrent() - OrderOpenTime() < 10) ||
            (OrderTakeProfit() != 0 && TimeCurrent() - OrderOpenTime() < 10))
         {
            return true;
         }

         // Check for modifications in SL/TP levels
         static double lastSL = 0, lastTP = 0;
         if(OrderStopLoss() != lastSL || OrderTakeProfit() != lastTP)
         {
            lastSL = OrderStopLoss();
            lastTP = OrderTakeProfit();
            return true;
         }
      }
   }

   return false;
}

//+------------------------------------------------------------------+
//| Update CSV with master account orders                            |
//+------------------------------------------------------------------+
void UpdateMasterCSV()
{
   // First, read current CSV to get the actual status
   int readHandle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_COMMON);
   if(readHandle != INVALID_HANDLE)
   {
      string line1 = FileReadString(readHandle); // TYPE line
      string line2 = FileReadString(readHandle); // STATUS line
      string line3 = FileReadString(readHandle); // CONFIG line
      FileClose(readHandle);



      // Extract current status from CONFIG line and preserve third field
      string currentConfigStatus = "PENDING"; // default
      string configThirdField = ""; // preserve third field (ENABLED/DISABLED)
      if(StringFind(line3, "[CONFIG]") >= 0)
      {
         // Parse CONFIG line: [CONFIG] [STATUS] [THIRD_FIELD]
         int pos = 0;
         int startPos, endPos;

         // Find first field: [CONFIG]
         startPos = StringFind(line3, "[", pos);
         endPos = StringFind(line3, "]", startPos);
         if(startPos >= 0 && endPos > startPos)
         {
            pos = endPos + 1;

            // Find second field: [STATUS]
            startPos = StringFind(line3, "[", pos);
            endPos = StringFind(line3, "]", startPos);
            if(startPos >= 0 && endPos > startPos)
            {
               currentConfigStatus = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
               pos = endPos + 1;

               // Find third field: [THIRD_FIELD] (if exists)
               startPos = StringFind(line3, "[", pos);
               endPos = StringFind(line3, "]", startPos);
               if(startPos >= 0 && endPos > startPos)
               {
                  configThirdField = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
               }
            }
         }
      }



      // Clean configThirdField - but preserve ENABLED/DISABLED
      if(configThirdField != "ENABLED" && configThirdField != "DISABLED")
      {
         if(StringFind(configThirdField, "]") >= 0)
         {

            configThirdField = "";
         }
      }
      else
      {

      }

      // Only write MASTER if the account is actually MASTER
      if(currentConfigStatus == "MASTER")
      {
   // Always update CSV for heartbeat, even if no order changes
   bool hasOrderChanges = CheckOrderChanges();

   // Increment counter only when there are order changes
   if(hasOrderChanges)
   {
      masterCounter++;

   }
   else
   {

   }

   int handle = FileOpen(csvFileName, FILE_TXT|FILE_WRITE|FILE_COMMON);
   if(handle != INVALID_HANDLE)
   {
      long account = AccountNumber();
      datetime utcTime = GetUTCTime();
      string timestamp = IntegerToString(utcTime);

            // Write master header lines with new format, preserving third field if it's not a number
            string newLine1 = StringFormat("[TYPE] [MASTER] [MT4] [%d]", account);
            string newLine2 = StringFormat("[STATUS] [ONLINE] [%s]", timestamp);
            string newLine3;

            // If third field looks like ENABLED/DISABLED, preserve it; otherwise use counter

            if(configThirdField == "ENABLED" || configThirdField == "DISABLED")
            {
               newLine3 = StringFormat("[CONFIG] [MASTER] [%s]", configThirdField);

            }
            else
            {
               newLine3 = StringFormat("[CONFIG] [MASTER] [%d]", masterCounter);

            }

            FileWriteString(handle, newLine1 + "\n");
            FileWriteString(handle, newLine2 + "\n");
            FileWriteString(handle, newLine3);



      // Write all current orders
      int orderCount = OrdersTotal();
      for(int i = 0; i < orderCount; i++)
      {
         if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         {
                  string orderLine = StringFormat("[ORDER] [%d] [%s] [%s] [%s] [%s] [%s] [%s] [%d]",
                                    OrderTicket(),
                                    OrderSymbol(),
                                    GetOrderTypeString(OrderType()),
                                    DoubleToStr(OrderLots(), 2),
                                    DoubleToStr(OrderOpenPrice(), Digits),
                                    DoubleToStr(OrderStopLoss(), Digits),
                                    DoubleToStr(OrderTakeProfit(), Digits),
                                    IntegerToString(OrderOpenTime()));

                  FileWriteString(handle, "\n" + orderLine);
         }
      }

      FileClose(handle);

      PrintCSVContent();
   }
   else
   {

         }
      }
      else
      {

      }
   }
   else
   {

      // Don't create new CSV to avoid overwriting external changes
   }
}

//+------------------------------------------------------------------+
//| Get order type as string                                         |
//+------------------------------------------------------------------+
string GetOrderTypeString(int orderType)
{
   switch(orderType)
   {
      case OP_BUY: return "BUY";
      case OP_SELL: return "SELL";
      case OP_BUYLIMIT: return "BUYLIMIT";
      case OP_SELLLIMIT: return "SELLLIMIT";
      case OP_BUYSTOP: return "BUYSTOP";
      case OP_SELLSTOP: return "SELLSTOP";
      default: return "UNKNOWN";
   }
}

//+------------------------------------------------------------------+
//| Get UTC timestamp (always UTC regardless of local timezone)      |
//+------------------------------------------------------------------+
datetime GetUTCTime()
{
   // TimeCurrent() returns server time, which should be UTC
   // But we ensure it's UTC by using GMT time
   datetime localTime = TimeCurrent();
   datetime gmtTime = TimeGMT();

   // If server time is not UTC, use GMT time
   if(MathAbs(localTime - gmtTime) > 3600) // If difference is more than 1 hour
   {
      return gmtTime;
   }

   return localTime;
}

//+------------------------------------------------------------------+
//| Create simple CSV file                                           |
//+------------------------------------------------------------------+
void CreateSimpleCSV()
{
   int handle = FileOpen(csvFileName, FILE_TXT|FILE_WRITE|FILE_COMMON);
   if(handle != INVALID_HANDLE)
   {
      long account = AccountNumber();
      datetime utcTime = GetUTCTime();
      string timestamp = IntegerToString(utcTime);

      // Write new format with 3 lines
      string line1 = StringFormat("[TYPE] [PENDING] [MT4] [%d]", account);
      string line2 = StringFormat("[STATUS] [ONLINE] [%s]", timestamp);
      string line3 = "[CONFIG] [PENDING] []"; // Only for new files, preserves nothing

      FileWriteString(handle, line1 + "\n");
      FileWriteString(handle, line2 + "\n");
      FileWriteString(handle, line3);

      FileClose(handle);


      currentStatus = "PENDING"; // Ensure status is synchronized
   }
   else
   {

   }
}

//+------------------------------------------------------------------+
//| Read simple CSV file                                             |
//+------------------------------------------------------------------+
void ReadSimpleCSV()
{
   int handle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_COMMON);
   if(handle != INVALID_HANDLE)
   {
      // Read all 3 lines to get the status from CONFIG line
      string line1 = FileReadString(handle); // TYPE line
      string line2 = FileReadString(handle); // STATUS line
      string line3 = FileReadString(handle); // CONFIG line
      FileClose(handle);



      // Store previous status before reading new one
      string previousStatus = currentStatus;

      // Parse the CONFIG line to extract status
      // Format: [CONFIG] [STATUS] [EXTRA_DATA]
      if(StringFind(line3, "[CONFIG]") >= 0)
      {
         // Extract status from the second field of CONFIG line
         int startPos = StringFind(line3, "[");
         int endPos = StringFind(line3, "]");
         if(startPos >= 0 && endPos > startPos)
         {
            string firstField = StringSubstr(line3, startPos + 1, endPos - startPos - 1);


            // Find the second field (status)
            startPos = StringFind(line3, "[", endPos + 1);
            endPos = StringFind(line3, "]", startPos + 1);
            if(startPos >= 0 && endPos > startPos)
            {
               string statusField = StringSubstr(line3, startPos + 1, endPos - startPos - 1);


               // Set status based on the CONFIG field
               if(statusField == "PENDING")
      {
         currentStatus = "PENDING";

               }
               else if(statusField == "MASTER")
               {
                  currentStatus = "MASTER";

               }
               else if(statusField == "SLAVE")
               {
                  currentStatus = "SLAVE";


                  // Parse additional SLAVE configuration fields
                  int pos = endPos + 1;

                  // Reset slave variables to defaults
                  slaveMultiplier = 1.0;
                  slaveForceLot = 0.0;
                  slaveReverseTrading = false;
                  slaveMasterAccount = 0;

                  // Find third field: [ENABLED/DISABLED]
                  startPos = StringFind(line3, "[", pos);
                  endPos = StringFind(line3, "]", startPos);
                  if(startPos >= 0 && endPos > startPos)
                  {
                     string enabledStatus = StringSubstr(line3, startPos + 1, endPos - startPos - 1);

                     pos = endPos + 1;

                     // Find fourth field: [MULTIPLIER]
                     startPos = StringFind(line3, "[", pos);
                     endPos = StringFind(line3, "]", startPos);
                     if(startPos >= 0 && endPos > startPos)
                     {
                        string multiplierStr = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
                        slaveMultiplier = StringToDouble(multiplierStr);

                        pos = endPos + 1;

                        // Find fifth field: [FORCE_LOT]
                        startPos = StringFind(line3, "[", pos);
                        endPos = StringFind(line3, "]", startPos);
                        if(startPos >= 0 && endPos > startPos)
                        {
                           string forceLotStr = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
                           slaveForceLot = StringToDouble(forceLotStr);

                           pos = endPos + 1;

                           // Find sixth field: [REVERSE]
                           startPos = StringFind(line3, "[", pos);
                           endPos = StringFind(line3, "]", startPos);
                           if(startPos >= 0 && endPos > startPos)
                           {
                              string reverseStr = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
                              slaveReverseTrading = (reverseStr == "TRUE");

                              pos = endPos + 1;

                              // Find seventh field: [MASTER_ID]
                              startPos = StringFind(line3, "[", pos);
                              endPos = StringFind(line3, "]", startPos);
                              if(startPos >= 0 && endPos > startPos)
                              {
                                 string masterIdStr = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
                                 slaveMasterAccount = StringToInteger(masterIdStr);

                              }
                           }
                        }
                     }
                  }

                  // Configuration is now shown in start() function

               }
               else
               {
               }
            }
         }
      }
      else
      {
         // Fallback to old format for compatibility
         if(StringFind(line1, "[PENDING]") >= 0)
         {
            currentStatus = "PENDING";

         }
         else if(StringFind(line1, "[MASTER]") >= 0)
      {
         currentStatus = "MASTER";
         }
         else if(StringFind(line1, "[SLAVE]") >= 0)
         {
            currentStatus = "SLAVE";
         }
         else
         {
            currentStatus = "PENDING";
         }
      }

      if(currentStatus != previousStatus)
      {
         lastStatusChange = TimeCurrent();
         lastReadStatus = currentStatus;

         if(currentStatus == "MASTER" || currentStatus == "SLAVE")
         {
            isStatusProtected = true;
         }
         else if(previousStatus == "MASTER" || previousStatus == "SLAVE")
         {
            isStatusProtected = false;
         }

         // If status changed, update the TYPE line to match CONFIG
         if(currentStatus != previousStatus)
         {
            UpdateTypeLineToMatchConfig();
         }
      }
   }
   else
   {
      CreateSimpleCSV();
   }
}

//+------------------------------------------------------------------+
//| Update TYPE line to match CONFIG status                          |
//+------------------------------------------------------------------+
void UpdateTypeLineToMatchConfig()
{
   int handle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_COMMON);
   if(handle != INVALID_HANDLE)
   {
      // Read all 3 lines
      string line1 = FileReadString(handle); // TYPE line
      string line2 = FileReadString(handle); // STATUS line
      string line3 = FileReadString(handle); // CONFIG line
      FileClose(handle);

      // Extract account info from TYPE line
      // Format: [TYPE] [STATUS] [PLATFORM] [ACCOUNT_ID]
      string platform = "";
      string accountId = "";

      int startPos = StringFind(line1, "[");
      int endPos = StringFind(line1, "]");
      if(startPos >= 0 && endPos > startPos)
      {
         // Skip first field (TYPE)
         startPos = StringFind(line1, "[", endPos + 1);
         endPos = StringFind(line1, "]", startPos + 1);
         if(startPos >= 0 && endPos > startPos)
         {
            // Skip second field (old status)
            startPos = StringFind(line1, "[", endPos + 1);
            endPos = StringFind(line1, "]", startPos + 1);
            if(startPos >= 0 && endPos > startPos)
            {
               // Get platform (third field)
               platform = StringSubstr(line1, startPos + 1, endPos - startPos - 1);

               // Get account ID (fourth field)
               startPos = StringFind(line1, "[", endPos + 1);
               endPos = StringFind(line1, "]", startPos + 1);
               if(startPos >= 0 && endPos > startPos)
               {
                  accountId = StringSubstr(line1, startPos + 1, endPos - startPos - 1);
               }
            }
         }
      }

      // Create new TYPE line with current status
      string newLine1 = StringFormat("[TYPE] [%s] [%s] [%s]", currentStatus, platform, accountId);

      // Update timestamp in STATUS line
      datetime utcTime = GetUTCTime();
      string timestamp = IntegerToString(utcTime);
      string newLine2 = StringFormat("[STATUS] [ONLINE] [%s]", timestamp);

      // Write updated file
      int writeHandle = FileOpen(csvFileName, FILE_TXT|FILE_WRITE|FILE_COMMON);
      if(writeHandle != INVALID_HANDLE)
      {
         FileWriteString(writeHandle, newLine1 + "\n");
         FileWriteString(writeHandle, newLine2 + "\n");
         FileWriteString(writeHandle, line3); // Keep CONFIG line unchanged
         FileClose(writeHandle);

      }
      else
      {
      }
   }
   else
   {
   }
}

//+------------------------------------------------------------------+
//| Update CSV with timestamp for slave accounts                    |
//+------------------------------------------------------------------+
void UpdateSlaveCSV()
{
   // First, read current CSV to get the actual status
   int readHandle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_COMMON);
   if(readHandle != INVALID_HANDLE)
   {
      string line1 = FileReadString(readHandle); // TYPE line
      string line2 = FileReadString(readHandle); // STATUS line
      string line3 = FileReadString(readHandle); // CONFIG line
      FileClose(readHandle);

      string currentConfigStatus = "PENDING"; // default
      string configThirdField = ""; // preserve third field (ENABLED/DISABLED)
      if(StringFind(line3, "[CONFIG]") >= 0)
      {
         // Parse CONFIG line: [CONFIG] [STATUS] [THIRD_FIELD]
         int pos = 0;
         int startPos, endPos;

         // Find first field: [CONFIG]
         startPos = StringFind(line3, "[", pos);
         endPos = StringFind(line3, "]", startPos);
         if(startPos >= 0 && endPos > startPos)
         {
            pos = endPos + 1;

            // Find second field: [STATUS]
            startPos = StringFind(line3, "[", pos);
            endPos = StringFind(line3, "]", startPos);
            if(startPos >= 0 && endPos > startPos)
            {
               currentConfigStatus = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
               pos = endPos + 1;

               // Find third field: [THIRD_FIELD] (if exists)
               startPos = StringFind(line3, "[", pos);
               endPos = StringFind(line3, "]", startPos);
               if(startPos >= 0 && endPos > startPos)
               {
                  configThirdField = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
               }
            }
         }
      }


      // Clean configThirdField - but preserve ENABLED/DISABLED
      if(configThirdField != "ENABLED" && configThirdField != "DISABLED")
      {
         if(StringFind(configThirdField, "]") >= 0)
         {

            configThirdField = "";
         }
      }
      else
      {

      }

      // Only write SLAVE if the account is actually SLAVE
      if(currentConfigStatus == "SLAVE")
      {
         int handle = FileOpen(csvFileName, FILE_TXT|FILE_WRITE|FILE_COMMON);
         if(handle != INVALID_HANDLE)
         {
            long account = AccountNumber();
            datetime utcTime = GetUTCTime();
            string timestamp = IntegerToString(utcTime);

            // Write new format with 3 lines
            string newLine1 = StringFormat("[TYPE] [SLAVE] [MT4] [%d]", account);
            string newLine2 = StringFormat("[STATUS] [ONLINE] [%s]", timestamp);

            // Keep the original CONFIG line exactly as it was
            string newLine3 = line3;

            FileWriteString(handle, newLine1 + "\n");
            FileWriteString(handle, newLine2 + "\n");
            FileWriteString(handle, newLine3);

            FileClose(handle);

            PrintCSVContent();
         }
         else
         {
         }
      }
      else
      {
      }
   }
   else
   {
   }
}

//+------------------------------------------------------------------+
//| Update CSV with timestamp for pending accounts                  |
//+------------------------------------------------------------------+
void UpdatePendingCSV()
{
   // First, read current CSV to get the actual status
   int readHandle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_COMMON);
   if(readHandle != INVALID_HANDLE)
   {
      string line1 = FileReadString(readHandle); // TYPE line
      string line2 = FileReadString(readHandle); // STATUS line
      string line3 = FileReadString(readHandle); // CONFIG line
      FileClose(readHandle);

      // Extract current status from CONFIG line and preserve third field
      string currentConfigStatus = "PENDING"; // default
      string configThirdField = ""; // preserve third field (ENABLED/DISABLED)
      if(StringFind(line3, "[CONFIG]") >= 0)
      {
         // Parse CONFIG line: [CONFIG] [STATUS] [THIRD_FIELD]
         int pos = 0;
         int startPos, endPos;

         // Find first field: [CONFIG]
         startPos = StringFind(line3, "[", pos);
         endPos = StringFind(line3, "]", startPos);
         if(startPos >= 0 && endPos > startPos)
         {
            pos = endPos + 1;

            // Find second field: [STATUS]
            startPos = StringFind(line3, "[", pos);
            endPos = StringFind(line3, "]", startPos);
            if(startPos >= 0 && endPos > startPos)
            {
               currentConfigStatus = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
               pos = endPos + 1;

               // Find third field: [THIRD_FIELD] (if exists)
               startPos = StringFind(line3, "[", pos);
               endPos = StringFind(line3, "]", startPos);
               if(startPos >= 0 && endPos > startPos)
               {
                  configThirdField = StringSubstr(line3, startPos + 1, endPos - startPos - 1);
               }
            }
         }
      }



      // Clean configThirdField - but preserve ENABLED/DISABLED
      if(configThirdField != "ENABLED" && configThirdField != "DISABLED")
      {
         if(StringFind(configThirdField, "]") >= 0)
         {

            configThirdField = "";
         }
      }
      else
      {

      }

      // Only write PENDING if the account is actually PENDING
      if(currentConfigStatus == "PENDING")
      {
   int handle = FileOpen(csvFileName, FILE_TXT|FILE_WRITE|FILE_COMMON);
   if(handle != INVALID_HANDLE)
   {
      long account = AccountNumber();
      datetime utcTime = GetUTCTime();
      string timestamp = IntegerToString(utcTime);

            // Write new format with 3 lines, preserving third field
            string newLine1 = StringFormat("[TYPE] [PENDING] [MT4] [%d]", account);
            string newLine2 = StringFormat("[STATUS] [ONLINE] [%s]", timestamp);
            string newLine3;

            // If third field looks like ENABLED/DISABLED, preserve it; otherwise leave empty
            if(configThirdField == "ENABLED" || configThirdField == "DISABLED")
            {
               newLine3 = StringFormat("[CONFIG] [PENDING] [%s]", configThirdField);
            }
            else
            {
               newLine3 = "[CONFIG] [PENDING] []";
            }

            FileWriteString(handle, newLine1 + "\n");
            FileWriteString(handle, newLine2 + "\n");
            FileWriteString(handle, newLine3);

      FileClose(handle);

      PrintCSVContent();
      }
   else
   {
         }
      }
      else
      {
      }
   }
   else
   {
      // Don't create new CSV to avoid overwriting external changes
   }
}
