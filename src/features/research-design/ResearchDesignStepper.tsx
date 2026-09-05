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
        return <CheckCircle2 className="text-success" size={16} />;
      case 'IN_PROGRESS':
        return <Clock className="text-[var(--ds-information)]" size={16} />;
      case 'NEEDS_REVIEW':
        return <AlertCircle className="text-warning" size={16} />;
      case 'BLOCKED':
        return <Lock className="text-danger" size={16} />;
      default:
        return <Circle className="text-[var(--ds-text-secondary)]" size={16} />;
    }
  };

  const getStatusBadge = (status: StepStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-success/10 text-success">{isAr ? 'مكتمل' : 'Done'}</span>;
      case 'IN_PROGRESS':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--ds-information-soft)] text-[var(--ds-information)]">{isAr ? 'قيد العمل' : 'Progress'}</span>;
      case 'NEEDS_REVIEW':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-warning/10 text-warning">{isAr ? 'مراجعة' : 'Review'}</span>;
      case 'BLOCKED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-danger/10 dark:bg-danger/10 text-danger">{isAr ? 'محظور' : 'Blocked'}</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-surface-subtle text-[var(--ds-text-secondary)]">{isAr ? 'جديد' : 'New'}</span>;
    }
  };

  return (
    <div className="w-full md:w-80 bg-[var(--ds-surface-primary)] border-b md:border-b-0 md:border-r border-[var(--ds-border-subtle)] p-4 space-y-2 overflow-y-auto max-h-[80vh] md:max-h-[calc(100vh-120px)]">
      <h3 className="text-h3 text-[var(--ds-text-secondary)] uppercase mb-3 px-2">
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
                ? 'bg-[var(--ds-primary-soft)] border-[var(--ds-primary)]/20 text-ink font-bold shadow-sm'
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
