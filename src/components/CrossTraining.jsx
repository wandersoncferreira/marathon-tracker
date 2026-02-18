import { useState, useEffect } from 'react';
import {
  getStrengthStats,
  getCyclingStats,
  getStrengthRecommendations
} from '../services/crossTrainingService';

const MARATHON_CYCLE_START = '2026-01-19';
const TODAY = new Date().toISOString().split('T')[0];

export default function CrossTraining() {
  const [strengthStats, setStrengthStats] = useState(null);
  const [cyclingStats, setCyclingStats] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('strength'); // 'strength' or 'cycling'

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Load data from marathon cycle start to today
      const [strength, cycling, recs] = await Promise.all([
        getStrengthStats(MARATHON_CYCLE_START, TODAY),
        getCyclingStats(MARATHON_CYCLE_START, TODAY),
        getStrengthRecommendations(TODAY)
      ]);

      setStrengthStats(strength);
      setCyclingStats(cycling);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading cross training data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cross training data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Cross Training
        </h2>
        <p className="text-gray-600">
          Track strength training and cycling with running equivalency calculations
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('strength')}
              className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'strength'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💪 Strength Training
            </button>
            <button
              onClick={() => setActiveTab('cycling')}
              className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'cycling'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🚴 Cycling
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'strength' ? (
            <StrengthTrainingTab
              stats={strengthStats}
              recommendations={recommendations}
            />
          ) : (
            <CyclingTab stats={cyclingStats} />
          )}
        </div>
      </div>
    </div>
  );
}

function StrengthTrainingTab({ stats, recommendations }) {
  if (!stats || !recommendations) {
    return <div className="text-gray-600">No strength training data available</div>;
  }

  // Calculate current week stats
  const weekKeys = Object.keys(stats.byWeek).sort();
  const currentWeekKey = weekKeys.length > 0 ? weekKeys[weekKeys.length - 1] : null;
  const currentWeek = currentWeekKey ? stats.byWeek[currentWeekKey] : { sessions: 0, minutes: 0 };

  const [minRec, maxRec] = recommendations.weeklyMinutes;
  const weeklyProgress = (currentWeek.minutes / maxRec) * 100;

  return (
    <div className="space-y-6">
      {/* Current Phase */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          Current Phase: {recommendations.currentPhase}
        </h3>
        <p className="text-sm text-blue-800 mb-2">
          Week {recommendations.weeksInCycle} of {recommendations.totalWeeks}
        </p>
        <p className="text-sm text-blue-700">{recommendations.focus}</p>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">This Week</div>
          <div className="text-2xl font-bold text-gray-900">
            {currentWeek.minutes} min
          </div>
          <div className="text-sm text-gray-500">
            {currentWeek.sessions} sessions
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Recommended</div>
          <div className="text-2xl font-bold text-gray-900">
            {minRec}-{maxRec} min
          </div>
          <div className="text-sm text-gray-500">per week</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total (Cycle)</div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.total.hours} hrs
          </div>
          <div className="text-sm text-gray-500">
            {stats.total.sessions} sessions
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Weekly Progress
          </span>
          <span className="text-sm text-gray-600">
            {weeklyProgress.toFixed(0)}% of max
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              weeklyProgress >= 100
                ? 'bg-green-500'
                : weeklyProgress >= 66
                ? 'bg-blue-500'
                : weeklyProgress >= 33
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* Recommendations */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">
          Recommended Exercises
        </h4>
        <ul className="space-y-2">
          {recommendations.exercises.map((exercise, idx) => (
            <li key={idx} className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span className="text-gray-700">{exercise}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Rationale */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">
          Why This Matters
        </h4>
        <p className="text-sm text-yellow-800 mb-3">
          {recommendations.rationale}
        </p>
        <div className="text-xs text-yellow-700 space-y-1">
          <p className="font-semibold">Research References:</p>
          {recommendations.references.map((ref, idx) => (
            <p key={idx}>• {ref}</p>
          ))}
        </div>
      </div>

      {/* Monthly Breakdown */}
      {Object.keys(stats.byMonth).length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Monthly Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Month
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sessions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(stats.byMonth)
                  .sort()
                  .reverse()
                  .map(([month, data]) => (
                    <tr key={month}>
                      <td className="px-4 py-3 text-sm text-gray-900">{month}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {data.sessions}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {data.minutes} min ({(data.minutes / 60).toFixed(1)} hrs)
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.total.sessions === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">
            No strength training sessions recorded yet. Start tracking your gym workouts by uploading them to Intervals.icu with "Strength", "Gym", or "Weights" in the activity name.
          </p>
        </div>
      )}
    </div>
  );
}

function CyclingTab({ stats }) {
  if (!stats) {
    return <div className="text-gray-600">No cycling data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cycling Totals */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🚴</span> Cycling Totals
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Sessions:</span>
              <span className="font-medium">{stats.totals.cycling.sessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Distance:</span>
              <span className="font-medium">{stats.totals.cycling.km} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">
                {(stats.totals.cycling.minutes / 60).toFixed(1)} hours
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">TSS:</span>
              <span className="font-medium">{stats.totals.cycling.tss}</span>
            </div>
          </div>
        </div>

        {/* Running Equivalent */}
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-4 flex items-center">
            <span className="mr-2">🏃</span> Running Equivalent
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-blue-700">Distance:</span>
              <span className="font-medium text-blue-900">
                ~{stats.totals.runningEquivalent.km} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Time:</span>
              <span className="font-medium text-blue-900">
                ~{(stats.totals.runningEquivalent.minutes / 60).toFixed(1)} hours
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">TSS:</span>
              <span className="font-medium text-blue-900">
                ~{stats.totals.runningEquivalent.tss}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-xs text-blue-700">
              Based on intensity-adjusted conversion factors from Millet et al. (2009)
            </p>
          </div>
        </div>
      </div>

      {/* Activity List */}
      {stats.activities.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Cycling Sessions</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Distance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Avg Power
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Running Equiv.
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.activities.map((activity, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(activity.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {activity.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {activity.distance} km
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {activity.duration} min
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {activity.avgPower}W
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-blue-700 font-medium whitespace-nowrap">
                        ~{activity.runningEquivalent.runningDistanceKm} km
                      </div>
                      <div className="text-xs text-gray-500">
                        {activity.runningEquivalent.intensityZone}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.activities.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">
            No cycling activities recorded yet. Your cycling sessions from Intervals.icu will appear here automatically.
          </p>
        </div>
      )}

      {/* Formula Explanation */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">
          How Running Equivalency Works
        </h4>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Conversion factors based on intensity:</strong>
          </p>
          <ul className="ml-4 space-y-1">
            <li>• Easy/Recovery (&lt;75% FTP): 0.25-0.30 × cycling distance</li>
            <li>• Tempo (75-85% FTP): 0.30-0.35 × cycling distance</li>
            <li>• Threshold (85-95% FTP): 0.35-0.40 × cycling distance</li>
            <li>• VO2max (&gt;95% FTP): 0.40-0.45 × cycling distance</li>
          </ul>
          <p className="mt-3">
            <strong>TSS adjustment:</strong> Running TSS ≈ Cycling TSS × 1.15
            (accounts for higher impact stress)
          </p>
          <p className="mt-3">
            <strong>Research basis:</strong> Millet et al. (2009) - Comparative analysis of physiological responses during cycling and running at matched intensities.
          </p>
        </div>
      </div>
    </div>
  );
}
