import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { generateDailyNutritionPlan, getWeeklyNutritionOverview } from '../services/nutritionService';
import {
  loadNutritionGoals,
  getWeeklyTracking,
  calculateWeeklyStats,
  getCurrentWeekStart,
  saveDailyTracking,
  getDailyTracking,
  formatDateDisplay,
  getAdherenceColor,
  calculateCycleStats,
  analyzeMealPatterns
} from '../utils/nutritionTracking';
import { TRAINING_CYCLE } from '../utils/trainingCycle';

function Nutrition() {
  const { t, language } = useTranslation();

  // Meal type labels for consistent translation
  const mealLabels = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snacks: 'Snacks'
  };

  const [selectedDay, setSelectedDay] = useState('training');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [nutritionGoals, setNutritionGoals] = useState({
    primary: 'performance',
    description: 'Optimize performance for sub-2:50 marathon',
    weeklyTarget: 'Maintain 73.5kg while improving power-to-weight ratio',
    calorieStrategy: 'Periodize nutrition based on training load',
    proteinTarget: '1.6-1.8g/kg bodyweight',
    carbTarget: 'High on training days, moderate on rest days',
    expectedOutcome: 'Sustained energy, improved recovery, stable weight'
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({
    averageRating: 0,
    daysTracked: 0,
    totalDays: 7,
    adherencePercentage: 0,
    onTrack: false,
    message: 'Start tracking your nutrition to see progress!'
  });
  const [cycleStats, setCycleStats] = useState({
    totalDays: 0,
    daysTracked: 0,
    averageRating: 0,
    adherencePercentage: 0,
    excellentDays: 0,
    goodDays: 0,
    poorDays: 0,
    failedDays: 0,
    message: 'Start tracking to see your cycle progress',
    onTrack: false
  });
  const [currentWeekStart, setCurrentWeekStart] = useState(getCurrentWeekStart());
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [trackingForm, setTrackingForm] = useState({
    rating: 5,
    notes: '',
    adherence: 'good',
    actualCalories: 0,
    meals: {
      breakfast: { rating: 0, notes: '' },
      lunch: { rating: 0, notes: '' },
      dinner: { rating: 0, notes: '' },
      snacks: { rating: 0, notes: '' }
    }
  });
  const [mealAnalysis, setMealAnalysis] = useState(null);
  const [activeView, setActiveView] = useState('analysis'); // 'analysis' or 'plan'

  // Load nutrition goals and weekly data
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        console.log('🥗 Initializing nutrition tracking...');

        const goals = loadNutritionGoals();
        console.log('📊 Loaded goals:', goals);
        setNutritionGoals(goals);

        const weekStart = getCurrentWeekStart();
        console.log('📅 Current week start:', weekStart);
        setCurrentWeekStart(weekStart);

        await loadWeeklyData(weekStart);

        // Load cycle-wide stats
        console.log('📊 Training cycle:', TRAINING_CYCLE);
        if (TRAINING_CYCLE && TRAINING_CYCLE.startDate && TRAINING_CYCLE.raceDate) {
          const cycleData = await calculateCycleStats(
            TRAINING_CYCLE.startDate,
            TRAINING_CYCLE.raceDate
          );
          console.log('📈 Cycle stats:', cycleData);
          if (cycleData) {
            setCycleStats(cycleData);
          }

          // Load meal pattern analysis
          const mealData = await analyzeMealPatterns(
            TRAINING_CYCLE.startDate,
            TRAINING_CYCLE.raceDate
          );
          console.log('🍽️ Meal analysis:', mealData);
          setMealAnalysis(mealData);
        } else {
          console.warn('⚠️ Training cycle data not available');
        }

        console.log('✅ Nutrition tracking initialized');
      } catch (error) {
        console.error('❌ Error initializing nutrition tracking:', error);
      }
    };

    initializeTracking();
  }, []);

  const loadWeeklyData = async (weekStart) => {
    try {
      console.log('📊 Loading weekly data for:', weekStart);
      const data = await getWeeklyTracking(weekStart);
      console.log('📅 Weekly data:', data);
      setWeeklyData(data);

      const stats = calculateWeeklyStats(data);
      console.log('📈 Weekly stats:', stats);
      setWeeklyStats(stats);
    } catch (error) {
      console.error('❌ Error loading weekly data:', error);
      // Set empty data on error
      setWeeklyData([]);
      setWeeklyStats({
        averageRating: 0,
        daysTracked: 0,
        totalDays: 7,
        adherencePercentage: 0,
        onTrack: false,
        message: 'Error loading data. Please try refreshing.'
      });
    }
  };

  const openTrackingModal = async (date) => {
    setSelectedDate(date);
    const existing = await getDailyTracking(date);

    if (existing) {
      setTrackingForm({
        rating: existing.rating,
        notes: existing.notes || '',
        adherence: existing.adherence || 'good',
        actualCalories: existing.actualCalories || 0,
        meals: existing.meals || {
          breakfast: { rating: 0, notes: '' },
          lunch: { rating: 0, notes: '' },
          dinner: { rating: 0, notes: '' },
          snacks: { rating: 0, notes: '' }
        }
      });
    } else {
      setTrackingForm({
        rating: 5,
        notes: '',
        adherence: 'good',
        actualCalories: 0,
        meals: {
          breakfast: { rating: 0, notes: '' },
          lunch: { rating: 0, notes: '' },
          dinner: { rating: 0, notes: '' },
          snacks: { rating: 0, notes: '' }
        }
      });
    }

    setShowTrackingModal(true);
  };

  const saveTracking = async () => {
    if (!selectedDate) return;

    await saveDailyTracking(selectedDate, {
      ...trackingForm,
      plannedCalories: nutritionPlan.targets.total,
      dayType: selectedDay
    });

    await loadWeeklyData(currentWeekStart);

    // Reload cycle stats and meal analysis
    const cycleData = await calculateCycleStats(
      TRAINING_CYCLE.startDate,
      TRAINING_CYCLE.raceDate
    );
    setCycleStats(cycleData);

    const mealData = await analyzeMealPatterns(
      TRAINING_CYCLE.startDate,
      TRAINING_CYCLE.raceDate
    );
    setMealAnalysis(mealData);

    setShowTrackingModal(false);
  };

  // Generate nutrition plan for selected day type
  const nutritionPlan = generateDailyNutritionPlan(selectedDay);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('nutrition.title', '🥗 Nutrition')}
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveView('analysis')}
              className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeView === 'analysis'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Analysis
            </button>
            <button
              onClick={() => setActiveView('plan')}
              className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeView === 'plan'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🍽️ Diet Plan
            </button>
          </nav>
        </div>
      </div>

      {activeView === 'analysis' ? (
        <>
          {/* Nutrition Goal Section - Compact */}
          <div className="card mb-6 bg-gradient-to-r from-primary-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-primary-900 mb-1">
                  🎯 Goal: {nutritionGoals.description}
                </h2>
                <p className="text-xs text-primary-700">
                  {nutritionGoals.weeklyTarget} • {nutritionGoals.calorieStrategy}
                </p>
              </div>
            </div>
          </div>

          {/* Marathon Cycle Overview - Compact */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                🏃 Marathon Cycle - {TRAINING_CYCLE.marathonName}
              </h2>
            </div>

            {cycleStats.totalDays === 0 ? (
              <p className="text-sm text-gray-500">
                Start tracking to see your cycle progress
              </p>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2">
                  {/* Average Rating */}
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-700 mb-1">Avg Rating</div>
                    <div className="text-xl font-bold text-blue-900">
                      {cycleStats.averageRating}
                    </div>
                  </div>

                  {/* Days Tracked */}
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-purple-700 mb-1">Tracked</div>
                    <div className="text-xl font-bold text-purple-900">
                      {cycleStats.daysTracked}
                    </div>
                    <div className="text-xs text-purple-600">
                      {cycleStats.adherencePercentage}%
                    </div>
                  </div>

                  {/* Excellent Days */}
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-green-700 mb-1">Excellent</div>
                    <div className="text-xl font-bold text-green-900">
                      {cycleStats.excellentDays}
                    </div>
                    <div className="text-xs text-green-600">
                      {cycleStats.daysTracked > 0 ? Math.round((cycleStats.excellentDays / cycleStats.daysTracked) * 100) : 0}%
                    </div>
                  </div>

                  {/* Good Days */}
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-700 mb-1">Good</div>
                    <div className="text-xl font-bold text-blue-900">
                      {cycleStats.goodDays}
                    </div>
                    <div className="text-xs text-blue-600">
                      {cycleStats.daysTracked > 0 ? Math.round((cycleStats.goodDays / cycleStats.daysTracked) * 100) : 0}%
                    </div>
                  </div>

                  {/* Poor/Failed Days */}
                  <div className="bg-yellow-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-yellow-700 mb-1">Needs Work</div>
                    <div className="text-xl font-bold text-yellow-900">
                      {cycleStats.poorDays + cycleStats.failedDays}
                    </div>
                    <div className="text-xs text-yellow-600">
                      {cycleStats.daysTracked > 0 ? Math.round(((cycleStats.poorDays + cycleStats.failedDays) / cycleStats.daysTracked) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Weekly Tracking Section */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                📅 This Week's Progress
              </h2>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                weeklyStats.onTrack
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {weeklyStats.onTrack ? '✅ On Track' : '⚠️ Need Focus'}
              </div>
            </div>

            {/* Weekly Stats Summary */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-xs text-blue-700 mb-1">Avg Rating</div>
                <div className="text-xl font-bold text-blue-900">
                  {weeklyStats.averageRating}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-xs text-green-700 mb-1">Days Tracked</div>
                <div className="text-xl font-bold text-green-900">
                  {weeklyStats.daysTracked}/7
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <div className="text-xs text-purple-700 mb-1">Adherence</div>
                <div className="text-xl font-bold text-purple-900">
                  {weeklyStats.adherencePercentage}%
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-2xl mb-1">
                  {weeklyStats.onTrack ? '🎉' : '💪'}
                </div>
                <div className="text-xs text-gray-600">
                  {weeklyStats.onTrack ? 'Excellent!' : 'Keep going!'}
                </div>
              </div>
            </div>

            {/* Daily Tracking Grid */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Daily Tracking
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {weeklyData.map((day, index) => {
                  const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString(
                    language === 'pt_BR' ? 'pt-BR' : 'en-US',
                    { weekday: 'short' }
                  );
                  const rating = day.data?.rating || 0;
                  const color = getAdherenceColor(rating);

                  return (
                    <button
                      key={day.date}
                      onClick={() => openTrackingModal(day.date)}
                      className={`p-2 rounded border-2 transition-all hover:shadow-sm ${
                        rating === 0
                          ? 'border-gray-200 bg-gray-50'
                          : color === 'green'
                          ? 'border-green-500 bg-green-50'
                          : color === 'blue'
                          ? 'border-blue-500 bg-blue-50'
                          : color === 'yellow'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-red-500 bg-red-50'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {dayName}
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(day.date + 'T00:00:00').getDate()}
                      </div>
                      {rating > 0 && (
                        <div className={`text-lg font-bold mt-1 ${
                          color === 'green' ? 'text-green-700' :
                          color === 'blue' ? 'text-blue-700' :
                          color === 'yellow' ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {rating}
                        </div>
                      )}
                      {rating === 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          -
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Meal Pattern Analysis */}
          {mealAnalysis && mealAnalysis.sortedMeals.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                🍽️ Meal Pattern Analysis
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Most Problematic Meal */}
                {mealAnalysis.mostProblematic && mealAnalysis.mostProblematic.avgRating < 7 && (
                  <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">⚠️</span>
                      <h3 className="text-sm font-semibold text-red-900">
                        Needs Attention
                      </h3>
                    </div>
                    <div className="mb-2">
                      <div className="text-lg font-bold text-gray-900">
                        {mealLabels[mealAnalysis.mostProblematic.meal]}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg Rating: <span className="font-semibold text-red-700">{mealAnalysis.mostProblematic.avgRating}/10</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {mealAnalysis.mostProblematic.count} days tracked
                      </div>
                    </div>
                    {mealAnalysis.mostProblematic.issues.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                          Recent Issues:
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          {mealAnalysis.mostProblematic.issues.slice(0, 2).map((issue, idx) => (
                            <div key={idx} className="bg-red-50 rounded p-1">
                              <div className="font-medium">{issue.date}: {issue.rating}/10</div>
                              {issue.notes && <div className="italic">&quot;{issue.notes.substring(0, 50)}...&quot;</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Best Performing Meal */}
                {mealAnalysis.bestPerforming && (
                  <div className="bg-white rounded-lg p-3 border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">✅</span>
                      <h3 className="text-sm font-semibold text-green-900">
                        Performing Well
                      </h3>
                    </div>
                    <div className="mb-2">
                      <div className="text-lg font-bold text-gray-900">
                        {mealLabels[mealAnalysis.bestPerforming.meal]}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg Rating: <span className="font-semibold text-green-700">{mealAnalysis.bestPerforming.avgRating}/10</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {mealAnalysis.bestPerforming.count} days tracked
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-green-700">
                        Great consistency! Keep up the good work with this meal.
                      </div>
                    </div>
                  </div>
                )}
          </div>

              {/* All Meals Summary */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">
                  All Meals Overview
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {mealAnalysis.sortedMeals.map(meal => (
                    <div key={meal.meal} className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {mealLabels[meal.meal]}
                      </div>
                      <div className={`text-lg font-bold ${
                        parseFloat(meal.avgRating) >= 8 ? 'text-green-700' :
                        parseFloat(meal.avgRating) >= 6 ? 'text-blue-700' :
                        parseFloat(meal.avgRating) >= 4 ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {meal.avgRating}
                      </div>
                      <div className="text-xs text-gray-500">
                        {meal.count} days
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Diet Plan View */}

          {/* Day Type Selector */}
          <div className="card mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Select Day Type
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedDay('training')}
                className={`p-3 rounded border-2 transition-all ${
                  selectedDay === 'training'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="text-xl mb-1">🏃</div>
                <div className="text-sm font-medium text-gray-900">
                  Training Day
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Regular workout
                </div>
              </button>

              <button
                onClick={() => setSelectedDay('carb-load')}
                className={`p-3 rounded border-2 transition-all ${
                  selectedDay === 'carb-load'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="text-xl mb-1">📈</div>
                <div className="text-sm font-medium text-gray-900">
                  Friday
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Pre-long run
                </div>
              </button>

              <button
                onClick={() => setSelectedDay('rest')}
                className={`p-3 rounded border-2 transition-all ${
                  selectedDay === 'rest'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="text-xl mb-1">😴</div>
                <div className="text-sm font-medium text-gray-900">
                  Sunday
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Rest day
                </div>
              </button>
            </div>
          </div>

          {/* Energy & Macro Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Daily Targets */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Daily Targets
                </h3>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="text-primary-600 hover:text-primary-700 text-sm"
                >
                  ℹ️
                </button>
              </div>

              <div className="space-y-3">
                {/* Total Calories */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded p-3">
                  <div className="text-xs text-primary-700 mb-1">
                    Total Calories
                  </div>
                  <div className="text-2xl font-bold text-primary-900">
                    {nutritionPlan.targets.total} <span className="text-sm font-normal">kcal</span>
                  </div>
                  <div className="text-xs text-primary-600 mt-1">
                    {nutritionPlan.energyNeeds.description}
                  </div>
                </div>

                {/* Macros Breakdown */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Carbs */}
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="text-xs text-blue-700 mb-1">
                      Carbs
                    </div>
                    <div className="text-lg font-bold text-blue-900">
                      {nutritionPlan.targets.carbs.grams}g
                    </div>
                    <div className="text-xs text-blue-600">
                      {nutritionPlan.targets.carbs.percent}%
                    </div>
                  </div>

                  {/* Protein */}
                  <div className="bg-red-50 rounded p-2 text-center">
                    <div className="text-xs text-red-700 mb-1">
                      Protein
                    </div>
                    <div className="text-lg font-bold text-red-900">
                      {nutritionPlan.targets.protein.grams}g
                    </div>
                    <div className="text-xs text-red-600">
                      {nutritionPlan.targets.protein.percent}%
                    </div>
                  </div>

                  {/* Fats */}
                  <div className="bg-yellow-50 rounded p-2 text-center">
                    <div className="text-xs text-yellow-700 mb-1">
                      Fats
                    </div>
                    <div className="text-lg font-bold text-yellow-900">
                      {nutritionPlan.targets.fats.grams}g
                    </div>
                    <div className="text-xs text-yellow-600">
                      {nutritionPlan.targets.fats.percent}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hydration & Supplements */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Hydration & Supplements
              </h3>

              {/* Hydration */}
              <div className="mb-3 bg-blue-50 rounded p-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm">💧</span>
                  <h4 className="text-xs font-medium text-blue-900">
                    Hydration
                  </h4>
                </div>
                <div className="text-xs text-blue-800 space-y-1">
                  <div>Daily: <strong>{nutritionPlan.hydration.baseWater}</strong></div>
                  <div>Training: <strong>{nutritionPlan.hydration.duringTraining}</strong></div>
                </div>
              </div>

              {/* Supplements */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-sm">💊</span>
                  <h4 className="text-xs font-medium text-gray-900">
                    Supplements
                  </h4>
                </div>
                <div className="space-y-1">
                  {nutritionPlan.supplements.map((supp, idx) => (
                    <div key={idx} className="text-xs bg-gray-50 rounded p-2">
                      <div className="font-medium text-gray-900">{supp.name}</div>
                      <div className="text-gray-600">{supp.dose} • {supp.timing}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

      {/* Meal Plan */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('nutrition.mealPlan', 'Meal Plan')}
        </h2>

        {/* Pre-Training (only if not rest day) */}
        {nutritionPlan.meals.preTraining.total.cal > 0 && (
          <MealCard meal={nutritionPlan.meals.preTraining} icon="⚡" />
        )}

        {/* Breakfast */}
        <MealCard meal={nutritionPlan.meals.breakfast} icon="🌅" />

        {/* Lunch */}
        <MealCard meal={nutritionPlan.meals.lunch} icon="🍽️" />

        {/* Afternoon Snack */}
        <MealCard meal={nutritionPlan.meals.afternoonSnack} icon="🥤" />

        {/* Dinner */}
        <MealCard meal={nutritionPlan.meals.dinner} icon="🌙" />

        {/* Pre-Bed */}
        <MealCard meal={nutritionPlan.meals.preBed} icon="😴" />
      </div>

          {/* Daily Summary */}
          <div className="card mt-6 bg-gradient-to-r from-gray-50 to-blue-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Daily Summary
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Calories</div>
                <div className="text-lg font-bold text-primary-900">
                  {nutritionPlan.dailyTotals.calories}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Carbs</div>
                <div className="text-lg font-bold text-blue-700">
                  {nutritionPlan.dailyTotals.carbs}g
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Protein</div>
                <div className="text-lg font-bold text-red-700">
                  {nutritionPlan.dailyTotals.protein}g
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Fats</div>
                <div className="text-lg font-bold text-yellow-700">
                  {nutritionPlan.dailyTotals.fats}g
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="card mt-6 bg-primary-50 border-2 border-primary-200">
            <h3 className="text-sm font-semibold text-primary-900 mb-2">
              💡 Nutrition Tips
            </h3>
            <ul className="space-y-1">
              {nutritionPlan.tips.map((tip, idx) => (
                <li key={idx} className="text-xs text-primary-800 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <InfoModal
          nutritionPlan={nutritionPlan}
          onClose={() => setShowInfoModal(false)}
        />
      )}

      {/* Tracking Modal */}
      {showTrackingModal && selectedDate && (
        <TrackingModal
          date={selectedDate}
          trackingForm={trackingForm}
          setTrackingForm={setTrackingForm}
          onSave={saveTracking}
          onClose={() => setShowTrackingModal(false)}
          language={language}
        />
      )}
    </div>
  );
}

/**
 * Meal Card Component
 */
function MealCard({ meal, icon }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                {meal.name}
              </h3>
              <p className="text-sm text-gray-500">{meal.timing}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {t('nutrition.target', 'Target')}
              </div>
              <div className="text-xl font-bold text-primary-600">
                {meal.targetCalories} kcal
              </div>
            </div>
            <span className="text-2xl text-gray-400">
              {expanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Foods List */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    {t('nutrition.food', 'Food')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    {t('nutrition.amount', 'Amount')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.calories', 'Cal')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.carbs', 'C')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.protein', 'P')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.fats', 'F')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {meal.foods.map((food, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{food.item}</td>
                    <td className="px-3 py-2 text-gray-600">{food.amount}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {food.cal}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-700">
                      {food.carbs}g
                    </td>
                    <td className="px-3 py-2 text-right text-red-700">
                      {food.protein}g
                    </td>
                    <td className="px-3 py-2 text-right text-yellow-700">
                      {food.fats}g
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan="2">
                    {t('nutrition.total', 'Total')}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {meal.total.cal}
                  </td>
                  <td className="px-3 py-2 text-right text-blue-800">
                    {meal.total.carbs}g
                  </td>
                  <td className="px-3 py-2 text-right text-red-800">
                    {meal.total.protein}g
                  </td>
                  <td className="px-3 py-2 text-right text-yellow-800">
                    {meal.total.fats}g
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {meal.notes && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 {t('nutrition.note', 'Note')}:</strong> {meal.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Info Modal Component
 */
function InfoModal({ nutritionPlan, onClose }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('nutrition.howCalculated', 'How Nutrition Plan is Calculated')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Energy Calculation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              {t('nutrition.energyCalculation', 'Energy Calculation')}
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                <strong>{t('nutrition.bmr', 'BMR (Basal Metabolic Rate)')}:</strong>{' '}
                {nutritionPlan.energyNeeds.bmr} kcal
              </p>
              <p className="text-xs text-blue-700">
                {t('nutrition.bmrDesc', 'Energy needed for basic body functions at rest (Mifflin-St Jeor equation)')}
              </p>
              <p className="mt-2">
                <strong>{t('nutrition.tdee', 'TDEE (Total Daily Energy Expenditure)')}:</strong>{' '}
                {nutritionPlan.energyNeeds.tdee} kcal
              </p>
              <p className="text-xs text-blue-700">
                {t('nutrition.tdeeDesc', 'BMR × Activity Factor based on training load')}
              </p>
            </div>
          </div>

          {/* Macros Rationale */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              {t('nutrition.macrosRationale', 'Macronutrient Rationale')}
            </h3>
            <div className="text-sm text-green-800 space-y-2">
              <p>
                <strong>{t('nutrition.protein', 'Protein')}:</strong>{' '}
                {nutritionPlan.targets.protein.grams}g ({(nutritionPlan.targets.protein.grams / nutritionPlan.athlete.weight).toFixed(1)}g/kg)
              </p>
              <p className="text-xs text-green-700 ml-4">
                {t('nutrition.proteinDesc', '• Essential for muscle repair and recovery\n• 1.6-1.8g/kg for endurance athletes (Phillips & Van Loon, 2011)')}
              </p>
              <p className="mt-2">
                <strong>{t('nutrition.carbs', 'Carbs')}:</strong>{' '}
                {nutritionPlan.targets.carbs.grams}g ({nutritionPlan.targets.carbs.percent}%)
              </p>
              <p className="text-xs text-green-700 ml-4">
                {t('nutrition.carbsDesc', '• Primary fuel for high-intensity training\n• Varies by training load: 45-60% of calories')}
              </p>
              <p className="mt-2">
                <strong>{t('nutrition.fats', 'Fats')}:</strong>{' '}
                {nutritionPlan.targets.fats.grams}g ({nutritionPlan.targets.fats.percent}%)
              </p>
              <p className="text-xs text-green-700 ml-4">
                {t('nutrition.fatsDesc', '• Hormone production and long-term energy\n• 20-30% of calories for optimal health')}
              </p>
            </div>
          </div>

          {/* Research References */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('nutrition.researchReferences', 'Research References')}
            </h3>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• Burke, L.M. et al. (2011). Carbohydrates for training and competition. Journal of Sports Sciences.</li>
              <li>• Phillips, S.M. & Van Loon, L.J. (2011). Dietary protein for athletes. Sports Medicine.</li>
              <li>• Thomas, D.T. et al. (2016). Position of the Academy of Nutrition and Dietetics. Medicine & Science in Sports & Exercise.</li>
              <li>• Jeukendrup, A.E. (2014). A Step Towards Personalized Sports Nutrition. Sports Medicine.</li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ {t('nutrition.disclaimer', 'Disclaimer')}:</strong>{' '}
              {t('nutrition.disclaimerText', 'This is a general nutrition plan based on scientific literature and typical athlete profiles. Individual needs vary. Consult a sports nutritionist or registered dietitian for personalized recommendations.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tracking Modal Component
 */
function TrackingModal({ date, trackingForm, setTrackingForm, onSave, onClose, language }) {
  const { t } = useTranslation();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(language === 'pt_BR' ? 'pt-BR' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('nutrition.trackDay', 'Track Your Day')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatDate(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Meal-Level Ratings */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              🍽️ Rate Each Meal
            </h3>
            <p className="text-xs text-blue-700 mb-4">
              Rate each meal individually. Your day rating will be calculated automatically.
            </p>

            <div className="space-y-4">
              {[
                { key: 'breakfast', label: 'Breakfast' },
                { key: 'lunch', label: 'Lunch' },
                { key: 'dinner', label: 'Dinner' },
                { key: 'snacks', label: 'Snacks' }
              ].map(({ key, label }) => {
                const meal = trackingForm.meals[key];
                return (
                  <div key={key} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-900">
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          value={meal.rating}
                          onChange={(e) => {
                            const newMeals = {
                              ...trackingForm.meals,
                              [key]: { ...meal, rating: parseInt(e.target.value) }
                            };
                            setTrackingForm({ ...trackingForm, meals: newMeals });
                          }}
                          className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                        <div className={`text-lg font-bold min-w-[2rem] text-center ${
                          meal.rating >= 8 ? 'text-green-700' :
                          meal.rating >= 6 ? 'text-blue-700' :
                          meal.rating >= 4 ? 'text-yellow-700' :
                          meal.rating > 0 ? 'text-red-700' :
                          'text-gray-400'
                        }`}>
                          {meal.rating > 0 ? meal.rating : '-'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={meal.notes}
                      onChange={(e) => {
                        const newMeals = {
                          ...trackingForm.meals,
                          [key]: { ...meal, notes: e.target.value }
                        };
                        setTrackingForm({ ...trackingForm, meals: newMeals });
                      }}
                      placeholder="Notes (e.g., timing, portions, how you felt)..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Day Rating (Auto-calculated or Manual) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Overall Day Rating
            </label>
            {(() => {
              const mealRatings = Object.values(trackingForm.meals)
                .map(m => m.rating)
                .filter(r => r > 0);

              if (mealRatings.length > 0) {
                const avgRating = Math.round(mealRatings.reduce((sum, r) => sum + r, 0) / mealRatings.length);
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-green-700 mb-1">
                          Auto-calculated from meals
                        </div>
                        <div className="text-xs text-green-600">
                          Based on {mealRatings.length} meal{mealRatings.length > 1 ? 's' : ''} rated
                        </div>
                      </div>
                      <div className="text-4xl font-bold text-green-700">
                        {avgRating}
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={trackingForm.rating}
                        onChange={(e) => setTrackingForm({ ...trackingForm, rating: parseInt(e.target.value) })}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                      />
                      <div className="text-3xl font-bold text-primary-600 min-w-[3rem] text-center">
                        {trackingForm.rating}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>0 - Terrible</span>
                      <span>5 - Okay</span>
                      <span>10 - Perfect</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 italic">
                      Rate individual meals above for more detailed insights
                    </div>
                  </div>
                );
              }
            })()}
          </div>

          {/* Adherence Level */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              {t('nutrition.adherenceLevel', 'Adherence Level')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'excellent', label: t('nutrition.excellent', 'Excellent'), emoji: '🎉', color: 'green' },
                { value: 'good', label: t('nutrition.good', 'Good'), emoji: '👍', color: 'blue' },
                { value: 'poor', label: t('nutrition.poor', 'Poor'), emoji: '😐', color: 'yellow' },
                { value: 'failed', label: t('nutrition.failed', 'Failed'), emoji: '❌', color: 'red' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTrackingForm({ ...trackingForm, adherence: option.value })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    trackingForm.adherence === option.value
                      ? `border-${option.color}-500 bg-${option.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {option.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actual Calories (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              {t('nutrition.actualCalories', 'Actual Calories Consumed')} ({t('nutrition.optional', 'optional')})
            </label>
            <input
              type="number"
              min="0"
              max="10000"
              value={trackingForm.actualCalories || ''}
              onChange={(e) => setTrackingForm({ ...trackingForm, actualCalories: parseInt(e.target.value) || 0 })}
              placeholder={t('nutrition.caloriesPlaceholder', 'e.g., 2800')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              {t('nutrition.notes', 'Notes')}
            </label>
            <textarea
              value={trackingForm.notes}
              onChange={(e) => setTrackingForm({ ...trackingForm, notes: e.target.value })}
              rows="4"
              placeholder={t('nutrition.notesPlaceholder', 'What went well? What could be improved? Any challenges?')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onSave}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              {t('nutrition.saveTracking', 'Save Tracking')}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('nutrition.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Nutrition;
