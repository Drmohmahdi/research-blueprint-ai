import type { ResearchProject } from '../../types/research';
import type { ResearchStepId } from './researchDesignConfig';

export interface AdapterContext {
  project: ResearchProject;
  scholarlyAsset?: any;
  userProfile?: any;
  activeStepId: ResearchStepId;
  onUpdateProject: (proj: ResearchProject) => void;
  onRecordUsage: (eventType: string, quantity?: number) => void;
  onAddComment?: (step: string, text: string) => void;
}

export const researchToolAdapters = {
  // Title Analyzer Adapter
  adaptTitleAnalyzer: (ctx: AdapterContext) => {
    return {
      titleAr: ctx.project.titleAr,
      titleEn: ctx.project.titleEn,
      onSaveAnalysis: (newVariables: any[], newHypotheses: any[]) => {
        // Map new variables and hypotheses back to ResearchProject
        const updatedProject: ResearchProject = {
          ...ctx.project,
          variables: [
            ...(ctx.project.variables || []),
            ...newVariables.map((v, i) => ({
              id: `v-${Date.now()}-${i}`,
              nameAr: v.nameAr || v.name,
              nameEn: v.nameEn || v.name,
              type: v.type || 'dependent',
              scale: v.scale || 'interval',
              descriptionAr: v.descriptionAr || '',
              descriptionEn: v.descriptionEn || ''
            }))
          ],
          hypotheses: [
            ...(ctx.project.hypotheses || []),
            ...newHypotheses.map((h, i) => ({
              id: `h-${Date.now()}-${i}`,
              questionId: h.questionId || '',
              textAr: h.textAr || h.text,
              textEn: h.textEn || h.text,
              type: h.type || 'directional',
              independentVarId: h.independentVarId || '',
              dependentVarId: h.dependentVarId || ''
            }))
          ]

        };
        ctx.onUpdateProject(updatedProject);
        ctx.onRecordUsage('AI_REQUEST', 1);
      }
    };
  },

  // Sample Size Adapter
  adaptSampleSize: (ctx: AdapterContext) => {
    return {
      confidenceLevel: ctx.project.sampleSettings?.confidenceLevel || 0.95,
      marginOfError: ctx.project.sampleSettings?.marginOfError || 0.05,
      populationSize: 10000, // default population
      onSaveSampleSettings: (confidence: number, error: number, size?: number) => {
        const updatedProject: ResearchProject = {
          ...ctx.project,
          sampleSettings: {
            confidenceLevel: confidence,
            marginOfError: error,
            expectedPower: ctx.project.sampleSettings?.expectedPower || 0.80,
            expectedEffectSize: ctx.project.sampleSettings?.expectedEffectSize || 0.50,
            expectedAttritionRate: ctx.project.sampleSettings?.expectedAttritionRate || 0.10,
            groupsCount: ctx.project.sampleSettings?.groupsCount || 2,
            populationSize: size || ctx.project.sampleSettings?.populationSize || 10000
          }
        };

        ctx.onUpdateProject(updatedProject);
        ctx.onRecordUsage('SIMULATION_RUN', 1);
      }
    };
  },

  // Conceptual Model Builder Adapter
  adaptModelBuilder: (ctx: AdapterContext) => {
    return {
      variables: ctx.project.variables || [],
      hypotheses: ctx.project.hypotheses || [],
      onSaveModel: (updatedVariables: any[], updatedHypotheses: any[]) => {
        const updatedProject: ResearchProject = {
          ...ctx.project,
          variables: updatedVariables,
          hypotheses: updatedHypotheses
        };
        ctx.onUpdateProject(updatedProject);
        ctx.onRecordUsage('AI_REQUEST', 1);
      }
    };
  },

  // Simulation Lab Adapter
  adaptSimulation: (ctx: AdapterContext) => {
    return {
      projectId: ctx.project.id,
      sampleSize: 100, // mock default sample size
      variables: ctx.project.variables || [],
      onSimulationComplete: (_result: any) => {
        // Log synthetic watermark telemetry
        console.warn('SIMULATION_RUN generated SYNTHETIC DATA watermarked with data_origin=SIMULATED');
        ctx.onRecordUsage('SIMULATION_RUN', 1);
      }
    };
  },

  // Prediction Engine Adapter
  adaptPrediction: (ctx: AdapterContext) => {
    return {
      projectId: ctx.project.id,
      variables: ctx.project.variables || [],
      hypotheses: ctx.project.hypotheses || [],
      onRunPrediction: () => {
        ctx.onRecordUsage('PREDICTION_RUN', 1);
      }
    };
  },

  // Literature Synthesizer Adapter
  adaptLiterature: (ctx: AdapterContext) => {
    return {
      projectId: ctx.project.id,
      onSaveSynthesizedLiterature: (_articles: any[]) => {
        ctx.onRecordUsage('AI_REQUEST', 1);
      }
    };
  },

  // Consistency Checker Adapter
  adaptConsistencyChecker: (ctx: AdapterContext) => {
    return {
      project: ctx.project,
      onCheckCompleted: (_issuesCount: number) => {
        // Record log
      }
    };
  },


  // Pre-Registration Adapter
  adaptPreRegistration: (ctx: AdapterContext) => {
    return {
      projectId: ctx.project.id,
      onLockDesign: (hash: string) => {
        const updatedProject: ResearchProject = {
          ...ctx.project,
          preRegistrationHash: hash,
          preRegistrationLockedAt: new Date().toISOString()
        };
        ctx.onUpdateProject(updatedProject);
      }
    };
  }
};
export default researchToolAdapters;
