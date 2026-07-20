export interface StepConfig {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  requiredInputs: string[];
  associatedTool: 'wizard' | 'analyzer' | 'modelBuilder' | 'sampleCalc' | 'simulation' | 'litSynthesizer' | 'outcomePredictor' | 'consistency' | 'preReg' | null;
}

export const NEW_STUDY_DESIGN_STEPS: StepConfig[] = [
  {
    id: 'ideaExploration',
    titleAr: '1. استكشاف الفكرة البحثية',
    titleEn: '1. Idea Exploration',
    descriptionAr: 'تحديد عنوان مبدئي ومجال الدراسة والكلمات المفتاحية لوضع أساس البحث.',
    descriptionEn: 'Define initial title, domain, and keywords to establish research foundations.',
    requiredInputs: ['titleAr', 'descriptionAr'],
    associatedTool: 'wizard'
  },
  {
    id: 'titleAnalysis',
    titleAr: '2. تحليل العنوان بالذكاء الاصطناعي',
    titleEn: 'Title Analysis',
    descriptionAr: 'تحليل العنوان لغوياً واستخراج المتغيرات الأساسية المستقلة والتابعة والمجتمع المستهدف.',
    descriptionEn: 'Analyze proposed title, extract main variables, target population, and contexts.',
    requiredInputs: ['variables'],
    associatedTool: 'analyzer'
  },
  {
    id: 'problemGap',
    titleAr: '3. صياغة المشكلة والفجوة العلمية',
    titleEn: 'Problem & Gap',
    descriptionAr: 'تحديد المشكلة البحثية والفجوة في الدراسات السابقة التي تبرر القيام بهذا البحث.',
    descriptionEn: 'Formulate the research problem statement and identify the literature gap.',
    requiredInputs: ['problemStatementAr'],
    associatedTool: 'wizard'
  },
  {
    id: 'objectives',
    titleAr: '4. الأهداف البحثية',
    titleEn: 'Objectives',
    descriptionAr: 'تحديد الأهداف العامة والخاصة القابلة للقياس والمرتبطة بحل المشكلة.',
    descriptionEn: 'Define measurable general and specific study objectives.',
    requiredInputs: ['objectives'],
    associatedTool: 'wizard'
  },
  {
    id: 'questionsHypotheses',
    titleAr: '5. الأسئلة والفروض الإحصائية',
    titleEn: 'Questions & Hypotheses',
    descriptionAr: 'ربط أهداف البحث بأسئلة فرعية وصياغة الفروض الإحصائية الصفرية والبديلة المتجهة وغير المتجهة.',
    descriptionEn: 'Formulate research questions and direct/null statistical hypotheses.',
    requiredInputs: ['questions', 'hypotheses'],
    associatedTool: 'wizard'
  },
  {
    id: 'variables',
    titleAr: '6. مصفوفة المتغيرات والمقاييس',
    titleEn: 'Variables & Scales',
    descriptionAr: 'تحديد أدوار المتغيرات (مستقل، تابع، وسيط، معدل) ومستوى القياس (اسمي، رتبي، فئوي، نسبي).',
    descriptionEn: 'Define variables roles, scale of measurement, and theoretical definitions.',
    requiredInputs: ['variables_scale'],
    associatedTool: 'wizard'
  },
  {
    id: 'conceptualModel',
    titleAr: '7. النموذج المفاهيمي المخطط',
    titleEn: 'Conceptual Model',
    descriptionAr: 'رسم شبكة العلاقات والروابط والتأثيرات بين المتغيرات بشكل تفاعلي مرئي ومبرر.',
    descriptionEn: 'Build and map path relations between variables dynamically.',
    requiredInputs: ['relations'],
    associatedTool: 'modelBuilder'
  },
  {
    id: 'methodologyDesign',
    titleAr: '8. المنهج وتصميم الدراسة',
    titleEn: 'Methodology & Design',
    descriptionAr: 'اختيار التصميم التجريبي أو شبه التجريبي أو الارتباطي وتبرير استخدامه وضبط مهددات الصدق.',
    descriptionEn: 'Choose research methodology, groups count, and validate internal validity threats.',
    requiredInputs: ['studyDesign'],
    associatedTool: 'wizard'
  },
  {
    id: 'populationSample',
    titleAr: '9. المجتمع وحساب العينة',
    titleEn: 'Population & Sample Size',
    descriptionAr: 'تحديد المجتمع وإجراء حسابات القوة وحجم العينة المطلوب إحصائياً وتأثير الفقد والانسحاب.',
    descriptionEn: 'Calculate statistical sample sizes, alpha, power, and expected attrition.',
    requiredInputs: ['sampleSettings'],
    associatedTool: 'sampleCalc'
  },
  {
    id: 'measurementInstruments',
    titleAr: '10. أدوات القياس والتحقق',
    titleEn: 'Measurement Instruments',
    descriptionAr: 'توثيق مقاييس الدراسة والتحقق من صدقها وثباتها وطريقة تصحيح الدرجات وإجراءات القياس.',
    descriptionEn: 'Document measurement instruments, validity, and reliability coefficients.',
    requiredInputs: ['instruments'],
    associatedTool: 'wizard'
  },
  {
    id: 'analysisPlan',
    titleAr: '11. خطة التحليل الإحصائي',
    titleEn: 'Statistical Analysis Plan',
    descriptionAr: 'تحديد الاختبارات الإحصائية المناسبة لكل سؤال أو فرض والافتراضات المسبقة والبيانات المفقودة.',
    descriptionEn: 'Plan statistical testing models, regression assumptions, and missing data logic.',
    requiredInputs: ['analysisPlan'],
    associatedTool: 'wizard'
  },
  {
    id: 'literatureEvidence',
    titleAr: '12. الأدلة من الدراسات السابقة',
    titleEn: 'Literature Evidence',
    descriptionAr: 'جمع ومقارنة أحجام الأثر للدراسات المشابهة وتحديد تقدير مسبق (Literature Prior) للمحاكاة.',
    descriptionEn: 'Synthesize effect sizes from prior publications and define literature prior parameters.',
    requiredInputs: ['literature'],
    associatedTool: 'litSynthesizer'
  },
  {
    id: 'simulation',
    titleAr: '13. محاكاة مونت كارلو المسبقة',
    titleEn: 'Monte Carlo Simulation',
    descriptionAr: 'تشغيل محاكاة مونت كارلو وتوليد درجات الطلاب الافتراضية للتحقق من شكل التوزيع ومستوى القوة.',
    descriptionEn: 'Run Monte Carlo simulation to generate synthetic outcome scores.',
    requiredInputs: ['simulation'],
    associatedTool: 'simulation'
  },
  {
    id: 'prediction',
    titleAr: '14. التنبؤ الاحتمالي الذكي بالنتائج',
    titleEn: 'Bayesian Outcome Prediction',
    descriptionAr: 'تشغيل محرك التنبؤ لحساب احتمال دعم الفرض ونسب النجاح والفاقد بالاعتماد على الأدبيات أو Pilot.',
    descriptionEn: 'Execute outcome forecasts incorporating literature priors or pilot bayesian updates.',
    requiredInputs: ['prediction'],
    associatedTool: 'outcomePredictor'
  },
  {
    id: 'consistencyValidation',
    titleAr: '15. مدقق الاتساق العلمي للمنهجية',
    titleEn: 'Consistency Validation',
    descriptionAr: 'تشغيل أداة التحقق الشاملة للتأكد من خلو خطة الدراسة من أي تعارضات أو أخطاء منهجية.',
    descriptionEn: 'Run the consistency checker to audit the alignment of title, questions, and tests.',
    requiredInputs: ['consistency'],
    associatedTool: 'consistency'
  },
  {
    id: 'ethicsFeasibility',
    titleAr: '16. الأخلاقيات والجدوى والتمويل',
    titleEn: 'Ethics & Feasibility',
    descriptionAr: 'تحديد إجراءات سرية البيانات والموافقات والجدول الزمني لتطبيق التدخل وإجراءات التخفيف.',
    descriptionEn: 'Document ethics approvals, timeline, and mitigation strategies for feasibility.',
    requiredInputs: ['ethics'],
    associatedTool: 'wizard'
  },
  {
    id: 'preRegistration',
    titleAr: '17. التسجيل المسبق وقفل التصميم',
    titleEn: 'Pre-Registration Lock',
    descriptionAr: 'حساب البصمة الرقمية للخطة وقفل تصميم الدراسة لحماية النزاهة العلمية ومنع الصيد المنهجي.',
    descriptionEn: 'Calculate plan hash and freeze study design before field execution.',
    requiredInputs: ['preRegistration'],
    associatedTool: 'preReg'
  },
  {
    id: 'finalResearchPlan',
    titleAr: '18. المخرجات والتقرير النهائي',
    titleEn: 'Final Blueprint & Outputs',
    descriptionAr: 'استعراض وتصدير وطباعة خطة البحث المكتملة بأبعاد A4 وتصديرها بصيغ متعددة.',
    descriptionEn: 'Review, preview, and export the finalized academic research blueprint.',
    requiredInputs: [],
    associatedTool: null
  }
];
