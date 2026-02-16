import { useState } from 'react';

function CoachPromptModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const promptContent = `# Coach Analysis Prompt Template

Use this prompt to generate consistent training analysis reports that can be imported into the Marathon Tracker app.

---

## How to Generate an Analysis

1. Get your activity data from Intervals.icu using Claude's MCP tools:
   - \`mcp__Intervals_icu__get_activity_details\`
   - \`mcp__Intervals_icu__get_activity_intervals\`
   - \`mcp__Intervals_icu__get_wellness_data\` (for today's readiness)
   - \`mcp__Intervals_icu__get_events\` (to fetch tomorrow's planned workout)

2. Use the prompt below with Claude to generate the analysis

3. Save the output JSON to \`/app/data/analyses/YYYY-MM-DD-[session-type].json\`

4. The analysis will automatically load in the app (stored in IndexedDB)

---

## The Prompt

\`\`\`
You are a professional running coach specializing in sub-2h50 marathon training.

Analyze the following training session from Intervals.icu and generate a structured JSON report following the schema below.

**Training Session Data:**
[Use Claude MCP tools to fetch:]
- Activity ID: [activity_id]
- Date: [date]
- Get activity details: mcp__Intervals_icu__get_activity_details
- Get intervals: mcp__Intervals_icu__get_activity_intervals
- Get today's wellness: mcp__Intervals_icu__get_wellness_data (for readiness assessment)
- Get tomorrow's planned workout: mcp__Intervals_icu__get_events (fetch events for tomorrow's date)

**Athlete Context:**
- Marathon Goal: 2h50 (4:02/km pace)
- Race Date: May 31, 2026 (Porto Alegre Marathon)
- Training Cycle Start: January 19, 2026 (20-week cycle)
- Current Training Week: [Calculate: weeks since Jan 19, 2026]
- Current Training Phase:
  - Weeks 1-4: Base Build
  - Weeks 5-8: Build
  - Weeks 9-16: Peak
  - Weeks 17-20: Taper
- Weeks to Race: [Calculate from today's date]

**Coaching Philosophy:**
You are coaching a very close to elite runner with average performance of 2h50min for marathon distance. Use knowledge of exercise science, nutrition advice, and sport psychology. Keep recommendations short and brief with proven results.

**Training Strategy - Doubles for Marathon Pace Banking:**
The athlete is implementing doubles (two-a-days) on easy/recovery days to accumulate additional marathon pace mileage without excessive fatigue:
- AM: Easy recovery run (60-75% of daily volume)
- PM: Short marathon pace session (3-5km @ 4:02/km ± 6s)
- Goal: Bank extra MP kilometers while maintaining recovery between quality sessions

**Analysis Requirements:**

1. **Evaluate session quality** relative to 2h50 marathon goal
2. **Identify 3-5 key strengths** of the performance
3. **Identify 2-4 areas of concern** that need attention
4. **Assess today's performance impact on recovery:**
   - Training load (TSS > 80 → recommend modifications)
   - Average HR (> 165 bpm → stress signals, reduce intensity)
5. **Check current readiness** from wellness data:
   - TSB < -10 → fatigued, reduce volume/intensity
   - Resting HR elevated → body stress, consider adjustment
   - HRV suppressed → recovery needed
   - Poor sleep (<7h or low quality) → adjust intensity

**IMPORTANT - Next Session Adaptive Guidance:**

1. **Fetch tomorrow's workout** from Intervals.icu using \`mcp__Intervals_icu__get_events\`:
   - Get workout details (type, distance, intervals, target pace/power)
   - If no event found, suggest appropriate next session

2. **Analyze today's impact:**
   - Training load > 80 TSS → recommend modifications
   - Average HR > 165 bpm → stress signals, reduce intensity tomorrow
   - Incomplete recoveries or poor execution → lighter day needed

3. **Check current readiness** (from wellness data):
   - TSB < -10 → fatigued, reduce volume/intensity tomorrow
   - Resting HR elevated → body stress, adjust tomorrow's intensity
   - HRV suppressed → recovery needed, modify tomorrow's workout
   - Poor sleep (<7h) → reduce intensity tomorrow

4. **Provide specific adaptations** to tomorrow's workout:
   - Format: "[Planned workout] - ADAPTATIONS: [specific modifications]"
   - Example: "3 x 3km @ threshold - ADAPTATIONS: Reduce to 2 x 3km if HR stays >165 in warmup. Extend recoveries to 3min if needed."
   - Be specific with numbers (pace, distance, HR targets)
   - Include decision criteria ("if X happens, then do Y")

5. **Decision Framework:**
   - If readiness is GOOD (TSB > -10, normal HR/HRV, good sleep):
     → Execute as planned
   - If readiness is MODERATE (TSB -10 to -20, slightly elevated HR):
     → Reduce intensity by 5-10s/km OR cut volume by 20%
   - If readiness is POOR (TSB < -20, elevated HR, poor sleep):
     → Convert to easy run OR take rest day

**Output Format:**

Generate a valid JSON file following this schema:

{
  "version": "1.0",
  "metadata": {
    "date": "YYYY-MM-DD",
    "activityId": "intervals.icu activity ID",
    "activityName": "activity name",
    "analysisDate": "ISO timestamp",
    "coach": "Claude-2h50-Marathon"
  },
  "session": {
    "type": "threshold|speed|easy|long_run|marathon_pace",
    "distance": meters,
    "duration": seconds,
    "avgPace": "MM:SS/km",
    "avgPower": watts,
    "avgHR": bpm,
    "trainingLoad": number
  },
  "marathonContext": {
    "goalPace": "4:02/km",
    "goalTime": "2:50:00",
    "weeksToRace": number,
    "currentPhase": "phase description",
    "currentWeek": number
  },
  "analysis": {
    "strengths": ["strength 1", "strength 2", ...],
    "concerns": ["concern 1", "concern 2", ...],
    "keyFindings": ["finding 1", "finding 2", ...]
  },
  "metrics": {
    "kmAtMarathonPace": km (pace within 6s/km of 4:02),
    "kmAtThresholdPace": km (3:40-3:55/km range),
    "kmAtEasyPace": km (>4:45/km),
    "totalKm": total distance in km
  },
  "recommendations": {
    "nextSession": {
      "date": "YYYY-MM-DD",
      "type": "session type",
      "workout": "[Planned workout from Intervals.icu] - ADAPTATIONS: [specific modifications based on today's performance and readiness]",
      "rationale": "Why these adaptations (reference today's load, wellness metrics, readiness score)"
    },
    "weeklyFocus": [
      "Day: workout description",
      ...
    ],
    "progressionNotes": "Coaching notes about progression and doubles strategy"
  },
  "verdict": {
    "rating": "excellent|good|acceptable|poor",
    "summary": "1-2 sentence overall assessment",
    "goalViability": {
      "2h50": "on_track|possible|unlikely",
      "confidence": "high|moderate|low",
      "notes": "brief explanation"
    }
  }
}

**Important:**
- Be specific with numbers and metrics
- Reference the training plan and current phase
- Calculate pace zones accurately
- Provide actionable, specific recommendations (not generic advice)
- Consider cumulative fatigue and training phase
- ALWAYS include tomorrow's workout with specific adaptations
- Base adaptations on objective data (TSB, HR, HRV, sleep)
- Include decision criteria in recommendations
\`\`\`

---

## Example Usage

\`\`\`bash
# 1. Get today's activity ID from Intervals.icu
# 2. Use Claude with MCP tools to fetch data and generate analysis
# 3. Save output to: data/analyses/2026-02-16-threshold.json
# 4. Import in app: Settings → Import Analysis
\`\`\`

## Notes

- The app reads JSON files from IndexedDB (imported via Settings)
- Analysis is keyed by activityId (one analysis per activity)
- Date format: YYYY-MM-DD for consistency
- Marathon pace tolerance: ±6 seconds (3:56-4:08/km)
- Adaptive guidance must be specific and actionable
- Tomorrow's workout adaptations are mandatory, not optional
`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Coach Analysis Prompt</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg border border-gray-200">
            {promptContent}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCopy}
            className="btn-primary"
          >
            {copied ? '✓ Copied!' : '📋 Copy Prompt'}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CoachPromptModal;
