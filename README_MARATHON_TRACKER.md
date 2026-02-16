# Marathon Training Tracker

A mobile-first web application for tracking your journey to a sub-2h50 marathon. Built for the Porto Alegre Marathon 2026.

## Features

- 📊 **Dashboard**: Overview of weekly training metrics and progress
- 📝 **Training Log**: View all activities from Intervals.icu with detailed metrics
- 🏃 **Coach Analysis**: Import and view AI-generated training analyses
- 📈 **Progress Tracker**: Visualize KM at marathon pace and training distribution
- ⚙️ **Settings**: Configure Intervals.icu API and manage data

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 3. Configure Intervals.icu

1. Click the Settings icon (⚙️) in the header
2. Enter your Intervals.icu API credentials:
   - **API Key**: Get from intervals.icu → Settings → Developer
   - **Athlete ID**: Found in your profile URL (e.g., `i12345678`)
3. Click "Save Configuration"

### 4. Import Coach Analysis

1. Generate a training analysis using the prompt template (see `COACH_ANALYSIS_PROMPT.md`)
2. Save the JSON output to a file
3. Go to Settings → Import Analysis JSON
4. Select your JSON file

## Project Structure

```
app/
├── src/
│   ├── components/        # React components
│   │   ├── Dashboard.jsx        # Main dashboard
│   │   ├── TrainingLog.jsx      # Activity list
│   │   ├── CoachAnalysis.jsx    # Analysis viewer
│   │   ├── ProgressTracker.jsx  # Progress visualization
│   │   └── Settings.jsx         # Configuration
│   ├── services/          # API clients
│   │   ├── intervalsApi.js      # Intervals.icu integration
│   │   └── analysisLoader.js    # Coach analysis loader
│   ├── utils/             # Utility functions
│   │   ├── trainingCalculations.js
│   │   └── dateHelpers.js
│   ├── hooks/             # Custom React hooks
│   │   ├── useActivities.js
│   │   └── useAnalyses.js
│   └── App.jsx            # Root component
├── data/
│   └── analyses/          # Coach analysis JSON files
└── public/                # Static assets
```

## Technology Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (mobile-first)
- **Data Source**: Intervals.icu API
- **Database**: IndexedDB via Dexie.js (persistent local storage)
- **Storage**:
  - Training data: IndexedDB (unlimited, indexed, structured)
  - Coach analyses: JSON files (import/export)
- **Deployment**: GitHub Pages compatible

## Coach Analysis Format

See `COACH_ANALYSIS_PROMPT.md` for the complete prompt template and JSON schema.

### Quick Example

```json
{
  "version": "1.0",
  "metadata": {
    "date": "2026-02-16",
    "activityId": "i125562353",
    "activityName": "Forte x Fraco",
    "coach": "Claude-2h50-Marathon"
  },
  "session": {
    "type": "threshold",
    "distance": 11028,
    "avgPace": "4:26/km",
    "avgPower": 304,
    "trainingLoad": 59
  },
  "analysis": {
    "strengths": [...],
    "concerns": [...],
    "keyFindings": [...]
  },
  "recommendations": {
    "nextSession": {...},
    "weeklyFocus": [...]
  }
}
```

## Local Database

The app uses **IndexedDB** (via Dexie.js) for persistent local storage:

- ✅ **Unlimited storage**: Store hundreds of activities offline
- ✅ **Fast queries**: Indexed searches by date, type, etc.
- ✅ **Offline-first**: Works without internet after initial sync
- ✅ **Persistent**: Data survives page refresh and browser close
- 📁 **Coach analyses**: Remain as JSON files for easy backup

**See [DATABASE.md](./DATABASE.md) for complete documentation.**

### Data Sync

- **Activities**: Automatically stored in database when fetched from API
- **Sync Button**: Force refresh from Intervals.icu API
- **Cache**: Temporary cache (5 min) for repeated requests
- **Clear Data**: Settings → Clear All Training Data (preserves config)

## Key Metrics

### Marathon Goal
- **Target Time**: 2:50:00
- **Target Pace**: 4:02/km
- **Race Date**: June 7, 2026
- **Weekly MP Target**: 15-20 km at marathon pace

### Training Zones
- **Marathon Pace**: 4:02/km ± 5s
- **Threshold**: 3:40-3:55/km
- **Speed**: 3:25-3:40/km
- **Easy**: 4:45-5:15/km

## Development

### Build for Production

```bash
npm run build
```

Output will be in `/dist` directory.

### Deploy to GitHub Pages

1. Update `base` path in `vite.config.js` if using a subfolder
2. Build the project: `npm run build`
3. Deploy the `/dist` directory to GitHub Pages

Or use the existing workflow:

```yaml
# Add to .github/workflows/publish.yml
- name: Build Marathon Tracker
  working-directory: ./app
  run: |
    npm install
    npm run build

- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./app/dist
```

## Usage Tips

### Generating Coach Analyses

1. Use Claude with Intervals.icu MCP tools to fetch your activity data
2. Use the prompt from `COACH_ANALYSIS_PROMPT.md`
3. Save the JSON output
4. Import via Settings in the app

### Tracking Progress

The app automatically calculates:
- **KM at Marathon Pace**: Activities/intervals within 4:02/km ± 5s
- **Weekly Volume**: Total distance by week
- **Training Distribution**: Easy vs. Threshold vs. MP
- **Training Load**: Weekly training stress

### Mobile-First Design

The app is optimized for mobile devices:
- Bottom navigation for easy thumb access
- Touch-friendly tap targets (44px minimum)
- Swipeable cards
- Responsive layouts for all screen sizes

## Troubleshooting

### Activities not loading

1. Check Intervals.icu API configuration in Settings
2. Verify your API key has the correct format
3. Check browser console for error messages
4. Clear API cache in Settings and retry

### Coach analyses not showing

1. Verify JSON format is valid (use jsonlint.com)
2. Check all required fields are present
3. Ensure date format is YYYY-MM-DD
4. Try importing the sample file from `/data/analyses/`

### Performance issues

1. Clear API cache in Settings
2. Clear browser localStorage
3. Reduce date range for activities (default is 90 days)

## Contributing

This is a personal training tracker. Feel free to fork and adapt for your own goals.

## License

MIT License - feel free to use and modify for your training needs.

## Acknowledgments

- **Intervals.icu**: Excellent training platform and API
- **Claude AI**: Coach analysis generation
- **Vite + React**: Fast, modern web development
- **Tailwind CSS**: Beautiful, mobile-first styling

---

**Good luck with your 2h50 marathon goal! 🏃‍♂️💨**
