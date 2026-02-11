/**
 * Client-side port of generate-macros-v3 edge function
 * Source: /supabase/functions/generate-macros-v3/index.ts
 */

// ============================================================================
// UNIT CONVERSIONS
// ============================================================================

const LB_TO_KG = 0.45359237;
const MI_TO_KM = 1.60934;
const MPH_TO_M_PER_MIN = 26.8224;

export function toKg(weight, unit) {
  return unit === 'kg' ? weight : weight * LB_TO_KG;
}

export function toMiles(distance, unit) {
  return unit === 'mi' ? distance : distance / MI_TO_KM;
}

// ============================================================================
// ENVIRONMENT & HYDRATION (Baker 2017)
// ============================================================================

export function classifyEnvironment(tempC, humidityPct) {
  if (tempC === null && humidityPct === null) {
    return [1.0, 'moderate'];
  }
  const t = tempC ?? 20.0;
  const h = humidityPct ?? 60.0;

  if (t <= 10) return [0.85, 'cool'];
  if (t <= 20 && h <= 60) return [1.0, 'temperate'];
  if (t <= 25 || (h > 60 && h <= 75)) return [1.1, 'warm'];
  if (t <= 30 || (h > 75 && h <= 85)) return [1.2, 'hot'];
  return [1.3, 'very_hot'];
}

export function baseSweatRateFromCategory(category) {
  if (category === 'light') return 0.75;
  if (category === 'medium') return 1.25;
  if (category === 'heavy') return 2.0;
  return 1.25;
}

export function sodiumConcentrationFromCategory(category) {
  if (category === 'low') return 550;
  if (category === 'medium') return 925;
  if (category === 'high') return 1150;
  return 925;
}

export function calculateActualSweatRate(baseCategory, tempC, humidityPct) {
  const baseRate = baseSweatRateFromCategory(baseCategory);
  let tempAdjustment = 1.0;
  if (tempC !== null && tempC > 20) {
    tempAdjustment = 1.0 + Math.max(0, (tempC - 20) * 0.04);
  }
  return baseRate * tempAdjustment;
}

// ============================================================================
// PRE-WORKOUT NUTRITION (V3)
// ============================================================================

export function calculatePreWorkoutMacros(weightKg, hoursBefore, isFasted, sweatSodiumCat, envLabel) {
  if (isFasted) {
    return { carbs: 0, protein: 0, fat: 0, sodium: 0, hydration: 0, meal_type: 'fasted' };
  }

  const carbPerKg = Math.max(0.5, Math.min(hoursBefore, 4.0));
  const carbs = Math.round(weightKg * carbPerKg);

  let protein, fat, sodium, hydration, mealType;

  const baseSodium = sweatSodiumCat === 'low' ? 300 : sweatSodiumCat === 'medium' ? 450 : 600;
  const envBump = (envLabel === 'hot' || envLabel === 'very_hot') ? 100 : 0;

  if (hoursBefore >= 2.5) {
    protein = Math.round(weightKg * 0.25);
    fat = Math.round(weightKg * 0.4);
    sodium = baseSodium + envBump;
    hydration = Math.round(weightKg * 6.5);
    mealType = 'full_meal';
  } else if (hoursBefore >= 1.0) {
    protein = Math.round(weightKg * 0.15);
    fat = 5;
    sodium = Math.round((baseSodium + envBump) * 0.5);
    hydration = Math.round(weightKg * 5.5);
    mealType = 'snack';
  } else {
    protein = 0;
    fat = 0;
    sodium = envBump + 100;
    hydration = 250;
    mealType = 'top_up';
  }

  return { carbs, protein, fat, sodium, hydration, meal_type: mealType };
}

// ============================================================================
// DURING-WORKOUT NUTRITION (V3)
// ============================================================================

export function getDurationCarbBand(durationMin) {
  if (durationMin < 60) return [0, 30];
  if (durationMin < 90) return [30, 60];
  if (durationMin < 150) return [45, 60];
  if (durationMin < 240) return [60, 90];
  return [80, 100];
}

export function getGutTrainingMultiplier(gutTraining) {
  if (gutTraining === 'low') return 0.7;
  if (gutTraining === 'moderate') return 1.0;
  if (gutTraining === 'high') return 1.2;
  return 1.0;
}

export function getSportCarbCeiling(activityType) {
  if (activityType === 'running') return 70;
  if (activityType === 'cycling') return 120;
  if (activityType === 'swimming') return 0;
  return 70;
}

export function calculateDuringWorkoutCarbRate(durationMin, activityType, gutTraining) {
  const [baseLow, baseHigh] = getDurationCarbBand(durationMin);
  const gutMult = getGutTrainingMultiplier(gutTraining);
  const scaledLow = baseLow * gutMult;
  const scaledHigh = baseHigh * gutMult;
  const carbRate = (scaledLow + scaledHigh) / 2;
  const sportCeiling = getSportCarbCeiling(activityType);
  const finalRate = Math.min(carbRate, sportCeiling);

  return {
    rate_gph: Math.round(finalRate * 10) / 10,
    band_low: Math.round(scaledLow),
    band_high: Math.round(scaledHigh),
    gut_multiplier: gutMult,
    sport_ceiling: sportCeiling,
  };
}

export function calculateDuringWorkoutHydration(durationH, sweatRateCategory, sweatSodiumCat, tempC, humidityPct) {
  const actualSweatRateLph = calculateActualSweatRate(sweatRateCategory, tempC, humidityPct);
  const sodiumConcMgPerL = sodiumConcentrationFromCategory(sweatSodiumCat);

  const sodiumRateMgph = Math.round(actualSweatRateLph * sodiumConcMgPerL * 0.6);
  const hydrationRateMlph = Math.round(actualSweatRateLph * 1000 * 0.75);

  return {
    sodium_rate_mgph: sodiumRateMgph,
    hydration_rate_mlph: hydrationRateMlph,
    sodium_total_mg: Math.round(sodiumRateMgph * durationH),
    hydration_total_ml: Math.round(hydrationRateMlph * durationH),
    sweat_rate_lph: Math.round(actualSweatRateLph * 100) / 100,
    sodium_conc_mg_per_l: sodiumConcMgPerL,
  };
}

// ============================================================================
// POST-WORKOUT NUTRITION (V3)
// ============================================================================

export function calculatePostWorkoutCarbs(weightKg, durationH, isFasted) {
  const durationMultiplier = durationH > 2 ? 1.2 : 1.0;
  const fastedMultiplier = isFasted ? 1.2 : 1.0;
  return Math.round(weightKg * durationMultiplier * fastedMultiplier);
}

export function calculatePostWorkoutProtein(weightKg, isFasted) {
  const proteinPerKg = isFasted ? 0.35 : 0.3;
  return Math.round(weightKg * proteinPerKg);
}

export function calculatePostWorkoutFat(weightKg) {
  return Math.round(weightKg * 0.2);
}

export function calculatePostWorkoutHydration(durationH, actualSweatRateLph, sodiumConcMgPerL, duringHydrationMl) {
  const totalSodiumLossMg = actualSweatRateLph * sodiumConcMgPerL * durationH;
  const duringSodiumMg = Math.round(actualSweatRateLph * sodiumConcMgPerL * 0.6 * durationH);
  const sodiumDeficitMg = totalSodiumLossMg - duringSodiumMg;
  const postSodiumMg = Math.max(300, Math.min(700, Math.round(sodiumDeficitMg * 0.5)));

  const totalHydrationLossMl = actualSweatRateLph * 1000 * durationH;
  const hydrationDeficitMl = totalHydrationLossMl - duringHydrationMl;
  const postHydrationMl = Math.round(Math.max(500, hydrationDeficitMl * 1.5));

  return { sodium_mg: postSodiumMg, hydration_ml: postHydrationMl };
}

// ============================================================================
// SPORT-SPECIFIC MET & ENERGY
// ============================================================================

export function runningMETFromPace(paceMinPerMile) {
  const speedMph = 60.0 / paceMinPerMile;
  const speedMPerMin = speedMph * MPH_TO_M_PER_MIN;
  const vo2 = speedMph >= 4.0 ? 0.2 * speedMPerMin + 3.5 : 0.1 * speedMPerMin + 3.5;
  return vo2 / 3.5;
}

export function cyclingMETFromSpeed(speedKph, terrain) {
  let met;
  if (speedKph <= 16) met = 6.0;
  else if (speedKph <= 19) met = 8.0;
  else if (speedKph <= 22) met = 10.0;
  else if (speedKph <= 25) met = 12.0;
  else if (speedKph <= 30) met = 14.0;
  else met = 16.0;

  if (terrain === 'rolling') met *= 1.1;
  else if (terrain === 'hilly') met *= 1.25;
  return met;
}

export function swimmingMETFromPace(pacePer100m, poolOrOpenWater, waterTempC) {
  let met;
  if (pacePer100m >= 180) met = 6.0;
  else if (pacePer100m >= 150) met = 8.0;
  else if (pacePer100m >= 120) met = 10.0;
  else if (pacePer100m >= 90) met = 11.0;
  else met = 13.0;

  if (poolOrOpenWater === 'open_water') met *= 1.15;
  if (waterTempC < 20) met *= 1.1;
  else if (waterTempC > 28) met *= 0.95;
  return met;
}

export function calculateGrossCalories(weightKg, durationMin, met) {
  return Math.round(met * 3.5 * weightKg / 200.0 * durationMin);
}

export function calculateNetCalories(activityType, weightKg, distanceKm, speedKph) {
  if (activityType === 'running') return Math.round(1.0 * weightKg * distanceKm);
  if (activityType === 'cycling') {
    const speed = speedKph ?? 25;
    let costPerKgKm;
    if (speed <= 20) costPerKgKm = 0.3;
    else if (speed <= 25) costPerKgKm = 0.35;
    else if (speed <= 30) costPerKgKm = 0.4;
    else costPerKgKm = 0.5;
    return Math.round(weightKg * distanceKm * costPerKgKm);
  }
  if (activityType === 'swimming') return Math.round(3.5 * weightKg * distanceKm);
  return Math.round(1.0 * weightKg * distanceKm);
}

// ============================================================================
// MAIN CALCULATION (V3)
// ============================================================================

export function calculateMacrosV3(input) {
  const weightKg = toKg(input.weight, input.weight_unit);
  const activityType = input.activity_type || 'running';

  let durationMin, durationH, met, distanceKm, speedKph;

  if (activityType === 'running') {
    const distanceMi = toMiles(input.run_distance, input.run_distance_unit || 'mi');
    const paceMinPerMile = typeof input.run_pace === 'string'
      ? parseFloat(input.run_pace.split(':')[0]) + parseFloat(input.run_pace.split(':')[1] || '0') / 60
      : input.run_pace;

    durationMin = distanceMi * paceMinPerMile;
    durationH = durationMin / 60;
    met = runningMETFromPace(paceMinPerMile);
    distanceKm = distanceMi * MI_TO_KM;
    speedKph = (60 / paceMinPerMile) * MI_TO_KM;
  } else if (activityType === 'cycling') {
    const distanceMi = input.distance_miles;
    const speedMph = input.speed_mph;
    durationMin = (distanceMi / speedMph) * 60;
    durationH = durationMin / 60;
    speedKph = speedMph * MI_TO_KM;
    met = cyclingMETFromSpeed(speedKph, input.terrain || 'flat');
    distanceKm = distanceMi * MI_TO_KM;
  } else if (activityType === 'swimming') {
    const distanceM = input.distance_meters;
    const pacePer100m = input.pace_per_100m_seconds;
    durationMin = (distanceM / 100) * pacePer100m / 60;
    durationH = durationMin / 60;
    met = swimmingMETFromPace(pacePer100m, input.pool_or_open_water || 'pool', input.water_temp_c || 26);
    distanceKm = distanceM / 1000;
  } else {
    throw new Error(`Unsupported activity type: ${activityType}`);
  }

  const [envMultiplier, envLabel] = classifyEnvironment(input.temp_c ?? null, input.humidity_pct ?? null);

  const preWorkout = calculatePreWorkoutMacros(weightKg, input.hours_before, input.is_fasted, input.sweat_sodium, envLabel);

  const duringCarbs = calculateDuringWorkoutCarbRate(durationMin, activityType, input.gut_training);
  const duringHydration = calculateDuringWorkoutHydration(durationH, input.sweat_rate_category, input.sweat_sodium, input.temp_c ?? null, input.humidity_pct ?? null);

  const postCarbs = calculatePostWorkoutCarbs(weightKg, durationH, input.is_fasted);
  const postProtein = calculatePostWorkoutProtein(weightKg, input.is_fasted);
  const postFat = calculatePostWorkoutFat(weightKg);
  const postHydration = calculatePostWorkoutHydration(durationH, duringHydration.sweat_rate_lph, duringHydration.sodium_conc_mg_per_l, duringHydration.hydration_total_ml);

  const caloriesGross = calculateGrossCalories(weightKg, durationMin, met);
  const caloriesNet = calculateNetCalories(activityType, weightKg, distanceKm, speedKph);

  return {
    algorithm_version: 'v3',
    activity_type: activityType,
    duration_min: Math.round(durationMin * 100) / 100,
    duration_h: Math.round(durationH * 10000) / 10000,
    distance_km: Math.round(distanceKm * 1000) / 1000,
    calories_gross_kcal: caloriesGross,
    calories_net_kcal: caloriesNet,
    MET: Math.round(met * 100) / 100,
    environment_label: envLabel,
    environment_multiplier: envMultiplier,

    pre: {
      carbs_g: preWorkout.carbs,
      protein_g: preWorkout.protein,
      fat_g: preWorkout.fat,
      sodium_mg: preWorkout.sodium,
      hydration_ml: preWorkout.hydration,
      meal_type: preWorkout.meal_type,
    },
    during: {
      carb_rate_gph: duringCarbs.rate_gph,
      total_carbs_g: Math.round(duringCarbs.rate_gph * durationH),
      hydration_rate_mlph: duringHydration.hydration_rate_mlph,
      total_hydration_ml: duringHydration.hydration_total_ml,
      sodium_rate_mgph: duringHydration.sodium_rate_mgph,
      total_sodium_mg: duringHydration.sodium_total_mg,
      band_low: duringCarbs.band_low,
      band_high: duringCarbs.band_high,
    },
    post: {
      carbs_g: postCarbs,
      protein_g: postProtein,
      fat_g: postFat,
      sodium_mg: postHydration.sodium_mg,
      hydration_ml: postHydration.hydration_ml,
    },
  };
}
