import { spawn } from 'child_process';
import fetch from 'node-fetch';

async function waitForServer(port, maxAttempts = 30) {
  console.log(`⏳ Waiting for server to start on port ${port}...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/status`, {
        timeout: 1000,
      });
      if (response.ok) {
        console.log(`✅ Server is ready on port ${port}`);
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    console.log(`   Attempt ${attempt}/${maxAttempts} - waiting...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`❌ Server failed to start on port ${port}`);
  return false;
}

async function testUnifiedEndpoint() {
  console.log('🧪 Testing unified endpoint after restart...');
  
  try {
    const response = await fetch('http://localhost:30/api/accounts/unified', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('📊 Unified Response Analysis:');
      console.log('=====================================');
      
      // Check for duplicates between categories
      const pendingAccounts = data.data?.pendingAccounts || [];
      const masterAccounts = data.data?.configuredAccounts?.masterAccounts || {};
      const slaveAccounts = data.data?.configuredAccounts?.slaveAccounts || {};
      const unconnectedSlaves = data.data?.configuredAccounts?.unconnectedSlaves || [];
      
      const pendingIds = new Set(pendingAccounts.map(acc => acc.account_id));
      const masterIds = new Set(Object.keys(masterAccounts));
      const slaveIds = new Set(Object.keys(slaveAccounts));
      const unconnectedIds = new Set(unconnectedSlaves.map(slave => slave.id));
      
      // Check for duplicates
      const allIds = [...pendingIds, ...masterIds, ...slaveIds, ...unconnectedIds];
      const uniqueIds = new Set(allIds);
      
      if (allIds.length !== uniqueIds.size) {
        console.log('❌ Found duplicate account IDs across categories:');
        const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
        const uniqueDuplicates = [...new Set(duplicates)];
        
        uniqueDuplicates.forEach(id => {
          const categories = [];
          if (pendingIds.has(id)) categories.push('pending');
          if (masterIds.has(id)) categories.push('master');
          if (slaveIds.has(id)) categories.push('slave');
          if (unconnectedIds.has(id)) categories.push('unconnected');
          
          console.log(`   - ${id}: appears in ${categories.join(', ')}`);
        });
      } else {
        console.log('✅ No duplicate account IDs found across categories');
      }
      
      // Check for problematic data
      const problematicMasters = Object.keys(masterAccounts).filter(id => 
        id === 'ENABLED' || id === 'DISABLED' || id === 'ON' || id === 'OFF'
      );
      
      const problematicSlaves = unconnectedSlaves.filter(slave => {
        const masterId = slave.config?.masterId;
        return masterId === 'ENABLED' || masterId === 'DISABLED' || masterId === 'ON' || masterId === 'OFF';
      });
      
      if (problematicMasters.length > 0) {
        console.log(`❌ Found ${problematicMasters.length} problematic master IDs: ${problematicMasters.join(', ')}`);
      } else {
        console.log('✅ No problematic master IDs found');
      }
      
      if (problematicSlaves.length > 0) {
        console.log(`❌ Found ${problematicSlaves.length} problematic unconnected slaves:`);
        problematicSlaves.forEach(slave => {
          console.log(`   - ${slave.id} with masterId: ${slave.config?.masterId}`);
        });
      } else {
        console.log('✅ No problematic unconnected slaves found');
      }
      
      // Show summary
      console.log('\n📈 Summary:');
      console.log(`   Pending Accounts: ${pendingAccounts.length}`);
      console.log(`   Master Accounts: ${Object.keys(masterAccounts).length}`);
      console.log(`   Slave Accounts: ${Object.keys(slaveAccounts).length}`);
      console.log(`   Unconnected Slaves: ${unconnectedSlaves.length}`);
      console.log(`   Total Unique Accounts: ${uniqueIds.size}`);
      
      console.log('\n=====================================');
      console.log('✅ Test complete');
      
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

async function restartServer() {
  console.log('🔄 Restarting server...');
  
  // Kill existing server process (if any)
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Kill processes on port 30
    await execAsync('netstat -ano | findstr :30 | findstr LISTENING');
    console.log('⚠️ Server is still running on port 30');
    console.log('   Please stop the server manually and run this script again');
    return false;
  } catch (error) {
    // No server running, good
  }
  
  // Start server
  const serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: './server',
    stdio: 'pipe',
    shell: true
  });
  
  serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER] ${data.toString().trim()}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.log(`[SERVER ERROR] ${data.toString().trim()}`);
  });
  
  // Wait for server to start
  const serverReady = await waitForServer(30);
  
  if (serverReady) {
    // Test the endpoint
    await testUnifiedEndpoint();
    
    // Keep server running for a bit to see results
    console.log('\n⏳ Keeping server running for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Kill server
    serverProcess.kill();
    console.log('🛑 Server stopped');
  } else {
    serverProcess.kill();
    console.log('❌ Failed to start server');
  }
}

// Run the restart and test
restartServer().catch(console.error);
