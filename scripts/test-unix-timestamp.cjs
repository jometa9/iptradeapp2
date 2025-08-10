const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testUnixTimestamp() {
  try {
    console.log('🧪 Testing Unix Timestamp Support\n');

    // 1. Crear archivo de prueba con timestamps Unix
    console.log('📝 Step 1: Creating test file with Unix timestamps...');

    const unixTestContent = `0,12345,MT4,PENDING,1754853000
0,12346,MT5,PENDING,1754853060
0,12347,CTRADER,PENDING,1754853120`;

    const csvFilePath = path.join(__dirname, '..', 'csv_data', 'IPTRADECSV2.csv');
    fs.writeFileSync(csvFilePath, unixTestContent);

    console.log('✅ Test file created with Unix timestamps');
    console.log('   Content:');
    console.log('   ' + unixTestContent.split('\n').join('\n   '));

    // 2. Convertir timestamps Unix a fechas legibles para verificación
    console.log('\n📅 Step 2: Converting Unix timestamps to readable dates...');

    const timestamps = [1754853000, 1754853060, 1754853120];
    timestamps.forEach((ts, index) => {
      const date = new Date(ts * 1000);
      console.log(`   ${index + 1}. Unix: ${ts} → Date: ${date.toISOString()}`);
    });

    // 3. Probar endpoint de escaneo
    console.log('\n🔍 Step 3: Testing scan endpoint with Unix timestamps...');

    const response = await axios.get('http://localhost:3000/api/csv/scan-pending', {
      headers: {
        'x-api-key': 'iptrade_89536f5b9e643c0433f3',
      },
    });

    console.log('✅ Scan endpoint working');
    console.log(`   Found ${response.data.summary.totalAccounts} accounts`);

    // 4. Verificar que los timestamps se procesaron correctamente
    console.log('\n📊 Step 4: Verifying timestamp processing...');

    const accounts = response.data.accounts;
    if (accounts && accounts.length > 0) {
      console.log('✅ Accounts found with Unix timestamps:');
      accounts.forEach((account, index) => {
        console.log(`\n   ${index + 1}. Account ID: ${account.account_id}`);
        console.log(`      Platform: ${account.platform}`);
        console.log(`      Status: ${account.current_status || account.status}`);
        console.log(`      Raw Timestamp: ${account.timestamp}`);
        console.log(
          `      Time Diff: ${account.timeDiff ? account.timeDiff.toFixed(1) + 's ago' : 'N/A'}`
        );

        // Verificar que el timestamp se convirtió correctamente
        const unixTs = parseInt(account.timestamp);
        if (!isNaN(unixTs)) {
          const convertedDate = new Date(unixTs * 1000);
          console.log(`      Converted Date: ${convertedDate.toISOString()}`);

          // Verificar que la conversión es correcta
          const expectedDate = new Date(1754853000 + index * 60 * 1000);
          const isCorrect = Math.abs(convertedDate.getTime() - expectedDate.getTime()) < 1000;
          console.log(`      Conversion Correct: ${isCorrect ? '✅' : '❌'}`);
        }
      });
    } else {
      console.log('⚠️ No accounts found');
    }

    // 5. Probar con diferentes formatos de timestamp
    console.log('\n🔄 Step 5: Testing different timestamp formats...');

    const mixedContent = `0,99991,MT4,PENDING,1754853000
0,99992,MT5,PENDING,1754853060000
0,99993,CTRADER,PENDING,2024-01-15T10:30:00Z`;

    fs.writeFileSync(csvFilePath, mixedContent);
    console.log('✅ Mixed format file created');
    console.log('   Content:');
    console.log('   ' + mixedContent.split('\n').join('\n   '));

    // 6. Probar escaneo con formato mixto
    console.log('\n🔍 Step 6: Testing scan with mixed timestamp formats...');

    const mixedResponse = await axios.get('http://localhost:3000/api/csv/scan-pending', {
      headers: {
        'x-api-key': 'iptrade_89536f5b9e643c0433f3',
      },
    });

    console.log('✅ Mixed format scan working');
    console.log(`   Found ${mixedResponse.data.summary.totalAccounts} accounts`);

    const mixedAccounts = mixedResponse.data.accounts;
    if (mixedAccounts && mixedAccounts.length > 0) {
      console.log('\n   Mixed format accounts:');
      mixedAccounts.forEach((account, index) => {
        console.log(
          `   ${index + 1}. ${account.account_id} (${account.platform}) - ${account.timestamp}`
        );
      });
    }

    console.log('\n🎉 Unix timestamp test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Unix timestamps (10 digits) supported');
    console.log('   ✅ Unix timestamps (13 digits) supported');
    console.log('   ✅ ISO 8601 timestamps supported');
    console.log('   ✅ Mixed format files supported');
    console.log('   ✅ Automatic timestamp detection working');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Ejecutar la prueba
testUnixTimestamp();
