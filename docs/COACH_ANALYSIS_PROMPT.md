# Coach Analysis Prompt Template

Use this prompt to generate consistent training analysis reports that can be imported into the Marathon Tracker app.

---

## How to Generate an Analysis

1. Get your activity data from Intervals.icu using Claude's MCP tools:
   - `mcp__Intervals_icu__get_activity_details`
   - `mcp__Intervals_icu__get_activity_intervals`
   - `mcp__Intervals_icu__get_wellness_data` (for today's readiness)
   - `mcp__Intervals_icu__get_events` (to fetch tomorrow's planned workout)

2. Use the prompt below with Claude to generate the analysis

3. Save the output JSON to `/app/data/analyses/YYYY-MM-DD-[session-type].json`

4. The analysis will automatically load in the app (stored in IndexedDB)

---

## Analysis Workflow

When generating a coach analysis, follow this sequence:

1. **Fetch today's workout data:**
   ```
   mcp__Intervals_icu__get_activity_details(activity_id="i125562353")
   mcp__Intervals_icu__get_activity_intervals(activity_id="i125562353")
   ```

2. **Fetch today's wellness data:**
   ```
   mcp__Intervals_icu__get_wellness_data(start_date="2026-02-16", end_date="2026-02-16")
   ```

3. **Fetch tomorrow's planned workout:**
   ```
   mcp__Intervals_icu__get_events(start_date="2026-02-17", end_date="2026-02-17")
   ```

4. **Analyze and generate:**
   - Assess today's performance (load, HR, pacing consistency)
   - Check wellness metrics (TSB, resting HR, HRV, sleep)
   - Review tomorrow's planned workout
   - Provide adaptive guidance based on all factors

5. **Save to file:**
   ```
   /app/data/analyses/2026-02-16-threshold.json
   ```

---

## The Prompt

```
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
- **Training Cycle Start: January 19, 2026** (20-week cycle)
- Current Training Week: [Calculate: weeks since Jan 19, 2026]
- Current Training Phase:
  - Weeks 1-4: Base Build
  - Weeks 5-8: Build
  - Weeks 9-16: Peak
  - Weeks 17-20: Taper
- Weeks to Race: [Calculate from today's date]
- Current CTL/Fitness: [Get from Intervals.icu if available]

**Coaching Philosophy (from docs/running-coach-directives.md):**
You are coaching a very close to elite runner with average performance of 2h50min for marathon distance. Use knowledge of exercise science, nutrition advice, and sport psychology. Keep recommendations short and brief with proven results.

**Training Strategy - Doubles for MP Banking:**
The athlete is implementing doubles (two-a-days) on easy/recovery days to accumulate additional marathon pace mileage without excessive fatigue:
- AM: Easy recovery run (60-75% of daily volume)
- PM: Short marathon pace session (3-5km @ 4:02/km ± 6s)
- Goal: Bank extra MP kilometers while maintaining recovery between quality sessions
- Consider this strategy when recommending weekly structure

**Analysis Requirements:**

1. **Evaluate session quality** relative to 2h50 marathon goal
2. **Identify 3-5 key strengths** of the performance
3. **Identify 2-4 areas of concern** that need attention
4. **Assess today's performance impact on recovery:**
   - High training load (>80 TSS) → affects tomorrow
   - Elevated average HR (>165 bpm) → stress signals
   - Inconsistent pacing in intervals → fatigue indicators
5. **Analyze current readiness from wellness data:**
   - Form/TSB: negative = fatigued, positive = rested
   - Resting HR: elevated = stress/illness
   - HRV: low = poor recovery
   - Sleep: <6h = compromised recovery
6. **Fetch tomorrow's planned workout** from Intervals.icu events
7. **Provide adaptive guidance for tomorrow** based on:
   - Today's training load and performance quality
   - Current wellness/readiness metrics
   - Planned workout type and intensity
8. **Calculate KM at different training zones:**
   - Marathon Pace: pace within 6s/km of 4:02/km
   - Threshold Pace: 3:40-3:55/km range
   - Easy Pace: slower than 4:45/km
9. **Rate session quality:** excellent/good/acceptable/poor
10. **Assess goal viability:** on_track/possible/unlikely

**Critical Guidelines:**
- Be specific with numbers and metrics (don't say "good pace" - say "4:06/km which is 4s faster than goal")
- Reference the training plan phases from docs/running-coach-directives.md
- Calculate pace zones accurately using actual data
- Provide actionable recommendations (e.g., "extend intervals to 5min" not "improve stamina")
- Consider cumulative fatigue and current training phase
- Compare to marathon goal pace (4:02/km) and provide context

**IMPORTANT - Next Session Adaptive Guidance (Multiple Sessions Support):**
1. **Fetch tomorrow's workouts** from Intervals.icu using `mcp__Intervals_icu__get_events`:
   - Get ALL events for tomorrow (may have AM and PM sessions - doubles)
   - Use the "time" field to identify AM vs PM workouts
   - Common pattern: AM = easy recovery, PM = marathon pace work
   - If no events found, suggest appropriate next session

2. **Distinguish AM and PM sessions:**
   - Check event "time" field or start time to determine AM/PM
   - AM sessions: Primary workout, typically easy/recovery or quality
   - PM sessions: Secondary, often short marathon pace work (3-5km)
   - PM sessions are tentative/optional (mark with "optional": true)
   - Provide separate guidance for each session

3. **Analyze today's impact:**
   - Training load >80 TSS → recommend modifications
   - Average HR >165 bpm → stress signals, reduce intensity
   - Inconsistent pacing → fatigue, prioritize recovery

4. **Check current readiness** (from wellness data):
   - TSB < -10 → fatigued, reduce volume/intensity
   - Elevated resting HR (>55 bpm) → possible illness/stress
   - Low HRV (<30 ms) → poor recovery
   - Sleep <6h → compromised recovery

5. **Provide specific adaptations for EACH workout:**
   - AM session: Primary guidance (typically more detailed)
   - PM session: Secondary guidance, emphasize it's optional
   - Format: "[Planned workout] - ADAPTATIONS: [specific modifications]"
   - Include decision criteria for PM ("if X, then skip PM")

6. **Decision Framework:**
   - Good readiness (TSB >-5): Execute both AM and PM
   - Moderate (TSB -5 to -15): Execute AM, PM optional or reduced
   - Poor (TSB <-15): AM easy only, skip PM

**IMPORTANT - Weekly Adjustments (NOT Weekly Plan):**
The athlete already has their real weekly plan in Intervals.icu. DO NOT generate a new weekly plan.

Instead, provide **3-5 brief tips** on how to adjust/tweak their existing planned workouts based on:
- Today's performance and recovery state
- Current fatigue levels (TSB)
- Upcoming planned sessions this week
- What to prioritize, reduce, or skip

Focus on actionable adjustments like:
- "Reduce Thursday's threshold reps from 5 to 3 if TSB still below -15"
- "Add 10min easy cooldown to Saturday's long run"
- "Skip Wednesday PM session if legs feel heavy"
- "Move Friday's easy run to complete rest if needed"

**Example NextSession formats (doubles):**
```json
"nextSession": [
  {
    "date": "2026-02-17",
    "timeOfDay": "AM",
    "type": "easy",
    "workout": "Easy 8km @ 4:50-5:00/km - ADAPTATIONS: Execute as planned. Keep HR <140 bpm.",
    "rationale": "Standard recovery after yesterday's threshold work (59 TSS). Current TSB -10 allows normal easy pace.",
    "optional": false
  },
  {
    "date": "2026-02-17",
    "timeOfDay": "PM",
    "type": "marathon_pace",
    "workout": "4km @ 4:00-4:04/km - ADAPTATIONS: Optional session to bank MP kilometers. Skip if legs feel heavy after AM run. Execute only if HR and legs respond well.",
    "rationale": "Optional PM session for MP banking strategy. Total 12km for day if executed. Skip if recovery feels compromised.",
    "optional": true
  }
]
```

**Single session format (backward compatible):**
```json
"nextSession": {
  "date": "2026-02-17",
  "type": "easy",
  "workout": "Easy 10km @ 4:55-5:05/km - ADAPTATIONS: Execute as planned.",
  "rationale": "Standard recovery protocol."
}
```

**Output Format:**

Generate a valid JSON file with this exact structure:

**IMPORTANT - Bilingual Content:**
The app supports both English (en_US) and Portuguese (pt_BR). All user-facing text content must be provided in BOTH languages using the structure shown below. Numeric data, dates, IDs, and enums remain single-value.

{
  "version": "1.0",
  "metadata": {
    "date": "YYYY-MM-DD",
    "activityId": "intervals.icu activity ID (e.g., i125562353)",
    "activityName": {
      "en_US": "activity name in English",
      "pt_BR": "nome da atividade em português"
    },
    "analysisDate": "ISO timestamp when analysis was created",
    "coach": "Claude-2h50-Marathon"
  },
  "session": {
    "type": "threshold|speed|easy|long_run|marathon_pace",
    "distance": [distance in meters],
    "duration": [duration in seconds],
    "avgPace": "MM:SS/km format",
    "avgPower": [average watts],
    "avgHR": [average heart rate bpm],
    "trainingLoad": [training load number]
  },
  "marathonContext": {
    "goalPace": "4:02/km",
    "goalTime": "2:50:00",
    "weeksToRace": [number of weeks],
    "currentPhase": {
      "en_US": "Base/Build (Weeks 1-4)" or "Peak (Weeks 5-11)" or "Taper (Weeks 12-14)",
      "pt_BR": "Base/Construção (Semanas 1-4)" or "Pico (Semanas 5-11)" or "Recuperação (Semanas 12-14)"
    }
  },
  "analysis": {
    "strengths": {
      "en_US": [
        "Specific strength with numbers/metrics in English",
        "Another strength with data",
        ...
      ],
      "pt_BR": [
        "Força específica com números/métricas em português",
        "Outra força com dados",
        ...
      ]
    },
    "concerns": {
      "en_US": [
        "Specific concern with context in English",
        "Another area needing attention",
        ...
      ],
      "pt_BR": [
        "Preocupação específica com contexto em português",
        "Outra área que precisa de atenção",
        ...
      ]
    },
    "keyFindings": {
      "en_US": [
        "Important insight with metrics in English",
        "Another key finding",
        ...
      ],
      "pt_BR": [
        "Insight importante com métricas em português",
        "Outra descoberta chave",
        ...
      ]
    }
  },
  "metrics": {
    "kmAtMarathonPace": [km within 5s/km of 4:02],
    "kmAtThresholdPace": [km in 3:40-3:55/km range],
    "kmAtEasyPace": [km slower than 4:45/km],
    "totalKm": [total distance in km]
  },
  "recommendations": {
    "nextSession": [
      {
        "date": "YYYY-MM-DD (tomorrow's date)",
        "timeOfDay": "AM|PM",
        "type": "session type from Intervals.icu planned workout",
        "workout": {
          "en_US": "TOMORROW'S ACTUAL PLANNED WORKOUT in English with adaptive guidance. Format: '[Original workout description] - ADAPTATIONS: [specific modifications]'",
          "pt_BR": "TREINO PLANEJADO DE AMANHÃ em português com orientação adaptativa. Formato: '[Descrição do treino original] - ADAPTAÇÕES: [modificações específicas]'"
        },
        "rationale": {
          "en_US": "Why these specific adaptations are recommended based on: (1) today's training load/performance quality, (2) current wellness metrics (TSB/HR/HRV/sleep), (3) planned workout intensity",
          "pt_BR": "Por que essas adaptações específicas são recomendadas com base em: (1) carga de treino e qualidade do desempenho de hoje, (2) métricas atuais de bem-estar (TSB/FC/HRV/sono), (3) intensidade do treino planejado"
        },
        "optional": false
      },
      {
        "date": "YYYY-MM-DD (tomorrow's date)",
        "timeOfDay": "PM",
        "type": "session type from Intervals.icu planned PM workout",
        "workout": {
          "en_US": "PM workout (if scheduled) with adaptations in English. Note: PM sessions are typically for MP banking and are optional/tentative",
          "pt_BR": "Treino PM (se agendado) com adaptações em português. Nota: Sessões PM são tipicamente para acumular ritmo de maratona e são opcionais/tentativas"
        },
        "rationale": {
          "en_US": "Guidance for PM session. Include decision criteria for skipping if needed.",
          "pt_BR": "Orientação para sessão PM. Incluir critérios de decisão para pular se necessário."
        },
        "optional": true
      }
    ],
    "// Note": "nextSession can be either an array (for multiple sessions) or a single object (backward compatible)",
    "weeklyAdjustments": {
      "en_US": [
        "Brief tip on how to adjust/tweak planned workouts based on today's performance",
        "Another guidance on recovery needs or intensity modifications",
        "Advice on which sessions to prioritize or skip this week",
        ...
      ],
      "pt_BR": [
        "Dica breve sobre como ajustar/modificar treinos planejados com base no desempenho de hoje",
        "Outra orientação sobre necessidades de recuperação ou modificações de intensidade",
        "Conselho sobre quais sessões priorizar ou pular esta semana",
        ...
      ]
    },
    "progressionNotes": {
      "en_US": "Coaching guidance on progression and what to focus on in English",
      "pt_BR": "Orientação de coaching sobre progressão e no que focar em português"
    }
  },
  "verdict": {
    "rating": "excellent|good|acceptable|poor",
    "summary": {
      "en_US": "1-2 sentence overall assessment of the session in English",
      "pt_BR": "Avaliação geral da sessão em 1-2 frases em português"
    },
    "goalViability": {
      "2h50": "on_track|possible|unlikely",
      "confidence": "high|moderate|low",
      "notes": {
        "en_US": "Brief explanation of goal viability assessment in English",
        "pt_BR": "Breve explicação da avaliação de viabilidade do objetivo em português"
      }
    }
  }
}

**Session Type Definitions:**
- `threshold`: Lactate threshold work (typically Monday) - 3:40-3:55/km pace
- `speed`: VO2max/speed work (typically Wednesday) - 3:25-3:40/km pace
- `marathon_pace`: Race pace specific work - 4:02/km ± 5s
- `long_run`: Saturday long run - progressive or with MP finish
- `easy`: Recovery/base volume - slower than 4:45/km

**Important:**
- Ensure JSON is valid (use proper quotes, commas, no trailing commas)
- Be brutally honest in assessment - athlete needs truth, not encouragement
- Reference actual pace numbers from the activity data
- Calculate metrics accurately from interval data
- Provide next session that makes sense in training progression
```

---

## Bilingual Content Guidelines

**Fields requiring both en_US and pt_BR:**
- metadata.activityName
- marathonContext.currentPhase
- analysis.strengths (array)
- analysis.concerns (array)
- analysis.keyFindings (array)
- recommendations.nextSession[].workout
- recommendations.nextSession[].rationale
- recommendations.weeklyFocus (array)
- recommendations.progressionNotes
- verdict.summary
- verdict.goalViability.notes

**Fields that remain single-value (no translation):**
- All numeric values (distance, pace, HR, power, load, etc.)
- Dates, timestamps, IDs
- Enums: session.type, verdict.rating, verdict.goalViability.2h50, verdict.goalViability.confidence
- Boolean values: optional

**Translation Tips:**
- Translate concepts naturally, not word-for-word
- Keep technical terms consistent (TSS, CTL, ATL, HR, etc.)
- Maintain the same level of detail in both languages
- Use appropriate coaching tone in both languages
- Numbers and paces remain the same (4:02/km works in both languages)

## Example Output

See `/app/data/analyses/2026-02-17-easy.json` for a complete bilingual example.

---

## Quick Reference: Training Pace Zones

From `/docs/running-coach-directives.md`:

| Zone | Pace Range | Purpose | HR Zone |
|------|-----------|---------|---------|
| **Marathon Pace** | 4:02/km | Race specific | 88-92% LTHR |
| **Threshold** | 3:40-3:55/km | Lactate clearance | 92-97% LTHR |
| **Speed/VO2max** | 3:25-3:40/km | Max aerobic capacity | 97-100% LTHR |
| **Easy** | 4:45-5:15/km | Recovery/volume | <80% LTHR |
| **Long Run** | 4:25-4:35/km | Endurance | 75-85% LTHR |

**Athlete Metrics:**
- LTHR: 178 bpm
- FTP: 360W (running power)
- Threshold Pace: 3:45/km (realistic) / 3:30/km (aggressive)
- Resting HR: 47 bpm

---

## Tips for Generating Quality Analyses

1. **Always fetch actual activity data** - Don't make up numbers
2. **Calculate zones from intervals** - Use the interval breakdown to accurately determine time in zones
3. **Compare to plan** - Reference the weekly training structure and progressions
4. **Be specific** - "4:06/km avg" not "good pace"
5. **Provide context** - "167 bpm (94% LTHR)" not just "167 bpm"
6. **Actionable recommendations** - "Extend intervals to 5min at 3:50/km" not "work on endurance"
7. **Consider fatigue** - Look at CTL/ATL and recent training load
8. **Marathon-focused** - Always tie analysis back to 2h50 goal
9. **Incorporate doubles strategy** - Recommend doubles (AM easy + PM short MP) on recovery days to bank marathon pace kilometers without compromising quality sessions
10. **Elite athlete mindset** - Remember this athlete is near-elite level (2h50 marathon capability), so recommendations should reflect high training volume and intensity tolerance
11. **Fetch tomorrow's workout** - Use `mcp__Intervals_icu__get_events` to get the actual planned workout for tomorrow
12. **Adaptive guidance format** - Show tomorrow's workout with "- ADAPTATIONS:" followed by specific modifications based on today's performance and current wellness

---

## Importing into the App

1. Save the JSON output to a file (e.g., `2026-02-16-threshold.json`)
2. Open the Marathon Tracker app
3. Go to Settings
4. Click "Import Analysis JSON"
5. Select your JSON file
6. The analysis will appear in the Coach Analysis tab

---

## Troubleshooting

**"Invalid JSON" error:**
- Check for trailing commas in arrays/objects
- Ensure all strings use double quotes
- Validate JSON at jsonlint.com

**Analysis doesn't show up:**
- Check the date format is YYYY-MM-DD
- Ensure all required fields are present
- Verify the activityId matches an activity in Intervals.icu

**Metrics seem wrong:**
- Double-check your zone calculations
- Verify you're using the correct pace formats (MM:SS/km)
- Ensure distance is in meters, not kilometers
