import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardList, Save } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { ROUTES } from '../router/routes';
import { Alert, Button, Card, EmptyState, PathPanel, Textarea } from '../design-system';
import type { EffectSizeMetric, HypothesisAnalysisPlan, StatisticalTest } from '../types/research';

type SaveStatus = { type: 'success' | 'error'; message: string } | null;

const tests: Array<{ value: StatisticalTest; ar: string; en: string }> = [
  { value: 'ancova', ar: 'تحليل التباين المصاحب ANCOVA', en: 'Analysis of Covariance (ANCOVA)' },
  { value: 'independent_t_test', ar: 'اختبار ت للمجموعات المستقلة', en: 'Independent-samples t-test' },
  { value: 'paired_t_test', ar: 'اختبار ت للعينات المرتبطة', en: 'Paired-samples t-test' },
  { value: 'one_way_anova', ar: 'تحليل التباين أحادي الاتجاه', en: 'One-way ANOVA' },
  { value: 'chi_square', ar: 'كاي تربيع', en: 'Chi-square' },
  { value: 'pearson_correlation', ar: 'ارتباط بيرسون', en: 'Pearson correlation' },
  { value: 'linear_regression', ar: 'انحدار خطي', en: 'Linear regression' },
  { value: 'mann_whitney_u', ar: 'مان-ويتني', en: 'Mann-Whitney U' },
  { value: 'wilcoxon', ar: 'ويلكوكسون', en: 'Wilcoxon signed-rank' },
  { value: 'thematic_analysis', ar: 'تحليل موضوعي', en: 'Thematic analysis' },
  { value: 'other', ar: 'اختبار آخر موثق في الملاحظات', en: 'Other documented test' }
];

const effectSizes: Array<{ value: EffectSizeMetric; ar: string; en: string }> = [
  { value: 'cohens_d', ar: "Cohen's d", en: "Cohen's d" },
  { value: 'eta_squared', ar: 'مربع إيتا', en: 'Eta squared' },
  { value: 'partial_eta_squared', ar: 'مربع إيتا الجزئي', en: 'Partial eta squared' },
  { value: 'r', ar: 'معامل الارتباط r', en: 'Correlation coefficient r' },
  { value: 'odds_ratio', ar: 'نسبة الأرجحية', en: 'Odds ratio' },
  { value: 'none', ar: 'غير منطبق مع تبرير في الملاحظات', en: 'Not applicable with justification' },
  { value: 'other', ar: 'مقياس أثر آخر', en: 'Other effect-size metric' }
];

const recommendedTest = (studyDesign: string): StatisticalTest => {
  if (studyDesign === 'experimental_rct' || studyDesign === 'quasi_experimental_pre_post') return 'ancova';
  if (studyDesign === 'single_group_pre_post') return 'paired_t_test';
  if (studyDesign === 'correlational') return 'pearson_correlation';
  if (studyDesign === 'predictive') return 'linear_regression';
  if (studyDesign === 'qualitative_case_study') return 'thematic_analysis';
  return 'independent_t_test';
};

const blankPlan = (hypothesisId: string, studyDesign: string): HypothesisAnalysisPlan => ({
  hypothesisId,
  statisticalTest: recommendedTest(studyDesign),
  assumptionsPlan: '',
  effectSizeMetric: 'cohens_d',
  notes: ''
});

export const AnalysisPlan: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, updateProject, language } = useProject();
  const [plans, setPlans] = useState<HypothesisAnalysisPlan[]>([]);
  const [status, setStatus] = useState<SaveStatus>(null);

  useEffect(() => {
    setPlans(activeProject?.hypothesisAnalysisPlans || []);
    setStatus(null);
  }, [activeProject?.id, activeProject?.version, activeProject?.hypothesisAnalysisPlans]);

  if (!activeProject) {
    return <EmptyState illustration={<BarChart3 size={40} />} title={language === 'ar' ? 'لا يوجد مشروع نشط' : 'No Active Project'} description={language === 'ar' ? 'اختر مشروعًا نشطًا لتوثيق خطة التحليل.' : 'Select an active project to document an analysis plan.'} actionButton={<Button type="button" variant="primary" size="sm" onClick={() => navigate(ROUTES.PATHS)}>{language === 'ar' ? 'اختيار مسار البحث' : 'Choose a research path'}</Button>} />;
  }

  const getPlan = (hypothesisId: string) => plans.find(plan => plan.hypothesisId === hypothesisId) || blankPlan(hypothesisId, activeProject.studyDesign);
  const updatePlan = (hypothesisId: string, patch: Partial<HypothesisAnalysisPlan>) => {
    setPlans(current => {
      const existing = current.find(plan => plan.hypothesisId === hypothesisId);
      const updated = { ...(existing || blankPlan(hypothesisId, activeProject.studyDesign)), ...patch };
      return existing ? current.map(plan => plan.hypothesisId === hypothesisId ? updated : plan) : [...current, updated];
    });
  };

  const handleSave = () => {
    for (const hypothesis of activeProject.hypotheses) {
      const plan = plans.find(item => item.hypothesisId === hypothesis.id);
      if (!plan || plan.assumptionsPlan.trim().length < 10) {
        setStatus({ type: 'error', message: language === 'ar' ? `وثّق فحوص افتراضات الاختبار للفرض «${hypothesis.textAr.slice(0, 55)}…».` : `Document the test assumptions for hypothesis “${hypothesis.textEn.slice(0, 55)}…”.` });
        return;
      }
    }
    updateProject({ ...activeProject, hypothesisAnalysisPlans: plans.filter(plan => activeProject.hypotheses.some(hypothesis => hypothesis.id === plan.hypothesisId)) });
    setStatus({ type: 'success', message: language === 'ar' ? 'تم حفظ خريطة الاختبارات وخطة فحص افتراضاتها.' : 'Test mapping and assumption checks were saved.' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PathPanel accent="var(--ds-path-data)">
        <div className="flex items-start gap-3"><span className="h-10 w-10 shrink-0 rounded-lg border border-[var(--ds-primary)]/20 bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] flex items-center justify-center"><BarChart3 size={20} /></span><div><h3 className="m-0 text-xl font-black text-ink">{language === 'ar' ? 'خطة التحليل الإحصائي' : 'Statistical Analysis Plan'}</h3><p className="m-0 mt-1 text-sm text-secondary">{language === 'ar' ? 'اربط كل فرض باختبار محدد، وفحوص افتراضاته، ومقياس حجم الأثر الذي ستبلّغ عنه.' : 'Map each hypothesis to a test, its assumption checks, and the effect-size metric you will report.'}</p></div></div>
      </PathPanel>
      {status && <Alert variant={status.type === 'success' ? 'success' : 'danger'}>{status.message}</Alert>}
      {activeProject.hypotheses.length === 0 ? <EmptyState illustration={<ClipboardList size={40} />} title={language === 'ar' ? 'لا توجد فروض قابلة للتخطيط' : 'No hypotheses to plan'} description={language === 'ar' ? 'أضف فرضاً واحداً على الأقل لتوثيق تحليله.' : 'Add at least one hypothesis to document its analysis.'} actionButton={<Button type="button" variant="primary" size="sm" onClick={() => navigate(ROUTES.NEW_STUDY_DESIGN.replaceAll(':projectId', activeProject.id))}>{language === 'ar' ? 'إدارة الفروض' : 'Manage Hypotheses'}</Button>} /> : activeProject.hypotheses.map(hypothesis => {
        const plan = getPlan(hypothesis.id);
        return <Card key={hypothesis.id} padding="lg" className="space-y-5"><div><h3 className="m-0 text-base font-black text-[var(--ds-text-primary)]">{language === 'ar' ? hypothesis.textAr : hypothesis.textEn}</h3><p className="m-0 mt-1 text-xs text-[var(--ds-text-secondary)]">{language === 'ar' ? 'توصية أولية قابلة للتعديل، لا قرار منهجي تلقائي.' : 'An editable starting recommendation, not an automatic methodological decision.'}</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="block text-xs font-bold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'الاختبار الأساسي' : 'Primary test'}<select value={plan.statisticalTest} onChange={event => updatePlan(hypothesis.id, { statisticalTest: event.target.value as StatisticalTest })} className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]">{tests.map(test => <option key={test.value} value={test.value}>{language === 'ar' ? test.ar : test.en}</option>)}</select></label><label className="block text-xs font-bold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'مقياس حجم الأثر' : 'Effect-size metric'}<select value={plan.effectSizeMetric} onChange={event => updatePlan(hypothesis.id, { effectSizeMetric: event.target.value as EffectSizeMetric })} className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]">{effectSizes.map(metric => <option key={metric.value} value={metric.value}>{language === 'ar' ? metric.ar : metric.en}</option>)}</select></label></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Textarea label={language === 'ar' ? 'فحوص الافتراضات وخطة التعامل مع الانتهاك' : 'Assumption checks and handling violations'} value={plan.assumptionsPlan} onChange={event => updatePlan(hypothesis.id, { assumptionsPlan: event.target.value })} rows={4} /><Textarea label={language === 'ar' ? 'ملاحظات أو تحليل بديل' : 'Notes or alternative analysis'} value={plan.notes || ''} onChange={event => updatePlan(hypothesis.id, { notes: event.target.value })} rows={4} /></div></Card>;
      })}
      {activeProject.hypotheses.length > 0 && <div className="flex justify-end"><Button type="button" variant="primary" size="md" onClick={handleSave} iconBefore={<Save size={16} />}>{language === 'ar' ? 'حفظ خطة التحليل' : 'Save Analysis Plan'}</Button></div>}
    </div>
  );
};

export default AnalysisPlan;