using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Indicators;
using cAlgo.Indicators;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public class IPTradeBot : Robot
    {
        // Global variables
        private string accountType = "PENDING";
        private string copyTrading = "DISABLED";
        private double lotMultiplier = 1.0;
        private string forceLot = "NULL";
        private string reverseTrading = "FALSE";
        private string masterId = "NULL";
        private string masterCsvPath = "NULL";
        private string prefix = "NULL";
        private string suffix = "NULL";
        
        private string csvFileName;
        // Timer is built-in, no need to declare

        protected override void OnStart()
        {
            csvFileName = $"IPTRADECSV2{Account.Number}.csv";
            
            // Initialize CSV file
            InitializeCsv();
            
            // Set timer for 1 second intervals
            Timer.Start(TimeSpan.FromSeconds(1));
            Timer.TimerTick += OnTimerTick;
            
            Print($"IPTrade Copy Trading Bot initialized for account: {Account.Number}");
        }

        protected override void OnStop()
        {
            Timer.Stop();
        }

        private void OnTimerTick()
        {
            try
            {
                // Read and validate CSV
                ReadAndValidateCsv();
                
                // Write ping
                WritePing();
                
                // Process based on account type
                ProcessAccountType();
            }
            catch (Exception ex)
            {
                Print($"Error in timer tick: {ex.Message}");
            }
        }

        private void InitializeCsv()
        {
            try
            {
                if (!File.Exists(csvFileName))
                {
                    CreateDefaultCsv();
                }
            }
            catch (Exception ex)
            {
                Print($"Error initializing CSV: {ex.Message}");
            }
        }

        private void CreateDefaultCsv()
        {
            try
            {
                long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var lines = new string[]
                {
                    $"[TYPE] [CTRADER] [{Account.Number}]",
                    $"[STATUS] [ONLINE] [{timestamp}]",
                    "[CONFIG] [PENDING] [DISABLED] [1.0] [NULL] [FALSE] [NULL] [NULL] [NULL] [NULL]"
                };
                
                File.WriteAllLines(csvFileName, lines);
                Print($"Created default CSV file: {csvFileName}");
            }
            catch (Exception ex)
            {
                Print($"Error creating CSV: {ex.Message}");
            }
        }

        private void ReadAndValidateCsv()
        {
            try
            {
                if (!File.Exists(csvFileName))
                {
                    CreateDefaultCsv();
                    return;
                }

                var lines = File.ReadAllLines(csvFileName);
                
                Print("=== Reading CSV lines ===");
                
                if (lines.Length < 3)
                {
                    // Archivo con pocas líneas pero NO sobrescribir - el servidor maneja el CSV
                    Print("ADVERTENCIA: CSV tiene menos de 3 líneas, pero NO sobrescribiendo archivo existente");
                    Print("El servidor es responsable del formato del CSV");
                    return;
                }

                // Log first three lines
                Print($"Line 1 (TYPE): {lines[0]}");
                Print($"Line 2 (STATUS): {lines[1]}");
                Print($"Line 3 (CONFIG): {lines[2]}");
                
                // Log any additional lines (orders)
                for (int i = 3; i < lines.Length; i++)
                {
                    if (!string.IsNullOrEmpty(lines[i]))
                    {
                        Print($"Line {i + 1} (ORDER): {lines[i]}");
                    }
                }
                
                Print("=== End CSV reading ===");

                // Validate format - NO recrear archivo existente, solo leer lo que hay
                if (!lines[0].Contains("[TYPE]") || !lines[1].Contains("[STATUS]") || !lines[2].Contains("[CONFIG]"))
                {
                    // Formato inesperado pero NO sobrescribir - el servidor maneja el CSV
                    Print("ADVERTENCIA: Formato CSV inesperado, pero NO sobrescribiendo archivo existente");
                    Print("El servidor es responsable del formato del CSV");
                    return;
                }

                // Parse CONFIG line to extract variables
                ParseConfigLine(lines[2]);
            }
            catch (Exception ex)
            {
                Print($"Error reading CSV: {ex.Message}");
            }
        }

        private void ParseConfigLine(string configLine)
        {
            try
            {
                var parts = configLine.Split(' ');
                
                if (parts.Length >= 10)
                {
                    // Solo actualizar variables globales con valores del CSV para lectura
                    // No sobrescribir - solo leer y actualizar variables globales
                    string csvAccountType = parts[1].Trim('[', ']');
                    string csvCopyTrading = parts[2].Trim('[', ']');
                    double csvLotMultiplier = double.Parse(parts[3].Trim('[', ']'));
                    string csvForceLot = parts[4].Trim('[', ']');
                    string csvReverseTrading = parts[5].Trim('[', ']');
                    string csvMasterId = parts[6].Trim('[', ']');
                    string csvMasterCsvPath = parts[7].Trim('[', ']');
                    string csvPrefix = parts[8].Trim('[', ']');
                    string csvSuffix = parts[9].Trim('[', ']');
                    
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
                    Print($"AccountType: {accountType}, CopyTrading: {copyTrading}");
                    Print($"LotMultiplier: {lotMultiplier}, ForceLot: {forceLot}");
                    Print($"ReverseTrading: {reverseTrading}, MasterId: {masterId}");
                    Print($"MasterCsvPath: {masterCsvPath}, Prefix: {prefix}, Suffix: {suffix}");
                }
            }
            catch (Exception ex)
            {
                Print($"Error parsing config: {ex.Message}");
            }
        }

        private void WritePing()
        {
            try
            {
                if (!File.Exists(csvFileName)) return;

                var lines = File.ReadAllLines(csvFileName).ToList();
                
                if (lines.Count >= 2)
                {
                    // Update timestamp in STATUS line - UTC0 with seconds (Unix timestamp)
                    long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(); // Full Unix timestamp in seconds
                    
                    var parts = lines[1].Split(' ');
                    if (parts.Length >= 3)
                    {
                        // Update the timestamp part
                        parts[2] = $"[{timestamp}]";
                        lines[1] = string.Join(" ", parts);
                        
                        Print($"Updated ping timestamp to: {timestamp} (Unix UTC0 seconds)");
                    }
                    
                    File.WriteAllLines(csvFileName, lines);
                }
            }
            catch (Exception ex)
            {
                Print($"Error writing ping: {ex.Message}");
            }
        }

        private void ProcessAccountType()
        {
            if (accountType == "PENDING") return;
            
            if (accountType == "MASTER" && copyTrading == "ENABLED")
            {
                ProcessMasterAccount();
            }
            else if (accountType == "SLAVE" && copyTrading == "ENABLED")
            {
                ProcessSlaveAccount();
            }
        }

        private void ProcessMasterAccount()
        {
            try
            {
                if (!File.Exists(csvFileName)) return;

                var lines = File.ReadAllLines(csvFileName).ToList();
                var headerLines = lines.Take(3).ToList();
                
                // Clear old orders and write header
                var newLines = new List<string>(headerLines);
                
                // Write current pending orders
                foreach (var order in PendingOrders)
                {
                    string symbol = order.SymbolName;
                    
                    // Apply prefix/suffix cleaning for master
                    if (prefix != "NULL" && symbol.StartsWith(prefix))
                    {
                        symbol = symbol.Substring(prefix.Length);
                    }
                    if (suffix != "NULL" && symbol.EndsWith(suffix))
                    {
                        symbol = symbol.Substring(0, symbol.Length - suffix.Length);
                    }
                    
                    string orderType = "";
                    switch (order.OrderType)
                    {
                        case PendingOrderType.Limit:
                            orderType = order.TradeType == TradeType.Buy ? "BUYLIMIT" : "SELLLIMIT";
                            break;
                        case PendingOrderType.Stop:
                            orderType = order.TradeType == TradeType.Buy ? "BUYSTOP" : "SELLSTOP";
                            break;
                        case PendingOrderType.StopLimit:
                            orderType = order.TradeType == TradeType.Buy ? "BUYSTOP" : "SELLSTOP";
                            break;
                    }
                    
                    long openTime = ((DateTimeOffset)DateTime.UtcNow).ToUnixTimeSeconds();
                    
                    // Get the actual volume in lots for this symbol
                    var symbolObj = Symbols.GetSymbol(order.SymbolName);
                    double lots = symbolObj != null ? order.VolumeInUnits / symbolObj.LotSize : order.VolumeInUnits / 100000.0;
                    
                    string orderLine = $"[ORDER] [{order.Id}] [{symbol}] [{orderType}] [{lots:F2}] [{order.TargetPrice}] [{(order.StopLoss ?? 0)}] [{(order.TakeProfit ?? 0)}] [{openTime}]";
                    
                    newLines.Add(orderLine);
                }
                
                // Write current positions
                foreach (var position in Positions)
                {
                    string symbol = position.SymbolName;
                    
                    // Apply prefix/suffix cleaning for master
                    if (prefix != "NULL" && symbol.StartsWith(prefix))
                    {
                        symbol = symbol.Substring(prefix.Length);
                    }
                    if (suffix != "NULL" && symbol.EndsWith(suffix))
                    {
                        symbol = symbol.Substring(0, symbol.Length - suffix.Length);
                    }
                    
                    string orderType = position.TradeType == TradeType.Buy ? "BUY" : "SELL";
                    long openTime = ((DateTimeOffset)position.EntryTime).ToUnixTimeSeconds();
                    
                    // Get the actual volume in lots for this symbol
                    var symbolObj = Symbols.GetSymbol(position.SymbolName);
                    double lots = symbolObj != null ? position.VolumeInUnits / symbolObj.LotSize : position.VolumeInUnits / 100000.0;
                    
                    string orderLine = $"[ORDER] [{position.Id}] [{symbol}] [{orderType}] [{lots:F2}] [{position.EntryPrice}] [{(position.StopLoss ?? 0)}] [{(position.TakeProfit ?? 0)}] [{openTime}]";
                    
                    newLines.Add(orderLine);
                }
                
                File.WriteAllLines(csvFileName, newLines);
            }
            catch (Exception ex)
            {
                Print($"Error processing master account: {ex.Message}");
            }
        }

        private void ProcessSlaveAccount()
        {
            if (masterCsvPath == "NULL" || !File.Exists(masterCsvPath)) return;
            
            try
            {
                Print($"=== Reading Master CSV: {masterCsvPath} ===");
                
                var lines = File.ReadAllLines(masterCsvPath);
                
                // Log first 3 lines
                for (int i = 0; i < Math.Min(3, lines.Length); i++)
                {
                    Print($"Master Line {i + 1}: {lines[i]}");
                }
                
                // Skip first 3 lines and process orders
                int orderCount = 0;
                for (int i = 3; i < lines.Length; i++)
                {
                    if (!string.IsNullOrEmpty(lines[i]))
                    {
                        Print($"Master Order Line: {lines[i]}");
                        if (lines[i].StartsWith("[ORDER]"))
                        {
                            ProcessMasterOrder(lines[i]);
                            orderCount++;
                        }
                    }
                }
                
                Print($"=== End Master CSV reading. Found {orderCount} orders ===");
            }
            catch (Exception ex)
            {
                Print($"Error processing slave account: {ex.Message}");
            }
        }

        private void ProcessMasterOrder(string orderLine)
        {
            try
            {
                var parts = orderLine.Split(' ');
                if (parts.Length < 9) return;
                
                // Extract order data
                string masterTicket = parts[1].Trim('[', ']');
                string symbol = parts[2].Trim('[', ']');
                string orderType = parts[3].Trim('[', ']');
                double lots = double.Parse(parts[4].Trim('[', ']'));
                double price = double.Parse(parts[5].Trim('[', ']'));
                double sl = double.Parse(parts[6].Trim('[', ']'));
                double tp = double.Parse(parts[7].Trim('[', ']'));
                long timestamp = long.Parse(parts[8].Trim('[', ']'));
                
                // Check if order is too old (more than 5 seconds for market orders)
                if ((orderType == "BUY" || orderType == "SELL") && (DateTimeOffset.UtcNow.ToUnixTimeSeconds() - timestamp) > 5)
                {
                    return;
                }
                
                // Apply lot calculation
                if (forceLot != "NULL")
                {
                    lots = double.Parse(forceLot);
                }
                else
                {
                    lots = lots * lotMultiplier;
                }
                
                // Apply reverse trading
                if (reverseTrading == "TRUE")
                {
                    switch (orderType)
                    {
                        case "BUY": orderType = "SELL"; break;
                        case "SELL": orderType = "BUY"; break;
                        case "BUYSTOP": orderType = "SELLLIMIT"; break;
                        case "BUYLIMIT": orderType = "SELLSTOP"; break;
                        case "SELLSTOP": orderType = "BUYLIMIT"; break;
                        case "SELLLIMIT": orderType = "BUYSTOP"; break;
                    }
                    
                    // Swap SL and TP
                    var temp = sl;
                    sl = tp;
                    tp = temp;
                }
                
                // Apply prefix/suffix for slave
                string slaveSymbol = symbol;
                if (prefix != "NULL") slaveSymbol = prefix + slaveSymbol;
                if (suffix != "NULL") slaveSymbol = slaveSymbol + suffix;
                
                // Check if order already exists
                bool orderExists = false;
                
                // Check positions
                foreach (var position in Positions)
                {
                    if (position.Comment != null && position.Comment.Contains(masterTicket))
                    {
                        orderExists = true;
                        break;
                    }
                }
                
                // Check pending orders
                if (!orderExists)
                {
                    foreach (var order in PendingOrders)
                    {
                        if (order.Comment != null && order.Comment.Contains(masterTicket))
                        {
                            orderExists = true;
                            break;
                        }
                    }
                }
                
                // Open new order if it doesn't exist
                if (!orderExists)
                {
                    var symbolObj = Symbols.GetSymbol(slaveSymbol);
                    if (symbolObj == null) return;
                    
                    long volumeInUnits = (long)(lots * symbolObj.LotSize); // Convert to units using symbol's lot size
                    
                    switch (orderType)
                    {
                        case "BUY":
                            ExecuteMarketOrder(TradeType.Buy, slaveSymbol, volumeInUnits, masterTicket, sl, tp);
                            break;
                        case "SELL":
                            ExecuteMarketOrder(TradeType.Sell, slaveSymbol, volumeInUnits, masterTicket, sl, tp);
                            break;
                        case "BUYLIMIT":
                            PlaceLimitOrder(TradeType.Buy, slaveSymbol, volumeInUnits, price, masterTicket, sl, tp);
                            break;
                        case "SELLLIMIT":
                            PlaceLimitOrder(TradeType.Sell, slaveSymbol, volumeInUnits, price, masterTicket, sl, tp);
                            break;
                        case "BUYSTOP":
                            PlaceStopOrder(TradeType.Buy, slaveSymbol, volumeInUnits, price, masterTicket, sl, tp);
                            break;
                        case "SELLSTOP":
                            PlaceStopOrder(TradeType.Sell, slaveSymbol, volumeInUnits, price, masterTicket, sl, tp);
                            break;
                    }
                }
            }
            catch (Exception ex)
            {
                Print($"Error processing master order: {ex.Message}");
            }
        }

        private void ExecuteMarketOrder(TradeType tradeType, string symbolName, long volumeInUnits, string label, double? stopLoss, double? takeProfit)
        {
            try
            {
                var result = base.ExecuteMarketOrder(tradeType, symbolName, volumeInUnits, label, stopLoss.HasValue ? stopLoss.Value : (double?)null, takeProfit.HasValue ? takeProfit.Value : (double?)null);
                if (result.IsSuccessful)
                {
                    Print($"Market order executed: {result.Position.Id}");
                }
                else
                {
                    Print($"Failed to execute market order: {result.Error}");
                }
            }
            catch (Exception ex)
            {
                Print($"Error executing market order: {ex.Message}");
            }
        }
        
        private void PlaceLimitOrder(TradeType tradeType, string symbolName, long volumeInUnits, double targetPrice, string label, double? stopLoss, double? takeProfit)
        {
            try
            {
                var result = base.PlaceLimitOrder(tradeType, symbolName, volumeInUnits, targetPrice, label, stopLoss.HasValue ? stopLoss.Value : (double?)null, takeProfit.HasValue ? takeProfit.Value : (double?)null);
                if (result.IsSuccessful)
                {
                    Print($"Limit order placed: {result.PendingOrder.Id}");
                }
                else
                {
                    Print($"Failed to place limit order: {result.Error}");
                }
            }
            catch (Exception ex)
            {
                Print($"Error placing limit order: {ex.Message}");
            }
        }
        
        private void PlaceStopOrder(TradeType tradeType, string symbolName, long volumeInUnits, double targetPrice, string label, double? stopLoss, double? takeProfit)
        {
            try
            {
                var result = base.PlaceStopOrder(tradeType, symbolName, volumeInUnits, targetPrice, label, stopLoss.HasValue ? stopLoss.Value : (double?)null, takeProfit.HasValue ? takeProfit.Value : (double?)null);
                if (result.IsSuccessful)
                {
                    Print($"Stop order placed: {result.PendingOrder.Id}");
                }
                else
                {
                    Print($"Failed to place stop order: {result.Error}");
                }
            }
            catch (Exception ex)
            {
                Print($"Error placing stop order: {ex.Message}");
            }
        }

        protected override void OnTick()
        {
            // Not used in this implementation
        }
    }
}
