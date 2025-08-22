//+------------------------------------------------------------------+
//|                                                      IPTRADE_MT5 |
//|                                  Copyright 2025, Joaquin Metayer |
//|                                                http://jometa.dev |
//+------------------------------------------------------------------+
#property copyright "Copyright © 2025, Joaquin Metayer"
#property link      "http://jometa.dev"
#property version   "1.0"
#property description "IPTRADE MT5 Trade Copier"

// Resource for the program icon (will be loaded from IPTRADE/logo.ico)
//#resource "logo.ico"
//#property icon "logo.ico"

// External parameters
input int PENDING_UPDATE_INTERVAL_MS = 500; // milisegundos para actualización de cuentas pendientes
input int MASTER_UPDATE_INTERVAL_MS = 1000; // milisegundos para actualización de cuentas master
input int STATUS_PROTECTION_SECONDS = 3; // segundos de protección para evitar sobrescritura de estados MASTER/SLAVE
input bool FORCE_PENDING_ON_START = false; // force PENDING status on startup (overwrites existing CSV)

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

// Static variables for order monitoring
double lastSL = 0;
double lastTP = 0;
double lastPosSL = 0;
double lastPosTP = 0;

//+------------------------------------------------------------------+
//| Function declarations                                             |
//+------------------------------------------------------------------+
datetime GetUTCTime();
void CreateSimpleCSV();
void ReadSimpleCSV();
void UpdatePendingCSV();
void UpdateSlaveCSV();
void UpdateMasterCSV();
void UpdateTypeLineToMatchConfig();
bool CheckOrderChanges();
string GetOrderTypeString(ENUM_ORDER_TYPE orderType);
string GetPositionTypeString(ENUM_POSITION_TYPE positionType);
string CleanString(string strInput);

//+------------------------------------------------------------------+
//| Clean string from BOM and special characters                     |
//+------------------------------------------------------------------+
string CleanString(string strInput)
{
   if(StringLen(strInput) == 0) return(strInput);

   string cleaned = strInput;

   // Remove any leading zeros or special characters before [
   int bracketPos = StringFind(cleaned, "[");
   if(bracketPos > 0)
   {
      cleaned = StringSubstr(cleaned, bracketPos);
   }

   // Remove any trailing whitespace or special characters
   cleaned = StringTrimRight(cleaned);

   // Remove any carriage return or line feed characters
   cleaned = StringReplace(cleaned, "\r", "");
   cleaned = StringReplace(cleaned, "\n", "");

   // Remove any other special characters that might be causing issues
   cleaned = StringReplace(cleaned, "\t", "");

   return(cleaned);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   lastPendingUpdate = 0;

   if(FORCE_PENDING_ON_START)
   {
      CreateSimpleCSV();
      currentStatus = "PENDING";
      isStatusProtected = false;
      lastReadStatus = "PENDING";
      lastStatusChange = 0;
   }
   else
   {
      ReadSimpleCSV();
   }

   lastFileCheck = TimeCurrent();
   EventSetMillisecondTimer(PENDING_UPDATE_INTERVAL_MS);

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");

}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check file every 5 seconds
   if(TimeCurrent() - lastFileCheck >= 5)
   {
      ReadSimpleCSV();
      lastFileCheck = TimeCurrent();
   }

   // Status is shown in OnTimer
}

//+------------------------------------------------------------------+
//| Timer function - se ejecuta según PENDING_UPDATE_INTERVAL_MS      |
//+------------------------------------------------------------------+
void OnTimer()
{
   static int timerCount = 0;
   timerCount++;

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
      // Only update if not in status protection period
      if(!isStatusProtected)
      {
         UpdatePendingCSV();
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
   int handle = FileOpen(csvFileName, FILE_CSV|FILE_WRITE|FILE_ANSI|FILE_COMMON, "\n");
   if(handle != INVALID_HANDLE)
   {
      long account = AccountInfoInteger(ACCOUNT_LOGIN);
      datetime utcTime = GetUTCTime();
      string timestamp = IntegerToString((int)utcTime);

      // Write new format with 3 lines
      string line1 = "[TYPE] [PENDING] [MT5] [" + IntegerToString((int)account) + "]";
      string line2 = "[STATUS] [ONLINE] [" + timestamp + "]";
      string line3 = "[CONFIG] [PENDING] []";

      FileWrite(handle, line1);
      FileWrite(handle, line2);
      FileWrite(handle, line3);

      FileClose(handle);

      PrintCSVContent();

      currentStatus = "PENDING"; // Ensure status is synchronized
   }
}

//+------------------------------------------------------------------+
//| Read simple CSV file                                             |
//+------------------------------------------------------------------+
void ReadSimpleCSV()
{
   int handle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
   if(handle != INVALID_HANDLE)
   {
      // Read the file line by line
      string line1 = "";
      string line2 = "";
      string line3 = "";

      if(!FileIsEnding(handle))
         line1 = FileReadString(handle);
      if(!FileIsEnding(handle))
         line2 = FileReadString(handle);
      if(!FileIsEnding(handle))
         line3 = FileReadString(handle);

      FileClose(handle);

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

                  int pos = endPos + 1;

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

      }

      // Check if status changed and activate protection if needed
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

         // Update the TYPE line to match CONFIG
         UpdateTypeLineToMatchConfig();
      }
   }
   else
   {
      CreateSimpleCSV();
   }
}

//+------------------------------------------------------------------+
//| Update CSV with timestamp for slave accounts                    |
//+------------------------------------------------------------------+
void UpdateSlaveCSV()
{
   // First, read current CSV to get the actual status
   int readHandle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
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


      // Check if CONFIG status is different from current status
      if(currentConfigStatus != currentStatus)
      {
         currentStatus = currentConfigStatus;
         UpdateTypeLineToMatchConfig();
         return; // Exit early to let the system re-read and process
      }

      // Only write SLAVE if the account is actually SLAVE
      if(currentConfigStatus == "SLAVE")
      {
         int handle = FileOpen(csvFileName, FILE_CSV|FILE_WRITE|FILE_ANSI|FILE_COMMON, "\n");
         if(handle != INVALID_HANDLE)
         {
            long account = AccountInfoInteger(ACCOUNT_LOGIN);
            datetime utcTime = GetUTCTime();
            string timestamp = IntegerToString((int)utcTime);

            // Write new format with 3 lines
            string newLine1 = "[TYPE] [SLAVE] [MT5] [" + IntegerToString((int)account) + "]";
            string newLine2 = "[STATUS] [ONLINE] [" + timestamp + "]";

            // Keep the original CONFIG line exactly as it was
            string newLine3 = line3;

            FileWrite(handle, newLine1);
            FileWrite(handle, newLine2);
            FileWrite(handle, newLine3);

            FileClose(handle);

            // Print CSV content after update
            PrintCSVContent();
         }

      }

   }

}

//+------------------------------------------------------------------+
//| Update CSV with timestamp for pending accounts                  |
//+------------------------------------------------------------------+
void UpdatePendingCSV()
{
   // First, read current CSV to get the actual status
   int readHandle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
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
      // Check if CONFIG status is different from current status
      if(currentConfigStatus != currentStatus)
      {
         currentStatus = currentConfigStatus;
         UpdateTypeLineToMatchConfig();
         return; // Exit early to let the system re-read and process
      }

      // Only write PENDING if the account is actually PENDING
      if(currentConfigStatus == "PENDING")
      {
         int handle = FileOpen(csvFileName, FILE_CSV|FILE_WRITE|FILE_ANSI|FILE_COMMON, "\n");
         if(handle != INVALID_HANDLE)
         {
            long account = AccountInfoInteger(ACCOUNT_LOGIN);
            datetime utcTime = GetUTCTime();
            string timestamp = IntegerToString((int)utcTime);

            // Write new format with 3 lines, preserving third field
            string newLine1 = "[TYPE] [PENDING] [MT5] [" + IntegerToString((int)account) + "]";
            string newLine2 = "[STATUS] [ONLINE] [" + timestamp + "]";
            string newLine3;

            if(configThirdField == "ENABLED" || configThirdField == "DISABLED")
            {
               newLine3 = "[CONFIG] [PENDING] [" + configThirdField + "]";
            }
            else
            {
               newLine3 = "[CONFIG] [PENDING] []";
            }

            FileWrite(handle, newLine1);
            FileWrite(handle, newLine2);
            FileWrite(handle, newLine3);

            FileClose(handle);

            // Print CSV content after update
            PrintCSVContent();
         }

      }

   }
}

//+------------------------------------------------------------------+
//| Check for order changes and return true if there are changes     |
//+------------------------------------------------------------------+
bool CheckOrderChanges()
{
   int currentOrderCount = OrdersTotal();
   int currentPositionCount = PositionsTotal();
   int totalCount = currentOrderCount + currentPositionCount;

   // If total count changed, there are definitely changes
   if(totalCount != lastOrderCount)
   {
      lastOrderCount = totalCount;
      return true;
   }

   // Check for modifications in existing orders
   for(int i = 0; i < currentOrderCount; i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket))
      {
         // Check if order was modified recently (within last few seconds)
         if(TimeCurrent() - OrderGetInteger(ORDER_TIME_SETUP) < 10 ||
            (OrderGetDouble(ORDER_SL) != 0 && TimeCurrent() - OrderGetInteger(ORDER_TIME_SETUP) < 10) ||
            (OrderGetDouble(ORDER_TP) != 0 && TimeCurrent() - OrderGetInteger(ORDER_TIME_SETUP) < 10))
         {
            return true;
         }

         // Check for modifications in SL/TP levels
         if(OrderGetDouble(ORDER_SL) != lastSL || OrderGetDouble(ORDER_TP) != lastTP)
         {
            lastSL = OrderGetDouble(ORDER_SL);
            lastTP = OrderGetDouble(ORDER_TP);
            return true;
         }
      }
   }

   // Check for modifications in existing positions
   for(int i = 0; i < currentPositionCount; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelect(ticket))
      {
         // Check if position was modified recently
         if(TimeCurrent() - PositionGetInteger(POSITION_TIME) < 10)
         {
            return true;
         }

         // Check for modifications in SL/TP levels
         if(PositionGetDouble(POSITION_SL) != lastPosSL || PositionGetDouble(POSITION_TP) != lastPosTP)
         {
            lastPosSL = PositionGetDouble(POSITION_SL);
            lastPosTP = PositionGetDouble(POSITION_TP);
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
   int readHandle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
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

      // Check if CONFIG status is different from current status
      if(currentConfigStatus != currentStatus)
      {
         currentStatus = currentConfigStatus;
         UpdateTypeLineToMatchConfig();
         return; // Exit early to let the system re-read and process
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


         int handle = FileOpen(csvFileName, FILE_CSV|FILE_WRITE|FILE_ANSI|FILE_COMMON, "\n");
         if(handle != INVALID_HANDLE)
         {
            long account = AccountInfoInteger(ACCOUNT_LOGIN);
            datetime utcTime = GetUTCTime();
            string timestamp = IntegerToString((int)utcTime);

            // Write master header lines with new format, preserving third field if it's not a number
            string newLine1 = "[TYPE] [MASTER] [MT5] [" + IntegerToString((int)account) + "]";
            string newLine2 = "[STATUS] [ONLINE] [" + timestamp + "]";
            string newLine3;

            // If third field looks like ENABLED/DISABLED, preserve it; otherwise use counter
            if(configThirdField == "ENABLED" || configThirdField == "DISABLED")
            {
               newLine3 = "[CONFIG] [MASTER] [" + configThirdField + "]";
            }
            else
            {
               newLine3 = "[CONFIG] [MASTER] [" + IntegerToString(masterCounter) + "]";
            }

            FileWrite(handle, newLine1);
            FileWrite(handle, newLine2);
            FileWrite(handle, newLine3);



            // Write all current orders and positions
            int orderCount = OrdersTotal();
            int positionCount = PositionsTotal();

            // Write orders
            for(int i = 0; i < orderCount; i++)
            {
               ulong ticket = OrderGetTicket(i);
               if(OrderSelect(ticket))
               {
                  string orderLine = "[ORDER] [" + IntegerToString((int)OrderGetInteger(ORDER_TICKET)) + "] [" +
                                    OrderGetString(ORDER_SYMBOL) + "] [" +
                                    GetOrderTypeString((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE)) + "] [" +
                                    DoubleToString(OrderGetDouble(ORDER_VOLUME_INITIAL), 2) + "] [" +
                                    DoubleToString(OrderGetDouble(ORDER_PRICE_OPEN), Digits()) + "] [" +
                                    DoubleToString(OrderGetDouble(ORDER_SL), Digits()) + "] [" +
                                    DoubleToString(OrderGetDouble(ORDER_TP), Digits()) + "] [" +
                                    IntegerToString((int)OrderGetInteger(ORDER_TIME_SETUP)) + "]";

                  FileWrite(handle, orderLine);

               }
            }

            // Write positions
            for(int i = 0; i < positionCount; i++)
            {
               ulong ticket = PositionGetTicket(i);
               if(PositionSelect(ticket))
               {
                  string positionLine = "[ORDER] [" + IntegerToString((int)PositionGetInteger(POSITION_TICKET)) + "] [" +
                                       PositionGetString(POSITION_SYMBOL) + "] [" +
                                       GetPositionTypeString((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)) + "] [" +
                                       DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + "] [" +
                                       DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), Digits()) + "] [" +
                                       DoubleToString(PositionGetDouble(POSITION_SL), Digits()) + "] [" +
                                       DoubleToString(PositionGetDouble(POSITION_TP), Digits()) + "] [" +
                                       IntegerToString((int)PositionGetInteger(POSITION_TIME)) + "]";

                  FileWrite(handle, positionLine);

               }
            }

            FileClose(handle);

            // Print CSV content after update
            PrintCSVContent();
         }

      }

   }
}

//+------------------------------------------------------------------+
//| Print all CSV content line by line                               |
//+------------------------------------------------------------------+
void PrintCSVContent()
{
   int handle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
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
//| Get order type as string                                         |
//+------------------------------------------------------------------+
string GetOrderTypeString(ENUM_ORDER_TYPE orderType)
{
   switch(orderType)
   {
      case ORDER_TYPE_BUY: return "BUY";
      case ORDER_TYPE_SELL: return "SELL";
      case ORDER_TYPE_BUY_LIMIT: return "BUYLIMIT";
      case ORDER_TYPE_SELL_LIMIT: return "SELLLIMIT";
      case ORDER_TYPE_BUY_STOP: return "BUYSTOP";
      case ORDER_TYPE_SELL_STOP: return "SELLSTOP";
      case ORDER_TYPE_BUY_STOP_LIMIT: return "BUYSTOPLIMIT";
      case ORDER_TYPE_SELL_STOP_LIMIT: return "SELLSTOPLIMIT";
      default: return "UNKNOWN";
   }
}

//+------------------------------------------------------------------+
//| Get position type as string                                      |
//+------------------------------------------------------------------+
string GetPositionTypeString(ENUM_POSITION_TYPE positionType)
{
   switch(positionType)
   {
      case POSITION_TYPE_BUY: return "BUY";
      case POSITION_TYPE_SELL: return "SELL";
      default: return "UNKNOWN";
   }
}

//+------------------------------------------------------------------+
//| Update TYPE line to match CONFIG status                          |
//+------------------------------------------------------------------+
void UpdateTypeLineToMatchConfig()
{
   int handle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
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
      string newLine1 = "[TYPE] [" + currentStatus + "] [" + platform + "] [" + accountId + "]";

      // Update timestamp in STATUS line
      datetime utcTime = GetUTCTime();
      string timestamp = IntegerToString((int)utcTime);
      string newLine2 = "[STATUS] [ONLINE] [" + timestamp + "]";

      // Write updated file
      int writeHandle = FileOpen(csvFileName, FILE_CSV|FILE_WRITE|FILE_ANSI|FILE_COMMON, "\n");
      if(writeHandle != INVALID_HANDLE)
      {
         FileWrite(writeHandle, newLine1);
         FileWrite(writeHandle, newLine2);
         FileWrite(writeHandle, line3); // Keep CONFIG line unchanged
         FileClose(writeHandle);

      }
   }

}
