import React from 'react';
import { Sparkles } from 'lucide-react';
import { PathPanel } from '../design-system/components/Navigation';
import { usePredictorEngine } from '../features/prediction/usePredictorEngine';
import { PredictorInputPanel } from '../features/prediction/components/PredictorInputPanel';
import { PredictorResultsPanel } from '../features/prediction/components/PredictorResultsPanel';
import { PredictorHistoryPanel } from '../features/prediction/components/PredictorHistoryPanel';

export const ResearchOutcomePredictor: React.FC = () => {
  const engine = usePredictorEngine();
  const { language } = engine;

  return (
    <div className="space-y-6 pb-16">
      <PathPanel accent="var(--ds-path-data)">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 text-xs font-bold text-[var(--ds-primary)]">
            <Sparkles size={14} />
            <span>{language === 'ar' ? 'محرك التنبؤ الاحتمالي' : 'Probabilistic Prediction Engine'}</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black m-0 tracking-tight text-ink">
            {language === 'ar' ? 'المحرك الاحتمالي المتكامل للنتائج' : 'Probabilistic Outcome Prediction Suite'}
          </h2>
          <p className="text-sm md:text-base text-secondary max-w-3xl m-0 leading-relaxed font-medium">
            {language === 'ar'
              ? 'نموذج محاكاة بايزي لتقدير حجم الأثر، ومعدلات تسرب العينة، والالتزام بالبروتوكول قبل النزول الميداني.'
              : 'A Bayesian simulation suite to forecast effect size, attrition, and protocol fidelity before field deployment.'}
          </p>
        </div>
      </PathPanel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <PredictorInputPanel engine={engine} />
          <PredictorHistoryPanel engine={engine} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <PredictorResultsPanel engine={engine} />
        </div>
      </div>
    </div>
  );
};
