import React from 'react';
import { CheckCircle2, Circle, AlertCircle, Clock, Lock } from 'lucide-react';

import { RESEARCH_STEPS_CONFIG, type ResearchStepId, type StepStatus } from './researchDesignConfig';

interface ResearchDesignStepperProps {
  activeStepId: ResearchStepId;
  onSelectStep: (stepId: ResearchStepId) => void;
  stepStatuses: Record<ResearchStepId, StepStatus>;
  language: 'ar' | 'en';
}

export const ResearchDesignStepper: React.FC<ResearchDesignStepperProps> = ({
  activeStepId,
  onSelectStep,
  stepStatuses,
  language
}) => {
  const isAr = language === 'ar';

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'IN_PROGRESS':
        return <Clock className="text-purple-500" size={16} />;
      case 'NEEDS_REVIEW':
        return <AlertCircle className="text-amber-500" size={16} />;
      case 'BLOCKED':
        return <Lock className="text-rose-500" size={16} />;
      default:
        return <Circle className="text-[var(--ds-text-secondary)]" size={16} />;
    }
  };

  const getStatusBadge = (status: StepStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">{isAr ? 'مكتمل' : 'Done'}</span>;
      case 'IN_PROGRESS':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">{isAr ? 'قيد العمل' : 'Progress'}</span>;
      case 'NEEDS_REVIEW':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">{isAr ? 'مراجعة' : 'Review'}</span>;
      case 'BLOCKED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">{isAr ? 'محظور' : 'Blocked'}</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-[var(--ds-text-secondary)]">{isAr ? 'جديد' : 'New'}</span>;
    }
  };

  return (
    <div className="w-full md:w-80 bg-[var(--ds-surface-primary)] border-b md:border-b-0 md:border-r border-[var(--ds-border-subtle)] p-4 space-y-2 overflow-y-auto max-h-[80vh] md:max-h-[calc(100vh-120px)]">
      <h3 className="text-xs font-bold text-[var(--ds-text-secondary)] uppercase tracking-wider mb-3 px-2">
        {isAr ? 'خطوات تصميم الدراسة (18)' : 'Study Design Steps (18)'}
      </h3>
      {RESEARCH_STEPS_CONFIG.map((step) => {
        const isActive = step.id === activeStepId;
        const status = stepStatuses[step.id] || 'NOT_STARTED';

        return (
          <button
            key={step.id}
            onClick={() => onSelectStep(step.id)}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all text-left border cursor-pointer ${
              isActive
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 font-bold shadow-sm'
                : 'bg-transparent border-transparent text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] hover:text-[var(--ds-text-primary)]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0">{getStatusIcon(status)}</span>
              <span className="truncate">
                {step.order}. {isAr ? step.titleAr : step.titleEn}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {getStatusBadge(status)}
            </div>
          </button>
        );
      })}
    </div>
  );
};
export default ResearchDesignStepper;
