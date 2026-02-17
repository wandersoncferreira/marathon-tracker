#!/usr/bin/env node

/**
 * Clear analyses from IndexedDB via browser console
 * Copy and paste this into your browser console:
 */

console.log(`
To clear old analyses and reload new ones, paste this in the browser console:

// Clear old analyses
(async () => {
  const { db } = await import('./src/services/database.js');
  await db.clearAnalyses();
  console.log('✅ Analyses cleared! Refresh the page to load new bilingual analyses.');
})();

OR simply:
1. Go to Coach Analysis tab
2. Click "Delete All" button
3. Refresh page
`);
