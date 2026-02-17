#!/usr/bin/env node

/**
 * Generate Coach Analysis for Today's Training
 * Fetches data from Intervals.icu API and generates analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load database to get API config
const dbPath = path.join(__dirname, 'public/database/marathon-tracker-db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Get API config from IndexedDB backup or prompt user
const API_KEY = process.env.INTERVALS_API_KEY || '';
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID || 'i342272';

if (!API_KEY) {
  console.error('❌ Please set INTERVALS_API_KEY environment variable');
  console.error('   Example: export INTERVALS_API_KEY="your_api_key_here"');
  process.exit(1);
}

const API_BASE = 'https://intervals.icu/api/v1';
const AUTH_HEADER = `Basic ${Buffer.from(`API_KEY:${API_KEY}`).toString('base64')}`;

// Helper to make API requests
async function fetchFromAPI(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`🔄 Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': AUTH_HEADER,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Calculate weeks since training start
function calculateWeeks(startDate, currentDate) {
  const start = new Date(startDate);
  const current = new Date(currentDate);
  const diffMs = current - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7);
}

// Format pace from m/s to MM:SS/km
function formatPace(metersPerSecond) {
  const secondsPerKm = 1000 / metersPerSecond;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function generateAnalysis() {
  try {
    const targetDate = '2026-02-17';
    const tomorrowDate = '2026-02-18';

    console.log(`\n🏃 Generating coach analysis for ${targetDate}\n`);

    // 1. Fetch today's activities
    console.log('📥 Step 1: Fetching today\'s activities...');
    const activities = await fetchFromAPI(`/athlete/${ATHLETE_ID}/activities?oldest=${targetDate}&newest=${targetDate}`);

    const runningActivities = activities.filter(a => a.type === 'Run');

    if (runningActivities.length === 0) {
      console.error(`❌ No running activities found for ${targetDate}`);
      process.exit(1);
    }

    console.log(`✅ Found ${runningActivities.length} running activity(ies)`);
    const activity = runningActivities[0]; // Use first/main activity
    console.log(`   Activity: ${activity.name} (ID: ${activity.id})`);

    // 2. Fetch activity intervals
    console.log('\n📥 Step 2: Fetching activity intervals...');
    const intervals = await fetchFromAPI(`/activity/${activity.id}/intervals`);
    console.log(`✅ Found ${intervals?.icu_intervals?.length || 0} intervals`);

    // 3. Fetch today's wellness
    console.log('\n📥 Step 3: Fetching wellness data...');
    const wellnessStart = '2026-02-10'; // Last 7 days for baseline
    const wellness = await fetchFromAPI(`/athlete/${ATHLETE_ID}/wellness?oldest=${wellnessStart}&newest=${targetDate}`);
    const todayWellness = wellness.find(w => w.id === targetDate);
    console.log(`✅ Wellness data:`, todayWellness ? 'Found' : 'Not found');

    // 4. Fetch tomorrow's planned workouts
    console.log('\n📥 Step 4: Fetching tomorrow\'s planned workouts...');
    const events = await fetchFromAPI(`/athlete/${ATHLETE_ID}/events?oldest=${tomorrowDate}&newest=${tomorrowDate}`);
    const tomorrowWorkouts = events.filter(e => e.category === 'WORKOUT' || !e.category);
    console.log(`✅ Found ${tomorrowWorkouts.length} planned workout(s) for tomorrow`);

    // 5. Calculate training context
    const trainingStart = '2026-01-19';
    const currentWeek = calculateWeeks(trainingStart, targetDate);
    const weeksToRace = calculateWeeks(targetDate, '2026-05-31');

    let phase = 'Base Build';
    if (currentWeek >= 5 && currentWeek <= 8) phase = 'Build';
    else if (currentWeek >= 9 && currentWeek <= 16) phase = 'Peak';
    else if (currentWeek >= 17) phase = 'Taper';

    console.log(`\n📊 Training Context:`);
    console.log(`   Current Week: ${currentWeek}/20`);
    console.log(`   Phase: ${phase}`);
    console.log(`   Weeks to Race: ${weeksToRace}`);

    // 6. Generate the analysis structure
    console.log(`\n🤖 Generating analysis with Claude...`);
    console.log(`\n⚠️  Manual step required:`);
    console.log(`    Please use Claude (claude.ai or API) with the following prompt:\n`);

    // Build the prompt sections
    let intervalsSection = '';
    if (intervals?.icu_intervals) {
      intervalsSection = `\n**Intervals:** ${intervals.icu_intervals.length} intervals found\n`;
      intervalsSection += intervals.icu_intervals.slice(0, 5).map(i =>
        `  - ${i.type}: ${(i.distance / 1000).toFixed(2)}km @ ${formatPace(i.average_speed)} /km, HR: ${i.average_heartrate || 'N/A'}`
      ).join('\n');
      if (intervals.icu_intervals.length > 5) {
        intervalsSection += `\n  ... and ${intervals.icu_intervals.length - 5} more intervals`;
      }
    }

    let wellnessSection = '';
    if (todayWellness) {
      const tsb = todayWellness.ctl ? (todayWellness.ctl - (todayWellness.atl || 0)).toFixed(1) : 'N/A';
      const sleepHours = todayWellness.sleepSecs ? (todayWellness.sleepSecs / 3600).toFixed(1) : 'N/A';
      wellnessSection = `\n**Today's Wellness:**
- TSB (Form): ${tsb}
- CTL (Fitness): ${todayWellness.ctl || 'N/A'}
- ATL (Fatigue): ${todayWellness.atl || 'N/A'}
- Resting HR: ${todayWellness.restingHR || 'N/A'} bpm
- HRV: ${todayWellness.hrv || 'N/A'} ms
- Sleep: ${sleepHours} hours
- Sleep Quality: ${todayWellness.sleepQuality || 'N/A'}/5
- Weight: ${todayWellness.weight || 'N/A'} kg`;
    } else {
      wellnessSection = '\n**Today\'s Wellness:** No data available';
    }

    let workoutsSection = '';
    if (tomorrowWorkouts.length > 0) {
      workoutsSection = '\n**Tomorrow\'s Planned Workouts:**\n';
      workoutsSection += tomorrowWorkouts.map((w, i) => {
        const timeOfDay = w.start_date_local && new Date(w.start_date_local).getHours() < 12 ? 'AM' : 'PM';
        return `${i + 1}. ${timeOfDay} - ${w.name || 'Workout'}: ${w.description || 'No description'}`;
      }).join('\n');
    } else {
      workoutsSection = '\n**Tomorrow\'s Planned Workouts:** No workouts scheduled';
    }

    // Print the prompt for the user to copy
    console.log('---START PROMPT---');
    console.log(`You are a professional running coach specializing in sub-2h50 marathon training.

Analyze the following training session and generate a structured JSON report following the schema in docs/COACH_ANALYSIS_PROMPT.md.

**IMPORTANT: Generate bilingual content in both English (en_US) and Portuguese (pt_BR).**

**Activity Data:**
- Date: ${targetDate}
- Activity ID: ${activity.id}
- Activity Name: ${activity.name}
- Distance: ${(activity.distance / 1000).toFixed(2)} km
- Duration: ${Math.floor(activity.moving_time / 60)}:${(activity.moving_time % 60).toString().padStart(2, '0')}
- Average Pace: ${formatPace(activity.average_speed)} /km
- Average HR: ${activity.average_heartrate || 'N/A'} bpm
- Average Power: ${activity.average_watts || 'N/A'} W
- Training Load: ${activity.icu_training_load || activity.training_load || 'N/A'}
${intervalsSection}
${wellnessSection}
${workoutsSection}

**Training Context:**
- Marathon Goal: 2h50 (4:02/km pace)
- Race Date: May 31, 2026 (Porto Alegre Marathon)
- Training Cycle Start: January 19, 2026 (20-week cycle)
- Current Training Week: ${currentWeek}/20
- Current Training Phase: ${phase}
- Weeks to Race: ${weeksToRace}
- Current CTL/Fitness: ${todayWellness?.ctl || 'N/A'}

Please generate a complete JSON analysis with the following bilingual structure:

**Bilingual Fields (provide both en_US and pt_BR):**
- metadata.activityName: { "en_US": "...", "pt_BR": "..." }
- marathonContext.currentPhase: { "en_US": "...", "pt_BR": "..." }
- analysis.strengths: { "en_US": ["..."], "pt_BR": ["..."] }
- analysis.concerns: { "en_US": ["..."], "pt_BR": ["..."] }
- analysis.keyFindings: { "en_US": ["..."], "pt_BR": ["..."] }
- recommendations.nextSession.workout: { "en_US": "...", "pt_BR": "..." }
- recommendations.nextSession.rationale: { "en_US": "...", "pt_BR": "..." }
- recommendations.weeklyAdjustments: { "en_US": ["..."], "pt_BR": ["..."] }
- recommendations.progressionNotes: { "en_US": "...", "pt_BR": "..." }
- verdict.summary: { "en_US": "...", "pt_BR": "..." }
- verdict.goalViability.notes: { "en_US": "...", "pt_BR": "..." }

**Single-value Fields (no translation needed):**
- All numeric values (distance, pace, HR, power, etc.)
- Dates, IDs, and structured data
- session.type (use lowercase: "easy", "tempo", "intervals", "long_run", "recovery")
- verdict.rating (use: "excellent", "good", "acceptable", "poor")

Include:
1. All metadata fields with bilingual activity name
2. Session details and metrics (single-value)
3. Marathon context with bilingual phase
4. Analysis with bilingual strengths, concerns, and key findings
5. Calculated metrics (kmAtMarathonPace, kmAtThresholdPace, kmAtEasyPace)
6. Bilingual recommendations including:
   - nextSession: Tomorrow's workouts with adaptations based on today's performance
   - weeklyAdjustments: 3-5 brief tips on how to adjust THIS WEEK'S existing planned workouts (DO NOT generate a new weekly plan)
   - progressionNotes: Overall guidance
7. Verdict with rating and bilingual summary/notes

**IMPORTANT for weeklyAdjustments:**
- DO NOT create a new weekly training plan
- DO NOT list day-by-day workouts
- INSTEAD: Provide 3-5 actionable tips to tweak the athlete's existing Intervals.icu weekly plan
- Examples: "Reduce threshold reps if TSB below -15", "Skip PM sessions if legs heavy", "Add recovery day if needed"

Be specific with numbers, brutally honest, and provide actionable guidance. Write naturally in both English and Portuguese - translate concepts, not just words.`);
    console.log('---END PROMPT---\n');

    console.log(`\n📝 Next steps:`);
    console.log(`   1. Copy the prompt above`);
    console.log(`   2. Paste it into Claude (claude.ai or API)`);
    console.log(`   3. Save the JSON response to: data/analyses/${targetDate}-<type>.json`);
    console.log(`   4. Import it into the app via Settings > Database > Import Coach Analysis`);
    console.log(`   5. The analysis will be available in both English and Portuguese\n`);

  } catch (error) {
    console.error('❌ Error generating analysis:', error.message);
    process.exit(1);
  }
}

generateAnalysis();
