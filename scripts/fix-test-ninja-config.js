#!/usr/bin/env node
/**
 * Script para verificar y corregir la configuración de TEST_NINJA_009
 * Basado en la imagen que muestra "Fixed Lot 0.36" pero no está guardado
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const fixTestNinjaConfig = () => {
  console.log('🔧 Fixing TEST_NINJA_009 Configuration');
  console.log('=====================================\n');

  const configBaseDir = join(process.cwd(), 'server', 'config');
  const slaveConfigsPath = join(configBaseDir, 'slave_configurations.json');

  try {
    // Cargar configuraciones actuales
    const slaveConfigs = JSON.parse(readFileSync(slaveConfigsPath, 'utf8'));

    console.log('📋 Current slave configurations:');
    Object.keys(slaveConfigs).forEach(accountId => {
      const config = slaveConfigs[accountId];
      console.log(
        `  ${accountId}: forceLot=${config.forceLot}, lotMultiplier=${config.lotMultiplier}`
      );
    });

    // Verificar si TEST_NINJA_009 existe
    if (!slaveConfigs['TEST_NINJA_009']) {
      console.log('\n❌ TEST_NINJA_009 not found in slave configurations');
      console.log('   Creating configuration based on UI display...');

      // Crear configuración basada en lo que se muestra en la UI
      slaveConfigs['TEST_NINJA_009'] = {
        lotMultiplier: 1,
        forceLot: 0.36, // Basado en la imagen que muestra "Fixed Lot 0.36"
        reverseTrading: false,
        maxLotSize: null,
        minLotSize: null,
        allowedSymbols: [],
        blockedSymbols: [],
        allowedOrderTypes: [],
        blockedOrderTypes: [],
        tradingHours: {
          enabled: false,
          startTime: '00:00',
          endTime: '23:59',
          timezone: 'UTC',
        },
        enabled: true,
        description: 'Configuration created from UI display',
        lastUpdated: new Date().toISOString(),
      };

      // Guardar la configuración
      writeFileSync(slaveConfigsPath, JSON.stringify(slaveConfigs, null, 2));

      console.log('✅ Created TEST_NINJA_009 configuration:');
      console.log(`   - forceLot: 0.36`);
      console.log(`   - lotMultiplier: 1`);
      console.log(`   - enabled: true`);
    } else {
      console.log('\n📋 TEST_NINJA_009 configuration found:');
      const config = slaveConfigs['TEST_NINJA_009'];
      console.log(`   - forceLot: ${config.forceLot}`);
      console.log(`   - lotMultiplier: ${config.lotMultiplier}`);
      console.log(`   - enabled: ${config.enabled}`);

      // Verificar si necesita actualización
      if (config.forceLot !== 0.36) {
        console.log('\n🔄 Updating forceLot to 0.36...');
        config.forceLot = 0.36;
        config.lastUpdated = new Date().toISOString();

        writeFileSync(slaveConfigsPath, JSON.stringify(slaveConfigs, null, 2));
        console.log('✅ Updated TEST_NINJA_009 configuration');
      } else {
        console.log('✅ Configuration is already correct');
      }
    }

    // Verificar también el archivo de trading transformations
    const tradingTransformPath = join(process.cwd(), 'config', 'trading_transformations.json');
    const tradingTransform = JSON.parse(readFileSync(tradingTransformPath, 'utf8'));

    console.log('\n📋 Trading transformations for TEST_NINJA_009:');
    if (tradingTransform['TEST_NINJA_009']) {
      const ttConfig = tradingTransform['TEST_NINJA_009'];
      console.log(`   - forceLot: ${ttConfig.forceLot}`);
      console.log(`   - lotMultiplier: ${ttConfig.lotMultiplier}`);

      // Actualizar si es necesario
      if (ttConfig.forceLot !== 0.36) {
        console.log('\n🔄 Updating trading transformations...');
        ttConfig.forceLot = 0.36;
        writeFileSync(tradingTransformPath, JSON.stringify(tradingTransform, null, 2));
        console.log('✅ Updated trading transformations');
      } else {
        console.log('✅ Trading transformations are correct');
      }
    } else {
      console.log('❌ TEST_NINJA_009 not found in trading transformations');
    }

    console.log('\n🎯 Configuration fix completed!');
    console.log('   - TEST_NINJA_009 should now show "Fixed Lot 0.36" in the UI');
    console.log('   - Both slave configs and trading transformations are synchronized');
  } catch (error) {
    console.error('❌ Error fixing configuration:', error);
  }
};

// Ejecutar el script
fixTestNinjaConfig();
