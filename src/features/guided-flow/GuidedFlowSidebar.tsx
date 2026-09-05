import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { RESEARCH_PATHS_CONFIG } from '../../config/researchPathsConfig';
import { ROUTES, VIEW_TO_PATH } from '../../router/routes';
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

export const GuidedFlowSidebar: React.FC = () => {
  const { activeProject, language } = useProject();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!activeProject?.activePathId) return null;

  const activePath = RESEARCH_PATHS_CONFIG.find(p => p.id === activeProject.activePathId);
  if (!activePath) return null;

  const completedSteps = activeProject.completedSteps || [];

  // Labels map for step IDs
  const stepLabels: Record<string, { ar: string; en: string }> = {
    wizard: { ar: 'معالج البحث', en: 'Research Wizard' },
    analyzer: { ar: 'محلل العنوان', en: 'Title Analyzer' },
    consistency: { ar: 'مدقق الاتساق', en: 'Consistency Checker' },
    modelBuilder: { ar: 'النموذج المفاهيمي', en: 'Conceptual Model' },
    sampleCalc: { ar: 'حاسبة العينة', en: 'Sample Calculator' },
    simulation: { ar: 'مختبر المحاكاة', en: 'Simulation Lab' },
    outcomePredictor: { ar: 'محرك التنبؤ', en: 'Outcome Predictor' },
    dataQuality: { ar: 'جودة البيانات', en: 'Data Inspector' },
    preReg: { ar: 'التسجيل المسبق', en: 'Pre-registration' },
    fidelity: { ar: 'متابعة التنفيذ', en: 'Field Monitoring' },
    litSynthesizer: { ar: 'تحليل الدراسات', en: 'Literature Synthesizer' },
    prisma: { ar: 'مخطط PRISMA', en: 'PRISMA Builder' },
    qualitative: { ar: 'الترميز النوعي', en: 'Qualitative Lab' },
    reviewSim: { ar: 'جاهزية النشر', en: 'Publication Reviewer' },
    export: { ar: 'تصدير التقرير', en: 'Export Report' },
  };

  // Find current step index
  const currentStepPath = pathname;
  const currentStepIdx = activePath.orderedSteps.findIndex(
    s => VIEW_TO_PATH[s] === currentStepPath
  );

  return (
    <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-4 shadow-sm space-y-4">
      {/* Path title */}
      <div className="pb-3 border-b border-[var(--ds-border-subtle)]">
        <h4 className="text-h4 text-path-research m-0 uppercase">
          {language === 'ar' ? 'المسار البحثي' : 'Research Path'}
        </h4>
        <p className="text-body-sm font-bold text-[var(--ds-text-primary)] m-0 mt-1">
          {language === 'ar' ? activePath.titleAr : activePath.titleEn}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {activePath.orderedSteps.map((stepId, idx) => {
          const isCompleted = completedSteps.includes(stepId);
          const isCurrent = idx === currentStepIdx;
          const label = stepLabels[stepId];

          return (
            <button
              key={stepId}
              onClick={() => navigate(VIEW_TO_PATH[stepId] ?? ROUTES.PORTAL)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-[var(--ds-primary-soft)] text-ink border border-[var(--ds-primary)]/20'
                  : isCompleted
                  ? 'text-success hover:bg-[var(--ds-success-soft)]'
                  : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)]'
              }`}
            >
              {/* Step indicator */}
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 size={14} className="text-success" />
                ) : (
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    isCurrent ? 'border-[var(--ds-primary)] bg-[var(--ds-primary)]' : 'border-muted'
                  }`}>
                    {isCurrent && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                )}
              </div>

              {/* Step number + label */}
              <span className="flex-1 text-right">
                <span className="opacity-50 ml-1">{idx + 1}.</span>
                {label ? (language === 'ar' ? label.ar : label.en) : stepId}
              </span>
            </button>
          );
        })}
      </div>

      {/* Nav buttons */}
      <div className="flex gap-2 pt-3 border-t border-[var(--ds-border-subtle)]">
        <button
          onClick={() => {
            if (currentStepIdx > 0) {
              navigate(VIEW_TO_PATH[activePath.orderedSteps[currentStepIdx - 1]] ?? ROUTES.PORTAL);
            }
          }}
          disabled={currentStepIdx <= 0}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border border-[var(--ds-border-subtle)] text-xs font-bold text-[var(--ds-text-secondary)] disabled:opacity-30 hover:bg-[var(--ds-surface-secondary)] cursor-pointer transition-colors disabled:cursor-not-allowed"
        >
          {language === 'ar' ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
          <span>{language === 'ar' ? 'السابق' : 'Previous'}</span>
        </button>
        <button
          onClick={() => {
            if (currentStepIdx < activePath.orderedSteps.length - 1) {
              navigate(VIEW_TO_PATH[activePath.orderedSteps[currentStepIdx + 1]] ?? ROUTES.PORTAL);
            }
          }}
          disabled={currentStepIdx >= activePath.orderedSteps.length - 1}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-action hover:bg-action-hover text-on-action text-xs font-bold disabled:opacity-30 cursor-pointer ds-transition disabled:cursor-not-allowed"
        >
          <span>{language === 'ar' ? 'التالي' : 'Next'}</span>
          {language === 'ar' ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-caption font-bold text-[var(--ds-text-muted)]">
          <span>{language === 'ar' ? 'التقدم' : 'Progress'}</span>
          <span className="ds-numeric">{Math.round((completedSteps.filter(s => activePath.orderedSteps.includes(s)).length / activePath.orderedSteps.length) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--ds-surface-secondary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--ds-primary)] ds-transition"
            style={{ width: `${(completedSteps.filter(s => activePath.orderedSteps.includes(s)).length / activePath.orderedSteps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
