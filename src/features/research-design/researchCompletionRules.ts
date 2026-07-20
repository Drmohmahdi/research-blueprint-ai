import type { ResearchProject } from '../../types/research';
import type { ResearchStepId, StepStatus } from './researchDesignConfig';

export interface StepEvaluation {
  status: StepStatus;
  progressPercentage: number;
  missingInputs: string[];
  warnings: string[];
  outputsCount: number;
}

export const evaluateStepCompletion = (
  stepId: ResearchStepId,
  project: ResearchProject | null,
  simulationResult?: any,
  predictionData?: any,
  commentsCount: number = 0
): StepEvaluation => {


  if (!project) {
    return {
      status: 'NOT_STARTED',
      progressPercentage: 0,
      missingInputs: ['مشروع غير محدد'],
      warnings: [],
      outputsCount: 0
    };
  }

  const missingInputs: string[] = [];
  const warnings: string[] = [];
  let score = 0;


  switch (stepId) {
    case 'IDEA_EXPLORATION': {
      if (project.descriptionAr && project.descriptionAr.length > 20) score += 40;
      else missingInputs.push('فكرة سياقية واضحة ومفصلة (20 حرف على الأقل)');

      if (project.institutionAr || project.departmentAr) score += 30;
      else missingInputs.push('تحديد القسم والمؤسسة البحثية');

      if (project.titleAr && project.titleAr.length > 10) score += 30;
      else missingInputs.push('موضوع البحث المبدئي');

      break;
    }

    case 'TITLE_ANALYSIS': {
      if (project.titleAr && project.titleAr.length >= 15) score += 50;
      else missingInputs.push('عنوان باللغة العربية معتمد (15 حرف على الأقل)');

      if (project.titleEn && project.titleEn.length >= 15) score += 30;
      else missingInputs.push('عنوان باللغة الإنجليزية');

      if (project.variables && project.variables.length >= 1) score += 20;
      else warnings.push('لم يتم مراجعة واستخراج المتغيرات الأساسية من العنوان بعد');

      break;
    }

    case 'PROBLEM_AND_GAP': {
      if (project.problemStatementAr && project.problemStatementAr.length >= 30) score += 70;
      else missingInputs.push('صياغة المشكلة البحثية والفجوة (30 حرف على الأقل)');

      if (project.descriptionAr) score += 30;
      else missingInputs.push('مبررات ودواعي صياغة الفجوة');

      break;
    }

    case 'OBJECTIVES': {
      const hasQuestions = project.questions && project.questions.length > 0;
      const hasProblem = Boolean(project.problemStatementAr);

      if (hasProblem) score += 50;
      else missingInputs.push('ربط الأهداف بمشكلة البحث');

      if (hasQuestions) score += 50;
      else missingInputs.push('أهداف فرعية قابلة للقياس صريحة');

      break;
    }

    case 'QUESTIONS_AND_HYPOTHESES': {
      const qCount = project.questions ? project.questions.length : 0;
      const hCount = project.hypotheses ? project.hypotheses.length : 0;

      if (qCount >= 1) score += 60;
      else missingInputs.push('سؤال بحثي رئيسي واحد على الأقل');

      if (hCount >= 1) score += 40;
      else warnings.push('يفضل صياغة فرضية إحصائية واحدة على الأقل للاختبار');

      break;
    }

    case 'VARIABLES': {
      const vars = project.variables || [];
      const hasIndependent = vars.some(v => v.type === 'independent');
      const hasDependent = vars.some(v => v.type === 'dependent');

      if (vars.length >= 2) score += 40;
      else missingInputs.push('متغيرين اثنين على الأقل للدراسة');

      if (hasIndependent) score += 30;
      else missingInputs.push('متغير مستقل واحد على الأقل');

      if (hasDependent) score += 30;
      else missingInputs.push('متغير تابع واحد على الأقل');

      break;
    }

    case 'CONCEPTUAL_MODEL': {
      const vars = project.variables || [];
      const hyps = project.hypotheses || [];

      if (vars.length >= 2) score += 50;
      else missingInputs.push('متغيرات موثقة لتأطير النموذج المفاهيمي');

      if (hyps.length >= 1) score += 50;
      else missingInputs.push('مسارات وفرضيات تربط عناصر النموذج');

      break;
    }

    case 'METHODOLOGY_AND_DESIGN': {
      if (project.studyDesign) score += 100;
      else missingInputs.push('تحديد منهج وتصميم الدراسة الرسمي');

      break;
    }

    case 'POPULATION_AND_SAMPLE': {
      const sample = project.sampleSettings;
      if (sample && sample.confidenceLevel && sample.marginOfError) score += 70;
      else missingInputs.push('إعدادات الثبات وهوامش الخطأ للعينة');

      if (project.institutionAr) score += 30;
      else missingInputs.push('تحديد مجتمع الدراسة المستهدف');

      break;
    }

    case 'MEASUREMENT_INSTRUMENTS': {
      const vars = project.variables || [];
      if (vars.length > 0) score += 70;
      else missingInputs.push('ربط أدوات القياس بالمتغيرات المحددة');

      score += 30;
      break;
    }

    case 'ANALYSIS_PLAN': {
      const questions = project.questions || [];
      const hyps = project.hypotheses || [];

      if (questions.length > 0 || hyps.length > 0) score += 100;
      else missingInputs.push('وجود أسئلة أو فرضيات لبناء خطة التحليل الإحصائي');

      break;
    }

    case 'LITERATURE_EVIDENCE': {
      // Checked against project literature or mock
      score += 80;
      warnings.push('تأكد من توثيق دراستين سابقين مع حجم الأثر المذكور');
      break;
    }

    case 'SIMULATION': {
      if (simulationResult && simulationResult.summary) score += 100;
      else {
        score += 30;
        missingInputs.push('تشغيل وتوليد سيناريو محاكاة واحد على الأقل');
      }
      break;
    }

    case 'PREDICTION': {
      if (predictionData && (predictionData.pointEstimate !== undefined || predictionData.predictionRun)) score += 100;
      else {
        score += 40;
        missingInputs.push('تشغيل نموذج التنبؤ العلمي لتحديد احتمالية الدعم');
      }
      break;
    }

    case 'CONSISTENCY_VALIDATION': {
      const vars = project.variables || [];
      const questions = project.questions || [];
      if (vars.length > 0 && questions.length > 0 && project.studyDesign) score += 100;
      else missingInputs.push('إكمال العناصر الأساسية (العنوان، المتغيرات، الأسئلة، المنهج) لإجراء فحص الاتساق');

      break;
    }

    case 'ETHICS_AND_FEASIBILITY': {
      score += 100; // default ready
      break;
    }

    case 'PRE_REGISTRATION': {
      if (project.preRegistrationHash) score += 100;
      else {
        score += 50;
        missingInputs.push('إنجاز وتجميد التسجيل المسبق وتوليد الرقم التشفيري');
      }
      break;
    }

    case 'FINAL_RESEARCH_PLAN': {
      if (project.titleAr && project.studyDesign && project.variables && project.variables.length > 0) score += 100;
      else missingInputs.push('استكمال الخطوات الرئيسية قبل توليد خطة البحث النهائية');

      break;
    }
  }

  let status: StepStatus = 'NOT_STARTED';
  if (score >= 100 && missingInputs.length === 0) {
    status = 'COMPLETED';
  } else if (score > 0) {
    status = commentsCount > 0 ? 'NEEDS_REVIEW' : 'IN_PROGRESS';
  }

  return {
    status,
    progressPercentage: Math.min(100, Math.max(0, score)),
    missingInputs,
    warnings,
    outputsCount: score >= 100 ? 1 : 0
  };
};
