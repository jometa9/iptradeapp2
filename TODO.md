TENGO QUE CREAR EL SIGUIENTE BOT PARA *METATRADER 5 / METATRADER 4 / CTRADER*

El cual consiste en un bot para hacer copy trading el cual escribe y lee lo que le escriben (app externa) en su mismo csv.

El flujo del bot es el siguiente:

1 - Al iniciar el bot, busca si existe un csv en la raiz del bot (file commons o donde se este ejecutando) que tenga el nombre de "IPTRADECSV2 + AccountID", si lo encuentra no creamos ninguno, pero si no tenemos ninguno lo creamos. Luego vemos que leemos y escribimos dentro de este csv.
2 - Luego de la valicaion del csv al iniciar, lo que haremossera ejecutar cada 1000 milisegundos una funcionalidad que se encargara de lo siguiente.
    - Checkeamos que el csv tenga el siguiente formato en las primeras tres lineas del csv, no importa el contenido ya que luego lo mapearemos y guardaremos en variables para luego usar.
    "[TYPE] [PENDING] [MT4] [67890]
     [STATUS] [ONLINE] [1703123456]
     [CONFIG] [PENDING] [ENABLED] [1.0] [NULL] [FALSE] [NULL] [NULL] [NULL] [NULL]"
    Es importante que siempre nos enfoquemos en solo las tres primeras ineas de los csv y los huevos o slots que tenemos que son nuestras variables a leer y luego a por escribir, cada variable es aquella que se encuentra entre los corchetes ([]) y separado por espacios, PERO el primer valor de cada linea nos indica de que variables (categoria) estamos leyendo, ejemplo la primera linea "[TYPE] [PENDING] [MT4] [67890]" tenemos en la linea de la categoria type, que la cuenta es de tipo PENDING, plataforma MT4 y account id 677890.
    Aqui una meustra del tipo de variantes que puede tener cada variable:
    [TYPE] [PENDING/MASTER/SLAVE] [MT4/MT5/CTRADER] [ACCOUNT_ID]
    [STATUS] [ONLINE/OFFLINE] [TIMESTAMP_UTC]
    [CONFIG] [PENDING/MASTER/SLAVE] [COPY_TRADING ENABLED/DISABLED] [LOT_MULTIPLIER] [FORCE_LOT/NULL] [REVERSE_TRADING TRUE/FALSE] [MASTER_ID/NULL] [MASTER_CSV_PATH/NULL] [PREFIX/NULL] [SUFFIX/NULL]
    [TICKET] [ORDER_TYPE] [SYMBOL] [VOLUME] [PRICE] [SL/TP] [COMMENT] [MAGIC] [TIMESTAMP_UTC]
    - Si detectamos que no tenemos un formato valido, escribimos lo siguiente en el csv:
    "[TYPE] [PENDING] [MT4] [ACCOUNT_ID]
     [STATUS] [ONLINE] [TIMESTAMP_UTC]
     [CONFIG] [PENDING] [DISABLED] [1.0] [NULL] [FALSE] [NULL] [NULL] [NULL] [NULL]"
    Ya que la cuenta no esta conbfigurada por nuestra app externa ni tampoco estaba configurada antes, la escribimos como pending con los datos de la cuenta necesarios.
    - Si tenemos un formato valido de csv, en esta parte de validaicon al inicio, no sobreescribimos nada.
    - Cada valor que tendremos en el csv lo guardaremos en variables globales que SIEMPRE que volvamos a leer en cada intervalo, la remplazaremos (a la variable global), guardandolas en las siguientes varibles que luego usaremos, cabe aclarar que la linea del type Y status la ignoraremos al momento de guardar las variables globales
        - accountType: PENDING/MASTER/SLAVE
        - copyTrading:  ENABLED/DISABLED
        - lotMultipleir: LOT_MULTIPLIER
        - forceLot: FORCE_LOT/NULL
        - reverseTrading: TRUE/FALSE
        - masterId: MASTER_ID/NULL
        - masterCsvPath: MASTER_CSV_PATH/NULL
        - prefix: PREFIX/NULL
        - suffix: SUFFIX/NULL
        
3- Luego de validar que tenmos en el csv, escribir en el si fue necesario, y guardar variables, debemos ejecutar una funcion que crearemos que sera writePing, lo cual esta funcion lo que hara sera simple pero crucial:
    - Ir al csv de esa cuenta y buscar en el campo del timestamp y escribir alli el valor de timestap pero enformato UTC 0 sin segundos, o sea fecha hora y minutos en formato similar a este 1703123456, esto lo usaremos como ping en mi aplicacoin externa.
4- Luego debemos continuar con los siguientes procesos, cabe alcarar que para cada tipo de cuenta llamaremos a una funcion distinta.
    - Si en tipo de cuenta tenemos pending en la variable que guardamos anteriormente, ignoramos y retornamos la funcion del ping (el timer y todo se sigue ejecutando y repitiendo, pero esta funcion de si la cuenta es pending ya termino su proceso ya que no hay nada que hacer)
    - Si en tipo de cuenta tenemos master y TENEMOS EL copyTrading == ENABLED lo que haremos sera:
        - Obtener todas las ordenes abiertas y pendientes de la cuenta y ESCRIBIR DEBAJO DEL CONTENIDO QUE YA EXISTE EN EL CSV de las TRES PRIMERAS LINEAS las ordenes con este formato: [ORDER] [TICKET] [SYMBOL] [TYPE] [SIZE] [PRICE] [SL] [TP] [TIMESTAMP_OPEN_TIME], ejemplo [ORDER] [5424321] [EURUSD] [BUYSTOP] [1] [1.4000] [1.3500] [1.4500] [1631234567]
        - Si en las variables tenemos un prefix o suffix, lo que haremos sera que en el ticket, si es prefix, borraremos el texto que encontremos al inicio del ticket que sea igual al prefix (porque esto es para limpiar valores), si tenemos sufix quitamos el texto del final del ticket si tenemos el valor de suffix, ejemplo: tenemos prefix "#" y suffix "pro" entonces en el ticket tenemos #EURUSDpro, lo que escribirremos en order sera EURUSD.
        - SIEMPRE que escribamos las ordenes, debemos ignorar las ortas lienas de orders que existian en la anterior validacion y escribir todas las ordenes de unevo debajo de las tres primeras lienas del csv.
    - Si la cuenta es slave y TENEMOS EL copyTrading == ENABLED:
        - Vamos y leemos que tenemos en el masterCsvPath extrayendo tolo lo que tengamos despues de las primeras tres lineas del csv, que seran las orders, aqui desglozaremos las orders para ir yendo y mapeando order por order para procesarla:
            - Primero que todo vemos si tenemos alguna orden avierta en nuestra cuenta que tenga alguna el comentario de order el ticket order de nuestra cuenta slave, esto lo usaremos para saber si modificar la order si hayuna diferencia o abrir la order porque no la tenemos.
            - Dependiendo de lo que tengamos en cada config de nuestra cuenta slave, modificaremos las ordenes que copiamos o mopdificamos para hacerlo de forma correceta, validadndo y modificando lo que sera el lote, si tenemos forceLot colocamos el lotaje ese, pero si no tenemos forceLot usamos el multiplicador para el lote; para lo que sera el type de la order, si tenemos reverse trading en true debemos cambiar el tipo de order, tp y sl convirtiendo de la siguiente forma: BUY > SELL, SELL > BUY, BUYSTOP > SELLLIMIT, BUYLIMIT > SELLSTOP, SELLSTOP > BUYLIMIT, SELLLIMIT > BUYSTOP, e invirtiendo el valor que tenemos en tp al sl y lo que tenemos en el sl lo usamos como tp, si la order que leemos y no colocamos es BUY o SELL, pero el timestamp UTC 0 que nos da comparado con el timestamp UTC 0 que tenemos al momoento de procesar supera lso 5 segundos, igoramos la orden.
            - Si en las variables tenemos un prefix o suffix, lo que haremos sera que en el ticket, si es prefix, agregaremos el texto al inicio del ticket , si tenemos sufix agregamos el texto del final del ticket, ejemplo: tenemos prefix "#" y suffix "pro" entonces en el ticket del order teniamos EURUSD, pero a la hora de copiar o modificar usamos #EURUSDpro. ESTO ES PARA CUANDO BUSQUEMOS UNA ORDER POR EL TICKET, NO DE FALLOS.
    



Input / boton en el chart de force pending.