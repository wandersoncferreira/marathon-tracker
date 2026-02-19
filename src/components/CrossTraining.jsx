import { useState, useEffect } from 'react';
import {
  getStrengthStats,
  getCyclingStats,
  getStrengthRecommendations,
  checkPhaseChange,
  markRecommendationsUpdated,
  generateStrengthRecommendationsPrompt
} from '../services/crossTrainingService';
import { useTranslation } from '../i18n/LanguageContext';

const MARATHON_CYCLE_START = '2026-01-19';

// Helper to get today's date in local timezone (not UTC)
function getTodayLocal() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TODAY = getTodayLocal();

export default function CrossTraining() {
  const { t } = useTranslation();
  const [strengthStats, setStrengthStats] = useState(null);
  const [cyclingStats, setCyclingStats] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('strength'); // 'strength' or 'cycling'
  const [showInfoModal, setShowInfoModal] = useState(false);

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
          <p className="mt-4 text-gray-600">{t('crossTraining.loadingData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {t('crossTraining.title')}
        </h2>
        <p className="text-gray-600">
          {t('crossTraining.subtitle')}
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
              💪 {t('crossTraining.strengthTraining')}
            </button>
            <button
              onClick={() => setActiveTab('cycling')}
              className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'cycling'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🚴 {t('crossTraining.cycling')}
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
            <CyclingTab
              stats={cyclingStats}
              onShowInfo={() => setShowInfoModal(true)}
            />
          )}
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <InfoModal onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
}

function StrengthTrainingTab({ stats, recommendations }) {
  const { t } = useTranslation();
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showNoUpdateModal, setShowNoUpdateModal] = useState(false);
  const [phaseInfo, setPhaseInfo] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);

  if (!stats || !recommendations) {
    return <div className="text-gray-600">{t('crossTraining.noStrengthData')}</div>;
  }

  const handleUpdateRecommendations = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;

    const changeInfo = checkPhaseChange(currentDate);
    setPhaseInfo(changeInfo);

    if (changeInfo.needsUpdate) {
      // Phase changed - show prompt
      const { prompt, parameters } = generateStrengthRecommendationsPrompt(currentDate);
      setGeneratedPrompt({ prompt, parameters });
      setShowPromptModal(true);
    } else {
      // No phase change - show info modal
      setShowNoUpdateModal(true);
    }
  };

  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt.prompt);
      alert('Prompt copied to clipboard!');
    }
  };

  const handleMarkAsUpdated = () => {
    if (phaseInfo) {
      markRecommendationsUpdated(phaseInfo.currentPhase);
      alert('Recommendations marked as updated for ' + phaseInfo.currentPhase + ' phase');
      setShowPromptModal(false);
    }
  };

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
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-2">
              {t('crossTraining.currentPhase')}: {recommendations.currentPhase}
            </h3>
            <p className="text-sm text-blue-800 mb-2">
              {t('crossTraining.weekOf', { week: recommendations.weeksInCycle, total: recommendations.totalWeeks }).replace('{week}', recommendations.weeksInCycle).replace('{total}', recommendations.totalWeeks)}
            </p>
            <p className="text-sm text-blue-700">{recommendations.focus}</p>
          </div>
          <button
            onClick={handleUpdateRecommendations}
            className="ml-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
            title="Update recommendations if phase changed"
          >
            🔄 Update
          </button>
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">{t('crossTraining.thisWeek')}</div>
          <div className="text-2xl font-bold text-gray-900">
            {currentWeek.minutes} min
          </div>
          <div className="text-sm text-gray-500">
            {currentWeek.sessions} {t('crossTraining.sessions')}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">{t('crossTraining.recommended')}</div>
          <div className="text-2xl font-bold text-gray-900">
            {minRec}-{maxRec} min
          </div>
          <div className="text-sm text-gray-500">{t('crossTraining.perWeek')}</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">{t('crossTraining.totalCycle')}</div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.total.hours} {t('crossTraining.hrs')}
          </div>
          <div className="text-sm text-gray-500">
            {stats.total.sessions} {t('crossTraining.sessions')}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {t('crossTraining.weeklyProgress')}
          </span>
          <span className="text-sm text-gray-600">
            {weeklyProgress.toFixed(0)}% {t('crossTraining.ofMax')}
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
          {t('crossTraining.recommendedExercises')}
        </h4>
        <ul className="space-y-2">
          {recommendations.exercises.map((exercise, idx) => (
            <li key={idx} className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <div className="flex-1">
                <span className="text-gray-700">{exercise.name}</span>
                <a
                  href={exercise.video}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-red-600 hover:text-red-700 text-sm"
                  title="Watch video tutorial on YouTube"
                >
                  📺 Video
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Rationale */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">
          {t('crossTraining.whyThisMatters')}
        </h4>
        <p className="text-sm text-yellow-800 mb-3">
          {recommendations.rationale}
        </p>
        <div className="text-xs text-yellow-700 space-y-1">
          <p className="font-semibold">{t('crossTraining.researchReferences')}</p>
          {recommendations.references.map((ref, idx) => (
            <p key={idx}>• {ref}</p>
          ))}
        </div>
      </div>

      {/* Weekly Breakdown */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900">{t('crossTraining.weeklyBreakdown')}</h4>

        {/* This Week Summary - Always visible */}
        {(() => {
          // Calculate current week's Monday using same logic as service
          const today = new Date();
          const year = today.getFullYear();
          const month = today.getMonth();
          const day = today.getDate();

          const todayDate = new Date(year, month, day, 12, 0, 0);
          const dayOfWeek = todayDate.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

          const thisWeekStart = new Date(year, month, day - daysToMonday, 12, 0, 0);
          const weekYear = thisWeekStart.getFullYear();
          const weekMonth = String(thisWeekStart.getMonth() + 1).padStart(2, '0');
          const weekDay = String(thisWeekStart.getDate()).padStart(2, '0');
          const thisWeekKey = `${weekYear}-${weekMonth}-${weekDay}`;

          const thisWeekData = stats.byWeek?.[thisWeekKey] || { sessions: 0, minutes: 0 };

          return (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h5 className="font-semibold text-purple-900 mb-3">{t('crossTraining.thisWeek')} ({thisWeekKey})</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-purple-700 mb-1">{t('crossTraining.sessions')}</div>
                  <div className="text-xl font-bold text-purple-900">{thisWeekData.sessions}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-700 mb-1">{t('crossTraining.totalTime')}</div>
                  <div className="text-xl font-bold text-purple-900">{thisWeekData.minutes} min</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* All Weeks Table */}
        {stats.byWeek && Object.keys(stats.byWeek).length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('common.week')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.sessions')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.totalTime')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(stats.byWeek)
                  .sort()
                  .reverse()
                  .map(([week, data]) => (
                    <tr key={week}>
                      <td className="px-4 py-3 text-sm text-gray-900">{week}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{data.sessions}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {data.minutes} min ({(data.minutes / 60).toFixed(1)} {t('crossTraining.hrs')})
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats.total.sessions === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">
            {t('crossTraining.noStrengthData')}
          </p>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && generatedPrompt && phaseInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto w-full">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                🎯 Generate New Strength Recommendations
              </h2>
              <p className="text-sm text-gray-600">
                Phase changed: <span className="font-semibold text-blue-600">{phaseInfo.lastPhase || 'Never updated'}</span> → <span className="font-semibold text-green-600">{phaseInfo.currentPhase}</span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Phase Information</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Current Phase:</strong> {phaseInfo.currentPhase}</p>
                  <p><strong>Week:</strong> {phaseInfo.weeksInCycle} of {phaseInfo.totalWeeks}</p>
                  {phaseInfo.lastPhase && (
                    <p><strong>Previous Phase:</strong> {phaseInfo.lastPhase}</p>
                  )}
                  {phaseInfo.lastUpdate && (
                    <p><strong>Last Updated:</strong> {new Date(phaseInfo.lastUpdate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-900">AI Prompt</h3>
                  <button
                    onClick={handleCopyPrompt}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <div className="bg-white rounded border border-gray-300 p-4 max-h-96 overflow-y-auto">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                    {generatedPrompt.prompt}
                  </pre>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">📝 Instructions</h3>
                <ol className="text-sm text-yellow-800 space-y-2 ml-4 list-decimal">
                  <li>Copy the prompt above</li>
                  <li>Paste it into Claude or your AI assistant</li>
                  <li>Review the generated recommendations</li>
                  <li>Update the code in <code className="bg-yellow-100 px-1 rounded">crossTrainingService.js</code> with the new recommendations</li>
                  <li>Click "Mark as Updated" below to track this phase change</li>
                </ol>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Prompt Parameters</h3>
                <pre className="text-xs text-gray-700 bg-white rounded border border-gray-300 p-3 overflow-x-auto">
                  {JSON.stringify(generatedPrompt.parameters, null, 2)}
                </pre>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
              <button
                onClick={handleMarkAsUpdated}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                ✅ Mark as Updated
              </button>
              <button
                onClick={() => setShowPromptModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Update Needed Modal */}
      {showNoUpdateModal && phaseInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              ✅ No Update Needed
            </h2>
            <div className="space-y-3 mb-6">
              <p className="text-gray-700">
                The marathon phase hasn't changed since the last update.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Current Phase:</strong> {phaseInfo.currentPhase}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Week:</strong> {phaseInfo.weeksInCycle} of {phaseInfo.totalWeeks}
                </p>
                {phaseInfo.lastUpdate && (
                  <p className="text-sm text-blue-700">
                    <strong>Last Updated:</strong> {new Date(phaseInfo.lastUpdate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <p className="text-sm text-gray-600">
                The current recommendations are still appropriate for this phase.
                Check back when you enter a new training phase!
              </p>
            </div>
            <button
              onClick={() => setShowNoUpdateModal(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CyclingTab({ stats, onShowInfo }) {
  const { t } = useTranslation();

  if (!stats) {
    return <div className="text-gray-600">{t('crossTraining.noCyclingData')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cycling Totals */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🚴</span> {t('crossTraining.cyclingTotals')}
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('crossTraining.sessions')}:</span>
              <span className="font-medium">{stats.totals.cycling.sessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('common.distance')}:</span>
              <span className="font-medium">{stats.totals.cycling.km} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('crossTraining.time')}:</span>
              <span className="font-medium">
                {(stats.totals.cycling.minutes / 60).toFixed(1)} {t('crossTraining.hours')}
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
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
            <span className="mr-2">🏃</span> {t('crossTraining.runningEquivalent')}
            <button
              onClick={onShowInfo}
              className="ml-2 text-blue-600 hover:text-blue-800 text-lg"
              title="How is this calculated?"
            >
              ℹ️
            </button>
          </h4>

          {/* Personalization Badge */}
          {stats.personalizedInfo && (
            <div className="mb-3 px-2 py-1 bg-indigo-100 border border-indigo-300 rounded text-xs">
              <span className="font-semibold text-indigo-900">
                🎯 {t('crossTraining.personalizedFor', 'Personalized for')}:
              </span>
              <span className="text-indigo-700 ml-1">
                {stats.personalizedInfo.level === 'advanced' && t('crossTraining.advancedCyclist', 'Advanced Cyclist')}
                {stats.personalizedInfo.level === 'intermediate' && t('crossTraining.intermediateCyclist', 'Intermediate Cyclist')}
                {stats.personalizedInfo.level === 'beginner' && t('crossTraining.beginnerCyclist', 'Beginner Cyclist')}
                {' '}({stats.personalizedInfo.adjustment})
              </span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-blue-700">{t('common.distance')}:</span>
              <span className="font-medium text-blue-900">
                ~{stats.totals.runningEquivalent.km} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">{t('crossTraining.time')}:</span>
              <span className="font-medium text-blue-900">
                ~{(stats.totals.runningEquivalent.minutes / 60).toFixed(1)} {t('crossTraining.hours')}
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
              {t('crossTraining.basedOn')}
            </p>
          </div>
        </div>
      </div>

      {/* Weekly Breakdown */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900">{t('crossTraining.weeklyBreakdown')}</h4>

        {/* This Week Summary - Always visible */}
        {(() => {
          // Calculate current week's Monday using same logic as service
          const today = new Date();
          const year = today.getFullYear();
          const month = today.getMonth();
          const day = today.getDate();

          const todayDate = new Date(year, month, day, 12, 0, 0);
          const dayOfWeek = todayDate.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

          const thisWeekStart = new Date(year, month, day - daysToMonday, 12, 0, 0);
          const weekYear = thisWeekStart.getFullYear();
          const weekMonth = String(thisWeekStart.getMonth() + 1).padStart(2, '0');
          const weekDay = String(thisWeekStart.getDate()).padStart(2, '0');
          const thisWeekKey = `${weekYear}-${weekMonth}-${weekDay}`;

          const thisWeekData = stats.byWeek?.[thisWeekKey] || { sessions: 0, km: 0, runningEquivKm: 0, tss: 0 };

          return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-semibold text-blue-900 mb-3">{t('crossTraining.thisWeek')} ({thisWeekKey})</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-blue-700 mb-1">{t('crossTraining.sessions')}</div>
                  <div className="text-xl font-bold text-blue-900">{thisWeekData.sessions}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 mb-1">{t('common.distance')}</div>
                  <div className="text-xl font-bold text-blue-900">{thisWeekData.km.toFixed(1)} km</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 mb-1">{t('crossTraining.runningEquiv')}</div>
                  <div className="text-xl font-bold text-blue-900">~{thisWeekData.runningEquivKm.toFixed(1)} km</div>
                </div>
                <div>
                  <div className="text-xs text-blue-700 mb-1">TSS</div>
                  <div className="text-xl font-bold text-blue-900">{thisWeekData.tss.toFixed(0)}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* All Weeks Table */}
        {stats.byWeek && Object.keys(stats.byWeek).length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('common.week')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.sessions')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('common.distance')} (km)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.runningEquiv')} (km)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    TSS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(stats.byWeek)
                  .sort()
                  .reverse()
                  .map(([week, data]) => (
                    <tr key={week}>
                      <td className="px-4 py-3 text-sm text-gray-900">{week}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{data.sessions}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{data.km.toFixed(1)} km</td>
                      <td className="px-4 py-3 text-sm text-blue-700 font-medium">
                        ~{data.runningEquivKm.toFixed(1)} km
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{data.tss.toFixed(0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity List */}
      {stats.activities.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">{t('crossTraining.cyclingSessions')}</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('common.date')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.name')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('common.distance')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.time')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.avgPower')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    TSS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('crossTraining.runningEquiv')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.activities
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((activity, idx) => (
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
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {activity.tss || '-'}
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
            {t('crossTraining.noCyclingData')}
          </p>
        </div>
      )}

      {/* Formula Explanation */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
          {t('crossTraining.howItWorks')}
          <button
            onClick={onShowInfo}
            className="ml-2 text-blue-600 hover:text-blue-800 text-sm underline"
          >
            ({t('common.details')})
          </button>
        </h4>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>{t('crossTraining.conversionFactors')}</strong>
          </p>
          <ul className="ml-4 space-y-1">
            <li>• {t('crossTraining.easyRecovery')}</li>
            <li>• {t('crossTraining.tempo')}</li>
            <li>• {t('crossTraining.threshold')}</li>
            <li>• {t('crossTraining.vo2max')}</li>
          </ul>
          <p className="mt-3">
            <strong>{t('crossTraining.tssAdjustment')}</strong>
          </p>
          <p className="mt-3">
            <strong>{t('crossTraining.researchBasis')}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoModal({ onClose }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('crossTraining.infoTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Introduction */}
          <p className="text-gray-700">
            {t('crossTraining.infoIntro')}
          </p>

          {/* Distance Conversion */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              {t('crossTraining.distanceConversion')}
            </h3>
            <p className="text-sm text-blue-800 mb-2 font-mono">
              {t('crossTraining.distanceFormula')}
            </p>
            <p className="text-sm text-blue-700 mb-2">
              {t('crossTraining.intensityFactors')}
            </p>
            <ul className="text-sm text-blue-800 space-y-1 ml-4">
              <li>• {t('crossTraining.factor1')}</li>
              <li>• {t('crossTraining.factor2')}</li>
              <li>• {t('crossTraining.factor3')}</li>
              <li>• {t('crossTraining.factor4')}</li>
            </ul>
          </div>

          {/* Personalized Adjustment */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h3 className="font-semibold text-indigo-900 mb-2">
              🎯 {t('crossTraining.personalizedAdjustment', 'Personalized Adjustment')}
            </h3>
            <p className="text-sm text-indigo-700 mb-2">
              {t('crossTraining.personalizedIntro', 'Your conversion factors are automatically adjusted based on your cycling ability relative to your running ability:')}
            </p>
            <ul className="text-sm text-indigo-800 space-y-2 ml-4">
              <li>
                <strong>{t('crossTraining.advancedCyclist', 'Advanced Cyclist')}</strong> (Cycling FTP ≥ 85% of Running FTP):<br/>
                <span className="text-indigo-700">{t('crossTraining.advancedDesc', 'Standard conversion applies - cycling provides full running benefit')}</span>
              </li>
              <li>
                <strong>{t('crossTraining.intermediateCyclist', 'Intermediate Cyclist')}</strong> (Cycling FTP 70-85% of Running FTP):<br/>
                <span className="text-indigo-700">{t('crossTraining.intermediateDesc', 'Conversion reduced by 25% - cycling provides 75% of standard running benefit')}</span>
              </li>
              <li>
                <strong>{t('crossTraining.beginnerCyclist', 'Beginner Cyclist')}</strong> (Cycling FTP &lt; 70% of Running FTP):<br/>
                <span className="text-indigo-700">{t('crossTraining.beginnerDesc', 'Conversion reduced by 40% - cycling provides 60% of standard running benefit')}</span>
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-indigo-200">
              <p className="text-xs text-indigo-700">
                <strong>{t('crossTraining.whyPersonalize', 'Why personalize?')}</strong> {t('crossTraining.personalizeReason', 'Athletes stronger in one discipline receive less cross-training benefit from the other. This adjustment provides a more accurate representation of the training stimulus for running adaptations.')}
              </p>
            </div>
          </div>

          {/* Time Conversion */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              {t('crossTraining.timeConversion')}
            </h3>
            <p className="text-sm text-green-800 mb-2 font-mono">
              {t('crossTraining.timeFormula')}
            </p>
            <p className="text-sm text-green-700">
              {t('crossTraining.timeRationale')}
            </p>
          </div>

          {/* TSS Conversion */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">
              {t('crossTraining.tssConversion')}
            </h3>
            <p className="text-sm text-purple-800 mb-2 font-mono">
              {t('crossTraining.tssFormula')}
            </p>
            <p className="text-sm text-purple-700">
              {t('crossTraining.tssRationale')}
            </p>
          </div>

          {/* Example */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              {t('crossTraining.exampleTitle')}
            </h3>
            <p className="text-sm text-yellow-800 mb-2">
              {t('crossTraining.exampleScenario')}
            </p>
            <p className="text-sm text-yellow-700 mb-2">
              {t('crossTraining.exampleSteps')}
            </p>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>{t('crossTraining.step1')}</li>
              <li>{t('crossTraining.step2')}</li>
              <li>{t('crossTraining.step3')}</li>
              <li>{t('crossTraining.step4')}</li>
              <li>{t('crossTraining.step5')}</li>
            </ul>
          </div>

          {/* Research */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('crossTraining.researchTitle')}
            </h3>
            <p className="text-sm text-gray-700 mb-1">
              <strong>{t('crossTraining.researchPrimary')}</strong>
            </p>
            <p className="text-sm text-gray-700 mb-1">
              {t('crossTraining.researchMilletTitle')}
            </p>
            <p className="text-sm text-gray-600 italic mb-3">
              {t('crossTraining.researchMilletDetails')}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              {t('crossTraining.researchFindings')}
            </p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>{t('crossTraining.finding1')}</li>
              <li>{t('crossTraining.finding2')}</li>
              <li>{t('crossTraining.finding3')}</li>
              <li>{t('crossTraining.finding4')}</li>
            </ul>
          </div>

          {/* Limitations */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('crossTraining.limitations')}
            </h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>{t('crossTraining.limitation1')}</li>
              <li>{t('crossTraining.limitation2')}</li>
              <li>{t('crossTraining.limitation3')}</li>
              <li>{t('crossTraining.limitation4')}</li>
            </ul>
          </div>

          {/* Practical Use */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              {t('crossTraining.practicalUse')}
            </h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>{t('crossTraining.useCase1')}</li>
              <li>{t('crossTraining.useCase2')}</li>
              <li>{t('crossTraining.useCase3')}</li>
              <li>{t('crossTraining.useCase4')}</li>
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
