import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, CalendarDays, CheckCircle2, ClipboardList, ShieldCheck } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { ROUTES } from '../router/routes';
import { Alert, Button, Card, EmptyState, PathPanel, Textarea } from '../design-system';
import type { EthicsApprovalStatus, EthicsFeasibilityPlan } from '../types/research';

type SaveStatus = { type: 'success' | 'error'; message: string } | null;

const blankEthicsPlan: EthicsFeasibilityPlan = {
  approvalStatus: 'planned',
  consentPlan: '',
  privacyPlan: '',
  riskMitigationPlan: ''
};

export const ResearchPlanning: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, updateProject, language } = useProject();
  const [objectives, setObjectives] = useState('');
  const [timeline, setTimeline] = useState('');
  const [ethics, setEthics] = useState('');
  const [ethicsPlan, setEthicsPlan] = useState<EthicsFeasibilityPlan>(blankEthicsPlan);
  const [status, setStatus] = useState<SaveStatus>(null);

  const projectId = activeProject?.id;
  const projectVersion = activeProject?.version;
  const projectObjectives = activeProject?.objectives;
  const projectTimeline = activeProject?.timeline;
  const projectEthics = activeProject?.ethics;
  const projectEthicsPlan = activeProject?.ethicsFeasibilityPlan;

  useEffect(() => {
    setObjectives(projectObjectives || '');
    setTimeline(projectTimeline || '');
    setEthics(projectEthics || '');
    setEthicsPlan(projectEthicsPlan || blankEthicsPlan);
    setStatus(null);
  }, [projectId, projectVersion, projectObjectives, projectTimeline, projectEthics, projectEthicsPlan]);

  if (!activeProject) {
    return (
      <EmptyState
        illustration={<ClipboardList size={40} />}
        title={language === 'ar' ? 'لا يوجد مشروع نشط' : 'No Active Project'}
        description={language === 'ar'
          ? 'اختر مشروعًا نشطًا لتوثيق أهدافه وخطته الزمنية واعتبارات أخلاقياته.'
          : 'Select an active project to document its objectives, timeline, and ethical considerations.'}
        actionButton={
          <Button type="button" variant="primary" size="sm" onClick={() => navigate(ROUTES.PATHS)}>
            {language === 'ar' ? 'اختيار مسار البحث' : 'Choose a research path'}
          </Button>
        }
      />
    );
  }

  const handleSave = () => {
    if (objectives.trim().length < 10) {
      setStatus({
        type: 'error',
        message: language === 'ar' ? 'اكتب أهداف الدراسة بصياغة واضحة قبل الحفظ.' : 'Write clear study objectives before saving.'
      });
      return;
    }
    if (timeline.trim().length < 10) {
      setStatus({
        type: 'error',
        message: language === 'ar' ? 'وثّق جدولاً زمنياً أو معالم تنفيذية قبل الحفظ.' : 'Document a timeline or implementation milestones before saving.'
      });
      return;
    }
    if (ethicsPlan.consentPlan.trim().length < 10 || ethicsPlan.privacyPlan.trim().length < 10 || ethicsPlan.riskMitigationPlan.trim().length < 10) {
      setStatus({
        type: 'error',
        message: language === 'ar' ? 'أكمل خطط الموافقة والخصوصية وتخفيف المخاطر قبل الحفظ.' : 'Complete consent, privacy, and risk-mitigation plans before saving.'
      });
      return;
    }

    updateProject({
      ...activeProject,
      objectives: objectives.trim(),
      timeline: timeline.trim(),
      ethics: ethics.trim(),
      ethicsFeasibilityPlan: {
        approvalStatus: ethicsPlan.approvalStatus,
        consentPlan: ethicsPlan.consentPlan.trim(),
        privacyPlan: ethicsPlan.privacyPlan.trim(),
        riskMitigationPlan: ethicsPlan.riskMitigationPlan.trim()
      }
    });
    setStatus({
      type: 'success',
      message: language === 'ar' ? 'تم حفظ خطة البحث ضمن إصدار المشروع الحالي.' : 'Research plan saved in the current project version.'
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PathPanel accent="var(--ds-path-research)">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 shrink-0 rounded-lg border border-[var(--ds-primary)]/20 bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] flex items-center justify-center">
            <ClipboardList size={20} />
          </span>
          <div>
            <h3 className="m-0 text-xl font-black text-ink">
              {language === 'ar' ? 'خطة البحث' : 'Research Plan'}
            </h3>
            <p className="m-0 mt-1 text-sm text-secondary">
              {language === 'ar'
                ? 'وثّق الأهداف والمعالم الزمنية والاعتبارات الأخلاقية قبل التسجيل المسبق والتنفيذ.'
                : 'Document objectives, milestones, and ethical considerations before preregistration and execution.'}
            </p>
          </div>
        </div>
      </PathPanel>

      {status && <Alert variant={status.type === 'success' ? 'success' : 'danger'}>{status.message}</Alert>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card padding="lg" className="space-y-5">
          <div className="flex items-center gap-2 text-[var(--ds-primary)]">
            <BookOpenCheck size={18} />
            <h3 className="m-0 text-base font-black text-[var(--ds-text-primary)]">
              {language === 'ar' ? 'أهداف الدراسة' : 'Study Objectives'}
            </h3>
          </div>
          <Textarea
            label={language === 'ar' ? 'الهدف العام والأهداف الإجرائية' : 'General and Specific Objectives'}
            value={objectives}
            onChange={(event) => setObjectives(event.target.value)}
            rows={8}
            placeholder={language === 'ar'
              ? 'مثال: قياس أثر البرنامج، ثم مقارنة الأداء بين المجموعتين...'
              : 'Example: Measure the program effect, then compare outcomes between groups...'}
          />
        </Card>

        <Card padding="lg" className="space-y-5">
          <div className="flex items-center gap-2 text-[var(--ds-primary)]">
            <CalendarDays size={18} />
            <h3 className="m-0 text-base font-black text-[var(--ds-text-primary)]">
              {language === 'ar' ? 'الجدول الزمني والمعالم' : 'Timeline and Milestones'}
            </h3>
          </div>
          <Textarea
            label={language === 'ar' ? 'مراحل التنفيذ وتواريخها' : 'Implementation Phases and Dates'}
            value={timeline}
            onChange={(event) => setTimeline(event.target.value)}
            rows={8}
            placeholder={language === 'ar'
              ? 'مثال: إعداد الأداة - سبتمبر، جمع البيانات - أكتوبر، التحليل - نوفمبر...'
              : 'Example: Instrument preparation - September, data collection - October, analysis - November...'}
          />
        </Card>
      </div>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--ds-primary)]">
          <ShieldCheck size={18} />
          <h3 className="m-0 text-base font-black text-[var(--ds-text-primary)]">
            {language === 'ar' ? 'الاعتبارات الأخلاقية والجدوى' : 'Ethics and Feasibility'}
          </h3>
        </div>
        <Textarea
          label={language === 'ar' ? 'الموافقات، الخصوصية، المخاطر، وخطة التخفيف' : 'Approvals, privacy, risks, and mitigation'}
          value={ethics}
          onChange={(event) => setEthics(event.target.value)}
          rows={5}
          placeholder={language === 'ar'
            ? 'وثّق موافقة الجهة، سرية البيانات، وإجراءات تقليل المخاطر.'
            : 'Document approvals, data confidentiality, and risk mitigation.'}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <label className="block text-xs font-bold text-[var(--ds-text-secondary)]">
            {language === 'ar' ? 'حالة الموافقة الأخلاقية / لجنة المراجعة' : 'Ethics / IRB approval status'}
            <select
              value={ethicsPlan.approvalStatus}
              onChange={(event) => setEthicsPlan(current => ({ ...current, approvalStatus: event.target.value as EthicsApprovalStatus }))}
              className="mt-1.5 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-sm text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
            >
              <option value="planned">{language === 'ar' ? 'قيد طلب / تخطيط' : 'Planned / pending'}</option>
              <option value="approved">{language === 'ar' ? 'تمت الموافقة' : 'Approved'}</option>
              <option value="not_required">{language === 'ar' ? 'غير مطلوبة مع تبرير موثق' : 'Not required with documented rationale'}</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Textarea
            label={language === 'ar' ? 'خطة الموافقة المستنيرة أو مبرر عدم انطباقها' : 'Informed-consent plan or non-applicability rationale'}
            value={ethicsPlan.consentPlan}
            onChange={(event) => setEthicsPlan(current => ({ ...current, consentPlan: event.target.value }))}
            rows={4}
          />
          <Textarea
            label={language === 'ar' ? 'خطة الخصوصية والاحتفاظ بالبيانات' : 'Privacy and data-retention plan'}
            value={ethicsPlan.privacyPlan}
            onChange={(event) => setEthicsPlan(current => ({ ...current, privacyPlan: event.target.value }))}
            rows={4}
          />
          <Textarea
            label={language === 'ar' ? 'المخاطر وخطة التخفيف والإحالة' : 'Risks, mitigation, and escalation plan'}
            value={ethicsPlan.riskMitigationPlan}
            onChange={(event) => setEthicsPlan(current => ({ ...current, riskMitigationPlan: event.target.value }))}
            rows={4}
          />
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="m-0 text-base font-black text-[var(--ds-text-primary)]">
              {language === 'ar' ? 'قاموس البيانات' : 'Data Dictionary'}
            </h3>
            <p className="m-0 mt-1 text-xs text-[var(--ds-text-secondary)]">
              {language === 'ar' ? 'عرض مشتق من متغيرات المشروع المعتمدة.' : 'A view derived from the project’s approved variables.'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(ROUTES.NEW_STUDY_DESIGN.replaceAll(':projectId', activeProject.id))}>
            {language === 'ar' ? 'إدارة المتغيرات' : 'Manage Variables'}
          </Button>
        </div>

        {activeProject.variables.length === 0 ? (
          <Alert variant="warning">
            {language === 'ar' ? 'أضف متغيرات الدراسة لإنشاء قاموس البيانات.' : 'Add study variables to create the data dictionary.'}
          </Alert>
        ) : (
          <div className="overflow-x-auto border border-[var(--ds-border-subtle)] rounded-lg">
            <table className="w-full text-start text-xs">
              <thead className="bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)]">
                <tr>
                  <th className="px-3 py-2.5 font-black">{language === 'ar' ? 'المتغير' : 'Variable'}</th>
                  <th className="px-3 py-2.5 font-black">{language === 'ar' ? 'النوع' : 'Type'}</th>
                  <th className="px-3 py-2.5 font-black">{language === 'ar' ? 'القياس' : 'Scale'}</th>
                  <th className="px-3 py-2.5 font-black">{language === 'ar' ? 'الوصف / الأداة' : 'Description / Instrument'}</th>
                </tr>
              </thead>
              <tbody>
                {activeProject.variables.map(variable => (
                  <tr key={variable.id} className="border-t border-[var(--ds-border-subtle)] text-[var(--ds-text-secondary)]">
                    <td className="px-3 py-3 font-bold text-[var(--ds-text-primary)]">{language === 'ar' ? variable.nameAr : variable.nameEn}</td>
                    <td className="px-3 py-3">{variable.type}</td>
                    <td className="px-3 py-3">{variable.scale}</td>
                    <td className="px-3 py-3">{language === 'ar' ? variable.descriptionAr || '—' : variable.descriptionEn || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="primary" size="md" onClick={handleSave} iconBefore={<CheckCircle2 size={16} />}>
          {language === 'ar' ? 'حفظ خطة البحث' : 'Save Research Plan'}
        </Button>
      </div>
    </div>
  );
};

export default ResearchPlanning;