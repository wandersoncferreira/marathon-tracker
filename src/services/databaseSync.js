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
      version: 8,
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

    // Export events (weekly plan)
    const events = await db.events.toArray();
    exports.tables.events = {
      count: events.length,
      data: events
    };

    // Export cross training (cycling, strength)
    const crossTraining = await db.crossTraining.toArray();
    exports.tables.crossTraining = {
      count: crossTraining.length,
      data: crossTraining
    };

    // Export nutrition tracking
    const nutritionTracking = await db.nutritionTracking.toArray();
    exports.tables.nutritionTracking = {
      count: nutritionTracking.length,
      data: nutritionTracking
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

    console.log('📦 Starting database import...');
    console.log('📊 Data to import:', {
      activities: data.tables.activities?.count || 0,
      activityDetails: data.tables.activityDetails?.count || 0,
      wellness: data.tables.wellness?.count || 0,
      analyses: data.tables.analyses?.count || 0,
      events: data.tables.events?.count || 0,
      crossTraining: data.tables.crossTraining?.count || 0,
      nutritionTracking: data.tables.nutritionTracking?.count || 0
    });

    // Clear existing data if requested
    if (clearExisting) {
      console.log('🗑️ Clearing existing data...');
      await db.activities.clear();
      await db.activityDetails.clear();
      await db.wellness.clear();
      await db.analyses.clear();
      await db.events.clear();
      await db.crossTraining.clear();
      await db.nutritionTracking.clear();
    }

    let imported = {
      activities: 0,
      activityDetails: 0,
      wellness: 0,
      analyses: 0,
      events: 0,
      crossTraining: 0,
      nutritionTracking: 0
    };

    // Import activities
    if (data.tables.activities?.data) {
      try {
        console.log(`📥 Importing ${data.tables.activities.data.length} activities...`);
        await db.activities.bulkPut(data.tables.activities.data);
        imported.activities = data.tables.activities.data.length;
        console.log(`✅ Imported ${imported.activities} activities`);
      } catch (error) {
        console.error('❌ Error importing activities:', error);
        throw error;
      }
    }

    // Import activityDetails
    if (data.tables.activityDetails?.data) {
      try {
        console.log(`📥 Importing ${data.tables.activityDetails.data.length} activity details...`);
        await db.activityDetails.bulkPut(data.tables.activityDetails.data);
        imported.activityDetails = data.tables.activityDetails.data.length;
        console.log(`✅ Imported ${imported.activityDetails} activity details`);
      } catch (error) {
        console.error('❌ Error importing activity details:', error);
        throw error;
      }
    }

    // Import wellness
    if (data.tables.wellness?.data) {
      try {
        console.log(`📥 Importing ${data.tables.wellness.data.length} wellness records...`);
        await db.wellness.bulkPut(data.tables.wellness.data);
        imported.wellness = data.tables.wellness.data.length;
        console.log(`✅ Imported ${imported.wellness} wellness records`);
      } catch (error) {
        console.error('❌ Error importing wellness:', error);
        throw error;
      }
    }

    // Import analyses
    if (data.tables.analyses?.data) {
      try {
        console.log(`📥 Importing ${data.tables.analyses.data.length} analyses...`);
        await db.analyses.bulkPut(data.tables.analyses.data);
        imported.analyses = data.tables.analyses.data.length;
        console.log(`✅ Imported ${imported.analyses} analyses`);
      } catch (error) {
        console.error('❌ Error importing analyses:', error);
        throw error;
      }
    }

    // Import events (weekly plan)
    if (data.tables.events?.data) {
      try {
        console.log(`📥 Importing ${data.tables.events.data.length} events...`);
        await db.events.bulkPut(data.tables.events.data);
        imported.events = data.tables.events.data.length;
        console.log(`✅ Imported ${imported.events} events`);
      } catch (error) {
        console.error('❌ Error importing events:', error);
        throw error;
      }
    }

    // Import cross training (cycling, strength)
    if (data.tables.crossTraining?.data) {
      try {
        console.log(`📥 Importing ${data.tables.crossTraining.data.length} cross training activities...`);
        await db.crossTraining.bulkPut(data.tables.crossTraining.data);
        imported.crossTraining = data.tables.crossTraining.data.length;
        console.log(`✅ Imported ${imported.crossTraining} cross training activities`);
      } catch (error) {
        console.error('❌ Error importing cross training:', error);
        throw error;
      }
    }

    // Import nutrition tracking
    if (data.tables.nutritionTracking?.data) {
      try {
        console.log(`📥 Importing ${data.tables.nutritionTracking.data.length} nutrition tracking entries...`);
        await db.nutritionTracking.bulkPut(data.tables.nutritionTracking.data);
        imported.nutritionTracking = data.tables.nutritionTracking.data.length;
        console.log(`✅ Imported ${imported.nutritionTracking} nutrition tracking entries`);
      } catch (error) {
        console.error('❌ Error importing nutrition tracking:', error);
        throw error;
      }
    }

    console.log('✅ Database import complete:', imported);
    return imported;
  } catch (error) {
    console.error('❌ Fatal error importing database:', error);
    throw error;
  }
}

/**
 * Download database export as compressed JSON file
 * Uses gzip compression to significantly reduce file size
 */
export async function downloadDatabaseExport() {
  try {
    const data = await exportDatabaseToFiles();

    // Minify JSON (no pretty-printing) for better compression
    const json = JSON.stringify(data);

    // Compress using browser's native gzip compression
    const stream = new Blob([json]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(compressedStream).blob();

    // Calculate compression ratio
    const originalSize = new Blob([json]).size;
    const compressedSize = compressedBlob.size;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`📦 Compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${ratio}% reduction)`);

    const url = URL.createObjectURL(compressedBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `marathon-tracker-db-${new Date().toISOString().split('T')[0]}.json.gz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      originalSize,
      compressedSize,
      ratio: `${ratio}%`
    };
  } catch (error) {
    console.error('Error downloading database:', error);
    throw error;
  }
}

/**
 * Upload and import database from JSON file (supports both .json and .json.gz)
 * @param {File} file - JSON or gzipped JSON file to import
 * @param {boolean} clearExisting - Clear existing data before import
 */
export async function uploadDatabaseImport(file, clearExisting = false) {
  try {
    let jsonText;

    // Check if file is compressed (ends with .gz)
    if (file.name.endsWith('.gz')) {
      console.log('📦 Decompressing gzip file...');

      // Decompress using browser's native gzip decompression
      const arrayBuffer = await file.arrayBuffer();
      const stream = new Blob([arrayBuffer]).stream();
      const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
      const decompressedBlob = await new Response(decompressedStream).blob();
      jsonText = await decompressedBlob.text();

      console.log(`✅ Decompressed: ${formatBytes(file.size)} → ${formatBytes(decompressedBlob.size)}`);
    } else {
      // Read as plain text
      jsonText = await file.text();
    }

    // Parse and import
    const data = JSON.parse(jsonText);
    const imported = await importDatabaseFromData(data, clearExisting);
    return imported;
  } catch (error) {
    console.error('Error importing database:', error);
    throw error;
  }
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
    const isEmpty = stats.activities === 0 && stats.activityDetails === 0;
    console.log('📊 Database check:', {
      activities: stats.activities,
      activityDetails: stats.activityDetails,
      isEmpty
    });
    return isEmpty;
  } catch (error) {
    console.error('Error checking database:', error);
    return true;
  }
}

/**
 * Auto-import from default JSON file on app startup
 * Fetches from public/database/marathon-tracker-db.json
 * Imports if:
 *  - Database is empty, OR
 *  - JSON file timestamp is newer than last import
 * This ensures the app always loads the latest git-synced data
 */
export async function autoImportIfEmpty() {
  console.log('🔄 Auto-import starting...');
  try {
    // Try to fetch default database file from public folder
    let baseUrl = import.meta.env.BASE_URL || '/';
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }

    // Try compressed file first, then fallback to uncompressed
    const compressedUrl = `${baseUrl}database/${DEFAULT_DB_FILENAME}.gz`;
    const uncompressedUrl = `${baseUrl}database/${DEFAULT_DB_FILENAME}`;

    console.log('🔍 Fetching database...');

    let response;
    let isCompressed = false;

    try {
      // Try compressed version first
      response = await fetch(compressedUrl);
      if (response.ok) {
        console.log('✅ Found compressed database file');
        isCompressed = true;
      } else {
        // Fallback to uncompressed
        console.log('📄 Trying uncompressed database file...');
        response = await fetch(uncompressedUrl);
      }

      if (!response.ok) {
        console.log(`❌ No database file found (HTTP ${response.status})`);
        console.log('💡 This is normal on first deployment');

        // Check if IndexedDB is empty
        const isEmpty = await isDatabaseEmpty();
        if (isEmpty) {
          return {
            imported: false,
            reason: 'No database file found and IndexedDB is empty',
            needsManualSync: true
          };
        } else {
          return {
            imported: false,
            reason: 'No database file found, using existing IndexedDB data'
          };
        }
      }

      // Parse the response (decompress if needed)
      let data;
      if (isCompressed) {
        console.log('📦 Decompressing database...');
        const arrayBuffer = await response.arrayBuffer();
        const stream = new Blob([arrayBuffer]).stream();
        const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
        const decompressedBlob = await new Response(decompressedStream).blob();
        const jsonText = await decompressedBlob.text();
        data = JSON.parse(jsonText);
        console.log(`✅ Decompressed: ${formatBytes(arrayBuffer.byteLength)} → ${formatBytes(decompressedBlob.size)}`);
      } else {
        console.log('✅ Parsing JSON...');
        data = await response.json();
      }

      const fileTimestamp = data.timestamp;

      console.log('📊 File timestamp:', fileTimestamp);

      // Check if we should import
      const stats = await db.getStats();
      const lastImport = await db.getConfig('last_db_import_timestamp');

      console.log('📊 Current IndexedDB:', {
        activities: stats.activities,
        activityDetails: stats.activityDetails,
        lastImport: lastImport || 'never'
      });

      // Decide: import if database is empty OR file is newer
      const isEmpty = stats.activities === 0 && stats.activityDetails === 0;
      const isNewer = !lastImport || (fileTimestamp && new Date(fileTimestamp) > new Date(lastImport));

      if (!isEmpty && !isNewer) {
        console.log('ℹ️ Database is up-to-date, skipping import');
        return {
          imported: false,
          reason: 'Database already up-to-date',
          lastImport: lastImport
        };
      }

      if (isEmpty) {
        console.log('✅ Database is empty - importing...');
      } else if (isNewer) {
        console.log('✅ Database file is newer - updating...');
        console.log(`   File: ${fileTimestamp}`);
        console.log(`   Last import: ${lastImport}`);
      }

      // Import with clearExisting=true to replace old data
      console.log('📦 Importing database (replacing existing data)...');
      const imported = await importDatabaseFromData(data, true);

      // Store import timestamp
      await db.setConfig('last_db_import_timestamp', fileTimestamp || new Date().toISOString());

      console.log(`✅ Import complete: ${imported.activities} activities, ${imported.activityDetails} details, ${imported.wellness} wellness, ${imported.analyses} analyses, ${imported.crossTraining} cross training, ${imported.nutritionTracking} nutrition entries`);

      return {
        imported: true,
        source: isCompressed ? compressedUrl : uncompressedUrl,
        stats: imported,
        fileTimestamp: fileTimestamp,
        compressed: isCompressed,
        message: `Loaded database: ${imported.activities} activities, ${imported.activityDetails} details, ${imported.nutritionTracking} nutrition entries`
      };
    } catch (fetchError) {
      console.log('❌ Error fetching database:', fetchError.message);

      // Check if IndexedDB has data
      const stats = await db.getStats();
      if (stats.activities > 0) {
        console.log('ℹ️ Using existing IndexedDB data');
        return {
          imported: false,
          reason: 'Failed to fetch file, using existing data',
          error: fetchError.message
        };
      } else {
        return {
          imported: false,
          reason: 'No database file and IndexedDB empty',
          needsManualSync: true,
          error: fetchError.message
        };
      }
    }
  } catch (error) {
    console.error('❌ Auto-import error:', error);
    return { imported: false, error: error.message };
  }
}

/**
 * Check if default database file exists in public folder
 */
export async function checkDefaultDatabaseExists() {
  try {
    let baseUrl = import.meta.env.BASE_URL || '/';
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    const dbUrl = `${baseUrl}database/${DEFAULT_DB_FILENAME}`;
    const response = await fetch(dbUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}
