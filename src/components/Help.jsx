import { useTranslation } from '../i18n/LanguageContext';

function Help() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Important Disclaimer */}
      <div className="card bg-red-50 border-2 border-red-400">
        <div className="flex items-start gap-3">
          <span className="text-3xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              {t('help.disclaimer.title')}
            </h3>
            <div className="text-sm text-red-800 space-y-2">
              <p>
                <strong>{t('help.disclaimer.warning')}</strong>
              </p>
              <p>
                {t('help.disclaimer.description')}
              </p>
              <p>
                <strong>{t('help.disclaimer.useDiscretion')}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('help.title')}</h2>
        <p className="text-gray-600">
          {t('help.subtitle')}
        </p>
      </div>

      {/* Step 1: Intervals.icu Credentials */}
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl font-bold text-primary-600">1</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('help.step1.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('help.step1.description')}
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-blue-900 mb-3">{t('help.step1.howToGet')}</p>
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
            <li>{t('help.step1.instructions.i2')}</li>
            <li>{t('help.step1.instructions.i3')}</li>
            <li>{t('help.step1.instructions.i4')}</li>
            <li>{t('help.step1.instructions.i5')}</li>
            <li>{t('help.step1.instructions.i6')}</li>
          </ol>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">{t('help.step1.enterCredentials')}</p>
          <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal">
            <li>{t('help.step1.setup.s1')}</li>
            <li>{t('help.step1.setup.s2')}</li>
            <li>{t('help.step1.setup.s3')}</li>
            <li>{t('help.step1.setup.s4')}</li>
          </ol>
        </div>
      </div>

      {/* Step 2: Sync Your Data */}
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl font-bold text-primary-600">2</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('help.step2.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('help.step2.description')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900 mb-2">📝 {t('help.step2.goToLog')}</p>
            <ol className="text-sm text-green-800 space-y-2 ml-4 list-decimal">
              <li>{t('help.step2.instructions.i1')}</li>
              <li>{t('help.step2.instructions.i2')}</li>
              <li>{t('help.step2.instructions.i3')}</li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-900 mb-2">ℹ️ {t('help.step2.whatSync')}</p>
            <ul className="text-sm text-yellow-800 space-y-1 ml-4 list-disc">
              <li>{t('help.step2.syncInfo.default')}</li>
              <li>{t('help.step2.syncInfo.dateRange')}</li>
              <li>{t('help.step2.syncInfo.dataIncluded')}</li>
              <li>{t('help.step2.syncInfo.firstTime')}</li>
              <li>{t('help.step2.syncInfo.fullHistory')}</li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-medium text-purple-900 mb-2">💡 {t('help.step2.proTips')}</p>
            <ul className="text-sm text-purple-800 space-y-1 ml-4 list-disc">
              <li>{t('help.step2.tips.t1')}</li>
              <li>{t('help.step2.tips.t2')}</li>
              <li>{t('help.step2.tips.t3')}</li>
              <li>{t('help.step2.tips.t4')}</li>
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
              {t('help.step3.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('help.step3.description')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">{t('help.step3.features.dashboard.title')}</p>
              <p className="text-xs text-gray-600">{t('help.step3.features.dashboard.description')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">{t('help.step3.features.trainingLog.title')}</p>
              <p className="text-xs text-gray-600">{t('help.step3.features.trainingLog.description')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">🏃</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">{t('help.step3.features.coachAnalysis.title')}</p>
              <p className="text-xs text-gray-600">{t('help.step3.features.coachAnalysis.description')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">📈</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">{t('help.step3.features.progress.title')}</p>
              <p className="text-xs text-gray-600">{t('help.step3.features.progress.description')}</p>
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
              {t('help.bonus.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('help.bonus.description')}
            </p>
          </div>
        </div>

        <div className="bg-white border border-purple-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">{t('help.bonus.whatYouNeed')}</p>
          <ul className="text-sm text-gray-700 space-y-2 ml-4 list-disc">
            <li>{t('help.bonus.requirements.r1')}</li>
            <li>{t('help.bonus.requirements.r2')}</li>
            <li>{t('help.bonus.requirements.r3')}</li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-primary-50 to-purple-50 border-2 border-primary-300 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-sm font-bold text-primary-900 mb-2">{t('help.bonus.getPrompt')}</p>
              <p className="text-sm text-primary-800 mb-3">
                {t('help.bonus.promptInfo')}
              </p>
              <ol className="text-sm text-primary-800 space-y-2 ml-4 list-decimal">
                <li>{t('help.bonus.promptSteps.s1')}</li>
                <li>{t('help.bonus.promptSteps.s2')}</li>
                <li>{t('help.bonus.promptSteps.s3')}</li>
                <li>{t('help.bonus.promptSteps.s4')}</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-white border border-purple-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">{t('help.bonus.howToUse')}</p>
          <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal">
            <li>{t('help.bonus.usage.u1')}</li>
            <li>{t('help.bonus.usage.u2')}</li>
            <li>{t('help.bonus.usage.u3')}</li>
            <li>{t('help.bonus.usage.u4')}</li>
            <li>{t('help.bonus.usage.u5')}</li>
            <li>{t('help.bonus.usage.u6')}</li>
          </ol>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>💡 {t('help.bonus.tip')}</strong>
          </p>
        </div>
      </div>

      {/* Quick Reference Card */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('help.quickRef.title')}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-medium text-gray-900 mb-1">{t('help.quickRef.dailyWorkflow')}</p>
            <ol className="text-gray-600 space-y-1 ml-4 list-decimal text-xs">
              <li>{t('help.quickRef.workflow.w1')}</li>
              <li>{t('help.quickRef.workflow.w2')}</li>
              <li>{t('help.quickRef.workflow.w3')}</li>
              <li>{t('help.quickRef.workflow.w4')}</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-1">{t('help.quickRef.dataCached')}</p>
            <ul className="text-gray-600 space-y-1 ml-4 list-disc text-xs">
              <li>{t('help.quickRef.cacheInfo.c1')}</li>
              <li>{t('help.quickRef.cacheInfo.c2')}</li>
              <li>{t('help.quickRef.cacheInfo.c3')}</li>
              <li>{t('help.quickRef.cacheInfo.c4')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="card bg-primary-50 border-primary-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('help.support.title')}</h3>
        <p className="text-sm text-gray-700">
          {t('help.support.description')}
        </p>
      </div>

      {/* Important Warning: Local Storage */}
      <div className="card bg-red-50 border-2 border-red-300">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-red-900 mb-2">
              {t('help.localStorage.title')}
            </h3>
            <p className="text-sm text-red-800 mb-4">
              {t('help.localStorage.description')}
            </p>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">{t('help.localStorage.whatMeans')}</p>
          <ul className="text-sm text-gray-700 space-y-2 ml-4 list-disc">
            <li>{t('help.localStorage.implications.i1')}</li>
            <li>{t('help.localStorage.implications.i2')}</li>
            <li>{t('help.localStorage.implications.i3')}</li>
            <li>{t('help.localStorage.implications.i4')}</li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💾</span>
            <div>
              <p className="text-sm font-bold text-blue-900 mb-2">{t('help.localStorage.solution')}</p>
              <p className="text-sm text-blue-800 mb-3">
                {t('help.localStorage.solutionInfo')}
              </p>
              <ol className="text-sm text-blue-800 space-y-2 ml-4 list-decimal">
                <li>{t('help.localStorage.steps.s1')}</li>
                <li>{t('help.localStorage.steps.s2')}</li>
                <li>{t('help.localStorage.steps.s3')}</li>
                <li>{t('help.localStorage.steps.s4')}</li>
                <li>{t('help.localStorage.steps.s5')}</li>
              </ol>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>{t('help.localStorage.proTip')}</strong>
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
