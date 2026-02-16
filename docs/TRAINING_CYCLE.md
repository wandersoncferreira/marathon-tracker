# Training Cycle Configuration

Your Marathon Training Tracker is now configured to track your complete training cycle for the Porto Alegre 2026 Marathon.

## Cycle Overview

**Start Date**: January 19, 2026
**Race Date**: June 7, 2026 (Porto Alegre Marathon)
**Total Duration**: 20 weeks
**Goal**: 2:50:00 (4:02/km pace)

## Training Phases

The cycle is divided into 4 distinct phases based on your training plan:

### Phase 1: Base Build (Weeks 1-4)
**Duration**: Jan 19 - Feb 15, 2026
**Focus**: Building aerobic base and foundation
- Threshold pace: 3:50-3:55/km
- Weekly MP target: 4-8 km
- Emphasis on easy volume and consistency

### Phase 2: Build (Weeks 5-8)
**Duration**: Feb 16 - Mar 14, 2026
**Focus**: Increasing intensity and volume
- Threshold pace: 3:45-3:50/km
- Weekly MP target: 8-15 km
- Introduction of longer threshold efforts

### Phase 3: Peak (Weeks 9-16)
**Duration**: Mar 15 - May 9, 2026
**Focus**: Peak fitness and race-specific work
- Threshold pace: 3:40-3:45/km (can touch 3:30/km)
- Weekly MP target: 15-25 km
- Long runs with significant MP finish portions

### Phase 4: Taper (Weeks 17-20)
**Duration**: May 10 - June 7, 2026
**Focus**: Recovery and sharpening
- Threshold pace: 3:45-3:50/km (maintenance)
- Weekly MP target: 3-8 km
- Reduced volume, maintaining intensity

## What This Means for the App

### 1. Data Sync from Cycle Start
The app now fetches activities starting from **January 19, 2026** instead of just the last 30-90 days. This ensures:
- Complete training history is captured
- Phase calculations are accurate
- Progress tracking reflects the full cycle

### 2. Accurate Phase Display
The app automatically calculates:
- **Current training week** (1-20)
- **Current phase** (Base Build, Build, Peak, Taper)
- **Week within phase** (e.g., Week 2 of Peak)
- **Weeks/days to race**

### 3. Phase-Specific Targets
Weekly MP (marathon pace) targets adjust by phase:
- **Base**: 6 km/week target
- **Build**: 12 km/week target
- **Peak**: 20 km/week target
- **Taper**: 5 km/week target

### 4. Progress Tracking
The app tracks:
- Cumulative KM at marathon pace vs. expected total
- Phase-specific performance
- Overall cycle progress (%)

## Dashboard View

You'll see in your Dashboard:

```
┌─────────────────────────────────────────┐
│ Porto Alegre 2026                       │
│ Goal: 2h50min (4:02/km)                 │
│                                         │
│ Training Week: 5/20                     │
│ Phase: Build                            │
│                                         │
│ 15 weeks to race | 105 days             │
│ [████████░░░░░░░░░░] 25%                │
└─────────────────────────────────────────┘
```

## Example Calculations

### Today: February 16, 2026

**Calculation**:
- Days since start: (Feb 16 - Jan 19) = 28 days
- Current week: 28 ÷ 7 = 4 weeks → **Week 5** (rounded up)
- Phase: Week 5 → **Build phase** (weeks 5-8)
- Weeks to race: (Jun 7 - Feb 16) ÷ 7 = **16 weeks**
- Days to race: **112 days**
- Cycle progress: 5/20 = **25%**

### Week 10: March 23, 2026

**Calculation**:
- Current week: **Week 10**
- Phase: **Peak phase** (weeks 9-16)
- Week in phase: Week 2 of 8
- Threshold pace: 3:40-3:45/km
- Weekly MP target: 20 km
- Weeks to race: **11 weeks**

## Coach Analysis Integration

When generating coach analyses, the app provides:

```json
{
  "marathonContext": {
    "goalPace": "4:02/km",
    "goalTime": "2:50:00",
    "weeksToRace": 16,
    "currentPhase": "Build (Week 5 of 20)"
  }
}
```

This ensures Claude understands exactly where you are in the training cycle and provides phase-appropriate recommendations.

## Settings Display

In Settings, you'll see the complete cycle information:

- **Cycle Start**: 2026-01-19
- **Race Date**: 2026-06-07
- **Total Weeks**: 20 weeks
- **Goal**: 2:50:00 (4:02/km)
- **Training Phases**: Full breakdown

## Fetching Historical Data

### On First Sync

When you first click "Sync from API":
1. App fetches **all activities since Jan 19, 2026**
2. Stores them in local database
3. Calculates statistics across full cycle
4. Displays phase-appropriate metrics

### Subsequent Syncs

After initial sync:
1. Database already has historical data
2. Sync only fetches new activities
3. Fast loading from local database
4. Full cycle context always available

## Progress Tracker View

The Progress Tracker now shows:

**Cycle Statistics**:
- Cycle start/race dates
- Current week and phase
- Weeks to race
- Cycle progress percentage

**Cumulative Metrics**:
- Total KM at marathon pace (entire cycle)
- Expected vs. actual based on phase targets
- Phase-specific performance indicators

**Weekly Breakdown**:
- Last 8 weeks of training
- Volume, load, and pace distribution
- Phase-specific targets highlighted

## Updating the Cycle

### If You Need to Change Dates

The cycle configuration is in:
```
/app/src/utils/trainingCycle.js
```

You can modify:
- `startDate`: Cycle start (currently Jan 19, 2026)
- `raceDate`: Race date (currently Jun 7, 2026)
- `totalWeeks`: Cycle length (currently 20)
- Phase boundaries and descriptions

After changing, refresh the app to see updated calculations.

## Benefits of Full Cycle Tracking

1. **Accurate Context**: Coach analyses reference correct training phase
2. **Complete History**: All training data since cycle start
3. **Phase-Specific Targets**: MP targets adjust automatically
4. **Progress Visibility**: See how far you've come
5. **Goal Assessment**: Realistic viability based on full cycle performance

## Important Notes

### Data Sync

- **First time**: May take a moment to fetch all activities since Jan 19
- **Subsequent**: Fast loading from local database
- **Manual sync**: Click "Sync from API" to update with latest workouts

### Phase Transitions

Phase boundaries are fixed to the calendar:
- You're automatically in the correct phase based on today's date
- No manual phase switching needed
- Coach recommendations adapt to current phase

### MP Target Progression

Weekly marathon pace targets increase through the cycle:
- Start conservative (6 km/week in base)
- Build to peak (20 km/week)
- Taper down (5 km/week)
- App shows current target for your phase

## Verification

To verify the cycle is configured correctly:

1. **Check Dashboard**: Should show current week (e.g., Week 5/20)
2. **Check Phase**: Should match calendar (Feb 16 = Build phase)
3. **Check Settings**: Shows Jan 19 start, Jun 7 race
4. **Check Progress Tracker**: Shows cycle progress percentage

---

**Your training cycle is now fully integrated! The app tracks your complete journey from January 19 to race day on June 7. Every metric, analysis, and recommendation is phase-aware and contextually appropriate.** 🏃‍♂️💨
