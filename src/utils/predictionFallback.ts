// Client-side local prediction fallback for Demo Mode or offline states
import { normalInverse } from './stats';

export interface LiteratureStudy {
  effectSize: number;
  sampleSize: number;
  studyQuality: number;
  similarity: number;
}

export function localLiteratureForecast(studies: LiteratureStudy[], sampleSize: number, alpha = 0.05) {
  if (studies.length === 0) {
    studies = [{ effectSize: 0.35, sampleSize: 50, studyQuality: 3, similarity: 80 }];
  }

  let totalWeight = 0;
  let weightedSum = 0;
  let totalSimilarity = 0;

  studies.forEach(s => {
    const variance = 4.0 / s.sampleSize;
    const simWeight = (s.similarity / 100.0) * (s.studyQuality / 5.0);
    const weight = simWeight / variance;

    totalWeight += weight;
    weightedSum += s.effectSize * weight;
    totalSimilarity += s.similarity;
  });

  const pooledD = totalWeight > 0 ? weightedSum / totalWeight : 0.35;
  const pooledVar = totalWeight > 0 ? 1.0 / totalWeight : 0.08;
  const pooledSE = Math.sqrt(pooledVar);

  const zAlpha = normalInverse(1 - alpha / 2);
  const piLower = pooledD - zAlpha * pooledSE;
  const piUpper = pooledD + zAlpha * pooledSE;

  const groupN = sampleSize / 2.0;
  // Power approximation: normal_cdf(d * sqrt(N/2) - 1.96)
  const zPower = pooledD * Math.sqrt(groupN / 2.0) - 1.96;
  const power = Math.max(0.05, Math.min(0.99, normalCDF(zPower)));

  return {
    point_estimate: pooledD,
    pi_95: [piLower, piUpper],
    power: power,
    prob_supported: totalWeight > 0 ? 1.0 - normalCDF(-pooledD / pooledSE) : 0.78,
    confidence_score: Math.min(100, Math.round((totalSimilarity / studies.length) * 0.8 + 20)),
    data_provenance: "Literature synthesis (Local Offline Fallback)",
    assumptions: { alpha, model: "fixed_effects_local" }
  };
}

export function localPilotForecast(
  priorMean: number,
  priorVariance: number,
  treatmentScores: number[],
  controlScores: number[],
  alpha = 0.05
) {
  const meanT = treatmentScores.reduce((a, b) => a + b, 0) / treatmentScores.length || 15.0;
  const meanC = controlScores.reduce((a, b) => a + b, 0) / controlScores.length || 12.0;

  const varT = treatmentScores.length > 1 
    ? treatmentScores.map(x => Math.pow(x - meanT, 2)).reduce((a, b) => a + b, 0) / (treatmentScores.length - 1)
    : 1.0;

  const varC = controlScores.length > 1
    ? controlScores.map(x => Math.pow(x - meanC, 2)).reduce((a, b) => a + b, 0) / (controlScores.length - 1)
    : 1.0;

  const precisionPrior = 1.0 / priorVariance;
  const precisionDataT = treatmentScores.length / varT;
  const postVarT = 1.0 / (precisionPrior + precisionDataT);
  const postMeanT = (priorMean * precisionPrior + meanT * precisionDataT) * postVarT;

  const postVarC = 1.0 / (precisionPrior + (controlScores.length / varC));
  const postMeanC = ((priorMean - 0.2) * precisionPrior + meanC * (controlScores.length / varC)) * postVarC;

  const pooledSD = Math.sqrt((varT + varC) / 2.0);
  const postD = pooledSD > 0 ? (postMeanT - postMeanC) / pooledSD : 0.35;

  const zAlpha = normalInverse(1 - alpha / 2);
  const lower95 = postMeanT - zAlpha * Math.sqrt(postVarT);
  const upper95 = postMeanT + zAlpha * Math.sqrt(postVarT);

  const diffMean = postMeanT - postMeanC;
  const diffSE = Math.sqrt(postVarT + postVarC);
  const probSupported = diffSE > 0 ? 1.0 - normalCDF(-diffMean / diffSE) : 0.75;

  return {
    point_estimate: postD,
    post_mean_treatment: postMeanT,
    post_mean_control: postMeanC,
    pi_95: [lower95, upper95],
    prob_supported: probSupported,
    confidence_score: Math.min(95, 50 + 5 * (treatmentScores.length + controlScores.length)),
    data_provenance: "Bayesian conjugate update (Local Offline Fallback)",
    assumptions: { priorMean, priorVariance, alpha }
  };
}

export function localDynamicForecast(attendanceRate: number, fidelityRate: number) {
  const expectedGain = 15.0 * fidelityRate * attendanceRate;
  const attritionRate = Math.max(0.0, 1.0 - attendanceRate);

  const earlyWarning = attritionRate > 0.20 || fidelityRate < 0.70;
  const warningMessage = earlyWarning 
    ? "تحذير: مؤشرات التسرب والالتزام غير مستقرة محلياً."
    : "سير تطبيق التجربة مستقر.";

  return {
    expected_gain: expectedGain,
    attrition_rate: attritionRate,
    mean_fidelity: fidelityRate,
    early_warning: earlyWarning,
    warning_message: warningMessage,
    confidence_score: Math.max(10, Math.round(100 - attritionRate * 150)),
    data_provenance: "Telemetry cohort analysis (Local Offline Fallback)",
    assumptions: {}
  };
}

export function localGenerateScenarios(pointEst: number) {
  return [
    {
      scenarioName: "Null Effect",
      expectedEffectSize: 0.0,
      expectedPower: 0.05,
      pValue: 0.95,
      retained: 0.90,
      attrition: 0.10,
      pi_lower: -0.15,
      pi_upper: 0.15,
      predictionIntervalLower: -0.15,
      predictionIntervalUpper: 0.15,
      assumptions: "يفترض عدم وجود أي تأثير حقيقي للبرنامج التدريبي."
    },
    {
      scenarioName: "Conservative",
      expectedEffectSize: pointEst * 0.6,
      expectedPower: 0.45,
      pValue: 0.18,
      retained: 0.85,
      attrition: 0.15,
      pi_lower: pointEst * 0.6 - 0.25,
      pi_upper: pointEst * 0.6 + 0.25,
      predictionIntervalLower: pointEst * 0.6 - 0.25,
      predictionIntervalUpper: pointEst * 0.6 + 0.25,
      assumptions: "تأثير متواضع مع نسبة فقدان متوسطة للطلاب."
    },
    {
      scenarioName: "Expected",
      expectedEffectSize: pointEst,
      expectedPower: 0.80,
      pValue: 0.035,
      retained: 0.88,
      attrition: 0.12,
      pi_lower: pointEst - 0.20,
      pi_upper: pointEst + 0.20,
      predictionIntervalLower: pointEst - 0.20,
      predictionIntervalUpper: pointEst + 0.20,
      assumptions: "التأثير النموذجي المتوقع بناءً على المعطيات والالتزام."
    },
    {
      scenarioName: "Optimistic",
      expectedEffectSize: pointEst * 1.3,
      expectedPower: 0.95,
      pValue: 0.008,
      retained: 0.95,
      attrition: 0.05,
      pi_lower: pointEst * 1.3 - 0.15,
      pi_upper: pointEst * 1.3 + 0.15,
      predictionIntervalLower: pointEst * 1.3 - 0.15,
      predictionIntervalUpper: pointEst * 1.3 + 0.15,
      assumptions: "التزام كامل بجدول الحضور وتأثير تدريبي ممتاز."
    },
    {
      scenarioName: "Worst Case",
      expectedEffectSize: -0.10,
      expectedPower: 0.05,
      pValue: 0.80,
      retained: 0.65,
      attrition: 0.35,
      pi_lower: -0.45,
      pi_upper: 0.25,
      predictionIntervalLower: -0.45,
      predictionIntervalUpper: 0.25,
      assumptions: "تسرب حاد للطلاب وعدم توافق مع محتوى التدريب."
    }
  ];
}

// Hastings approximation for normal CDF in JavaScript
function normalCDF(x: number): number {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-x * x / 2.0);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1.0 - p : p;
}
