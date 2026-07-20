export type ResearchStepId =
  | 'IDEA_EXPLORATION'
  | 'TITLE_ANALYSIS'
  | 'PROBLEM_AND_GAP'
  | 'OBJECTIVES'
  | 'QUESTIONS_AND_HYPOTHESES'
  | 'VARIABLES'
  | 'CONCEPTUAL_MODEL'
  | 'METHODOLOGY_AND_DESIGN'
  | 'POPULATION_AND_SAMPLE'
  | 'MEASUREMENT_INSTRUMENTS'
  | 'ANALYSIS_PLAN'
  | 'LITERATURE_EVIDENCE'
  | 'SIMULATION'
  | 'PREDICTION'
  | 'CONSISTENCY_VALIDATION'
  | 'ETHICS_AND_FEASIBILITY'
  | 'PRE_REGISTRATION'
  | 'FINAL_RESEARCH_PLAN';

export type StepStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NEEDS_REVIEW'
  | 'BLOCKED'
  | 'OPTIONAL';

export interface StepConfig {
  id: ResearchStepId;
  order: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: 'conceptual' | 'methodological' | 'statistical' | 'validation';
  requiredInputs: string[];
  dependencies: ResearchStepId[];
  isOptional?: boolean;
}

export const RESEARCH_STEPS_CONFIG: StepConfig[] = [
  {
    id: 'IDEA_EXPLORATION',
    order: 1,
    titleAr: 'استكشاف الفكرة البحثية',
    titleEn: 'Idea Exploration',
    descriptionAr: 'تحديد المجال الرئيسي، الفكرة البحثية الأولية، والسياق المشكل للدراسة.',
    descriptionEn: 'Explore initial research area, general domain, and primary research context.',
    category: 'conceptual',
    requiredInputs: ['ideaText', 'domain', 'context'],
    dependencies: []
  },
  {
    id: 'TITLE_ANALYSIS',
    order: 2,
    titleAr: 'تحليل وتفكيك العنوان',
    titleEn: 'Title Analysis',
    descriptionAr: 'فحص جودة العنوان لغوياً ومنهجياً واستخراج المتغيرات الأساسية.',
    descriptionEn: 'Analyze proposed title structure, extract key variables, and verify academic clarity.',
    category: 'conceptual',
    requiredInputs: ['titleAr', 'titleEn'],
    dependencies: ['IDEA_EXPLORATION']
  },
  {
    id: 'PROBLEM_AND_GAP',
    order: 3,
    titleAr: 'صياغة المشكلة والفجوة',
    titleEn: 'Problem & Research Gap',
    descriptionAr: 'توضيح المشكلة البحثية وتحديد الفجوة المعرفية متبوعة بالدليل والمبررات.',
    descriptionEn: 'Define research problem, substantiate the academic gap, and provide rationale.',
    category: 'conceptual',
    requiredInputs: ['problemStatementAr', 'gapRationale'],
    dependencies: ['TITLE_ANALYSIS']
  },
  {
    id: 'OBJECTIVES',
    order: 4,
    titleAr: 'أهداف الدراسة',
    titleEn: 'Research Objectives',
    descriptionAr: 'صياغة الهدف العام والأهداف الفرعية الإجرائية القابلة للقياس.',
    descriptionEn: 'Formulate general and specific measurable research objectives.',
    category: 'conceptual',
    requiredInputs: ['generalObjective', 'specificObjectives'],
    dependencies: ['PROBLEM_AND_GAP']
  },
  {
    id: 'QUESTIONS_AND_HYPOTHESES',
    order: 5,
    titleAr: 'الأسئلة والفرضيات البحثية',
    titleEn: 'Questions & Hypotheses',
    descriptionAr: 'بناء الأسئلة وتحديد اتجاه الفرضيات وطبيعة العلاقات الإحصائية.',
    descriptionEn: 'Formulate research questions and map statistical hypotheses.',
    category: 'conceptual',
    requiredInputs: ['questions', 'hypotheses'],
    dependencies: ['OBJECTIVES']
  },
  {
    id: 'VARIABLES',
    order: 6,
    titleAr: 'تعريف المتغيرات ومستويات القياس',
    titleEn: 'Variables & Scales',
    descriptionAr: 'تحديد نوع كل متغير (مستقل، تابع، وسيط، معدل) وتصنيف مستويات القياس والتعاريف الإجرائية.',
    descriptionEn: 'Classify variable types, measurement scales, and operational definitions.',
    category: 'methodological',
    requiredInputs: ['variablesList'],
    dependencies: ['QUESTIONS_AND_HYPOTHESES']
  },
  {
    id: 'CONCEPTUAL_MODEL',
    order: 7,
    titleAr: 'بناء النموذج المفاهيمي',
    titleEn: 'Conceptual Model',
    descriptionAr: 'رسم وتوثيق مسارات العلاقات والمسارات بين كافة متغيرات الدراسة.',
    descriptionEn: 'Construct structural framework and operational paths between variables.',
    category: 'methodological',
    requiredInputs: ['modelRelations'],
    dependencies: ['VARIABLES']
  },
  {
    id: 'METHODOLOGY_AND_DESIGN',
    order: 8,
    titleAr: 'المنهج والتصميم البحثي',
    titleEn: 'Methodology & Design',
    descriptionAr: 'اختيار المنهج المناسب (وصفي، شبه تجريبي، الخ) وتوضيح إجراءات التحكم بالصدق الداخلي.',
    descriptionEn: 'Select research methodology, experimental design, and internal validity controls.',
    category: 'methodological',
    requiredInputs: ['studyDesign', 'designRationale'],
    dependencies: ['CONCEPTUAL_MODEL']
  },
  {
    id: 'POPULATION_AND_SAMPLE',
    order: 9,
    titleAr: 'المجتمع واستراتيجية العينة',
    titleEn: 'Population & Sample Size',
    descriptionAr: 'تحديد المجتمع المستهدف وحساب حجم العينة الأدنى برمجياً بالاعتماد على القوة الإحصائية.',
    descriptionEn: 'Define target population, sampling method, and calculate sample size based on statistical power.',
    category: 'statistical',
    requiredInputs: ['targetPopulation', 'sampleSizeSettings'],
    dependencies: ['METHODOLOGY_AND_DESIGN']
  },
  {
    id: 'MEASUREMENT_INSTRUMENTS',
    order: 10,
    titleAr: 'أدوات القياس والاختبارات',
    titleEn: 'Measurement Instruments',
    descriptionAr: 'توسيم واستخلاص الأدوات والمقاييس المستخدمة لكل متغير مع تحديد خطة الصدق والثبات.',
    descriptionEn: 'Specify measurement scales, scoring schemes, and validity/reliability verification plans.',
    category: 'methodological',
    requiredInputs: ['instrumentsPlan'],
    dependencies: ['VARIABLES']
  },
  {
    id: 'ANALYSIS_PLAN',
    order: 11,
    titleAr: 'خطة التحليل الإحصائي',
    titleEn: 'Statistical Analysis Plan',
    descriptionAr: 'ربط كل سؤال وفرضية باختبار إحصائي محدد وفحص الافتراضات وحجم الأثر المتوقع.',
    descriptionEn: 'Map research questions to parametric/non-parametric tests, effect sizes, and assumptions.',
    category: 'statistical',
    requiredInputs: ['statisticalTestsMap'],
    dependencies: ['QUESTIONS_AND_HYPOTHESES', 'VARIABLES']
  },
  {
    id: 'LITERATURE_EVIDENCE',
    order: 12,
    titleAr: 'أدلة وحجم أثر الدراسات السابقة',
    titleEn: 'Literature Evidence & Priors',
    descriptionAr: 'ربط نتائج المقالات وحساب أحجام الأثر التجميعية (Pooled Effect Sizes) لبناء التنبؤات.',
    descriptionEn: 'Synthesize effect size priors from past literature and quantify heterogeneity.',
    category: 'conceptual',
    requiredInputs: ['literatureArticles'],
    dependencies: ['PROBLEM_AND_GAP']
  },
  {
    id: 'SIMULATION',
    order: 13,
    titleAr: 'مختبر المحاكاة والبيانات الاصطناعية',
    titleEn: 'Simulation Lab',
    descriptionAr: 'توليد ومحاكاة الاستجابات الإحصائية واختبار فرضيات القوة الإحصائية تحت شروط العينة.',
    descriptionEn: 'Run Monte Carlo simulation scenarios and verify statistical behavior under attrition.',
    category: 'statistical',
    requiredInputs: ['simulationParams'],
    dependencies: ['POPULATION_AND_SAMPLE', 'ANALYSIS_PLAN']
  },
  {
    id: 'PREDICTION',
    order: 14,
    titleAr: 'محرك التنبؤ العلمي والتوقع الإحصائي',
    titleEn: 'Scientific Prediction Engine',
    descriptionAr: 'احتساب احتمالات التأييد وحجم الأثر البعدي عبر ثلاثة مستويات تنبؤية بايزية.',
    descriptionEn: 'Compute hypothesis support probabilities and expected effect sizes across 3 forecast tiers.',
    category: 'statistical',
    requiredInputs: ['forecastMode', 'predictionRunConfig'],
    dependencies: ['SIMULATION', 'LITERATURE_EVIDENCE']
  },
  {
    id: 'CONSISTENCY_VALIDATION',
    order: 15,
    titleAr: 'فحص الاتساق المنهجي والمنطقي',
    titleEn: 'Consistency Validation',
    descriptionAr: 'فحص ومطابقة الروابط بين العنوان، المشكلة، الأهداف، الفروض، العينة والتحليل الإحصائي.',
    descriptionEn: 'Run automated logical consistency audits to catch internal design contradictions.',
    category: 'validation',
    requiredInputs: ['consistencyCheckResult'],
    dependencies: ['ANALYSIS_PLAN', 'QUESTIONS_AND_HYPOTHESES']
  },
  {
    id: 'ETHICS_AND_FEASIBILITY',
    order: 16,
    titleAr: 'الأخلاقيات والجدوى الإجرائية',
    titleEn: 'Ethics & Feasibility',
    descriptionAr: 'تقييم السلامة الأخلاقية وحماية الخصوصية ووضع الميزانية والخطة الزمنية للتنفيذ.',
    descriptionEn: 'Assess IRB compliance, risk mitigation, resource allocation, and timeline budget.',
    category: 'validation',
    requiredInputs: ['ethicsChecklist', 'feasibilityBudget'],
    dependencies: ['METHODOLOGY_AND_DESIGN']
  },
  {
    id: 'PRE_REGISTRATION',
    order: 17,
    titleAr: 'التسجيل المسبق وتجميد التصميم',
    titleEn: 'Pre-Registration Draft',
    descriptionAr: 'تجميد تفاصيل الدراسة وإصدار الهاش الرقمي لمنع انحياز التقرير (HARKing).',
    descriptionEn: 'Lock research design parameters and generate verifiable pre-registration cryptographic hash.',
    category: 'validation',
    requiredInputs: ['preregistrationFields'],
    dependencies: ['CONSISTENCY_VALIDATION', 'ETHICS_AND_FEASIBILITY']
  },
  {
    id: 'FINAL_RESEARCH_PLAN',
    order: 18,
    titleAr: 'خطة البحث النهائية المكتملة',
    titleEn: 'Final Research Plan',
    descriptionAr: 'مراجعة وتصدير الخطة الشاملة الجاهزة واعتماد الربط بالأصل العلمي الموحد.',
    descriptionEn: 'Compile complete exportable research blueprint synchronized with Scholarly Asset Registry.',
    category: 'validation',
    requiredInputs: ['finalApproval'],
    dependencies: ['PRE_REGISTRATION']
  }
];

export function getFilteredStepsForDesign(studyDesign?: string): StepConfig[] {
  if (!studyDesign) return RESEARCH_STEPS_CONFIG;
  const isQual = studyDesign.startsWith('qualitative') || studyDesign.includes('case_study') || studyDesign.includes('phenomenology');
  if (isQual) {
    return RESEARCH_STEPS_CONFIG.map(s => {
      if (['SIMULATION', 'PREDICTION'].includes(s.id)) {
        return { ...s, isOptional: true };
      }
      return s;
    });
  }
  return RESEARCH_STEPS_CONFIG;
}

