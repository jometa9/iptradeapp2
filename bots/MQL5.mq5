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
input int MAX_ORDER_AGE_SECONDS = 300; // máximo tiempo en segundos para considerar una orden de mercado válida (5 minutos)
input bool ENABLE_ORDER_CLEANUP = true; // habilitar limpieza de órdenes huérfanas

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
string slaveMasterCsvPath = "";   // Ruta al CSV del master (Windows only)

// Slave order tracking variables
struct ProcessedOrder
{
   string ticket;
   string symbol;
   string orderType;
   double lotSize;
   double price;
   double sl;
   double tp;
   string timestamp;
};

ProcessedOrder processedOrders[];  // Array de órdenes procesadas con datos completos
int processedOrdersCount = 0;      // Contador de órdenes procesadas

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
void ForceHeartbeatUpdate();
bool CheckOrderChanges();
void ParseSlaveConfig();
void ProcessMasterOrdersDirectly();
string GetOrderTypeString(ENUM_ORDER_TYPE orderType);
string GetPositionTypeString(ENUM_POSITION_TYPE positionType);
string CleanString(string strInput);

//+------------------------------------------------------------------+
//| Find processed order by ticket                                   |
//+------------------------------------------------------------------+
int FindProcessedOrderIndex(string ticket)
{
   for(int i = 0; i < processedOrdersCount; i++)
   {
      if(processedOrders[i].ticket == ticket)
      {
         return i;
      }
   }
   return -1; // Not found
}

//+------------------------------------------------------------------+
//| Check if order was already processed                             |
//+------------------------------------------------------------------+
bool IsOrderProcessed(string ticket)
{
   return (FindProcessedOrderIndex(ticket) >= 0);
}

//+------------------------------------------------------------------+
//| Check if order has been modified                                 |
//+------------------------------------------------------------------+
bool IsOrderModified(string ticket, string symbol, string orderType,
                    double lotSize, double price, double sl, double tp, string timestamp)
{
   int index = FindProcessedOrderIndex(ticket);
   if(index < 0) return false; // Order not found, not modified

   ProcessedOrder existing = processedOrders[index];

   // Compare all relevant fields
   if(existing.symbol != symbol ||
      existing.orderType != orderType ||
      MathAbs(existing.lotSize - lotSize) > 0.00001 ||
      MathAbs(existing.price - price) > 0.00001 ||
      MathAbs(existing.sl - sl) > 0.00001 ||
      MathAbs(existing.tp - tp) > 0.00001)
   {
      Print("=== ORDER MODIFICATION DETECTED ===");
      Print("Ticket: ", ticket);
      Print("Symbol: ", existing.symbol, " -> ", symbol);
      Print("Type: ", existing.orderType, " -> ", orderType);
      Print("Lot: ", existing.lotSize, " -> ", lotSize);
      Print("Price: ", existing.price, " -> ", price);
      Print("SL: ", existing.sl, " -> ", sl);
      Print("TP: ", existing.tp, " -> ", tp);
      Print("===================================");
      return true;
   }

   return false;
}

//+------------------------------------------------------------------+
//| Add or update processed order                                    |
//+------------------------------------------------------------------+
void AddOrUpdateProcessedOrder(string ticket, string symbol, string orderType,
                              double lotSize, double price, double sl, double tp, string timestamp)
{
   int index = FindProcessedOrderIndex(ticket);

   if(index >= 0)
   {
      // Update existing order
      processedOrders[index].symbol = symbol;
      processedOrders[index].orderType = orderType;
      processedOrders[index].lotSize = lotSize;
      processedOrders[index].price = price;
      processedOrders[index].sl = sl;
      processedOrders[index].tp = tp;
      processedOrders[index].timestamp = timestamp;

      Print("=== SLAVE ORDER UPDATED ===");
      Print("Updated ticket in processed list: ", ticket);
      Print("===========================");
   }
   else
   {
      // Add new order
      if(processedOrdersCount >= ArraySize(processedOrders))
      {
         ArrayResize(processedOrders, processedOrdersCount + 100);
      }

      processedOrders[processedOrdersCount].ticket = ticket;
      processedOrders[processedOrdersCount].symbol = symbol;
      processedOrders[processedOrdersCount].orderType = orderType;
      processedOrders[processedOrdersCount].lotSize = lotSize;
      processedOrders[processedOrdersCount].price = price;
      processedOrders[processedOrdersCount].sl = sl;
      processedOrders[processedOrdersCount].tp = tp;
      processedOrders[processedOrdersCount].timestamp = timestamp;

      processedOrdersCount++;

      Print("=== SLAVE ORDER TRACKED ===");
      Print("Added ticket to processed list: ", ticket);
      Print("Total processed orders: ", processedOrdersCount);
      Print("==========================");
   }
}

//+------------------------------------------------------------------+
//| Calculate lot size based on slave configuration                  |
//+------------------------------------------------------------------+
double CalculateSlaveLotSize(double masterLotSize, string symbol)
{
   double calculatedLot = masterLotSize;

   // Apply force lot if configured
   if(slaveForceLot > 0.0)
   {
      calculatedLot = slaveForceLot;
   }
   else
   {
      // Apply multiplier
      calculatedLot = masterLotSize * slaveMultiplier;
   }

   // Ensure lot size is within broker limits
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

   if(calculatedLot < minLot) calculatedLot = minLot;
   if(calculatedLot > maxLot) calculatedLot = maxLot;

   // Round to lot step
   calculatedLot = MathRound(calculatedLot / lotStep) * lotStep;

   return calculatedLot;
}

//+------------------------------------------------------------------+
//| Convert order type for reverse trading                           |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE GetSlaveOrderType(string masterOrderType)
{
   ENUM_ORDER_TYPE orderType = ORDER_TYPE_BUY; // default

   // Convert string to order type
   if(masterOrderType == "BUY") orderType = ORDER_TYPE_BUY;
   else if(masterOrderType == "SELL") orderType = ORDER_TYPE_SELL;
   else if(masterOrderType == "BUYLIMIT") orderType = ORDER_TYPE_BUY_LIMIT;
   else if(masterOrderType == "SELLLIMIT") orderType = ORDER_TYPE_SELL_LIMIT;
   else if(masterOrderType == "BUYSTOP") orderType = ORDER_TYPE_BUY_STOP;
   else if(masterOrderType == "SELLSTOP") orderType = ORDER_TYPE_SELL_STOP;
   else if(masterOrderType == "BUYSTOPLIMIT") orderType = ORDER_TYPE_BUY_STOP_LIMIT;
   else if(masterOrderType == "SELLSTOPLIMIT") orderType = ORDER_TYPE_SELL_STOP_LIMIT;

   // Apply reverse trading if configured
   if(slaveReverseTrading)
   {
      switch(orderType)
      {
         case ORDER_TYPE_BUY: return ORDER_TYPE_SELL;
         case ORDER_TYPE_SELL: return ORDER_TYPE_BUY;
         case ORDER_TYPE_BUY_LIMIT: return ORDER_TYPE_SELL_LIMIT;
         case ORDER_TYPE_SELL_LIMIT: return ORDER_TYPE_BUY_LIMIT;
         case ORDER_TYPE_BUY_STOP: return ORDER_TYPE_SELL_STOP;
         case ORDER_TYPE_SELL_STOP: return ORDER_TYPE_BUY_STOP;
         case ORDER_TYPE_BUY_STOP_LIMIT: return ORDER_TYPE_SELL_STOP_LIMIT;
         case ORDER_TYPE_SELL_STOP_LIMIT: return ORDER_TYPE_BUY_STOP_LIMIT;
      }
   }

   return orderType;
}

//+------------------------------------------------------------------+
//| Find slave order by master ticket in comment                     |
//+------------------------------------------------------------------+
ulong FindSlaveOrderByMasterTicket(string masterTicket)
{
   string searchComment = "SLAVE:" + masterTicket;

   // Check pending orders
   for(int i = 0; i < OrdersTotal(); i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket))
      {
         if(StringFind(OrderGetString(ORDER_COMMENT), searchComment) >= 0)
         {
            return ticket;
         }
      }
   }

   // Check positions
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelect(ticket))
      {
         if(StringFind(PositionGetString(POSITION_COMMENT), searchComment) >= 0)
         {
            return ticket;
         }
      }
   }

   return 0; // Not found
}

//+------------------------------------------------------------------+
//| Modify existing slave order                                      |
//+------------------------------------------------------------------+
bool ModifySlaveOrder(string masterTicket, string symbol, string orderTypeStr,
                     double lotSize, double price, double sl, double tp)
{
   ulong slaveTicket = FindSlaveOrderByMasterTicket(masterTicket);
   if(slaveTicket == 0)
   {
      Print("=== SLAVE ORDER NOT FOUND FOR MODIFICATION ===");
      Print("Master ticket: ", masterTicket);
      Print("===============================================");
      return false;
   }

   // Calculate new slave values
   double slaveLotSize = CalculateSlaveLotSize(lotSize, symbol);
   ENUM_ORDER_TYPE slaveOrderType = GetSlaveOrderType(orderTypeStr);

   double slaveSL = sl;
   double slaveTP = tp;
   if(slaveReverseTrading && (slaveOrderType == ORDER_TYPE_BUY || slaveOrderType == ORDER_TYPE_SELL))
   {
      slaveSL = tp;
      slaveTP = sl;
   }

   Print("=== MODIFYING SLAVE ORDER ===");
   Print("Slave ticket: ", slaveTicket);
   Print("Master ticket: ", masterTicket);
   Print("New SL: ", slaveSL, " New TP: ", slaveTP);
   Print("=============================");

   // Prepare modification request
   MqlTradeRequest request = {};
   MqlTradeResult result = {};

   // Check if it's a pending order or position
   if(OrderSelect(slaveTicket))
   {
      // It's a pending order
      request.action = TRADE_ACTION_MODIFY;
      request.order = slaveTicket;
      request.price = OrderGetDouble(ORDER_PRICE_OPEN); // Keep original price
      request.sl = slaveSL;
      request.tp = slaveTP;
   }
   else if(PositionSelect(slaveTicket))
   {
      // It's a position
      request.action = TRADE_ACTION_SLTP;
      request.symbol = symbol;
      request.sl = slaveSL;
      request.tp = slaveTP;
   }
   else
   {
      Print("=== ERROR: SLAVE ORDER/POSITION NOT FOUND ===");
      Print("Slave ticket: ", slaveTicket);
      Print("==============================================");
      return false;
   }

   bool success = OrderSend(request, result);

   if(success && (result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED))
   {
      Print("=== SLAVE ORDER MODIFIED SUCCESS ===");
      Print("Slave ticket: ", slaveTicket);
      Print("Master ticket: ", masterTicket);
      Print("Return code: ", result.retcode);
      Print("====================================");
      return true;
   }
   else
   {
      Print("=== SLAVE ORDER MODIFY FAILED ===");
      Print("Error: ", result.retcode, " - ", result.comment);
      Print("Slave ticket: ", slaveTicket);
      Print("Master ticket: ", masterTicket);
      Print("=================================");
      return false;
   }
}

//+------------------------------------------------------------------+
//| Check if order is too old to execute (for market orders)         |
//+------------------------------------------------------------------+
bool IsOrderTooOld(string orderTypeStr, string timestamp)
{
   // Only check age for market orders
   if(orderTypeStr != "BUY" && orderTypeStr != "SELL")
   {
      return false; // Pending orders can be older
   }

   datetime orderTime = StringToTime(timestamp);
   datetime currentTime = TimeCurrent();
   int ageInSeconds = (int)(currentTime - orderTime);

   if(ageInSeconds > MAX_ORDER_AGE_SECONDS)
   {
      Print("=== ORDER TOO OLD ===");
      Print("Order type: ", orderTypeStr);
      Print("Order time: ", TimeToString(orderTime));
      Print("Current time: ", TimeToString(currentTime));
      Print("Age: ", ageInSeconds, " seconds (max: ", MAX_ORDER_AGE_SECONDS, ")");
      Print("=====================");
      return true;
   }

   return false;
}

//+------------------------------------------------------------------+
//| Close slave order by master ticket                               |
//+------------------------------------------------------------------+
bool CloseSlaveOrder(string masterTicket)
{
   ulong slaveTicket = FindSlaveOrderByMasterTicket(masterTicket);
   if(slaveTicket == 0)
   {
      Print("=== SLAVE ORDER NOT FOUND FOR CLOSURE ===");
      Print("Master ticket: ", masterTicket);
      Print("=========================================");
      return false;
   }

   Print("=== CLOSING SLAVE ORDER ===");
   Print("Slave ticket: ", slaveTicket);
   Print("Master ticket: ", masterTicket);
   Print("===========================");

   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   bool success = false;

   // Check if it's a pending order or position
   if(OrderSelect(slaveTicket))
   {
      // It's a pending order - delete it
      request.action = TRADE_ACTION_REMOVE;
      request.order = slaveTicket;
      success = OrderSend(request, result);
   }
   else if(PositionSelectByTicket(slaveTicket))
   {
      // It's a position - close it
      request.action = TRADE_ACTION_DEAL;
      request.symbol = PositionGetString(POSITION_SYMBOL);
      request.volume = PositionGetDouble(POSITION_VOLUME);
      request.type = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
      request.price = (request.type == ORDER_TYPE_SELL) ? SymbolInfoDouble(request.symbol, SYMBOL_BID) : SymbolInfoDouble(request.symbol, SYMBOL_ASK);
      request.deviation = 3;
      request.comment = "CLOSE SLAVE:" + masterTicket;
      success = OrderSend(request, result);
   }
   else
   {
      Print("=== ERROR: SLAVE ORDER/POSITION NOT FOUND ===");
      Print("Slave ticket: ", slaveTicket);
      Print("==============================================");
      return false;
   }

   if(success && (result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED))
   {
      Print("=== SLAVE ORDER CLOSED SUCCESS ===");
      Print("Slave ticket: ", slaveTicket);
      Print("Master ticket: ", masterTicket);
      Print("Return code: ", result.retcode);
      Print("==================================");
      return true;
   }
   else
   {
      Print("=== SLAVE ORDER CLOSE FAILED ===");
      Print("Error: ", result.retcode, " - ", result.comment);
      Print("Slave ticket: ", slaveTicket);
      Print("Master ticket: ", masterTicket);
      Print("================================");
      return false;
   }
}

//+------------------------------------------------------------------+
//| Remove processed order from tracking                             |
//+------------------------------------------------------------------+
void RemoveProcessedOrder(string ticket)
{
   int index = FindProcessedOrderIndex(ticket);
   if(index < 0) return; // Not found

   // Shift all elements after the removed one
   for(int i = index; i < processedOrdersCount - 1; i++)
   {
      processedOrders[i] = processedOrders[i + 1];
   }

   processedOrdersCount--;

   Print("=== SLAVE ORDER REMOVED FROM TRACKING ===");
   Print("Removed ticket: ", ticket);
   Print("Remaining processed orders: ", processedOrdersCount);
   Print("=========================================");
}

//+------------------------------------------------------------------+
//| Clean up orphaned slave orders (orders not in CSV anymore)      |
//+------------------------------------------------------------------+
void CleanupOrphanedOrders(string &csvOrderTickets[], int csvOrderCount)
{
   if(!ENABLE_ORDER_CLEANUP) return;

   Print("=== CLEANING UP ORPHANED ORDERS ===");
   Print("CSV orders count: ", csvOrderCount);
   Print("Processed orders count: ", processedOrdersCount);

   int orphansFound = 0;
   int orphansClosed = 0;

   // Check each processed order to see if it still exists in CSV
   for(int i = processedOrdersCount - 1; i >= 0; i--) // Iterate backwards for safe removal
   {
      string processedTicket = processedOrders[i].ticket;
      bool foundInCSV = false;

      // Search for this ticket in CSV orders
      for(int j = 0; j < csvOrderCount; j++)
      {
         if(csvOrderTickets[j] == processedTicket)
         {
            foundInCSV = true;
            break;
         }
      }

      if(!foundInCSV)
      {
         orphansFound++;
         Print("=== ORPHANED ORDER DETECTED ===");
         Print("Master ticket: ", processedTicket);
         Print("Order no longer in CSV - closing slave order");
         Print("===============================");

         // Close the slave order
         if(CloseSlaveOrder(processedTicket))
         {
            // Remove from processed orders tracking
            RemoveProcessedOrder(processedTicket);
            orphansClosed++;
         }
      }
   }

   Print("Orphaned orders found: ", orphansFound);
   Print("Orphaned orders closed: ", orphansClosed);
   Print("===================================");
}

//+------------------------------------------------------------------+
//| Execute slave order based on master order data                   |
//+------------------------------------------------------------------+
bool ExecuteSlaveOrder(string masterTicket, string symbol, string orderTypeStr,
                      double lotSize, double price, double sl, double tp, string timestamp)
{
   // Check if order was already processed
   if(IsOrderProcessed(masterTicket))
   {
      // Check if order has been modified
      if(IsOrderModified(masterTicket, symbol, orderTypeStr, lotSize, price, sl, tp, timestamp))
      {
         // Try to modify the existing slave order
         if(ModifySlaveOrder(masterTicket, symbol, orderTypeStr, lotSize, price, sl, tp))
         {
            // Update the processed order data
            AddOrUpdateProcessedOrder(masterTicket, symbol, orderTypeStr, lotSize, price, sl, tp, timestamp);
            return true;
         }
         else
         {
            Print("=== FAILED TO MODIFY SLAVE ORDER ===");
            Print("Master ticket: ", masterTicket);
            Print("====================================");
            return false;
         }
      }
      else
      {
         return true; // Already processed and no changes, skip
      }
   }

   // Check if order is too old (for market orders)
   if(IsOrderTooOld(orderTypeStr, timestamp))
   {
      Print("=== SKIPPING OLD ORDER ===");
      Print("Master ticket: ", masterTicket);
      Print("Order type: ", orderTypeStr);
      Print("==========================");
      return false; // Skip old market orders
   }

   // Calculate slave lot size
   double slaveLotSize = CalculateSlaveLotSize(lotSize, symbol);

   // Get slave order type (with reverse trading if configured)
   ENUM_ORDER_TYPE slaveOrderType = GetSlaveOrderType(orderTypeStr);

   // Adjust SL/TP for reverse trading
   double slaveSL = sl;
   double slaveTP = tp;
   if(slaveReverseTrading && (slaveOrderType == ORDER_TYPE_BUY || slaveOrderType == ORDER_TYPE_SELL))
   {
      // For market orders, swap SL and TP when reversing
      slaveSL = tp;
      slaveTP = sl;
   }

   Print("=== EXECUTING SLAVE ORDER ===");
   Print("Master ticket: ", masterTicket);
   Print("Symbol: ", symbol);
   Print("Original type: ", orderTypeStr, " -> Slave type: ", EnumToString(slaveOrderType));
   Print("Original lot: ", lotSize, " -> Slave lot: ", slaveLotSize);
   Print("Price: ", price);
   Print("SL: ", slaveSL, " TP: ", slaveTP);
   Print("Reverse trading: ", slaveReverseTrading ? "TRUE" : "FALSE");
   Print("=============================");

   // Prepare trade request
   MqlTradeRequest request = {};
   MqlTradeResult result = {};

   request.action = TRADE_ACTION_PENDING;
   request.symbol = symbol;
   request.volume = slaveLotSize;
   request.type = slaveOrderType;
   request.price = price;
   request.sl = slaveSL;
   request.tp = slaveTP;
   request.deviation = 3;
   request.magic = 0;
   request.comment = "SLAVE:" + masterTicket;

   // For market orders, use different action
   if(slaveOrderType == ORDER_TYPE_BUY || slaveOrderType == ORDER_TYPE_SELL)
   {
      request.action = TRADE_ACTION_DEAL;
      if(slaveOrderType == ORDER_TYPE_BUY)
      {
         request.price = SymbolInfoDouble(symbol, SYMBOL_ASK);
      }
      else
      {
         request.price = SymbolInfoDouble(symbol, SYMBOL_BID);
      }
   }

   bool success = OrderSend(request, result);

   if(success && (result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED))
   {
      Print("=== SLAVE ORDER SUCCESS ===");
      Print("New slave ticket: ", result.order);
      Print("Master ticket: ", masterTicket);
      Print("Return code: ", result.retcode);
      Print("===========================");

      // Add to processed orders
      AddOrUpdateProcessedOrder(masterTicket, symbol, orderTypeStr, lotSize, price, sl, tp, timestamp);
      return true;
   }
   else
   {
      Print("=== SLAVE ORDER FAILED ===");
      Print("Error: ", result.retcode, " - ", result.comment);
      Print("Master ticket: ", masterTicket);
      Print("Symbol: ", symbol);
      Print("Type: ", EnumToString(slaveOrderType));
      Print("Lot: ", slaveLotSize);
      Print("Price: ", price);
      Print("==========================");
      return false;
   }
}

//+------------------------------------------------------------------+
//| Process slave orders from CSV (DEPRECATED - Windows uses direct reading) |
//+------------------------------------------------------------------+
/*
void ProcessSlaveOrders()
{
   // Read CSV file to get orders
   int handle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
   if(handle == INVALID_HANDLE)
   {
      return; // No file to process
   }

   Print("=== PROCESSING SLAVE ORDERS (PING) ===");
   Print("Reading CSV file: ", csvFileName);

   int ordersFound = 0;
   int ordersProcessed = 0;
   int ordersSkipped = 0;

   // Array to store CSV order tickets for orphan cleanup
   string csvOrderTickets[];
   int csvOrderCount = 0;

   // Skip the first 3 header lines
   if(!FileIsEnding(handle)) FileReadString(handle); // TYPE line
   if(!FileIsEnding(handle)) FileReadString(handle); // STATUS line
   if(!FileIsEnding(handle)) FileReadString(handle); // CONFIG line

   // Process order lines
   while(!FileIsEnding(handle))
   {
      string line = FileReadString(handle);
      if(StringLen(line) == 0) continue;

      // Check if this is an ORDER line
      if(StringFind(line, "[ORDER]") >= 0)
      {
         ordersFound++;

         // Parse order line: [ORDER] [TICKET] [SYMBOL] [TYPE] [SIZE] [PRICE] [SL] [TP] [TIMESTAMP]
         string fields[];
         int fieldCount = 0;

         // Extract fields between brackets
         int pos = 0;
         while(pos < StringLen(line))
         {
            int startPos = StringFind(line, "[", pos);
            int endPos = StringFind(line, "]", startPos);

            if(startPos >= 0 && endPos > startPos)
            {
               string field = StringSubstr(line, startPos + 1, endPos - startPos - 1);
               ArrayResize(fields, fieldCount + 1);
               fields[fieldCount] = field;
               fieldCount++;
               pos = endPos + 1;
            }
            else
            {
               break;
            }
         }

         // Validate we have enough fields
         if(fieldCount >= 8)
         {
            string masterTicket = fields[1];  // TICKET
            string symbol = fields[2];        // SYMBOL
            string orderType = fields[3];     // TYPE
            double lotSize = StringToDouble(fields[4]);    // SIZE
            double price = StringToDouble(fields[5]);      // PRICE
            double sl = StringToDouble(fields[6]);         // SL
            double tp = StringToDouble(fields[7]);         // TP
            string timestamp = fields[8];                  // TIMESTAMP

            // Add ticket to CSV orders list for orphan cleanup
            ArrayResize(csvOrderTickets, csvOrderCount + 1);
            csvOrderTickets[csvOrderCount] = masterTicket;
            csvOrderCount++;

            Print("Found order - Ticket: ", masterTicket, " Symbol: ", symbol, " Type: ", orderType);

            // Check if this order should be processed by this slave
            // (You might want to add master account filtering here)

            if(ExecuteSlaveOrder(masterTicket, symbol, orderType, lotSize, price, sl, tp, timestamp))
            {
               ordersProcessed++;
            }
            else
            {
               ordersSkipped++;
            }
         }
         else
         {
            Print("Invalid order line format: ", line);
            ordersSkipped++;
         }
      }
   }

   FileClose(handle);

   Print("Orders found: ", ordersFound);
   Print("Orders processed: ", ordersProcessed);
   Print("Orders skipped: ", ordersSkipped);
   Print("===============================");

   // Clean up orphaned orders (orders that are no longer in CSV)
   CleanupOrphanedOrders(csvOrderTickets, csvOrderCount);
}
*/

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

   // Always update ping regardless of status protection and account type
   bool pingWritten = false;

   // Execute PENDING logic according to configured interval
   if(currentStatus == "PENDING")
   {
      UpdatePendingCSV();
      pingWritten = true;
   }
   // Execute MASTER logic according to configured interval
   else if(currentStatus == "MASTER")
   {
      if(TimeCurrent() - lastMasterUpdate >= MASTER_UPDATE_INTERVAL_MS/1000)
      {
         UpdateMasterCSV();
         lastMasterUpdate = TimeCurrent();
         pingWritten = true;
      }
      else
      {
         // Force heartbeat even if no order changes
         ForceHeartbeatUpdate();
         pingWritten = true;
      }
   }
           // Execute SLAVE logic according to configured interval
    else if(currentStatus == "SLAVE")
    {
       // Parse slave configuration to get master CSV path
       ParseSlaveConfig();

       // Direct reading from master CSV (Windows only)
       if(StringLen(slaveMasterCsvPath) > 0 && slaveMasterCsvPath != "NULL")
       {
          ProcessMasterOrdersDirectly();
       }
       else
       {
          Print("❌ No master CSV path configured - direct copy trading disabled");
       }

       UpdateSlaveCSV();
       pingWritten = true;
    }
   // Force heartbeat for any other status or if no update was done
   else
   {
      ForceHeartbeatUpdate();
      pingWritten = true;
   }

   // Final safety check: if no ping was written, force create/update CSV
   if(!pingWritten)
   {
      CreateSimpleCSV();
   }

   // Additional safety: always ensure CSV exists and has current timestamp
   // This handles cases where file operations might fail
   int safetyHandle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
   if(safetyHandle == INVALID_HANDLE)
   {
      // If we can't even read the file, create it
      CreateSimpleCSV();
   }
   else
   {
      FileClose(safetyHandle);
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
   // First, read current CSV to get the actual status and preserve additional lines
   int readHandle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_ANSI|FILE_COMMON);
   if(readHandle != INVALID_HANDLE)
   {
      string line1 = "";
      string line2 = "";
      string line3 = "";

      // Read lines more robustly to handle long CONFIG lines
      if(!FileIsEnding(readHandle)) line1 = FileReadString(readHandle); // TYPE line
      if(!FileIsEnding(readHandle)) line2 = FileReadString(readHandle); // STATUS line
      if(!FileIsEnding(readHandle)) line3 = FileReadString(readHandle); // CONFIG line

      Print("=== DEBUG CSV READ (UpdateSlaveCSV) ===");
      Print("Line1: ", line1);
      Print("Line2: ", line2);
      Print("Line3: ", line3);
      Print("Line3 length: ", StringLen(line3));

      // Read all additional lines to preserve them
      string additionalLines[] = {};
      int additionalCount = 0;
      while(!FileIsEnding(readHandle))
      {
         string extraLine = FileReadString(readHandle);
         if(StringLen(extraLine) > 0)
         {
            ArrayResize(additionalLines, additionalCount + 1);
            additionalLines[additionalCount] = extraLine;
            additionalCount++;
         }
      }
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
         int handle = FileOpen(csvFileName, FILE_TXT|FILE_WRITE|FILE_ANSI|FILE_COMMON);
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

            FileWriteString(handle, newLine1 + "\n");
            FileWriteString(handle, newLine2 + "\n");
            FileWriteString(handle, newLine3 + "\n");

            // Write all additional lines to preserve them
            for(int i = 0; i < additionalCount; i++)
            {
               FileWriteString(handle, additionalLines[i] + "\n");
            }

            FileClose(handle);

            // Print CSV content after update
            PrintCSVContent();
         }

      }

   }

}

//+------------------------------------------------------------------+
//| Force heartbeat update for any account type                     |
//+------------------------------------------------------------------+
void ForceHeartbeatUpdate()
{
   // Read current CSV to preserve existing content
   int readHandle = FileOpen(csvFileName, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
   if(readHandle != INVALID_HANDLE)
   {
      string line1 = FileReadString(readHandle); // TYPE line
      string line2 = FileReadString(readHandle); // STATUS line
      string line3 = FileReadString(readHandle); // CONFIG line

      // Read all additional lines to preserve them
      string additionalLines[] = {};
      int additionalCount = 0;
      while(!FileIsEnding(readHandle))
      {
         string extraLine = FileReadString(readHandle);
         if(StringLen(extraLine) > 0)
         {
            ArrayResize(additionalLines, additionalCount + 1);
            additionalLines[additionalCount] = extraLine;
            additionalCount++;
         }
      }
      FileClose(readHandle);

      // Update only the STATUS line with new timestamp
      int handle = FileOpen(csvFileName, FILE_CSV|FILE_WRITE|FILE_ANSI|FILE_COMMON, "\n");
      if(handle != INVALID_HANDLE)
      {
         long account = AccountInfoInteger(ACCOUNT_LOGIN);
         datetime utcTime = GetUTCTime();
         string timestamp = IntegerToString((int)utcTime);

         // Keep TYPE and CONFIG lines unchanged, update only STATUS
         string newLine2 = "[STATUS] [ONLINE] [" + timestamp + "]";

         FileWrite(handle, line1);
         FileWrite(handle, newLine2);
         FileWrite(handle, line3);

         // Write all additional lines to preserve them
         for(int i = 0; i < additionalCount; i++)
         {
            FileWrite(handle, additionalLines[i]);
         }

         FileClose(handle);
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

//+------------------------------------------------------------------+
//| Parse slave configuration from CSV CONFIG line                   |
//+------------------------------------------------------------------+
void ParseSlaveConfig()
{
   int handle = FileOpen(csvFileName, FILE_TXT|FILE_READ|FILE_ANSI|FILE_COMMON);
   if(handle == INVALID_HANDLE)
   {
      return; // No file to parse
   }

   while(!FileIsEnding(handle))
   {
      string line = FileReadString(handle);
      if(StringLen(line) == 0) continue;

      // Look for CONFIG line: [CONFIG] [SLAVE] [ENABLED] [1.0] [NULL] [TRUE] [250062001] [C:\path\to\master.csv]
      if(StringFind(line, "[CONFIG]") >= 0 && StringFind(line, "[SLAVE]") >= 0)
      {
         string fields[];
         int fieldCount = 0;

         // Extract fields between brackets
         int pos = 0;
         while(pos < StringLen(line))
         {
            int startPos = StringFind(line, "[", pos);
            int endPos = StringFind(line, "]", startPos);

            if(startPos >= 0 && endPos > startPos)
            {
               string field = StringSubstr(line, startPos + 1, endPos - startPos - 1);
               ArrayResize(fields, fieldCount + 1);
               fields[fieldCount] = field;
               fieldCount++;
               pos = endPos + 1;
            }
            else
            {
               break;
            }
         }

         // Parse CONFIG fields: [CONFIG] [SLAVE] [ENABLED] [lotMultiplier] [forceLot] [reverseTrading] [masterId] [masterCsvPath]
         if(fieldCount >= 8)
         {
            slaveMultiplier = StringToDouble(fields[3]);

            if(fields[4] != "NULL" && StringToDouble(fields[4]) > 0.0)
            {
               slaveForceLot = StringToDouble(fields[4]);
            }
            else
            {
               slaveForceLot = 0.0;
            }

            slaveReverseTrading = (fields[5] == "TRUE");
            slaveMasterAccount = StringToInteger(fields[6]);

            if(fieldCount >= 8 && fields[7] != "NULL" && StringLen(fields[7]) > 0)
            {
               slaveMasterCsvPath = fields[7];
            }
            else
            {
               slaveMasterCsvPath = "";
            }

            Print("=== SLAVE CONFIG PARSED ===");
            Print("Lot Multiplier: ", slaveMultiplier);
            Print("Force Lot: ", slaveForceLot);
            Print("Reverse Trading: ", slaveReverseTrading ? "TRUE" : "FALSE");
            Print("Master Account: ", slaveMasterAccount);
            Print("Master CSV Path: ", slaveMasterCsvPath);
            Print("===========================");
         }
         break; // Found CONFIG line, no need to continue
      }
   }

   FileClose(handle);
}

//+------------------------------------------------------------------+
//| Process master orders directly from master CSV (Windows only)    |
//+------------------------------------------------------------------+
void ProcessMasterOrdersDirectly()
{
   // Only process if we have a valid master CSV path
   if(StringLen(slaveMasterCsvPath) == 0 || slaveMasterCsvPath == "NULL")
   {
      return; // No master CSV path configured
   }

   Print("=== PROCESSING MASTER ORDERS DIRECTLY ===");
   Print("Master CSV Path: ", slaveMasterCsvPath);

   // Try to open master CSV file
   int handle = FileOpen(slaveMasterCsvPath, FILE_CSV|FILE_READ|FILE_ANSI|FILE_COMMON, "\n");
   if(handle == INVALID_HANDLE)
   {
      // Try without FILE_COMMON flag
      handle = FileOpen(slaveMasterCsvPath, FILE_CSV|FILE_READ|FILE_ANSI, "\n");
   }

   if(handle == INVALID_HANDLE)
   {
      Print("❌ Failed to open master CSV: ", slaveMasterCsvPath);
      return;
   }

   int ordersFound = 0;
   int ordersProcessed = 0;
   int ordersSkipped = 0;

   // Array to store CSV order tickets for orphan cleanup
   string csvOrderTickets[];
   int csvOrderCount = 0;

   // Skip header lines until we find our master account
   bool foundMasterAccount = false;
   while(!FileIsEnding(handle))
   {
      string line = FileReadString(handle);
      if(StringLen(line) == 0) continue;

      // Look for TYPE line with our master account
      if(StringFind(line, "[TYPE]") >= 0 &&
         StringFind(line, "[MASTER]") >= 0 &&
         StringFind(line, "[" + IntegerToString((int)slaveMasterAccount) + "]") >= 0)
      {
         foundMasterAccount = true;
         Print("✅ Found master account ", slaveMasterAccount, " in CSV");
         break;
      }
   }

   if(!foundMasterAccount)
   {
      Print("❌ Master account ", slaveMasterAccount, " not found in CSV");
      FileClose(handle);
      return;
   }

   // Skip STATUS and CONFIG lines
   if(!FileIsEnding(handle)) FileReadString(handle); // STATUS line
   if(!FileIsEnding(handle)) FileReadString(handle); // CONFIG line

   // Process ORDER lines
   while(!FileIsEnding(handle))
   {
      string line = FileReadString(handle);
      if(StringLen(line) == 0) continue;

      // Stop if we hit another TYPE line (different account)
      if(StringFind(line, "[TYPE]") >= 0)
      {
         break;
      }

      // Check if this is an ORDER line
      if(StringFind(line, "[ORDER]") >= 0)
      {
         ordersFound++;

         // Parse order line: [ORDER] [TICKET] [SYMBOL] [TYPE] [SIZE] [PRICE] [SL] [TP] [TIMESTAMP]
         string fields[];
         int fieldCount = 0;

         // Extract fields between brackets
         int pos = 0;
         while(pos < StringLen(line))
         {
            int startPos = StringFind(line, "[", pos);
            int endPos = StringFind(line, "]", startPos);

            if(startPos >= 0 && endPos > startPos)
            {
               string field = StringSubstr(line, startPos + 1, endPos - startPos - 1);
               ArrayResize(fields, fieldCount + 1);
               fields[fieldCount] = field;
               fieldCount++;
               pos = endPos + 1;
            }
            else
            {
               break;
            }
         }

         // Validate we have enough fields
         if(fieldCount >= 8)
         {
            string masterTicket = fields[1];  // TICKET
            string symbol = fields[2];        // SYMBOL
            string orderType = fields[3];     // TYPE
            double lotSize = StringToDouble(fields[4]);    // SIZE
            double price = StringToDouble(fields[5]);      // PRICE
            double sl = StringToDouble(fields[6]);         // SL
            double tp = StringToDouble(fields[7]);         // TP
            string timestamp = fields[8];                  // TIMESTAMP

            // Add ticket to CSV orders list for orphan cleanup
            ArrayResize(csvOrderTickets, csvOrderCount + 1);
            csvOrderTickets[csvOrderCount] = masterTicket;
            csvOrderCount++;

            Print("Found master order - Ticket: ", masterTicket, " Symbol: ", symbol, " Type: ", orderType);

            if(ExecuteSlaveOrder(masterTicket, symbol, orderType, lotSize, price, sl, tp, timestamp))
            {
               ordersProcessed++;
            }
            else
            {
               ordersSkipped++;
            }
         }
         else
         {
            Print("Invalid order line format: ", line);
            ordersSkipped++;
         }
      }
   }

   FileClose(handle);

   Print("Master orders found: ", ordersFound);
   Print("Orders processed: ", ordersProcessed);
   Print("Orders skipped: ", ordersSkipped);
   Print("=========================================");

   // Clean up orphaned orders (orders that are no longer in master CSV)
   CleanupOrphanedOrders(csvOrderTickets, csvOrderCount);
}
