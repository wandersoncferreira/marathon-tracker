# ✅ Training Cycle Integration Complete!

Your Marathon Training Tracker is now configured to track your complete **20-week training cycle** for the Porto Alegre 2026 Marathon, starting from **January 19, 2026**.

## What Changed

### 1. Cycle Start Date: January 19, 2026
- All data fetching now starts from this date
- Complete training history captured
- Phase calculations based on weeks since cycle start

### 2. Training Phases (4 phases, 20 weeks total)

**Phase 1: Base Build (Weeks 1-4)**
- Dates: Jan 19 - Feb 15, 2026
- Threshold pace: 3:50-3:55/km
- Weekly MP target: 4-8 km

**Phase 2: Build (Weeks 5-8)**
- Dates: Feb 16 - Mar 14, 2026
- Threshold pace: 3:45-3:50/km
- Weekly MP target: 8-15 km

**Phase 3: Peak (Weeks 9-16)**
- Dates: Mar 15 - May 9, 2026
- Threshold pace: 3:40-3:45/km
- Weekly MP target: 15-25 km

**Phase 4: Taper (Weeks 17-20)**
- Dates: May 10 - Jun 7, 2026
- Threshold pace: 3:45-3:50/km
- Weekly MP target: 3-8 km

### 3. Dashboard Updates

**Old Display**:
```
Weeks to Race: 16
Phase: Peak (generic calculation)
```

**New Display**:
```
Training Week: 5/20
Phase: Build
15 weeks to race | 105 days
[████████░░░░░░░░░░] 25% cycle progress
```

### 4. Progress Tracking

**Cumulative Metrics**:
- Total KM at Marathon Pace across full cycle
- Expected vs. actual based on phase-specific targets
- Example: If you're in Week 5, expected total MP = 6+6+6+6+12 = 36 km

**Phase-Specific Targets**:
- Dashboard shows current phase's weekly MP target
- Week 1-4: 6 km/week target
- Week 5-8: 12 km/week target
- Week 9-16: 20 km/week target
- Week 17-20: 5 km/week target

### 5. Settings Display

Shows complete cycle information:
- Cycle start: 2026-01-19
- Race date: 2026-06-07
- Total weeks: 20
- Training phases breakdown

### 6. Coach Analysis Context

Generated analyses now include accurate phase information:

```json
{
  "marathonContext": {
    "weeksToRace": 16,
    "currentPhase": "Build (Week 5 of 20)"
  }
}
```

## How to Use

### First Time Setup

1. **Start the app**:
   ```bash
   cd /Users/wferreir/Documents/notes/app
   npm run dev
   ```

2. **Configure API** (Settings):
   - Enter your Intervals.icu API Key
   - Enter your Athlete ID
   - Click "Save Configuration"

3. **Sync Full Cycle** (Training Log):
   - Click **"🔄 Sync from API"**
   - This fetches **all activities since Jan 19, 2026**
   - Wait for sync to complete
   - Database now has your full training history

4. **View Dashboard**:
   - See your current training week (e.g., Week 5/20)
   - See your current phase (e.g., Build)
   - See weeks/days to race
   - See cycle progress percentage

### Daily Usage

1. **After each workout**:
   - Click "Sync from API" in Training Log
   - New activity added to database
   - Statistics update automatically

2. **Generate coach analysis**:
   - Use the updated prompt template
   - Import JSON into app
   - Analysis shows correct phase context

3. **Monitor progress**:
   - Dashboard shows this week's stats
   - Progress Tracker shows full cycle metrics
   - Phase-specific targets displayed

## Example: Today (February 16, 2026)

### Current Status
- **Training Week**: 5 of 20
- **Phase**: Build (Week 1 of 4 in this phase)
- **Weeks to Race**: 16 weeks
- **Days to Race**: 112 days
- **Cycle Progress**: 25%

### This Week's Target
- **Weekly MP Goal**: 12 km (Build phase target)
- **Range**: 8-15 km acceptable
- **Threshold Pace**: 3:45-3:50/km

### Expected Cumulative (Weeks 1-5)
- **Total MP Expected**: 6+6+6+6+12 = 36 km
- **Your Actual**: [Shows in Progress Tracker]
- **On Track?**: Green if actual ≥ 80% of expected

## Files Modified

### New Files Created
- `/app/src/utils/trainingCycle.js` - Cycle configuration and calculations
- `/app/TRAINING_CYCLE.md` - Complete cycle documentation
- `/app/CYCLE_INTEGRATION.md` - This file

### Files Updated
- `/app/src/hooks/useActivities.js` - Fetch from cycle start
- `/app/src/components/Dashboard.jsx` - Display cycle stats
- `/app/src/components/ProgressTracker.jsx` - Full cycle progress
- `/app/src/components/Settings.jsx` - Show cycle config
- `/app/COACH_ANALYSIS_PROMPT.md` - Updated with cycle info
- `/app/GETTING_STARTED.md` - Setup instructions

## Verification

### Check Everything Works

1. **Dashboard**:
   - Shows "Training Week: X/20"
   - Shows current phase (Base Build, Build, Peak, or Taper)
   - Shows weeks/days to race
   - Shows cycle progress bar

2. **Progress Tracker**:
   - Shows "Week X/20 - [Phase]" subtitle
   - Shows cycle start/race dates
   - Shows cumulative MP with expected target
   - Shows cycle progress percentage

3. **Settings**:
   - Shows cycle start: 2026-01-19
   - Shows race date: 2026-06-07
   - Shows training phases breakdown

4. **Training Log**:
   - Sync button works
   - Fetches activities from Jan 19, 2026
   - Stores in database

### Test Phase Calculations

**February 16, 2026** (Today):
- ✅ Should show Week 5/20
- ✅ Should show "Build" phase
- ✅ Should show 16 weeks to race
- ✅ Should show 25% cycle progress
- ✅ Weekly MP target: 8-15 km (Build phase)

**January 20, 2026** (Cycle start + 1 day):
- Should show Week 1/20
- Should show "Base Build" phase
- Should show 20 weeks to race
- Weekly MP target: 4-8 km

**May 15, 2026** (During taper):
- Should show Week 18/20
- Should show "Taper" phase
- Should show 3 weeks to race
- Weekly MP target: 3-8 km

## Benefits

### For You

1. **Complete Context**: Every metric references your actual training cycle
2. **Accurate Phases**: No more generic "you're X weeks out" - you know exactly which week and phase
3. **Smart Targets**: MP targets increase/decrease with your training phase
4. **Full History**: All data since cycle start in one place
5. **Progress Clarity**: See exactly how far you've come (25% complete, etc.)

### For Coach Analyses

1. **Precise Recommendations**: Claude knows you're in Build week 1, not just "week 5"
2. **Phase-Appropriate Advice**: Threshold paces match your current phase
3. **Context-Aware**: "You're building toward peak" vs. "You're in base phase"
4. **Target Alignment**: Weekly goals match training plan phases

## Updated Prompt Template

When generating coach analyses, use:

```
Training Cycle Context:
- Cycle Start: January 19, 2026
- Current Week: [auto-calculated]
- Current Phase: [auto-calculated]
- Weeks to Race: [auto-calculated]

The app will automatically provide:
- Current training week (1-20)
- Current phase (Base Build, Build, Peak, Taper)
- Phase-specific threshold paces
- Phase-specific MP targets
```

## Troubleshooting

### Activities Not Loading Full History

**Problem**: Only seeing recent activities, not full cycle

**Solution**:
1. Go to Training Log
2. Click "🔄 Sync from API"
3. Wait for sync to complete
4. Check Progress Tracker → shows cycle start data

### Wrong Training Week Displayed

**Problem**: Shows Week 1 when you're in Week 5

**Solution**:
1. Check system date is correct
2. Verify cycle start in Settings (should be 2026-01-19)
3. Refresh browser (Cmd/Ctrl + R)

### Phase Not Matching Expected

**Problem**: Shows "Base Build" when you should be in "Build"

**Solution**:
- Verify today's date
- Feb 16, 2026 = Week 5 = Build phase ✓
- Jan 19-Feb 15 = Weeks 1-4 = Base Build
- Feb 16 onward = Week 5+ = Build

## Documentation

- **[TRAINING_CYCLE.md](./TRAINING_CYCLE.md)** - Complete cycle documentation
- **[COACH_ANALYSIS_PROMPT.md](./COACH_ANALYSIS_PROMPT.md)** - Updated prompt template
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Setup guide
- **[DATABASE.md](./DATABASE.md)** - Database architecture

---

**Your training cycle is now fully integrated! The app tracks your complete 20-week journey from January 19 to race day on June 7, 2026. Every metric, analysis, and recommendation is phase-aware and contextually appropriate.** 🏃‍♂️💨

Start the app and sync your full training history!

```bash
npm run dev
```

Then go to Training Log → "🔄 Sync from API" to fetch all activities since January 19, 2026.
