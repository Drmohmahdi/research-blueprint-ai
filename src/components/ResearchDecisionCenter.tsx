import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, GitBranch, Sparkles } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { checkConsistency, type AuditIssue } from '../utils/ruleEngine';
import { VIEW_TO_PATH, ROUTES } from '../router/routes';
import { Button, Card, EmptyState, PathPanel, Progress } from '../design-system';

const severityRank: Record<AuditIssue['type'], number> = {
  critical: 0,
  warning: 1,
  improvement: 2
};

export const ResearchDecisionCenter: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language } = useProject();

  if (!activeProject) {
    return (
      <EmptyState
        illustration={<GitBranch size={40} />}
        title={language === 'ar' ? 'لا يوجد مشروع نشط' : 'No Active Project'}
        description={language === 'ar'
          ? 'أنشئ مشروعًا أو اختر مشروعًا نشطًا لعرض عوائق التصميم وإجراءات إصلاحها.'
          : 'Create or select an active project to review design blockers and repair actions.'}
        actionButton={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(ROUTES.PATHS)}
            iconAfter={<ArrowRight size={14} className={language === 'ar' ? 'rotate-180' : ''} />}
          >
            {language === 'ar' ? 'اختيار مسار البحث' : 'Choose a research path'}
          </Button>
        }
      />
    );
  }

  const designPath = ROUTES.NEW_STUDY_DESIGN.replaceAll(':projectId', activeProject.id);
  const audit = checkConsistency(activeProject);
  const issues = [...audit.issues].sort((first, second) => severityRank[first.type] - severityRank[second.type]);
  const blockers = issues.filter(issue => issue.type !== 'improvement');
  const criticalCount = issues.filter(issue => issue.type === 'critical').length;

  const repairPathForIssue = (issue: AuditIssue) => {
    if (issue.section === 'measurement') return VIEW_TO_PATH.measurement;
    if (issue.section === 'analysis') return VIEW_TO_PATH.analysisPlan;
    if (issue.section === 'ethics') return VIEW_TO_PATH.planning;
    if (issue.section === 'variables' || issue.section === 'questions' || issue.section === 'hypotheses' || issue.section === 'sample') {
      return designPath;
    }
    if (issue.section === 'methodology') return VIEW_TO_PATH.assistant;
    return VIEW_TO_PATH.consistency;
  };

  const dependencyNodes = [
    {
      id: 'title',
      labelAr: 'العنوان والمشكلة',
      labelEn: 'Title & Problem',
      ready: Boolean(activeProject.titleAr.trim() && activeProject.titleEn.trim() && (activeProject.problemStatementAr.trim() || activeProject.problemStatementEn.trim())),
      path: designPath
    },
    {
      id: 'questions',
      labelAr: 'الأسئلة والفروض',
      labelEn: 'Questions & Hypotheses',
      ready: activeProject.questions.length > 0 && activeProject.hypotheses.length > 0,
      path: designPath
    },
    {
      id: 'variables',
      labelAr: 'المتغيرات والعينة',
      labelEn: 'Variables & Sample',
      ready: activeProject.variables.length > 0 && activeProject.sampleSettings.groupsCount > 0,
      path: designPath
    },
    {
      id: 'measurement',
      labelAr: 'أدوات القياس',
      labelEn: 'Measurement Instruments',
      ready: activeProject.variables.filter(variable => variable.type === 'dependent').every(variable => {
        const instrument = activeProject.measurementInstruments?.find(item => item.variableId === variable.id);
        return Boolean(instrument?.name.trim() && instrument.scoringPlan.trim() && instrument.validityPlan.trim());
      }),
      path: VIEW_TO_PATH.measurement
    },
    {
      id: 'consistency',
      labelAr: 'الاتساق المنهجي',
      labelEn: 'Methodological Consistency',
      ready: criticalCount === 0,
      path: VIEW_TO_PATH.consistency
    },
    {
      id: 'analysis',
      labelAr: 'خطة التحليل',
      labelEn: 'Analysis Plan',
      ready: activeProject.hypotheses.length > 0 && activeProject.hypotheses.every(hypothesis => {
        const plan = activeProject.hypothesisAnalysisPlans?.find(item => item.hypothesisId === hypothesis.id);
        return Boolean(plan?.assumptionsPlan.trim());
      }),
      path: VIEW_TO_PATH.analysisPlan
    },
    {
      id: 'ethics',
      labelAr: 'الأخلاقيات والجدوى',
      labelEn: 'Ethics & Feasibility',
      ready: Boolean(activeProject.ethicsFeasibilityPlan?.consentPlan.trim() && activeProject.ethicsFeasibilityPlan.privacyPlan.trim() && activeProject.ethicsFeasibilityPlan.riskMitigationPlan.trim()),
      path: VIEW_TO_PATH.planning
    }
  ];

  const issueStyles: Record<AuditIssue['type'], { icon: string; labelAr: string; labelEn: string }> = {
    critical: {
      icon: 'bg-[var(--ds-danger-soft)] text-[var(--ds-danger)] border-[var(--ds-danger)]/20',
      labelAr: 'عائق حرج',
      labelEn: 'Critical blocker'
    },
    warning: {
      icon: 'bg-[var(--ds-warning-soft)] text-[var(--ds-warning)] border-[var(--ds-warning)]/20',
      labelAr: 'يحتاج مراجعة',
      labelEn: 'Needs review'
    },
    improvement: {
      icon: 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] border-[var(--ds-primary)]/20',
      labelAr: 'تحسين مقترح',
      labelEn: 'Suggested improvement'
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PathPanel accent="var(--ds-path-research)">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[var(--ds-primary)]">
              <Sparkles size={14} />
              {language === 'ar' ? 'تشغيل البحث' : 'Research Operations'}
            </div>
            <h3 className="m-0 text-xl font-black text-ink">
              {language === 'ar' ? 'مركز قرارات البحث' : 'Research Decision Center'}
            </h3>
            <p className="m-0 text-sm text-secondary">
              {language === 'ar'
                ? 'رتّب العوائق المنهجية ثم افتح موضع التصحيح المناسب لكل قرار.'
                : 'Prioritize methodological blockers, then open the right place to resolve each decision.'}
            </p>
          </div>
          <div className="min-w-[126px] rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-4 py-3 text-center">
            <div className="text-2xl font-black text-ink ds-numeric">{audit.score}/100</div>
            <div className="text-[10px] font-bold text-[var(--ds-text-muted)]">
              {language === 'ar' ? 'مؤشر الاتساق' : 'Consistency score'}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Progress value={audit.score} variant={audit.score >= 80 ? 'success' : audit.score >= 50 ? 'warning' : 'danger'} />
        </div>
      </PathPanel>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-[var(--ds-primary)]" />
          <div>
            <h3 className="m-0 text-base font-black text-[var(--ds-text-primary)]">
              {language === 'ar' ? 'خريطة اعتماد التصميم' : 'Design Dependency Map'}
            </h3>
            <p className="m-0 text-xs text-[var(--ds-text-secondary)]">
              {language === 'ar' ? 'اكتمال كل عنصر يفتح العنصر الذي يليه.' : 'Each completed element enables the next design decision.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {dependencyNodes.map((node, index) => (
            <React.Fragment key={node.id}>
              <button
                type="button"
                onClick={() => navigate(node.path)}
                className={`min-h-[92px] rounded-lg border p-3 text-start transition-colors cursor-pointer ${node.ready
                  ? 'border-[var(--ds-success)]/25 bg-[var(--ds-success-soft)] text-[var(--ds-success)]'
                  : 'border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-tertiary)]'}`}
              >
                {node.ready ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                <span className="mt-3 block text-xs font-black leading-5">{language === 'ar' ? node.labelAr : node.labelEn}</span>
              </button>
              {index < dependencyNodes.length - 1 && <div className="hidden sm:block" />}
            </React.Fragment>
          ))}
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="m-0 text-lg font-black text-[var(--ds-text-primary)]">
              {language === 'ar' ? 'قرارات تحتاج إلى إجراء' : 'Decisions Requiring Action'}
            </h3>
            <p className="m-0 text-xs text-[var(--ds-text-secondary)]">
              {blockers.length === 0
                ? (language === 'ar' ? 'لا توجد عوائق حرجة أو تحذيرات حالياً.' : 'No critical blockers or warnings are currently open.')
                : (language === 'ar' ? `${blockers.length} عنصر يحتاج مراجعة قبل الانتقال.` : `${blockers.length} items need review before progressing.`)}
            </p>
          </div>
          {criticalCount > 0 && (
            <span className="rounded-full bg-[var(--ds-danger-soft)] border border-[var(--ds-danger)]/20 px-3 py-1 text-xs font-black text-[var(--ds-danger)]">
              {language === 'ar' ? `${criticalCount} حرج` : `${criticalCount} critical`}
            </span>
          )}
        </div>

        {issues.length === 0 ? (
          <EmptyState
            illustration={<CheckCircle2 size={36} />}
            title={language === 'ar' ? 'لا توجد عوائق منهجية ظاهرة' : 'No Visible Methodological Blockers'}
            description={language === 'ar'
              ? 'يمكنك الانتقال إلى المحاكاة أو مراجعة الجاهزية للنشر.'
              : 'You can proceed to simulation or publication-readiness review.'}
          />
        ) : (
          <div className="space-y-3">
            {issues.map(issue => {
              const style = issueStyles[issue.type];
              return (
                <Card key={issue.id} padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <span className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center ${style.icon}`}>
                    <AlertTriangle size={17} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black text-[var(--ds-text-muted)]">{language === 'ar' ? style.labelAr : style.labelEn}</span>
                    <p className="m-0 mt-1 text-sm font-semibold text-[var(--ds-text-primary)] leading-6">
                      {language === 'ar' ? issue.textAr : issue.textEn}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(repairPathForIssue(issue))}
                    iconAfter={<ArrowRight size={14} className={language === 'ar' ? 'rotate-180' : ''} />}
                  >
                    {language === 'ar' ? 'فتح التصحيح' : 'Open repair'}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default ResearchDecisionCenter;