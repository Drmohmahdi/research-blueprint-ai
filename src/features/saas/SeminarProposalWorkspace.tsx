import React from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspaceState } from './useWorkspaceState';
import { WorkspaceRiskPanel } from './components/WorkspaceRiskPanel';
import { WorkspaceCommentsPanel } from './components/WorkspaceCommentsPanel';
import { SeminarProposalStepContent } from './components/SeminarProposalStepContent';
import { SEMINAR_PROPOSAL_STEPS } from '../../config/seminarProposalSteps';
import { 
  Sparkles,
  Unlock,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';

export const SeminarProposalWorkspace: React.FC = () => {
  const { stepId } = useParams<{ stepId?: string }>();
  // Pass the specific pathId
  const engine = useWorkspaceState(stepId || 'analyzer', 'SEMINAR_PROPOSAL_REVIEW');
  const {
    activeStep,
    setActiveStep,
    isSidebarOpen,
    activeProject,
    language,
    isSecureMode
  } = engine;

  if (!activeProject) {
    return (
      <div className="p-12 text-center text-xs text-[var(--ds-text-muted)] italic font-semibold">
        {language === 'ar' ? 'الرجاء اختيار مشروع نشط أولاً...' : 'Please select an active project first...'}
      </div>
    );
  }

  // Stepper helper navigations
  const handlePrevStep = () => {
    const idx = SEMINAR_PROPOSAL_STEPS.findIndex(s => s.id === activeStep);
    if (idx > 0) {
      setActiveStep(SEMINAR_PROPOSAL_STEPS[idx - 1].id);
    }
  };

  const handleNextStep = () => {
    const idx = SEMINAR_PROPOSAL_STEPS.findIndex(s => s.id === activeStep);
    if (idx < SEMINAR_PROPOSAL_STEPS.length - 1) {
      setActiveStep(SEMINAR_PROPOSAL_STEPS[idx + 1].id);
    }
  };

  const totalSteps = SEMINAR_PROPOSAL_STEPS.length;
  // Count how many of these specific steps are completed
  const completedStepsCount = SEMINAR_PROPOSAL_STEPS.filter(s => activeProject.completedSteps?.includes(s.id)).length;
  const progressPct = Math.round((completedStepsCount / totalSteps) * 100) || 0;

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto pb-24">
      {/* ── Path Header ── */}
      <Card className="p-6 bg-gradient-to-r from-blue-900 via-indigo-950 to-zinc-950 border-[var(--ds-border-subtle)] text-white rounded-3xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Sparkles size={160} />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black bg-blue-500/25 border border-blue-400/30 text-blue-300 tracking-wider">
                {language === 'ar' ? 'مساحة مراجعة السمينار' : 'SEMINAR PROPOSAL WORKSPACE'}
              </span>
              {isSecureMode && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                  <Unlock size={10} />
                  <span>{language === 'ar' ? 'وضع آمن' : 'SECURE'}</span>
                </div>
              )}
            </div>
            <h3 className="text-xl md:text-3xl font-black m-0 leading-tight">
              {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            {/* Progress bar */}
            <div className="text-center lg:text-right space-y-1">
              <div className="text-xs font-black text-blue-300">{progressPct}% {language === 'ar' ? 'مكتمل' : 'Completed'}</div>
              <div className="h-2 w-32 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Column: Vertical Stepper */}
        <aside className="w-full lg:w-[260px] shrink-0 space-y-2">
          {SEMINAR_PROPOSAL_STEPS.map((step, idx) => {
            const isActive = activeStep === step.id;
            const isCompleted = activeProject.completedSteps?.includes(step.id);
            
            return (
              <Card 
                key={step.id} 
                onClick={() => setActiveStep(step.id)}
                className={`p-3 cursor-pointer transition-all border-l-4 rounded-xl shadow-sm hover:-translate-y-0.5 ${
                  isActive 
                    ? 'border-l-blue-600 bg-[var(--ds-surface-secondary)]' 
                    : isCompleted
                      ? 'border-l-emerald-500 bg-[var(--ds-surface-primary)] opacity-80'
                      : 'border-l-transparent bg-[var(--ds-surface-primary)] opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)]'
                  }`}>
                    {isCompleted ? <Check size={10} /> : idx + 1}
                  </div>
                  <span className={`text-xs font-bold ${isActive ? 'text-[var(--ds-text-primary)]' : 'text-[var(--ds-text-secondary)]'}`}>
                    {language === 'ar' ? step.titleAr : step.titleEn}
                  </span>
                </div>
              </Card>
            );
          })}
        </aside>

        {/* Center Workspace Panel */}
        <div className="flex-1 w-full space-y-6">
          <SeminarProposalStepContent engine={engine} />
          
          {/* Stepper Footer Navigation */}
          <Card className="p-4 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-2xl flex items-center justify-between shadow-sm">
            <Button onClick={handlePrevStep} variant="secondary" className="flex items-center gap-1 cursor-pointer">
              <ChevronLeft size={16} />
              <span>{language === 'ar' ? 'الخطوة السابقة' : 'Previous Step'}</span>
            </Button>
            <Button onClick={handleNextStep} variant="primary" className="flex items-center gap-1 cursor-pointer">
              <span>{language === 'ar' ? 'الخطوة التالية' : 'Next Step'}</span>
              <ChevronRight size={16} />
            </Button>
          </Card>
        </div>

        {/* Right Panel: Risks & Supervisor Comments */}
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
export default SeminarProposalWorkspace;
