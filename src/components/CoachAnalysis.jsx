import { useState } from 'react';
import useAnalyses from '../hooks/useAnalyses';
import { formatDate } from '../utils/dateHelpers';
import CoachPromptModal from './CoachPromptModal';
import WeeklyPlan from './WeeklyPlan';
import { useTranslation } from '../i18n/LanguageContext';

// Helper function to get localized content with fallback for old format
const getLocalizedContent = (content, language) => {
  if (!content) return '';

  // If it's already a string or number, return as is (old format or simple value)
  if (typeof content === 'string' || typeof content === 'number') {
    return content;
  }

  // If it's an array, check if items are objects or strings
  if (Array.isArray(content)) {
    // If array items are strings (old format), return as is
    if (content.length > 0 && typeof content[0] === 'string') {
      return content;
    }
    // If array items are objects, shouldn't happen but return empty
    return [];
  }

  // If content is an object with language keys, return the appropriate translation
  if (typeof content === 'object' && content !== null) {
    // Check if this is a nested array structure: {en_US: [...], pt_BR: [...]}
    if (content[language] && Array.isArray(content[language])) {
      return content[language];
    }
    if (content['en_US'] && Array.isArray(content['en_US'])) {
      return content['en_US'];
    }
    if (content['pt_BR'] && Array.isArray(content['pt_BR'])) {
      return content['pt_BR'];
    }

    // Standard bilingual object: {en_US: "string", pt_BR: "string"}
    if (content[language]) {
      return content[language];
    }
    // Fallback to en_US
    if (content['en_US']) {
      return content['en_US'];
    }
    // Fallback to pt_BR
    if (content['pt_BR']) {
      return content['pt_BR'];
    }
  }

  // Last resort: return empty string
  return '';
};

// Helper function to highlight ADAPTATIONS and ALTERNATIVE keywords
const HighlightedWorkout = ({ text }) => {
  if (!text || typeof text !== 'string') {
    return <span>{text}</span>;
  }

  // Create a regex that matches both keywords in either language
  const keywords = /(ADAPTATIONS:|ADAPTAÇÕES:|ALTERNATIVE:|ALTERNATIVA:)/gi;
  const parts = text.split(keywords);

  // If no keywords found, return as-is
  if (parts.length === 1) {
    return <span>{text}</span>;
  }

  // Map parts to JSX, highlighting keywords
  return (
    <span>
      {parts.map((part, index) => {
        const upperPart = part.toUpperCase();
        if (upperPart === 'ADAPTATIONS:' || upperPart === 'ADAPTAÇÕES:') {
          return (
            <span
              key={index}
              className="font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded mx-0.5"
            >
              {part}
            </span>
          );
        } else if (upperPart === 'ALTERNATIVE:' || upperPart === 'ALTERNATIVA:') {
          return (
            <span
              key={index}
              className="font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded mx-0.5"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

function CoachAnalysis() {
  const { t, language } = useTranslation();
  const { analyses, loading, error, importFromFile, reload } = useAnalyses();
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showDeleteSingleModal, setShowDeleteSingleModal] = useState(false);
  const [analysisToDelete, setAnalysisToDelete] = useState(null);

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    try {
      await importFromFile(file);
      alert(t('coachAnalysis.importSuccess'));
    } catch (err) {
      alert(`${t('common.error')}: ${err.message}`);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleDeleteSingle = async () => {
    if (!analysisToDelete) return;

    try {
      const { db } = await import('../services/database');
      await db.deleteAnalysis(analysisToDelete.metadata.activityId);
      setShowDeleteSingleModal(false);
      setAnalysisToDelete(null);
      reload();
      alert(t('coachAnalysis.deleteAnalysisSuccess'));
    } catch (err) {
      alert(`${t('common.error')}: ${err.message}`);
    }
  };

  const confirmDeleteSingle = (analysis, event) => {
    event.stopPropagation(); // Prevent card click
    setAnalysisToDelete(analysis);
    setShowDeleteSingleModal(true);
  };

  if (loading && analyses.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
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
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-900">{t('coachAnalysis.title')}</h2>
          <button
            onClick={() => setShowPromptModal(true)}
            className="text-gray-400 hover:text-primary-600 transition-colors"
            title={t('coachAnalysis.viewPrompt')}
            aria-label={t('coachAnalysis.viewPrompt')}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn-primary text-sm cursor-pointer">
            {importing ? t('coachAnalysis.importing') : t('coachAnalysis.import')}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>
      </div>

      <CoachPromptModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
      />

      {/* Delete Single Confirmation Modal */}
      {showDeleteSingleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('coachAnalysis.deleteAnalysis')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('coachAnalysis.deleteAnalysisConfirm')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteSingleModal(false);
                  setAnalysisToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteSingle}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Training Plan */}
      <WeeklyPlan />

      {/* Separator */}
      <div className="border-t border-gray-300 pt-6 mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('coachAnalysis.performedSessions')}</h3>
          <p className="text-sm text-gray-500 mt-1">{t('coachAnalysis.performedSessionsDesc')}</p>
        </div>
      </div>

      {analyses.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🏃</p>
          <p className="text-gray-500 mb-2">{t('coachAnalysis.noAnalyses')}</p>
          <p className="text-sm text-gray-400 mb-4">
            {t('coachAnalysis.importDescription')}
          </p>
          <label className="btn-primary inline-block cursor-pointer">
            {t('coachAnalysis.importAnalysis')}
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
              className="card hover:shadow-md transition-shadow relative group"
            >
              {/* Delete button - top right corner */}
              <button
                onClick={(e) => confirmDeleteSingle(analysis, e)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded"
                title={t('coachAnalysis.deleteAnalysis')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              <div
                onClick={() => setSelectedAnalysis(analysis)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2 pr-8">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {getLocalizedContent(analysis.metadata.activityName, language)}
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
                    {t(`coachAnalysis.${analysis.verdict.rating}`)}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-3">
                  {getLocalizedContent(analysis.verdict.summary, language)}
                </p>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-600">{t('coachAnalysis.type')}</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {analysis.session.type.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('common.distance')}</p>
                    <p className="font-medium text-gray-900">
                      {(analysis.session.distance / 1000).toFixed(1)} km
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('common.load')}</p>
                    <p className="font-medium text-gray-900">
                      {analysis.session.trainingLoad}
                    </p>
                  </div>
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
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState('summary');

  const tabs = [
    { id: 'summary', label: t('coachAnalysis.summaryTab') },
    { id: 'analysis', label: t('coachAnalysis.analysisTab') },
    { id: 'recommendations', label: t('coachAnalysis.recommendationsTab') },
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-primary-600 hover:text-primary-700 font-medium flex items-center"
      >
        ← {t('coachAnalysis.backToAnalyses')}
      </button>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {getLocalizedContent(analysis.metadata.activityName, language)}
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
            {t(`coachAnalysis.${analysis.verdict.rating}`).toUpperCase()}
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
              <h3 className="font-semibold text-gray-900 mb-2">{t('coachAnalysis.sessionOverview')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="metric-card">
                  <p className="text-xs text-gray-600">{t('common.distance')}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {(analysis.session.distance / 1000).toFixed(1)} km
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-gray-600">{t('common.avgPace')}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {analysis.session.avgPace}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-gray-600">{t('common.avgPower')}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {analysis.session.avgPower}W
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-gray-600">{t('common.avgHR')}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {analysis.session.avgHR} bpm
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{t('coachAnalysis.verdict')}</h3>
              <p className="text-sm text-gray-700">{getLocalizedContent(analysis.verdict.summary, language)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">{t('coachAnalysis.marathonContext')}</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('coachAnalysis.goalPace')}</span>
                  <span className="font-medium">{analysis.marathonContext.goalPace}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('coachAnalysis.weeksToRace')}</span>
                  <span className="font-medium">{analysis.marathonContext.weeksToRace}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.phase')}</span>
                  <span className="font-medium">{getLocalizedContent(analysis.marathonContext.currentPhase, language)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="text-green-600 mr-2">✓</span> {t('coachAnalysis.strengths')}
              </h3>
              <ul className="space-y-2">
                {getLocalizedContent(analysis.analysis.strengths, language).map((strength, idx) => (
                  <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-green-200">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="text-yellow-600 mr-2">⚠</span> {t('coachAnalysis.areasOfConcern')}
              </h3>
              <ul className="space-y-2">
                {getLocalizedContent(analysis.analysis.concerns, language).map((concern, idx) => (
                  <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-yellow-200">
                    {concern}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="text-blue-600 mr-2">💡</span> {t('coachAnalysis.keyFindings')}
              </h3>
              <ul className="space-y-2">
                {getLocalizedContent(analysis.analysis.keyFindings, language).map((finding, idx) => (
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
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">{t('coachAnalysis.tomorrowsSessions')}</h3>
                {(() => {
                  // Support both single session object and array of sessions
                  const sessions = Array.isArray(analysis.recommendations.nextSession)
                    ? analysis.recommendations.nextSession
                    : [analysis.recommendations.nextSession];

                  return sessions.map((session, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        session.timeOfDay === 'PM' || session.optional
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-primary-50 border-primary-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold ${
                            session.timeOfDay === 'PM' || session.optional
                              ? 'text-blue-900'
                              : 'text-primary-900'
                          }`}>
                            {session.timeOfDay || t('coachAnalysis.morning')} {t('coachAnalysis.session')}
                          </h4>
                          {(session.optional || session.timeOfDay === 'PM') && (
                            <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full font-medium">
                              {t('coachAnalysis.optional')}
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-medium ${
                          session.timeOfDay === 'PM' || session.optional
                            ? 'text-blue-700'
                            : 'text-primary-700'
                        }`}>
                          {session.type}
                        </span>
                      </div>
                      <p className={`text-sm mb-2 ${
                        session.timeOfDay === 'PM' || session.optional
                          ? 'text-blue-800'
                          : 'text-primary-800'
                      }`}>
                        <HighlightedWorkout text={getLocalizedContent(session.workout, language)} />
                      </p>
                      <p className={`text-xs ${
                        session.timeOfDay === 'PM' || session.optional
                          ? 'text-blue-700'
                          : 'text-primary-700'
                      }`}>
                        <HighlightedWorkout text={getLocalizedContent(session.rationale, language)} />
                      </p>
                    </div>
                  ));
                })()}
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{t('coachAnalysis.weeklyAdjustments')}</h3>
              <ul className="space-y-2">
                {getLocalizedContent(analysis.recommendations.weeklyAdjustments || analysis.recommendations.weeklyFocus, language).map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    <span><HighlightedWorkout text={item} /></span>
                  </li>
                ))}
              </ul>
            </div>

            {analysis.recommendations.progressionNotes && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">{t('coachAnalysis.progressionNotes')}</h3>
                <p className="text-sm text-gray-700">
                  {getLocalizedContent(analysis.recommendations.progressionNotes, language)}
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
