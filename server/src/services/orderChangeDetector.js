// Order Change Detector
// Detects actual changes in ORDER lines vs just status updates

// No necesitamos EventEmitter aquí

// Cache to store previous order states
const orderCache = new Map();

/**
 * Extracts ORDER lines from CSV content
 * @param {string} content - Raw CSV content
 * @returns {Array<{ticket: string, data: string}>} Array of order objects
 */
const extractOrderLines = content => {
  const lines = content.split('\n').filter(line => line.trim());
  const orders = [];

  for (const line of lines) {
    if (line.includes('[ORDER]')) {
      const matches = line.match(/\[([^\]]*)\]/g);
      if (matches && matches.length >= 9) {
        const values = matches.map(m => m.replace(/[\[\]]/g, ''));
        const [_, ticket, ...orderData] = values;
        orders.push({
          ticket,
          data: orderData.join(','), // Rest of order data for comparison
        });
      }
    }
  }

  return orders;
};

/**
 * Detects if there are actual changes in orders
 * @param {string} accountId - Account ID
 * @param {string} newContent - New CSV content
 * @returns {{
 *   hasChanges: boolean,
 *   type: 'status_only' | 'order_change',
 *   changes: {
 *     added: Array<string>,
 *     removed: Array<string>,
 *     modified: Array<string>
 *   }
 * }}
 */
export const detectOrderChanges = (accountId, newContent) => {
  // Extract current orders
  const currentOrders = extractOrderLines(newContent);

  // Get previous state from cache
  const previousOrders = orderCache.get(accountId) || [];

  // Find added, removed, and modified orders
  const currentTickets = new Set(currentOrders.map(o => o.ticket));
  const previousTickets = new Set(previousOrders.map(o => o.ticket));

  const added = currentOrders.filter(o => !previousTickets.has(o.ticket)).map(o => o.ticket);

  const removed = previousOrders.filter(o => !currentTickets.has(o.ticket)).map(o => o.ticket);

  const modified = currentOrders
    .filter(current => {
      const previous = previousOrders.find(p => p.ticket === current.ticket);
      return previous && previous.data !== current.data;
    })
    .map(o => o.ticket);

  // Update cache with new state
  orderCache.set(accountId, currentOrders);

  const hasOrderChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  return {
    hasChanges: hasOrderChanges,
    type: hasOrderChanges ? 'order_change' : 'status_only',
    changes: {
      added,
      removed,
      modified,
    },
  };
};

/**
 * Clears the cache for an account
 * @param {string} accountId - Account ID to clear
 */
export const clearOrderCache = accountId => {
  orderCache.delete(accountId);
};

/**
 * Gets the current cached state for an account
 * @param {string} accountId - Account ID to check
 * @returns {Array<{ticket: string, data: string}>} Current cached orders
 */
export const getCachedOrders = accountId => {
  return orderCache.get(accountId) || [];
};
