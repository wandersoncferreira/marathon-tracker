# Marathon Tracker - Architecture Documentation

## Core Architecture Pattern: Database-First with Git Sync

### Philosophy

The Marathon Tracker app follows a **database-first, offline-capable** architecture that prioritizes:

1. **Persistent Local Storage** - IndexedDB as the primary data source
2. **Git-Syncable Exports** - JSON database exports for cross-computer synchronization
3. **API as Secondary Source** - Intervals.icu API used only for incremental updates
4. **Performance** - Read from local database first, API calls only when necessary

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                        │
│                     (React Components)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ intervalsApi │  │ analysisLoader│  │ databaseSync │         │
│  │    .js       │  │    .js        │  │    .js       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                              │
│                   (database.js)                                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │        IndexedDB (Dexie.js wrapper)                      │ │
│  │  ┌─────────────┐  ┌────────────┐  ┌──────────┐         │ │
│  │  │ activities  │  │  wellness  │  │ analyses │  ...    │ │
│  │  └─────────────┘  └────────────┘  └──────────┘         │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SOURCES                             │
│  ┌──────────────────┐           ┌──────────────────┐          │
│  │ Intervals.icu API│           │ Git Sync (JSON)  │          │
│  │  (incremental)   │           │   (full backup)  │          │
│  └──────────────────┘           └──────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Current Tables (v6)

```javascript
{
  // App configuration (API keys, settings)
  config: 'key, value, updatedAt',

  // Training activities from Intervals.icu
  activities: 'id, start_date_local, type, distance, moving_time, *tags',

  // Full activity details (intervals, streams, etc.)
  activityDetails: 'id, fetchedAt',

  // Daily wellness metrics (HR, HRV, TSB, etc.)
  wellness: 'id, date',

  // Coach analysis reports
  analyses: 'activityId, date',

  // Activity comments/notes
  activityMessages: 'id, activityId, created',

  // Planned workouts/events
  events: 'id, start_date_local, category',

  // API response cache
  cache: 'key, data, timestamp, ttl'
}
```

## Critical Pattern: Database-First Read Strategy

### ⚠️ RULE: Always Read from Database First

Every feature MUST follow this pattern:

```javascript
// ✅ CORRECT: Database-first with API fallback
async function getActivityData(activityId) {
  // 1. Try database first
  const cached = await db.getActivityDetails(activityId);
  if (cached) {
    console.log('✅ Loaded from database');
    return cached;
  }

  // 2. Fall back to API only if not in database
  console.log('📡 Fetching from API...');
  const data = await intervalsApi.getActivity(activityId);

  // 3. Store in database for future reads
  await db.storeActivityDetails(activityId, data);

  return data;
}

// ❌ WRONG: Direct API call without checking database
async function getActivityData(activityId) {
  return await intervalsApi.getActivity(activityId); // NO!
}
```

### Why Database-First?

1. **Performance**: IndexedDB reads are ~10-100x faster than API calls
2. **Offline Support**: App works without internet connection
3. **Rate Limiting**: Minimizes API calls to Intervals.icu
4. **Consistency**: Single source of truth for all features
5. **Git Sync**: Database exports ensure data portability

## Implementation Pattern for New Features

### Step 1: Database Schema

Add new table(s) to `database.js`:

```javascript
// In MarathonTrackerDB constructor
this.version(7).stores({
  crossTraining: 'id, date, type, *tags', // Add your table
});

// Access table
this.crossTraining = this.table('crossTraining');
```

### Step 2: Database Methods

Add CRUD methods in `database.js`:

```javascript
/**
 * Store cross training activities
 */
async storeCrossTraining(activities) {
  try {
    await this.crossTraining.bulkPut(activities);
    return true;
  } catch (error) {
    console.error('Error storing cross training:', error);
    return false;
  }
}

/**
 * Get cross training by date range
 */
async getCrossTraining(startDate, endDate) {
  try {
    return await this.crossTraining
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  } catch (error) {
    console.error('Error getting cross training:', error);
    return [];
  }
}
```

### Step 3: Service Layer

Create service methods in `intervalsApi.js` or separate service file:

```javascript
/**
 * Get cross training activities - DATABASE FIRST
 * @param {string} startDate - ISO date (YYYY-MM-DD)
 * @param {string} endDate - ISO date (YYYY-MM-DD)
 */
async getCrossTrainingActivities(startDate, endDate) {
  try {
    // 1. Read from database first
    const cached = await db.getCrossTraining(startDate, endDate);

    if (cached && cached.length > 0) {
      console.log(`✅ Loaded ${cached.length} cross training activities from database`);
      return cached;
    }

    // 2. If empty or stale, fetch from API
    console.log('📡 Fetching cross training from Intervals.icu API...');
    const activities = await this.request(
      `/athlete/${this.config.athleteId}/activities?type=Ride,Other&oldest=${startDate}&newest=${endDate}`
    );

    // Filter for cross training (cycling, strength)
    const crossTraining = activities.filter(a =>
      a.type === 'Ride' || (a.type === 'Other' && a.name?.includes('Strength'))
    );

    // 3. Store in database
    if (crossTraining.length > 0) {
      await db.storeCrossTraining(crossTraining);
      console.log(`✅ Stored ${crossTraining.length} cross training activities`);
    }

    return crossTraining;
  } catch (error) {
    console.error('Error fetching cross training:', error);

    // 4. On error, return any cached data we have
    return await db.getCrossTraining(startDate, endDate);
  }
}
```

### Step 4: Export/Import Support

Update `databaseSync.js` to include new table:

```javascript
export async function exportDatabaseToFiles() {
  try {
    const exports = {
      timestamp: new Date().toISOString(),
      version: 7, // Increment version
      tables: {}
    };

    // ... existing tables ...

    // Export cross training
    const crossTraining = await db.crossTraining.toArray();
    exports.tables.crossTraining = {
      count: crossTraining.length,
      data: crossTraining
    };

    return exports;
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
}

export async function importDatabaseFromData(data, clearExisting = false) {
  // ... existing imports ...

  // Import cross training
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
}
```

### Step 5: UI Component

Create React component following the pattern:

```javascript
import { useState, useEffect } from 'react';
import { intervalsApi } from '../services/intervalsApi';

export default function CrossTraining() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCrossTraining();
  }, []);

  async function loadCrossTraining() {
    try {
      setLoading(true);

      // Database-first read via service layer
      const activities = await intervalsApi.getCrossTrainingActivities(
        '2026-01-19', // Marathon cycle start
        '2026-05-31'  // Race day
      );

      setData(activities);
    } catch (error) {
      console.error('Error loading cross training:', error);
    } finally {
      setLoading(false);
    }
  }

  // ... render UI ...
}
```

## Data Synchronization Strategy

### On App Startup

```javascript
// In main.jsx or App.jsx
import { autoImportIfEmpty } from './services/databaseSync';

// Auto-import on startup
await autoImportIfEmpty();
```

**Logic:**
1. Check if database is empty
2. Fetch `public/database/marathon-tracker-db.json`
3. Compare timestamps
4. Import if empty OR if JSON is newer
5. Store `last_db_import_timestamp` in config

### Manual Sync Actions

**Export (Settings → Export Database):**
```javascript
import { downloadDatabaseExport } from './services/databaseSync';

await downloadDatabaseExport();
// Downloads: marathon-tracker-db-YYYY-MM-DD.json
```

**Import (Settings → Import Database):**
```javascript
import { uploadDatabaseImport } from './services/databaseSync';

await uploadDatabaseImport(file, clearExisting=true);
```

### Git Workflow

1. **Before committing changes:**
   ```bash
   # Export database from app (Settings → Export)
   # Save as: public/database/marathon-tracker-db.json
   git add public/database/marathon-tracker-db.json
   git commit -m "sync: update database with latest training data"
   git push
   ```

2. **After pulling changes:**
   - App auto-imports on next load (detects newer timestamp)
   - Or manually: Settings → Refresh Data

## Caching Strategy

### Short-Term Cache (5 minutes)

Used for frequently-changing API responses:

```javascript
// Check cache first
const cacheKey = 'athlete_profile';
const cached = await db.getCached(cacheKey);
if (cached) return cached;

// Fetch from API
const data = await intervalsApi.getAthleteProfile();

// Cache for 5 minutes
await db.setCached(cacheKey, data, 5 * 60 * 1000);
```

### Long-Term Storage (Permanent)

Used for historical data that doesn't change:

```javascript
// Store permanently in dedicated table
await db.storeActivityDetails(activityId, details);

// No TTL - stays forever unless manually deleted
```

## Performance Optimization

### Batch Operations

```javascript
// ✅ Bulk operations are fast
await db.activities.bulkPut(activities);

// ❌ Individual puts are slow
for (const activity of activities) {
  await db.activities.put(activity); // NO!
}
```

### Indexed Queries

```javascript
// ✅ Fast: Uses index
await db.activities
  .where('start_date_local')
  .between(startDate, endDate)
  .toArray();

// ❌ Slow: Full table scan
const all = await db.activities.toArray();
const filtered = all.filter(a =>
  a.start_date_local >= startDate && a.start_date_local <= endDate
);
```

### Progressive Loading

```javascript
// Load essential data first
const activities = await db.activities.toArray();
setActivities(activities);

// Load details progressively
for (const activity of activities.slice(0, 10)) {
  const details = await db.getActivityDetails(activity.id);
  updateActivityDetails(activity.id, details);
}
```

## Error Handling

### Graceful Degradation

```javascript
try {
  // Try database first
  const data = await db.getData();
  if (data) return data;

  // Fall back to API
  return await api.getData();
} catch (error) {
  console.error('Error:', error);

  // Return empty state instead of crashing
  return [];
}
```

### User Feedback

```javascript
// Show data source to user
if (fromDatabase) {
  console.log('✅ Loaded from local database');
} else {
  console.log('📡 Fetched from Intervals.icu API');
}
```

## Testing New Features

### Checklist

- [ ] Database schema updated with proper indexes
- [ ] CRUD methods added to `database.js`
- [ ] Service layer implements database-first pattern
- [ ] Export includes new table in `databaseSync.js`
- [ ] Import handles new table in `databaseSync.js`
- [ ] Component uses service layer (not direct API)
- [ ] Error handling returns cached data on failure
- [ ] Manual export/import tested
- [ ] Auto-import tested on empty database
- [ ] Git sync tested across computers

## Common Pitfalls

### ❌ Direct API Calls

```javascript
// WRONG: Bypasses database
const data = await fetch('https://intervals.icu/api/...');
```

**Fix:** Always use service layer with database-first pattern.

### ❌ Missing Export/Import

```javascript
// WRONG: New table not in export
// User syncs via git, table is empty on other computer
```

**Fix:** Update both `exportDatabaseToFiles()` and `importDatabaseFromData()`.

### ❌ No Indexes

```javascript
// WRONG: Schema without proper indexes
wellness: 'id' // Only primary key, can't query by date
```

**Fix:** Add indexed fields:
```javascript
wellness: 'id, date' // Now can query by date efficiently
```

### ❌ No Error Handling

```javascript
// WRONG: Crashes on API failure
const data = await api.getData();
```

**Fix:** Always have fallback:
```javascript
try {
  const cached = await db.getData();
  if (cached) return cached;
  return await api.getData();
} catch (error) {
  return cached || [];
}
```

## Best Practices

1. **Always read database first, API second**
2. **Store API responses immediately**
3. **Include new tables in export/import**
4. **Use indexed fields for queries**
5. **Batch operations when possible**
6. **Handle errors gracefully**
7. **Log data sources (database vs API)**
8. **Test git sync workflow**
9. **Keep cache TTLs appropriate**
10. **Document data flow in comments**

## Example: Complete Feature Implementation

See `/docs/CROSS_TRAINING_IMPLEMENTATION.md` for a full example of implementing a new feature following this architecture.
