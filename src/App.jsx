import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import TrainingLog from './components/TrainingLog';
import CoachAnalysis from './components/CoachAnalysis';
import ProgressTracker from './components/ProgressTracker';
import CrossTraining from './components/CrossTraining';
import Nutrition from './components/Nutrition';
import Settings from './components/Settings';
import Help from './components/Help';
import { loadInitialAnalyses } from './utils/loadInitialAnalyses';
import { autoImportIfEmpty } from './services/databaseSync';
import { useTranslation } from './i18n/LanguageContext';
import { analysisLoader } from './services/analysisLoader';

function App() {
  const { t, language, changeLanguage } = useTranslation();

  // Read initial state from URL params
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    const validTabs = ['dashboard', 'log', 'analysis', 'progress', 'crosstraining', 'nutrition', 'settings', 'help'];
    return validTabs.includes(tabFromUrl) ? tabFromUrl : 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [appReady, setAppReady] = useState(false);

  // Initialize language from URL on mount and set initial URL state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const langFromUrl = params.get('lang');

    // Set language from URL if present
    if (langFromUrl && (langFromUrl === 'en_US' || langFromUrl === 'pt_BR')) {
      if (langFromUrl !== language) {
        changeLanguage(langFromUrl);
      }
    }

    // Set initial URL state if not present
    if (!params.has('tab') || !params.has('lang')) {
      updateURL(activeTab, language);
    }
  }, []);

  // Update URL when tab changes
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    updateURL(newTab, language);
  };

  // Update URL when language changes
  const handleLanguageChange = (newLang) => {
    changeLanguage(newLang);
    updateURL(activeTab, newLang);
  };

  // Update URL with tab and language
  const updateURL = (tab, lang) => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    params.set('lang', lang);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ tab, lang }, '', newUrl);
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
        if (event.state.lang && event.state.lang !== language) {
          changeLanguage(event.state.lang);
        }
      } else {
        // If no state, read from URL
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab') || 'dashboard';
        const lang = params.get('lang');
        setActiveTab(tab);
        if (lang && lang !== language) {
          changeLanguage(lang);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [language, changeLanguage]);

  // Auto-import database and load initial analyses on first mount
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 App initializing...');

      // FIRST: Force migration check for old schema analyses
      try {
        console.log('🔄 Checking for schema migration...');
        await analysisLoader.migrateOldSchema();
        console.log('✅ Schema migration check complete');
      } catch (error) {
        console.error('❌ Error during schema migration:', error);
      }

      try {
        // Auto-import database from public/database/marathon-tracker-db.json
        // Imports if file is newer than last import OR database is empty
        const result = await autoImportIfEmpty();

        if (result.imported) {
          console.log('✅ Database loaded from file:', result.message);
          console.log('📊 File timestamp:', result.fileTimestamp);
        } else if (result.needsManualSync) {
          console.log('ℹ️ No database file found - configure Intervals.icu API in Settings');
        } else {
          console.log('ℹ️ Database status:', result.reason);
        }
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
      }

      // Load initial coach analyses
      try {
        await loadInitialAnalyses();
        console.log('✅ Coach analyses loaded');
      } catch (error) {
        console.error('❌ Error loading coach analyses:', error);
      }

      // Mark app as ready to render
      setAppReady(true);
    };

    initializeApp();
  }, []);

  // Show loading state until app is ready
  if (!appReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'log':
        return <TrainingLog />;
      case 'analysis':
        return <CoachAnalysis />;
      case 'progress':
        return <ProgressTracker />;
      case 'crosstraining':
        return <CrossTraining />;
      case 'nutrition':
        return <Nutrition />;
      case 'settings':
        return <Settings />;
      case 'help':
        return <Help />;
      default:
        return <Dashboard />;
    }
  };

  const tabs = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: '📊' },
    { id: 'nutrition', label: t('nav.nutrition'), icon: '🥗' },
    { id: 'crosstraining', label: 'Cross Training', icon: '🚴' },
    { id: 'analysis', label: t('nav.coachAnalysis'), icon: '🏃' },
    { id: 'progress', label: t('nav.progress'), icon: '📈' },
    { id: 'log', label: t('nav.trainingLog'), icon: '📝' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              Marathon Tracker
            </h1>
            <button
              onClick={() => handleTabChange('help')}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
            >
              {t('help.title')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="en_US">🇺🇸 English</option>
              <option value="pt_BR">🇧🇷 Português</option>
            </select>
            <button
              onClick={() => handleTabChange('settings')}
              className="text-gray-500 hover:text-gray-700"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-2xl mb-1">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;
