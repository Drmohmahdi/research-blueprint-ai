// Statistical computation utilities for Sample Size and Hypothesis Testing

/**
 * Standard error function approximation
 */
export function erf(x: number): number {
  // Constants
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Cumulative Standard Normal Distribution (Z)
 */
export function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

/**
 * Inverse Cumulative Standard Normal Distribution (Z)
 * Yields critical Z score for a given probability
 */
export function normalInverse(p: number): number {
  // Winitzki approximation of inverse error function
  const a = 0.147;
  const logTerm = Math.log(4 * p * (1 - p));
  const term1 = 2 / (Math.PI * a) + logTerm / 2;
  const innerSqrt = term1 * term1 - logTerm / a;
  
  if (innerSqrt < 0) return 0;
  
  const term2 = Math.sqrt(innerSqrt);
  const sign = p < 0.5 ? -1 : 1;
  const erfInv = sign * Math.sqrt(term2 - term1);
  
  return erfInv * Math.sqrt(2);
}

/**
 * T-Distribution Cumulative distribution function (CDF)
 * Simple approximation for degrees of freedom df
 */
export function studentTCDF(t: number, df: number): number {
  // Satterthwaite or normal approximation for large df
  if (df > 300) {
    const z = t * (1 - 1 / (4 * df)) / Math.sqrt(1 + t * t / (2 * df));
    return normalCDF(z);
  }
  // Standard numerical integration for small df
  const x = df / (df + t * t);
  // Simple approximation for incomplete beta function
  let sum = 0;
  const steps = 1000;
  const dx = x / steps;
  const a = df / 2;
  const b = 0.5;
  
  for (let i = 0; i < steps; i++) {
    const currX = (i + 0.5) * dx;
    sum += Math.pow(currX, a - 1) * Math.pow(1 - currX, b - 1);
  }
  const betaVal = sum * dx;
  
  // Beta normalization factor approximation
  const gammaA = Math.sqrt(2 * Math.PI) * Math.pow(a, a - 0.5) * Math.exp(-a);
  const gammaB = Math.sqrt(2 * Math.PI); // gamma(0.5) = sqrt(pi)
  const gammaAB = Math.sqrt(2 * Math.PI) * Math.pow(a + 0.5, a) * Math.exp(-(a + 0.5));
  const betaNorm = (gammaA * gammaB) / gammaAB;
  
  const ibeta = betaVal / betaNorm;
  
  if (t > 0) return 1 - 0.5 * ibeta;
  return 0.5 * ibeta;
}

/**
 * Calculates Sample Size for descriptive survey study
 */
export function calculateDescriptiveSampleSize(
  populationSize: number | undefined,
  marginOfError: number,
  confidenceLevel: number
): number {
  const z = normalInverse(1 - (1 - confidenceLevel) / 2);
  const p = 0.5; // maximum variance
  const numerator = (z * z * p * (1 - p)) / (marginOfError * marginOfError);
  
  if (!populationSize) {
    return Math.ceil(numerator);
  }
  
  const denominator = 1 + (z * z * p * (1 - p)) / (marginOfError * marginOfError * populationSize);
  return Math.ceil(numerator / denominator);
}

/**
 * Calculates Sample Size for standard tests using power analysis
 */
export function calculatePowerSampleSize(
  testType: string,
  alpha: number,
  power: number,
  effectSize: number,
  groupsCount: number = 2
): number {
  const zAlpha = normalInverse(1 - alpha / 2);
  const zBeta = normalInverse(power);
  const factor = Math.pow(zAlpha + zBeta, 2);

  switch (testType) {
    case 't_test_independent':
      // Two independent groups: n = 2 * (Z_alpha + Z_beta)^2 / d^2 per group
      const nPerGroup = 2 * factor / Math.pow(effectSize, 2);
      return Math.ceil(nPerGroup * 2);

    case 't_test_paired':
      // Paired: n = (Z_alpha + Z_beta)^2 / d_z^2
      return Math.ceil(factor / Math.pow(effectSize, 2));

    case 'anova_one_way':
      // Cohen's f. n = (Z_alpha + Z_beta)^2 / f^2 (approximate)
      const totalN = (factor / Math.pow(effectSize, 2)) * (groupsCount / 2);
      return Math.ceil(totalN);

    case 'linear_regression':
      // Cohen's f^2. n = L / f^2 + k + 1, where L is a factor based on power/alpha
      // Simple approximation:
      const k = groupsCount; // number of predictors
      const nReg = (factor * 1.5) / effectSize + k + 1;
      return Math.ceil(nReg);

    case 'correlation':
      // n = [(Z_alpha + Z_beta) / (0.5 * ln((1+r)/(1-r)))]^2 + 3
      const correlationMagnitude = Math.min(0.999, Math.max(0.001, Math.abs(effectSize)));
      const fishersZ = 0.5 * Math.log((1 + correlationMagnitude) / (1 - correlationMagnitude));
      const nCorr = Math.pow((zAlpha + zBeta) / fishersZ, 2) + 3;
      return Math.ceil(nCorr);

    case 'chi_square':
      // n = chi^2_crit * factor / w^2 (approximate)
      return Math.ceil(factor / Math.pow(effectSize, 2) + 10);

    default:
      return 100;
  }
}

/**
 * Calculates t-test statistic and p-value for paired samples
 */
export function runPairedTTest(pre: number[], post: number[]): { tStatistic: number; pValue: number; cohensD: number } {
  const diffs = pre.map((val, idx) => post[idx] - val);
  const n = diffs.length;
  if (n <= 1) return { tStatistic: 0, pValue: 1, cohensD: 0 };

  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
  const varianceDiff = diffs.reduce((a, b) => a + Math.pow(b - meanDiff, 2), 0) / (n - 1);
  const sdDiff = Math.sqrt(varianceDiff);
  
  const standardError = sdDiff / Math.sqrt(n);
  const t = standardError === 0 ? 0 : meanDiff / standardError;
  const df = n - 1;

  // Two-tailed p-value
  const cdf = studentTCDF(Math.abs(t), df);
  const p = 2 * (1 - cdf);

  // Cohen's d for paired samples: mean_diff / sd_diff
  const d = sdDiff === 0 ? 0 : meanDiff / sdDiff;

  return {
    tStatistic: parseFloat(t.toFixed(4)),
    pValue: parseFloat(p.toFixed(4)),
    cohensD: parseFloat(d.toFixed(4)),
  };
}

/**
 * Calculates t-test statistic and p-value for independent samples
 */
export function runIndependentTTest(groupA: number[], groupB: number[]): { tStatistic: number; pValue: number; cohensD: number } {
  const nA = groupA.length;
  const nB = groupB.length;
  if (nA <= 1 || nB <= 1) return { tStatistic: 0, pValue: 1, cohensD: 0 };

  const meanA = groupA.reduce((a, b) => a + b, 0) / nA;
  const meanB = groupB.reduce((a, b) => a + b, 0) / nB;

  const varA = groupA.reduce((a, b) => a + Math.pow(b - meanA, 2), 0) / (nA - 1);
  const varB = groupB.reduce((a, b) => a + Math.pow(b - meanB, 2), 0) / (nB - 1);

  // Pooled standard deviation
  const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2);
  const pooledSd = Math.sqrt(pooledVar);

  const se = pooledSd * Math.sqrt(1 / nA + 1 / nB);
  const t = se === 0 ? 0 : (meanA - meanB) / se;
  const df = nA + nB - 2;

  const cdf = studentTCDF(Math.abs(t), df);
  const p = 2 * (1 - cdf);

  const d = pooledSd === 0 ? 0 : (meanA - meanB) / pooledSd;

  return {
    tStatistic: parseFloat(t.toFixed(4)),
    pValue: parseFloat(p.toFixed(4)),
    cohensD: parseFloat(d.toFixed(4)),
  };
}
