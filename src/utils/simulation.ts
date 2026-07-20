import type { SimulationParameters, SimulationResult } from '../types/research';
import { runIndependentTTest } from './stats';

class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    // Linear Congruential Generator (LCG)
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
  
  boxMuller(mean = 0, std = 1): number {
    const u = 1 - this.next();
    const v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
  }
}

/**
 * Runs the Monte Carlo simulation to create a synthetic pre-post dataset and calculate metrics
 */
export function runMonteCarloSimulation(
  sampleSize: number,
  params: SimulationParameters
): SimulationResult {
  const rng = new SeededRandom(params.seed);
  
  // Calculate size per group
  const sizePerGroup = Math.ceil(sampleSize / 2);
  
  // Helper to clip scores
  const clip = (score: number) => Math.max(0, Math.min(params.maxScore, score));

  // Loop for Monte Carlo iterations to evaluate power / p-value distribution
  // (In the actual dataset generation we do 1 run, but we simulate 'iterations' times to get probability of success)
  let successfulRuns = 0;
  let totalRuns = params.iterations || 100;
  
  // Store the single dataset returned to the user
  let finalDataset: SimulationResult['observedActualData'] = [];

  for (let run = 0; run < totalRuns; run++) {
    const currentDataset: SimulationResult['observedActualData'] = [];
    
    // Generate Treatment group
    for (let i = 0; i < sizePerGroup; i++) {
      const studentId = `TR-${i + 1}`;
      const preScore = clip(rng.boxMuller(params.preTestMean, params.preTestSd));
      
      // Calculate engagement factor (e.g. attendance, motivation)
      const engagement = params.interventionEngagement * (0.7 + rng.next() * 0.4); // center around target with variance
      
      // Attrition determination
      const retained = rng.next() > params.attritionRate;
      
      let postScore = preScore;
      if (retained) {
        if (params.gainType === 'fixed') {
          // PostScore = PreScore + FixedGain + RandomError
          const gain = params.expectedGain * (0.8 + engagement * 0.4);
          const error = rng.boxMuller(0, params.errorSd);
          postScore = clip(preScore + gain + error);
        } else if (params.gainType === 'relative') {
          // PostScore = PreScore + GainRate * (Max - Pre) + RandomError
          const rate = params.expectedGain * (0.7 + engagement * 0.5); // expectedGain acts as a percentage rate
          const error = rng.boxMuller(0, params.errorSd);
          postScore = clip(preScore + rate * (params.maxScore - preScore) + error);
        } else {
          // Regression model
          const betaPre = params.betaPre ?? 0.8;
          const betaTreatment = params.betaTreatment ?? 10;
          const betaEngagement = params.betaEngagement ?? 5;
          const error = rng.boxMuller(0, params.errorSd);
          // Intercept adjusted to keep score in line
          const intercept = params.preTestMean * (1 - betaPre) - 2;
          postScore = clip(intercept + betaPre * preScore + betaTreatment * 1 + betaEngagement * engagement + error);
        }
      }
      
      currentDataset.push({
        studentId,
        group: 'treatment',
        preScore: parseFloat(preScore.toFixed(1)),
        postScore: retained ? parseFloat(postScore.toFixed(1)) : 0,
        engagement: parseFloat(Math.min(1, engagement).toFixed(2)),
        retained
      });
    }

    // Generate Control group
    for (let i = 0; i < sizePerGroup; i++) {
      const studentId = `CON-${i + 1}`;
      const preScore = clip(rng.boxMuller(params.preTestMean, params.preTestSd));
      
      // Control engagement is lower
      const engagement = 0.2 * (0.5 + rng.next() * 0.5);
      const retained = rng.next() > params.attritionRate * 0.8; // control attrition usually slightly lower or higher
      
      let postScore = preScore;
      if (retained) {
        // Control group gain is minimal (normal maturation/error)
        const maturationGain = params.gainType === 'relative' ? 0.05 * (params.maxScore - preScore) : params.expectedGain * 0.15;
        const error = rng.boxMuller(0, params.errorSd * 1.1); // slightly more variance
        postScore = clip(preScore + maturationGain + error);
      }
      
      currentDataset.push({
        studentId,
        group: 'control',
        preScore: parseFloat(preScore.toFixed(1)),
        postScore: retained ? parseFloat(postScore.toFixed(1)) : 0,
        engagement: parseFloat(engagement.toFixed(2)),
        retained
      });
    }

    // Evaluate stats for this run
    const activeTreatment = currentDataset.filter(d => d.group === 'treatment' && d.retained).map(d => d.postScore);
    const activeControl = currentDataset.filter(d => d.group === 'control' && d.retained).map(d => d.postScore);
    
    const tResult = runIndependentTTest(activeTreatment, activeControl);
    
    // Standard significance threshold
    if (tResult.pValue < 0.05 && tResult.cohensD > 0) {
      successfulRuns++;
    }

    if (run === 0) {
      finalDataset = currentDataset;
    }
  }

  // Calculate final summary statistics based on the primary dataset (run 0)
  const retainedTreatment = finalDataset.filter(d => d.group === 'treatment' && d.retained);
  const retainedControl = finalDataset.filter(d => d.group === 'control' && d.retained);
  
  const preMeanTreatment = retainedTreatment.reduce((sum, d) => sum + d.preScore, 0) / (retainedTreatment.length || 1);
  const preMeanControl = retainedControl.reduce((sum, d) => sum + d.preScore, 0) / (retainedControl.length || 1);
  
  const postMeanTreatment = retainedTreatment.reduce((sum, d) => sum + d.postScore, 0) / (retainedTreatment.length || 1);
  const postMeanControl = retainedControl.reduce((sum, d) => sum + d.postScore, 0) / (retainedControl.length || 1);

  const tResultFinal = runIndependentTTest(
    retainedTreatment.map(d => d.postScore),
    retainedControl.map(d => d.postScore)
  );

  const attritionCount = finalDataset.filter(d => !d.retained).length;

  return {
    observedActualData: finalDataset,
    summary: {
      treatmentSize: sizePerGroup,
      controlSize: sizePerGroup,
      preMeanTreatment: parseFloat(preMeanTreatment.toFixed(2)),
      preMeanControl: parseFloat(preMeanControl.toFixed(2)),
      postMeanTreatment: parseFloat(postMeanTreatment.toFixed(2)),
      postMeanControl: parseFloat(postMeanControl.toFixed(2)),
      meanGainTreatment: parseFloat((postMeanTreatment - preMeanTreatment).toFixed(2)),
      meanGainControl: parseFloat((postMeanControl - preMeanControl).toFixed(2)),
      cohensD: tResultFinal.cohensD,
      pValue: tResultFinal.pValue,
      statisticalPower: parseFloat((successfulRuns / totalRuns).toFixed(3)),
      attritionCount,
      successProbability: parseFloat((successfulRuns / totalRuns).toFixed(2))
    }
  };
}
