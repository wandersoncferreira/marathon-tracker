import { useState } from 'react';
import useAnalyses from '../hooks/useAnalyses';
import { formatDate } from '../utils/dateHelpers';

function CoachAnalysis() {
  const { analyses, loading, error, importFromFile } = useAnalyses();
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    try {
      await importFromFile(file);
      alert('Analysis imported successfully!');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  if (loading && analyses.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analyses...</p>
        </div>
      </div>
    );
  }

  if (selectedAnalysis) {
    return <AnalysisDetail analysis={selectedAnalysis} onBack={() => setSelectedAnalysis(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Coach Analysis</h2>
        <label className="btn-primary text-sm cursor-pointer">
          {importing ? 'Importing...' : '+ Import'}
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            disabled={importing}
          />
        </label>
      </div>

      {analyses.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🏃</p>
          <p className="text-gray-500 mb-2">No coach analyses yet</p>
          <p className="text-sm text-gray-400 mb-4">
            Import JSON analysis files to track your training progress
          </p>
          <label className="btn-primary inline-block cursor-pointer">
            Import Analysis
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((analysis, index) => (
            <div
              key={index}
              onClick={() => setSelectedAnalysis(analysis)}
              className="card hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {analysis.metadata.activityName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatDate(analysis.metadata.date, 'EEE, MMM d, yyyy')}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  analysis.verdict.rating === 'excellent' ? 'bg-green-100 text-green-800' :
                  analysis.verdict.rating === 'good' ? 'bg-blue-100 text-blue-800' :
                  analysis.verdict.rating === 'acceptable' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analysis.verdict.rating}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-3">
                {analysis.verdict.summary}
              </p>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-600">Type</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {analysis.session.type.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Distance</p>
                  <p className="font-medium text-gray-900">
                    {(analysis.session.distance / 1000).toFixed(1)} km
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Load</p>
                  <p className="font-medium text-gray-900">
                    {analysis.session.trainingLoad}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisDetail({ analysis, onBack }) {
  const [activeTab, setActiveTab] = useState('summary');

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'recommendations', label: 'Next Steps' },
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-primary-600 hover:text-primary-700 font-medium flex items-center"
      >
        ← Back to Analyses
      </button>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {analysis.metadata.activityName}
            </h2>
            <p className="text-sm text-gray-500">
              {formatDate(analysis.metadata.date, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <span className={`px-3 py-1 rounded text-sm font-medium ${
            analysis.verdict.rating === 'excellent' ? 'bg-green-100 text-green-800' :
            analysis.verdict.rating === 'good' ? 'bg-blue-100 text-blue-800' :
            analysis.verdict.rating === 'acceptable' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {analysis.verdict.rating.toUpperCase()}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Session Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="metric-card">
                  <p className="text-xs text-gray-600">Distance</p>
                  <p className="text-lg font-bold text-gray-900">
                    {(analysis.session.distance / 1000).toFixed(1)} km
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-gray-600">Avg Pace</p>
                  <p className="text-lg font-bold text-gray-900">
                    {analysis.session.avgPace}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-gray-600">Avg Power</p>
                  <p className="text-lg font-bold text-gray-900">
                    {analysis.session.avgPower}W
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-gray-600">Avg HR</p>
                  <p className="text-lg font-bold text-gray-900">
                    {analysis.session.avgHR} bpm
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Verdict</h3>
              <p className="text-sm text-gray-700">{analysis.verdict.summary}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Marathon Context</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Goal Pace</span>
                  <span className="font-medium">{analysis.marathonContext.goalPace}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Weeks to Race</span>
                  <span className="font-medium">{analysis.marathonContext.weeksToRace}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phase</span>
                  <span className="font-medium">{analysis.marathonContext.currentPhase}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="text-green-600 mr-2">✓</span> Strengths
              </h3>
              <ul className="space-y-2">
                {analysis.analysis.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-green-200">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="text-yellow-600 mr-2">⚠</span> Areas of Concern
              </h3>
              <ul className="space-y-2">
                {analysis.analysis.concerns.map((concern, idx) => (
                  <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-yellow-200">
                    {concern}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="text-blue-600 mr-2">💡</span> Key Findings
              </h3>
              <ul className="space-y-2">
                {analysis.analysis.keyFindings.map((finding, idx) => (
                  <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-blue-200">
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {analysis.recommendations.nextSession && (
              <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
                <h3 className="font-semibold text-primary-900 mb-2">Next Session</h3>
                <p className="text-sm text-primary-800 mb-2">
                  {analysis.recommendations.nextSession.workout}
                </p>
                <p className="text-xs text-primary-700">
                  {analysis.recommendations.nextSession.rationale}
                </p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Weekly Focus</h3>
              <ul className="space-y-2">
                {analysis.recommendations.weeklyFocus.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {analysis.recommendations.progressionNotes && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">Progression Notes</h3>
                <p className="text-sm text-gray-700">
                  {analysis.recommendations.progressionNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CoachAnalysis;
