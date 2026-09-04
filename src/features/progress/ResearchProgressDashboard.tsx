import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { RESEARCH_PATHS_CONFIG } from '../../config/researchPathsConfig';
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Target,
  Layers,
  Download
} from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import { PathPanel } from '../../design-system/components/Navigation';
import { EmptyActiveProject } from '../../components/EmptyActiveProject';
import { ROUTES } from '../../router/routes';
import { calculateProtocolHash } from '../../utils/protocolIntegrity';

interface PhaseInfo {
  id: string;
  nameAr: string;
  nameEn: string;
  steps: string[];
  icon: React.FC<any>;
}

const PHASES: PhaseInfo[] = [
  { id: 'planning', nameAr: 'التخطيط', nameEn: 'Planning', steps: ['ideaExploration', 'titleAnalysis'], icon: Target },
  { id: 'design', nameAr: 'التصميم', nameEn: 'Design', steps: ['modelBuilder', 'sampleCalc', 'consistency'], icon: Layers },
  { id: 'simulation', nameAr: 'المحاكاة', nameEn: 'Simulation', steps: ['simulation', 'outcomePredictor'], icon: TrendingUp },
  { id: 'registration', nameAr: 'التسجيل', nameEn: 'Registration', steps: ['preReg'], icon: Clock },
  { id: 'execution', nameAr: 'التنفيذ', nameEn: 'Execution', steps: ['fidelity', 'dataQuality'], icon: CheckCircle2 },
  { id: 'analysis', nameAr: 'التحليل', nameEn: 'Analysis', steps: ['litSynthesizer', 'prisma', 'qualitative'], icon: TrendingUp },
  { id: 'publishing', nameAr: 'النشر', nameEn: 'Publishing', steps: ['reviewSim'], icon: CheckCircle2 },
];

export const ResearchProgressDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language } = useProject();
  const [protocolStatus, setProtocolStatus] = useState<'checking' | 'verified' | 'missing' | 'mismatch' | 'unavailable'>('checking');

  useEffect(() => {
    let cancelled = false;
    if (!activeProject?.preRegistrationHash) {
      setProtocolStatus('missing');
      return () => { cancelled = true; };
    }

    setProtocolStatus('checking');
    calculateProtocolHash(activeProject)
      .then(hash => {
        if (!cancelled) setProtocolStatus(hash === activeProject.preRegistrationHash ? 'verified' : 'mismatch');
      })
      .catch(() => {
        if (!cancelled) setProtocolStatus('unavailable');
      });
    return () => { cancelled = true; };
  }, [activeProject]);

  if (!activeProject) {
    return (
      <EmptyActiveProject
        language={language}
        illustration={<TrendingUp size={40} />}
        description={language === 'ar' ? 'أنشئ مشروعًا من اختيار المسار لعرض لوحة تقدم البحث.' : 'Create a project from path selection to view the research progress dashboard.'}
      />
    );
  }

  const completedSteps = activeProject.completedSteps || [];
  const activePath = RESEARCH_PATHS_CONFIG.find(p => p.id === activeProject.activePathId);

  // Calculate overall
  const totalSteps = activePath?.orderedSteps.length || PHASES.reduce((s, p) => s + p.steps.length, 0);

  // Completeness checks
  const hasTitle = !!(activeProject.titleAr || activeProject.titleEn);
  const hasProblem = !!(activeProject.problemStatementAr || activeProject.problemStatementEn);
  const hasVars = activeProject.variables?.length > 0;
  const hasQuestions = activeProject.questions?.length > 0;
  const hasHypotheses = activeProject.hypotheses?.length > 0;
  const hasPreReg = protocolStatus === 'verified';
  const preRegValue = protocolStatus === 'checking' ? '...' : hasPreReg ? '✓' : '✗';
  const registrationInPath = !activePath || activePath.orderedSteps.includes('preReg');
  const verifiedRegistrationSteps = hasPreReg && registrationInPath && !completedSteps.includes('preReg') ? 1 : 0;
  const completedInPath = activePath
    ? completedSteps.filter(s => activePath.orderedSteps.includes(s)).length + verifiedRegistrationSteps
    : completedSteps.length + verifiedRegistrationSteps;
  const overallPercent = totalSteps > 0 ? Math.round((completedInPath / totalSteps) * 100) : 0;
  const dataCompletion = [hasTitle, hasProblem, hasVars, hasQuestions, hasHypotheses].filter(Boolean).length * 20;
  const dependentVariables = activeProject.variables.filter(variable => variable.type === 'dependent');
  const completeMeasurementPlans = dependentVariables.filter(variable => {
    const plan = activeProject.measurementInstruments?.find(instrument => instrument.variableId === variable.id);
    return Boolean(plan?.name.trim() && plan.scoringPlan.trim() && plan.validityPlan.trim() && plan.reliabilityMethod);
  }).length;
  const completeAnalysisPlans = activeProject.hypotheses.filter(hypothesis => {
    const plan = activeProject.hypothesisAnalysisPlans?.find(item => item.hypothesisId === hypothesis.id);
    return Boolean(plan?.statisticalTest && plan.effectSizeMetric && (plan?.assumptionsPlan.trim().length ?? 0) >= 10);
  }).length;
  const ethicsPlanComplete = !!activeProject.ethicsFeasibilityPlan
    && activeProject.ethicsFeasibilityPlan.consentPlan.trim().length >= 10
    && activeProject.ethicsFeasibilityPlan.privacyPlan.trim().length >= 10
    && activeProject.ethicsFeasibilityPlan.riskMitigationPlan.trim().length >= 10;
  const readinessSections = [
    { labelAr: 'أساس الدراسة', labelEn: 'Study foundation', completed: [hasTitle, hasProblem, hasVars, hasQuestions, hasHypotheses].filter(Boolean).length, total: 5, route: activeProject ? ROUTES.NEW_STUDY_DESIGN.replace(':projectId', activeProject.id) : ROUTES.PATHS },
    { labelAr: 'خطط القياس', labelEn: 'Measurement plans', completed: completeMeasurementPlans, total: dependentVariables.length, route: ROUTES.MEASUREMENT },
    { labelAr: 'خطة التحليل', labelEn: 'Analysis plan', completed: completeAnalysisPlans, total: activeProject.hypotheses.length, route: ROUTES.ANALYSIS_PLAN },
    { labelAr: 'الجدوى والأخلاقيات', labelEn: 'Ethics and feasibility', completed: ethicsPlanComplete ? 1 : 0, total: 1, route: ROUTES.PLANNING },
    { labelAr: 'التسجيل المسبق', labelEn: 'Preregistration', completed: hasPreReg ? 1 : 0, total: 1, route: ROUTES.PRE_REGISTRATION }
  ];

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PathPanel accent="var(--ds-path-research)">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-ink m-0 mb-2">
              {language === 'ar' ? 'لوحة تحليلات البحث' : 'Research Analytics'}
            </h2>
            <p className="text-sm font-semibold text-secondary m-0">
              {language === 'ar'
                ? `${activeProject.titleAr || activeProject.titleEn || 'مشروع بدون عنوان'}`
                : `${activeProject.titleEn || activeProject.titleAr || 'Untitled project'}`}
            </p>
          </div>
          <Button onClick={handleExportPdf} variant="secondary" className="flex items-center gap-2 cursor-pointer">
            <Download size={16} />
            <span>{language === 'ar' ? 'تصدير التقرير' : 'Export Report'}</span>
          </Button>
        </div>

        <div className="mt-8 space-y-2 max-w-xl">
          <div className="flex justify-between text-sm font-black">
            <span className="text-secondary">{language === 'ar' ? 'الإنجاز الكلي للمسار المنهجي' : 'Overall Path Progress'}</span>
            <span className="text-ink ds-numeric">{overallPercent}%</span>
          </div>
          <div className="h-4 rounded-full bg-[var(--ds-surface-tertiary)] overflow-hidden border border-[var(--ds-border-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--ds-primary)] ds-transition"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      </PathPanel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stats & Phases */}
        <div className="space-y-6 lg:col-span-1">
          {/* Quick stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { labelAr: 'البيانات', labelEn: 'Data', value: `${dataCompletion}%`, color: dataCompletion >= 80 ? 'text-success ds-numeric' : 'text-warning ds-numeric' },
              { labelAr: 'الخطوات', labelEn: 'Steps', value: `${completedInPath}/${totalSteps}`, color: 'text-ink ds-numeric' },
              { labelAr: 'التسجيل', labelEn: 'Pre-reg', value: preRegValue, color: protocolStatus === 'checking' ? 'text-warning' : hasPreReg ? 'text-success' : 'text-danger' },
              { labelAr: 'المسار', labelEn: 'Path', value: activePath ? (language === 'ar' ? activePath.titleAr.substring(0, 10) : activePath.titleEn.substring(0, 10)) : '—', color: 'text-[var(--ds-text-primary)]' },
            ].map((stat, i) => (
              <div key={i} className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-4 text-center shadow-sm">
                <p className="text-[10px] font-bold text-[var(--ds-text-muted)] m-0 uppercase tracking-wider">
                  {language === 'ar' ? stat.labelAr : stat.labelEn}
                </p>
                <p className={`text-2xl font-black m-0 mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Phase breakdown */}
          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 mb-4">
              {language === 'ar' ? 'تفاصيل المراحل' : 'Phase Details'}
            </h3>
            <div className="space-y-3">
              {PHASES.map(phase => {
                const total = phase.steps.length;
                const done = phase.id === 'registration' && hasPreReg
                  ? total
                  : phase.steps.filter(s => completedSteps.includes(s)).length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const Icon = phase.icon;

                return (
                  <div key={phase.id} className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${pct === 100 ? 'bg-[var(--ds-success-soft)]' : 'bg-[var(--ds-surface-secondary)]'}`}>
                      <Icon size={14} className={pct === 100 ? 'text-success' : 'text-[var(--ds-text-muted)]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[var(--ds-text-primary)]">
                          {language === 'ar' ? phase.nameAr : phase.nameEn}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--ds-text-muted)] ds-numeric">{done}/{total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--ds-surface-secondary)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct === 100 ? 'bg-action' : pct > 0 ? 'bg-info' : 'bg-transparent'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Project-derived readiness */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 mb-6">
              {language === 'ar' ? 'جاهزية المشروع الفعلية' : 'Actual Project Readiness'}
            </h3>
            <div className="space-y-5">
              {readinessSections.map(section => {
                const percent = section.total > 0 ? Math.round((section.completed / section.total) * 100) : 0;
                return <div key={section.labelEn}>
                  <div className="flex items-center justify-between gap-4 text-xs font-bold mb-2">
                    <span className="text-[var(--ds-text-primary)]">{language === 'ar' ? section.labelAr : section.labelEn}</span>
                    <div className="flex items-center gap-3">
                      <span className={percent === 100 ? 'text-success' : 'text-[var(--ds-text-muted)]'}>{section.completed}/{section.total}</span>
                      {percent < 100 && <Button type="button" variant="ghost" size="sm" onClick={() => navigate(section.route)}>{language === 'ar' ? 'استكمال' : 'Complete'}</Button>}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--ds-surface-secondary)] overflow-hidden">
                    <div className={percent === 100 ? 'h-full bg-action ds-transition' : 'h-full bg-info ds-transition'} style={{ width: `${percent}%` }} />
                  </div>
                </div>;
              })}
            </div>
          </div>

          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 mb-6">
              {language === 'ar' ? 'سلامة البروتوكول' : 'Protocol Integrity'}
            </h3>
            <p className={`m-0 text-sm font-semibold ${protocolStatus === 'verified' ? 'text-success' : protocolStatus === 'checking' ? 'text-warning' : 'text-danger'}`}>
              {protocolStatus === 'verified'
                ? (language === 'ar' ? 'البروتوكول المسجل يطابق الخطة الحالية.' : 'The registered protocol matches the current plan.')
                : protocolStatus === 'checking'
                  ? (language === 'ar' ? 'جارٍ التحقق من تطابق البروتوكول.' : 'Verifying protocol integrity.')
                  : (language === 'ar' ? 'لا توجد نسخة مسجلة مطابقة للخطة الحالية.' : 'No registered protocol matches the current plan.')}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
