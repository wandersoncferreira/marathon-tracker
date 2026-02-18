/**
 * Fetch Strava cross training activities and convert to Intervals.icu format
 * Run this script to fetch all Strava cycling and strength activities
 */

// Activity IDs from Strava (from 2026-01-19 to 2026-02-18)
const STRAVA_ACTIVITY_IDS = [
  17386181830, // Zwift - Hilly Route in Watopia
  17365044427, // Zwift - Hell of the North in France
  17361753380, // Zwift - Climb Portal: Mûr De Bretagne
  17353249395, // Zwift - EF Pro Cycling's Red Day Workout
  17351547000, // Treinamento com peso (WeightTraining)
  17345786634, // Zwift - Big Flat 8 in Watopia
  17341605931, // Zwift - #2 Surge and Settle
  17338472202, // Zwift - #1 Find Your Rhythm
  17317034298, // Zwift - Volcano Flat in Watopia
  17297689859, // Zwift - Turf N Surf in Makuri Islands
  17283827237, // Zwift - Shisa Shakedown (40km)
  17275368971, // Zwift - Jarvis Seaside Sprint
  17270933339, // Pedalada matinal
  17260720469, // Treinamento com peso (WeightTraining)
  17258903367, // Zwift - Greater London Loop
  17251551169, // Zwift - Beach Island Loop
  17241614763, // Zwift - Big Flat 8
  17241354178, // Zwift - Two Bridges Loop
  17220582512, // Pedalada da tarde
  17220583823, // Pedalada da tarde (33km)
  17220583898, // Pedalada da tarde
  17217354926, // Treinamento com peso (WeightTraining)
  17211637038, // Pedalada matinal
  17196955906, // Pedalada da tarde (32km)
  17193890996, // Mobilidade e Força (WeightTraining)
  17150515207, // Pedalada na hora do almoço
  17145125583, // Pedalada noturna
  17131525817, // Treinamento com peso (WeightTraining)
  17129861381, // Pedalada da tarde
  17129863614, // Cycling (24km)
  17129864330, // Pedalada da tarde
  17115718597, // Pedalada matinal
  17115409052, // Cycling (20km)
  17115409017, // Pedalada matinal
  17105667510, // Pedalada da tarde
  17105667470, // Treinamento com peso (WeightTraining)
  17103410483, // Treinamento com peso (WeightTraining)
];

/**
 * Map Strava activity to Intervals.icu format
 */
function mapStravaToIntervalsFormat(stravaActivity) {
  return {
    id: String(stravaActivity.id),
    type: stravaActivity.type, // Ride, VirtualRide, WeightTraining
    name: stravaActivity.name,
    start_date_local: stravaActivity.start_date_local,
    distance: stravaActivity.distance, // meters
    moving_time: stravaActivity.moving_time, // seconds
    elapsed_time: stravaActivity.elapsed_time,
    average_watts: stravaActivity.average_watts || null,
    average_hr: stravaActivity.average_heartrate || null,
    max_hr: stravaActivity.max_heartrate || null,
    average_cadence: stravaActivity.average_cadence || null,
    icu_ftp: stravaActivity.weighted_average_watts || 250, // Use weighted avg or fallback
    icu_training_load: stravaActivity.suffer_score || 0, // Strava's suffer score as TSS equivalent
    calories: stravaActivity.calories || null,
    elevation_gain: stravaActivity.total_elevation_gain || null,
    tags: ['strava']
  };
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║   Strava Cross Training Fetcher                          ║
║   Fetches cycling & strength activities from Strava      ║
╚════════════════════════════════════════════════════════════╝

Will fetch ${STRAVA_ACTIVITY_IDS.length} activities from Strava...

To use this script, you need to:
1. Have Strava MCP tools available
2. Run fetch manually for each ID using the MCP tool
3. Save results to: public/database/strava-cross-training.json

Example activity IDs to fetch:
${STRAVA_ACTIVITY_IDS.slice(0, 5).join('\n')}

Activity IDs are listed in STRAVA_ACTIVITY_IDS array above.
`);
