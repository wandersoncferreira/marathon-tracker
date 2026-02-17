import { useState, useEffect } from 'react';
import useActivities from '../hooks/useActivities';
import useAnalyses from '../hooks/useAnalyses';
import { calculateKmAtMarathonPace, calculateWeeklyVolume } from '../utils/trainingCalculations';
import { getCurrentWeek, formatDateISO } from '../utils/dateHelpers';
import { getCycleStats, getWeeklyMPTarget } from '../utils/trainingCycle';
import { intervalsApi } from '../services/intervalsApi';
import { analyzeWellnessReadiness, calculateWellnessBaseline } from '../utils/wellnessAnalysis';
import { db } from '../services/database';

function Dashboard() {
  const { activities, loading: activitiesLoading, sync } = useActivities(90, true, true);
  const { analyses, getLatest } = useAnalyses();
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [cycleStats, setCycleStats] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [todayReadiness, setTodayReadiness] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    await sync();
    setSyncing(false);
  };

  const fetchTodayWellness = async (useCache = true) => {
    try {
      const today = formatDateISO(new Date());
      const cacheKey = `readiness_${today}`;

      console.log('🔄 Fetching wellness for', today);

      // Check cache first (if useCache is true)
      if (useCache) {
        const cachedReadiness = await db.getCached(cacheKey);
        if (cachedReadiness) {
          console.log('📊 Using cached readiness for', today);
          setTodayReadiness(cachedReadiness);
          return;
        }
      } else {
        // Force refresh: clear existing cache
        await db.cache.delete(cacheKey);
        console.log('🗑️ Cleared cached readiness for', today);
      }

      console.log('🔄 Computing readiness for', today);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const startDate = formatDateISO(sevenDaysAgo);

      console.log('📅 Fetching wellness from', startDate, 'to', today);

      // Fetch wellness data for last 7 days (for baseline) + today
      // When useCache=false (user clicked sync), force refresh from API
      const wellnessData = await intervalsApi.getWellnessData(startDate, today, false, !useCache);

      console.log('📊 Wellness data received:', wellnessData?.length || 0, 'records');

      if (wellnessData && wellnessData.length > 0) {
        // Find today's data
        const todayData = wellnessData.find(w => w.id === today);

        console.log('📊 Today\'s wellness data:', todayData ? 'found' : 'not found', todayData?.id);

        if (todayData) {
          // Calculate baseline from last 7 days (excluding today)
          const recentData = wellnessData.filter(w => w.id !== today);
          console.log('📊 Baseline data:', recentData.length, 'records');

          const baseline = calculateWellnessBaseline(recentData);

          // Analyze readiness
          const readiness = analyzeWellnessReadiness(todayData, baseline);

          console.log('✅ Readiness computed:', readiness.status, 'score:', readiness.score);

          // Cache the computed readiness for 24 hours
          await db.setCached(cacheKey, readiness, 24 * 60 * 60 * 1000);
          console.log('✅ Cached readiness for', today);

          setTodayReadiness(readiness);
        } else {
          console.warn('⚠️ No wellness data found for', today);
          const noDataReadiness = {
            score: null,
            status: 'unknown',
            message: `No wellness data for ${today}`,
            insights: ['💡 Sync wellness data from Intervals.icu'],
            metrics: {},
          };
          setTodayReadiness(noDataReadiness);
        }
      } else {
        console.warn('⚠️ No wellness data returned from API');
        const noDataReadiness = {
          score: null,
          status: 'unknown',
          message: 'No wellness data available',
          insights: ['💡 Check database or sync from Intervals.icu'],
          metrics: {},
        };
        setTodayReadiness(noDataReadiness);
      }
    } catch (error) {
      console.error('❌ Error fetching wellness data:', error);
      setTodayReadiness({
        score: null,
        status: 'error',
        message: 'Error loading wellness data',
        insights: [`⚠️ ${error.message}`],
        metrics: {},
      });
    }
  };

  useEffect(() => {
    const calculateStats = async () => {
      // Get cycle statistics
      const stats = getCycleStats();
      setCycleStats(stats);

      // Calculate current week stats (even if no activities)
      const weekRange = getCurrentWeek();
      const thisWeekActivities = activities.filter(a => {
        const activityDate = new Date(a.start_date_local).toISOString().split('T')[0];
        return activityDate >= weekRange.startDate && activityDate <= weekRange.endDate;
      });

      // Load intervals from database (fast, no API calls needed)
      const activitiesWithIntervals = await intervalsApi.attachIntervalsFromDB(thisWeekActivities);

      // Fetch any missing intervals from API (only if not in database)
      const missingIntervals = activitiesWithIntervals.filter(a => !a.intervals || a.intervals.length === 0);
      if (missingIntervals.length > 0) {
        await Promise.all(
          missingIntervals.map(async (activity) => {
            try {
              const intervalData = await intervalsApi.getActivityIntervals(activity.id);
              activity.intervals = intervalData?.icu_intervals || [];
            } catch (error) {
              console.error(`Failed to fetch intervals for activity ${activity.id}:`, error);
            }
          })
        );
      }

      const weeklyVolume = calculateWeeklyVolume(activitiesWithIntervals);
      const kmAtMP = calculateKmAtMarathonPace(activitiesWithIntervals, '4:02/km', 6);

      // Get weekly MP target based on current phase
      const mpTarget = getWeeklyMPTarget(stats.currentWeek);

      setWeeklyStats({
        totalKm: weeklyVolume[0]?.totalKm || 0,
        kmAtMP: kmAtMP || 0,
        mpTarget: mpTarget.target,
        mpMin: mpTarget.min,
        mpMax: mpTarget.max,
        sessions: thisWeekActivities.length,
        avgLoad: weeklyVolume[0]?.totalLoad || 0,
      });
    };

    calculateStats();
  }, [activities]);

  // Fetch wellness data on mount
  useEffect(() => {
    fetchTodayWellness();
  }, []);

  const latestAnalysis = getLatest();

  if (activitiesLoading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading training data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="card bg-gradient-to-br from-primary-600 to-primary-700 text-white">
        <h2 className="text-2xl font-bold mb-2">Porto Alegre 2026</h2>
        <p className="text-primary-100 mb-4">Goal: 2h50min (4:02/km)</p>
        {cycleStats && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-100">Training Week</p>
                <p className="text-3xl font-bold">{cycleStats.currentWeek}/{cycleStats.totalWeeks}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-primary-100">Phase</p>
                <p className="text-lg font-semibold">{cycleStats.phase}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-primary-100">{cycleStats.weeksToRace} weeks to race</span>
              <span className="text-primary-100">{cycleStats.daysToRace} days</span>
            </div>
            <div className="w-full bg-primary-800 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all"
                style={{ width: `${cycleStats.percentComplete}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Today's Readiness */}
      {todayReadiness && (
        <div className={`card p-3 ${
          todayReadiness.status === 'excellent' ? 'bg-green-50 border-green-200' :
          todayReadiness.status === 'good' ? 'bg-blue-50 border-blue-200' :
          todayReadiness.status === 'moderate' ? 'bg-yellow-50 border-yellow-200' :
          todayReadiness.status === 'poor' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Today:</span>
              <span className={`text-sm font-semibold ${
                todayReadiness.status === 'excellent' ? 'text-green-700' :
                todayReadiness.status === 'good' ? 'text-blue-700' :
                todayReadiness.status === 'moderate' ? 'text-yellow-700' :
                todayReadiness.status === 'poor' ? 'text-red-700' :
                'text-gray-600'
              }`}>
                {todayReadiness.message}
              </span>
              {todayReadiness.score !== null && (
                <span className={`text-xs font-medium ${
                  todayReadiness.status === 'excellent' ? 'text-green-600' :
                  todayReadiness.status === 'good' ? 'text-blue-600' :
                  todayReadiness.status === 'moderate' ? 'text-yellow-600' :
                  todayReadiness.status === 'poor' ? 'text-red-600' :
                  'text-gray-500'
                }`}>
                  ({todayReadiness.score}/100)
                </span>
              )}
            </div>
          </div>

          {/* Compact Wellness Metrics */}
          <div className="grid grid-cols-6 gap-2 text-xs">
            {/* TSB */}
            <div className="text-center">
              <p className="text-gray-500">TSB</p>
              <p className={`text-sm font-semibold ${
                todayReadiness.metrics.form !== undefined
                  ? todayReadiness.metrics.form < -10 ? 'text-red-600'
                  : todayReadiness.metrics.form > 5 ? 'text-green-600'
                  : 'text-gray-900'
                  : 'text-gray-400'
              }`}>
                {todayReadiness.metrics.form !== undefined
                  ? `${todayReadiness.metrics.form > 0 ? '+' : ''}${todayReadiness.metrics.form.toFixed(0)}`
                  : '—'}
              </p>
            </div>

            {/* HR */}
            <div className="text-center">
              <p className="text-gray-500">HR</p>
              <p className={`text-sm font-semibold ${
                todayReadiness.metrics.restingHR !== undefined
                  ? 'text-gray-900'
                  : 'text-gray-400'
              }`}>
                {todayReadiness.metrics.restingHR !== undefined
                  ? todayReadiness.metrics.restingHR.toFixed(0)
                  : '—'}
              </p>
            </div>

            {/* HRV */}
            <div className="text-center">
              <p className="text-gray-500">HRV</p>
              <p className={`text-sm font-semibold ${
                todayReadiness.metrics.hrv !== undefined
                  ? 'text-gray-900'
                  : 'text-gray-400'
              }`}>
                {todayReadiness.metrics.hrv !== undefined
                  ? todayReadiness.metrics.hrv.toFixed(0)
                  : '—'}
              </p>
            </div>

            {/* Sleep */}
            <div className="text-center">
              <p className="text-gray-500">Sleep</p>
              <p className={`text-sm font-semibold ${
                todayReadiness.metrics.sleepHours !== undefined
                  ? todayReadiness.metrics.sleepHours < 6 ? 'text-red-600'
                  : todayReadiness.metrics.sleepHours >= 8 ? 'text-green-600'
                  : 'text-gray-900'
                  : 'text-gray-400'
              }`}>
                {todayReadiness.metrics.sleepHours !== undefined
                  ? `${todayReadiness.metrics.sleepHours.toFixed(1)}h`
                  : '—'}
              </p>
            </div>

            {/* Quality */}
            <div className="text-center">
              <p className="text-gray-500">Qual</p>
              <p className={`text-sm font-semibold ${
                todayReadiness.metrics.sleepQuality !== undefined
                  ? todayReadiness.metrics.sleepQuality <= 2 ? 'text-red-600'
                  : todayReadiness.metrics.sleepQuality >= 4 ? 'text-green-600'
                  : 'text-gray-900'
                  : 'text-gray-400'
              }`}>
                {todayReadiness.metrics.sleepQuality !== undefined
                  ? `${todayReadiness.metrics.sleepQuality}/5`
                  : '—'}
              </p>
            </div>

            {/* Weight */}
            <div className="text-center">
              <p className="text-gray-500">Wt</p>
              <p className={`text-sm font-semibold ${
                todayReadiness.metrics.weight !== undefined
                  ? 'text-gray-900'
                  : 'text-gray-400'
              }`}>
                {todayReadiness.metrics.weight !== undefined
                  ? todayReadiness.metrics.weight.toFixed(1)
                  : '—'}
              </p>
            </div>
          </div>

          {/* Insights */}
          {todayReadiness.insights.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="space-y-0.5">
                {todayReadiness.insights.map((insight, idx) => (
                  <p key={idx} className="text-xs text-gray-600">
                    • {insight}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* This Week Stats */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">This Week</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="metric-card">
            <p className="text-sm text-gray-600 mb-1">Total Distance</p>
            <p className="text-2xl font-bold text-gray-900">
              {weeklyStats?.totalKm.toFixed(1) || '0.0'} km
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-gray-600 mb-1">Sessions</p>
            <p className="text-2xl font-bold text-gray-900">
              {weeklyStats?.sessions || 0}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-gray-600 mb-1">KM at Marathon Pace</p>
            <p className="text-2xl font-bold text-primary-600">
              {weeklyStats?.kmAtMP.toFixed(1) || '0.0'} km
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Target: {weeklyStats?.mpMin || 10}-{weeklyStats?.mpMax || 20} km/week
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-gray-600 mb-1">Training Load</p>
            <p className="text-2xl font-bold text-gray-900">
              {weeklyStats?.avgLoad.toFixed(0) || '0'}
            </p>
          </div>
        </div>
        {weeklyStats && weeklyStats.sessions === 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 mb-2">
              No activities found this week. Missing today's workout?
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {syncing ? '⏳ Syncing...' : '🔄 Sync from API'}
            </button>
          </div>
        )}
      </div>

      {/* Latest Coach Analysis */}
      {latestAnalysis && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Latest Coach Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {latestAnalysis.metadata.activityName}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                latestAnalysis.verdict.rating === 'excellent' ? 'bg-green-100 text-green-800' :
                latestAnalysis.verdict.rating === 'good' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {latestAnalysis.verdict.rating}
              </span>
            </div>
            <p className="text-sm text-gray-700">
              {latestAnalysis.verdict.summary}
            </p>

            {/* Next Session(s) with Adaptive Guidance */}
            {latestAnalysis.recommendations?.nextSession && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Tomorrow's Sessions:</p>
                {(() => {
                  // Support both single session object and array of sessions
                  const sessions = Array.isArray(latestAnalysis.recommendations.nextSession)
                    ? latestAnalysis.recommendations.nextSession
                    : [latestAnalysis.recommendations.nextSession];

                  return sessions.map((session, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        session.timeOfDay === 'PM' || session.optional
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-primary-50 border-primary-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-medium ${
                            session.timeOfDay === 'PM' || session.optional
                              ? 'text-blue-900'
                              : 'text-primary-900'
                          }`}>
                            {session.timeOfDay || 'Morning'} - {session.type}
                          </p>
                          {(session.optional || session.timeOfDay === 'PM') && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded font-medium">
                              Optional
                            </span>
                          )}
                        </div>
                        <span className={`text-xs ${
                          session.timeOfDay === 'PM' || session.optional
                            ? 'text-blue-600'
                            : 'text-primary-600'
                        }`}>
                          {session.date}
                        </span>
                      </div>
                      <p className={`text-sm leading-relaxed ${
                        session.timeOfDay === 'PM' || session.optional
                          ? 'text-blue-800'
                          : 'text-primary-800'
                      }`}>
                        {session.workout}
                      </p>
                      {session.rationale && (
                        <p className={`text-xs mt-2 pt-2 border-t ${
                          session.timeOfDay === 'PM' || session.optional
                            ? 'text-blue-700 border-blue-200'
                            : 'text-primary-700 border-primary-200'
                        }`}>
                          💡 {session.rationale}
                        </p>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Activities */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Activities</h3>
        {activities.length === 0 ? (
          <p className="text-gray-500 text-sm">No activities found. Check your settings.</p>
        ) : (
          <div className="space-y-2">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{activity.name || 'Run'}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.start_date_local).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {((activity.distance || 0) / 1000).toFixed(1)} km
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.icu_training_load || activity.training_load || 0} TSS
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
