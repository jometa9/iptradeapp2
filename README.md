# IP Trade App 2

Aplicación de copy trading con soporte para múltiples plataformas (MT4, MT5, cTrader).

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm i
cd server
npm i
cd ..

# Ejecutar en modo desarrollo
npm run dev
```

## 📚 Documentación

Toda la documentación está organizada en la carpeta `docs/`:

- **[📖 Documentación Completa](./docs/README.md)** - Índice principal de toda la documentación
- **[🔧 Implementación](./docs/IMPLEMENTATION_SUMMARY.md)** - Resumen de implementación
- **[📡 APIs](./docs/API_DOCUMENTATION.md)** - Documentación de APIs
- **[👥 Cuentas Pendientes](./docs/PENDING_ACCOUNTS_REALTIME_FIX.md)** - Gestión de cuentas pendientes
- **[💳 Suscripciones](./docs/SUBSCRIPTION_STRUCTURE_UPDATE.md)** - Sistema de suscripciones
- **[🖥️ Configuración](./docs/MANAGED_VPS_LIMITS_CONFIGURATION.md)** - Configuración de límites

## 🛠️ Scripts

Los scripts están organizados en la carpeta `scripts/`:

```bash
# Ver todos los scripts disponibles
node scripts/list-scripts.js

# Ejecutar un script específico
node scripts/run.js nombre-del-script.js

# Ver documentación de scripts
cat scripts/README.md
```

## 📁 Estructura del Proyecto

```
├── docs/                    # 📚 Documentación organizada
├── scripts/                 # 🛠️ Scripts de utilidad
├── src/                     # 🎨 Frontend (React + TypeScript)
├── server/                  # 🔧 Backend (Node.js)
├── electron/                # 🖥️ Aplicación de escritorio
├── config/                  # ⚙️ Archivos de configuración
└── accounts/                # 👥 Datos de cuentas
```

## 🔑 API Key

```bash
iptrade_6616c788f776a3b114f0
```

## 🎯 Características Principales

- ✅ **Multi-plataforma**: MT4, MT5, cTrader
- ✅ **Tiempo real**: Actualizaciones en vivo
- ✅ **Gestión de cuentas**: Master/Slave
- ✅ **Sistema de suscripciones**: Límites y validaciones
- ✅ **Interfaz moderna**: React + TypeScript
- ✅ **Aplicación de escritorio**: Electron

## 📞 Soporte

Para consultas técnicas o problemas, revisa la documentación en `docs/` o los scripts en `scripts/`.

---

*Desarrollado con ❤️ para el trading automatizado*
