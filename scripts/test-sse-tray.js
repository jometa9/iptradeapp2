const { EventSource } = require('eventsource');

// Test SSE connection for tray optimization
async function testSSEForTray() {
  console.log('🧪 Testing SSE connection for tray optimization...');

  const serverPort = process.env.VITE_SERVER_PORT || '30';
  const sseUrl = `http://localhost:${serverPort}/api/csv/events/frontend`;

  console.log('🔗 Connecting to:', sseUrl);

  const eventSource = new EventSource(sseUrl);

  eventSource.onopen = () => {
    console.log('✅ SSE connection opened successfully');
  };

  eventSource.onmessage = event => {
    try {
      const data = JSON.parse(event.data);

      // Log all events for debugging
      if (data.type !== 'heartbeat') {
        console.log('📡 Event received:', data.type);

        if (data.type === 'csv_updated' || data.type === 'initial_data') {
          const copierStatus = data.copierStatus?.globalStatus ? 'ON' : 'OFF';
          console.log(`🎯 Copier status: ${copierStatus}`);
          console.log('📊 Copier data:', data.copierStatus);
        }
      }
    } catch (error) {
      console.error('❌ Error parsing SSE message:', error);
    }
  };

  eventSource.onerror = error => {
    console.error('❌ SSE connection error:', error);
  };

  // Test for 30 seconds then close
  setTimeout(() => {
    console.log('🔄 Closing test connection...');
    eventSource.close();
    process.exit(0);
  }, 30000);
}

// Run the test
testSSEForTray().catch(console.error);
