# Database Backup Guide

The Marathon Training Tracker uses **IndexedDB** for local data storage. IndexedDB is a browser-based database that stores data locally on your machine.

## Important Notes

⚠️ **Database Location**: The database is stored in your **browser's storage**, not as files in this repository.

⚠️ **Data Persistence**: Data persists across browser sessions but is specific to:
- Browser (Chrome/Firefox/Safari data is separate)
- Domain/port (localhost:5173 vs production URL)
- Browser profile (different profiles = different data)

## Current Database Contents

As of February 16, 2026:

| Table | Records | Size | Description |
|-------|---------|------|-------------|
| **activities** | ~4,000 | ~2 MB | Activity summaries from Jan 19, 2026 |
| **activityDetails** | ~1,200 | ~400 MB | Full activity data with intervals |
| **wellness** | ~28 | ~10 KB | Daily wellness data |
| **analyses** | 1 | ~5 KB | Coach analyses |
| **cache** | 0 | 0 KB | Temporary API cache |
| **config** | 2 | ~1 KB | API credentials |

**Total Database Size**: ~402 MB

## Backup Methods

### Method 1: Browser Export (Recommended)

**Chrome/Edge**:
1. Open DevTools (F12)
2. Go to **Application** tab
3. Expand **IndexedDB** → **MarathonTrackerDB**
4. Right-click on each table → **Export**
5. Save as JSON files

**Firefox**:
1. Open DevTools (F12)
2. Go to **Storage** tab
3. Expand **IndexedDB** → **https://localhost:5173** → **MarathonTrackerDB**
4. Click each table → **Export table**
5. Save as JSON files

### Method 2: In-App Export (Future Feature)

A database export feature is planned that will allow:
- One-click export of entire database
- Selective table export
- JSON format for easy re-import
- Automatic backup scheduling

### Method 3: Manual Data Preservation

The app stores all **coach analyses** as JSON files in:
```
data/analyses/
├── 2026-02-16-threshold.json
└── ...
```

These files **are** included in the git repository and backed up automatically.

## Restore Methods

### From Browser Export

1. Clear existing database (Settings → Clear All Training Data)
2. Open DevTools → IndexedDB → MarathonTrackerDB
3. Right-click table → **Import**
4. Select your backup JSON file
5. Repeat for each table

### From Fresh Sync

The easiest restore method is to re-sync from Intervals.icu:

1. Go to Settings
2. Clear all training data
3. Go to Training Log
4. Click "🔄 Sync from API"
5. Wait for complete sync (~5-10 minutes for 4,000 activities)

**Note**: This will re-download all data from Intervals.icu since January 19, 2026.

## Data Loss Scenarios

### Scenario 1: Browser Cache Cleared

**Impact**: All database data lost (activities, wellness, analyses)

**Recovery**:
- Re-sync from Intervals.icu (activities + wellness)
- Coach analyses backed up in git (data/analyses/)

### Scenario 2: Different Browser/Computer

**Impact**: No data available (IndexedDB is browser-specific)

**Recovery**:
- Fresh sync from Intervals.icu
- Import coach analyses from git repository

### Scenario 3: Database Corruption

**Impact**: Database unreadable or partially damaged

**Recovery**:
1. Clear corrupted database (Settings → Clear All Training Data)
2. Re-sync from Intervals.icu
3. Check data integrity in Progress tab

## Preventing Data Loss

### 1. Regular Git Commits

Coach analyses are automatically backed up when you commit:

```bash
git add data/analyses/*.json
git commit -m "Add coach analysis for 2026-02-XX"
git push
```

### 2. Periodic Re-Sync

Re-sync from Intervals.icu periodically to ensure data freshness:
- Weekly: Sync latest activities
- Monthly: Full sync to verify data integrity

### 3. Browser Profile Backup

Some browsers support profile backup (Chrome Sync, Firefox Sync). This includes IndexedDB data.

### 4. Export Before Major Changes

Before clearing browser data or reinstalling:
1. Export database via DevTools
2. Verify export files are readable
3. Store in safe location

## Database Schema Version

Current schema: **v4**

Schema upgrades are automatic and preserve existing data. See [DATABASE_UPGRADE.md](./DATABASE_UPGRADE.md) for migration details.

### Schema History

- **v1**: Initial schema (config, activities, activityDetails, wellness, cache)
- **v2**: Dropped wellness table (composite key issue)
- **v3**: Recreated wellness with simple schema
- **v4**: Added analyses table for coach analyses

## Troubleshooting

### Database Not Loading

**Symptoms**: App shows "No activities found" despite previous sync

**Causes**:
- Browser storage quota exceeded
- IndexedDB corrupted
- Incognito/Private mode (IndexedDB disabled)

**Solutions**:
1. Check browser storage quota: DevTools → Application → Storage
2. Clear corrupted database: Settings → Clear All Training Data
3. Disable incognito mode or use regular browser window
4. Re-sync from Intervals.icu

### Storage Quota Exceeded

**Symptoms**: Sync fails, activities not saving

**Browser Limits**:
- Chrome: ~60% of available disk space
- Firefox: 50 MB (default), up to 50% disk with permission
- Safari: ~1 GB

**Solutions**:
1. Clear cache: Settings → Clear API Cache
2. Remove old activityDetails: Delete activities older than 6 months
3. Export and clear database, then selective re-sync

### Slow Database Performance

**Symptoms**: Slow page loads, laggy UI

**Causes**:
- Large database (>500 MB)
- Many activityDetails records with intervals
- Inefficient queries

**Solutions**:
1. Clear old activityDetails (keep last 6 months)
2. Reduce interval data retention
3. Use pagination in TrainingLog component

## Future Improvements

### Planned Features

- **Automatic Backup**: Periodic export to local filesystem
- **Cloud Sync**: Optional sync to cloud storage (Dropbox/Google Drive)
- **Selective Sync**: Choose date range to sync
- **Incremental Backup**: Only backup changed data
- **Database Optimization**: Compress interval data, remove redundancy

### Database Migration

When upgrading the app, database migrations run automatically:

```javascript
// Example migration (handled by Dexie.js)
this.version(5).stores({
  // New schema
}).upgrade(tx => {
  // Migration logic
});
```

See [DATABASE_UPGRADE.md](./DATABASE_UPGRADE.md) for technical details.

---

**Remember**: IndexedDB is browser storage - regular git commits backup your coach analyses, but activities/wellness require re-sync from Intervals.icu or manual export.

For critical data preservation, consider exporting database monthly via browser DevTools.
