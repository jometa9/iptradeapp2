import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import csvManager from '../services/csvManager.js';
import csvManagerUnified from '../services/csvManagerUnified.js';
import { notifyAccountConverted } from './eventNotifier.js';

// Obtener todas las cuentas
export const getAllAccounts = (req, res) => {
  try {
    const accounts = csvManagerUnified.getAllActiveAccounts();

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error('Error getting accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener cuentas pending
export const getPendingAccounts = (req, res) => {
  try {
    const pendingAccounts = csvManagerUnified.getPendingAccounts();

    res.json({
      success: true,
      data: pendingAccounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting pending accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Convertir pending a master
export const convertToMaster = (req, res) => {
  try {
    const { accountId } = req.params;
    const { name } = req.body;

    const success = csvManagerUnified.convertPendingToMaster(accountId, name);

    if (success) {
      // Notificar evento
      notifyAccountConverted(accountId, 'master');

      res.json({
        success: true,
        message: `Account ${accountId} converted to master`,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to convert account',
      });
    }
  } catch (error) {
    console.error('Error converting to master:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Convertir pending a slave
export const convertToSlave = (req, res) => {
  try {
    const { accountId } = req.params;
    const { masterId, config = {} } = req.body;

    if (!masterId) {
      return res.status(400).json({
        success: false,
        error: 'Master ID is required',
      });
    }

    const success = csvManagerUnified.convertPendingToSlave(accountId, masterId, config);

    if (success) {
      // Notificar evento
      notifyAccountConverted(accountId, 'slave');

      res.json({
        success: true,
        message: `Account ${accountId} converted to slave of master ${masterId}`,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to convert account',
      });
    }
  } catch (error) {
    console.error('Error converting to slave:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Actualizar configuración de master
export const updateMasterConfig = (req, res) => {
  try {
    const { accountId } = req.params;
    const { enabled, name } = req.body;

    const config = {};
    if (enabled !== undefined) config.enabled = enabled;
    if (name !== undefined) config.name = name;

    const success = csvManagerUnified.updateMasterConfig(accountId, config);

    if (success) {
      res.json({
        success: true,
        message: `Master ${accountId} configuration updated`,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to update master configuration',
      });
    }
  } catch (error) {
    console.error('Error updating master config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Actualizar configuración de slave
export const updateSlaveConfig = (req, res) => {
  try {
    const { accountId } = req.params;
    const config = req.body;

    const success = csvManagerUnified.updateSlaveConfig(accountId, config);

    if (success) {
      res.json({
        success: true,
        message: `Slave ${accountId} configuration updated`,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to update slave configuration',
      });
    }
  } catch (error) {
    console.error('Error updating slave config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Eliminar cuenta
export const deleteAccount = (req, res) => {
  try {
    const { accountId } = req.params;

    const success = csvManagerUnified.deleteAccount(accountId);

    if (success) {
      res.json({
        success: true,
        message: `Account ${accountId} deleted`,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to delete account',
      });
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener estado del copier
export const getCopierStatus = (req, res) => {
  try {
    // Obtener estado global directamente del archivo de configuración
    const configPath = join(process.cwd(), 'config', 'copier_status.json');
    let globalStatus = false;

    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      globalStatus = config.globalStatus === true;
    }

    res.json({
      success: true,
      data: {
        globalStatus: globalStatus,
        globalStatusText: globalStatus ? 'ON' : 'OFF',
        masterAccounts: {},
        totalMasterAccounts: 0,
      },
    });
  } catch (error) {
    console.error('Error getting copier status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Actualizar estado global del copier
export const updateGlobalCopierStatus = async (req, res) => {
  try {
    const { enabled } = req.body;

    // Actualizar el estado global usando csvManager
    await csvManager.updateGlobalStatus(enabled);

    res.json({
      success: true,
      message: `Global copier status ${enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('Error updating global copier status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Emergency shutdown
export const emergencyShutdown = (req, res) => {
  try {
    // Deshabilitar todos los masters y slaves
    const masters = csvManagerUnified.getMasterAccounts();
    const slaves = csvManagerUnified.getSlaveAccounts();

    masters.forEach(master => {
      csvManagerUnified.updateMasterConfig(master.accountId, { enabled: false });
    });

    slaves.forEach(slave => {
      csvManagerUnified.updateSlaveConfig(slave.accountId, { enabled: false });
    });

    res.json({
      success: true,
      message: 'Emergency shutdown completed',
    });
  } catch (error) {
    console.error('Error in emergency shutdown:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reset all to ON
export const resetAllToOn = (req, res) => {
  try {
    // Habilitar todos los masters y slaves
    const masters = csvManagerUnified.getMasterAccounts();
    const slaves = csvManagerUnified.getSlaveAccounts();

    masters.forEach(master => {
      csvManagerUnified.updateMasterConfig(master.accountId, { enabled: true });
    });

    slaves.forEach(slave => {
      csvManagerUnified.updateSlaveConfig(slave.accountId, { enabled: true });
    });

    res.json({
      success: true,
      message: 'All accounts enabled',
    });
  } catch (error) {
    console.error('Error resetting all to ON:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener configuración de slave específico
export const getSlaveConfig = (req, res) => {
  try {
    const { accountId } = req.params;
    const slaves = csvManagerUnified.getSlaveAccounts();
    const slave = slaves.find(s => s.accountId === accountId);

    if (!slave) {
      return res.status(404).json({
        success: false,
        error: 'Slave account not found',
      });
    }

    res.json({
      success: true,
      data: slave.config,
    });
  } catch (error) {
    console.error('Error getting slave config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener estadísticas
export const getStatistics = (req, res) => {
  try {
    const stats = csvManagerUnified.getStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
