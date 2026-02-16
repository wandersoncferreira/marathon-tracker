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
  // Use training cycle activities for main metrics (weekly progress, totals, fitness)
  const { activities, loading } = useActivities(90, true, true); // Use full training cycle
  const { analyses } = useAnalyses();
  const [weeklyData, setWeeklyData] = useState([]);
  const [totalStats, setTotalStats] = useState(null);
  const [cycleStats, setCycleStats] = useState(null);
  const [fitnessData, setFitnessData] = useState([]);
  const [hrByPaceData, setHrByPaceData] = useState([]);
  const [historicalActivities, setHistoricalActivities] = useState([]);
  const [syncingHistorical, setSyncingHistorical] = useState(false);
  const [activityDetails, setActivityDetails] = useState({}); // Store activities by trimester and pace
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [selectedPaceGroup, setSelectedPaceGroup] = useState(null); // null = show all
  const [trendLineData, setTrendLineData] = useState([]);
  const [trendStats, setTrendStats] = useState(null);

  // Load historical activities from Jan 1, 2025 ONLY for HR by Pace chart
  useEffect(() => {
    async function loadHistoricalActivities() {
      try {
        const startDate = '2025-01-01';
        const today = formatDateISO(new Date());

        // Check if we have data in database first
        let allActivities = await intervalsApi.getActivities(startDate, today);

        // If database is empty or has very few activities, sync from API
        if (allActivities.length < 10) {
          console.log('Syncing historical activities from Intervals.icu API for HR by Pace chart...');
          allActivities = await intervalsApi.syncActivities(startDate, today);
        }

        const runningActivities = allActivities
          .filter(a => a.type === 'Run')
          .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));
        setHistoricalActivities(runningActivities);
      } catch (error) {
        console.error('Error loading historical activities:', error);
      }
    }
    loadHistoricalActivities();
  }, []);

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

  // Calculate HR by Pace data separately using historical activities
  useEffect(() => {
    if (historicalActivities.length > 0) {
      const hrByPace = calculateHRByPace(historicalActivities);
      setHrByPaceData(hrByPace);
    }
  }, [historicalActivities]);

  // Calculate trend line when pace group is selected
  useEffect(() => {
    if (selectedPaceGroup && hrByPaceData.length > 0) {
      calculateTrendLine(selectedPaceGroup);
    } else {
      setTrendLineData([]);
      setTrendStats(null);
    }
  }, [selectedPaceGroup, hrByPaceData]);

  // Calculate linear regression trend line
  const calculateTrendLine = (paceGroup) => {
    // Filter data points that have values for this pace group
    const dataPoints = hrByPaceData
      .map((point, index) => ({ x: index, y: point[paceGroup], bimester: point.trimester }))
      .filter(point => point.y !== undefined && point.y !== null);

    if (dataPoints.length < 2) {
      setTrendLineData([]);
      setTrendStats(null);
      return;
    }

    // Calculate linear regression: y = mx + b
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0);
    const sumXY = dataPoints.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = dataPoints.reduce((sum, point) => sum + point.x * point.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate trend line points - merge with hrByPaceData
    const trendLine = hrByPaceData.map((point, index) => ({
      ...point,
      trend: intercept + slope * index
    }));

    setTrendLineData(trendLine);

    // Calculate improvement metrics
    const firstHR = dataPoints[0].y;
    const lastHR = dataPoints[dataPoints.length - 1].y;
    const totalChange = lastHR - firstHR;
    const changePerBimester = slope;
    const percentChange = ((totalChange / firstHR) * 100);

    // Calculate time span
    const timeSpanBimesters = dataPoints.length - 1;
    const timeSpanMonths = timeSpanBimesters * 2;

    setTrendStats({
      slope: changePerBimester,
      totalChange,
      percentChange,
      timeSpanBimesters,
      timeSpanMonths,
      firstHR,
      lastHR,
      improving: slope < 0 // Negative slope = lower HR over time = better fitness
    });
  };


  // Custom dot component with click handler
  const CustomDot = (props) => {
    const { cx, cy, payload, dataKey, stroke } = props;

    // Only render if there's data for this point
    if (!payload || payload[dataKey] === undefined || payload[dataKey] === null) {
      return null;
    }

    const handleDotClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bimester = payload.trimester; // Property name is 'trimester' but value is bimester (B1_2025, etc)
      const paceLabel = dataKey; // dataKey is the pace range like "4:00-4:15"

      const activities = activityDetails[bimester]?.[paceLabel] || [];

      if (activities.length > 0) {
        setModalData({
          trimester: bimester, // Keep property name as 'trimester' for consistency
          paceGroup: paceLabel,
          activities,
        });
        setShowModal(true);
      }
    };

    return (
      <g>
        {/* Larger invisible clickable area */}
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="transparent"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onClick={handleDotClick}
        />
        {/* Visible dot */}
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill={stroke}
          stroke="white"
          strokeWidth={2}
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onClick={handleDotClick}
        />
      </g>
    );
  };

  // Sync historical data from API (complete sync)
  const handleSyncHistorical = async () => {
    setSyncingHistorical(true);
    try {
      const startDate = '2025-01-01';
      const today = formatDateISO(new Date());

      console.log('🔄 Step 1/4: Syncing activities from 2025-01-01...');
      const allActivities = await intervalsApi.syncActivities(startDate, today);

      const runningActivities = allActivities
        .filter(a => a.type === 'Run')
        .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));

      console.log(`✅ Synced ${runningActivities.length} running activities`);

      // Sync intervals for all activities (in batches)
      console.log('🔄 Step 2/4: Syncing activity intervals...');
      const batchSize = 5;
      for (let i = 0; i < runningActivities.length; i += batchSize) {
        const batch = runningActivities.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (activity) => {
            try {
              await intervalsApi.getActivityIntervals(activity.id, false); // Force API fetch
            } catch (error) {
              console.error(`Failed to fetch intervals for activity ${activity.id}:`, error);
            }
          })
        );
        // Progress indicator
        console.log(`  ... ${Math.min(i + batchSize, runningActivities.length)}/${runningActivities.length} activities`);
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < runningActivities.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Sync messages for all activities
      console.log('🔄 Step 3/4: Syncing activity messages...');
      await intervalsApi.syncActivityMessages(runningActivities);

      // Sync wellness data
      console.log('🔄 Step 4/4: Syncing wellness data...');
      await intervalsApi.getWellnessData(startDate, today, false); // Force API fetch

      console.log('✅ Complete sync finished!');

      setHistoricalActivities(runningActivities);
      alert(`Successfully synced ${runningActivities.length} activities with all details from 2025-01-01!`);
    } catch (error) {
      console.error('Error syncing historical data:', error);
      alert('Error syncing historical data: ' + error.message);
    } finally {
      setSyncingHistorical(false);
    }
  };

  // Calculate average HR for different pace groups over time (by bimester)
  const calculateHRByPace = (activities) => {
    // Define pace ranges (in seconds per km) - 15 second intervals
    const paceRanges = [
      { min: 240, max: 255, label: '4:00-4:15' }, // 240s = 4:00, 255s = 4:15
      { min: 255, max: 270, label: '4:15-4:30' },
      { min: 270, max: 285, label: '4:30-4:45' },
      { min: 285, max: 300, label: '4:45-5:00' },
      { min: 300, max: 315, label: '5:00-5:15' },
    ];

    // Function to get bimester label from date
    const getBimester = (dateString) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12

      let bimester;
      if (month >= 1 && month <= 2) bimester = 1;  // Jan-Feb
      else if (month >= 3 && month <= 4) bimester = 2;  // Mar-Apr
      else if (month >= 5 && month <= 6) bimester = 3;  // May-Jun
      else if (month >= 7 && month <= 8) bimester = 4;  // Jul-Aug
      else if (month >= 9 && month <= 10) bimester = 5; // Sep-Oct
      else bimester = 6; // Nov-Dec

      return `B${bimester}_${year}`;
    };

    // Group activities by bimester and pace range
    const dataByBimester = {};
    const activityDetailsByBimester = {}; // Store activities for modal

    activities.forEach(activity => {
      if (!activity.average_speed || !activity.average_heartrate) return;

      const bimester = getBimester(activity.start_date_local);
      const paceSeconds = 1000 / activity.average_speed; // Convert m/s to s/km
      const hr = activity.average_heartrate;

      // Find which pace range this activity falls into
      const paceRange = paceRanges.find(range => paceSeconds >= range.min && paceSeconds < range.max);
      if (!paceRange) return;

      // Initialize bimester entry if needed
      if (!dataByBimester[bimester]) {
        dataByBimester[bimester] = {};
        activityDetailsByBimester[bimester] = {};
        paceRanges.forEach(range => {
          dataByBimester[bimester][range.label] = { hrs: [], avg: null };
          activityDetailsByBimester[bimester][range.label] = [];
        });
      }

      // Add HR to this pace range for this bimester
      dataByBimester[bimester][paceRange.label].hrs.push(hr);

      // Store activity details for modal
      activityDetailsByBimester[bimester][paceRange.label].push({
        id: activity.id,
        name: activity.name,
        date: activity.start_date_local,
        distance: activity.distance,
        pace: paceSeconds,
        hr: hr,
        avgPower: activity.average_watts,
      });
    });

    // Store activity details globally for modal access
    setActivityDetails(activityDetailsByBimester);

    // Generate complete list of bimesters from B1_2025 to current
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    let currentBim;
    if (currentMonth <= 2) currentBim = 1;
    else if (currentMonth <= 4) currentBim = 2;
    else if (currentMonth <= 6) currentBim = 3;
    else if (currentMonth <= 8) currentBim = 4;
    else if (currentMonth <= 10) currentBim = 5;
    else currentBim = 6;

    const allBimesters = [];
    for (let year = 2025; year <= currentYear; year++) {
      const maxBim = year === currentYear ? currentBim : 6;
      for (let bim = 1; bim <= maxBim; bim++) {
        allBimesters.push(`B${bim}_${year}`);
      }
    }

    // Calculate averages and format for chart - include ALL bimesters
    const chartData = allBimesters.map(bimester => {
      const entry = { trimester: bimester }; // Keep property name as 'trimester' for XAxis dataKey

      if (dataByBimester[bimester]) {
        paceRanges.forEach(range => {
          const hrs = dataByBimester[bimester][range.label].hrs;
          if (hrs.length > 0) {
            entry[range.label] = Math.round(hrs.reduce((sum, hr) => sum + hr, 0) / hrs.length);
          }
        });
      }

      return entry;
    });

    return chartData;
  };

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

      {/* Heart Rate by Pace Chart */}
      <div className="card">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Heart Rate by Pace Group (Bimester Trends)</h3>
            <p className="text-xs text-gray-500">
              Average heart rate at different training paces per 2-month period. Lower HR at same pace = improved fitness.
            </p>
          </div>
          <button
            onClick={handleSyncHistorical}
            disabled={syncingHistorical}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 whitespace-nowrap ml-4"
            title="Sync all activities, intervals, messages, and wellness data from 2025-01-01"
          >
            {syncingHistorical ? '⏳ Syncing...' : '🔄 Sync All Data'}
          </button>
        </div>

        {/* Pace Group Selector */}
        <div className="mb-4 flex items-center gap-3">
          <label htmlFor="paceGroupSelect" className="text-sm font-medium text-gray-700">
            Focus on pace:
          </label>
          <select
            id="paceGroupSelect"
            value={selectedPaceGroup || ''}
            onChange={(e) => setSelectedPaceGroup(e.target.value || null)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All pace groups</option>
            <option value="4:00-4:15">4:00-4:15 /km</option>
            <option value="4:15-4:30">4:15-4:30 /km</option>
            <option value="4:30-4:45">4:30-4:45 /km</option>
            <option value="4:45-5:00">4:45-5:00 /km</option>
            <option value="5:00-5:15">5:00-5:15 /km</option>
          </select>
        </div>

        {/* Trend Stats */}
        {trendStats && (
          <div className={`mb-4 p-3 rounded-lg ${trendStats.improving ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {trendStats.improving ? '✅ Fitness Improving' : '⚠️ Fitness Declining'}
                </p>
                <p className="text-xs text-gray-600">
                  Pace range: {selectedPaceGroup} /km
                </p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${trendStats.improving ? 'text-green-600' : 'text-yellow-600'}`}>
                  {trendStats.totalChange > 0 ? '+' : ''}{trendStats.totalChange.toFixed(1)} bpm
                </p>
                <p className="text-xs text-gray-600">
                  over {trendStats.timeSpanMonths} months
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-gray-600">Rate of change</p>
                <p className="font-semibold text-gray-900">
                  {trendStats.slope > 0 ? '+' : ''}{trendStats.slope.toFixed(2)} bpm/bimester
                </p>
              </div>
              <div>
                <p className="text-gray-600">Starting HR</p>
                <p className="font-semibold text-gray-900">{Math.round(trendStats.firstHR)} bpm</p>
              </div>
              <div>
                <p className="text-gray-600">Current HR</p>
                <p className="font-semibold text-gray-900">{Math.round(trendStats.lastHR)} bpm</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Interpretation:</span> {trendStats.improving
                  ? `Your heart rate at this pace is decreasing by ${Math.abs(trendStats.slope).toFixed(2)} bpm every 2 months, indicating improved aerobic efficiency.`
                  : `Your heart rate at this pace is increasing by ${Math.abs(trendStats.slope).toFixed(2)} bpm every 2 months. Consider reviewing training load and recovery.`
                }
              </p>
            </div>
          </div>
        )}

        {hrByPaceData.length > 0 ? (
          <>
            {selectedPaceGroup && trendStats === null && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  No data available for pace group {selectedPaceGroup} /km. Try selecting a different pace range.
                </p>
              </div>
            )}
            <div style={{ width: '100%', height: '300px', position: 'relative' }}>
              <ResponsiveContainer>
                <LineChart
                  data={selectedPaceGroup && trendLineData.length > 0 ? trendLineData : hrByPaceData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="trimester"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                    domain={['dataMin - 5', 'dataMax + 5']}
                  />
                  <Tooltip
                    offset={15}
                    allowEscapeViewBox={{ x: true, y: true }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      pointerEvents: 'none',
                      zIndex: 1000
                    }}
                    wrapperStyle={{
                      pointerEvents: 'none',
                      zIndex: 1000
                    }}
                    labelFormatter={(label) => {
                      // Format B1_2025 as "Bimester 1 2025"
                      const [bimester, year] = label.split('_');
                      const bimNumber = bimester.replace('B', '');
                      const months = ['Jan-Feb', 'Mar-Apr', 'May-Jun', 'Jul-Aug', 'Sep-Oct', 'Nov-Dec'];
                      return `${months[bimNumber - 1]} ${year}`;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {(!selectedPaceGroup || selectedPaceGroup === '4:00-4:15') && (
                    <Line
                      type="monotone"
                      dataKey="4:00-4:15"
                      stroke="#dc2626"
                      strokeWidth={2}
                      name="4:00-4:15 /km"
                      dot={<CustomDot />}
                      activeDot={false}
                      connectNulls
                    />
                  )}
                  {(!selectedPaceGroup || selectedPaceGroup === '4:15-4:30') && (
                    <Line
                      type="monotone"
                      dataKey="4:15-4:30"
                      stroke="#ea580c"
                      strokeWidth={2}
                      name="4:15-4:30 /km"
                      dot={<CustomDot />}
                      activeDot={false}
                      connectNulls
                    />
                  )}
                  {(!selectedPaceGroup || selectedPaceGroup === '4:30-4:45') && (
                    <Line
                      type="monotone"
                      dataKey="4:30-4:45"
                      stroke="#d97706"
                      strokeWidth={2}
                      name="4:30-4:45 /km"
                      dot={<CustomDot />}
                      activeDot={false}
                      connectNulls
                    />
                  )}
                  {(!selectedPaceGroup || selectedPaceGroup === '4:45-5:00') && (
                    <Line
                      type="monotone"
                      dataKey="4:45-5:00"
                      stroke="#2563eb"
                      strokeWidth={2}
                      name="4:45-5:00 /km"
                      dot={<CustomDot />}
                      activeDot={false}
                      connectNulls
                    />
                  )}
                  {(!selectedPaceGroup || selectedPaceGroup === '5:00-5:15') && (
                    <Line
                      type="monotone"
                      dataKey="5:00-5:15"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      name="5:00-5:15 /km"
                      dot={<CustomDot />}
                      activeDot={false}
                      connectNulls
                    />
                  )}
                  {/* Trend line when pace group is selected */}
                  {selectedPaceGroup && trendLineData.length > 0 && (
                    <Line
                      type="monotone"
                      dataKey="trend"
                      stroke="#000000"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Trend Line"
                      dot={false}
                      activeDot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className="text-gray-600">4:00-4:15 /km</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ea580c' }}></div>
                  <span className="text-gray-600">4:15-4:30 /km</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#d97706' }}></div>
                  <span className="text-gray-600">4:30-4:45 /km</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <span className="text-gray-600">4:45-5:00 /km</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-violet-600"></div>
                  <span className="text-gray-600">5:00-5:15 /km</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 italic">
                Each point represents the average heart rate across all runs in that pace range during a 2-month period.
                B1 = Jan-Feb, B2 = Mar-Apr, B3 = May-Jun, B4 = Jul-Aug, B5 = Sep-Oct, B6 = Nov-Dec
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No historical data yet</p>
            <p className="text-xs text-gray-400 mb-4">
              Click "Sync All Data" above to download all activities, intervals, messages, and wellness data from 2025-01-01 onwards.
              This may take a few minutes depending on how many activities you have.
            </p>
          </div>
        )}
      </div>

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

      {/* Modal for Activity Details */}
      {showModal && modalData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-primary-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {(() => {
                    const [bim, year] = modalData.trimester.split('_');
                    const bimNumber = bim.replace('B', '');
                    const months = ['Jan-Feb', 'Mar-Apr', 'May-Jun', 'Jul-Aug', 'Sep-Oct', 'Nov-Dec'];
                    return `${months[bimNumber - 1]} ${year}`;
                  })()}
                </h3>
                <p className="text-sm text-primary-100">
                  Pace: {modalData.paceGroup} /km ({modalData.activities.length} activities)
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-primary-100 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6">
              <div className="space-y-3">
                {modalData.activities.map((activity) => {
                  const distanceKm = (activity.distance / 1000).toFixed(2);
                  const paceMinutes = Math.floor(activity.pace / 60);
                  const paceSeconds = Math.round(activity.pace % 60);
                  const paceStr = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
                  const dateStr = new Date(activity.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <div key={activity.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {activity.name || 'Run'}
                          </h4>
                          <p className="text-xs text-gray-500">{dateStr}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-600">Distance</p>
                          <p className="font-semibold text-gray-900">{distanceKm} km</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Pace</p>
                          <p className="font-semibold text-gray-900">{paceStr} /km</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Avg HR</p>
                          <p className="font-semibold text-gray-900">{Math.round(activity.hr)} bpm</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Power</p>
                          <p className="font-semibold text-gray-900">
                            {activity.avgPower ? `${Math.round(activity.avgPower)}W` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProgressTracker;
