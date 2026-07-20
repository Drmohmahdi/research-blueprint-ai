import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Ruler, Save } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { VIEW_TO_PATH } from '../router/routes';
import { Alert, Button, Card, EmptyState, Textarea } from '../design-system';
import type { MeasurementInstrument, MeasurementInstrumentKind, ReliabilityMethod } from '../types/research';

type SaveStatus = { type: 'success' | 'error'; message: string } | null;

const kinds: Array<{ value: MeasurementInstrumentKind; ar: string; en: string }> = [
  { value: 'test', ar: 'اختبار', en: 'Test' },
  { value: 'scale', ar: 'مقياس', en: 'Scale' },
  { value: 'observation', ar: 'بطاقة ملاحظة', en: 'Observation' },
  { value: 'rubric', ar: 'سلم تقدير', en: 'Rubric' },
  { value: 'record', ar: 'سجل / بيانات إدارية', en: 'Record' },
  { value: 'other', ar: 'أخرى', en: 'Other' }
];

const reliabilityMethods: Array<{ value: ReliabilityMethod; ar: string; en: string }> = [
  { value: 'cronbach_alpha', ar: 'ألفا كرونباخ', en: "Cronbach's alpha" },
  { value: 'test_retest', ar: 'إعادة الاختبار', en: 'Test-retest' },
  { value: 'inter_rater', ar: 'اتفاق المقيمين', en: 'Inter-rater agreement' },
  { value: 'internal_consistency', ar: 'اتساق داخلي آخر', en: 'Other internal consistency' },
  { value: 'not_applicable', ar: 'غير منطبق مع تبرير في الخطة', en: 'Not applicable with justification' }
];

const blankInstrument = (variableId: string): MeasurementInstrument => ({
  variableId,
  name: '',
  kind: 'scale',
  scoringPlan: '',
  validityPlan: '',
  reliabilityMethod: 'cronbach_alpha'
});

export const MeasurementInstruments: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, updateProject, language } = useProject();
  const [instruments, setInstruments] = useState<MeasurementInstrument[]>([]);
  const [status, setStatus] = useState<SaveStatus>(null);

  const dependentVariables = activeProject?.variables.filter(variable => variable.type === 'dependent') || [];

  useEffect(() => {
    setInstruments(activeProject?.measurementInstruments || []);
    setStatus(null);
  }, [activeProject?.id, activeProject?.version]);

  if (!activeProject) {
    return (
      <EmptyState
        illustration={<Ruler size={40} />}
        title={language === 'ar' ? 'لا يوجد مشروع نشط' : 'No Active Project'}
        description={language === 'ar' ? 'اختر مشروعاً نشطاً لتوثيق أدوات القياس.' : 'Select an active project to document measurement instruments.'}
        actionButton={<Button type="button" variant="primary" size="sm" onClick={() => navigate(VIEW_TO_PATH.wizard)}>{language === 'ar' ? 'فتح معالج البحث' : 'Open Research Wizard'}</Button>}
      />
    );
  }

  const getInstrument = (variableId: string) => instruments.find(instrument => instrument.variableId === variableId) || blankInstrument(variableId);

  const updateInstrument = (variableId: string, patch: Partial<MeasurementInstrument>) => {
    setInstruments(current => {
      const existing = current.find(instrument => instrument.variableId === variableId);
      const updated = { ...(existing || blankInstrument(variableId)), ...patch };
      return existing
        ? current.map(instrument => instrument.variableId === variableId ? updated : instrument)
        : [...current, updated];
    });
  };

  const handleSave = () => {
    for (const variable of dependentVariables) {
      const instrument = instruments.find(item => item.variableId === variable.id);
      if (!instrument || instrument.name.trim().length < 3 || instrument.scoringPlan.trim().length < 3 || instrument.validityPlan.trim().length < 3) {
        setStatus({ type: 'error', message: language === 'ar' ? `أكمل اسم الأداة وخطة التصحيح والصدق لمتغير «${variable.nameAr}».` : `Complete the instrument name, scoring, and validity plan for “${variable.nameEn}”.` });
        return;
      }
      if (instrument.reliabilityMethod === 'cronbach_alpha' && instrument.reliabilityValue !== undefined && (!Number.isFinite(instrument.reliabilityValue) || instrument.reliabilityValue < 0 || instrument.reliabilityValue > 1)) {
        setStatus({ type: 'error', message: language === 'ar' ? 'يجب أن تكون قيمة ألفا كرونباخ بين 0 و1.' : "Cronbach's alpha must be between 0 and 1." });
        return;
      }
    }

    updateProject({
      ...activeProject,
      measurementInstruments: instruments.filter(instrument => activeProject.variables.some(variable => variable.id === instrument.variableId))
    });
    setStatus({ type: 'success', message: language === 'ar' ? 'تم حفظ خطة أدوات القياس. قيم الثبات هنا توثيقية ولا تعد نتيجة محققة إلا بعد تنفيذ الاختبار.' : 'Measurement plans saved. Reliability values are documentary and not achieved results until testing is performed.' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card padding="lg" className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 shrink-0 rounded-lg border border-[var(--ds-primary)]/20 bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] flex items-center justify-center"><Ruler size={20} /></span>
          <div>
            <h3 className="m-0 text-xl font-black text-[var(--ds-text-primary)]">{language === 'ar' ? 'أدوات القياس والصدق والثبات' : 'Measurement, Validity, and Reliability'}</h3>
            <p className="m-0 mt-1 text-sm text-[var(--ds-text-secondary)]">{language === 'ar' ? 'وثّق خطة الأداة لكل متغير تابع قبل جمع البيانات والتسجيل المسبق.' : 'Document an instrument plan for each dependent variable before data collection and preregistration.'}</p>
          </div>
        </div>
      </Card>

      {status && <Alert variant={status.type === 'success' ? 'success' : 'danger'}>{status.message}</Alert>}

      {dependentVariables.length === 0 ? (
        <EmptyState
          illustration={<ClipboardCheck size={40} />}
          title={language === 'ar' ? 'لا توجد متغيرات تابعة' : 'No dependent variables'}
          description={language === 'ar' ? 'عرّف متغيراً تابعاً أولاً حتى يمكن توثيق أداة قياسه.' : 'Define a dependent variable first, then document its instrument.'}
          actionButton={<Button type="button" variant="primary" size="sm" onClick={() => navigate(VIEW_TO_PATH.wizard)}>{language === 'ar' ? 'إدارة المتغيرات' : 'Manage Variables'}</Button>}
        />
      ) : dependentVariables.map(variable => {
        const instrument = getInstrument(variable.id);
        return (
          <Card key={variable.id} padding="lg" className="space-y-5">
            <div>
              <h3 className="m-0 text-base font-black text-[var(--ds-text-primary)]">{language === 'ar' ? variable.nameAr : variable.nameEn}</h3>
              <p className="m-0 mt-1 text-xs text-[var(--ds-text-secondary)]">{language === 'ar' ? `متغير تابع · ${variable.scale}` : `Dependent variable · ${variable.scale}`}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block text-xs font-bold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'اسم الأداة' : 'Instrument name'}<input value={instrument.name} onChange={event => updateInstrument(variable.id, { name: event.target.value })} className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)]" /></label>
              <label className="block text-xs font-bold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'نوع الأداة' : 'Instrument type'}<select value={instrument.kind} onChange={event => updateInstrument(variable.id, { kind: event.target.value as MeasurementInstrumentKind })} className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)]">{kinds.map(kind => <option key={kind.value} value={kind.value}>{language === 'ar' ? kind.ar : kind.en}</option>)}</select></label>
              <label className="block text-xs font-bold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'عدد البنود (اختياري)' : 'Item count (optional)'}<input type="number" min="1" value={instrument.itemCount ?? ''} onChange={event => updateInstrument(variable.id, { itemCount: event.target.value === '' ? undefined : event.target.valueAsNumber })} className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)]" /></label>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Textarea label={language === 'ar' ? 'خطة التصحيح وتفسير الدرجات' : 'Scoring and interpretation plan'} value={instrument.scoringPlan} onChange={event => updateInstrument(variable.id, { scoringPlan: event.target.value })} rows={4} />
              <Textarea label={language === 'ar' ? 'خطة الصدق والتحكيم' : 'Validity and review plan'} value={instrument.validityPlan} onChange={event => updateInstrument(variable.id, { validityPlan: event.target.value })} rows={4} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-xs font-bold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'خطة الثبات' : 'Reliability plan'}<select value={instrument.reliabilityMethod} onChange={event => updateInstrument(variable.id, { reliabilityMethod: event.target.value as ReliabilityMethod, reliabilityValue: event.target.value === 'cronbach_alpha' ? instrument.reliabilityValue : undefined })} className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)]">{reliabilityMethods.map(method => <option key={method.value} value={method.value}>{language === 'ar' ? method.ar : method.en}</option>)}</select></label>
              {instrument.reliabilityMethod === 'cronbach_alpha' && <label className="block text-xs font-bold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'قيمة ألفا كرونباخ (اختيارية)' : "Cronbach's alpha (optional)"}<input type="number" min="0" max="1" step="0.01" value={instrument.reliabilityValue ?? ''} onChange={event => updateInstrument(variable.id, { reliabilityValue: event.target.value === '' ? undefined : event.target.valueAsNumber })} className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)]" /></label>}
            </div>
          </Card>
        );
      })}

      {dependentVariables.length > 0 && <div className="flex justify-end"><Button type="button" variant="primary" size="md" onClick={handleSave} iconBefore={<Save size={16} />}>{language === 'ar' ? 'حفظ خطة القياس' : 'Save Measurement Plan'}</Button></div>}
    </div>
  );
};

export default MeasurementInstruments;