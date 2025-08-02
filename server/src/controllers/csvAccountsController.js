import csvManager from '../services/csvManager.js';

// Obtener todas las cuentas desde CSV
export const getAllAccounts = (req, res) => {
  try {
    const accounts = csvManager.getAllActiveAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Error getting accounts from CSV:', error);
    res.status(500).json({ error: 'Failed to get accounts from CSV' });
  }
};

// Obtener estado del copier desde CSV
export const getCopierStatus = (req, res) => {
  try {
    const status = csvManager.getCopierStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting copier status from CSV:', error);
    res.status(500).json({ error: 'Failed to get copier status from CSV' });
  }
};

// Actualizar estado global del copier
export const setGlobalStatus = (req, res) => {
  try {
    const { enabled } = req.body;
    csvManager.updateGlobalStatus(enabled);

    res.json({
      success: true,
      message: `Global copier ${enabled ? 'enabled' : 'disabled'}`,
      enabled,
    });
  } catch (error) {
    console.error('Error updating global status:', error);
    res.status(500).json({ error: 'Failed to update global status' });
  }
};

// Actualizar estado de master
export const setMasterStatus = (req, res) => {
  try {
    const { masterAccountId, enabled } = req.body;
    csvManager.updateMasterStatus(masterAccountId, enabled);

    res.json({
      success: true,
      message: `Master ${masterAccountId} ${enabled ? 'enabled' : 'disabled'}`,
      masterAccountId,
      enabled,
    });
  } catch (error) {
    console.error('Error updating master status:', error);
    res.status(500).json({ error: 'Failed to update master status' });
  }
};

// Obtener configuración de slave
export const getSlaveConfig = (req, res) => {
  try {
    const { slaveAccountId } = req.params;
    const config = csvManager.getSlaveConfig(slaveAccountId);

    res.json({
      slaveAccountId,
      config,
    });
  } catch (error) {
    console.error('Error getting slave config:', error);
    res.status(500).json({ error: 'Failed to get slave config' });
  }
};

// Actualizar configuración de slave
export const updateSlaveConfig = (req, res) => {
  try {
    const { slaveAccountId, enabled } = req.body;
    csvManager.updateSlaveConfig(slaveAccountId, enabled);

    res.json({
      success: true,
      message: `Slave ${slaveAccountId} ${enabled ? 'enabled' : 'disabled'}`,
      slaveAccountId,
      enabled,
    });
  } catch (error) {
    console.error('Error updating slave config:', error);
    res.status(500).json({ error: 'Failed to update slave config' });
  }
};

// Emergency shutdown
export const emergencyShutdown = (req, res) => {
  try {
    csvManager.emergencyShutdown();

    res.json({
      success: true,
      message: 'Emergency shutdown executed - all copiers disabled',
    });
  } catch (error) {
    console.error('Error executing emergency shutdown:', error);
    res.status(500).json({ error: 'Failed to execute emergency shutdown' });
  }
};

// Reset all to ON
export const resetAllToOn = (req, res) => {
  try {
    csvManager.resetAllToOn();

    res.json({
      success: true,
      message: 'All copier statuses reset to ON',
    });
  } catch (error) {
    console.error('Error resetting all statuses:', error);
    res.status(500).json({ error: 'Failed to reset all statuses' });
  }
};

// Obtener estadísticas de conectividad
export const getConnectivityStats = (req, res) => {
  try {
    const accounts = csvManager.getAllActiveAccounts();
    const totalAccounts =
      Object.keys(accounts.masterAccounts).length + accounts.unconnectedSlaves.length;

    const onlineAccounts =
      Object.values(accounts.masterAccounts).filter(account => account.status === 'online').length +
      accounts.unconnectedSlaves.filter(slave => slave.status === 'online').length;

    res.json({
      totalAccounts,
      onlineAccounts,
      offlineAccounts: totalAccounts - onlineAccounts,
      connectivityPercentage: totalAccounts > 0 ? (onlineAccounts / totalAccounts) * 100 : 0,
    });
  } catch (error) {
    console.error('Error getting connectivity stats:', error);
    res.status(500).json({ error: 'Failed to get connectivity stats' });
  }
};

// Escanear archivos CSV
export const scanCSVFiles = (req, res) => {
  try {
    const files = csvManager.scanCSVFiles();

    res.json({
      success: true,
      message: `Found ${files.length} CSV files`,
      files,
    });
  } catch (error) {
    console.error('Error scanning CSV files:', error);
    res.status(500).json({ error: 'Failed to scan CSV files' });
  }
};

// Instalar bot en plataforma
export const installBot = (req, res) => {
  try {
    const { platform } = req.body;

    // Simular instalación de bot
    console.log(`Installing bot for platform: ${platform}`);

    res.json({
      success: true,
      message: `Bot installed successfully for ${platform}`,
      platform,
    });
  } catch (error) {
    console.error('Error installing bot:', error);
    res.status(500).json({ error: 'Failed to install bot' });
  }
};

// Ejecutar script de instalación
export const runInstallScript = (req, res) => {
  try {
    const { platform } = req.body;

    // Simular ejecución de script
    console.log(`Running install script for platform: ${platform}`);

    res.json({
      success: true,
      message: `Install script executed for ${platform}`,
      platform,
    });
  } catch (error) {
    console.error('Error running install script:', error);
    res.status(500).json({ error: 'Failed to run install script' });
  }
};

// Escanear cuentas en plataformas
export const scanPlatformAccounts = (req, res) => {
  try {
    // Simular escaneo de cuentas
    const accounts = {
      mt4: 2,
      mt5: 3,
      ctrader: 1,
      tradingview: 0,
      ninjatrader: 0,
    };

    res.json({
      success: true,
      message: 'Platform accounts scanned successfully',
      accounts,
    });
  } catch (error) {
    console.error('Error scanning platform accounts:', error);
    res.status(500).json({ error: 'Failed to scan platform accounts' });
  }
};
