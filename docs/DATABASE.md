# Database Architecture

The Marathon Training Tracker uses **IndexedDB** (via Dexie.js) as a local database for persistent storage of training data and configuration.

## Why Local Database?

Previously, the app used `localStorage` for caching, which has limitations:
- ❌ **Size limit**: ~5-10MB total
- ❌ **No indexing**: Slow queries for large datasets
- ❌ **No structure**: Just key-value strings
- ❌ **Poor performance**: Synchronous operations block UI

With **IndexedDB + Dexie.js**:
- ✅ **Unlimited storage**: Can store hundreds of activities
- ✅ **Fast queries**: Indexed searches by date, type, etc.
- ✅ **Structured data**: Proper database tables with relations
- ✅ **Async operations**: Non-blocking, better performance
- ✅ **Offline-first**: Works without internet connection

## Database Schema

### Tables

```javascript
{
  // App configuration (API keys, settings)
  config: 'key, value, updatedAt',

  // Activities from Intervals.icu
  activities: 'id, start_date_local, type, distance, moving_time, *tags',

  // Activity details (full data including intervals)
  activityDetails: 'id, fetchedAt',

  // Wellness data (HRV, weight, resting HR)
  wellness: '[id+date], date, athlete_id, weight, restingHR, hrv',

  // Temporary cache for API responses
  cache: 'key, data, timestamp, ttl',
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User Action                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              React Component / Hook                         │
│              (Dashboard, TrainingLog, etc.)                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              intervalsApi.js                                │
│              • Check database first                         │
│              • Fetch from API if needed                     │
│              • Store in database                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─────────────────┬──────────────────┐
                   ▼                 ▼                  ▼
          ┌────────────┐    ┌─────────────┐   ┌──────────────┐
          │  Database  │    │ Intervals   │   │    Cache     │
          │  (Dexie)   │    │    .icu     │   │   (Dexie)    │
          │            │    │     API     │   │              │
          └────────────┘    └─────────────┘   └──────────────┘
```

## Storage Strategy

### 1. Configuration (Persistent)
- **What**: API keys, athlete ID, app settings
- **Where**: `config` table
- **Lifetime**: Until manually cleared
- **Usage**: Loaded once on app start

```javascript
// Save configuration
await db.setConfig('intervals_api_key', 'YOUR_KEY');
await db.setConfig('intervals_athlete_id', 'i12345678');

// Load configuration
const apiKey = await db.getConfig('intervals_api_key');
```

### 2. Activities (Persistent)
- **What**: All fetched running activities
- **Where**: `activities` table
- **Lifetime**: Until manually cleared or synced
- **Usage**: Display in Training Log, calculate progress

```javascript
// Fetch activities (checks DB first, then API)
const activities = await intervalsApi.getActivities(
  '2026-01-01',
  '2026-02-16',
  true // use database
);

// Force sync from API
const fresh = await intervalsApi.syncActivities(
  '2026-01-01',
  '2026-02-16'
);
```

### 3. Activity Details (Persistent)
- **What**: Full activity data including intervals, streams
- **Where**: `activityDetails` table
- **Lifetime**: Until manually cleared
- **Usage**: Activity detail view, analysis

```javascript
// Get details (checks DB first)
const details = await intervalsApi.getActivityDetails('i125562353');
```

### 4. Wellness Data (Persistent)
- **What**: Daily wellness metrics (HRV, weight, resting HR)
- **Where**: `wellness` table
- **Lifetime**: Until manually cleared
- **Usage**: Recovery tracking, trend analysis

```javascript
const wellness = await intervalsApi.getWellnessData(
  '2026-01-01',
  '2026-02-16'
);
```

### 5. Cache (Temporary)
- **What**: Interval data, API responses
- **Where**: `cache` table
- **Lifetime**: 5 minutes (configurable TTL)
- **Usage**: Reduce API calls for frequent requests

```javascript
// Cached automatically by intervalsApi
const intervals = await intervalsApi.getActivityIntervals('i125562353');
```

## Coach Analyses (Still Files!)

**Coach analyses remain as JSON files** (not in database):
- ✅ Easier to backup and version control
- ✅ Can be edited manually if needed
- ✅ Simple import/export workflow
- ✅ No migration needed when schema changes

```javascript
// Coach analyses use localStorage + file import
await analysisLoader.importFromFile(jsonFile);
const analyses = await analysisLoader.getAllAnalyses();
```

## API Methods

### Database Operations

```javascript
import { db } from './services/database';

// Configuration
await db.setConfig(key, value);
const value = await db.getConfig(key, defaultValue);
await db.deleteConfig(key);

// Activities
await db.storeActivities(activities); // Bulk insert
const activities = await db.getActivities(startDate, endDate);
const all = await db.getAllActivities({ type: 'Run' });

// Activity Details
await db.storeActivityDetails(activityId, details);
const details = await db.getActivityDetails(activityId);

// Wellness
await db.storeWellness(wellnessData);
const wellness = await db.getWellness(startDate, endDate);

// Cache
await db.setCached(key, data, ttl);
const cached = await db.getCached(key);
await db.clearCache();

// Maintenance
await db.clearAll(); // Clear all data except config
const stats = await db.getStats(); // Get record counts
```

### Intervals.icu API (with Database Integration)

```javascript
import { intervalsApi } from './services/intervalsApi';

// Configuration
await intervalsApi.saveConfig(apiKey, athleteId);
const config = await intervalsApi.loadConfig();
const isConfigured = await intervalsApi.isConfigured();

// Activities (checks DB first, then API)
const activities = await intervalsApi.getActivities(startDate, endDate, useCache);

// Force sync from API (bypasses cache)
const fresh = await intervalsApi.syncActivities(startDate, endDate);

// Details
const details = await intervalsApi.getActivityDetails(activityId, useCache);
const intervals = await intervalsApi.getActivityIntervals(activityId, useCache);

// Wellness
const wellness = await intervalsApi.getWellnessData(startDate, endDate, useCache);

// Maintenance
await intervalsApi.clearCache(); // Clear temporary cache
const stats = await intervalsApi.getStats(); // Get DB statistics
```

## React Hooks

### useActivities Hook

```javascript
import useActivities from './hooks/useActivities';

function MyComponent() {
  const { activities, loading, error, sync, refetch } = useActivities(90);

  // Data from database/API
  console.log(activities);

  // Force sync from API (updates database)
  const handleSync = async () => {
    await sync();
  };

  // Refetch from database
  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div>
      {loading ? 'Loading...' : `${activities.length} activities`}
      <button onClick={handleSync}>Sync from API</button>
      <button onClick={handleRefresh}>Refresh</button>
    </div>
  );
}
```

## User Actions

### In the App

**Settings Page**:
- 💾 **Save Configuration**: Stores API credentials in database
- 🔄 **Clear API Cache**: Removes temporary cache entries
- 🗑️ **Clear All Training Data**: Wipes activities, details, wellness (keeps config)
- 📊 **Database Statistics**: Shows record counts per table

**Training Log Page**:
- 🔄 **Sync from API**: Force refresh all activities from Intervals.icu

## Performance Benefits

### Before (localStorage)
```
Load 100 activities:
1. Parse JSON from localStorage string
2. Filter in JavaScript
3. Total: ~50-100ms
Size limit: Hit 5MB after ~200 activities
```

### After (IndexedDB + Dexie)
```
Load 100 activities:
1. Query database with index
2. Results already filtered
3. Total: ~5-10ms
Size limit: Effectively unlimited (hundreds of MB)
```

## Data Persistence

### What Survives Page Refresh?
- ✅ API configuration
- ✅ All activities
- ✅ Activity details
- ✅ Wellness data
- ❌ Temporary cache (5min TTL)

### What Survives Browser Close?
- ✅ Everything persists
- IndexedDB is stored on disk
- Data remains until explicitly cleared

### What Gets Cleared?
- Manual clear in Settings
- Browser data clear (if user clears site data)
- Incognito/Private browsing (on close)

## Browser Support

IndexedDB is supported in all modern browsers:
- ✅ Chrome/Edge 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ iOS Safari 10+
- ✅ Android WebView 4.4+

## Debugging

### View Database in Browser DevTools

**Chrome/Edge**:
1. Open DevTools (F12)
2. Go to "Application" tab
3. Expand "IndexedDB" in sidebar
4. Click "MarathonTrackerDB"
5. Explore tables and data

**Firefox**:
1. Open DevTools (F12)
2. Go to "Storage" tab
3. Expand "Indexed DB"
4. Click "MarathonTrackerDB"

### Inspect with Code

```javascript
// In browser console
import { db } from './services/database';

// Get stats
await db.getStats();
// { activities: 85, activityDetails: 12, wellness: 30, cache: 5 }

// View activities
const activities = await db.activities.toArray();
console.table(activities);

// Clear everything (use with caution!)
await db.clearAll();
```

## Migration from localStorage

If you were using the old version (localStorage), the app will automatically:
1. Use the database for new data
2. Gradually phase out localStorage
3. Old localStorage data is not migrated (fetch fresh from API)

**To clean up old localStorage**:
```javascript
// Clear old localStorage cache (optional)
Object.keys(localStorage)
  .filter(key => key.startsWith('intervals_'))
  .forEach(key => localStorage.removeItem(key));
```

## Best Practices

### 1. Always Check Configuration First
```javascript
const configured = await intervalsApi.isConfigured();
if (!configured) {
  // Show settings prompt
}
```

### 2. Use Cache Wisely
```javascript
// Normal queries: use cache (fast)
const activities = await intervalsApi.getActivities(start, end, true);

// After user clicks "Sync": bypass cache
const fresh = await intervalsApi.syncActivities(start, end);
```

### 3. Handle Errors Gracefully
```javascript
try {
  const activities = await intervalsApi.getActivities(start, end);
} catch (error) {
  if (error.message.includes('not configured')) {
    // Redirect to settings
  } else {
    // Show error message
  }
}
```

### 4. Show Loading States
```javascript
const { activities, loading, error } = useActivities();

if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
return <ActivityList activities={activities} />;
```

## Troubleshooting

### Database is Full or Corrupt

**Symptoms**:
- "QuotaExceededError"
- Data not saving
- App crashes on load

**Solution**:
1. Go to Settings
2. Click "Clear All Training Data"
3. Re-sync from API

### Data Not Updating

**Cause**: Cache hit, not fetching fresh data

**Solution**:
1. Click "Sync from API" in Training Log
2. Or clear cache in Settings

### Lost Configuration

**Cause**: Browser data cleared or incognito mode

**Solution**:
1. Go to Settings
2. Re-enter API Key and Athlete ID
3. Click Save Configuration
4. Data will re-sync on next fetch

---

**Your training data is now stored locally and available offline! 🎉**
