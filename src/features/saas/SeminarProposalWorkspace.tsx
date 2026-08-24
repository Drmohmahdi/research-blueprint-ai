import React from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspaceState } from './useWorkspaceState';
import { WorkspaceRiskPanel } from './components/WorkspaceRiskPanel';
import { WorkspaceCommentsPanel } from './components/WorkspaceCommentsPanel';
import { SeminarProposalStepContent } from './components/SeminarProposalStepContent';
import { SEMINAR_PROPOSAL_STEPS } from '../../config/seminarProposalSteps';
import { 
  Unlock,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { PathPanel } from '../../design-system/components/Navigation';

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
      <PathPanel accent="var(--ds-path-publication)">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black bg-[var(--ds-path-publication)]/10 border border-[var(--ds-path-publication)]/25 text-path-publication tracking-wider">
                {language === 'ar' ? 'مساحة مراجعة السمينار' : 'SEMINAR PROPOSAL WORKSPACE'}
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
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="text-center lg:text-end space-y-1">
              <div className="text-xs font-black text-path-publication">{progressPct}% {language === 'ar' ? 'مكتمل' : 'Completed'}</div>
              <div className="h-2 w-32 bg-[var(--ds-surface-tertiary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--ds-path-publication)] ds-transition" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </PathPanel>

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
                className={`p-3 cursor-pointer ds-transition border-s-4 rounded-xl shadow-sm ${
                  isActive 
                    ? 'border-s-[var(--ds-path-publication)] bg-[var(--ds-surface-secondary)]'
                    : isCompleted
                      ? 'border-s-[var(--ds-success)] bg-[var(--ds-surface-primary)] opacity-80'
                      : 'border-s-transparent bg-[var(--ds-surface-primary)] opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isActive ? 'bg-action text-on-action' : isCompleted ? 'bg-success text-white' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)]'
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
