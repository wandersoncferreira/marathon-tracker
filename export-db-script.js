/**
 * Export Database from IndexedDB via Browser Console
 *
 * Usage:
 * 1. Open app: http://localhost:3000
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 5. Database will download as JSON file
 */

(async function exportDatabase() {
  console.log('🔄 Starting database export...');

  // Import Dexie and open database
  const Dexie = window.Dexie;
  if (!Dexie) {
    console.error('❌ Dexie not loaded. Make sure app is running.');
    return;
  }

  const db = new Dexie('MarathonTrackerDB');

  // Define schema (must match current version)
  db.version(4).stores({
    config: 'key',
    activities: 'id',
    activityDetails: 'id',
    wellness: 'id',
    cache: 'key',
    analyses: 'activityId'
  });

  try {
    await db.open();
    console.log('✅ Database opened');

    // Export all tables
    const exportData = {
      timestamp: new Date().toISOString(),
      version: 4,
      tables: {}
    };

    // Export activities
    console.log('📊 Exporting activities...');
    const activities = await db.activities.toArray();
    exportData.tables.activities = {
      count: activities.length,
      data: activities
    };
    console.log(`✅ Exported ${activities.length} activities`);

    // Export activity details
    console.log('📊 Exporting activity details (this may take a moment)...');
    const activityDetails = await db.activityDetails.toArray();
    exportData.tables.activityDetails = {
      count: activityDetails.length,
      data: activityDetails
    };
    console.log(`✅ Exported ${activityDetails.length} activity details`);

    // Export wellness
    console.log('📊 Exporting wellness...');
    const wellness = await db.wellness.toArray();
    exportData.tables.wellness = {
      count: wellness.length,
      data: wellness
    };
    console.log(`✅ Exported ${wellness.length} wellness records`);

    // Export analyses
    console.log('📊 Exporting analyses...');
    const analyses = await db.analyses.toArray();
    exportData.tables.analyses = {
      count: analyses.length,
      data: analyses
    };
    console.log(`✅ Exported ${analyses.length} analyses`);

    // Create download
    console.log('💾 Creating download...');
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `marathon-tracker-db-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ Database exported successfully!');
    console.log(`📦 File size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('💡 Save this file to: public/database/marathon-tracker-db.json');

    return exportData;
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
})();
