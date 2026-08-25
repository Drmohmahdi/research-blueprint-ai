import React from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspaceState } from './useWorkspaceState';
import { WorkspaceStepper } from './components/WorkspaceStepper';
import { WorkspaceStepContent } from './components/WorkspaceStepContent';
import { WorkspaceRiskPanel } from './components/WorkspaceRiskPanel';
import { WorkspaceCommentsPanel } from './components/WorkspaceCommentsPanel';
import { NEW_STUDY_DESIGN_STEPS } from '../../config/newStudyDesignSteps';
import { 
  Unlock,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { EmptyState } from '../../design-system/components/Feedback';
import { PathPanel } from '../../design-system/components/Navigation';

export const NewStudyDesignWorkspace: React.FC = () => {
  const { stepId } = useParams<{ stepId?: string }>();
  const engine = useWorkspaceState(stepId);
  const {
    activeStep,
    setActiveStep,
    mode,
    setMode,
    isSidebarOpen,
    activeProject,
    language,
    isSecureMode
  } = engine;

  if (!activeProject) {
    return (
      <EmptyState
        illustration={<Unlock size={40} />}
        title={language === 'ar' ? 'لا يوجد مشروع نشط' : 'No active project'}
        description={language === 'ar' ? 'اختر مشروعًا نشطًا لفتح مسار تصميم الدراسة.' : 'Select an active project to open the study design path.'}
      />
    );
  }

  // Stepper helper navigations
  const handlePrevStep = () => {
    const idx = NEW_STUDY_DESIGN_STEPS.findIndex(s => s.id === activeStep);
    if (idx > 0) {
      setActiveStep(NEW_STUDY_DESIGN_STEPS[idx - 1].id);
    }
  };

  const handleNextStep = () => {
    const idx = NEW_STUDY_DESIGN_STEPS.findIndex(s => s.id === activeStep);
    if (idx < NEW_STUDY_DESIGN_STEPS.length - 1) {
      setActiveStep(NEW_STUDY_DESIGN_STEPS[idx + 1].id);
    }
  };

  const totalSteps = NEW_STUDY_DESIGN_STEPS.length;
  const completedStepsCount = activeProject.completedSteps?.length || 0;
  const progressPct = Math.round((completedStepsCount / totalSteps) * 100);

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto pb-24">
      {/* ── Path Header ── */}
      <PathPanel accent="var(--ds-path-research)">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/25 text-[var(--ds-primary)] tracking-wider">
                {language === 'ar' ? 'مساحة تصميم الدراسة' : 'STUDY DESIGN WORKSPACE'}
              </span>
              {isSecureMode && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--ds-success-soft)] text-[var(--ds-success)] border border-[var(--ds-success)]/30 text-[9px] font-bold">
                  <Unlock size={10} />
                  <span>{language === 'ar' ? 'وضع آمن' : 'SECURE'}</span>
                </div>
              )}
            </div>
            <h3 className="text-xl md:text-3xl font-black m-0 leading-tight text-ink">
              {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}
            </h3>
            <p className="text-xs text-secondary font-medium m-0">
              {language === 'ar' ? `المؤسسة: ${activeProject.institutionAr || 'مساحة شخصية'}` : `Institution: ${activeProject.institutionEn || 'Personal Workspace'}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex bg-[var(--ds-surface-secondary)] p-1.5 rounded-xl border border-subtle">
              <button 
                onClick={() => setMode('guided')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ds-transition cursor-pointer ${
                  mode === 'guided' ? 'bg-[var(--ds-primary-soft)] text-ink' : 'text-muted hover:text-secondary'
                }`}
              >
                {language === 'ar' ? 'توجيه خطوة بخطوة' : 'Guided'}
              </button>
              <button 
                onClick={() => setMode('expert')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ds-transition cursor-pointer ${
                  mode === 'expert' ? 'bg-[var(--ds-primary-soft)] text-ink' : 'text-muted hover:text-secondary'
                }`}
              >
                {language === 'ar' ? 'التحكم المتقدم' : 'Expert'}
              </button>
            </div>

            <div className="text-center lg:text-end space-y-1">
              <div className="text-xs font-black text-ink ds-numeric">{progressPct}% {language === 'ar' ? 'مكتمل' : 'Completed'}</div>
              <div className="h-2 w-32 bg-[var(--ds-surface-tertiary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--ds-primary)] ds-transition" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </PathPanel>

      {/* ── Path Overview Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { key: 'design', labelAr: 'اكتمال التصميم', labelEn: 'Design Progress', val: `${progressPct}%`, col: 'text-ink' },
          { key: 'consistency', labelAr: 'الاتساق المنهجي', labelEn: 'Consistency Index', val: (activeProject.variables?.length || 0) > 0 ? '90/100' : '50/100', col: 'text-ink' },
          { key: 'sample', labelAr: 'جاهزية العينة', labelEn: 'Sample Power', val: activeProject.sampleSettings?.populationSize ? '80%' : '0%', col: 'text-ink' },
          { key: 'evidence', labelAr: 'جودة الأدلة', labelEn: 'Evidence Weight', val: activeProject.pooledEffectSize ? 'A (High)' : 'N/A', col: 'text-ink' },
          { key: 'risk', labelAr: 'مؤشر المخاطر', labelEn: 'Risk Index', val: activeProject.preRegistrationLockedAt ? 'LOW' : 'MEDIUM', col: activeProject.preRegistrationLockedAt ? 'text-success' : 'text-warning' },
          { key: 'prereg', labelAr: 'التسجيل المسبق', labelEn: 'Pre-Reg Status', val: activeProject.preRegistrationLockedAt ? (language === 'ar' ? 'مؤمن' : 'LOCKED') : (language === 'ar' ? 'مسودة' : 'DRAFT'), col: activeProject.preRegistrationLockedAt ? 'text-success' : 'text-warning' },
          { key: 'readiness', labelAr: 'جاهزية النشر', labelEn: 'Ready Score', val: activeProject.preRegistrationLockedAt ? '92%' : '64%', col: 'text-ink' }
        ].map((m) => (
          <Card key={m.key} className="p-3 text-center border-[var(--ds-border-subtle)] space-y-1 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-[var(--ds-text-muted)] uppercase block truncate">
              {language === 'ar' ? m.labelAr : m.labelEn}
            </span>
            <span className={`text-base font-black ${m.col} block`}>{m.val}</span>
          </Card>
        ))}
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Column: Stepper */}
        {mode === 'guided' && <WorkspaceStepper engine={engine} />}

        {/* Center Workspace Panel */}
        <div className="flex-1 w-full space-y-6">
          <WorkspaceStepContent engine={engine} />
          
          {/* Stepper Footer Navigation */}
          <Card className="p-4 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-2xl flex items-center justify-between shadow-sm">
            <Button onClick={handlePrevStep} variant="secondary" className="flex items-center gap-1 cursor-pointer">
              <ChevronLeft size={16} />
              <span>{language === 'ar' ? 'الخطوة السابقة' : 'Previous Step'}</span>
            </Button>
            <Button onClick={handleNextStep} className="flex items-center gap-1 cursor-pointer">
              <span>{language === 'ar' ? 'الخطوة التالية' : 'Next Step'}</span>
              <ChevronRight size={16} />
            </Button>
          </Card>
        </div>

        {/* Right Panel: Risks, Insights & Supervisor Comments */}
        {isSidebarOpen && (
          <aside className="w-full lg:w-[320px] space-y-6 shrink-0">
            <WorkspaceRiskPanel engine={engine} />
            <WorkspaceCommentsPanel engine={engine} />
          </aside>
        )}

      </div>
    </div>
  );
};
export default NewStudyDesignWorkspace;
