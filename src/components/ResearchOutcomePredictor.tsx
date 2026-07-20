import React from 'react';
import { Brain, Sparkles } from 'lucide-react';
import { usePredictorEngine } from '../features/prediction/usePredictorEngine';
import { PredictorInputPanel } from '../features/prediction/components/PredictorInputPanel';
import { PredictorResultsPanel } from '../features/prediction/components/PredictorResultsPanel';
import { PredictorHistoryPanel } from '../features/prediction/components/PredictorHistoryPanel';

export const ResearchOutcomePredictor: React.FC = () => {
  const engine = usePredictorEngine();
  const { language } = engine;

  return (
    <div className="space-y-8 pb-16">
      <div className="relative rounded-lg overflow-hidden bg-[var(--ds-surface-primary)] p-6 md:p-8 border border-[var(--ds-border-subtle)] shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none text-[var(--ds-primary)]">
          <Brain size={260} />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 text-xs font-bold text-[var(--ds-primary)]">
            <Sparkles size={14} />
            <span>{language === 'ar' ? 'محرك التنبؤ V2: بصيرة الاحتمالي' : 'Prediction Engine V2: Baseerah Pro'}</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black m-0 tracking-tight text-[var(--ds-text-primary)]">
            {language === 'ar' ? 'المحرك الاحتمالي المتكامل للنتائج' : 'Probabilistic Outcome Prediction Suite'}
          </h2>
          <p className="text-sm md:text-base text-[var(--ds-text-secondary)] max-w-3xl m-0 leading-relaxed font-medium">
            {language === 'ar'
              ? 'نموذج محاكاة بايزي متطور لتقدير حجم الأثر المنهجي، ومعدلات تسرب العينة، والالتزام ببروتوكولات التجربة قبل وأثناء النزول الميداني للحد من مخاطر النشر والتسرب.'
              : 'Advanced Bayesian simulation suites to forecast effect size, attrition rates, and intervention fidelity prior to field deployment.'}
          </p>
        </div>
      </div>

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
