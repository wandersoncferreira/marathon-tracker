/**
 * Nutrition Service
 * Provides personalized nutrition recommendations for marathon training
 * Based on training load, body composition, and Brazilian dietary patterns
 */

import { TRAINING_CYCLE } from '../utils/trainingCycle';

// Athlete profile (from training data)
const ATHLETE_PROFILE = {
  weight: 73.5, // kg
  height: 175, // cm (estimated for sub-2h50 marathoner)
  age: 35, // estimated
  gender: 'male',
  bodyFat: 12, // % (estimated for elite marathoner)
  runningFTP: 360, // watts
  marathonGoal: '2:50:00',
  weeklyVolume: 70 // km average
};

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor equation
 */
function calculateBMR(profile = ATHLETE_PROFILE) {
  const { weight, height, age, gender } = profile;

  if (gender === 'male') {
    return (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 * @param {string} dayType - 'training', 'rest', 'carb-load', 'race'
 * @param {number} trainingLoad - TSS or training minutes
 * @param {string} intensity - 'easy', 'moderate', 'hard'
 */
export function calculateTDEE(dayType = 'training', trainingLoad = 0, intensity = 'moderate') {
  const bmr = calculateBMR();

  // Base activity multiplier (sedentary lifestyle + training)
  let activityMultiplier = 1.2; // Sedentary base

  // Add training expenditure
  switch (dayType) {
    case 'rest':
      activityMultiplier = 1.3; // Light activity (daily life only)
      break;

    case 'training':
      // Regular training day - adjust by intensity
      if (intensity === 'easy') {
        activityMultiplier = 1.5; // Easy run day
      } else if (intensity === 'moderate') {
        activityMultiplier = 1.7; // Moderate workout
      } else {
        activityMultiplier = 1.85; // Hard workout
      }
      break;

    case 'carb-load':
      // Day before long run - slightly elevated for glycogen storage
      activityMultiplier = 1.6;
      break;

    case 'race':
      // Race day - highest expenditure
      activityMultiplier = 2.0;
      break;

    default:
      activityMultiplier = 1.6;
  }

  return Math.round(bmr * activityMultiplier);
}

/**
 * Calculate macronutrient targets
 * @param {number} tdee - Total daily energy expenditure
 * @param {string} dayType - Type of day
 * @returns {object} - Protein, carbs, fats in grams and percentages
 */
export function calculateMacros(tdee, dayType = 'training') {
  const weight = ATHLETE_PROFILE.weight;

  let carbPercent, proteinGrams, fatPercent;

  switch (dayType) {
    case 'rest':
      // Rest day: Lower carbs, maintain protein
      proteinGrams = weight * 1.6; // 1.6g/kg
      carbPercent = 45; // 45% of calories
      fatPercent = 30; // 30% of calories
      break;

    case 'carb-load':
      // Pre-long run: High carbs
      proteinGrams = weight * 1.6;
      carbPercent = 60; // 60% of calories
      fatPercent = 20; // 20% of calories
      break;

    case 'training':
    default:
      // Training day: Balanced high-carb
      proteinGrams = weight * 1.8; // 1.8g/kg
      carbPercent = 55; // 55% of calories
      fatPercent = 25; // 25% of calories
      break;
  }

  // Calculate remaining calories for protein as percentage
  const proteinCalories = proteinGrams * 4;
  const proteinPercent = Math.round((proteinCalories / tdee) * 100);

  // Calculate carbs and fats in grams
  const carbCalories = tdee * (carbPercent / 100);
  const carbGrams = Math.round(carbCalories / 4);

  const fatCalories = tdee * (fatPercent / 100);
  const fatGrams = Math.round(fatCalories / 9);

  return {
    protein: {
      grams: Math.round(proteinGrams),
      calories: Math.round(proteinCalories),
      percent: proteinPercent
    },
    carbs: {
      grams: carbGrams,
      calories: Math.round(carbCalories),
      percent: carbPercent
    },
    fats: {
      grams: fatGrams,
      calories: Math.round(fatCalories),
      percent: fatPercent
    },
    total: tdee
  };
}

/**
 * Generate meal plan with Brazilian foods
 * @param {object} macros - Target macros
 * @param {string} dayType - Type of day
 */
export function generateMealPlan(macros, dayType = 'training') {
  const { protein, carbs, fats, total } = macros;

  // Distribute calories across meals
  // User routine: 4:30AM pre-run, 6:00-6:30AM breakfast (post-run), 12PM lunch, 3PM snack, 6PM dinner, 8PM pre-bed
  // Pre-training: 8%, Breakfast: 22%, Lunch: 35%, Afternoon snack: 15%, Dinner: 15%, Pre-bed: 5%
  const preTrainingCal = Math.round(total * 0.08);
  const breakfastCal = Math.round(total * 0.22);
  const lunchCal = Math.round(total * 0.35);
  const snackCal = Math.round(total * 0.15);
  const dinnerCal = Math.round(total * 0.15);
  const preBedCal = Math.round(total * 0.05);

  const mealPlan = {
    preTraining: generatePreTraining(preTrainingCal, dayType),
    breakfast: generateBreakfast(breakfastCal, dayType),
    lunch: generateLunch(lunchCal, dayType),
    afternoonSnack: generateAfternoonSnack(snackCal, dayType),
    dinner: generateDinner(dinnerCal, dayType),
    preBed: generatePreBed(preBedCal, dayType)
  };

  return mealPlan;
}

/**
 * Generate pre-training snack (4:30 AM - before run)
 */
function generatePreTraining(targetCal, dayType) {
  const isRestDay = dayType === 'rest';

  if (isRestDay) {
    // Rest day - no pre-training meal needed
    return {
      name: 'Pré-Treino - Dia de Descanso',
      targetCalories: 0,
      foods: [],
      total: { cal: 0, carbs: 0, protein: 0, fats: 0 },
      timing: 'N/A',
      notes: 'Sem treino hoje - pode dormir até mais tarde! 😴'
    };
  }

  // Light, easily digestible pre-run fuel
  return {
    name: 'Pré-Treino (Antes da Corrida)',
    targetCalories: targetCal,
    foods: [
      { item: 'Banana', amount: '1 pequena (80g)', cal: 70, carbs: 18, protein: 1, fats: 0 },
      { item: 'Pão francês ou torrada', amount: '1/2 unidade (20g)', cal: 55, carbs: 10, protein: 2, fats: 1 },
      { item: 'Mel', amount: '1 colher de chá', cal: 20, carbs: 5, protein: 0, fats: 0 },
      { item: 'Água', amount: '200-300ml', cal: 0, carbs: 0, protein: 0, fats: 0 }
    ],
    total: { cal: 145, carbs: 33, protein: 3, fats: 1 },
    timing: '4:30 AM (30-45 min antes da corrida)',
    notes: '⚡ Carboidratos de rápida absorção para energia. Mantém leve para evitar desconforto gástrico!'
  };
}

/**
 * Generate breakfast based on user's preferences
 * POST-TRAINING meal (6:00-6:30 AM after early morning run)
 * LACTOSE-FREE options
 */
function generateBreakfast(targetCal, dayType) {
  const isRestDay = dayType === 'rest';
  const isCarbLoad = dayType === 'carb-load';

  if (isRestDay) {
    // Lower carb rest day breakfast (but still substantial since it's first real meal)
    return {
      name: 'Café da Manhã - Domingo (Descanso)',
      targetCalories: targetCal,
      foods: [
        { item: 'Pão integral', amount: '2 fatias (60g)', cal: 150, carbs: 28, protein: 6, fats: 2 },
        { item: 'Ovos mexidos', amount: '3 ovos grandes', cal: 210, carbs: 3, protein: 18, fats: 15 },
        { item: 'Abacate', amount: '1/4 unidade (50g)', cal: 80, carbs: 4, protein: 1, fats: 7 },
        { item: 'Banana', amount: '1 pequena (80g)', cal: 70, carbs: 18, protein: 1, fats: 0 },
        { item: 'Aveia', amount: '25g', cal: 95, carbs: 17, protein: 3, fats: 2 },
        { item: 'Café preto ou com leite sem lactose', amount: '200ml', cal: 35, carbs: 5, protein: 2, fats: 1 }
      ],
      total: { cal: 640, carbs: 75, protein: 31, fats: 27 },
      timing: '7:00-8:00 AM (sem pressa, pode dormir mais!)',
      notes: '😴 Dia de descanso: Mais proteína e gorduras boas, menos carboidratos. Café da manhã reforçado.'
    };
  } else if (isCarbLoad) {
    // High-carb Friday breakfast (no pre-run, different timing)
    return {
      name: 'Café da Manhã - Sexta (Véspera do Longão)',
      targetCalories: targetCal,
      foods: [
        { item: 'Pão francês ou integral', amount: '2 unidades (60g)', cal: 160, carbs: 30, protein: 5, fats: 2 },
        { item: 'Geleia ou mel', amount: '1.5 colheres de sopa', cal: 75, carbs: 19, protein: 0, fats: 0 },
        { item: 'Ovos cozidos', amount: '2 ovos', cal: 140, carbs: 1, protein: 12, fats: 10 },
        { item: 'Banana', amount: '1 média (100g)', cal: 90, carbs: 23, protein: 1, fats: 0 },
        { item: 'Aveia', amount: '30g', cal: 115, carbs: 20, protein: 4, fats: 2 },
        { item: 'Suco de laranja natural', amount: '100ml', cal: 45, carbs: 10, protein: 1, fats: 0 },
        { item: 'Café com leite sem lactose', amount: '150ml', cal: 40, carbs: 6, protein: 2, fats: 1 }
      ],
      total: { cal: 665, carbs: 109, protein: 25, fats: 15 },
      timing: '7:00-8:00 AM (após treino leve)',
      notes: '📈 Carregamento: MUITOS carboidratos! Proteína moderada, gordura baixa para facilitar digestão.'
    };
  } else {
    // Regular training day breakfast - POST-RUN recovery meal
    return {
      name: 'Café da Manhã - Pós-Treino',
      targetCalories: targetCal,
      foods: [
        { item: 'Pão integral ou francês', amount: '2-3 fatias/unid (75g)', cal: 190, carbs: 36, protein: 7, fats: 2 },
        { item: 'Ovos mexidos', amount: '3 ovos grandes', cal: 210, carbs: 3, protein: 18, fats: 15 },
        { item: 'Banana', amount: '1 média (100g)', cal: 90, carbs: 23, protein: 1, fats: 0 },
        { item: 'Aveia', amount: '35g', cal: 130, carbs: 24, protein: 4, fats: 2 },
        { item: 'Pasta de amendoim', amount: '1 colher de sopa (16g)', cal: 95, carbs: 3, protein: 4, fats: 8 },
        { item: 'Café com leite sem lactose', amount: '200ml', cal: 50, carbs: 7, protein: 3, fats: 1 },
        { item: 'Suco de laranja (opcional)', amount: '100ml', cal: 45, carbs: 10, protein: 1, fats: 0 }
      ],
      total: { cal: 810, carbs: 106, protein: 38, fats: 28 },
      timing: '6:00-6:30 AM (30-60 min após o treino)',
      notes: '💪 RECUPERAÇÃO: Janela anabólica! Carboidratos + proteína para repor glicogênio e reparar músculos.'
    };
  }
}

/**
 * Generate lunch (main meal)
 */
function generateLunch(targetCal, dayType) {
  const isRestDay = dayType === 'rest';
  const isCarbLoad = dayType === 'carb-load';

  if (isRestDay) {
    return {
      name: 'Almoço - Dia de Descanso',
      targetCalories: targetCal,
      foods: [
        { item: 'Arroz integral', amount: '3 colheres de sopa (60g)', cal: 75, carbs: 17, protein: 2, fats: 1 },
        { item: 'Feijão preto/carioca', amount: '1 concha média (80g)', cal: 80, carbs: 14, protein: 5, fats: 0 },
        { item: 'Peito de frango grelhado', amount: '150g', cal: 240, carbs: 0, protein: 45, fats: 5 },
        { item: 'Salada verde (alface, tomate, pepino)', amount: '1 prato grande', cal: 30, carbs: 6, protein: 2, fats: 0 },
        { item: 'Brócolis ou couve refogada', amount: '1 xícara (90g)', cal: 40, carbs: 7, protein: 3, fats: 1 },
        { item: 'Azeite (na salada)', amount: '1 colher de sobremesa (8ml)', cal: 70, carbs: 0, protein: 0, fats: 8 },
        { item: 'Abacate', amount: '1/4 unidade (50g)', cal: 80, carbs: 4, protein: 1, fats: 7 }
      ],
      total: { cal: 615, carbs: 48, protein: 58, fats: 22 },
      timing: '12:00 PM (meio-dia)',
      notes: '🥗 Dia de descanso: Mais proteína e gorduras saudáveis, menos arroz. Pode comer com calma!'
    };
  } else if (isCarbLoad) {
    return {
      name: 'Almoço - Sexta (Véspera do Longão)',
      targetCalories: targetCal,
      foods: [
        { item: 'Arroz branco', amount: '5 colheres de sopa (100g)', cal: 125, carbs: 28, protein: 3, fats: 0 },
        { item: 'Feijão', amount: '1 concha média (80g)', cal: 80, carbs: 14, protein: 5, fats: 0 },
        { item: 'Frango grelhado (sem pele)', amount: '150g', cal: 240, carbs: 0, protein: 45, fats: 5 },
        { item: 'Batata doce cozida', amount: '1 média (120g)', cal: 105, carbs: 24, protein: 2, fats: 0 },
        { item: 'Legumes cozidos (cenoura, abobrinha)', amount: '1 xícara', cal: 50, carbs: 11, protein: 2, fats: 0 },
        { item: 'Salada verde simples', amount: '1 prato', cal: 30, carbs: 6, protein: 2, fats: 0 },
        { item: 'Macarrão (opcional)', amount: '1/2 xícara (50g)', cal: 90, carbs: 18, protein: 3, fats: 1 },
        { item: 'Suco de fruta natural', amount: '100ml', cal: 45, carbs: 10, protein: 1, fats: 0 }
      ],
      total: { cal: 765, carbs: 111, protein: 63, fats: 6 },
      timing: '12:00 PM (meio-dia)',
      notes: '📈 Carregamento: MUITO carboidrato, proteína alta, gordura mínima. Evite fibras excessivas.'
    };
  } else {
    return {
      name: 'Almoço - Dia de Treino',
      targetCalories: targetCal,
      foods: [
        { item: 'Arroz branco ou integral', amount: '5 colheres de sopa (100g)', cal: 125, carbs: 28, protein: 3, fats: 0 },
        { item: 'Feijão preto/carioca', amount: '1 concha média (80g)', cal: 80, carbs: 14, protein: 5, fats: 0 },
        { item: 'Carne magra (frango, peixe, ou carne vermelha)', amount: '150g', cal: 250, carbs: 0, protein: 45, fats: 7 },
        { item: 'Salada verde mista', amount: '1 prato grande', cal: 30, carbs: 6, protein: 2, fats: 0 },
        { item: 'Legumes variados (cenoura, abobrinha, beterraba)', amount: '1 xícara', cal: 60, carbs: 13, protein: 2, fats: 0 },
        { item: 'Azeite extra virgem', amount: '1 colher de sobremesa (8ml)', cal: 70, carbs: 0, protein: 0, fats: 8 },
        { item: 'Batata doce ou mandioca', amount: '80g', cal: 70, carbs: 16, protein: 1, fats: 0 }
      ],
      total: { cal: 685, carbs: 77, protein: 58, fats: 15 },
      timing: '12:00 PM (meio-dia)',
      notes: 'Refeição completa: Energia sustentada para a tarde. Boa mistura de carboidratos e proteínas.'
    };
  }
}

/**
 * Generate afternoon snack (user's oatmeal porridge pattern)
 * LACTOSE-FREE version with his exact recipe
 */
function generateAfternoonSnack(targetCal, dayType) {
  const isRestDay = dayType === 'rest';
  const isCarbLoad = dayType === 'carb-load';

  if (isRestDay) {
    return {
      name: 'Lanche da Tarde - Domingo (Descanso)',
      targetCalories: targetCal,
      foods: [
        { item: 'Aveia em flocos', amount: '30g', cal: 115, carbs: 20, protein: 4, fats: 2 },
        { item: 'Banana (no mingau)', amount: '1 pequena (80g)', cal: 70, carbs: 18, protein: 1, fats: 0 },
        { item: 'Maçã picada (no mingau)', amount: '1 pequena (100g)', cal: 55, carbs: 14, protein: 0, fats: 0 },
        { item: 'Pasta de amendoim', amount: '1 colher de sopa (16g)', cal: 95, carbs: 3, protein: 4, fats: 8 },
        { item: 'Leite sem lactose (no mingau)', amount: '150ml', cal: 60, carbs: 8, protein: 5, fats: 1 },
        { item: 'Canela em pó (opcional)', amount: 'a gosto', cal: 0, carbs: 0, protein: 0, fats: 0 }
      ],
      total: { cal: 395, carbs: 63, protein: 14, fats: 11 },
      timing: '3:00 PM (15:00hrs)',
      notes: '😴 Versão reduzida do mingau para dia de descanso. Ainda nutritivo e saboroso!'
    };
  } else if (isCarbLoad) {
    return {
      name: 'Lanche da Tarde - Sexta (Véspera do Longão)',
      targetCalories: targetCal,
      foods: [
        { item: 'Mingau de aveia', amount: '45g de aveia', cal: 170, carbs: 30, protein: 6, fats: 3 },
        { item: 'Banana', amount: '1 média (100g)', cal: 90, carbs: 23, protein: 1, fats: 0 },
        { item: 'Maçã', amount: '1 pequena (140g)', cal: 75, carbs: 19, protein: 0, fats: 0 },
        { item: 'Mel', amount: '1 colher de sopa', cal: 60, carbs: 17, protein: 0, fats: 0 },
        { item: 'Leite sem lactose (no mingau)', amount: '150ml', cal: 55, carbs: 8, protein: 5, fats: 0 },
        { item: 'Água', amount: 'para consistência', cal: 0, carbs: 0, protein: 0, fats: 0 }
      ],
      total: { cal: 450, carbs: 97, protein: 12, fats: 3 },
      timing: '3:00 PM (15:00hrs)',
      notes: '📈 Carregamento: Extra carboidratos! Menos pasta de amendoim para manter gordura baixa.'
    };
  } else {
    // Regular pattern - user's EXACT favorite recipe with lactose-free milk
    return {
      name: 'Lanche da Tarde - Mingau',
      targetCalories: targetCal,
      foods: [
        { item: 'Aveia em flocos', amount: '40g', cal: 150, carbs: 27, protein: 5, fats: 2 },
        { item: 'Banana (no mingau)', amount: '1 média (100g)', cal: 90, carbs: 23, protein: 1, fats: 0 },
        { item: 'Maçã picada (no mingau)', amount: '1 pequena (130g)', cal: 70, carbs: 18, protein: 0, fats: 0 },
        { item: 'Pasta de amendoim', amount: '1 colher de sopa (16g)', cal: 95, carbs: 3, protein: 4, fats: 8 },
        { item: 'Leite sem lactose (no mingau)', amount: '200ml', cal: 80, carbs: 10, protein: 6, fats: 1 },
        { item: 'Canela em pó (opcional)', amount: 'a gosto', cal: 0, carbs: 0, protein: 0, fats: 0 }
      ],
      total: { cal: 485, carbs: 81, protein: 16, fats: 11 },
      timing: '3:00 PM (15:00hrs)',
      notes: '😋 SUA RECEITA FAVORITA! Mingau cremoso, nutritivo e delicioso. Perfeito para a tarde.'
    };
  }
}

/**
 * Generate dinner (6PM - 18:00hrs)
 * LACTOSE-FREE
 */
function generateDinner(targetCal, dayType) {
  const isRestDay = dayType === 'rest';
  const isCarbLoad = dayType === 'carb-load';

  if (isRestDay) {
    return {
      name: 'Jantar - Domingo (Descanso)',
      targetCalories: targetCal,
      foods: [
        { item: 'Salada verde grande (alface, rúcula, tomate)', amount: '1 prato fundo', cal: 40, carbs: 8, protein: 3, fats: 0 },
        { item: 'Peixe grelhado (salmão ou tilápia)', amount: '120g', cal: 200, carbs: 0, protein: 28, fats: 10 },
        { item: 'Legumes grelhados ou no vapor', amount: '1 xícara', cal: 60, carbs: 12, protein: 2, fats: 1 },
        { item: 'Batata doce ou mandioca', amount: '1 pequena (80g)', cal: 70, carbs: 16, protein: 1, fats: 0 },
        { item: 'Azeite extra virgem', amount: '1 colher de chá (5ml)', cal: 45, carbs: 0, protein: 0, fats: 5 }
      ],
      total: { cal: 415, carbs: 36, protein: 34, fats: 16 },
      timing: '6:00 PM (18:00hrs)',
      notes: '🍽️ Jantar leve: Proteína de qualidade, vegetais, carboidratos moderados. Digestão fácil.'
    };
  } else if (isCarbLoad) {
    return {
      name: 'Jantar - Sexta (Véspera do Longão)',
      targetCalories: targetCal,
      foods: [
        { item: 'Macarrão ou arroz branco', amount: '1.5 xícaras cozido (140g)', cal: 180, carbs: 39, protein: 5, fats: 1 },
        { item: 'Frango desfiado ou grelhado', amount: '100g', cal: 160, carbs: 0, protein: 30, fats: 3 },
        { item: 'Molho de tomate caseiro', amount: '1/2 xícara', cal: 40, carbs: 9, protein: 1, fats: 0 },
        { item: 'Pão francês', amount: '1/2 unidade', cal: 70, carbs: 13, protein: 2, fats: 1 },
        { item: 'Sopa de legumes leve (entrada)', amount: '3/4 tigela', cal: 60, carbs: 12, protein: 2, fats: 1 }
      ],
      total: { cal: 510, carbs: 73, protein: 40, fats: 6 },
      timing: '6:00 PM (18:00hrs - JANTAR CEDO!)',
      notes: '🏃 IMPORTANTE: Jantar cedo para digestão completa antes do longão de amanhã! Alto carboidrato, baixa gordura.'
    };
  } else {
    return {
      name: 'Jantar - Dia de Treino',
      targetCalories: targetCal,
      foods: [
        { item: 'Arroz integral ou branco', amount: '3-4 colheres (65g)', cal: 85, carbs: 19, protein: 2, fats: 0 },
        { item: 'Feijão preto ou carioca', amount: '1/2 concha (60g)', cal: 60, carbs: 11, protein: 4, fats: 0 },
        { item: 'Proteína magra (frango, peixe, carne)', amount: '120g', cal: 200, carbs: 0, protein: 36, fats: 6 },
        { item: 'Salada mista com legumes crus', amount: '1 prato', cal: 40, carbs: 8, protein: 2, fats: 0 },
        { item: 'Legumes cozidos (brócolis, cenoura, abobrinha)', amount: '1 xícara', cal: 50, carbs: 11, protein: 2, fats: 0 },
        { item: 'Azeite extra virgem', amount: '1 colher de chá (5ml)', cal: 45, carbs: 0, protein: 0, fats: 5 }
      ],
      total: { cal: 480, carbs: 49, protein: 46, fats: 11 },
      timing: '6:00 PM (18:00hrs)',
      notes: '🌙 Jantar moderado: Boa digestão antes de dormir. Equilíbrio de macros para recuperação noturna.'
    };
  }
}

/**
 * Generate pre-bed snack (recovery/muscle preservation)
 * LACTOSE-FREE - 8PM (20:00hrs)
 */
function generatePreBed(targetCal, dayType) {
  const isRestDay = dayType === 'rest';
  const isCarbLoad = dayType === 'carb-load';

  if (isRestDay) {
    return {
      name: 'Antes de Dormir - Domingo',
      targetCalories: targetCal,
      foods: [
        { item: 'Iogurte natural sem lactose', amount: '100g', cal: 65, carbs: 5, protein: 8, fats: 2 },
        { item: 'Castanhas-do-pará ou amêndoas', amount: '5 unidades (8g)', cal: 50, carbs: 1, protein: 2, fats: 5 }
      ],
      total: { cal: 115, carbs: 6, protein: 10, fats: 7 },
      timing: '8:00 PM (20:00hrs - 1h antes de dormir)',
      notes: '😴 Lanche leve para dia de descanso. Proteína para recuperação noturna.'
    };
  }

  if (isCarbLoad) {
    return {
      name: 'Antes de Dormir - Sexta',
      targetCalories: targetCal,
      foods: [
        { item: 'Iogurte natural sem lactose', amount: '120g', cal: 80, carbs: 6, protein: 10, fats: 2 },
        { item: 'Mel', amount: '1 colher de chá', cal: 20, carbs: 5, protein: 0, fats: 0 },
        { item: 'Banana pequena', amount: '1/2 unidade (50g)', cal: 45, carbs: 12, protein: 0, fats: 0 }
      ],
      total: { cal: 145, carbs: 23, protein: 10, fats: 2 },
      timing: '8:00 PM (20:00hrs - 1h antes de dormir)',
      notes: '📈 Carb-load: Últimas calorias do dia para completar glicogênio. Baixa gordura.'
    };
  }

  return {
    name: 'Antes de Dormir',
    targetCalories: targetCal,
    foods: [
      { item: 'Iogurte natural sem lactose', amount: '150g', cal: 100, carbs: 8, protein: 12, fats: 3 },
      { item: 'Castanhas-do-pará ou amêndoas', amount: '8 unidades (12g)', cal: 75, carbs: 2, protein: 2, fats: 7 },
      { item: 'Banana pequena (opcional)', amount: '1/2 unidade (50g)', cal: 45, carbs: 12, protein: 0, fats: 0 }
    ],
    total: { cal: 220, carbs: 22, protein: 14, fats: 10 },
    timing: '8:00 PM (20:00hrs - 1h antes de dormir)',
    notes: '😴 Proteína de digestão lenta + gorduras saudáveis = recuperação muscular durante o sono.'
  };
}

/**
 * Generate complete nutrition plan for the day
 */
export function generateDailyNutritionPlan(dayType = 'training', trainingLoad = 0) {
  // Calculate energy needs
  const tdee = calculateTDEE(dayType, trainingLoad);
  const macros = calculateMacros(tdee, dayType);
  const mealPlan = generateMealPlan(macros, dayType);

  // Calculate totals from all meals
  const dailyTotals = {
    calories: 0,
    carbs: 0,
    protein: 0,
    fats: 0
  };

  Object.values(mealPlan).forEach(meal => {
    if (meal && meal.total) {
      dailyTotals.calories += meal.total.cal;
      dailyTotals.carbs += meal.total.carbs;
      dailyTotals.protein += meal.total.protein;
      dailyTotals.fats += meal.total.fats;
    }
  });

  return {
    dayType,
    athlete: ATHLETE_PROFILE,
    energyNeeds: {
      bmr: Math.round(calculateBMR()),
      tdee: tdee,
      description: getDayTypeDescription(dayType)
    },
    targets: macros,
    meals: mealPlan,
    dailyTotals,
    hydration: {
      baseWater: '2.5-3L',
      duringTraining: '500-750ml/hour',
      postTraining: '1.5× weight lost',
      notes: 'Urina clara indica boa hidratação'
    },
    supplements: getSupplementRecommendations(dayType),
    tips: getNutritionTips(dayType)
  };
}

/**
 * Get day type description
 */
function getDayTypeDescription(dayType) {
  switch (dayType) {
    case 'rest':
      return 'Dia de descanso completo - Metabolismo basal + atividades leves';
    case 'carb-load':
      return 'Véspera de longão - Carregamento de glicogênio muscular';
    case 'training':
    default:
      return 'Dia de treino regular - Energia para sessão + recuperação';
  }
}

/**
 * Get supplement recommendations
 */
function getSupplementRecommendations(dayType) {
  const base = [
    { name: 'Creatina', dose: '5g/dia', timing: 'Qualquer horário', notes: 'Melhora performance anaeróbica' },
    { name: 'Ômega-3', dose: '1-2g/dia', timing: 'Com refeição', notes: 'Anti-inflamatório, saúde cardiovascular' },
    { name: 'Vitamina D', dose: '2000-4000 UI/dia', timing: 'Manhã', notes: 'Saúde óssea e imunidade' }
  ];

  if (dayType === 'carb-load' || dayType === 'training') {
    base.push(
      { name: 'Gel energético', dose: '1 sachê/45min', timing: 'Durante longão >90min', notes: '20-25g carboidrato rápido' },
      { name: 'BCAA (opcional)', dose: '5-10g', timing: 'Durante treino longo', notes: 'Reduz catabolismo muscular' }
    );
  }

  return base;
}

/**
 * Get nutrition tips
 */
function getNutritionTips(dayType) {
  const baseTips = [
    'Hidrate-se consistentemente ao longo do dia (2.5-3L de água)',
    'Use produtos sem lactose (leite, iogurte) para evitar desconforto',
    'Coma proteína em cada refeição para recuperação muscular',
    'Durma 7-9 horas (9PM) para otimizar recuperação'
  ];

  if (dayType === 'carb-load') {
    return [
      ...baseTips,
      '📈 Sexta é dia de CARREGAMENTO: Carboidratos altos, gordura baixa',
      'Evite alimentos ricos em fibras nas últimas 24h antes do longão',
      'Jante CEDO às 18h para digestão completa antes do longão',
      'Teste todos os alimentos em treinos - nada novo no dia da prova!',
      'Prepare seu gel energético e banana para o longão de amanhã'
    ];
  } else if (dayType === 'rest') {
    return [
      ...baseTips,
      '😴 Domingo é descanso TOTAL: Aproveite para dormir mais!',
      'Foque em vegetais, proteínas e gorduras saudáveis',
      'Reduza carboidratos (mas não elimine)',
      'Bom dia para cozinhar e preparar marmitas da semana',
      'Aproveite o café da manhã com calma (sem pressa!)'
    ];
  } else {
    return [
      ...baseTips,
      '⚡ Pré-treino (4:30 AM): Lanche leve 30-45 min antes da corrida',
      '💪 Pós-treino (6:00-6:30 AM): Janela anabólica! Carboidratos + proteína',
      'Café da manhã pós-treino é a refeição MAIS IMPORTANTE do dia',
      'Mingau da tarde (15h) mantém energia sustentada',
      'Jantar moderado (18h) para boa digestão antes de dormir'
    ];
  }
}

/**
 * Get weekly nutrition overview
 */
export function getWeeklyNutritionOverview() {
  return {
    monday: { type: 'training', description: 'Treino moderado' },
    tuesday: { type: 'training', description: 'Treino de qualidade (limiar/velocidade)' },
    wednesday: { type: 'training', description: 'Treino fácil/recuperação' },
    thursday: { type: 'training', description: 'Treino moderado' },
    friday: { type: 'carb-load', description: 'Véspera do longão - Carregamento' },
    saturday: { type: 'training', description: 'Longão (alta demanda energética)' },
    sunday: { type: 'rest', description: 'Descanso completo' }
  };
}

export default {
  calculateTDEE,
  calculateMacros,
  generateDailyNutritionPlan,
  getWeeklyNutritionOverview
};
