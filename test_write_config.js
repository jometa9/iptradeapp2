import csvManager from './server/src/services/csvManager.js';

console.log('Testing writeConfig method...');

const result = csvManager.writeConfig('250062001', {
  type: 'slave',
  enabled: false,
  slaveConfig: {
    lotMultiplier: 1.0,
    forceLot: null,
    reverseTrading: false,
    maxLotSize: null,
    minLotSize: null,
  },
});

console.log('Result:', result);
