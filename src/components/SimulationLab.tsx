import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import type { SimulationParameters } from '../types/research';
import { getTranslation } from '../utils/translations';
import { Button } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import { 
  PlayCircle, 
  TrendingUp, 
  Sliders,
  Sparkles
} from 'lucide-react';
import { EmptyState } from '../design-system/components/Feedback';
import { EmptyActiveProject } from './EmptyActiveProject';
import { dsChartAxisTick, dsChartTooltipItemStyle, dsChartTooltipStyle } from '../design-system/components/ChartPrimitives';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  CartesianGrid 
} from 'recharts';

export const SimulationLab: React.FC = () => {
  const { activeProject, runProjectSimulation, simulationResults, language } = useProject();

  const [preMean, setPreMean] = useState(55);
  const [preSd, setPreSd] = useState(12);
  const [gain, setGain] = useState(15); // Average points gain
  const [gainType, setGainType] = useState<'fixed' | 'relative' | 'regression'>('relative');
  const [fidelity, setFidelity] = useState(85); // percent
  const [attrition, setAttrition] = useState(15); // percent
  const [seed, setSeed] = useState(42);
  const [loading, setLoading] = useState(false);
  const [lastRunSignature, setLastRunSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rangeClass = 'w-full accent-[var(--ds-primary)] cursor-pointer h-1.5 bg-[var(--ds-surface-secondary)] rounded-lg appearance-none';
  const valueClass = 'text-xs font-mono font-bold text-ink ds-numeric';
  const chartColors = {
    pre: 'var(--ds-chart-1)',
    post: 'var(--ds-chart-2)'
  };

  if (!activeProject) {
    return (
      <EmptyActiveProject
        language={language}
        illustration={<PlayCircle size={40} />}
        description={language === 'ar' ? 'أنشئ مشروعًا من اختيار المسار لتشغيل محاكاة المجموعات.' : 'Create a project from path selection to run the group simulation.'}
      />
    );
  }

  const currentRunSignature = JSON.stringify({
    projectId: activeProject.id,
    preMean,
    preSd,
    gain,
    gainType,
    fidelity,
    attrition,
    seed
  });
  const result = simulationResults[activeProject.id];
  const hasCurrentResults = Boolean(result && lastRunSignature === currentRunSignature);
  const configuredSampleSize = activeProject.sampleSettings.populationSize || 60;
  const simulationSampleSize = Math.min(configuredSampleSize, 80);
  const sampleSizeNotice = configuredSampleSize > 80
    ? (language === 'ar'
      ? `سيُستخدم ${simulationSampleSize} مشاركاً كحد أقصى للمحاكاة المحلية، بينما حجم المشروع ${configuredSampleSize}.`
      : `The local simulation uses at most ${simulationSampleSize} participants; the project size is ${configuredSampleSize}.`)
    : (language === 'ar'
      ? `حجم العينة المستخدم في المحاكاة: ${simulationSampleSize} مشاركاً.`
      : `Simulation sample size: ${simulationSampleSize} participants.`);
  const publicationIndicator = result && result.summary.pValue < 0.05 && result.summary.statisticalPower >= 0.8 && Math.abs(result.summary.cohensD) >= 0.2
    ? (language === 'ar' ? 'مؤشرات أولية واعدة؛ لا تغني عن التحليل والتحكيم' : 'Promising preliminary indicators; analysis and peer review are still required')
    : result && result.summary.pValue < 0.05
      ? (language === 'ar' ? 'دال في هذا التشغيل فقط؛ راجع القوة وحجم الأثر قبل الاستنتاج' : 'Significant in this run only; review power and effect size before concluding')
      : (language === 'ar' ? 'لا توجد دلالة كافية في هذا التشغيل؛ راجع حجم العينة والافتراضات' : 'Insufficient significance in this run; review sample size and assumptions');

  const handleSimulate = async () => {
    setLoading(true);
    setErrorMessage(null);
    setLastRunSignature(null);
    const params: SimulationParameters = {
      preTestMean: preMean,
      preTestSd: preSd,
      expectedGain: gainType === 'relative' ? gain / 100 : gain,
      gainType,
      errorSd: 6,
      interventionEngagement: fidelity / 100,
      attritionRate: attrition / 100,
      maxScore: 100,
      seed,
      iterations: 1000 // Monte Carlo iterations
    };
    try {
      await runProjectSimulation(params);
      setLastRunSignature(currentRunSignature);
    } catch (e) {
      console.error(e);
      setErrorMessage(language === 'ar'
        ? 'تعذر تشغيل المحاكاة. تحقق من الاتصال أو بيانات المشروع ثم حاول مرة أخرى.'
        : 'The simulation could not run. Check the connection or project data and try again.');
    } finally {
      setLoading(false);
    }
  };

  const chartData = hasCurrentResults && result ? [
    {
      name: language === 'ar' ? 'الضابطة' : 'Control',
      [language === 'ar' ? 'قبلي' : 'Pre-test']: result.summary.preMeanControl,
      [language === 'ar' ? 'بعدي' : 'Post-test']: result.summary.postMeanControl
    },
    {
      name: language === 'ar' ? 'التجريبية' : 'Treatment',
      [language === 'ar' ? 'قبلي' : 'Pre-test']: result.summary.preMeanTreatment,
      [language === 'ar' ? 'بعدي' : 'Post-test']: result.summary.postMeanTreatment
    }
  ] : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <PathPanel accent="var(--ds-path-data)">
        <div className="space-y-1">
          <h2 className="text-h2 text-ink m-0">
            {language === 'ar' ? 'مختبر المحاكاة الإحصائية' : 'Statistical Simulation Lab'}
          </h2>
          <p className="text-caption text-secondary m-0">
            {language === 'ar'
              ? 'جرّب سيناريوهات الأثر قبل التنفيذ الميداني، مع تثبيت البذرة لإعادة الإنتاج.'
              : 'Test outcome scenarios before field execution, with a fixed seed for reproducibility.'}
          </p>
        </div>
      </PathPanel>
      {/* Parameters Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Parameters input form */}
        <div className="lg:col-span-1 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-h3 text-[var(--ds-text-primary)] m-0 flex items-center gap-1.5">
              <Sliders size={16} className="text-[var(--ds-primary)]" />
              <span>{language === 'ar' ? 'معلمات المحاكاة' : 'Simulation Parameters'}</span>
            </h3>
            <p className="text-[10px] text-[var(--ds-text-muted)] font-medium m-0">
              {language === 'ar' ? 'اسحب المنزلق لتجربة فرضيات ودراسة سيناريوهات الأثر.' : 'Drag the sliders to test hypotheses and simulate outcomes.'}
            </p>
            <p className="text-[10px] text-[var(--ds-warning)] font-bold m-0" role="note">
              {sampleSizeNotice}
            </p>
          </div>

          <div className="space-y-4 pt-3 border-t border-[var(--ds-border-subtle)]">
            {/* Pre-Mean Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'متوسط القبلي' : 'Pre-Mean'}</label>
                <span className={valueClass}>{preMean}</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={preMean}
                onChange={(e) => setPreMean(parseInt(e.target.value) || 0)}
                className={rangeClass}
              />
            </div>

            {/* Pre-SD Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'الانحراف المعياري' : 'Pre-SD'}</label>
                <span className={valueClass}>{preSd}</span>
              </div>
              <input
                type="range"
                min="2"
                max="25"
                value={preSd}
                onChange={(e) => setPreSd(parseInt(e.target.value) || 1)}
                className={rangeClass}
              />
            </div>

            {/* Gain Model Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'نموذج التحسن' : 'Gain Model'}</label>
              <select
                value={gainType}
                onChange={(e) => setGainType(e.target.value as any)}
                className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] text-[var(--ds-text-primary)]"
              >
                <option value="fixed">{language === 'ar' ? 'تحسن ثابت (مطلق)' : 'Fixed gain'}</option>
                <option value="relative">{language === 'ar' ? 'تحسن نسبي' : 'Relative gain'}</option>
                <option value="regression">{language === 'ar' ? 'نموذج انحدار متعدد' : 'Regression model'}</option>
              </select>
            </div>

            {/* Gain Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">
                  {gainType === 'relative' ? (language === 'ar' ? 'نسبة التحسن (%)' : 'Gain (%)') : (language === 'ar' ? 'قيمة التحسن' : 'Gain Points')}
                </label>
                <span className={valueClass}>
                  {gain}{gainType === 'relative' ? '%' : ''}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max={gainType === 'relative' ? '100' : '40'}
                value={gain}
                onChange={(e) => setGain(parseInt(e.target.value) || 0)}
                className={rangeClass}
              />
            </div>

            {/* Fidelity Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'سلامة تطبيق التدخل (%)' : 'Fidelity (%)'}</label>
                <span className={valueClass}>{fidelity}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="100"
                value={fidelity}
                onChange={(e) => setFidelity(parseInt(e.target.value) || 100)}
                className={rangeClass}
              />
            </div>

            {/* Attrition Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'الفقد المتوقع (%)' : 'Attrition (%)'}</label>
                <span className={valueClass}>{attrition}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={attrition}
                onChange={(e) => setAttrition(parseInt(e.target.value) || 0)}
                className={rangeClass}
              />
            </div>

            {/* Random Seed */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'البذرة العشوائية (Seed)' : 'Random Seed'}</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 1)}
                className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] text-[var(--ds-text-primary)]"
              />
            </div>

            <Button
              onClick={handleSimulate}
              disabled={loading}
              variant="primary"
              className="w-full flex items-center justify-center gap-1.5 font-bold cursor-pointer text-xs py-2.5"
            >
              <PlayCircle size={16} />
              <span>{loading ? (language === 'ar' ? 'جاري المحاكاة...' : 'Simulating...') : getTranslation(language, 'simulateBtn')}</span>
            </Button>
            {errorMessage && (
              <p role="alert" className="text-caption font-bold text-[var(--ds-danger)]" aria-live="polite">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Simulation Results details & comparisons */}
        <div className="lg:col-span-2 space-y-6">
          {hasCurrentResults && result ? (
            <div className="space-y-6">
              {/* Simulation metrics overview */}
              <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-[var(--ds-border-subtle)]">
                  <h4 className="text-h4 text-[var(--ds-text-primary)] m-0 flex items-center gap-1.5">
                    <Sparkles size={16} className="text-[var(--ds-primary)]" />
                    <span>{language === 'ar' ? 'ملخص مخرجات محاكاة مونت كارلو' : 'Monte Carlo Simulation Summary'}</span>
                  </h4>
                  <span className="text-[9px] font-black bg-[var(--ds-data-teal-soft)] text-[var(--ds-data-teal)] border border-[var(--ds-data-teal)]/20 px-2 py-0.5 rounded">
                    SIMULATED_SYNTHETIC_DATA
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 bg-[var(--ds-surface-secondary)] rounded-xl space-y-1">
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider block">{language === 'ar' ? 'متوسط التجريبية البعدي' : 'Post Mean (TR)'}</span>
                    <span className="text-base font-black text-ink ds-numeric">{result.summary.postMeanTreatment}</span>
                  </div>
                  <div className="p-3.5 bg-[var(--ds-surface-secondary)] rounded-xl space-y-1">
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider block">{language === 'ar' ? 'متوسط الضابطة البعدي' : 'Post Mean (CON)'}</span>
                    <span className="text-base font-black text-ink ds-numeric">{result.summary.postMeanControl}</span>
                  </div>
                  <div className="p-3.5 bg-[var(--ds-surface-secondary)] rounded-xl space-y-1">
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider block">{language === 'ar' ? 'حجم الأثر الناتج (d)' : 'Simulated Cohen\'s d'}</span>
                    <span className="text-base font-black text-ink ds-numeric">{result.summary.cohensD}</span>
                  </div>
                  <div className="p-3.5 bg-[var(--ds-surface-secondary)] rounded-xl space-y-1">
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider block">{language === 'ar' ? 'القوة الإحصائية المحققة' : 'Simulated Power'}</span>
                    <span className="text-base font-black text-success ds-numeric">{(result.summary.statisticalPower * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 bg-[var(--ds-surface-secondary)] rounded-xl space-y-1">
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider block">{language === 'ar' ? 'الفقد الناتج (تسرب)' : 'Attrition Count'}</span>
                    <span className="text-xs font-black text-danger ds-numeric">{result.summary.attritionCount} {language === 'ar' ? 'طلاب' : 'students'}</span>
                  </div>
                  <div className="p-3.5 bg-[var(--ds-surface-secondary)] rounded-xl space-y-1">
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider block">{language === 'ar' ? 'احتمال الدلالة (p-value)' : 'Simulated p-value'}</span>
                    <span className="text-xs font-black text-ink ds-numeric" dir="ltr">{result.summary.pValue}</span>
                  </div>
                  <div className="p-3.5 bg-[var(--ds-surface-secondary)] rounded-xl space-y-1 col-span-2">
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider block">{language === 'ar' ? 'مؤشر أولي لقابلية النشر' : 'Preliminary Publication Indicator'}</span>
                    <span className="text-xs font-black text-[var(--ds-text-primary)]">
                      {publicationIndicator}
                    </span>
                  </div>
                </div>
              </div>

              {/* Group Comparison Recharts BarChart */}
              <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--ds-border-subtle)]">
                  <TrendingUp size={14} className="text-[var(--ds-primary)]" />
                  <h4 className="text-h4 text-[10px] text-[var(--ds-text-secondary)] uppercase m-0">
                    {language === 'ar' ? 'المقارنة الإحصائية للمجموعات (قبل التدخل وبعده)' : 'Statistical Group Comparison (Pre vs Post)'}
                  </h4>
                </div>
                
                <div className="h-64 w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-3" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-border-subtle)" />
                      <XAxis dataKey="name" tick={dsChartAxisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={dsChartAxisTick} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={dsChartTooltipStyle}
                        itemStyle={dsChartTooltipItemStyle}
                        labelStyle={{ color: '#FFFFFF', direction: 'ltr' }}
                      />
                      <Bar dataKey={language === 'ar' ? 'قبلي' : 'Pre-test'} fill={chartColors.pre} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey={language === 'ar' ? 'بعدي' : 'Post-test'} fill={chartColors.post} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Simulated Dataset Table Preview */}
              <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-3">
                <h4 className="text-h4 text-[var(--ds-text-primary)] m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
                  {language === 'ar' ? 'عينة الطلاب المحاكاة (جدول البيانات)' : 'Simulated Students Sample Dataset'}
                </h4>

                <div className="max-h-60 overflow-y-auto no-scrollbar border border-[var(--ds-border-subtle)] rounded-lg">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] sticky top-0 font-bold">
                      <tr>
                        <th className="p-2.5">{language === 'ar' ? 'معرف الطالب' : 'Student ID'}</th>
                        <th className="p-2.5">{language === 'ar' ? 'المجموعة' : 'Group'}</th>
                        <th className="p-2.5">{language === 'ar' ? 'درجة قبلية' : 'Pre Score'}</th>
                        <th className="p-2.5">{language === 'ar' ? 'درجة بعدية محاكاة' : 'Post Score'}</th>
                        <th className="p-2.5">{language === 'ar' ? 'التزام' : 'Fidelity'}</th>
                        <th className="p-2.5">{language === 'ar' ? 'مستمر' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle text-[var(--ds-text-secondary)]">
                      {result.observedActualData.slice(0, 10).map((row) => (
                        <tr key={row.studentId} className="hover:bg-surface-subtle/60 transition-colors">
                          <td className="p-2.5 font-mono">{row.studentId}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.group === 'treatment' ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]'}`}>
                              {row.group}
                            </span>
                          </td>
                          <td className="p-2.5 ds-numeric">{row.preScore}</td>
                          <td className="p-2.5 font-bold text-ink ds-numeric">
                            {row.retained ? row.postScore : (language === 'ar' ? 'مفقود' : 'Dropped')}
                          </td>
                          <td className="p-2.5 ds-numeric">{(row.engagement * 100).toFixed(0)}%</td>
                          <td className="p-2.5">
                            <span className={`w-2 h-2 rounded-full inline-block ${row.retained ? 'bg-action' : 'bg-danger'}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center text-[10px] text-[var(--ds-text-muted)] mt-2">
                  <span>{language === 'ar' ? 'معروض أول 10 صفوف من العينة' : 'Showing first 10 rows of dataset'}</span>
                  <span>[ التصنيف: SIMULATED_SYNTHETIC_DATA ]</span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              className="h-[400px] justify-center"
              illustration={<PlayCircle size={40} />}
              title={language === 'ar' ? 'لا توجد نتائج محاكاة بعد' : 'No simulation results yet'}
              description={language === 'ar'
                ? 'أدخل معلمات المحاكاة وشغّل المحرك لعرض المخططات والنتائج.'
                : 'Configure the parameters and run the engine to visualize charts and results.'}
            />
          )}
        </div>
      </div>
    </div>
  );
};
