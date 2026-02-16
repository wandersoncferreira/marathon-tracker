# Marathon Training Tracker

A mobile-first web application for tracking marathon training with AI-powered coaching analysis. Built for the **Porto Alegre 2026 Marathon** with a goal of **sub-2h50 (4:02/km pace)**.

![Training Week](https://img.shields.io/badge/Training_Week-4%2F20-blue)
![Phase](https://img.shields.io/badge/Phase-Base_Build-green)
![Tech](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-6-646cff)

## Features

### 📊 Real-Time Training Dashboard
- **Today's Readiness**: Wellness analysis with TSB, HRV, resting HR, and sleep metrics
- **This Week Stats**: Total distance, sessions, KM at marathon pace, training load
- **Latest Coach Analysis**: AI-generated session reviews with adaptive workout guidance
- **Cycle Progress**: Current week, phase, and days to race

### 🏃 Training Data Integration
- **Intervals.icu API**: Automatic sync of activities, wellness, and planned workouts
- **Activity Tracking**: Detailed metrics with intervals, pace zones, and power data
- **Wellness Monitoring**: Daily readiness assessment based on physiological markers
- **Planned Workouts**: Fetch tomorrow's workout with adaptive recommendations

### 🤖 AI Coach Analysis
- **Structured Session Reviews**: Strengths, concerns, key findings, and verdict
- **Performance Metrics**: KM at marathon pace, threshold pace, and easy pace
- **Adaptive Guidance**: Tomorrow's workout modified based on today's performance and readiness
- **Progress Tracking**: Goal viability assessment with confidence levels

### 📈 Progress Visualization
- **Weekly KM at Marathon Pace**: Track actual vs. target across training cycle
- **Training Distribution**: Speed, threshold, MP, tempo, and easy zones
- **Fitness/Fatigue/Form**: CTL/ATL/TSB charts over entire training cycle
- **Phase-Specific Targets**: Automatically adjust based on training phase

### 💾 Offline-First Architecture
- **IndexedDB Storage**: All data stored locally via Dexie.js
- **Activities Cache**: 4,000+ activities with intervals (400+ MB)
- **Wellness History**: Complete physiological data since cycle start
- **Coach Analyses**: Persistent JSON-based analysis storage

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 18, Vite 6, Tailwind CSS 3.4 |
| **Database** | IndexedDB via Dexie.js |
| **API** | Intervals.icu REST API |
| **Charts** | Recharts |
| **Deployment** | GitHub Pages ready |

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Intervals.icu account with API key
- Athlete ID from Intervals.icu

### Installation

```bash
# Clone repository
git clone https://github.com/wandersoncferreira/marathon-tracker.git
cd marathon-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

1. Open http://localhost:5173
2. Go to Settings (⚙️ tab)
3. Enter your **Intervals.icu API Key** (Settings → Developer)
4. Enter your **Athlete ID** (from profile URL: `i12345678`)
5. Click **Save Configuration**

### First Sync

1. Go to **Training Log** (📋 tab)
2. Click **🔄 Sync from API**
3. Wait for sync to complete (fetches all activities since Jan 19, 2026)
4. Database now contains your complete training history

## Training Cycle

**Start Date**: January 19, 2026
**Race Date**: May 31, 2026
**Total Duration**: 20 weeks

### Training Phases

| Phase | Weeks | Dates | Focus | Weekly MP Target |
|-------|-------|-------|-------|-----------------|
| **Base Build** | 1-4 | Jan 19 - Feb 15 | Foundation | 4-8 km |
| **Build** | 5-8 | Feb 16 - Mar 14 | Volume & Intensity | 8-15 km |
| **Peak** | 9-16 | Mar 15 - May 9 | Race-Specific | 15-25 km |
| **Taper** | 17-20 | May 10 - May 31 | Recovery & Sharpening | 3-8 km |

### Pace Zones

| Zone | Pace Range | Purpose | HR Zone |
|------|-----------|---------|---------|
| **Marathon Pace** | 4:02/km ± 6s | Race specific | 88-92% LTHR |
| **Threshold** | 3:40-3:55/km | Lactate clearance | 92-97% LTHR |
| **Speed/VO2max** | 3:25-3:40/km | Max aerobic | 97-100% LTHR |
| **Easy** | 4:45-5:15/km | Recovery/volume | <80% LTHR |
| **Long Run** | 4:25-4:35/km | Endurance | 75-85% LTHR |

### Athlete Metrics

- **LTHR**: 178 bpm
- **FTP**: 360W (running power)
- **Threshold Pace**: 3:45/km (realistic) / 3:30/km (aggressive)
- **Resting HR**: 47 bpm

## Usage

### Generating Coach Analyses

The app includes AI-powered coach analysis with structured JSON schema. See **[docs/COACH_ANALYSIS_PROMPT.md](docs/COACH_ANALYSIS_PROMPT.md)** for the complete prompt template.

**Workflow**:

1. **Fetch today's workout data**:
   ```javascript
   mcp__Intervals_icu__get_activity_details(activity_id="i125562353")
   mcp__Intervals_icu__get_activity_intervals(activity_id="i125562353")
   ```

2. **Fetch today's wellness**:
   ```javascript
   mcp__Intervals_icu__get_wellness_data(start_date="2026-02-16", end_date="2026-02-16")
   ```

3. **Fetch tomorrow's planned workout**:
   ```javascript
   mcp__Intervals_icu__get_events(start_date="2026-02-17", end_date="2026-02-17")
   ```

4. **Generate analysis** using Claude with the standardized prompt

5. **Save analysis**:
   ```bash
   data/analyses/2026-02-16-threshold.json
   ```

The analysis will automatically load in the app and appear in the Dashboard.

### Adaptive Workout Recommendations

The coach analysis includes adaptive guidance for tomorrow's workout based on:

- **Today's Performance**: Training load, HR, pacing consistency
- **Current Readiness**: TSB/Form, resting HR, HRV, sleep quality
- **Planned Workout**: Type and intensity from Intervals.icu

**Example**:
```json
{
  "nextSession": {
    "workout": "Easy 10km @ 4:55-5:05/km - ADAPTATIONS: Execute as planned. Today's moderate load (59 TSS) and current form (TSB -10) allow for standard recovery pace. Keep HR <140 bpm.",
    "rationale": "Standard recovery after quality threshold work. Current fatigue markers support normal easy running."
  }
}
```

### Training Strategy: Doubles for MP Banking

The app supports a **doubles strategy** on easy/recovery days to accumulate marathon pace mileage without excessive fatigue:

- **AM**: Easy recovery run (60-75% of daily volume)
- **PM**: Short marathon pace session (3-5km @ 4:02/km ± 6s)
- **Goal**: Bank extra MP kilometers while maintaining recovery

**Example Weekly Schedule**:
- Tuesday: AM 8km easy + PM 4km @ MP = 12km total
- Thursday: AM 7km easy + PM 3km @ MP = 10km total
- **Result**: 7 extra MP kilometers per week without compromising quality sessions

## Database Structure

The app uses IndexedDB with 5 tables:

| Table | Purpose | Size (Typical) |
|-------|---------|---------------|
| **activities** | Activity summaries | ~4,000 records |
| **activityDetails** | Full activity data with intervals | ~400 MB |
| **wellness** | Daily physiological metrics | ~140 records |
| **analyses** | Coach analysis JSON | ~20 records |
| **cache** | Temporary API response cache | ~10 MB |

⚠️ **Note**: The database is stored in **browser's IndexedDB** (not as files in repository). Coach analyses are backed up in `data/analyses/` and committed to git. See **[Database Backup Guide](docs/DATABASE_BACKUP.md)** for backup/restore procedures.

## Project Structure

```
marathon-tracker/
├── src/
│   ├── components/         # React components
│   │   ├── Dashboard.jsx   # Main dashboard with readiness + stats
│   │   ├── TrainingLog.jsx # Activity list from Intervals.icu
│   │   ├── CoachAnalysis.jsx # AI analysis display
│   │   ├── ProgressTracker.jsx # Charts and metrics
│   │   └── Settings.jsx    # API config + data management
│   ├── hooks/
│   │   ├── useActivities.js # Activity fetching hook
│   │   └── useAnalyses.js  # Analysis loading hook
│   ├── services/
│   │   ├── intervalsApi.js # Intervals.icu API client
│   │   ├── database.js     # IndexedDB via Dexie.js
│   │   └── analysisLoader.js # Coach analysis management
│   ├── utils/
│   │   ├── trainingCalculations.js # MP/threshold/easy calculations
│   │   ├── trainingCycle.js # Cycle phases + targets
│   │   ├── wellnessAnalysis.js # Readiness scoring
│   │   ├── workoutAdaptation.js # Adaptive recommendations
│   │   └── dateHelpers.js  # Date utilities
│   └── main.jsx            # App entry point
├── data/
│   └── analyses/           # Coach analysis JSON files
├── docs/                   # Documentation
│   ├── COACH_ANALYSIS_PROMPT.md # Analysis generation guide
│   ├── GETTING_STARTED.md  # Setup instructions
│   ├── TRAINING_CYCLE.md   # Cycle details
│   ├── DATABASE.md         # Database schema
│   └── ...
├── public/                 # Static assets
├── package.json            # Dependencies
├── vite.config.js          # Vite configuration
└── tailwind.config.js      # Tailwind CSS config
```

## Multi-Computer Sync

Work seamlessly across 3-4 computers without re-fetching data:

1. **Computer A**: Export database to JSON (Settings → Database Sync)
2. **Commit to git**: `git add data/database/*.json && git commit && git push`
3. **Computer B**: Pull from git and import database
4. **Result**: All activities, intervals, and wellness data instantly available

See **[Multi-Computer Sync Guide](docs/MULTI_COMPUTER_SYNC.md)** for complete workflow.

### Why This Matters

Without database sync, switching computers means:
- ❌ Re-fetch 4,000+ activities (~5-10 minutes)
- ❌ Re-download 400 MB of interval data
- ❌ Wait for API rate limiting
- ❌ Lose any local modifications

With git-based sync:
- ✅ One-time export (~30 seconds)
- ✅ Git commit and push
- ✅ Import on new computer (~30 seconds)
- ✅ Complete training history preserved

## Documentation

- **[Getting Started Guide](docs/GETTING_STARTED.md)** - Setup and first sync
- **[Multi-Computer Sync](docs/MULTI_COMPUTER_SYNC.md)** - Sync database across computers ⭐
- **[Coach Analysis Prompt](docs/COACH_ANALYSIS_PROMPT.md)** - AI analysis generation
- **[Training Cycle](docs/TRAINING_CYCLE.md)** - Phase details and targets
- **[Database Architecture](docs/DATABASE.md)** - Schema and storage
- **[Database Backup](docs/DATABASE_BACKUP.md)** - Backup and restore procedures
- **[Cycle Integration](docs/CYCLE_INTEGRATION.md)** - How cycle tracking works
- **[Database Upgrade](docs/DATABASE_UPGRADE.md)** - Schema migration guide

## Development

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Deployment

The app automatically deploys to GitHub Pages via GitHub Actions on every push to `main`.

**Live URL**: https://wandersoncferreira.github.io/marathon-tracker/

### Automatic Deployment

Every push triggers:
1. Build with Vite
2. Deploy to GitHub Pages
3. App live in ~2 minutes

### Database Auto-Import

On first load, the app automatically imports from `public/database/marathon-tracker-db.json` if:
- File exists in repository
- Local IndexedDB is empty

See **[Deployment Guide](docs/DEPLOYMENT.md)** for complete setup instructions.

## API Rate Limiting

The app implements intelligent rate limiting for Intervals.icu:

- **Batch Processing**: 5 concurrent requests max with 300ms delay
- **Exponential Backoff**: Automatic retry on 429 errors (1s, 2s, 3s)
- **Database Caching**: Load from IndexedDB first, only fetch missing from API
- **Smart Sync**: Only sync data that doesn't exist locally

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 14+)
- Mobile: ✅ Optimized for mobile (touch-friendly, responsive)

## Contributing

This is a personal training tracker, but improvements are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/improvement`)
5. Open a Pull Request

## License

MIT License - feel free to use this for your own marathon training!

## Acknowledgments

- **Intervals.icu** for the excellent training platform and API
- **Claude Opus 4.6** for AI-powered coaching analysis
- **Recharts** for beautiful data visualization
- **Dexie.js** for elegant IndexedDB wrapper

---

**Built with ❤️ for the Porto Alegre 2026 Marathon**

Target: **2:50:00** (4:02/km) 🏃‍♂️💨

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
