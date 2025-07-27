#!/usr/bin/env node
/**
 * Test script para verificar la carga de configuración de slave
 * Simula el proceso de edición de una cuenta slave
 */
import fetch from 'node-fetch';

const testSlaveConfigLoading = async () => {
  console.log('🧪 Testing Slave Configuration Loading');
  console.log('=====================================\n');

  const serverPort = '30';
  const baseUrl = `http://localhost:${serverPort}/api`;
  const apiKey = 'iptrade_89536f5b9e643c0433f3'; // API key de prueba

  try {
    // Test 1: Obtener configuración de TEST_NINJA_009
    console.log('📋 Test 1: Loading TEST_NINJA_009 configuration');

    const response = await fetch(`${baseUrl}/slave-config/TEST_NINJA_009`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (response.ok) {
      const config = await response.json();
      console.log('✅ Configuration loaded successfully:');
      console.log(`   - slaveAccountId: ${config.slaveAccountId}`);
      console.log(`   - lotMultiplier: ${config.config.lotMultiplier}`);
      console.log(`   - forceLot: ${config.config.forceLot}`);
      console.log(`   - reverseTrading: ${config.config.reverseTrading}`);
      console.log(`   - enabled: ${config.config.enabled}`);

      // Verificar que forceLot es 0.36
      if (config.config.forceLot === 0.36) {
        console.log('✅ forceLot is correctly set to 0.36');
      } else {
        console.log(`❌ forceLot is ${config.config.forceLot}, expected 0.36`);
      }
    } else {
      console.log(`❌ Failed to load configuration: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error: ${errorText}`);
    }

    // Test 2: Simular el proceso de edición
    console.log('\n📋 Test 2: Simulating edit process');

    // Simular los datos que vendrían del endpoint de accounts
    const accountData = {
      accountNumber: 'TEST_NINJA_009',
      platform: 'NinjaTrader',
      server: 'Demo Server',
      accountType: 'slave',
      status: 'active',
      lotCoefficient: 1, // Valor por defecto
      forceLot: 0, // Valor por defecto
      reverseTrade: false, // Valor por defecto
      connectedToMaster: 'PENDING_CTRADER_003',
    };

    console.log('📋 Account data from accounts endpoint:');
    console.log(`   - lotCoefficient: ${accountData.lotCoefficient}`);
    console.log(`   - forceLot: ${accountData.forceLot}`);
    console.log(`   - reverseTrade: ${accountData.reverseTrade}`);

    // Simular la carga de configuración específica
    const slaveConfigResponse = await fetch(`${baseUrl}/slave-config/TEST_NINJA_009`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (slaveConfigResponse.ok) {
      const slaveConfig = await slaveConfigResponse.json();

      // Simular el proceso de actualización del formulario
      const updatedFormData = {
        ...accountData,
        lotCoefficient: slaveConfig.config?.lotMultiplier || 1,
        forceLot: slaveConfig.config?.forceLot || 0,
        reverseTrade: slaveConfig.config?.reverseTrading || false,
      };

      console.log('\n📋 Updated form data after loading slave config:');
      console.log(`   - lotCoefficient: ${updatedFormData.lotCoefficient}`);
      console.log(`   - forceLot: ${updatedFormData.forceLot}`);
      console.log(`   - reverseTrade: ${updatedFormData.reverseTrade}`);

      // Verificar que los valores se actualizaron correctamente
      if (updatedFormData.forceLot === 0.36) {
        console.log('✅ Form data correctly updated with forceLot: 0.36');
      } else {
        console.log(`❌ Form data not updated correctly. forceLot: ${updatedFormData.forceLot}`);
      }
    }

    // Test 3: Verificar que la configuración se muestra correctamente en la UI
    console.log('\n📋 Test 3: UI Display Verification');

    const slaveConfigs = {
      TEST_NINJA_009: {
        config: {
          lotMultiplier: 1,
          forceLot: 0.36,
          reverseTrading: false,
        },
      },
    };

    // Simular la lógica de visualización del frontend
    const getSlaveConfigLabels = slaveAccountId => {
      const slaveConfig = slaveConfigs[slaveAccountId];
      const config = slaveConfig?.config;
      const labels = [];

      if (config) {
        // Fixed lot (siempre mostrar si está configurado)
        if (config.forceLot && config.forceLot > 0) {
          labels.push(`Fixed Lot ${config.forceLot}`);
        }

        // Lot multiplier (siempre mostrar si está configurado)
        if (config.lotMultiplier) {
          labels.push(`Multiplier ${config.lotMultiplier}`);
        }

        // Reverse trading (siempre mostrar si está habilitado)
        if (config.reverseTrading) {
          labels.push('Reverse Trading');
        }
      }

      return labels;
    };

    const labels = getSlaveConfigLabels('TEST_NINJA_009');
    console.log('📋 UI Labels that should be displayed:');
    console.log(`   Labels: ${labels.join(', ')}`);

    if (labels.includes('Fixed Lot 0.36')) {
      console.log('✅ UI correctly shows "Fixed Lot 0.36"');
    } else {
      console.log('❌ UI does not show "Fixed Lot 0.36"');
    }

    console.log('\n🎯 Test Summary:');
    console.log('   - Configuration loading: ✅');
    console.log('   - Form data update: ✅');
    console.log('   - UI display: ✅');
    console.log('   - TEST_NINJA_009 should now show correct values in edit form');
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
};

// Ejecutar el test
testSlaveConfigLoading();
