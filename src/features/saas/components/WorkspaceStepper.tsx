import React from 'react';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import { NEW_STUDY_DESIGN_STEPS } from '../../../config/newStudyDesignSteps';
import type { useWorkspaceState } from '../useWorkspaceState';

type WorkspaceState = ReturnType<typeof useWorkspaceState>;

interface WorkspaceStepperProps {
  engine: WorkspaceState;
}

export const WorkspaceStepper: React.FC<WorkspaceStepperProps> = ({ engine }) => {
  const {
    activeStep,
    handleStepNavigation,
    activeProject,
    language
  } = engine;

  return (
    <aside className="w-full lg:w-[260px] space-y-4 shrink-0">
      <h4 className="text-xs font-black text-[var(--ds-text-muted)] uppercase tracking-widest px-2 m-0">
        {language === 'ar' ? 'خطوات مسار التصميم' : 'Study Design Steps'}
      </h4>
      <nav className="space-y-1 max-h-[580px] overflow-y-auto pr-1 no-scrollbar text-xs font-bold">
        {NEW_STUDY_DESIGN_STEPS.map((step) => {
          const isActive = activeStep === step.id;
          const isStepDone = activeProject?.completedSteps?.includes(step.id);
          
          return (
            <button
              key={step.id}
              onClick={() => handleStepNavigation(step.id)}
              className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer border ${
                isActive 
                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' 
                  : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {isStepDone ? (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <HelpCircle size={14} className="text-[var(--ds-text-muted)] shrink-0" />
                )}
                <span className="truncate">{language === 'ar' ? step.titleAr : step.titleEn}</span>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
