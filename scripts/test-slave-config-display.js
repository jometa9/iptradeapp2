// Script de prueba para verificar la visualización de configuraciones de slave
const testSlaveConfigs = {
  SLAVE001: {
    config: {
      enabled: true,
      lotMultiplier: 2.0,
      forceLot: null,
      reverseTrading: true,
      maxLotSize: 1.0,
      minLotSize: 0.01,
      allowedSymbols: ['EURUSD', 'GBPUSD'],
      blockedSymbols: ['USDJPY'],
      allowedOrderTypes: ['BUY', 'SELL'],
      blockedOrderTypes: ['BUY STOP', 'SELL STOP'],
      tradingHours: {
        enabled: true,
        startTime: '08:00',
        endTime: '18:00',
        timezone: 'UTC',
      },
      description: 'Config conservadora con reverse trading',
    },
  },
  SLAVE002: {
    config: {
      enabled: true,
      lotMultiplier: 1.0, // No se mostrará porque es el valor por defecto
      forceLot: 0.05,
      reverseTrading: false, // No se mostrará porque está desactivado
      maxLotSize: null,
      minLotSize: null,
      allowedSymbols: [],
      blockedSymbols: [],
      allowedOrderTypes: [],
      blockedOrderTypes: [],
      tradingHours: {
        enabled: false, // No se mostrará porque está desactivado
        startTime: '00:00',
        endTime: '23:59',
        timezone: 'UTC',
      },
      description: 'Config simple con force lot',
    },
  },
  SLAVE003: {
    config: {
      enabled: true,
      lotMultiplier: 0.5,
      forceLot: null,
      reverseTrading: false,
      maxLotSize: 0.1,
      minLotSize: 0.01,
      allowedSymbols: ['EURUSD'],
      blockedSymbols: [],
      allowedOrderTypes: ['BUY'],
      blockedOrderTypes: [],
      tradingHours: {
        enabled: false,
        startTime: '00:00',
        endTime: '23:59',
        timezone: 'UTC',
      },
      description: 'Config con lot multiplier y max lot',
    },
  },
};

// Función para simular la lógica de visualización
function getSlaveConfigLabels(slaveAccountId) {
  const slaveConfig = testSlaveConfigs[slaveAccountId];
  const config = slaveConfig?.config;
  const labels = [];

  if (config) {
    // Lot multiplier (solo si no es 1.0)
    if (config.lotMultiplier && config.lotMultiplier !== 1.0) {
      labels.push(`Lot ×${config.lotMultiplier}`);
    }

    // Force lot (solo si está configurado)
    if (config.forceLot && config.forceLot > 0) {
      labels.push(`Force ${config.forceLot}`);
    }

    // Reverse trading (solo si está habilitado)
    if (config.reverseTrading) {
      labels.push('Reverse');
    }

    // Max lot size (solo si está configurado)
    if (config.maxLotSize && config.maxLotSize > 0) {
      labels.push(`Max ${config.maxLotSize}`);
    }

    // Min lot size (solo si está configurado)
    if (config.minLotSize && config.minLotSize > 0) {
      labels.push(`Min ${config.minLotSize}`);
    }

    // Symbol filtering (solo si hay símbolos permitidos o bloqueados)
    if (config.allowedSymbols && config.allowedSymbols.length > 0) {
      labels.push(`${config.allowedSymbols.length} symbols`);
    }

    if (config.blockedSymbols && config.blockedSymbols.length > 0) {
      labels.push(`${config.blockedSymbols.length} blocked`);
    }

    // Trading hours (solo si está habilitado)
    if (config.tradingHours && config.tradingHours.enabled) {
      labels.push('Hours');
    }
  }

  // Si no hay configuraciones específicas, mostrar configuración por defecto
  if (labels.length === 0) {
    labels.push('Default');
  }

  return labels;
}

// Probar las configuraciones
console.log('🧪 Testing Slave Configuration Display');
console.log('=====================================');

Object.keys(testSlaveConfigs).forEach(slaveId => {
  const labels = getSlaveConfigLabels(slaveId);
  console.log(`\n📋 ${slaveId}:`);
  console.log(`   Config: ${JSON.stringify(testSlaveConfigs[slaveId].config, null, 2)}`);
  console.log(`   Labels: ${labels.join(', ')}`);
});

console.log('\n✅ Test completed!');
