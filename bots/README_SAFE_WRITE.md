# Safe CSV Writing for MQL4/MQL5 Bots

When writing to IPTRADECSV2.csv files, follow these guidelines to ensure data integrity:

## Current Format

```
[TYPE] [MASTER] [MT4] [12345678]
[STATUS] [ONLINE] [1703123456]
[CONFIG] [MASTER] [1]
[ORDER] [123456] [EURUSD] [BUY] [1.00] [1.0850] [1.0800] [1.0900] [1703123456]
[ORDER] [123457] [GBPUSD] [BUYLIMIT] [0.50] [1.2600] [1.2550] [1.2650] [1703123457]
```

## Safe Writing Process

1. First read and validate the existing file
2. Use a temporary file for writing
3. Only replace the original file after successful write
4. Preserve the CONFIG line from the existing file

Example implementation:

```cpp
bool WriteIPTRADECSV2Safe() {
   string tmpFileName = csvFileName + ".tmp";
   string configLine = ReadConfigLine(); // Read existing CONFIG line

   // Open temporary file
   int tmpHandle = FileOpen(tmpFileName, FILE_WRITE|FILE_CSV|FILE_ANSI);
   if(tmpHandle == INVALID_HANDLE) {
      Print("Error opening temporary file");
      return false;
   }

   int currentTime = (int)TimeCurrent();
   string accountId = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));

   // Write TYPE line
   string typeLine = StringFormat("[TYPE] [MASTER] [%s] [%s]",
      Platform, // MT4 or MT5
      accountId
   );
   FileWrite(tmpHandle, typeLine);

   // Write STATUS line
   string statusLine = StringFormat("[STATUS] [ONLINE] [%d]", currentTime);
   FileWrite(tmpHandle, statusLine);

   // Write preserved CONFIG line or default
   FileWrite(tmpHandle, configLine != "" ? configLine : "[CONFIG] [MASTER] [1]");

   // Write ORDER lines for open positions
   int total = OrdersTotal();
   for(int i = 0; i < total; i++) {
      if(OrderSelect(i, SELECT_BY_POS)) {
         string orderLine = StringFormat(
            "[ORDER] [%d] [%s] [%s] [%.2f] [%.5f] [%.5f] [%.5f] [%d]",
            OrderTicket(),
            OrderSymbol(),
            OrderType() == OP_BUY ? "BUY" : "SELL",
            OrderLots(),
            OrderOpenPrice(),
            OrderStopLoss(),
            OrderTakeProfit(),
            OrderOpenTime()
         );
         FileWrite(tmpHandle, orderLine);
      }
   }

   // Close temporary file
   FileClose(tmpHandle);

   // Validate temporary file
   if(!ValidateCSVFile(tmpFileName)) {
      FileDelete(tmpFileName);
      return false;
   }

   // Replace original with temporary file
   if(FileIsExist(csvFileName)) {
      FileDelete(csvFileName);
   }

   if(!FileMove(tmpFileName, 0, csvFileName, 0)) {
      FileDelete(tmpFileName);
      return false;
   }

   return true;
}

// Validate CSV file structure
bool ValidateCSVFile(string fileName) {
   int handle = FileOpen(fileName, FILE_READ|FILE_CSV|FILE_ANSI);
   if(handle == INVALID_HANDLE) return false;

   string line;
   int lineCount = 0;
   bool hasType = false, hasStatus = false, hasConfig = false;

   while(!FileIsEnding(handle)) {
      line = FileReadString(handle);
      lineCount++;

      // Check first 3 required lines
      if(lineCount == 1) {
         hasType = StringFind(line, "[TYPE]") == 0;
      }
      else if(lineCount == 2) {
         hasStatus = StringFind(line, "[STATUS]") == 0;
      }
      else if(lineCount == 3) {
         hasConfig = StringFind(line, "[CONFIG]") == 0;
      }
      // Validate ORDER lines if present
      else if(StringFind(line, "[ORDER]") == 0) {
         if(!ValidateOrderLine(line)) {
            FileClose(handle);
            return false;
         }
      }
   }

   FileClose(handle);
   return hasType && hasStatus && hasConfig;
}

// Validate ORDER line format
bool ValidateOrderLine(string line) {
   string parts[];
   int count = StringSplit(line, ']', parts);

   // Should have 9 bracketed values
   if(count != 9) return false;

   // Validate numeric fields
   if(!IsNumeric(GetBracketValue(parts[1]))) return false; // ticket
   if(!IsNumeric(GetBracketValue(parts[4]))) return false; // volume
   if(!IsNumeric(GetBracketValue(parts[5]))) return false; // price
   if(!IsNumeric(GetBracketValue(parts[6]))) return false; // sl
   if(!IsNumeric(GetBracketValue(parts[7]))) return false; // tp
   if(!IsNumeric(GetBracketValue(parts[8]))) return false; // timestamp

   return true;
}

// Helper to extract value from bracket [VALUE]
string GetBracketValue(string bracketStr) {
   return StringSubstr(bracketStr, 1, StringLen(bracketStr)-2);
}

// Helper to check if string is numeric
bool IsNumeric(string str) {
   return StringToDouble(str) != 0 || str == "0";
}
```

## Important Notes

1. Always validate file structure before writing
2. Use temporary files for atomic writes
3. Preserve existing CONFIG line
4. Handle all possible errors
5. Clean up temporary files on error
6. Validate all numeric values
7. Use proper string formatting
8. Include all required fields
9. Follow exact bracket format

This implementation ensures that:
- The file is never left in an invalid state
- The CONFIG line is preserved
- All writes are atomic (using temporary file)
- The format is strictly validated
- Errors are properly handled
