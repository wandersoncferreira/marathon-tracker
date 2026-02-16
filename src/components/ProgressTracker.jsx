import { useState, useEffect } from 'react';
import useActivities from '../hooks/useActivities';
import useAnalyses from '../hooks/useAnalyses';
import {
  calculateKmAtMarathonPace,
  calculateKmAtThreshold,
  calculateKmAtEasy,
  calculateWeeklyVolume,
  calculateIntensityDistribution
} from '../utils/trainingCalculations';
import { getCycleStats, getWeeklyMPTarget, TRAINING_CYCLE } from '../utils/trainingCycle';
import { formatDateISO } from '../utils/dateHelpers';
import { intervalsApi } from '../services/intervalsApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function ProgressTracker() {
  const { activities, loading } = useActivities(90, true, true); // Use full cycle
  const { analyses } = useAnalyses();
  const [weeklyData, setWeeklyData] = useState([]);
  const [totalStats, setTotalStats] = useState(null);
  const [cycleStats, setCycleStats] = useState(null);
  const [fitnessData, setFitnessData] = useState([]);

  useEffect(() => {
    const calculateProgressStats = async () => {
      // Get cycle statistics
      const stats = getCycleStats();
      setCycleStats(stats);

      if (activities.length > 0) {
        // First, try to load intervals from database
        const activitiesWithIntervals = await intervalsApi.attachIntervalsFromDB(activities);

        // Count how many activities have intervals
        const withIntervals = activitiesWithIntervals.filter(a => a.intervals && a.intervals.length > 0).length;
        const withoutIntervals = activitiesWithIntervals.length - withIntervals;

        // If some activities don't have intervals, fetch them in batches (only missing ones)
        if (withoutIntervals > 0) {
          const missingIntervals = activitiesWithIntervals.filter(a => !a.intervals || a.intervals.length === 0);
          const batchSize = 5;

          for (let i = 0; i < missingIntervals.length; i += batchSize) {
            const batch = missingIntervals.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (activity) => {
                try {
                  const intervalData = await intervalsApi.getActivityIntervals(activity.id);
                  activity.intervals = intervalData?.icu_intervals || [];
                } catch (error) {
                  console.error(`Failed to fetch intervals for activity ${activity.id}:`, error);
                }
              })
            );

            // Small delay between batches to avoid rate limiting
            if (i + batchSize < missingIntervals.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }

        // Calculate weekly volume with intervals
        const weekly = calculateWeeklyVolume(activitiesWithIntervals);

        // Calculate KM at MP, Threshold, and Easy for each week
        const weeklyWithZones = weekly.map(week => {
          // Get activities for this week
          const weekStart = new Date(week.week);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const weekActivities = activitiesWithIntervals.filter(a => {
            const activityDate = new Date(a.start_date_local);
            return activityDate >= weekStart && activityDate < weekEnd;
          });

          // Calculate KM at different paces for this week (min 200m segments for quality metrics)
          const kmAtMP = calculateKmAtMarathonPace(weekActivities, '4:02/km', 6, 200);
          const kmAtThreshold = calculateKmAtThreshold(weekActivities, 200);
          const kmAtEasy = calculateKmAtEasy(weekActivities, 200);

          // Calculate full distribution including ALL segments (for distribution chart)
          const distribution = calculateIntensityDistribution(weekActivities);

          return { ...week, kmAtMP, kmAtThreshold, kmAtEasy, distribution };
        });

        setWeeklyData(weeklyWithZones);

        // Calculate totals across entire cycle
        const totalKmAtMP = calculateKmAtMarathonPace(activitiesWithIntervals, '4:02/km', 6, 200);
        const totalKmThreshold = calculateKmAtThreshold(activitiesWithIntervals, 200);

        // Calculate expected total KM at MP so far
        let expectedKmAtMP = 0;
        for (let week = 1; week <= stats.currentWeek; week++) {
          const target = getWeeklyMPTarget(week);
          expectedKmAtMP += target.target;
        }

        setTotalStats({
          totalKmAtMP,
          totalKmThreshold,
          analysisCount: analyses.length,
          expectedKmAtMP,
        });

        // Wait a bit before fetching wellness data to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch wellness data which contains fitness/fatigue/form
        try {
          const wellnessData = await intervalsApi.getWellnessData(
            TRAINING_CYCLE.startDate,
            formatDateISO(new Date())
          );

          if (wellnessData && Array.isArray(wellnessData)) {
            const fitnessTimeSeries = wellnessData
              .map(entry => {
                // The id field is already the date (YYYY-MM-DD format)
                const date = entry.id;
                // CTL = Chronic Training Load (Fitness)
                const fitness = entry.ctl || 0;
                // ATL = Acute Training Load (Fatigue)
                const fatigue = entry.atl || 0;
                // TSB = Training Stress Balance (Form) = CTL - ATL
                const form = fitness - fatigue;

                return { date, fitness, fatigue, form };
              })
              .filter(d => d.date && (d.fitness > 0 || d.fatigue > 0))
              .sort((a, b) => new Date(a.date) - new Date(b.date));

            setFitnessData(fitnessTimeSeries);
          }
        } catch (error) {
          console.error('Error fetching wellness data:', error);
        }
      }
    };

    calculateProgressStats();
  }, [activities, analyses]);

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Progress Tracker</h2>
        <p className="text-sm text-gray-600">
          {cycleStats && `Week ${cycleStats.currentWeek}/${cycleStats.totalWeeks} - ${cycleStats.phase}`}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-primary-600 to-primary-700 text-white">
          <p className="text-sm text-primary-100 mb-1">Total KM at Marathon Pace</p>
          <p className="text-3xl font-bold">{totalStats?.totalKmAtMP.toFixed(1) || '0.0'}</p>
          <p className="text-xs text-primary-100 mt-2">
            Target: {totalStats?.expectedKmAtMP.toFixed(0) || 0} km (cycle so far)
          </p>
        </div>

        <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <p className="text-sm text-blue-100 mb-1">Threshold KM</p>
          <p className="text-3xl font-bold">{totalStats?.totalKmThreshold.toFixed(1) || '0.0'}</p>
          <p className="text-xs text-blue-100 mt-2">
            {totalStats?.analysisCount || 0} analyzed sessions
          </p>
        </div>
      </div>

      {/* Fitness/Fatigue/Form Chart */}
      {fitnessData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Fitness, Fatigue & Form</h3>
          <div style={{ width: '100%', height: '256px' }}>
            <ResponsiveContainer>
              <LineChart data={fitnessData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="fitness"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Fitness (CTL)"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fatigue"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Fatigue (ATL)"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="form"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Form (TSB)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-xs text-gray-500 space-y-1">
            <p><span className="font-medium text-blue-600">Fitness (CTL)</span>: Chronic Training Load - long-term fitness buildup</p>
            <p><span className="font-medium text-red-600">Fatigue (ATL)</span>: Acute Training Load - recent training stress</p>
            <p><span className="font-medium text-green-600">Form (TSB)</span>: Training Stress Balance - readiness to perform (Fitness - Fatigue)</p>
          </div>
        </div>
      )}

      {/* Weekly Marathon Pace Progress */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Weekly KM at Marathon Pace</h3>
        <div className="space-y-3">
          {weeklyData.slice(-4).reverse().map((week, idx) => {
            // Get the current week number from cycle stats
            const weekNum = cycleStats?.currentWeek || 1;
            const weekTarget = getWeeklyMPTarget(weekNum);
            const progress = (week.kmAtMP / weekTarget.target) * 100;
            const isOnTrack = week.kmAtMP >= weekTarget.target * 0.8; // 80% threshold

            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">
                    Week of {new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className={`text-sm font-semibold ${
                    isOnTrack ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {week.kmAtMP.toFixed(1)} km
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOnTrack ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Target: {weekTarget.min}-{weekTarget.max} km
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Marathon pace: 4:02/km ± 6s
        </p>
      </div>

      {/* Weekly Volume Trend */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Weekly Volume</h3>
        <div className="space-y-3">
          {weeklyData.slice(-4).reverse().map((week, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">
                  Week of {new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {week.totalKm.toFixed(1)} km
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (week.totalKm / 100) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                <span>{week.sessions} sessions</span>
                <span>Load: {week.totalLoad.toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Training Distribution */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Training Distribution (Last 4 Weeks)</h3>
        <div className="space-y-3">
          {weeklyData.slice(-4).reverse().map((week, idx) => {
            const dist = week.distribution || {};
            const total = dist.total || week.totalKm;
            const speedPercent = total > 0 ? (dist.speed / total) * 100 : 0;
            const thresholdPercent = total > 0 ? (dist.threshold / total) * 100 : 0;
            const mpPercent = total > 0 ? (dist.marathonPace / total) * 100 : 0;
            const tempoPercent = total > 0 ? (dist.tempo / total) * 100 : 0;
            const easyPercent = total > 0 ? (dist.easy / total) * 100 : 0;

            return (
              <div key={idx}>
                <p className="text-sm text-gray-700 mb-2">
                  Week of {new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {total.toFixed(1)} km
                </p>
                <div className="flex h-8 rounded-lg overflow-hidden">
                  {speedPercent > 0 && (
                    <div
                      className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${speedPercent}%` }}
                      title={`Speed: ${dist.speed?.toFixed(1)} km`}
                    >
                      {speedPercent > 8 && `${speedPercent.toFixed(0)}%`}
                    </div>
                  )}
                  {thresholdPercent > 0 && (
                    <div
                      className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${thresholdPercent}%` }}
                      title={`Threshold: ${dist.threshold?.toFixed(1)} km`}
                    >
                      {thresholdPercent > 8 && `${thresholdPercent.toFixed(0)}%`}
                    </div>
                  )}
                  {mpPercent > 0 && (
                    <div
                      className="bg-primary-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${mpPercent}%` }}
                      title={`Marathon Pace: ${dist.marathonPace?.toFixed(1)} km`}
                    >
                      {mpPercent > 8 && `${mpPercent.toFixed(0)}%`}
                    </div>
                  )}
                  {tempoPercent > 0 && (
                    <div
                      className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${tempoPercent}%` }}
                      title={`Tempo: ${dist.tempo?.toFixed(1)} km`}
                    >
                      {tempoPercent > 8 && `${tempoPercent.toFixed(0)}%`}
                    </div>
                  )}
                  {easyPercent > 0 && (
                    <div
                      className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${easyPercent}%` }}
                      title={`Easy: ${dist.easy?.toFixed(1)} km`}
                    >
                      {easyPercent > 8 && `${easyPercent.toFixed(0)}%`}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-500">
                  <span>🔴 Speed: {dist.speed?.toFixed(1) || 0}</span>
                  <span>🟠 Threshold: {dist.threshold?.toFixed(1) || 0}</span>
                  <span>🔵 Marathon Pace: {dist.marathonPace?.toFixed(1) || 0}</span>
                  <span>🟡 Tempo: {dist.tempo?.toFixed(1) || 0}</span>
                  <span className="col-span-2">🟢 Easy: {dist.easy?.toFixed(1) || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
          <p className="font-medium mb-1">Pace Zones:</p>
          <ul className="space-y-1">
            <li>🔴 Speed: &lt;3:40/km</li>
            <li>🟠 Threshold: 3:40-3:55/km</li>
            <li>🔵 Marathon Pace: 3:56-4:08/km</li>
            <li>🟡 Tempo: 4:08-4:45/km</li>
            <li>🟢 Easy: &gt;4:45/km</li>
          </ul>
        </div>
      </div>

      {/* Goal Status */}
      {cycleStats && (
        <div className="card bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3">Cycle Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Cycle Start</span>
              <span className="font-semibold text-gray-900">{cycleStats.startDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Week</span>
              <span className="font-semibold text-gray-900">
                Week {cycleStats.currentWeek} of {cycleStats.totalWeeks}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Training Phase</span>
              <span className="font-semibold text-gray-900">{cycleStats.phase}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Weeks to Race</span>
              <span className="font-semibold text-gray-900">{cycleStats.weeksToRace}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Race Date</span>
              <span className="font-semibold text-primary-600">{cycleStats.raceDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Goal Time</span>
              <span className="font-semibold text-primary-600">2:50:00 (4:02/km)</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Cycle Progress</span>
                <span className="font-semibold text-gray-900">{cycleStats.percentComplete}%</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-3">
                <div
                  className="bg-primary-600 rounded-full h-3 transition-all"
                  style={{ width: `${cycleStats.percentComplete}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProgressTracker;
