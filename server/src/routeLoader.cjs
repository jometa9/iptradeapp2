/**
 * CommonJS wrapper for ES module routes
 * This allows us to use CommonJS in the main production server while keeping ES modules in routes
 */

const { createRequire } = require('module');
const path = require('path');

// Create a require function that can load ES modules
const requireES = createRequire(process.cwd());

// Load routes using dynamic import
async function loadRoutes() {
  try {
    console.log('[ROUTES] Loading ES module routes...');
    
    const routesDir = path.join(__dirname, 'routes');
    
    // Import all route modules
    const [
      accountsRoutes,
      configRoutes,
      copierStatusRoutes,
      csvRoutes,
      eventRoutes,
      linkPlatformsRoutes,
      orderRoutes,
      slaveConfigRoutes,
      statusRoutes,
      tradingConfigRoutes,
      swaggerDocs
    ] = await Promise.all([
      import('./routes/accounts.js'),
      import('./routes/config.js'),
      import('./routes/copierStatus.js'),
      import('./routes/csvRoutes.js'),
      import('./routes/events.js'),
      import('./routes/linkPlatforms.js'),
      import('./routes/orders.js'),
      import('./routes/slaveConfig.js'),
      import('./routes/status.js'),
      import('./routes/tradingConfig.js'),
      import('./swaggerConfig.js')
    ]);

    console.log('[ROUTES] All routes loaded successfully');
    
    return {
      accountsRoutes: accountsRoutes.default,
      configRoutes: configRoutes.default,
      copierStatusRoutes: copierStatusRoutes.default,
      csvRoutes: csvRoutes.default,
      eventRoutes: eventRoutes.default,
      linkPlatformsRoutes: linkPlatformsRoutes.default,
      orderRoutes: orderRoutes.default,
      slaveConfigRoutes: slaveConfigRoutes.default,
      statusRoutes: statusRoutes.default,
      tradingConfigRoutes: tradingConfigRoutes.default,
      swaggerDocs: swaggerDocs.default
    };
  } catch (error) {
    console.error('[ROUTES] Failed to load routes:', error);
    throw error;
  }
}

module.exports = { loadRoutes };
