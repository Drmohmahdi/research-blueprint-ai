import type { ResearchIntelligenceProfile } from '../types/intelligenceProfile';
import { RESEARCH_TOOLS_REGISTRY } from '../config/researchToolsRegistry';
import { RESEARCH_PATHS_CONFIG } from '../config/researchPathsConfig';

export class ResearchWorkflowOrchestrator {
  /**
   * Returns the current active step (tool ID) for a path given the intelligence profile status.
   */
  static getCurrentStep(profile: ResearchIntelligenceProfile, pathId: string): string {
    const path = RESEARCH_PATHS_CONFIG.find(p => p.id === pathId);
    if (!path) return 'dashboard';

    // Find the first step in the ordered list that hasn't been completed yet
    const completed = profile.stage.completedSteps || [];
    for (const step of path.orderedSteps) {
      if (!completed.includes(step)) {
        return step;
      }
    }

    // If all are completed, return the last step
    return path.orderedSteps[path.orderedSteps.length - 1] || 'dashboard';
  }

  /**
   * Returns list of completed steps for the active path
   */
  static getCompletedSteps(profile: ResearchIntelligenceProfile, pathId: string): string[] {
    const path = RESEARCH_PATHS_CONFIG.find(p => p.id === pathId);
    if (!path) return [];
    return (profile.stage.completedSteps || []).filter(step => path.orderedSteps.includes(step));
  }

  /**
   * Returns the next recommended tool ID or null if all are completed
   */
  static getNextRecommendedStep(profile: ResearchIntelligenceProfile, pathId: string): string | null {
    const path = RESEARCH_PATHS_CONFIG.find(p => p.id === pathId);
    if (!path) return null;

    const completed = profile.stage.completedSteps || [];
    for (const step of path.orderedSteps) {
      if (!completed.includes(step)) {
        return step;
      }
    }
    return null;
  }

  /**
   * Validates if the user has completed all prerequisites for a specific tool.
   */
  static validateStepPrerequisites(
    profile: ResearchIntelligenceProfile, 
    toolId: string
  ): { valid: boolean; missing: string[] } {
    const tool = RESEARCH_TOOLS_REGISTRY.find(t => t.id === toolId);
    if (!tool) return { valid: true, missing: [] };

    const missing: string[] = [];
    const completed = profile.stage.completedSteps || [];

    for (const reqToolId of tool.prerequisites) {
      if (!completed.includes(reqToolId)) {
        missing.push(reqToolId);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Calculates the percentage progress of a research path.
   */
  static calculatePathProgress(profile: ResearchIntelligenceProfile, pathId: string): number {
    const path = RESEARCH_PATHS_CONFIG.find(p => p.id === pathId);
    if (!path || path.orderedSteps.length === 0) return 0;

    const completedCount = this.getCompletedSteps(profile, pathId).length;
    return Math.round((completedCount / path.orderedSteps.length) * 100);
  }

  /**
   * Verifies if any inputs are missing from the intelligence profile for a specific tool.
   */
  static getMissingInputs(profile: ResearchIntelligenceProfile, toolId: string): string[] {
    const tool = RESEARCH_TOOLS_REGISTRY.find(t => t.id === toolId);
    if (!tool) return [];

    const missing: string[] = [];

    for (const field of tool.requiredInputs) {
      // Check identity fields
      if (field === 'titleAr' && !profile.identity.titleAr) missing.push(field);
      
      // Check design fields
      if (field === 'variables' && profile.variables.length === 0) missing.push(field);
      if (field === 'hypotheses' && profile.design.hypothesesCount === 0) missing.push(field);
      
      // Check sample fields
      if (field === 'sampleSettings' && (!profile.sample || profile.sample.populationSize === 0)) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * Returns list of tools associated with a path
   */
  static getRelevantTools(pathId: string): string[] {
    const path = RESEARCH_PATHS_CONFIG.find(p => p.id === pathId);
    if (!path) return [];
    return [...path.primaryTools, ...path.supportingTools];
  }

  /**
   * Verifies if the prediction engine is eligible to run on this project.
   */
  static getPredictionAvailability(profile: ResearchIntelligenceProfile): { available: boolean; reason?: string } {
    if (profile.variables.length === 0) {
      return { 
        available: false, 
        reason: 'يجب تحديد متغيرات الدراسة المستقلة والتابعة أولاً.' 
      };
    }
    if (profile.design.hypothesesCount === 0) {
      return { 
        available: false, 
        reason: 'يجب صياغة الفروض الإحصائية للدراسة لتوقع اتجاهاتها.' 
      };
    }
    if (profile.quality.predictionEligibilityStatus === 'INELIGIBLE') {
      return { 
        available: false, 
        reason: 'تم وضع علامة غير مؤهل على البيانات بسبب انخفاض معايير النزاهة أو كثرة القيم المفقودة.' 
      };
    }

    return { available: true };
  }

  /**
   * Checks for methodological warnings.
   */
  static getMethodologicalWarnings(profile: ResearchIntelligenceProfile): string[] {
    const warnings: string[] = [];

    // 1. Sample Size Power warning
    if (profile.sample.populationSize < 30) {
      warnings.push('حجم العينة صغير جداً (N < 30)، مما يقلل القوة الإحصائية ويعرض النتائج للتحيز.');
    }

    // 2. Variable mismatch
    const hasInd = profile.variables.some(v => v.type === 'independent');
    const hasDep = profile.variables.some(v => v.type === 'dependent');
    if (!hasInd || !hasDep) {
      warnings.push('الدراسة تفتقر لتعريف واضح للمتغير المستقل أو التابع في مصفوفة النموذج.');
    }

    // 3. Attrition warning
    if (profile.execution.currentAttritionRate && profile.execution.currentAttritionRate > 0.20) {
      warnings.push('معدل الفقد (Attrition) في الميدان تجاوز 20%، وهو ما يهدد الصدق الداخلي للتصميم شبه التجريبي.');
    }

    // 4. Fidelity warning
    if (profile.execution.fidelityScore && profile.execution.fidelityScore < 0.70) {
      warnings.push('مؤشر التزام المعلمين ببروتوكول التدخل أقل من 70%، مما يؤثر سلباً على تقدير حجم الأثر الفعلي.');
    }

    return warnings;
  }

  /**
   * Returns recommended actionable items based on the profile
   */
  static getRecommendedActions(profile: ResearchIntelligenceProfile): { title: string; rationale: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }[] {
    const actions: { title: string; rationale: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [];

    // Check variables
    if (profile.variables.length === 0) {
      actions.push({
        title: 'استخلاص المتغيرات من العنوان',
        rationale: 'استخدم محلل العنوان بالذكاء الاصطناعي لاستخراج وتصنيف المتغيرات تلقائياً.',
        priority: 'HIGH'
      });
    }

    // Check sample
    if (profile.sample.populationSize === 100 && profile.sample.expectedEffectSize === 0.5) {
      actions.push({
        title: 'حساب حجم العينة الدقيق',
        rationale: 'قم بتشغيل حاسبة حجم العينة بناءً على معاملات الفرض الفعلي بدلاً من المعاملات الافتراضية.',
        priority: 'MEDIUM'
      });
    }

    // Check pre-registration
    if (!profile.identity.projectId) {
      // No active project
    } else if (!profile.provenance.confidence || profile.provenance.confidence < 90) {
      actions.push({
        title: 'قفل خطة التسجيل المسبق',
        rationale: 'قم بعمل تجميد (Pre-registration) وحساب البصمة الرقمية للخطط قبل البدء بجمع البيانات لمنع الصيد المنهجي للنتائج.',
        priority: 'HIGH'
      });
    }

    return actions;
  }
}
