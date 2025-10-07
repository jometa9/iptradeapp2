const fs = require('fs');
const path = require('path');

function setupDirectories() {
  const { app } = require('electron');
  const userDataPath = app.getPath('userData');
  
  const directories = [
    path.join(userDataPath, 'config'),
    path.join(userDataPath, 'csv_data'),
    // path.join(userDataPath, 'logs')
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
  
  const configPath = path.join(userDataPath, 'config', 'app_config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      server: { port: 3000, environment: 'production' },
      app: { version: app.getVersion(), firstRun: true }
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`✅ Created default config: ${configPath}`);
  }
  
  return userDataPath;
}

module.exports = { setupDirectories };