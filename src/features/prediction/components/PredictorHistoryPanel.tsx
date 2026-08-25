import React from 'react';
import { Card } from '../../../design-system/components/Card';
import { EmptyState } from '../../../design-system/components/Feedback';
import { History } from 'lucide-react';
import type { usePredictorEngine } from '../usePredictorEngine';

type EngineState = ReturnType<typeof usePredictorEngine>;

interface PredictorHistoryPanelProps {
  engine: EngineState;
}

export const PredictorHistoryPanel: React.FC<PredictorHistoryPanelProps> = ({ engine }) => {
  const {
    runs,
    selectedRun,
    loadingRuns,
    loadRunDetails,
    language
  } = engine;

  return (
    <Card className="space-y-3">
      <h4 className="text-xs font-extrabold text-[var(--ds-text-primary)] m-0 flex items-center gap-1.5">
        <History size={14} className="text-[var(--ds-primary)]" />
        {language === 'ar' ? 'سجل تشغيلات التنبؤ' : 'Forecast Run History'}
      </h4>
      
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {loadingRuns ? (
          <div className="text-xs text-[var(--ds-text-muted)] py-2">
            {language === 'ar' ? 'جاري تحميل السجل...' : 'Loading history...'}
          </div>
        ) : (
          <>
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => loadRunDetails(r.id)}
                className={`w-full text-start p-2.5 rounded-lg border text-xs font-bold block transition-all cursor-pointer ${
                  selectedRun?.run?.id === r.id
                    ? 'border-[var(--ds-primary)] bg-[var(--ds-primary-soft)] text-ink'
                    : 'border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate">{r.forecastMode.replace('_FORECAST', '')}</span>
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-mono">{r.createdAt.substring(11, 16)}</span>
                </div>
              </button>
            ))}
            {runs.length === 0 && (
              <EmptyState
                bare
                className="py-3"
                title={language === 'ar' ? 'لا توجد عمليات سابقة' : 'No previous runs'}
                description={language === 'ar' ? 'ستظهر هنا تشغيلات التنبؤ بعد أول حساب.' : 'Forecast runs will appear here after the first calculation.'}
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
};
