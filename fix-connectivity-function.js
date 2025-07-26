// Corrected getConnectivityStats function
export const getConnectivityStats = (req, res) => {
  try {
    const apiKey = req.apiKey;
    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key required - use requireValidSubscription middleware',
      });
    }

    const userAccounts = getUserAccounts(apiKey);
    const now = new Date();

    const stats = {
      total: 0,
      synchronized: 0,
      pending: 0,
      offline: 0,
      error: 0,
      masters: {
        total: 0,
        synchronized: 0,
        pending: 0,
        offline: 0,
        error: 0,
      },
      slaves: {
        total: 0,
        synchronized: 0,
        pending: 0,
        offline: 0,
        error: 0,
      },
      connectivityDetails: [],
    };

    // Process master accounts
    if (userAccounts.masterAccounts) {
      for (const [accountId, account] of Object.entries(userAccounts.masterAccounts)) {
        stats.total++;
        stats.masters.total++;

        // Check if master has connected slaves (real synchronization)
        const connectedSlaves = Object.entries(userAccounts.connections || {})
          .filter(([, masterId]) => masterId === accountId)
          .map(([slaveId]) => slaveId);

        // First check if account is offline due to inactivity
        const isOffline =
          account.status === 'offline' ||
          (account.lastActivity && now - new Date(account.lastActivity) > ACTIVITY_TIMEOUT);

        // Check if copy trading is disabled for this master
        const copierStatus = loadUserCopierStatus(apiKey);
        const isCopyTradingDisabled =
          copierStatus.masterAccounts && copierStatus.masterAccounts[accountId] === false;

        let status;
        if (isOffline || isCopyTradingDisabled) {
          status = 'offline';
        } else if (connectedSlaves.length > 0) {
          status = 'synchronized';
        } else {
          status = 'pending'; // Master without slaves is pending (not connected)
        }

        stats[status] = (stats[status] || 0) + 1;
        stats.masters[status] = (stats.masters[status] || 0) + 1;

        // Calculate time since last activity for reference
        let timeSinceActivity = null;
        if (account.lastActivity) {
          timeSinceActivity = now - new Date(account.lastActivity);
        }

        stats.connectivityDetails.push({
          accountId,
          type: 'master',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
          connectedSlaves: connectedSlaves.length,
          connectedSlaveIds: connectedSlaves,
        });
      }
    }

    // Process slave accounts
    if (userAccounts.slaveAccounts) {
      for (const [accountId, account] of Object.entries(userAccounts.slaveAccounts)) {
        stats.total++;
        stats.slaves.total++;

        // Check if slave is connected to a master (real synchronization)
        const connectedToMaster = userAccounts.connections && userAccounts.connections[accountId];

        // First check if account is offline due to inactivity
        const isOffline =
          account.status === 'offline' ||
          (account.lastActivity && now - new Date(account.lastActivity) > ACTIVITY_TIMEOUT);

        // Check if copy trading is disabled for this slave
        const slaveConfigs = loadSlaveConfigs();
        const isCopyTradingDisabled =
          slaveConfigs[accountId] && slaveConfigs[accountId].enabled === false;

        let status;
        if (isOffline || isCopyTradingDisabled) {
          status = 'offline';
        } else if (connectedToMaster) {
          status = 'synchronized';
        } else {
          status = 'pending'; // Slave without master is pending (not connected)
        }

        stats[status] = (stats[status] || 0) + 1;
        stats.slaves[status] = (stats.slaves[status] || 0) + 1;

        // Calculate time since last activity for reference
        let timeSinceActivity = null;
        if (account.lastActivity) {
          timeSinceActivity = now - new Date(account.lastActivity);
        }

        stats.connectivityDetails.push({
          accountId,
          type: 'slave',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
          connectedTo: connectedToMaster || null,
        });
      }
    }

    // Process pending accounts
    if (userAccounts.pendingAccounts) {
      for (const [accountId, account] of Object.entries(userAccounts.pendingAccounts)) {
        stats.total++;

        // For pending accounts, we need to respect their actual status
        // If they are offline, count them as offline, not pending
        let status = account.status || 'pending';

        stats[status] = (stats[status] || 0) + 1;

        // Calculate time since last activity
        let timeSinceActivity = null;
        if (account.lastActivity) {
          timeSinceActivity = now - new Date(account.lastActivity);
        }

        stats.connectivityDetails.push({
          accountId,
          type: 'pending',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
        });
      }
    }

    res.json({
      message: 'Connectivity statistics retrieved successfully',
      stats,
      activityTimeout: ACTIVITY_TIMEOUT,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error getting connectivity stats:', error);
    res.status(500).json({ error: 'Failed to get connectivity statistics' });
  }
};
