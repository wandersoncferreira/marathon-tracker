# Getting Started with Marathon Training Tracker

## 🎉 Your App is Ready!

The Marathon Training Tracker is now built and ready to use. Follow these steps to get started.

---

## 1. Start the App

```bash
cd /Users/wferreir/Documents/notes/app
npm run dev
```

Open your browser to: **http://localhost:3000**

---

## 2. Configure Intervals.icu

1. Click the **Settings** icon (⚙️) in the top-right
2. Enter your Intervals.icu credentials:

   **Where to find your credentials:**
   - **API Key**: Go to intervals.icu → Settings → Developer → API Key
   - **Athlete ID**: Look at your profile URL, it's the part like `i12345678`

3. Click **"Save Configuration"** (stored securely in local database)
4. Go to **Training Log** and click **"🔄 Sync from API"**
   - This will fetch **all activities since January 19, 2026** (your cycle start)
   - First sync may take a moment (fetching full training history)
5. Go back to Dashboard - you'll see your training phase and progress!

**Training Cycle Integration:**
Your app is now configured for your complete **20-week training cycle**:
- ✅ **Cycle Start**: January 19, 2026
- ✅ **Race Date**: June 7, 2026 (Porto Alegre Marathon)
- ✅ **Phase-Aware**: Automatically calculates current week and phase
- ✅ **Full History**: All data from cycle start stored locally
- ✅ **Smart Targets**: Weekly MP goals adjust by training phase

See **[TRAINING_CYCLE.md](./TRAINING_CYCLE.md)** for complete details.

---

## 3. Generate Your First Coach Analysis

Use this prompt with Claude to analyze today's training session:

### THE PROMPT

```
You are a professional running coach specializing in sub-2h50 marathon training.

Read the training plan from /Users/wferreir/Documents/notes/notes/20260215141654-weekly_claude_analysis_for_porto_alegre_marathon_2026.org and the coaching directives from /Users/wferreir/Documents/notes/docs/running-coach-directives.md

Analyze my training session from today (2026-02-16, activity ID: i125562353) from Intervals.icu.

Use these MCP tools to fetch the data:
- mcp__Intervals_icu__get_activity_details with activity_id: i125562353
- mcp__Intervals_icu__get_activity_intervals with activity_id: i125562353

Generate a structured JSON report following this schema:

{
  "version": "1.0",
  "metadata": {
    "date": "YYYY-MM-DD",
    "activityId": "activity ID from Intervals.icu",
    "activityName": "activity name",
    "analysisDate": "current timestamp",
    "coach": "Claude-2h50-Marathon"
  },
  "session": {
    "type": "threshold|speed|easy|long_run|marathon_pace",
    "distance": [meters],
    "duration": [seconds],
    "avgPace": "MM:SS/km",
    "avgPower": [watts],
    "avgHR": [bpm],
    "trainingLoad": [number]
  },
  "marathonContext": {
    "goalPace": "4:02/km",
    "goalTime": "2:50:00",
    "weeksToRace": [calculate from June 7, 2026],
    "currentPhase": "determine from week number"
  },
  "analysis": {
    "strengths": [
      "List 3-5 specific strengths with metrics",
      ...
    ],
    "concerns": [
      "List 2-4 areas of concern with context",
      ...
    ],
    "keyFindings": [
      "List 3-5 key insights with data",
      ...
    ]
  },
  "metrics": {
    "kmAtMarathonPace": [km within 4:02/km ± 5s],
    "kmAtThresholdPace": [km at 3:40-3:55/km],
    "kmAtEasyPace": [km slower than 4:45/km],
    "totalKm": [total km]
  },
  "recommendations": {
    "nextSession": {
      "date": "next Monday (threshold day)",
      "type": "session type",
      "workout": "specific workout with paces/power",
      "rationale": "why this workout follows from today"
    },
    "weeklyFocus": [
      "Tuesday: specific workout",
      "Wednesday: specific workout",
      "Saturday: specific workout",
      ...
    ],
    "progressionNotes": "coaching notes on what to focus on"
  },
  "verdict": {
    "rating": "excellent|good|acceptable|poor",
    "summary": "1-2 sentence overall assessment",
    "goalViability": {
      "2h50": "on_track|possible|unlikely",
      "confidence": "high|moderate|low",
      "notes": "explanation"
    }
  }
}

**Critical Requirements:**
- Be specific with numbers - "4:06/km avg" not "good pace"
- Calculate zones accurately from interval data
- Compare to marathon goal (4:02/km) and provide context
- Reference the training plan phases
- Provide actionable recommendations
- Be honest about goal viability

Save the output as a JSON file.
```

---

## 4. Import the Analysis

1. Copy the JSON output from Claude
2. Save it to a file (e.g., `2026-02-16-threshold.json`)
3. In the app, go to **Settings**
4. Click **"Import Analysis JSON"**
5. Select your JSON file
6. Go to **Coach Analysis** tab - your analysis is there!

---

## 5. Explore the App

### 📊 Dashboard
- See your weekly stats (total KM, KM at marathon pace, sessions)
- View latest coach analysis summary
- Check recent activities
- Track weeks to race

### 📝 Training Log
- Browse all your activities from Intervals.icu
- Tap any activity to see detailed metrics
- Refresh to get latest data

### 🏃 Coach Analysis
- View all imported analyses
- Read detailed breakdowns (strengths, concerns, recommendations)
- See next session suggestions
- Track progression notes

### 📈 Progress Tracker
- Visualize KM at marathon pace (weekly progress bars)
- See weekly volume trends
- View training distribution (Easy/Threshold/MP)
- Monitor goal status

---

## Quick Tips

### Mobile First
The app is optimized for mobile devices. Try it on your phone by:
1. Finding your local IP: `ifconfig | grep "inet "`
2. Starting the server with: `npm run dev -- --host`
3. Opening `http://[your-ip]:3000` on your phone

### Training Pace Zones
- **Marathon Pace**: 4:02/km (race pace)
- **Threshold**: 3:40-3:55/km (Monday workouts)
- **Speed**: 3:25-3:40/km (Wednesday workouts)
- **Easy**: 4:45-5:15/km (recovery days)

### Weekly Structure
- **Monday**: Threshold workout (15-19km)
- **Tuesday**: Easy or MP work
- **Wednesday**: Speed/VO2max (12-16km)
- **Thursday**: Easy
- **Friday**: Recovery
- **Saturday**: Long run (22-36km progressive)

---

## Example: Analyzing Today's Session

1. **Start Claude**: "Analyze my threshold session from today (Feb 16, 2026)"

2. **Claude will**:
   - Fetch activity i125562353 from Intervals.icu
   - Analyze the intervals (7x800m @ threshold)
   - Calculate metrics (5.6km at threshold, 0km at MP)
   - Provide specific recommendations

3. **You get**:
   - Detailed analysis with strengths and concerns
   - Next session recommendation (30min continuous threshold)
   - Weekly training focus
   - Goal viability assessment

4. **Import** the JSON into the app to track it!

---

## Sample Analysis

A complete example is already in `/app/data/analyses/2026-02-16-threshold-session.json`

You can import this to see how analyses look in the app.

---

## Troubleshooting

**Activities not loading?**
- Check API key and Athlete ID in Settings
- Try clearing cache and refreshing

**Can't import analysis?**
- Validate JSON at jsonlint.com
- Check all required fields are present
- Ensure date format is YYYY-MM-DD

**App won't start?**
- Run `npm install` again
- Check Node.js is installed: `node --version`

---

## Next Steps

1. ✅ Start the app
2. ✅ Configure Intervals.icu
3. ✅ Generate an analysis for today's session
4. ✅ Import it and explore!

Then continue generating analyses after each key session to track your progress toward the 2h50 goal.

---

**You're all set! Time to track your way to Porto Alegre 2026! 🏃‍♂️💨**

Questions? Check:
- `README_MARATHON_TRACKER.md` - Full documentation
- `COACH_ANALYSIS_PROMPT.md` - Detailed prompt template
- Sample analysis in `/data/analyses/`
