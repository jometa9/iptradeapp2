debemos corregir:

- cuando una cuenta pending pasa a ser master o slave, autmaticamente debemos actualizarla y llevarla a la tabla de trading configuration, esto debe relejarse al instante en el frontend, pero porfavor, evitemos reloads que estan prohibidos
- si una cuenta esta offile, nunca puede tener el copytraden en true (esto es indistinto de si esta desabilitado el boton o no)
CHECK PENDING QUE TODO ESTE OK
- RECIBIR
- CONFIG MASTER
- CONFIG SLAVE
- SUBSCRIPTION LIMITS

- que en la columna del status, mustre el icono del status, y del lado derecho el texto del status en el color correspondiente
- que si se alcanza un subscripcion limit, que mantengamos a la vista la tarjeta de subscription limits.. pero solo mostraremos y ocultaremos luego de unos segundos la tarjeta cuadno el usuario tenga ua subscripcion free (a los demas solo le mostramos la tarjeta cuadno alcance el subscription limit)
