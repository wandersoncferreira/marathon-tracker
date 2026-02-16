// Quick debug script to check interval data
import { intervalsApi } from './src/services/intervalsApi.js';

// Get today's activity (Feb 16)
const config = await intervalsApi.loadConfig();
console.log('Config loaded:', config);

const activities = await intervalsApi.getActivities('2026-02-16', '2026-02-17', true);
console.log('Activities found:', activities.length);

if (activities.length > 0) {
  const activity = activities[0];
  console.log('\nActivity:', activity.name, activity.id);
  console.log('Distance:', activity.distance / 1000, 'km');
  console.log('Avg Speed:', activity.average_speed, 'm/s');
  console.log('Avg Pace:', 1000 / activity.average_speed, 's/km');
  
  console.log('\nFetching intervals...');
  const intervalData = await intervalsApi.getActivityIntervals(activity.id);
  console.log('Interval data structure:', JSON.stringify(intervalData, null, 2));
}
