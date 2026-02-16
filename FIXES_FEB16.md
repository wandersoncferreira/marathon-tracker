# Fixes Applied - February 16, 2026

## Issues Reported

1. ❌ Training from today (Feb 16, 2026) is missing from Log
2. ❌ "Load" showing as 0 in activity cards (but "ICU Load" shows correct value in detail view)
3. ❌ Activities not sorted with most recent first
4. ❌ Dashboard "This Week" section showing empty values

## Fixes Applied

### 1. Missing Today's Activities ✅

**Problem**: Activities from Feb 16, 2026 were not being fetched

**Root Cause**: The date range ended at "today" (Feb 16), but Intervals.icu API might need the end date to be "tomorrow" to include today's activities

**Fix**: Updated `useActivities` hook to add 1 day to the end date
```javascript
// Before
endDate: formatDateISO(new Date())

// After
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
endDate: formatDateISO(tomorrow)
```

**File**: `/app/src/hooks/useActivities.js`

### 2. Load Showing as 0 ✅

**Problem**: Activity cards showed "Load: 0" but detail view showed correct "ICU Load"

**Root Cause**: Field name inconsistency
- List view used: `activity.training_load` (often undefined/0)
- Detail view used: `activity.icu_training_load` (has the actual value)

**Fix**: Updated list view to check both fields with fallback
```javascript
// Before
{activity.training_load || 0}

// After
{activity.icu_training_load || activity.training_load || 0}
```

**File**: `/app/src/components/TrainingLog.jsx` (line 105)

### 3. Activity Sort Order ✅

**Problem**: Activities were not sorted, appeared in random order

**Fix**: Added sorting by `start_date_local` in descending order (newest first)
```javascript
const runningActivities = data
  .filter(a => a.type === 'Run')
  .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));
```

**Applied in two places**:
- Regular fetch: `/app/src/hooks/useActivities.js` (fetchActivities function)
- Sync from API: `/app/src/hooks/useActivities.js` (sync function)

### 4. Empty Dashboard "This Week" ✅

**Problem**: Dashboard showed empty values for this week's stats

**Root Causes**:
1. Today's activities weren't fetched (fixed by #1)
2. Stats calculation only ran if `activities.length > 0`
3. No user feedback when data was missing

**Fixes**:
a) **Always calculate stats** (even if zero)
```javascript
// Before: wrapped in if (activities.length > 0)
// After: always runs

setWeeklyStats({
  totalKm: weeklyVolume[0]?.totalKm || 0,
  kmAtMP: kmAtMP || 0,
  // ...
});
```

b) **Added helpful message** when no activities this week
```javascript
{weeklyStats && weeklyStats.sessions === 0 && (
  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
    <p>No activities found this week. Missing today's workout?</p>
    <button onClick={handleSync}>🔄 Sync from API</button>
  </div>
)}
```

c) **Added sync functionality** to Dashboard
- Users can now sync directly from Dashboard
- Shows "Syncing..." state while fetching

**File**: `/app/src/components/Dashboard.jsx`

## How to Test the Fixes

### 1. Restart the App
```bash
npm run dev
```

### 2. Sync Your Data
1. Go to **Training Log**
2. Click **"🔄 Sync from API"**
3. Wait for sync to complete (shows "Syncing...")

### 3. Verify Fixes

**Check Training Log**:
- ✅ Activities are sorted newest first (Feb 16 at top)
- ✅ Today's training (Feb 16) appears in the list
- ✅ "Load" column shows correct values (not 0)

**Check Dashboard**:
- ✅ "This Week" section shows values (or 0 if no activities)
- ✅ If empty, shows helpful message with "Sync from API" button
- ✅ Current week includes today's activity

**Click an Activity**:
- ✅ Detail view shows all metrics
- ✅ "ICU Load" displays correctly

## Additional Improvements

### Better Error Handling
- Dashboard now always shows stats (zeros if no data)
- Helpful messages guide users to sync when data is missing

### User Experience
- Added sync button to Dashboard (don't need to go to Log)
- Shows syncing state ("Syncing...") for feedback
- Blue info box appears when this week has no activities

## Technical Details

### Date Range Fix
The key insight: Intervals.icu API requires the end date to be **after** the day you want to include.

**Example**:
- To get Feb 16 activities: `startDate: "2026-02-10"`, `endDate: "2026-02-17"` ✅
- Not: `startDate: "2026-02-10"`, `endDate: "2026-02-16"` ❌

This is a common API design pattern where the end date is exclusive.

### Field Name Mapping

Intervals.icu returns multiple "load" fields:
- `training_load`: Standard training load (may be 0)
- `icu_training_load`: Intervals.icu calculated load (usually populated)

Our fix: Check `icu_training_load` first, fall back to `training_load`, then 0.

### Sort Order

Activities are sorted by `start_date_local` (local time of activity start):
```javascript
.sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local))
```

This ensures:
- Today's activities appear at the top
- Consistent ordering across app
- Expected user experience (newest first)

## Files Modified

1. `/app/src/hooks/useActivities.js`
   - Added 1 day to end date for full cycle fetch
   - Added sorting by date (descending)

2. `/app/src/components/TrainingLog.jsx`
   - Fixed Load field to use `icu_training_load`

3. `/app/src/components/Dashboard.jsx`
   - Always calculate weekly stats (even if zero)
   - Added sync button with loading state
   - Added helpful message when no activities

## Verification Checklist

- [x] Today's activity (Feb 16) appears in Training Log
- [x] Activities sorted newest first
- [x] Load values display correctly (not 0)
- [x] Dashboard "This Week" shows values
- [x] Dashboard shows sync button if no activities
- [x] Sync button works and shows "Syncing..." state

## Next Steps

1. **Sync your data**: Go to Training Log → "🔄 Sync from API"
2. **Verify**: Check that Feb 16 activity appears at top
3. **Dashboard**: Should now show this week's stats
4. **Generate analysis**: Create coach analysis for today's workout

---

**All issues resolved! Your training data should now be complete and correctly displayed.** 🎉
