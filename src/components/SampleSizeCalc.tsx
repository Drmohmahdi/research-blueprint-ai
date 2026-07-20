import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { calculatePowerSampleSize, calculateDescriptiveSampleSize, normalCDF, normalInverse } from '../utils/stats';
import { getTranslation } from '../utils/translations';
import { Button } from '../design-system/components/Button';
import { 
  Info, 
  CheckCircle2, 
  Save, 
  TrendingUp 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export const SampleSizeCalc: React.FC = () => {
  const { activeProject, updateProject, language } = useProject();

  const [testType, setTestType] = useState('t_test_independent');
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.80);
  const [effectSize, setEffectSize] = useState(0.5);
  const [attrition, setAttrition] = useState(15); // percent
  const [popSize, setPopSize] = useState<number | undefined>(1000);

  const [result, setResult] = useState({ recommended: 0, adjusted: 0 });
  const [chartData, setChartData] = useState<{ n: number; powerVal: number }[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const allocationGroupCount = testType === 't_test_independent'
    ? 2
    : testType === 'anova_one_way'
      ? Math.max(2, activeProject?.sampleSettings.groupsCount || 2)
      : 1;
  const effectSizeMaximum = testType === 'correlation' ? 0.99 : 5;
  const effectSizePresets = testType === 'correlation'
    ? [{ val: 0.1, labelAr: 'صغير', labelEn: 'Small' }, { val: 0.3, labelAr: 'متوسط', labelEn: 'Medium' }, { val: 0.5, labelAr: 'كبير', labelEn: 'Large' }]
    : [{ val: 0.2, labelAr: 'صغير', labelEn: 'Small' }, { val: 0.5, labelAr: 'متوسط', labelEn: 'Medium' }, { val: 0.8, labelAr: 'كبير', labelEn: 'Large' }];

  useEffect(() => {
    if (activeProject) {
      setAlpha(clamp(activeProject.sampleSettings.marginOfError, 0.001, 0.5));
      setPower(clamp(activeProject.sampleSettings.expectedPower, 0.5, 0.99));
      setEffectSize(clamp(activeProject.sampleSettings.expectedEffectSize, 0.01, 5));
      setAttrition(clamp(activeProject.sampleSettings.expectedAttritionRate * 100, 0, 99));
      setPopSize(activeProject.sampleSettings.populationSize);
    }
  }, [activeProject]);

  useEffect(() => {
    if (activeProject) {
      if (activeProject.studyDesign === 'descriptive') {
        setTestType('descriptive_survey');
      } else if (activeProject.studyDesign === 'correlational' || activeProject.studyDesign === 'predictive') {
        setTestType('correlation');
      } else if (activeProject.studyDesign === 'single_group_pre_post') {
        setTestType('t_test_paired');
      } else {
        setTestType('t_test_independent');
      }
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (testType === 'correlation') {
      setEffectSize(previous => clamp(previous, 0.01, effectSizeMaximum));
    }
  }, [testType, effectSizeMaximum]);

  // Recalculate size and generate chart points
  useEffect(() => {
    let rec = 0;
    if (testType === 'descriptive_survey') {
      rec = calculateDescriptiveSampleSize(popSize, alpha, 1 - alpha);
    } else {
      rec = calculatePowerSampleSize(testType, alpha, power, effectSize, activeProject?.sampleSettings.groupsCount || 2);
    }
    
    const adj = Math.ceil(Math.ceil(rec / (1 - attrition / 100)) / allocationGroupCount) * allocationGroupCount;
    setResult({ recommended: rec, adjusted: adj });

    // Generate chart data: Power vs N
    const points: { n: number; powerVal: number }[] = [];
    const zCrit = normalInverse(1 - alpha / 2);
    
    const maxN = Math.max(160, Math.ceil(rec * 1.5));
    const stepN = Math.max(5, Math.floor(maxN / 15));

    for (let currentN = 10; currentN <= maxN; currentN += stepN) {
      let pVal = 0.5;
      if (testType === 't_test_independent') {
        const delta = effectSize * Math.sqrt(currentN / 4); // per group N/2
        pVal = normalCDF(delta - zCrit);
      } else if (testType === 't_test_paired') {
        const delta = effectSize * Math.sqrt(currentN);
        pVal = normalCDF(delta - zCrit);
      } else if (testType === 'correlation') {
        const correlationMagnitude = Math.min(0.999, Math.max(0.001, Math.abs(effectSize)));
        const fishersZ = 0.5 * Math.log((1 + correlationMagnitude) / (1 - correlationMagnitude));
        const delta = fishersZ * Math.sqrt(Math.max(0, currentN - 3));
        pVal = normalCDF(delta - zCrit);
      } else if (testType === 'anova_one_way') {
        const delta = effectSize * Math.sqrt((currentN * 2) / allocationGroupCount);
        pVal = normalCDF(delta - zCrit);
      } else {
        pVal = 0;
      }
      points.push({ n: currentN, powerVal: Math.min(1, Math.max(0, pVal)) });
    }
    setChartData(points);
  }, [testType, alpha, power, effectSize, attrition, popSize, activeProject, allocationGroupCount]);

  const handleApplyToSettings = () => {
    if (!activeProject) return;
    updateProject({
      ...activeProject,
      sampleSettings: {
        ...activeProject.sampleSettings,
        populationSize: result.adjusted,
        marginOfError: alpha,
        confidenceLevel: 1 - alpha,
        expectedPower: power,
        expectedEffectSize: effectSize,
        expectedAttritionRate: attrition / 100
      }
    });

    setSuccessMessage(
      language === 'ar'
        ? 'تم تحديث حجم العينة المطلوب في إعدادات المشروع النشط بنجاح!'
        : 'Active project required sample size updated successfully!'
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] p-2.5 rounded-xl shadow-lg text-[10px] font-bold">
          <p className="m-0 text-[var(--ds-text-primary)]">
            {language === 'ar' ? `حجم العينة (N): ${data.n}` : `Sample Size (N): ${data.n}`}
          </p>
          <p className="m-0 text-purple-600 dark:text-purple-400">
            {language === 'ar' ? `القوة الإحصائية: ${(data.powerVal * 100).toFixed(0)}%` : `Statistical Power: ${(data.powerVal * 100).toFixed(0)}%`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-bold">{successMessage}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Parameter Settings Block */}
        <div className="lg:col-span-1 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-[var(--ds-text-primary)] m-0">
              {language === 'ar' ? 'معايير حجم العينة' : 'Sample Size Criteria'}
            </h3>
            <p className="text-[10px] text-[var(--ds-text-muted)] font-medium m-0">
              {language === 'ar' ? 'حدد المعايير الإحصائية لحساب العينة المقبولة علمياً.' : 'Set statistical parameters for sample calculation.'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--ds-border-subtle)]">
            <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{getTranslation(language, 'testType')}</label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none text-[var(--ds-text-primary)]"
            >
              <option value="t_test_independent">{language === 'ar' ? 'اختبار ت للمجموعات المستقلة' : 'Independent samples t-test'}</option>
              <option value="t_test_paired">{language === 'ar' ? 'اختبار ت للمجموعات المرتبطة' : 'Paired samples t-test'}</option>
              <option value="anova_one_way">{language === 'ar' ? 'تحليل التباين أحادي الاتجاه (ANOVA)' : 'One-Way ANOVA'}</option>
              <option value="correlation">{language === 'ar' ? 'ارتباط بيرسون (r)' : 'Pearson Correlation'}</option>
              <option value="descriptive_survey">{language === 'ar' ? 'دراسة وصفية مسحية' : 'Descriptive Survey Study'}</option>
            </select>
          </div>

          {/* Alpha & Power */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{getTranslation(language, 'significanceLevel')}</label>
              <input
                type="number"
                min="0.001"
                max="0.5"
                step="0.01"
                value={alpha}
                onChange={(e) => {
                  if (Number.isFinite(e.currentTarget.valueAsNumber)) {
                    setAlpha(clamp(e.currentTarget.valueAsNumber, 0.001, 0.5));
                  }
                }}
                className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none text-[var(--ds-text-primary)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">
                {testType === 'descriptive_survey' ? (language === 'ar' ? 'المجتمع المتاح' : 'Population') : getTranslation(language, 'statisticalPower')}
              </label>
              {testType === 'descriptive_survey' ? (
                <input
                  type="number"
                  value={popSize || ''}
                  onChange={(e) => setPopSize(parseInt(e.target.value) || undefined)}
                  className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none text-[var(--ds-text-primary)]"
                />
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="number"
                    min="0.5"
                    max="0.99"
                    step="0.05"
                    value={power}
                    onChange={(e) => {
                      if (Number.isFinite(e.currentTarget.valueAsNumber)) {
                        setPower(clamp(e.currentTarget.valueAsNumber, 0.5, 0.99));
                      }
                    }}
                    className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none text-[var(--ds-text-primary)]"
                  />
                  {/* Power Presets */}
                  <div className="flex gap-1">
                    {[0.80, 0.90, 0.95].map((pVal) => (
                      <button
                        key={pVal}
                        onClick={() => setPower(pVal)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold cursor-pointer border ${power === pVal ? 'bg-purple-600 text-white border-purple-600' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)] border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-tertiary)]'}`}
                      >
                        {pVal}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Effect Size & Presets */}
          {testType !== 'descriptive_survey' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{getTranslation(language, 'effectSize')}</label>
              <input
                type="number"
                min="0.01"
                max={effectSizeMaximum}
                step="0.05"
                value={effectSize}
                onChange={(e) => {
                  if (Number.isFinite(e.currentTarget.valueAsNumber)) {
                    setEffectSize(clamp(e.currentTarget.valueAsNumber, 0.01, effectSizeMaximum));
                  }
                }}
                className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none text-[var(--ds-text-primary)]"
              />
              <div className="flex gap-1.5">
                {effectSizePresets.map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => setEffectSize(preset.val)}
                    className={`px-2 py-0.5 rounded text-[8px] font-extrabold cursor-pointer border ${effectSize === preset.val ? 'bg-purple-600 text-white border-purple-600' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)] border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-tertiary)]'}`}
                  >
                    {language === 'ar' ? preset.labelAr : preset.labelEn} ({preset.val})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attrition expected */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider">{getTranslation(language, 'attritionExpected')}</label>
            <input
              type="number"
              min="0"
              max="99"
              value={attrition}
              onChange={(e) => {
                if (Number.isFinite(e.currentTarget.valueAsNumber)) {
                  setAttrition(clamp(e.currentTarget.valueAsNumber, 0, 99));
                }
              }}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-bold focus:outline-none text-[var(--ds-text-primary)]"
            />
          </div>
        </div>

        {/* Right Output & Recharts Curve block */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main output numbers */}
          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider block">
                  {getTranslation(language, 'recommendedSample')}
                </span>
                <span className="text-4xl font-black text-purple-600 dark:text-purple-400 block">
                  {result.recommended}
                </span>
                <span className="text-[9px] text-[var(--ds-text-muted)] font-semibold block">
                  {language === 'ar' ? 'الحد الأدنى المقبول إحصائياً' : 'Minimum statistically accepted N'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider block">
                  {getTranslation(language, 'adjustedSample')}
                </span>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block">
                  {result.adjusted}
                </span>
                <span className="text-[9px] text-[var(--ds-text-muted)] font-semibold block">
                  {language === 'ar' ? `تشمل إضافة نسبة فقد متوقعة (${attrition}%)` : `Includes expected attrition rate (${attrition}%)`}
                </span>
              </div>

              {activeProject && (
                <Button
                  onClick={handleApplyToSettings}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5 font-bold cursor-pointer text-xs py-2.5"
                >
                  <Save size={14} />
                  <span>{language === 'ar' ? 'تطبيق حجم العينة على المشروع' : 'Apply Sample Size to Project'}</span>
                </Button>
              )}
            </div>

            <div className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl text-xs space-y-3">
              <h4 className="font-black text-[var(--ds-text-primary)] flex items-center gap-1.5 m-0 text-[11px]">
                <Info size={14} className="text-purple-500" />
                <span>{language === 'ar' ? 'تفاصيل التخصيص للمجموعات' : 'Group Allocation Details'}</span>
              </h4>
              
              <div className="space-y-2 pt-1.5 border-t border-[var(--ds-border-subtle)] font-medium text-[11px] text-[var(--ds-text-secondary)]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">{language === 'ar' ? 'التصميم المستهدف' : 'Target Design'}</span>
                  <span className="font-bold">
                    {testType.includes('independent') || testType.includes('anova') ? (language === 'ar' ? 'متعدد المجموعات' : 'Multi-Group') : (language === 'ar' ? 'مجموعة واحدة' : 'Single Group')}
                  </span>
                </div>
                {testType === 'anova_one_way' ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{language === 'ar' ? 'عدد المجموعات' : 'Groups'}</span>
                      <span className="font-bold">{allocationGroupCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{language === 'ar' ? 'عينة كل مجموعة' : 'Sample per Group'}</span>
                      <span className="font-bold text-purple-600">{result.adjusted / allocationGroupCount}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{language === 'ar' ? 'عينة المجموعة التجريبية' : 'Experimental N'}</span>
                    <span className="font-bold text-purple-600">
                      {testType === 't_test_independent' ? result.adjusted / 2 : result.adjusted}
                    </span>
                  </div>
                )}
                {testType.includes('independent') && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{language === 'ar' ? 'عينة المجموعة الضابطة' : 'Control N'}</span>
                    <span className="font-bold text-purple-600">
                      {result.adjusted / 2}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recharts Power Curve Chart */}
          {testType !== 'descriptive_survey' && chartData.length > 0 && (
            <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-purple-600 dark:text-purple-400" />
                <h4 className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider m-0">
                  {getTranslation(language, 'powerCurve')}
                </h4>
              </div>
              
              <div className="w-full h-52 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-border-subtle)" />
                    <XAxis 
                      dataKey="n" 
                      tick={{ fontSize: 9, fontWeight: 'bold', fill: 'var(--ds-text-secondary)' }} 
                    />
                    <YAxis 
                      domain={[0, 1]} 
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fontSize: 9, fontWeight: 'bold', fill: 'var(--ds-text-secondary)' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="powerVal" 
                      stroke="#8b5cf6" 
                      strokeWidth={3} 
                      dot={false}
                      activeDot={{ r: 6, fill: '#7c3aed' }}
                    />
                    <ReferenceLine 
                      x={result.recommended} 
                      stroke="#7c3aed" 
                      strokeDasharray="4 4"
                      label={{ 
                        value: language === 'ar' ? `الموصى به N=${result.recommended}` : `Recommended N=${result.recommended}`, 
                        fill: 'var(--ds-text-primary)', 
                        fontSize: 9, 
                        position: 'top',
                        fontWeight: 'bold'
                      }} 

                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sensitivity Analysis Card */}
          {testType !== 'descriptive_survey' && (
            <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider m-0">
                {language === 'ar' ? 'تحليل الحساسية للمتغيرات الدخيلة' : 'Sensitivity & Confounder Analysis'}
              </h4>
              <p className="text-xs text-[var(--ds-text-secondary)] leading-relaxed m-0">
                {language === 'ar' 
                  ? 'يقوم هذا النموذج بمحاكاة متى يمكن لمتغير دخيل لم يتم قياسه (Unmeasured Confounder) أن يُلغي الدلالة الإحصائية للنتائج:' 
                  : 'This model simulates the threshold at which an unmeasured confounding variable cancels out the statistical significance of your treatment:'}
              </p>
              <div className="p-3.5 bg-purple-500/5 border border-purple-500/25 rounded-xl text-xs space-y-1">
                <span className="font-black text-purple-600 dark:text-purple-400">
                  {language === 'ar' ? 'عتبة التأثير للمتغير الدخيل:' : 'Confounder Effect Threshold:'}
                </span>{' '}
                <span className="font-mono font-black text-purple-700 dark:text-purple-300">
                  d &gt; {(effectSize * 0.7).toFixed(2)}
                </span>
                <p className="mt-1 mb-0 text-[10px] text-[var(--ds-text-muted)] leading-relaxed font-medium">
                  {language === 'ar'
                    ? `إذا كان للمتغير الدخيل أثر أكبر من ${(effectSize * 0.7).toFixed(2)}، فقد يفقد برنامجك دلالته الإحصائية. يُوصى بالتحكم بمتغير ${activeProject?.variables.find(v => v.type === 'control')?.nameAr || 'التحصيل القبلي'} لزيادة قوة الدراسة.`
                    : `If an unmeasured confounder has an effect size larger than ${(effectSize * 0.7).toFixed(2)}, your findings may lose significance. Controlling for ${activeProject?.variables.find(v => v.type === 'control')?.nameEn || 'prior performance'} is recommended.`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
