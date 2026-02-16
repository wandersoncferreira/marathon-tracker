/**
 * Database Sync Service
 * Export/Import IndexedDB to/from JSON files for cross-computer sync via git
 * Files stored in public/database/ for runtime auto-loading
 */

import { db } from './database';

// Default database file name
const DEFAULT_DB_FILENAME = 'marathon-tracker-db.json';

/**
 * Export entire database to JSON files
 * Creates files in data/database/ that can be committed to git
 */
export async function exportDatabaseToFiles() {
  try {
    const exports = {
      timestamp: new Date().toISOString(),
      version: 4,
      tables: {}
    };

    // Export activities
    const activities = await db.activities.toArray();
    exports.tables.activities = {
      count: activities.length,
      data: activities
    };

    // Export activityDetails (this will be large)
    const activityDetails = await db.activityDetails.toArray();
    exports.tables.activityDetails = {
      count: activityDetails.length,
      data: activityDetails
    };

    // Export wellness
    const wellness = await db.wellness.toArray();
    exports.tables.wellness = {
      count: wellness.length,
      data: wellness
    };

    // Export analyses
    const analyses = await db.analyses.toArray();
    exports.tables.analyses = {
      count: analyses.length,
      data: analyses
    };

    // Don't export cache or config (those are temporary/sensitive)

    return exports;
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
}

/**
 * Import database from exported JSON data
 * @param {Object} data - Exported database data
 * @param {boolean} clearExisting - Clear existing data before import
 */
export async function importDatabaseFromData(data, clearExisting = false) {
  try {
    if (!data || !data.tables) {
      throw new Error('Invalid import data');
    }

    // Clear existing data if requested
    if (clearExisting) {
      await db.activities.clear();
      await db.activityDetails.clear();
      await db.wellness.clear();
      await db.analyses.clear();
    }

    let imported = {
      activities: 0,
      activityDetails: 0,
      wellness: 0,
      analyses: 0
    };

    // Import activities
    if (data.tables.activities?.data) {
      await db.activities.bulkPut(data.tables.activities.data);
      imported.activities = data.tables.activities.data.length;
    }

    // Import activityDetails
    if (data.tables.activityDetails?.data) {
      await db.activityDetails.bulkPut(data.tables.activityDetails.data);
      imported.activityDetails = data.tables.activityDetails.data.length;
    }

    // Import wellness
    if (data.tables.wellness?.data) {
      await db.wellness.bulkPut(data.tables.wellness.data);
      imported.wellness = data.tables.wellness.data.length;
    }

    // Import analyses
    if (data.tables.analyses?.data) {
      await db.analyses.bulkPut(data.tables.analyses.data);
      imported.analyses = data.tables.analyses.data.length;
    }

    return imported;
  } catch (error) {
    console.error('Error importing database:', error);
    throw error;
  }
}

/**
 * Download database export as JSON file
 */
export async function downloadDatabaseExport() {
  try {
    const data = await exportDatabaseToFiles();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `marathon-tracker-db-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Error downloading database:', error);
    throw error;
  }
}

/**
 * Upload and import database from JSON file
 * @param {File} file - JSON file to import
 * @param {boolean} clearExisting - Clear existing data before import
 */
export async function uploadDatabaseImport(file, clearExisting = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const imported = await importDatabaseFromData(data, clearExisting);
        resolve(imported);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

/**
 * Get database statistics for export
 */
export async function getDatabaseExportStats() {
  try {
    const stats = await db.getStats();

    // Calculate approximate sizes
    const activities = await db.activities.toArray();
    const activityDetails = await db.activityDetails.toArray();
    const wellness = await db.wellness.toArray();
    const analyses = await db.analyses.toArray();

    const activitiesSize = new Blob([JSON.stringify(activities)]).size;
    const detailsSize = new Blob([JSON.stringify(activityDetails)]).size;
    const wellnessSize = new Blob([JSON.stringify(wellness)]).size;
    const analysesSize = new Blob([JSON.stringify(analyses)]).size;

    return {
      records: stats,
      sizes: {
        activities: activitiesSize,
        activityDetails: detailsSize,
        wellness: wellnessSize,
        analyses: analysesSize,
        total: activitiesSize + detailsSize + wellnessSize + analysesSize
      },
      formatted: {
        activities: formatBytes(activitiesSize),
        activityDetails: formatBytes(detailsSize),
        wellness: formatBytes(wellnessSize),
        analyses: formatBytes(analysesSize),
        total: formatBytes(activitiesSize + detailsSize + wellnessSize + analysesSize)
      }
    };
  } catch (error) {
    console.error('Error getting export stats:', error);
    throw error;
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if local database is empty (needs import on first load)
 */
export async function isDatabaseEmpty() {
  try {
    const stats = await db.getStats();
    return stats.activities === 0 && stats.activityDetails === 0;
  } catch (error) {
    console.error('Error checking database:', error);
    return true;
  }
}

/**
 * Auto-import from default JSON file if database is empty
 * Fetches from public/database/marathon-tracker-db.json
 * Call this on app startup
 */
export async function autoImportIfEmpty() {
  try {
    const isEmpty = await isDatabaseEmpty();
    if (!isEmpty) {
      return { imported: false, reason: 'Database not empty' };
    }

    // Try to fetch default database file from public folder
    const baseUrl = import.meta.env.BASE_URL || '/';
    const dbUrl = `${baseUrl}database/${DEFAULT_DB_FILENAME}`;

    try {
      const response = await fetch(dbUrl);

      if (!response.ok) {
        return {
          imported: false,
          reason: 'No database file found in public/database/',
          needsManualImport: true
        };
      }

      const data = await response.json();
      const imported = await importDatabaseFromData(data, false);

      return {
        imported: true,
        source: dbUrl,
        stats: imported,
        message: `Auto-imported database: ${imported.activities} activities, ${imported.activityDetails} details, ${imported.wellness} wellness, ${imported.analyses} analyses`
      };
    } catch (fetchError) {
      // File doesn't exist or network error - this is normal on first run
      return {
        imported: false,
        reason: 'No database file available for auto-import',
        needsManualImport: true
      };
    }
  } catch (error) {
    console.error('Error in auto-import:', error);
    return { imported: false, error: error.message };
  }
}

/**
 * Check if default database file exists in public folder
 */
export async function checkDefaultDatabaseExists() {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const dbUrl = `${baseUrl}database/${DEFAULT_DB_FILENAME}`;
    const response = await fetch(dbUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}
