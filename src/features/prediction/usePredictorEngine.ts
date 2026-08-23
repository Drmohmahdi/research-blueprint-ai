import { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  apiRunPredictionRun,
  apiListPredictionRuns,
  apiGetPredictionRunDetails,
  apiCompareObservedOutcome
} from '../../utils/api';
import {
  localLiteratureForecast,
  localPilotForecast,
  localDynamicForecast,
  localGenerateScenarios
} from '../../utils/predictionFallback';
import { researchStorage } from '../../utils/researchStorage';

export interface LitStudy {
  effectSize: number;
  sampleSize: number;
  studyQuality: number;
  similarity: number;
}

export interface ReadinessState {
  readinessScore: number;
  isReady: boolean;
  recommendations: string[];
}

export const usePredictorEngine = () => {
  const { activeProject, language, isSecureMode, updateProjectWorkflowProfile } = useProject();

  // Readiness State
  const [readiness, setReadiness] = useState<ReadinessState | null>(null);

  // Prediction Runs State
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Form State
  const [mode, setMode] = useState<string>('LITERATURE_BASED_FORECAST');
  const [alpha, setAlpha] = useState<number>(0.05);

  // Literature studies input
  const [litStudies, setLitStudies] = useState<LitStudy[]>([
    { effectSize: 0.45, sampleSize: 60, studyQuality: 4, similarity: 85 },
    { effectSize: 0.30, sampleSize: 45, studyQuality: 3, similarity: 70 }
  ]);

  // Pilot Input
  const [priorMean, setPriorMean] = useState<number>(0.4);
  const [priorVariance, setPriorVariance] = useState<number>(0.1);
  const [pilotTreatment, setPilotTreatment] = useState<string>('15,16,14,18,17');
  const [pilotControl, setPilotControl] = useState<string>('12,11,13,12,10');

  // Cohort Input
  const [fidelityRate, setFidelityRate] = useState<number>(0.90);
  const [attendanceRate, setAttendanceRate] = useState<number>(0.85);

  // Observed comparison form
  const [observedEffect, setObservedEffect] = useState<number>(0.42);
  const [observedTMean, setObservedTMean] = useState<number>(15.2);
  const [observedCMean, setObservedCMean] = useState<number>(12.1);
  const [observedAttr, setObservedAttr] = useState<number>(0.10);

  const checkReadiness = useCallback(async () => {
    if (!activeProject) return;
    setLoadingReadiness(true);

    // Dynamic readiness score calculation
    const issues: string[] = [];
    let score = 100;
    if (!activeProject.variables || activeProject.variables.length === 0) {
      issues.push(language === 'ar' ? "لم يتم تحديد متغيرات الدراسة بعد (مستقل، تابع)." : "Research variables are not defined yet.");
      score -= 30;
    }
    if (!activeProject.hypotheses || activeProject.hypotheses.length === 0) {
      issues.push(language === 'ar' ? "لم يتم صياغة الفروض الإحصائية." : "Research hypotheses are not formulated.");
      score -= 20;
    }
    if (!activeProject.sampleSettings || !activeProject.sampleSettings.populationSize) {
      issues.push(language === 'ar' ? "لم يتم ضبط خيارات العينة الإحصائية والمجتمع." : "Sample size options are not set.");
      score -= 25;
    }
    if (!activeProject.preRegistrationLockedAt) {
      issues.push(language === 'ar' ? "خطة التسجيل المسبق لم يتم قفلها واعتمادها رقمياً." : "Pre-registration is not locked/frozen.");
      score -= 15;
    }

    setReadiness({
      readinessScore: Math.max(10, score),
      isReady: score >= 50,
      recommendations: issues
    });
    setLoadingReadiness(false);
  }, [activeProject, language]);

  const loadRunDetails = useCallback(async (runId: string) => {
    if (!activeProject) return;
    if (!isSecureMode) {
      const saved = researchStorage.getItem(`rb_local_runs_${activeProject.id}`);
      const localRuns = saved ? JSON.parse(saved) : [];
      const details = localRuns.find((r: any) => r.run.id === runId);
      if (details) {
        setSelectedRun(details);
      }
    } else {
      const details = await apiGetPredictionRunDetails(activeProject.id, runId);
      if (details) {
        setSelectedRun(details);
      }
    }
  }, [activeProject, isSecureMode]);

  const fetchRuns = useCallback(async () => {
    if (!activeProject) return;
    setLoadingRuns(true);
    setSelectedRun(null);
    if (!isSecureMode) {
      const saved = researchStorage.getItem(`rb_local_runs_${activeProject.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setRuns(parsed.map((r: any) => r.run));
        if (parsed.length > 0) {
          setSelectedRun(parsed[0]);
        }
      } else {
        setRuns([]);
      }
    } else {
      const backendRuns = await apiListPredictionRuns(activeProject.id);
      if (backendRuns) {
        setRuns(backendRuns);
        if (backendRuns.length > 0) {
          loadRunDetails(backendRuns[0].id);
        }
      }
    }
    setLoadingRuns(false);
  }, [activeProject, isSecureMode, loadRunDetails]);

  const triggerPrediction = async () => {
    if (!activeProject) return;
    setLoadingPredict(true);
    setPredictionError(null);

    try {
      if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
        throw new Error('Invalid significance level');
      }
      if (mode === 'LITERATURE_BASED_FORECAST' && litStudies.some(study =>
        !Number.isFinite(study.effectSize) ||
        !Number.isFinite(study.sampleSize) || study.sampleSize <= 0 ||
        !Number.isFinite(study.studyQuality) || study.studyQuality < 1 || study.studyQuality > 5 ||
        !Number.isFinite(study.similarity) || study.similarity < 0 || study.similarity > 100
      )) {
        throw new Error('Invalid literature inputs');
      }
      if (mode === 'PILOT_UPDATED_FORECAST') {
        const treatmentScores = pilotTreatment.split(',').map(value => parseFloat(value.trim()));
        const controlScores = pilotControl.split(',').map(value => parseFloat(value.trim()));
        if (!Number.isFinite(priorMean) || !Number.isFinite(priorVariance) || priorVariance <= 0 ||
          treatmentScores.length === 0 || treatmentScores.some(value => !Number.isFinite(value)) ||
          controlScores.length === 0 || controlScores.some(value => !Number.isFinite(value))) {
          throw new Error('Invalid pilot inputs');
        }
      }
      if (mode === 'IN_STUDY_DYNAMIC_FORECAST' &&
        (!Number.isFinite(attendanceRate) || attendanceRate < 0 || attendanceRate > 1 ||
          !Number.isFinite(fidelityRate) || fidelityRate < 0 || fidelityRate > 1)) {
        throw new Error('Invalid telemetry inputs');
      }

      if (!isSecureMode) {
      // Local fallback simulation
      let point_est = 0.35;
      let lower = 0.15;
      let upper = 0.55;
      let prob_hyp = 0.78;
      let confidence = 80;
      let provenance = "";
      let assumptions: any = {};

      const sample_size = activeProject.sampleSettings?.populationSize || 60;
      const prior_attr = activeProject.sampleSettings?.expectedAttritionRate || 0.15;

      if (mode === 'LITERATURE_BASED_FORECAST') {
        const res = localLiteratureForecast(litStudies, sample_size, alpha);
        point_est = res.point_estimate;
        lower = res.pi_95[0];
        upper = res.pi_95[1];
        prob_hyp = res.prob_supported;
        confidence = res.confidence_score;
        provenance = res.data_provenance;
        assumptions = res.assumptions;
      } else if (mode === 'PILOT_UPDATED_FORECAST') {
        const tScores = pilotTreatment.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const cScores = pilotControl.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const res = localPilotForecast(priorMean, priorVariance, tScores, cScores, alpha);
        point_est = res.point_estimate;
        lower = res.pi_95[0];
        upper = res.pi_95[1];
        prob_hyp = res.prob_supported;
        confidence = res.confidence_score;
        provenance = res.data_provenance;
        assumptions = res.assumptions;
      } else if (mode === 'IN_STUDY_DYNAMIC_FORECAST') {
        const res = localDynamicForecast(attendanceRate, fidelityRate);
        point_est = res.expected_gain / 100.0;
        lower = point_est - 0.2;
        upper = point_est + 0.2;
        confidence = res.confidence_score;
        provenance = res.data_provenance;
        assumptions = res.assumptions;
        prob_hyp = 0.88;
      } else {
        point_est = 0.45;
        lower = 0.27;
        upper = 0.63;
        confidence = 75;
        provenance = "Model v2 Predictive Sandbox (Offline Mode)";
        assumptions = { model: "bayesian_fallback" };
        prob_hyp = 0.82;
      }

      // Offline mock forecasts
      const mock_attr_val = mode === 'IN_STUDY_DYNAMIC_FORECAST' ? 1.0 - (attendanceRate * 0.9) : prior_attr;
      const mock_fid_val = mode === 'IN_STUDY_DYNAMIC_FORECAST' ? fidelityRate : 0.85;

      const mock_attr_fc = {
        pointEstimate: mock_attr_val,
        pi_80: [Math.max(0, mock_attr_val - 0.05), Math.min(1, mock_attr_val + 0.05)],
        pi_95: [Math.max(0, mock_attr_val - 0.1), Math.min(1, mock_attr_val + 0.1)]
      };
      const mock_comp_fc = {
        pointEstimate: 1.0 - mock_attr_val,
        pi_80: [Math.max(0, 1.0 - mock_attr_val - 0.05), Math.min(1, 1.0 - mock_attr_val + 0.05)],
        pi_95: [Math.max(0, 1.0 - mock_attr_val - 0.1), Math.min(1, 1.0 - mock_attr_val + 0.1)]
      };
      const mock_fid_fc = {
        pointEstimate: mock_fid_val,
        pi_80: [Math.max(0, mock_fid_val - 0.05), Math.min(1, mock_fid_val + 0.05)],
        pi_95: [Math.max(0, mock_fid_val - 0.1), Math.min(1, mock_fid_val + 0.1)]
      };
      const mock_pwr_fc = {
        pointEstimate: 0.82,
        pi_80: [0.72, 0.91],
        pi_95: [0.63, 0.95]
      };
      const mock_risk_fc = {
        score: sample_size < 30 ? 68 : mock_attr_val > 0.20 ? 45 : 18,
        riskLevel: sample_size < 30 ? "HIGH" : mock_attr_val > 0.20 ? "MEDIUM" : "LOW",
        reasons: sample_size < 30 ? ["حجم عينة الدراسة صغير جداً أقل من الحد المطلوب إحصائياً"] : []
      };
      const mock_readiness_fc = {
        score: activeProject.preRegistrationLockedAt ? 92 : 64,
        positives: activeProject.preRegistrationLockedAt ? ["خطة تسجيل مسبق مؤمنة عبر التجزئة الرقمية SHA-256"] : ["المتغيرات وصياغة الفروض متكاملة."],
        negatives: activeProject.preRegistrationLockedAt ? [] : ["خط أساس التسجيل المسبق غير مقفل للوقاية من الصيد الإحصائي (p-hacking)"]
      };

      const mock_recommendations = [
        {
          id: "r1",
          title: "تقليل معدلات الفقد والانسحاب الميداني",
          rationale: "بسبب انخفاض أعداد العينة المستجيبة، يوصى بتقديم حوافز تشجيعية للطلاب للحفاظ على القوة الإحصائية.",
          priority: "HIGH",
          affectedMetric: "Attrition / Power",
          evidenceSource: "Sample Rule Engine",
          uncertainty: "منخفض"
        },
        {
          id: "r2",
          title: "تجميد التسجيل المسبق (Pre-registration)",
          rationale: "قبل المضي قدماً نحو جمع البيانات، يرجى قفل الأهداف والمتغيرات عبر التوثيق الرقمي لإثبات نزاهة خطة النشر.",
          priority: "MEDIUM",
          affectedMetric: "Publication Integrity",
          evidenceSource: "Pre-registration Guard",
          uncertainty: "منخفض"
        }
      ];

      const runId = `local-run-${Date.now()}`;
      const newRun = {
        run: {
          id: runId,
          projectId: activeProject.id,
          forecastMode: mode,
          dataProvenance: provenance,
          assumptions: {
            ...assumptions,
            forecasts: {
              attrition: mock_attr_fc,
              completion: mock_comp_fc,
              fidelity: mock_fid_fc,
              power: mock_pwr_fc,
              risk: mock_risk_fc,
              readiness: mock_readiness_fc
            }
          },
          confidenceQualityScore: confidence,
          createdAt: new Date().toISOString(),
          createdBy: "Local User"
        },
        result: {
          pointEstimate: point_est,
          lowerInterval: lower,
          upperInterval: upper,
          confidenceQualityScore: confidence
        },
        scenarios: localGenerateScenarios(point_est),
        hypotheses: activeProject.hypotheses?.map((h, i) => ({
          id: `local-hyp-${i}-${Date.now()}`,
          hypothesisId: h.id,
          probabilitySupported: prob_hyp
        })) || [],
        comparisons: [],
        recommendations: mock_recommendations
      };

      const saved = researchStorage.getItem(`rb_local_runs_${activeProject.id}`);
      const localRuns = saved ? JSON.parse(saved) : [];
      const updatedRuns = [newRun, ...localRuns];
      researchStorage.setItem(`rb_local_runs_${activeProject.id}`, JSON.stringify(updatedRuns));

      setRuns(updatedRuns.map(r => r.run));
      setSelectedRun(newRun);

      // Sync active step to completed in path
      const activeSteps = activeProject.completedSteps || [];
      if (!activeSteps.includes('ResearchOutcomePredictor')) {
        updateProjectWorkflowProfile(activeProject.id, {
          completedSteps: [...activeSteps, 'ResearchOutcomePredictor']
        });
      }
      } else {
      // Backend online mode
      const body: any = {
        forecastMode: mode,
        modelVersionId: null,
        cohortData: [
          { attendanceRate: attendanceRate, fidelity: fidelityRate, completed: true },
          { attendanceRate: attendanceRate * 0.9, fidelity: fidelityRate * 0.95, completed: true },
          { attendanceRate: attendanceRate * 0.7, fidelity: fidelityRate * 0.80, completed: false }
        ]
      };

      if (mode === 'LITERATURE_BASED_FORECAST') {
        body.studies = litStudies;
      } else if (mode === 'PILOT_UPDATED_FORECAST') {
        body.pilotData = {
          priorMean,
          priorVariance,
          treatmentScores: pilotTreatment.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)),
          controlScores: pilotControl.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)),
          alpha
        };
      }

      const newRun = await apiRunPredictionRun(activeProject.id, body);
      if (newRun) {
        setRuns(prev => [newRun.run, ...prev]);
        setSelectedRun(newRun);
        
        // Sync active step to completed in path
        const activeSteps = activeProject.completedSteps || [];
        if (!activeSteps.includes('ResearchOutcomePredictor')) {
          updateProjectWorkflowProfile(activeProject.id, {
            completedSteps: [...activeSteps, 'ResearchOutcomePredictor']
          });
        }
      }
      }
    } catch (error) {
      console.error('Prediction run failed', error);
      setPredictionError(language === 'ar'
        ? 'تعذر تشغيل التنبؤ. تحقق من بيانات الإدخال أو اتصال الخادم ثم حاول مرة أخرى.'
        : 'The prediction could not run. Check the inputs or server connection and try again.');
    } finally {
      setLoadingPredict(false);
    }
  };

  const addObservedComparison = async () => {
    if (!activeProject || !selectedRun) return;
    setComparisonError(null);

    if (!Number.isFinite(observedEffect) || !Number.isFinite(observedTMean) ||
      !Number.isFinite(observedCMean) || !Number.isFinite(observedAttr) ||
      observedAttr < 0 || observedAttr > 1) {
      setComparisonError(language === 'ar'
        ? 'يرجى إدخال قياسات مرصودة صحيحة، ومعدل فقد بين 0 و100%.'
        : 'Enter valid observed measurements and an attrition rate between 0% and 100%.');
      return;
    }

    if (!isSecureMode) {
      const effect_diff = Math.abs(observedEffect - selectedRun.result.pointEstimate);
      const is_within = (observedEffect >= selectedRun.result.lowerInterval) && (observedEffect <= selectedRun.result.upperInterval);

      const comp = {
        id: `local-comp-${Date.now()}`,
        runId: selectedRun.run.id,
        observedDatasetName: language === 'ar' ? 'نتائج الدراسة الميدانية المرصودة' : 'Actual Field Observations',
        metrics: {
          observedEffectSize: observedEffect,
          predictedEffectSize: selectedRun.result.pointEstimate,
          effectSizeDiff: effect_diff,
          isWithinInterval: is_within,
          observedTreatmentMean: observedTMean,
          observedControlMean: observedCMean,
          observedAttrition: observedAttr
        }
      };

      const saved = researchStorage.getItem(`rb_local_runs_${activeProject.id}`);
      const localRuns = saved ? JSON.parse(saved) : [];
      const updatedRuns = localRuns.map((r: any) => {
        if (r.run.id === selectedRun.run.id) {
          return {
            ...r,
            comparisons: [...(r.comparisons || []), comp]
          };
        }
        return r;
      });
      researchStorage.setItem(`rb_local_runs_${activeProject.id}`, JSON.stringify(updatedRuns));
      
      const nextDetails = updatedRuns.find((r: any) => r.run.id === selectedRun.run.id);
      if (nextDetails) {
        setSelectedRun(nextDetails);
      }
    } else {
      const comp = await apiCompareObservedOutcome(activeProject.id, selectedRun.run.id, {
        observedDatasetName: language === 'ar' ? 'نتائج الدراسة الميدانية المرصودة' : 'Actual Field Observations',
        observedEffectSize: observedEffect,
        observedTreatmentMean: observedTMean,
        observedControlMean: observedCMean,
        observedAttritionRate: observedAttr
      });
      if (comp) {
        loadRunDetails(selectedRun.run.id);
      }
    }
  };

  const getNestedForecast = (key: string) => {
    return selectedRun?.run?.assumptions?.forecasts?.[key] || null;
  };

  useEffect(() => {
    if (activeProject) {
      checkReadiness();
      fetchRuns();
    }
  }, [activeProject, isSecureMode, checkReadiness, fetchRuns]);

  return {
    readiness,
    runs,
    selectedRun,
    loadingReadiness,
    loadingRuns,
    loadingPredict,
    predictionError,
    comparisonError,
    mode,
    setMode,
    alpha,
    setAlpha,
    litStudies,
    setLitStudies,
    priorMean,
    setPriorMean,
    priorVariance,
    setPriorVariance,
    pilotTreatment,
    setPilotTreatment,
    pilotControl,
    setPilotControl,
    fidelityRate,
    setFidelityRate,
    attendanceRate,
    setAttendanceRate,
    observedEffect,
    setObservedEffect,
    observedTMean,
    setObservedTMean,
    observedCMean,
    setObservedCMean,
    observedAttr,
    setObservedAttr,
    checkReadiness,
    fetchRuns,
    loadRunDetails,
    triggerPrediction,
    addObservedComparison,
    getNestedForecast,
    language,
    activeProject
  };
};
