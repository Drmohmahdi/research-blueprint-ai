import React from 'react';
import { Card } from '../../../design-system/components/Card';
import { Button } from '../../../design-system/components/Button';
import { Gauge, Zap } from 'lucide-react';
import type { usePredictorEngine } from '../usePredictorEngine';

type EngineState = ReturnType<typeof usePredictorEngine>;

interface PredictorInputPanelProps {
  engine: EngineState;
}

export const PredictorInputPanel: React.FC<PredictorInputPanelProps> = ({ engine }) => {
  const {
    readiness,
    loadingReadiness,
    mode,
    setMode,
    alpha,
    setAlpha,
    priorMean,
    setPriorMean,
    priorVariance,
    setPriorVariance,
    pilotTreatment,
    setPilotTreatment,
    pilotControl,
    setPilotControl,
    fidelityRate,
    setFidelityRate,
    attendanceRate,
    setAttendanceRate,
    litStudies,
    setLitStudies,
    triggerPrediction,
    loadingPredict,
    predictionError,
    language
  } = engine;
  const inputClass = 'w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]';
  const rangeClass = 'w-full h-1 bg-[var(--ds-border-subtle)] rounded-lg appearance-none cursor-pointer accent-[var(--ds-primary)]';
  const boundedNumber = (raw: string, fallback: number, min?: number, max?: number) => {
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max ?? value, Math.max(min ?? value, value));
  };
  const modeButtonClass = (active: boolean) =>
    `w-full text-start px-3.5 py-3 rounded-lg border text-xs font-bold flex flex-col gap-1.5 transition-all cursor-pointer ${
      active
        ? 'border-[var(--ds-primary)] bg-[var(--ds-primary-soft)] text-ink'
        : 'border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]'
    }`;
  const activeDotClass = (active: boolean) => `w-2 h-2 rounded-full ${active ? 'bg-[var(--ds-primary)]' : 'bg-[var(--ds-text-muted)]'}`;
  const readinessTone = loadingReadiness
    ? 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)] border border-[var(--ds-border-subtle)]'
    : readiness?.isReady
      ? 'bg-[var(--ds-success-soft)] text-[var(--ds-success)] border border-[var(--ds-success)]/25'
      : 'bg-[var(--ds-warning-soft)] text-[var(--ds-warning)] border border-[var(--ds-warning)]/25';

  return (
    <div className="space-y-6">
      {/* Readiness Index Card */}
      <Card variant="ai-accent" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-h3 text-[var(--ds-text-primary)] flex items-center gap-2 m-0">
            <Gauge size={16} className="text-[var(--ds-primary)]" />
            {language === 'ar' ? 'جاهزية التنبؤ للمشروع' : 'Prediction Readiness Score'}
          </h3>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${readinessTone}`}>
            {loadingReadiness ? (language === 'ar' ? 'جاري التحقق...' : 'Checking...') : readiness?.isReady ? (language === 'ar' ? 'مؤهل للتنبؤ' : 'Eligible') : (language === 'ar' ? 'غير مكتمل الشروط' : 'Incomplete')}
          </span>
        </div>

        {/* Circular score display */}
        <div className="flex items-center gap-4 py-2">
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" fill="transparent" stroke="var(--ds-border-subtle)" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="transparent"
                stroke={readiness?.isReady ? 'var(--ds-success)' : 'var(--ds-warning)'}
                strokeWidth="6"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 * (1 - (readiness?.readinessScore || 0) / 100)}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <span className="text-base font-black">{readiness?.readinessScore}%</span>
          </div>
          <div className="space-y-1">
            <p className="text-caption text-[var(--ds-text-secondary)] m-0">
              {language === 'ar' ? 'نسبة استيفاء شروط الدقة الإحصائية ونزاهة خط الأساس.' : 'Integrity status of research design and pre-registration details.'}
            </p>
          </div>
        </div>

        {readiness?.recommendations && readiness.recommendations.length > 0 && (
          <div className="pt-2 border-t border-[var(--ds-border-subtle)] space-y-1.5">
            <span className="text-[10px] font-bold text-[var(--ds-text-secondary)] uppercase block">
              {language === 'ar' ? 'التحسينات المطلوبة لدقة التنبؤ:' : 'Required improvements:'}
            </span>
            <div className="text-[11px] text-[var(--ds-text-secondary)] space-y-1">
              {readiness.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-[var(--ds-warning)] shrink-0 mt-0.5">•</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Configuration Form */}
      <Card className="space-y-5">
        <h3 className="text-h3 m-0 border-b border-[var(--ds-border-subtle)] pb-2 flex items-center gap-1.5">
          <Zap size={15} className="text-[var(--ds-primary)]" />
          {language === 'ar' ? 'إعدادات ومصادر المحاكاة' : 'Simulator Setup & Sources'}
        </h3>

        <div>
          <label htmlFor="prediction-alpha" className="text-[10px] font-bold text-[var(--ds-text-secondary)] uppercase block mb-1">
            {language === 'ar' ? 'مستوى الدلالة (α)' : 'Significance Level (α)'}
          </label>
          <input
            id="prediction-alpha"
            type="number"
            min="0.001"
            max="0.5"
            step="0.01"
            value={alpha}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (Number.isFinite(value)) {
                setAlpha(Math.min(0.5, Math.max(0.001, value)));
              }
            }}
            className={inputClass}
            aria-describedby="prediction-alpha-help"
          />
          <p id="prediction-alpha-help" className="text-[9px] text-[var(--ds-text-muted)] mt-1 m-0">
            {language === 'ar' ? 'القيمة الافتراضية 0.05 لاختبار ثنائي الطرف.' : 'Default is 0.05 for a two-sided test.'}
          </p>
        </div>

        {/* Mode selection button group */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--ds-text-secondary)] uppercase block">{language === 'ar' ? 'مصدر التنبؤ والبيانات المدخلة:' : 'Forecast Data Source:'}</label>
          
          <button
            onClick={() => setMode('LITERATURE_BASED_FORECAST')}
            className={modeButtonClass(mode === 'LITERATURE_BASED_FORECAST')}
          >
            <span className="flex items-center gap-1.5">
              <span className={activeDotClass(mode === 'LITERATURE_BASED_FORECAST')} />
              {language === 'ar' ? 'تقدير الأدبيات السابقة (Literature)' : 'Literature Meta-Analysis'}
            </span>
            <span className="text-[9px] font-normal text-[var(--ds-text-muted)] pr-3.5">
              {language === 'ar' ? 'دمج حجوم الأثر للدراسات المنشورة المشابهة.' : 'Estimates from prior study cohorts.'}
            </span>
          </button>

          <button
            onClick={() => setMode('PILOT_UPDATED_FORECAST')}
            className={modeButtonClass(mode === 'PILOT_UPDATED_FORECAST')}
          >
            <span className="flex items-center gap-1.5">
              <span className={activeDotClass(mode === 'PILOT_UPDATED_FORECAST')} />
              {language === 'ar' ? 'التحديث البايزي الاستطلاعي (Pilot)' : 'Pilot Study Bayesian Update'}
            </span>
            <span className="text-[9px] font-normal text-[var(--ds-text-muted)] pr-3.5">
              {language === 'ar' ? 'تحديث الفروض الاستباقية بنتائج عينة التجربة المصغرة.' : 'Updates priors with real small-scale cohorts.'}
            </span>
          </button>

          <button
            onClick={() => setMode('IN_STUDY_DYNAMIC_FORECAST')}
            className={modeButtonClass(mode === 'IN_STUDY_DYNAMIC_FORECAST')}
          >
            <span className="flex items-center gap-1.5">
              <span className={activeDotClass(mode === 'IN_STUDY_DYNAMIC_FORECAST')} />
              {language === 'ar' ? 'تليمتري الأنشطة الميداني (Dynamic)' : 'Live Telemetry Dynamic Forecast'}
            </span>
            <span className="text-[9px] font-normal text-[var(--ds-text-muted)] pr-3.5">
              {language === 'ar' ? 'تقدير إحصائي بناءً على الحضور والتزام المعلمين.' : 'Uses real classroom activity logs.'}
            </span>
          </button>
        </div>

        {/* Dynamic input sections */}
        {mode === 'LITERATURE_BASED_FORECAST' && (
          <div className="space-y-3 pt-2 border-t border-[var(--ds-border-subtle)]">
            <span className="text-[10px] font-bold text-[var(--ds-text-secondary)] uppercase block">{language === 'ar' ? 'أوزان الدراسات السابقة:' : 'Literature Prior Cohorts:'}</span>
            {litStudies.map((s, idx) => (
              <div key={idx} className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-[var(--ds-text-secondary)]">
                  <span>{language === 'ar' ? `دراسة سابقة #${idx + 1}` : `Prior Study #${idx + 1}`}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <label className="text-[9px] text-[var(--ds-text-muted)] block">{language === 'ar' ? 'الأثر (d)' : 'Effect size'}</label>
                    <input
                      type="number"
                      step="0.05"
                      value={s.effectSize}
                      onChange={(e) => {
                        const val = boundedNumber(e.target.value, s.effectSize);
                        setLitStudies(prev => prev.map((item, i) => i === idx ? { ...item, effectSize: val } : item));
                      }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[var(--ds-text-muted)] block">{language === 'ar' ? 'التشابه (0-100)' : 'Similarity'}</label>
                    <input
                      type="number"
                      value={s.similarity}
                      onChange={(e) => {
                        const val = boundedNumber(e.target.value, s.similarity, 0, 100);
                        setLitStudies(prev => prev.map((item, i) => i === idx ? { ...item, similarity: val } : item));
                      }}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'PILOT_UPDATED_FORECAST' && (
          <div className="space-y-3 pt-2 border-t border-[var(--ds-border-subtle)]">
            <span className="text-[10px] font-bold text-[var(--ds-text-secondary)] uppercase block">{language === 'ar' ? 'معاملات المجموعات الاستطلاعية:' : 'Pilot Group Data:'}</span>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'المتوسط المتوقع مسبقاً (Prior Mean)' : 'Prior Mean'}</label>
                <input
                  type="number"
                  step="0.05"
                  value={priorMean}
                  onChange={(e) => setPriorMean(boundedNumber(e.target.value, priorMean))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'تباين التوقع المسبق (Prior Variance)' : 'Prior Variance'}</label>
                <input
                  type="number"
                  step="0.01"
                  value={priorVariance}
                  onChange={(e) => setPriorVariance(boundedNumber(e.target.value, priorVariance, 0.0001))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'درجات التجريبية (مفصولة بفاصلة)' : 'Treatment Scores'}</label>
                <input
                  type="text"
                  value={pilotTreatment}
                  onChange={(e) => setPilotTreatment(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--ds-text-secondary)] block font-medium mb-1">{language === 'ar' ? 'درجات الضابطة (مفصولة بفاصلة)' : 'Control Scores'}</label>
                <input
                  type="text"
                  value={pilotControl}
                  onChange={(e) => setPilotControl(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {mode === 'IN_STUDY_DYNAMIC_FORECAST' && (
          <div className="space-y-4 pt-2 border-t border-[var(--ds-border-subtle)]">
            <span className="text-[10px] font-bold text-[var(--ds-text-secondary)] uppercase block">{language === 'ar' ? 'تليمتري الأنشطة الميدانية:' : 'Live Cohort Inputs:'}</span>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>{language === 'ar' ? 'معدل التزام المعلمين بالبروتوكول:' : 'Teacher Fidelity Rate:'}</span>
                  <span className="text-ink font-bold ds-numeric">{(fidelityRate * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.01"
                  value={fidelityRate}
                  onChange={(e) => setFidelityRate(parseFloat(e.target.value))}
                  className={rangeClass}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>{language === 'ar' ? 'معدل حضور ومشاركة العينة:' : 'Student Attendance Rate:'}</span>
                  <span className="text-ink font-bold ds-numeric">{(attendanceRate * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.01"
                  value={attendanceRate}
                  onChange={(e) => setAttendanceRate(parseFloat(e.target.value))}
                  className={rangeClass}
                />
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={triggerPrediction}
          disabled={loadingPredict || !readiness?.isReady}
          className="w-full py-3 text-xs font-black shadow-sm cursor-pointer"
        >
          {loadingPredict ? (language === 'ar' ? 'جاري المحاكاة والاحتمال...' : 'Running Bayesian Update...') : (language === 'ar' ? 'محاكاة تقدير النتائج والاحتمال' : 'Run Outcome Forecast')}
        </Button>
        {predictionError && (
          <p role="alert" aria-live="polite" className="text-caption font-bold text-[var(--ds-danger)] m-0">
            {predictionError}
          </p>
        )}
      </Card>
    </div>
  );
};
