const axios = require('axios');

async function testPendingAccounts() {
  try {
    console.log('🔍 Testing pending accounts endpoint...\n');

    const response = await axios.get('http://localhost:30/api/accounts/pending', {
      headers: {
        'x-api-key': 'iptrade_89536f5b9e643c0433f3',
      },
    });

    console.log('✅ Response received');
    console.log('Status:', response.status);

    const data = response.data;
    console.log('\n📊 Pending Accounts Data:');
    console.log('Total Pending:', data.totalPending);
    console.log('Message:', data.message);

    console.log('\n🔍 Individual Accounts:');
    if (data.pendingAccounts) {
      Object.entries(data.pendingAccounts).forEach(([id, account]) => {
        console.log(`- ${id}: ${account.status} (${account.platform || 'Unknown'})`);
        console.log(`  Last Activity: ${account.lastActivity}`);
        console.log(`  First Seen: ${account.firstSeen}`);
      });
    }

    console.log('\n📈 Count by Status:');
    const statusCount = {};
    Object.values(data.pendingAccounts).forEach(account => {
      statusCount[account.status] = (statusCount[account.status] || 0) + 1;
    });
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`- ${status}: ${count}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testPendingAccounts();
