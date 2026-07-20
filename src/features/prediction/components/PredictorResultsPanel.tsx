import React from 'react';
import { Card } from '../../../design-system/components/Card';
import { Button } from '../../../design-system/components/Button';
import { MetricCard } from '../../../design-system/components/MetricCard';
import { 
  Scale, 
  AlertTriangle, 
  Award, 
  Activity, 
  ShieldAlert, 
  FileCheck, 
  CheckCircle2, 
  GitBranch, 
  Sparkles, 
  LineChart 
} from 'lucide-react';
import type { usePredictorEngine } from '../usePredictorEngine';

type EngineState = ReturnType<typeof usePredictorEngine>;

interface PredictorResultsPanelProps {
  engine: EngineState;
}

export const PredictorResultsPanel: React.FC<PredictorResultsPanelProps> = ({ engine }) => {
  const {
    selectedRun,
    activeProject,
    observedEffect,
    setObservedEffect,
    observedTMean,
    setObservedTMean,
    observedCMean,
    setObservedCMean,
    observedAttr,
    setObservedAttr,
    addObservedComparison,
    comparisonError,
    getNestedForecast,
    language
  } = engine;
  const inputClass = 'w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]';
  const dangerTone = 'text-[var(--ds-danger)]';
  const successTone = 'text-[var(--ds-success)]';
  const warningBadge = 'bg-[var(--ds-warning-soft)] text-[var(--ds-warning)]';
  const dangerBadge = 'bg-[var(--ds-danger-soft)] text-[var(--ds-danger)]';
  const finiteNumber = (raw: string, fallback: number, min?: number, max?: number) => {
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max ?? value, Math.max(min ?? value, value));
  };

  if (!selectedRun) {
    return (
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-16 text-center text-[var(--ds-text-muted)] italic text-xs">
        {language === 'ar'
          ? 'الرجاء اختيار مصدر البيانات ومستوى الدلالة من القائمة الجانبية، ثم الضغط على "حساب التنبؤ المنهجي".'
          : 'Please configure parameters on the left and trigger prediction calculation.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* V2 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Effect Size Forecast */}
        <MetricCard
          label={language === 'ar' ? 'حجم الأثر المتوقع (Cohen\'s d)' : 'Effect Size Forecast (d)'}
          metric={selectedRun.result.pointEstimate.toFixed(3)}
            description={language === 'ar' ? `فاصل التنبؤ: [${selectedRun.result.lowerInterval.toFixed(2)} ، ${selectedRun.result.upperInterval.toFixed(2)}]` : `Prediction interval: [${selectedRun.result.lowerInterval.toFixed(2)}, ${selectedRun.result.upperInterval.toFixed(2)}]`}
          trend={selectedRun.result.pointEstimate > 0.40 ? 'up' : 'stable'}
          trendLabel={selectedRun.result.pointEstimate > 0.40 ? (language === 'ar' ? 'أثر كبير' : 'Large') : (language === 'ar' ? 'أثر متوسط' : 'Medium')}
          icon={<Scale size={18} className="text-[var(--ds-primary)]" />}
        />

        {/* 2. Attrition Forecast (تسرب العينة) */}
        <MetricCard
          label={language === 'ar' ? 'معدل تسرب العينة (Attrition)' : 'Attrition Forecast'}
          metric={`${((getNestedForecast('attrition')?.pointEstimate ?? activeProject?.sampleSettings?.expectedAttritionRate ?? 0.15) * 100).toFixed(0)}%`}
          description={language === 'ar' 
              ? `فاصل التنبؤ: [${((getNestedForecast('attrition')?.pi_95?.[0] ?? 0.05)*100).toFixed(0)}% ، ${((getNestedForecast('attrition')?.pi_95?.[1] ?? 0.25)*100).toFixed(0)}%]` 
              : `Prediction interval: [${((getNestedForecast('attrition')?.pi_95?.[0] ?? 0.05)*100).toFixed(0)}%, ${((getNestedForecast('attrition')?.pi_95?.[1] ?? 0.25)*100).toFixed(0)}%]`}
          trend={(getNestedForecast('attrition')?.pointEstimate ?? 0.1) > 0.20 ? 'down' : 'stable'}
          trendLabel={(getNestedForecast('attrition')?.pointEstimate ?? 0.1) > 0.20 ? (language === 'ar' ? 'خطر فقد' : 'High attrition') : (language === 'ar' ? 'آمن إحصائياً' : 'Safe')}
          icon={<AlertTriangle size={18} className={(getNestedForecast('attrition')?.pointEstimate ?? 0.1) > 0.20 ? dangerTone : successTone} />}
        />

        {/* 3. Statistical Power Forecast (القوة الإحصائية) */}
        <MetricCard
          label={language === 'ar' ? 'القوة الإحصائية المتوقعة' : 'Statistical Power'}
          metric={`${((getNestedForecast('power')?.pointEstimate ?? 0.80) * 100).toFixed(0)}%`}
          description={language === 'ar' ? 'الحد الأدنى الأكاديمي المقبول هو 80%.' : 'Academic standard is >= 80%.'}
          trend={(getNestedForecast('power')?.pointEstimate ?? 0.80) >= 0.80 ? 'up' : 'down'}
          trendLabel={(getNestedForecast('power')?.pointEstimate ?? 0.80) >= 0.80 ? (language === 'ar' ? 'مكتمل' : 'Power OK') : (language === 'ar' ? 'قوة غير كافية' : 'Underpowered')}
          icon={<Award size={18} className="text-[var(--ds-success)]" />}
        />
      </div>

      {/* Additional Multi-Forecast Panel (Completion & Fidelity Details) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attrition/Completion & Fidelity Info Cards */}
        <Card className="space-y-4">
          <h4 className="text-xs font-bold text-[var(--ds-text-primary)] m-0 flex items-center gap-1.5">
            <Activity size={15} className="text-[var(--ds-primary)]" />
            {language === 'ar' ? 'توقعات البقاء والالتزام بالتدخل' : 'Retention & Fidelity Projections'}
          </h4>
          <div className="space-y-3.5 text-xs text-[var(--ds-text-secondary)]">
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span>{language === 'ar' ? 'نسبة الاحتفاظ بالطلاب (Retention Rate):' : 'Retention Rate:'}</span>
                <span className="text-[var(--ds-success)] font-extrabold">{((getNestedForecast('completion')?.pointEstimate ?? 0.85) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-[var(--ds-surface-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--ds-success)]" style={{ width: `${(getNestedForecast('completion')?.pointEstimate ?? 0.85) * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span>{language === 'ar' ? 'مؤشر التزام المعلمين بالخطة (Fidelity):' : 'Intervention Fidelity:'}</span>
                <span className="text-[var(--ds-primary)] font-extrabold">{((getNestedForecast('fidelity')?.pointEstimate ?? 0.90) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-[var(--ds-surface-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--ds-primary)]" style={{ width: `${(getNestedForecast('fidelity')?.pointEstimate ?? 0.90) * 100}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Methodological Risk Indicator Card */}
        <Card variant={getNestedForecast('risk')?.riskLevel === 'HIGH' ? 'danger' : 'default'} className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className={getNestedForecast('risk')?.riskLevel === 'HIGH' ? 'text-[var(--ds-danger)]' : 'text-[var(--ds-primary)]'} />
            <h4 className="text-xs font-bold text-[var(--ds-text-primary)] m-0">
              {language === 'ar' ? 'مستوى المخاطر المنهجية للدراسة' : 'Methodological Risk Audit'}
            </h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-[var(--ds-text-secondary)] font-semibold">{language === 'ar' ? 'مؤشر الخطورة الكلي:' : 'Risk index score:'}</span>
              <span className="text-sm font-black text-[var(--ds-danger)]">{getNestedForecast('risk')?.score ?? 20}/100</span>
            </div>
            {getNestedForecast('risk')?.reasons?.length > 0 ? (
              <div className="space-y-1 text-[11px] text-[var(--ds-danger)]">
                {getNestedForecast('risk').reasons.map((r: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span>•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-[var(--ds-success)] font-semibold">
                ✓ {language === 'ar' ? 'التصميم آمن إحصائياً ولا توجد ثغرات تسرب.' : 'No major design/attrition flaws identified.'}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Publication Readiness Index Panel */}
      {getNestedForecast('readiness') && (
        <Card className="space-y-4">
          <h4 className="text-xs font-bold text-[var(--ds-text-primary)] m-0 flex items-center gap-1.5">
            <FileCheck size={16} className="text-[var(--ds-success)]" />
            {language === 'ar' ? 'جاهزية الملف والبيانات للنشر الدولي' : 'Publication Readiness Scorecard'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="text-center p-4 bg-[var(--ds-surface-secondary)] rounded-lg">
              <span className="text-[10px] font-bold text-[var(--ds-text-muted)] uppercase block mb-1">{language === 'ar' ? 'معيار الجاهزية للنشر' : 'Readiness Index'}</span>
              <span className="text-3xl font-black text-[var(--ds-primary)]">{getNestedForecast('readiness').score}%</span>
            </div>
            <div className="md:col-span-2 text-xs space-y-2">
              {getNestedForecast('readiness').positives.map((p: string, idx: number) => (
                <div key={idx} className="text-[var(--ds-success)] flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
              {getNestedForecast('readiness').negatives.map((n: string, idx: number) => (
                <div key={idx} className="text-[var(--ds-danger)] flex items-center gap-1.5">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Scenarios benchmarking */}
      <Card className="space-y-4">
        <h3 className="text-sm font-black text-[var(--ds-text-primary)] m-0 flex items-center gap-2">
          <GitBranch size={16} className="text-[var(--ds-primary)]" />
          {language === 'ar' ? 'محاكاة السيناريوهات الخمسة (Scenario Workbench)' : 'Scenario Workbench Benchmarks'}
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start text-[var(--ds-text-secondary)] border-collapse">
            <thead>
              <tr className="border-b border-[var(--ds-border-subtle)] text-[10px] text-[var(--ds-text-muted)] uppercase">
                <th className="py-2.5 pr-2">{language === 'ar' ? 'السيناريو' : 'Scenario'}</th>
                <th className="py-2">{language === 'ar' ? 'الأثر المتوقع (d)' : 'Effect size'}</th>
                <th className="py-2">{language === 'ar' ? 'القوة الإحصائية' : 'Power'}</th>
                <th className="py-2">{language === 'ar' ? 'الدلالة (p)' : 'p-value'}</th>
                <th className="py-2">{language === 'ar' ? 'معدل الحضور/تسرب' : 'Retention/Attrition'}</th>
                <th className="py-2">{language === 'ar' ? 'فاصل الثقة 95%' : '95% Credible range'}</th>
              </tr>
            </thead>
            <tbody>
              {selectedRun.scenarios.map((sc: any, idx: number) => (
                <tr key={idx} className="border-b border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-secondary)] transition-colors">
                  <td className="py-3 pr-2 font-bold text-[var(--ds-text-primary)]">
                    {language === 'ar' 
                      ? sc.scenarioName.replace('Null Effect', 'انعدام التأثير').replace('Conservative', 'المحافظ').replace('Expected', 'المتوقع النموذجي').replace('Optimistic', 'المتفائل').replace('Worst Case', 'الأسوأ خطورة')
                      : sc.scenarioName}
                  </td>
                  <td className="py-3 font-semibold">{sc.expectedEffectSize.toFixed(2)}</td>
                  <td className="py-3 font-bold text-[var(--ds-success)]">{(sc.expectedPower * 100).toFixed(0)}%</td>
                  <td className="py-3 font-mono">{sc.pValue.toFixed(3)}</td>
                  <td className="py-3">{(sc.retained * 100).toFixed(0)}% / {(sc.attrition * 100).toFixed(0)}%</td>
                  <td className="py-3 font-mono text-[10px]">
                    [{sc.predictionIntervalLower !== undefined ? sc.predictionIntervalLower.toFixed(2) : sc.pi_lower !== undefined ? sc.pi_lower.toFixed(2) : '0.00'}, {sc.predictionIntervalUpper !== undefined ? sc.predictionIntervalUpper.toFixed(2) : sc.pi_upper !== undefined ? sc.pi_upper.toFixed(2) : '0.00'}]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Actionable Recommendations Panel */}
      {selectedRun.recommendations && selectedRun.recommendations.length > 0 && (
        <Card variant="ai-accent" className="space-y-4">
          <h4 className="text-xs font-extrabold text-[var(--ds-text-primary)] m-0 flex items-center gap-1.5">
            <Sparkles size={16} className="text-[var(--ds-primary)]" />
            {language === 'ar' ? 'توصيات تشغيلية مدعومة بالذكاء الاصطناعي لمنع الفشل المنهجي' : 'AI-Driven Operational & Methodological Recommendations'}
          </h4>
          <div className="grid grid-cols-1 gap-3.5">
            {selectedRun.recommendations.map((rec: any, idx: number) => (
              <div key={idx} className="p-3.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg flex items-start gap-3">
                <span className={`px-2 py-1 rounded-md text-[8px] font-extrabold shrink-0 ${rec.priority === 'HIGH' ? dangerBadge : warningBadge}`}>
                  {rec.priority === 'HIGH' ? (language === 'ar' ? 'حرجة' : 'HIGH') : (language === 'ar' ? 'متوسطة' : 'MEDIUM')}
                </span>
                <div className="space-y-1 text-xs">
                  <h5 className="font-bold text-[var(--ds-text-primary)] m-0">{rec.title}</h5>
                  <p className="text-[11px] text-[var(--ds-text-secondary)] m-0 leading-relaxed">{rec.rationale}</p>
                  <div className="flex gap-4 pt-1.5 text-[9px] text-[var(--ds-text-muted)] font-semibold">
                    <span>{language === 'ar' ? 'المؤشر المتأثر:' : 'Metric Affected:'} {rec.affectedMetric}</span>
                    <span>•</span>
                    <span>{language === 'ar' ? 'مصدر الدليل:' : 'Evidence Source:'} {rec.evidenceSource}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Predicted vs Observed */}
      <Card className="space-y-4">
        <h3 className="text-sm font-black text-[var(--ds-text-primary)] m-0 flex items-center gap-2">
          <LineChart size={16} className="text-[var(--ds-primary)]" />
          {language === 'ar' ? 'تقييم المطابقة: المتوقع بايزياً مقابل المرصود الفعلي' : 'Evaluation: Predicted vs Observed Outcomes'}
        </h3>

        <div className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-4 text-xs">
          <span className="text-[10px] font-bold text-[var(--ds-text-secondary)] uppercase block">{language === 'ar' ? 'إدخال نتائج القياس الفعلي للدراسة:' : 'Input observed outcome metrics:'}</span>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'حجم الأثر المرصود (d)' : 'Observed Effect Size (d)'}</label>
              <input
                type="number"
                step="0.01"
                value={observedEffect}
                onChange={(e) => setObservedEffect(finiteNumber(e.target.value, observedEffect))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'متوسط قياس التجريبية' : 'Observed Treatment Mean'}</label>
              <input
                type="number"
                step="0.1"
                value={observedTMean}
                onChange={(e) => setObservedTMean(finiteNumber(e.target.value, observedTMean))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'متوسط قياس الضابطة' : 'Observed Control Mean'}</label>
              <input
                type="number"
                step="0.1"
                value={observedCMean}
                onChange={(e) => setObservedCMean(finiteNumber(e.target.value, observedCMean))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'معدل فقدان العينة الفعلي' : 'Observed Attrition Rate'}</label>
              <input
                type="number"
                step="0.01"
                value={observedAttr}
                onChange={(e) => setObservedAttr(finiteNumber(e.target.value, observedAttr, 0, 1))}
                className={inputClass}
              />
            </div>
          </div>

          <Button
            onClick={addObservedComparison}
            variant="primary"
            className="font-bold px-4 py-2 text-xs rounded-lg cursor-pointer"
          >
            {language === 'ar' ? 'تسجيل وتقييم المطابقة الإحصائية' : 'Validate Observed Outcome'}
          </Button>
          {comparisonError && (
            <p role="alert" aria-live="polite" className="text-xs font-bold text-[var(--ds-danger)] m-0">
              {comparisonError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {selectedRun.comparisons && selectedRun.comparisons.map((c: any, idx: number) => (
            <div key={idx} className="p-4 border border-[var(--ds-border-subtle)] rounded-lg text-xs space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-[var(--ds-text-primary)]">{c.observedDatasetName}</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${c.metrics.isWithinInterval ? 'bg-[var(--ds-success-soft)] text-[var(--ds-success)]' : 'bg-[var(--ds-danger-soft)] text-[var(--ds-danger)]'}`}>
                  {c.metrics.isWithinInterval 
                    ? (language === 'ar' ? 'متوافق مع فاصل التنبؤ' : 'Within Prediction Interval') 
                    : (language === 'ar' ? 'خارج النطاق المتوقع' : 'Outside Prediction Interval')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--ds-text-secondary)] pt-1.5 border-t border-[var(--ds-border-subtle)]">
                <div>
                  <span>{language === 'ar' ? 'المتوقع:' : 'Predicted:'}</span>{' '}
                  <span className="font-bold text-[var(--ds-text-primary)] font-mono">{c.metrics.predictedEffectSize.toFixed(2)}</span>
                </div>
                <div>
                  <span>{language === 'ar' ? 'المرصود الفعلي:' : 'Observed:'}</span>{' '}
                  <span className="font-bold text-[var(--ds-text-primary)] font-mono">{c.metrics.observedEffectSize.toFixed(2)}</span>
                </div>
                <div>
                  <span>{language === 'ar' ? 'قيمة الانحراف:' : 'Deviation (Diff):'}</span>{' '}
                  <span className="font-bold text-[var(--ds-text-primary)] font-mono">{c.metrics.effectSizeDiff.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
