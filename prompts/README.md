# Strength Training Recommendations System

## Overview

This system allows you to generate AI-powered strength training recommendations that automatically update when your marathon training phase changes.

## How It Works

### 1. Phase Detection
The system tracks your marathon training phase based on:
- **Base Building**: Weeks 1-4
- **Build**: Weeks 5-8
- **Peak Training**: Weeks 9-16
- **Taper**: Weeks 17+

### 2. Update Button
In the Cross Training page (Strength Training tab), click the **🔄 Update** button in the "Current Phase" card.

### 3. Two Possible Outcomes

#### A. Phase Changed ✅
If the marathon phase has changed since the last update:
1. A modal opens with an AI prompt
2. The prompt includes:
   - Current phase information
   - Week in cycle
   - Weeks to race
   - Training parameters
3. Copy the prompt and paste into Claude or your AI assistant
4. The AI will generate comprehensive recommendations in JSON format
5. Update the code in `crossTrainingService.js` with the new recommendations
6. Click "Mark as Updated" to track the phase change

#### B. No Update Needed ℹ️
If the phase hasn't changed:
- A simple modal appears
- Shows current phase info
- Explains that recommendations are still appropriate
- No action needed!

## Using the Generated Recommendations

### Step 1: Copy the Prompt
Click the "📋 Copy" button in the modal to copy the full prompt.

### Step 2: Generate Recommendations
Paste the prompt into Claude or your AI assistant. The AI will generate:
```json
{
  "phase": "Build",
  "weeklyMinutes": [45, 60],
  "focus": "Power endurance, single-leg stability...",
  "exercises": [
    {
      "name": "Single-leg squats (3x6-8 each)",
      "video": "https://www.youtube.com/watch?v=...",
      "description": "Why this exercise matters..."
    }
  ],
  "rationale": "Scientific reasoning...",
  "weeklySchedule": { ... },
  "progressionGuidelines": "...",
  "recoveryConsiderations": "...",
  "redFlags": [ ... ],
  "references": [ ... ]
}
```

### Step 3: Update the Code
Open `/src/services/crossTrainingService.js` and find the `getStrengthRecommendations` function.

Update the section for the current phase:
```javascript
} else if (weeksInCycle <= 8) {
  phase = 'Build';
  weeklyMinutes = [45, 60];
  focus = 'Power endurance, single-leg stability, plyometrics';
  exercises = [
    { name: 'Single-leg squats (3x6-8 each)', video: 'https://...' },
    { name: 'Box jumps (3x8)', video: 'https://...' },
    // ... add all exercises from AI response
  ];
  rationale = 'Maintain strength while running volume increases...';
}
```

### Step 4: Mark as Updated
Click the "✅ Mark as Updated" button in the modal. This saves:
- Current phase name
- Update timestamp

This prevents the system from showing the prompt again until the phase changes.

## Prompt Details

The prompt in `STRENGTH_RECOMMENDATIONS_PROMPT.md` is comprehensive and includes:

### Input Parameters
- Marathon phase and timing
- Week in cycle
- Weeks to race
- Key dates

### Output Requirements
- 5-6 exercises with YouTube links
- Scientific rationale with citations
- Weekly schedule suggestions
- Progression guidelines
- Recovery considerations
- Warning signs (red flags)
- Research references

### Exercise Selection Guidelines
Phase-specific recommendations for:
- Volume (minutes per week)
- Intensity (% of 1RM)
- Focus areas
- Key exercise types

### Research Base
Built on findings from:
- Balsalobre-Fernández et al. (2016) - Running economy
- Beattie et al. (2014) - Strength training effects
- Mikkola et al. (2007) - Concurrent training
- Taipale et al. (2010) - Timing strategies
- And more...

## LocalStorage Tracking

The system uses localStorage to track:
- `strength_recs_last_update`: ISO timestamp of last update
- `strength_recs_last_phase`: Phase name when last updated

This ensures you only see the prompt when crossing into a new phase.

## Benefits

1. **Evidence-Based**: All recommendations are research-backed
2. **Phase-Appropriate**: Automatically adapts to training phase
3. **Time-Efficient**: Only updates when needed
4. **Comprehensive**: Includes exercises, videos, schedule, and science
5. **Trackable**: Knows when last updated

## Example Workflow

### Week 1 (Base Building)
1. Click "🔄 Update"
2. System: "Phase changed: Never updated → Base Building"
3. Copy prompt → Generate with AI
4. Update code with Base Building exercises
5. Mark as updated

### Week 4 (Still Base Building)
1. Click "🔄 Update"
2. System: "No update needed - still in Base Building phase"
3. No action required

### Week 5 (Build Phase)
1. Click "🔄 Update"
2. System: "Phase changed: Base Building → Build"
3. Copy prompt → Generate with AI
4. Update code with Build phase exercises
5. Mark as updated

## Customization

You can customize the prompt in `STRENGTH_RECOMMENDATIONS_PROMPT.md` to:
- Add more specific exercise requirements
- Include different research papers
- Adjust phase durations
- Add athlete-specific considerations
- Include equipment constraints

## Tips

1. **Review AI Output**: Always review the AI-generated recommendations before implementing
2. **Verify Videos**: Check that YouTube links are from reputable sources
3. **Test Exercises**: Ensure exercises are appropriate for your skill level
4. **Update Regularly**: Check for phase changes weekly
5. **Keep History**: Save generated recommendations for future reference

## Troubleshooting

**Prompt Modal Won't Open**
- Check browser console for errors
- Verify localStorage is enabled
- Try clicking "Mark as Updated" to reset

**AI Generates Wrong Format**
- Ensure you copied the full prompt
- Reference the example output in the prompt file
- Ask AI to follow the exact JSON structure

**Videos Don't Work**
- Verify YouTube links are accessible
- Replace with alternative tutorial videos
- Use reputable fitness channels (AthleanX, Jeff Nippard, etc.)

## Future Enhancements

Possible improvements:
- Automatic code updates (AI directly updates the file)
- Multiple recommendation profiles (beginner/advanced)
- Integration with injury history
- Personalized exercise substitutions
- Progress tracking for strength metrics
