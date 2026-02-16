# Multi-Computer Database Sync

This guide explains how to sync your Marathon Training Tracker database across multiple computers using git, avoiding the need to re-fetch all interval data from Intervals.icu on each machine.

## Problem

The app stores data in **browser IndexedDB**, which is:
- Local to each browser
- Not shared across computers
- Lost when switching machines

Without database sync, you would need to:
- Re-fetch 4,000+ activities from Intervals.icu (~5-10 minutes)
- Re-download all interval data (~400 MB)
- Re-sync wellness data
- Lose any local modifications

## Solution: Git-Based Database Sync

Export your database to a JSON file, commit it to git, and import on other computers.

## Quick Start

### On Computer A (Initial Setup)

1. **Build your database** (one-time):
   ```bash
   # Start app
   npm run dev

   # Open http://localhost:5173
   # Go to Settings → Configure API
   # Go to Training Log → Sync from API
   # Wait for complete sync (~5-10 minutes)
   ```

2. **Export database**:
   - Settings → Database Sync section
   - Click **📤 Export Database to JSON**
   - Save file as `public/database/marathon-tracker-db.json`

3. **Commit to git**:
   ```bash
   git add public/database/marathon-tracker-db.json
   git commit -m "Export database for multi-computer sync"
   git push
   ```

### On Computer B (Import)

1. **Pull from git**:
   ```bash
   git pull
   ```

2. **Import database**:
   - Open app: http://localhost:5173
   - Settings → Database Sync section
   - Click **📥 Import Database from JSON**
   - Select `public/database/marathon-tracker-db.json`
   - Confirm import (replaces local data)
   - ✅ Database restored!

3. **Continue training**:
   - All activities, intervals, and wellness data available
   - No API sync needed
   - Ready to use immediately

## Detailed Workflow

### Daily Workflow

```
┌──────────────┐
│  Computer A  │
│  (Work)      │
└──────────────┘
       ↓
  1. Train & sync new activities
  2. Generate coach analysis
  3. Export database
  4. Commit & push
       ↓
┌──────────────┐
│     Git      │
│  (Sync)      │
└──────────────┘
       ↓
  5. Pull changes
  6. Import database
       ↓
┌──────────────┐
│  Computer B  │
│  (Home)      │
└──────────────┘
```

### Detailed Steps

#### 1. After Training Session (Computer A)

```bash
# Sync latest activity from Intervals.icu
# Training Log → 🔄 Sync from API

# Generate coach analysis (optional)
# Use COACH_ANALYSIS_PROMPT.md

# Export database
# Settings → 📤 Export Database to JSON
# Save to public/database/marathon-tracker-db-2026-02-16.json
```

#### 2. Commit Database Export

```bash
cd ~/Documents/vite

# Add database file
git add public/database/marathon-tracker-db-2026-02-16.json

# Commit with descriptive message
git commit -m "Export database after threshold session on 2026-02-16

Includes:
- 4,234 activities
- 1,256 activity details with intervals
- 28 wellness records
- 1 coach analysis

Total export size: 387 MB"

# Push to remote
git push
```

#### 3. Switch to Computer B

```bash
# Pull latest changes
git pull

# Open app
npm run dev
# Navigate to http://localhost:5173
```

#### 4. Import Database

1. Go to **Settings** (⚙️ tab)
2. Scroll to **Database Sync (Multi-Computer)** section
3. Click **📥 Import Database from JSON**
4. Select `public/database/marathon-tracker-db-2026-02-16.json`
5. Confirm: "This will REPLACE all existing data"
6. Wait for import (~30 seconds for 400 MB file)
7. Success! Database restored

#### 5. Verify Import

Check that data loaded correctly:

**Dashboard**:
- ✅ This Week shows activities
- ✅ Training Load populated
- ✅ KM at MP calculated

**Training Log**:
- ✅ Activities from Jan 19, 2026
- ✅ Recent activities visible

**Progress Tracker**:
- ✅ Weekly KM at MP chart populated
- ✅ Fitness/Fatigue/Form chart shows data

**Settings → Database Statistics**:
- ✅ Activities: 4,234
- ✅ Activity Details: 1,256
- ✅ Wellness: 28
- ✅ Analyses: 1

## Export Size Breakdown

Example export for 4 weeks of training:

| Component | Records | Size |
|-----------|---------|------|
| **Activities** | 4,234 | ~2.1 MB |
| **Activity Details** (intervals) | 1,256 | ~385 MB |
| **Wellness** | 28 | ~8 KB |
| **Analyses** | 1 | ~5 KB |
| **Total** | - | **~387 MB** |

**Note**: Activity details with intervals are the largest component (99% of export size).

## Git Considerations

### Large File Size

Database exports are large (~400 MB). Git handles this, but:

**Option 1: Standard Git** (Recommended for private repos)
```bash
# Works fine for private repositories
git add public/database/*.json
git commit -m "Export database"
git push
```

**Option 2: Git LFS** (For repos with many exports)
```bash
# Install Git LFS
git lfs install

# Track database exports
git lfs track "public/database/*.json"
git add .gitattributes
git commit -m "Track database exports with Git LFS"

# Now commits will use LFS
git add public/database/*.json
git commit -m "Export database (LFS)"
git push
```

### .gitignore

The `public/database/` directory is **NOT** in .gitignore because you want to track database exports.

Only ignore temporary/generated files:
```gitignore
# Ignore temporary database files
public/database/*.tmp
public/database/*.temp

# Track actual exports
!public/database/marathon-tracker-db-*.json
```

## Best Practices

### 1. Export Naming Convention

Use consistent naming for exports:

```bash
# Format: marathon-tracker-db-YYYY-MM-DD.json
marathon-tracker-db-2026-02-16.json
marathon-tracker-db-2026-02-23.json
marathon-tracker-db-2026-03-01.json
```

### 2. When to Export

Export database when:
- ✅ After important training sessions (threshold, long runs)
- ✅ Weekly (every Sunday evening)
- ✅ Before switching computers
- ✅ After generating coach analyses

Don't need to export:
- ❌ After every single activity
- ❌ Multiple times per day
- ❌ After only viewing data (no changes)

### 3. Clean Up Old Exports

Keep only recent exports in git:

```bash
# Keep last 4 weeks of exports
ls public/database/ | head -n -4 | xargs rm

# Or keep monthly exports only
# marathon-tracker-db-2026-01-31.json
# marathon-tracker-db-2026-02-28.json
```

### 4. Commit Messages

Use descriptive commit messages:

```bash
# Good
git commit -m "Export DB after week 5: 3x3km threshold + 24km long run"

# Better
git commit -m "Export database - Week 5 Build phase complete

Activities this week:
- Monday: Threshold 3x3km @ 4:00/km
- Wednesday: Speed 10x400m
- Saturday: Long run 24km with MP finish

Total: 67 km, 15 km at MP
Training load: 287 TSS

Database: 4,234 activities, 387 MB"
```

## Troubleshooting

### Import Fails with "Invalid JSON"

**Cause**: Corrupted export file

**Solution**:
1. Re-export database on original computer
2. Verify file size (~400 MB, not 0 bytes)
3. Open JSON in text editor - should start with `{"timestamp":`
4. Re-commit and push
5. Pull on other computer and try again

### Import Hangs / Takes Too Long

**Cause**: Very large database (>500 MB)

**Solution**:
1. Wait patiently (can take 1-2 minutes for 500 MB)
2. Check browser console for errors (F12 → Console)
3. Try smaller browser (Firefox often faster than Chrome for IndexedDB)
4. Clear old activity details:
   ```javascript
   // In browser console
   // Delete activities older than 6 months
   ```

### Data Missing After Import

**Cause**: Import file from different training cycle or partial export

**Solution**:
1. Check database stats: Settings → Database Statistics
2. Verify export file date matches expected data
3. Re-export from source computer
4. Import again with "Replace" option

### Git Push Rejected (File Too Large)

**Cause**: GitHub has 100 MB file limit

**Solution**:

**Option A: Git LFS**
```bash
git lfs install
git lfs track "public/database/*.json"
git add .gitattributes
git lfs migrate import --include="public/database/*.json"
git push
```

**Option B: Split Export**
```javascript
// Future feature: Export in chunks
// Split activityDetails into multiple files
// marathon-tracker-db-part1.json (200 MB)
// marathon-tracker-db-part2.json (200 MB)
```

### Sync Conflicts

**Cause**: Database exported from two computers, pushed to same file

**Solution**:
```bash
# Keep your local version
git checkout --ours public/database/marathon-tracker-db.json

# Or keep remote version
git checkout --theirs public/database/marathon-tracker-db.json

# Resolve and commit
git add public/database/marathon-tracker-db.json
git commit -m "Resolve database sync conflict"
git push
```

**Prevention**: Use dated filenames:
```bash
# Instead of overwriting same file
public/database/marathon-tracker-db.json

# Use dated exports
public/database/marathon-tracker-db-2026-02-16.json
public/database/marathon-tracker-db-2026-02-23.json
```

## Advanced: Automated Sync

### Option 1: Git Pre-Commit Hook

Auto-export before each commit:

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "Auto-exporting database..."
# Trigger export via browser automation
# (requires additional tooling)
```

### Option 2: Cron Job Export

Schedule automatic exports:

```bash
# Export database every Sunday at 8 PM
0 20 * * 0 /path/to/export-script.sh
```

### Option 3: Cloud Sync (Future)

Planned features:
- Automatic sync to Dropbox/Google Drive
- Background sync on app close
- Conflict resolution UI
- Delta sync (only changed data)

## Comparison with Alternatives

| Method | Setup | Speed | Reliability | Cost |
|--------|-------|-------|-------------|------|
| **Git Sync** (this guide) | ⭐⭐⭐ Medium | ⭐⭐ Moderate | ⭐⭐⭐⭐⭐ Excellent | Free |
| **Re-sync from API** | ⭐⭐⭐⭐⭐ Easy | ⭐ Slow (5-10min) | ⭐⭐⭐⭐ Good | Free |
| **Cloud Sync** (future) | ⭐⭐⭐⭐ Easy | ⭐⭐⭐⭐⭐ Fast | ⭐⭐⭐⭐ Good | $$ |
| **Backend Sync** | ⭐ Complex | ⭐⭐⭐⭐⭐ Fast | ⭐⭐⭐⭐⭐ Excellent | $$$ |

**Recommendation**: Git sync is the best balance of simplicity, cost, and reliability for personal use.

## FAQ

**Q: How often should I export?**
A: Weekly or after important sessions. Not after every workout.

**Q: Can I use this with GitHub/GitLab?**
A: Yes! Works with any git remote. Use Git LFS for files >100 MB.

**Q: What if I forget to export?**
A: Just re-sync from Intervals.icu on the new computer (5-10 minutes).

**Q: Does this backup my API keys?**
A: No, API config is not exported (for security). Re-enter on each computer.

**Q: Can I sync between Mac and Windows?**
A: Yes, JSON export works across all platforms.

**Q: What about mobile?**
A: Mobile browsers don't support file export/import yet. Desktop only.

---

**With multi-computer sync, you can seamlessly work across machines without losing any training data or waiting for API re-syncs!** 🚀
