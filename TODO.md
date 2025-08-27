MT4
Name     : jom aes
Type     : Forex Hedged USD
Server   : MetaQuotes-Demo MT4
Login    : 5038002547
Password : L@Uv2jDv
Investor : M*8kLpYo

MT5
Name     : jom aes
Type     : Forex Hedged USD
Server   : MetaQuotes-Demo
Login    : 94424443
Password : NaS-PaK4
Investor : @5JtCkQp


E2E UX/UI

conversion de pending a todo tipo
conversion de master a todo tipo
conversion de slave a tod tipo
acciones de todo tipo a cuentas master vinculadas
acciones de todo tipo a cuentas pending vinculadas

que siempre que inicie la app lo haga con los csv cacheados





COMANDO DE WINDOWS QUE SI FUNCIONA.

PARA BUSCAR LOS ARCHIVOS CSV

Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -File -Force -ErrorAction SilentlyContinue 2>$null |
    Where-Object { $_.Name -eq 'IPTRADECSV2.csv' } |
    Select-Object -ExpandProperty FullName
}

PARA BUSCAR LAS CARPETAS MQL5 Y MQL4

Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -Directory -ErrorAction SilentlyContinue -Force 2>$null |
    Where-Object { $_.Name -in @('MQL4','MQL5') } |
    Select-Object -ExpandProperty FullName
}

