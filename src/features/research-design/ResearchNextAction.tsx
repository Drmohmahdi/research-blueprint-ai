import React from 'react';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ResearchStepId } from './researchDesignConfig';

interface ResearchNextActionProps {
  currentStepId: ResearchStepId;
  missingInputs: string[];
  warnings: string[];
  onNavigateNext: () => void;
  language: 'ar' | 'en';
}

export const ResearchNextAction: React.FC<ResearchNextActionProps> = ({
  currentStepId: _currentStepId,
  missingInputs,

  warnings,
  onNavigateNext,
  language
}) => {
  const isAr = language === 'ar';

  const isComplete = missingInputs.length === 0;

  return (
    <div className="ds-ai-surface rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--ds-data-teal)] font-bold text-xs">
          <Sparkles size={16} />
          <span>{isAr ? 'الإجراء الأكاديمي التالي' : 'Next Best Academic Action'}</span>
        </div>
        {isComplete && (
          <span className="flex items-center gap-1 text-[var(--ds-success)] text-xs font-semibold">
            <CheckCircle2 size={14} />
            <span>{isAr ? 'جاهزة للمتابعة' : 'Ready'}</span>
          </span>
        )}
      </div>

      {!isComplete ? (
        <div className="space-y-1 text-xs text-[var(--ds-text-secondary)]">
          <p className="font-semibold text-[var(--ds-text-primary)]">
            {isAr ? 'لإكمال هذه الخطوة، يرجى استكمال المدخلات التالية:' : 'To complete this step, please fulfill the missing inputs:'}
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[var(--ds-danger)] font-medium">
            {missingInputs.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-caption text-[var(--ds-text-secondary)]">
          {isAr
            ? 'تم استيفاء المدخلات واكتمال قواعد الخطوة الحالية بنجاح. يمكنك الانتقال للخطوة التالية.'
            : 'Step requirements are met. You can proceed to the next step.'}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="text-xs text-[var(--ds-warning)] bg-[var(--ds-warning-soft)] p-2 rounded-lg border border-[var(--ds-warning)]/20">
          <strong>{isAr ? 'تنبيه منهجي: ' : 'Warning: '}</strong>
          {warnings.join(' | ')}
        </div>
      )}

      {isComplete && (
        <button
          onClick={onNavigateNext}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-action hover:bg-action-hover text-on-action border-none cursor-pointer shadow-sm ds-transition mt-2"
        >
          <span>{isAr ? 'الانتقال للخطوة التالية' : 'Proceed to Next Step'}</span>
          <ArrowRight className={isAr ? "rotate-180" : ""} size={14} />
        </button>
      )}
    </div>
  );
};
export default ResearchNextAction;
