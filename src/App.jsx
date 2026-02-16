import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import TrainingLog from './components/TrainingLog';
import CoachAnalysis from './components/CoachAnalysis';
import ProgressTracker from './components/ProgressTracker';
import Settings from './components/Settings';
import { loadInitialAnalyses } from './utils/loadInitialAnalyses';
import { autoImportIfEmpty } from './services/databaseSync';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Auto-import database and load initial analyses on first mount
  useEffect(() => {
    const initializeApp = async () => {
      // Auto-import database from public/database/marathon-tracker-db.json if exists
      const result = await autoImportIfEmpty();

      if (result.imported) {
        console.log('✅ Database auto-imported on startup:', result.message);
      } else if (result.needsManualImport) {
        console.log('ℹ️ No database file found - sync from Intervals.icu or import manually');
      }

      // Load initial coach analyses
      await loadInitialAnalyses();
    };

    initializeApp();
  }, []);

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
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'log', label: 'Log', icon: '📝' },
    { id: 'analysis', label: 'Coach', icon: '🏃' },
    { id: 'progress', label: 'Progress', icon: '📈' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Marathon Tracker
          </h1>
          <button
            onClick={() => setActiveTab('settings')}
            className="text-gray-500 hover:text-gray-700"
          >
            ⚙️
          </button>
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
              onClick={() => setActiveTab(tab.id)}
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
