function Help() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">How to Use Marathon Tracker</h2>
        <p className="text-gray-600">
          Follow these steps to get started with your marathon training tracking
        </p>
      </div>

      {/* Step 1: Intervals.icu Credentials */}
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl font-bold text-primary-600">1</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Add Intervals.icu API Credentials
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Marathon Tracker syncs your training data from Intervals.icu. You need to configure your API credentials first.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-blue-900 mb-3">How to get your Intervals.icu credentials:</p>
          <ol className="text-sm text-blue-800 space-y-2 ml-4 list-decimal">
            <li>
              Go to{' '}
              <a
                href="https://intervals.icu"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium hover:text-blue-600"
              >
                intervals.icu
              </a>
              {' '}and log in to your account
            </li>
            <li>Click on your profile icon in the top right corner</li>
            <li>Select <strong>"Settings"</strong> from the dropdown menu</li>
            <li>Navigate to the <strong>"Developer"</strong> tab</li>
            <li>Copy your <strong>API Key</strong></li>
            <li>Your <strong>Athlete ID</strong> is in your profile URL (e.g., <code className="bg-blue-100 px-1 rounded">i12345678</code>)</li>
          </ol>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">Enter credentials in Marathon Tracker:</p>
          <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal">
            <li>Click the <strong>⚙️ Settings</strong> icon in the top right</li>
            <li>Scroll to <strong>"Intervals.icu API"</strong> section</li>
            <li>Paste your <strong>API Key</strong> and <strong>Athlete ID</strong></li>
            <li>Click <strong>"Save Configuration"</strong></li>
          </ol>
        </div>
      </div>

      {/* Step 2: Sync Your Data */}
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl font-bold text-primary-600">2</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Sync Your Training Data
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Once your credentials are configured, sync your training activities from Intervals.icu.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900 mb-2">📝 Go to Training Log:</p>
            <ol className="text-sm text-green-800 space-y-2 ml-4 list-decimal">
              <li>Tap the <strong>"Log"</strong> tab in the bottom navigation</li>
              <li>Click <strong>"🔄 Sync New"</strong> button in the top right</li>
              <li>Wait for the sync to complete</li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-900 mb-2">ℹ️ What gets synced:</p>
            <ul className="text-sm text-yellow-800 space-y-1 ml-4 list-disc">
              <li>
                <strong>By default:</strong> Only new activities since your last sync (incremental sync)
              </li>
              <li>
                <strong>Sync date range:</strong> Last 90 days from today
              </li>
              <li>
                <strong>Data included:</strong> Activities, intervals, power data, heart rate, messages/notes
              </li>
              <li>
                <strong>First time sync:</strong> If this is your first sync, it will download all activities from the last 90 days
              </li>
              <li>
                <strong>For full history:</strong> Go to Progress tab → "Sync New" to load from 2025-01-01 for heart rate trend analysis
              </li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-medium text-purple-900 mb-2">💡 Pro Tips:</p>
            <ul className="text-sm text-purple-800 space-y-1 ml-4 list-disc">
              <li>Use <strong>"Sync New"</strong> for daily updates (faster, only fetches new activities)</li>
              <li>Use <strong>"Force Full Sync"</strong> to refresh everything including activity messages/notes</li>
              <li>All data is cached locally in your browser - no need to sync repeatedly!</li>
              <li><strong>Messages/notes</strong> are only synced during Force Full Sync to reduce API calls</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Step 3: Use the Platform */}
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl font-bold text-primary-600">3</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Explore Your Training Data
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Now you're ready to track your marathon training progress!
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">Dashboard</p>
              <p className="text-xs text-gray-600">View weekly stats, training readiness, and upcoming workouts</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">Training Log</p>
              <p className="text-xs text-gray-600">Browse all your activities with detailed metrics and notes</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">🏃</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">Coach Analysis</p>
              <p className="text-xs text-gray-600">AI-powered training insights and recommendations</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">📈</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">Progress Tracker</p>
              <p className="text-xs text-gray-600">Monitor KM at marathon pace, fitness trends, and heart rate efficiency</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bonus: Coach AI Prompt */}
      <div className="card bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">🎁</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Bonus: Get AI Coach Analysis
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Optional: Use Claude AI to generate personalized training analysis that's compatible with Marathon Tracker
            </p>
          </div>
        </div>

        <div className="bg-white border border-purple-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">What you'll need:</p>
          <ul className="text-sm text-gray-700 space-y-2 ml-4 list-disc">
            <li>Access to Claude AI (claude.ai or Claude Desktop app)</li>
            <li>The Marathon Coach prompt template (available in the Coach tab)</li>
            <li>Your activity data from Intervals.icu</li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-primary-50 to-purple-50 border-2 border-primary-300 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-sm font-bold text-primary-900 mb-2">Get the Official Coach Prompt Template</p>
              <p className="text-sm text-primary-800 mb-3">
                The template in the <strong>Coach</strong> tab generates JSON output that's fully compatible
                with Marathon Tracker's analysis format.
              </p>
              <ol className="text-sm text-primary-800 space-y-2 ml-4 list-decimal">
                <li>Go to the <strong>🏃 Coach</strong> tab (bottom navigation)</li>
                <li>Click the <strong>ℹ️ information icon</strong> next to "Coach Analysis" title</li>
                <li>Copy the complete prompt template from the modal</li>
                <li>Use it with Claude AI to generate structured training analysis</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-white border border-purple-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">How to use the coach prompt:</p>
          <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal">
            <li>Get the prompt template from the <strong>Coach → ℹ️</strong> tab</li>
            <li>Go to your activity on Intervals.icu</li>
            <li>Copy the activity details (distance, pace, intervals, HR, power)</li>
            <li>Paste the prompt template + activity data into Claude AI</li>
            <li>Claude will generate a structured JSON analysis</li>
            <li>Save the JSON file and import it in the <strong>Coach</strong> tab</li>
          </ol>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> The coach analysis feature helps you understand each training session in the context
            of your marathon goal. The JSON format allows Marathon Tracker to display rich insights, track progress over time,
            and provide visual feedback on your training quality.
          </p>
        </div>
      </div>

      {/* Quick Reference Card */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Reference</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-medium text-gray-900 mb-1">Daily Workflow:</p>
            <ol className="text-gray-600 space-y-1 ml-4 list-decimal text-xs">
              <li>Check Dashboard for readiness</li>
              <li>Sync new activities (if needed)</li>
              <li>Review training log</li>
              <li>Monitor progress metrics</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-1">Data is Cached:</p>
            <ul className="text-gray-600 space-y-1 ml-4 list-disc text-xs">
              <li>All synced data stays in browser</li>
              <li>No need to re-sync constantly</li>
              <li>Only sync for new activities</li>
              <li>Works offline after sync</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="card bg-primary-50 border-primary-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
        <p className="text-sm text-gray-700">
          If you encounter any issues or have questions, check your browser console for error messages
          or verify your Intervals.icu credentials in Settings.
        </p>
      </div>

      {/* Important Warning: Local Storage */}
      <div className="card bg-red-50 border-2 border-red-300">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-red-900 mb-2">
              Important: Your Data is Stored Locally
            </h3>
            <p className="text-sm text-red-800 mb-4">
              All your training data is stored only in your browser's local storage (IndexedDB).
              This means your data is tied to this specific browser on this specific computer.
            </p>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">What this means:</p>
          <ul className="text-sm text-gray-700 space-y-2 ml-4 list-disc">
            <li>
              <strong>Clearing browser data will delete everything</strong> - Be careful when clearing cache/cookies
            </li>
            <li>
              <strong>Different browsers = different data</strong> - Chrome and Firefox don't share data
            </li>
            <li>
              <strong>Incognito/Private mode won't persist data</strong> - Data is lost when you close the window
            </li>
            <li>
              <strong>Switching computers = starting fresh</strong> - Unless you export and import your database
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💾</span>
            <div>
              <p className="text-sm font-bold text-blue-900 mb-2">Solution: Export Your Database</p>
              <p className="text-sm text-blue-800 mb-3">
                To use Marathon Tracker on multiple computers or backup your data:
              </p>
              <ol className="text-sm text-blue-800 space-y-2 ml-4 list-decimal">
                <li>Go to <strong>⚙️ Settings</strong> (top right corner)</li>
                <li>Scroll to <strong>"Database Sync (Multi-Computer)"</strong> section</li>
                <li>Click <strong>"📤 Export Database to JSON"</strong></li>
                <li>Save the file to a safe location (cloud storage, USB drive, etc.)</li>
                <li>On another computer: <strong>"📥 Import Database from JSON"</strong> to restore all your data</li>
              </ol>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>Pro tip:</strong> If you use Git, you can save the exported database file to your repository
                  (e.g., <code className="bg-blue-100 px-1 rounded">public/database/marathon-tracker-db.json</code>)
                  and sync across computers by committing and pulling the file.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Help;
