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
    <div className="bg-gradient-to-r from-purple-900/10 via-purple-800/5 to-transparent border border-purple-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs">
          <Sparkles size={16} />
          <span>{isAr ? 'الإجراء التالي الأنسب (Next Best Action)' : 'Next Best Action'}</span>
        </div>
        {isComplete && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <CheckCircle2 size={14} />
            <span>{isAr ? 'مكتملة بنجاح' : 'Ready'}</span>
          </span>
        )}
      </div>

      {!isComplete ? (
        <div className="space-y-1 text-xs text-[var(--ds-text-secondary)]">
          <p className="font-semibold text-[var(--ds-text-primary)]">
            {isAr ? 'لإكمال هذه الخطوة، يرجى استكمال المدخلات التالية:' : 'To complete this step, please fulfill the missing inputs:'}
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-rose-500 font-medium">
            {missingInputs.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-[var(--ds-text-secondary)]">
          {isAr
            ? 'تم استيفاء المدخلات واكتمال قواعد الخطوة الحالية بنجاح. يمكنك الانتقال للخطوة التالية.'
            : 'Step requirements are met. You can proceed to the next step.'}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
          <strong>{isAr ? 'تنبيه منهجـي: ' : 'Warning: '}</strong>
          {warnings.join(' | ')}
        </div>
      )}

      {isComplete && (
        <button
          onClick={onNavigateNext}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white border-none cursor-pointer shadow-sm transition-colors mt-2"
        >
          <span>{isAr ? 'الانتقال للخطوة التالية' : 'Proceed to Next Step'}</span>
          <ArrowRight className={isAr ? "rotate-180" : ""} size={14} />
        </button>
      )}
    </div>
  );
};
export default ResearchNextAction;
