# Integración de cTrader - Guía de Configuración

Esta guía te ayudará a configurar la integración de cTrader en tu aplicación de copy trading.

## 📋 Requisitos Previos

1. **Cuenta cTrader ID**: Necesitas una cuenta cTrader registrada
2. **Aplicación cTrader Open API**: Debes registrar tu aplicación en el portal de desarrollo
3. **Broker compatible**: Tu broker debe soportar cTrader Open API

## 🔧 Configuración de la Aplicación cTrader

### Paso 1: Registrar tu aplicación

1. Ve a [https://connect.ctrader.com/](https://connect.ctrader.com/)
2. Inicia sesión con tu cTrader ID
3. Navega a "Applications" > "Create New Application"
4. Completa el formulario:
   - **Name**: Nombre de tu aplicación (ej: "Mi Trade Copier")
   - **Description**: Descripción de tu aplicación
   - **Redirect URI**: `http://localhost:3000/api/ctrader/auth/callback`
   - **Scopes**: Selecciona `trading`

### Paso 2: Obtener credenciales

Después del registro, obtendrás:
- **Client ID**: ID único de tu aplicación
- **Client Secret**: Clave secreta (¡mantén esto seguro!)

## ⚙️ Configuración del Servidor

### Paso 1: Instalar dependencias

Las dependencias ya están incluidas en el `package.json`, pero si necesitas instalarlas manualmente:

```bash
cd server
npm install ws axios dotenv jsonwebtoken
```

### Paso 2: Configurar variables de entorno

Crea un archivo `.env` en la carpeta `server/` basado en `.env.example`:

```bash
# Server Configuration
PORT=3000

# cTrader Open API Configuration
CTRADER_CLIENT_ID=tu_client_id_aqui
CTRADER_CLIENT_SECRET=tu_client_secret_aqui
CTRADER_REDIRECT_URI=http://localhost:3000/api/ctrader/auth/callback
CTRADER_SCOPE=trading

# cTrader API Endpoints (no cambiar)
CTRADER_AUTH_URL=https://connect.ctrader.com/oauth/v2/auth
CTRADER_TOKEN_URL=https://connect.ctrader.com/oauth/v2/token
CTRADER_API_URL=wss://connect.ctrader.com/apps/trading

# Frontend Configuration
FRONTEND_URL=http://localhost:5173

# Security
JWT_SECRET=tu-clave-secreta-super-segura

# Environment
NODE_ENV=development
```

### Paso 3: Iniciar el servidor

```bash
cd server
npm start
```

## 🖥️ Uso de la Interfaz

### 1. Autenticación

1. Ve al Dashboard > pestaña "Cuentas Trading"
2. En la sección "Gestión de cTrader", haz clic en **"Autenticar"**
3. Se abrirá una ventana emergente de cTrader
4. Inicia sesión con tu cTrader ID y autoriza la aplicación
5. La ventana se cerrará automáticamente y verás el estado "Autenticado"

### 2. Conectar a la API

1. Después de autenticarte, haz clic en **"Conectar"** en la sección "Conexión API"
2. Esto establecerá una conexión WebSocket con cTrader
3. Las cuentas disponibles se cargarán automáticamente

### 3. Registrar Cuentas

#### Como Master (Proveedor de Señales):
1. Haz clic en **"Registrar Master"**
2. Selecciona la cuenta cTrader que proveerá las señales
3. Asigna un nombre y descripción
4. La cuenta se registrará en tu sistema de copy trading

#### Como Slave (Seguidor):
1. Haz clic en **"Registrar Slave"**
2. Selecciona la cuenta cTrader que seguirá las señales
3. Selecciona la cuenta master a seguir
4. Asigna un nombre y descripción
5. La cuenta copiará automáticamente las operaciones del master

## 🔗 API Endpoints Disponibles

### Autenticación
- `POST /api/ctrader/auth/initiate` - Iniciar autenticación OAuth
- `GET /api/ctrader/auth/callback` - Callback de OAuth
- `GET /api/ctrader/auth/status/:userId` - Estado de autenticación
- `DELETE /api/ctrader/auth/revoke/:userId` - Revocar autenticación

### Conexión API
- `POST /api/ctrader/connect` - Conectar a cTrader API
- `DELETE /api/ctrader/disconnect/:userId` - Desconectar
- `GET /api/ctrader/status/:userId` - Estado de conexión

### Gestión de Cuentas
- `GET /api/ctrader/accounts/:userId` - Obtener cuentas
- `POST /api/ctrader/account/authenticate` - Autenticar cuenta específica
- `POST /api/ctrader/register/master` - Registrar cuenta master
- `POST /api/ctrader/register/slave` - Registrar cuenta slave

## 🔄 Flujo de Copy Trading

1. **Cuenta Master** ejecuta una operación en cTrader
2. **cTrader API** envía evento de ejecución vía WebSocket
3. **Tu servidor** recibe el evento y lo procesa
4. **Sistema de transformaciones** aplica reglas (multiplicadores, lotes fijos, etc.)
5. **Cuentas Slave** reciben las órdenes transformadas
6. **cTrader API** ejecuta las órdenes en las cuentas slave

## 📊 Modelo de Copia

### Equity-to-Equity Ratio
```
Volumen Copiado = (Equity Slave / Equity Master) × Volumen Master
```

### Ejemplo:
- Master tiene $10,000 equity, abre 1 lote
- Slave tiene $5,000 equity
- Volumen copiado = ($5,000 / $10,000) × 1 = 0.5 lotes

## 🛡️ Seguridad

### Tokens de Acceso
- Los tokens se almacenan localmente en `server/config/ctrader_tokens.json`
- Se renuevan automáticamente antes del vencimiento
- Usar HTTPS en producción

### Mejores Prácticas
1. Mantén el `CLIENT_SECRET` seguro
2. Usa un `JWT_SECRET` fuerte
3. Configura CORS apropiadamente
4. Usa cuentas demo para pruebas

## 🚨 Troubleshooting

### Error: "cTrader credentials not configured"
- Verifica que `CTRADER_CLIENT_ID` y `CTRADER_CLIENT_SECRET` estén en el archivo `.env`

### Error: "Connection timeout"
- Verifica tu conexión a internet
- Confirma que la URL de la API es correcta

### Error: "User not authenticated"
- Completa el proceso de OAuth primero
- Verifica que los tokens no hayan expirado

### No se cargan las cuentas
- Asegúrate de estar conectado a la API
- Verifica que tu broker soporte cTrader Open API

## 📞 Soporte

- **Documentación cTrader**: [https://help.ctrader.com/open-api/](https://help.ctrader.com/open-api/)
- **Portal de Desarrollo**: [https://connect.ctrader.com/](https://connect.ctrader.com/)
- **Comunidad Telegram**: Busca "cTrader Open API" en Telegram

## 🔄 Siguientes Pasos

1. **Prueba con cuentas Demo** primero
2. **Configura transformaciones** específicas por cuenta
3. **Implementa logging** para auditoría
4. **Configura alertas** para errores críticos
5. **Optimiza el rendimiento** para múltiples cuentas

---

¡Tu integración de cTrader está lista! 🎉
