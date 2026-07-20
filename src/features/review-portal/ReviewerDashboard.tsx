import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { 
  CheckCircle2, 
  Send, 
  AlertTriangle, 
  Award, 
  FileText, 
  ListChecks, 
  Settings2, 
  Sparkles
} from 'lucide-react';

interface ReviewCriterion {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  weight: number;
}

const CRITERIA: ReviewCriterion[] = [
  {
    id: 'methodology',
    nameAr: 'المنهجية العلمية وتصميم الدراسة',
    nameEn: 'Scientific Methodology & Design',
    descAr: 'مدى سلامة تصميم البحث واتساق المنهج المختار مع الأهداف والفروض.',
    descEn: 'Soundness of study design and alignment of methodology with hypotheses.',
    weight: 0.30,
  },
  {
    id: 'statistics',
    nameAr: 'التحليل الإحصائي والعينة',
    nameEn: 'Statistical Analysis & Sample',
    descAr: 'كفاية حجم العينة إحصائياً وملاءمة الاختبارات الإحصائية المفترضة.',
    descEn: 'Statistical power of the sample and appropriateness of planned tests.',
    weight: 0.25,
  },
  {
    id: 'literature',
    nameAr: 'التأصيل النظري والدراسات السابقة',
    nameEn: 'Literature Review & Theoretical Base',
    descAr: 'كفاية مراجعة الدراسات السابقة وتحديد الفجوة البحثية بوضوح.',
    descEn: 'Adequacy of prior literature synthesis and clarity of the research gap.',
    weight: 0.20,
  },
  {
    id: 'ethics',
    nameAr: 'الأخلاقيات والنزاهة الأكاديمية',
    nameEn: 'Ethics & Academic Integrity',
    descAr: 'الالتزام بضوابط التسجيل المسبق وحماية البيانات والموافقة المستنيرة.',
    descEn: 'Adherence to pre-registration protocols, data protection, and consent.',
    weight: 0.15,
  },
  {
    id: 'originality',
    nameAr: 'الأصالة والإضافة المعرفية',
    nameEn: 'Originality & Contribution',
    descAr: 'مدى أصالة الفكرة البحثية والقيمة المضافة للمعرفة العلمية.',
    descEn: 'Novelty of the research question and expected contribution to science.',
    weight: 0.10,
  },
];

const MOCK_ITEMS: Record<string, { ar: string; en: string }[]> = {
  'v-2': [
    { ar: 'يستطيع الطالب تحديد الافتراضات الضمنية في النصوص المقروءة.', en: 'The student can identify implicit assumptions in read texts.' },
    { ar: 'يميز الطالب بين الاستنتاجات المنطقية وغير المنطقية للمسألة.', en: 'The student distinguishes between logical and illogical conclusions of the problem.' },
    { ar: 'يقيم الطالب مدى قوة الحجج والأدلة المؤيدة والمعارضة للظاهرة.', en: 'The student evaluates the strength of arguments supporting and opposing the phenomenon.' }
  ],
  'v-3': [
    { ar: 'يجيب الطالب عن الأسئلة التحصيلية للمقرر بدقة وسرعة.', en: 'The student answers the achievement questions of the course accurately and quickly.' },
    { ar: 'يطبق الطالب المهارات العملية المكتسبة في حل مواقف مشكلة جديدة.', en: 'Applies practical skills learned in solving new problem situations.' },
    { ar: 'يسترجع الطالب المفاهيم الأساسية للمادة العلمية بشكل صحيح.', en: 'Recalls the basic concepts of the scientific material correctly.' }
  ],
  'v-4': [
    { ar: 'يشعر الطالب بالمتعة والرغبة أثناء دراسة المحتوى التعليمي.', en: 'The student feels enjoyment and desire while studying the educational content.' },
    { ar: 'يبادر الطالب بالمشاركة الفعالة في الأنشطة والتدريبات الصفية.', en: 'The student initiates active participation in classroom activities and exercises.' },
    { ar: 'يسعى الفرد لتجاوز الصعاب الأكاديمية لتحقيق التفوق الدراسي.', en: 'The individual seeks to overcome academic difficulties to achieve academic excellence.' }
  ]
};

const getMockItemsForVariable = (varId: string, nameAr: string, nameEn: string) => {
  if (MOCK_ITEMS[varId]) return MOCK_ITEMS[varId];
  return [
    { ar: `يقيس هذا البند الدرجة الخاصة بـ ${nameAr} لدى أفراد العينة.`, en: `This item measures the degree of ${nameEn} among sample members.` },
    { ar: `يظهر الفرد سلوكاً يعكس مستويات عالية من ${nameAr} في الميدان.`, en: `The individual shows behavior reflecting high levels of ${nameEn} in the field.` }
  ];
};

export const ReviewerDashboard: React.FC = () => {
  const { activeProject, language } = useProject();
  const [activeTab, setActiveTab] = useState<'proposal' | 'instrument'>('proposal');
  
  const [scores, setScores] = useState<Record<string, number>>({
    methodology: 8,
    statistics: 7,
    literature: 8,
    ethics: 9,
    originality: 8,
  });

  const [comments, setComments] = useState<Record<string, string>>({
    methodology: '',
    statistics: '',
    literature: '',
    ethics: '',
    originality: '',
  });

  const [toolRatings, setToolRatings] = useState<Record<string, {
    alignment: 'appropriate' | 'needs_modification' | 'inappropriate';
    clarity: 'clear' | 'unclear';
    amendment: string;
  }>>({});

  const [overallDecision, setOverallDecision] = useState<'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT'>('MINOR_REVISION');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewerName, setReviewerName] = useState('');

  // ── Prepopulate tool ratings when project loads ───────────────────────────
  useEffect(() => {
    if (!activeProject) return;
    const initialRatings: Record<string, {
      alignment: 'appropriate' | 'needs_modification' | 'inappropriate';
      clarity: 'clear' | 'unclear';
      amendment: string;
    }> = {};

    activeProject.variables
      .filter(v => v.scale === 'interval' || v.scale === 'ratio')
      .forEach(v => {
        const items = getMockItemsForVariable(v.id, v.nameAr, v.nameEn);
        items.forEach((_, idx) => {
          initialRatings[`${v.id}-item-${idx}`] = {
            alignment: 'appropriate',
            clarity: 'clear',
            amendment: ''
          };
        });
      });

    setToolRatings(initialRatings);
  }, [activeProject]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--ds-text-muted)] text-sm">
        {language === 'ar' ? 'يرجى اختيار مشروع بحثي لعرض لوحة التحكيم' : 'Please select a research project to show the peer review dashboard'}
      </div>
    );
  }

  const handleScoreChange = (criterionId: string, val: number) => {
    setScores(prev => ({ ...prev, [criterionId]: val }));
  };

  const handleCommentChange = (criterionId: string, val: string) => {
    setComments(prev => ({ ...prev, [criterionId]: val }));
  };

  const handleToolRatingChange = (key: string, field: 'alignment' | 'clarity' | 'amendment', val: string) => {
    setToolRatings(prev => ({
      ...prev,
      [key]: {
        ...prev[key] || { alignment: 'appropriate', clarity: 'clear', amendment: '' },
        [field]: val as any
      }
    }));
  };

  // Weighted average score
  const totalWeightedScore = Object.entries(scores).reduce((acc, [id, val]) => {
    const criterion = CRITERIA.find(c => c.id === id);
    return acc + val * (criterion?.weight || 0) * 10;
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitted(true);
  };

  const isAr = language === 'ar';

  const decisions = [
    { value: 'ACCEPT', labelAr: 'قبول البحث للنشر دون تعديل', labelEn: 'Accept without Revisions', color: 'text-emerald-500' },
    { value: 'MINOR_REVISION', labelAr: 'قبول مشروط بتعديلات طفيفة', labelEn: 'Accept with Minor Revisions', color: 'text-blue-500' },
    { value: 'MAJOR_REVISION', labelAr: 'تعديلات جوهرية وإعادة تحكيم', labelEn: 'Major Revisions Required', color: 'text-amber-500' },
    { value: 'REJECT', labelAr: 'رفض البحث بالكامل', labelEn: 'Reject manuscript', color: 'text-rose-500' },
  ];

  // Tool referee calculation summary
  const ratedItemsCount = Object.keys(toolRatings).length;
  const appropriateCount = Object.values(toolRatings).filter(
    r => r.alignment === 'appropriate' && r.clarity === 'clear'
  ).length;
  const needsModCount = Object.values(toolRatings).filter(
    r => r.alignment === 'needs_modification' || r.clarity === 'unclear'
  ).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/30 via-violet-900/15 to-transparent border border-purple-500/15 rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-purple-600/10">
            <Award size={22} className="text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--ds-text-primary)] m-0">
              {isAr ? 'بوابة التحكيم العلمي وتحكيم أدوات الدراسة' : 'Scientific Peer Review & Instruments Refereeing'}
            </h2>
            <p className="text-xs text-[var(--ds-text-secondary)] m-0">
              {isAr ? 'تحكيم المخططات المنهجية وتقييم عبارات الاستبانات والمقاييس للباحثين إلكترونياً.' : 'Double-blind refereeing for research blueprints and questionnaire statements.'}
            </p>
          </div>
        </div>
      </div>

      {reviewSubmitted ? (
        <Card className="p-8 text-center space-y-6 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-3xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-extrabold text-[var(--ds-text-primary)]">
              {isAr ? 'تم إرسال واعتماد تقرير التحكيم بنجاح' : 'Peer Review Report Certified Successfully'}
            </h3>
            <p className="text-xs text-[var(--ds-text-muted)] max-w-md mx-auto leading-relaxed">
              {isAr
                ? 'شكراً لمساهمتك العلمية. تم قفل التقرير وتوقيعه رقمياً وإرساله للباحث لتعديل المخطط وبنود الاستبانة وفق مرئياتكم.'
                : 'Thank you for your valuable contribution. The referee report is locked and sent to the investigator for amendments.'}
            </p>
          </div>

          <div className="p-5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl max-w-lg mx-auto text-right space-y-3.5">
            <h4 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 mb-2">
              {isAr ? 'ملخص التقرير المعتمد:' : 'Review Summary:'}
            </h4>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-[var(--ds-text-secondary)]">{isAr ? 'الدرجة الكلية الممنوحة للمخطط:' : 'Overall Rating:'}</span>
              <span className="text-purple-500">{totalWeightedScore.toFixed(1)} / 100</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-[var(--ds-text-secondary)]">{isAr ? 'قرار المحكّم:' : 'Referee Decision:'}</span>
              <span className={decisions.find(d => d.value === overallDecision)?.color}>
                {isAr ? decisions.find(d => d.value === overallDecision)?.labelAr : decisions.find(d => d.value === overallDecision)?.labelEn}
              </span>
            </div>
            
            {ratedItemsCount > 0 && (
              <div className="pt-2 border-t border-[var(--ds-border-subtle)] space-y-1">
                <div className="flex justify-between text-xs font-bold text-[var(--ds-text-secondary)]">
                  <span>{isAr ? 'بنود الأدوات المحكّمة:' : 'Referee Instruments Items:'}</span>
                  <span className="text-[var(--ds-text-primary)]">{ratedItemsCount} {isAr ? 'بنداً' : 'items'}</span>
                </div>
                <div className="flex justify-between text-[11px] font-medium text-emerald-600">
                  <span>{isAr ? '← بنود مقبولة دون تعديل:' : '← Accepted without edits:'}</span>
                  <span>{appropriateCount} ({Math.round((appropriateCount / ratedItemsCount) * 100)}%)</span>
                </div>
                <div className="flex justify-between text-[11px] font-medium text-amber-500">
                  <span>{isAr ? '← بنود تحتاج تعديل/غير ملائمة:' : '← Needs edits/inappropriate:'}</span>
                  <span>{needsModCount} ({Math.round((needsModCount / ratedItemsCount) * 100)}%)</span>
                </div>
              </div>
            )}
            
            {reviewerName && (
              <div className="flex justify-between text-xs font-bold pt-2 border-t border-[var(--ds-border-subtle)]">
                <span className="text-[var(--ds-text-secondary)]">{isAr ? 'المحكّم المعتمد للمشروع:' : 'Certified Referee:'}</span>
                <span className="text-[var(--ds-text-primary)]">{reviewerName}</span>
              </div>
            )}
          </div>

          <Button onClick={() => setReviewSubmitted(false)} variant="secondary" className="font-bold text-xs rounded-xl">
            {isAr ? 'تعديل أو كتابة تقرير جديد' : 'Edit or Write New Report'}
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Metadata Card */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-[var(--ds-text-primary)] pb-2 border-b border-[var(--ds-border-subtle)] m-0">
              {isAr ? 'بيانات البحث الخاضع للتحكيم' : 'Manuscript details'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
              <div>
                <span className="text-[var(--ds-text-muted)] font-bold">{isAr ? 'عنوان البحث (بالعربية):' : 'Title (AR):'}</span>
                <p className="text-[var(--ds-text-primary)] font-extrabold m-0 mt-1">{activeProject.titleAr || '—'}</p>
              </div>
              <div>
                <span className="text-[var(--ds-text-muted)] font-bold">{isAr ? 'عنوان البحث (بالإنجليزية):' : 'Title (EN):'}</span>
                <p className="text-[var(--ds-text-primary)] font-extrabold m-0 mt-1">{activeProject.titleEn || '—'}</p>
              </div>
              <div>
                <span className="text-[var(--ds-text-muted)] font-bold">{isAr ? 'منهج وتصميم الدراسة:' : 'Study Design:'}</span>
                <p className="text-[var(--ds-text-primary)] font-extrabold m-0 mt-1 uppercase">{activeProject.studyDesign}</p>
              </div>
              <div>
                <span className="text-[var(--ds-text-muted)] font-bold">{isAr ? 'تكامل العينات والمتغيرات:' : 'Samples & Variables:'}</span>
                <p className="text-[var(--ds-text-primary)] font-extrabold m-0 mt-1">
                  {activeProject.variables?.length || 0} {isAr ? 'متغيرات' : 'variables'} | {activeProject.hypotheses?.length || 0} {isAr ? 'فروض' : 'hypotheses'}
                </p>
              </div>
            </div>
          </Card>

          {/* Premium Tab Bar for Multi-D Refereeing */}
          <div className="flex border-b border-[var(--ds-border-subtle)]">
            <button
              type="button"
              onClick={() => setActiveTab('proposal')}
              className={`pb-3 px-6 text-xs font-black transition-all cursor-pointer border-b-2 ${
                activeTab === 'proposal'
                  ? 'border-purple-600 text-purple-500'
                  : 'border-transparent text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <FileText size={14} />
                <span>{isAr ? '1. تحكيم المخطط المنهجي العام' : '1. Scientific Proposal Review'}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('instrument')}
              className={`pb-3 px-6 text-xs font-black transition-all cursor-pointer border-b-2 ${
                activeTab === 'instrument'
                  ? 'border-purple-600 text-purple-500'
                  : 'border-transparent text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ListChecks size={14} />
                <span>{isAr ? '2. تحكيم أدوات الدراسة (الاستبانات)' : '2. Research Instruments Review'}</span>
              </div>
            </button>
          </div>

          {/* Tab 1: Proposal Review */}
          {activeTab === 'proposal' && (
            <div className="space-y-4 animate-fade-in">
              {CRITERIA.map(criterion => (
                <Card key={criterion.id} className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-[var(--ds-text-primary)] m-0">
                        {isAr ? criterion.nameAr : criterion.nameEn}
                      </h4>
                      <p className="text-[10px] text-[var(--ds-text-secondary)] m-0">
                        {isAr ? criterion.descAr : criterion.descEn}
                      </p>
                    </div>
                    {/* Score circle */}
                    <div className="h-10 w-10 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-xs font-black text-purple-600 shrink-0">
                      {scores[criterion.id] || 0} / 10
                    </div>
                  </div>

                  {/* Score slider */}
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={scores[criterion.id] || 8}
                      onChange={e => handleScoreChange(criterion.id, parseInt(e.target.value))}
                      className="w-full h-1 bg-[var(--ds-surface-secondary)] rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <div className="flex justify-between text-[9px] text-[var(--ds-text-muted)] font-bold">
                      <span>{isAr ? 'ضعيف (1)' : 'Poor (1)'}</span>
                      <span>{isAr ? 'مقبول (5)' : 'Fair (5)'}</span>
                      <span>{isAr ? 'ممتاز (10)' : 'Outstanding (10)'}</span>
                    </div>
                  </div>

                  {/* Comments text box */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ds-text-muted)]">
                      {isAr ? 'ملحوظة المحكّم والتقرير التفصيلي للمعيار:' : 'Referee qualitative notes:'}
                    </label>
                    <textarea
                      rows={2}
                      value={comments[criterion.id] || ''}
                      onChange={e => handleCommentChange(criterion.id, e.target.value)}
                      placeholder={isAr ? 'اكتب نقاط القوة والضعف والتعديلات المطلوبة...' : 'Strengths, weaknesses, and required amendments...'}
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Tab 2: Instruments/Questionnaire Refereeing */}
          {activeTab === 'instrument' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 flex gap-2 text-[10px] text-purple-700 dark:text-purple-400 leading-relaxed font-bold">
                <Sparkles size={16} className="shrink-0 text-purple-500 mt-0.5" />
                <div>
                  <p className="m-0 font-extrabold">{isAr ? 'دليل تحكيم أدوات الدراسة (Questionnaire Validation):' : 'Instruments Refereeing Guide:'}</p>
                  <p className="m-0 mt-0.5 font-normal">
                    {isAr
                      ? 'يقوم النظام بسحب المقاييس الفترية (المستخلصة من المتغيرات التابعة/الوسيطة) وتوليد بنود الاستبانة إلكترونياً. يرجى تقييم كل بند من حيث الصلاحية والوضوح وتعديل الصياغة لتقنين الأداة.'
                      : 'Rate each item on whether it aligns with its target variable dimension, is clearly stated, or requires modifications.'}
                  </p>
                </div>
              </div>

              {activeProject.variables.filter(v => v.scale === 'interval' || v.scale === 'ratio').length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[var(--ds-border-subtle)] rounded-2xl text-[var(--ds-text-muted)] text-xs font-medium">
                  {isAr ? 'لا توجد أدوات استبانة أو مقاييس فترية حالياً بمشروعك لتحكيمها.' : 'No interval scales or questionnaires available in the active project.'}
                </div>
              ) : (
                activeProject.variables
                  .filter(v => v.scale === 'interval' || v.scale === 'ratio')
                  .map(v => {
                    const items = getMockItemsForVariable(v.id, v.nameAr, v.nameEn);
                    return (
                      <div key={v.id} className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-[var(--ds-border-subtle)] pb-1">
                          <Settings2 className="text-purple-500" size={15} />
                          <h4 className="text-xs font-black text-[var(--ds-text-primary)] m-0">
                            {isAr ? `أداة قياس: ${v.nameAr}` : `Measurement Tool: ${v.nameEn}`}
                          </h4>
                          <span className="text-[9px] bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-md border border-purple-500/20 font-bold">
                            {isAr ? 'مقياس فتري' : 'Interval Scale'}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {items.map((item, idx) => {
                            const key = `${v.id}-item-${idx}`;
                            const rating = toolRatings[key] || { alignment: 'appropriate', clarity: 'clear', amendment: '' };

                            return (
                              <Card key={idx} className="p-4 space-y-4 border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
                                {/* Item Header */}
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]">
                                      {idx + 1}
                                    </span>
                                    <p className="text-xs font-bold text-[var(--ds-text-primary)] m-0">
                                      {isAr ? item.ar : item.en}
                                    </p>
                                  </div>
                                </div>

                                {/* Evaluation Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--ds-border-subtle)]">
                                  
                                  {/* Alignment Selector */}
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase block">
                                      {isAr ? 'ملاءمة البند للبعد المتغير:' : 'Alignment with Variable:'}
                                    </label>
                                    <div className="flex gap-2">
                                      {(['appropriate', 'needs_modification', 'inappropriate'] as const).map(opt => {
                                        const optLabels: Record<string, { ar: string; en: string }> = {
                                          appropriate: { ar: 'ملائم', en: 'Appropriate' },
                                          needs_modification: { ar: 'تعديل', en: 'Modify' },
                                          inappropriate: { ar: 'غير ملائم', en: 'Inappropriate' }
                                        };
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            onClick={() => handleToolRatingChange(key, 'alignment', opt)}
                                            className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black cursor-pointer border text-center transition-all ${
                                              rating.alignment === opt
                                                ? opt === 'appropriate' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                  opt === 'needs_modification' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                                  'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)] border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-primary)]'
                                            }`}
                                          >
                                            {isAr ? optLabels[opt].ar : optLabels[opt].en}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Clarity Selector */}
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase block">
                                      {isAr ? 'وضوح الصياغة اللغوية:' : 'Language Clarity:'}
                                    </label>
                                    <div className="flex gap-2">
                                      {(['clear', 'unclear'] as const).map(opt => {
                                        const optLabels: Record<string, { ar: string; en: string }> = {
                                          clear: { ar: 'واضحة', en: 'Clear' },
                                          unclear: { ar: 'غير واضحة', en: 'Unclear' }
                                        };
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            onClick={() => handleToolRatingChange(key, 'clarity', opt)}
                                            className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black cursor-pointer border text-center transition-all ${
                                              rating.clarity === opt
                                                ? opt === 'clear' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                  'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)] border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-primary)]'
                                            }`}
                                          >
                                            {isAr ? optLabels[opt].ar : optLabels[opt].en}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* Amendment Text Input */}
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-[var(--ds-text-muted)] uppercase block">
                                    {isAr ? 'التعديل اللغوي أو المنهجي المقترح للبند (اختياري):' : 'Suggested wording amendment (optional):'}
                                  </label>
                                  <input
                                    type="text"
                                    value={rating.amendment}
                                    onChange={e => handleToolRatingChange(key, 'amendment', e.target.value)}
                                    placeholder={isAr ? 'اكتب الصياغة البديلة الموصى بها...' : 'Enter recommended alternative phrasing...'}
                                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                  />
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* Overall Decision Section */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-[var(--ds-text-primary)] pb-2 border-b border-[var(--ds-border-subtle)] m-0">
              {isAr ? 'التوصية النهائية والقرار المشترك للمحكّم' : 'Final Recommendation & Overall Decision'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {decisions.map(dec => (
                <label
                  key={dec.value}
                  className={`p-3.5 border rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    overallDecision === dec.value
                      ? 'border-purple-600 bg-purple-500/5 font-extrabold'
                      : 'border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] hover:bg-[var(--ds-surface-secondary)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={dec.value}
                    checked={overallDecision === dec.value}
                    onChange={() => setOverallDecision(dec.value as any)}
                    className="accent-purple-600"
                  />
                  <div className="text-xs">
                    <p className={`font-bold m-0 ${dec.color}`}>{isAr ? dec.labelAr : dec.labelEn}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Reviewer Signature */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-[var(--ds-text-muted)]">
                  {isAr ? 'اسم المحكّم المعتمد (التحكيم المعمى يُبقي الاسم مخفياً للباحث):' : 'Referee Name (double-blind remains anonymous):'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'د. أحمد المحمادي...' : 'Dr. Jane Doe...'}
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                />
              </div>
              
              <div className="p-3.5 bg-amber-500/5 border border-amber-500/15 rounded-2xl flex gap-2 text-[10px] text-amber-600 leading-relaxed font-bold">
                <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                <div>
                  <p className="m-0 font-extrabold">{isAr ? 'إخلاء مسؤولية النشر:' : 'Blind review policy:'}</p>
                  <p className="m-0 mt-0.5 font-normal">
                    {isAr
                      ? 'للحفاظ على سرية التحكيم، لن يُعرض اسم المحكّم للباحث في صفحة جاهزية النشر ويتم الحساب تلقائياً.'
                      : 'To ensure blind peer review, the referee\'s name will not be shown to the investigator.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Submission actions */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!reviewerName.trim()}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition-colors shadow-md disabled:cursor-not-allowed"
              >
                <Send size={13} />
                <span>{isAr ? 'اعتماد التقرير العلمي للتحكيم' : 'Certify Peer Review Report'}</span>
              </button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
};
