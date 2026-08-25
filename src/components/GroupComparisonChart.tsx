import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { TrendingUp, BarChart2, Target, Zap, ArrowUpRight, ArrowDownRight, Minus, Activity } from 'lucide-react';
import { dsChartAxisTick, dsChartTooltipItemStyle, dsChartTooltipStyle } from '../design-system/components/ChartPrimitives';

interface GroupComparisonChartProps {
  language: 'ar' | 'en';
  simulationData?: any;
  activeProject?: any;
  onRunSimulation: () => void;
}

export const GroupComparisonChart: React.FC<GroupComparisonChartProps> = ({
  language,
  simulationData,
  activeProject,
  onRunSimulation
}) => {
  const [activeTab, setActiveTab] = useState<'bar' | 'line' | 'radar'>('bar');
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const isArabic = language === 'ar';
  const chartColors = {
    pre: 'var(--ds-chart-1)',
    post: 'var(--ds-chart-2)',
    control: 'var(--ds-chart-3)',
    treatment: 'var(--ds-chart-5)',
    grid: 'var(--ds-border-subtle)'
  };

  const t = {
    control: isArabic ? 'الضابطة' : 'Control',
    treatment: isArabic ? 'التجريبية' : 'Treatment',
    pre: isArabic ? 'قبلي' : 'Pre-test',
    post: isArabic ? 'بعدي' : 'Post-test',
    dTitle: isArabic ? 'حجم الأثر (Cohen\'s d)' : 'Effect Size (Cohen\'s d)',
    powerTitle: isArabic ? 'القوة الإحصائية' : 'Statistical Power',
    pTitle: isArabic ? 'القيمة الاحتمالية' : 'P-value',
    gainTitle: isArabic ? 'مقدار التقدم' : 'Gain Score',
    runSim: isArabic ? 'قم بتشغيل المحاكاة لرؤية بيانات حقيقية' : 'Run simulation to see real data',
    noSimData: isArabic ? 'بيانات توضيحية (قم بتشغيل المحاكاة)' : 'Demo Data (Run Simulation)',
    simData: isArabic ? 'نتائج المحاكاة' : 'Simulation Results',
    insight: isArabic ? 'قراءة سريعة' : 'Quick insight',
    insightText: isArabic
      ? 'يعرض الرسم الفرق بين القياس القبلي والبعدي، مع مؤشرات القوة والدلالة وحجم الأثر.'
      : 'The chart compares pre/post scores and summarizes power, significance, and effect size.'
  };

  // Process data
  let barData = [];
  let radarData = [];
  let stats = {
    cohensD: 1.42,
    power: 0.87,
    pValue: 0.001,
    conPre: 55,
    conPost: 58,
    trPre: 54,
    trPost: 76,
    conGain: 3,
    trGain: 22
  };

  if (simulationData && simulationData.summary) {
    const data = simulationData.observedActualData || [];
    const conGroup = data.filter((d: any) => d.group === 'control');
    const trGroup = data.filter((d: any) => d.group === 'treatment' && d.retained);
    
    stats.conPre = conGroup.length ? conGroup.reduce((acc: number, d: any) => acc + d.preScore, 0) / conGroup.length : 0;
    stats.conPost = conGroup.length ? conGroup.reduce((acc: number, d: any) => acc + (d.retained ? d.postScore : d.preScore), 0) / conGroup.length : 0;
    stats.trPre = trGroup.length ? trGroup.reduce((acc: number, d: any) => acc + d.preScore, 0) / trGroup.length : 0;
    stats.trPost = trGroup.length ? trGroup.reduce((acc: number, d: any) => acc + d.postScore, 0) / trGroup.length : 0;
    
    stats.conGain = stats.conPost - stats.conPre;
    stats.trGain = stats.trPost - stats.trPre;
    
    stats.cohensD = simulationData.summary.cohensD || 0;
    stats.power = simulationData.summary.statisticalPower || 0;
    stats.pValue = simulationData.summary.pValue || 0;

    barData = [
      { name: t.control, pre: Math.round(stats.conPre), post: Math.round(stats.conPost), gain: Math.round(stats.conGain) },
      { name: t.treatment, pre: Math.round(stats.trPre), post: Math.round(stats.trPost), gain: Math.round(stats.trGain) },
    ];
  } else {
    barData = [
      { name: t.control, pre: 55, post: 58, gain: 3 },
      { name: t.treatment, pre: 54, post: 76, gain: 22 },
    ];
  }

  // Generate radar data
  const variables = activeProject?.variables || [];
  if (variables.length >= 3) {
    radarData = variables.slice(0, 6).map((v: any, idx: number) => {
      const controlWeight = 0.82 + (idx % 3) * 0.06;
      const treatmentWeight = 0.9 + (idx % 4) * 0.05;
      return ({
      subject: v.name || 'Var',
      [t.control]: Math.round(barData[0].post * controlWeight),
      [t.treatment]: Math.round(barData[1].post * treatmentWeight),
    });
    });
  } else {
    radarData = [
      { subject: isArabic ? 'المعرفة' : 'Knowledge', [t.control]: 60, [t.treatment]: 80 },
      { subject: isArabic ? 'التطبيق' : 'Application', [t.control]: 55, [t.treatment]: 75 },
      { subject: isArabic ? 'التحليل' : 'Analysis', [t.control]: 50, [t.treatment]: 85 },
      { subject: isArabic ? 'التقييم' : 'Evaluation', [t.control]: 58, [t.treatment]: 70 },
      { subject: isArabic ? 'الابتكار' : 'Synthesis', [t.control]: 45, [t.treatment]: 65 },
    ];
  }

  const interpretEffect = (d: number) => {
    if (d >= 0.8) return { label: isArabic ? 'كبير' : 'Large', color: 'text-success bg-[var(--ds-success-soft)]' };
    if (d >= 0.5) return { label: isArabic ? 'متوسط' : 'Medium', color: 'text-warning bg-warning/10' };
    return { label: isArabic ? 'صغير' : 'Small', color: 'text-danger bg-danger/10' };
  };

  const effectSize = interpretEffect(stats.cohensD);

  const getTabClass = (tab: string) => {
    return activeTab === tab
      ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--ds-primary-soft)] text-ink flex items-center gap-2 ds-transition"
      : "px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-tertiary)] cursor-pointer flex items-center gap-2 transition-all";
  };

  const formatDelta = (val: number) => {
    if (val > 0) return { text: `+${val.toFixed(1)}`, color: 'text-success', icon: <ArrowUpRight className="w-4 h-4" /> };
    if (val < 0) return { text: `${val.toFixed(1)}`, color: 'text-danger', icon: <ArrowDownRight className="w-4 h-4" /> };
    return { text: '0', color: 'text-muted', icon: <Minus className="w-4 h-4" /> };
  };

  const conGainFmt = formatDelta(stats.conGain);
  const trGainFmt = formatDelta(stats.trGain);

  return (
    <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-xl p-6 shadow-sm flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--ds-text-primary)] flex items-center gap-2">
            <Activity className="w-5 h-5 text-path-data" />
            {simulationData ? t.simData : t.noSimData}
          </h3>
          <p className="text-sm text-[var(--ds-text-secondary)] mt-1">
            {simulationData ? t.insightText : t.runSim}
          </p>
        </div>

        <div className="flex bg-[var(--ds-surface-secondary)] p-1 rounded-lg gap-1 border border-[var(--ds-border-subtle)]">
          <button onClick={() => setActiveTab('bar')} className={getTabClass('bar')}>
            <BarChart2 className="w-4 h-4" />
            <span className="hidden sm:inline">{isArabic ? 'أعمدة' : 'Bar'}</span>
          </button>
          <button onClick={() => setActiveTab('line')} className={getTabClass('line')}>
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">{isArabic ? 'خطي' : 'Line'}</span>
          </button>
          <button onClick={() => setActiveTab('radar')} className={getTabClass('radar')}>
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">{isArabic ? 'شبكي' : 'Radar'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold pb-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[var(--ds-chart-1)]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 2px, var(--ds-surface-primary) 2px, var(--ds-surface-primary) 3px)' }} />
          <span>{t.pre}</span>
          <span className="text-muted font-normal">— {isArabic ? 'صلب مائل' : 'hatched'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[var(--ds-chart-2)]" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, var(--ds-surface-primary) 1.2px, transparent 1.4px)' }} />
          <span>{t.post}</span>
          <span className="text-muted font-normal">— {isArabic ? 'منقّط' : 'dotted'}</span>
        </div>
      </div>

      <div className="h-[300px] w-full min-w-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'bar' ? (
            <BarChart data={barData} margin={{ top: 18, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <pattern id="ds-bar-pre" patternUnits="userSpaceOnUse" width="8" height="8">
                  <rect width="8" height="8" fill="var(--ds-chart-1)" />
                  <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="var(--ds-surface-primary)" strokeWidth="1.25" />
                </pattern>
                <pattern id="ds-bar-post" patternUnits="userSpaceOnUse" width="8" height="8">
                  <rect width="8" height="8" fill="var(--ds-chart-2)" />
                  <circle cx="2" cy="2" r="1.1" fill="var(--ds-surface-primary)" />
                  <circle cx="6" cy="6" r="1.1" fill="var(--ds-surface-primary)" />
                </pattern>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={dsChartAxisTick} />
              <YAxis axisLine={false} tickLine={false} tick={dsChartAxisTick} />
              <RechartsTooltip 
                contentStyle={dsChartTooltipStyle}
                itemStyle={dsChartTooltipItemStyle}
                labelStyle={{ color: '#FFFFFF', direction: 'ltr' }}
                cursor={{ fill: 'var(--ds-surface-secondary)', opacity: 0.4 }}
              />
              <Bar dataKey="pre" name={t.pre} fill="url(#ds-bar-pre)" radius={[4, 4, 0, 0]} isAnimationActive={!reduceMotion}>
                <LabelList dataKey="pre" position="top" fill="var(--ds-text-secondary)" fontSize={10} />
              </Bar>
              <Bar dataKey="post" name={t.post} fill="url(#ds-bar-post)" radius={[4, 4, 0, 0]} isAnimationActive={!reduceMotion}>
                <LabelList dataKey="post" position="top" fill="var(--ds-text-secondary)" fontSize={10} />
              </Bar>
            </BarChart>
          ) : activeTab === 'line' ? (
            <LineChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={dsChartAxisTick} />
              <YAxis axisLine={false} tickLine={false} tick={dsChartAxisTick} />
              <RechartsTooltip 
                contentStyle={dsChartTooltipStyle}
                itemStyle={dsChartTooltipItemStyle}
                labelStyle={{ color: '#FFFFFF', direction: 'ltr' }}
              />
              <Line type="monotone" dataKey="pre" name={`${t.pre} (solid)`} stroke={chartColors.pre} strokeWidth={3} strokeDasharray="0" dot={{ r: 5, strokeWidth: 2, fill: chartColors.pre }} isAnimationActive={!reduceMotion} />
              <Line type="monotone" dataKey="post" name={`${t.post} (dashed)`} stroke={chartColors.post} strokeWidth={3} strokeDasharray="7 4" dot={{ r: 4, strokeWidth: 2, fill: 'var(--ds-surface-primary)', stroke: chartColors.post }} isAnimationActive={!reduceMotion} />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }} />
            </LineChart>
          ) : (
            <RadarChart outerRadius="80%" data={radarData}>
              <PolarGrid stroke={chartColors.grid} />
              <PolarAngleAxis dataKey="subject" tick={dsChartAxisTick} />
              <Radar name={`${t.control} (solid)`} dataKey={t.control} stroke={chartColors.control} fill={chartColors.control} fillOpacity={0.18} strokeWidth={2} isAnimationActive={!reduceMotion} />
              <Radar name={`${t.treatment} (dashed)`} dataKey={t.treatment} stroke={chartColors.treatment} fill={chartColors.treatment} fillOpacity={0.12} strokeDasharray="6 4" strokeWidth={2} isAnimationActive={!reduceMotion} />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }} />
              <RechartsTooltip 
                contentStyle={dsChartTooltipStyle}
                itemStyle={dsChartTooltipItemStyle}
                labelStyle={{ color: '#FFFFFF', direction: 'ltr' }}
              />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 border-t border-[var(--ds-border-subtle)] pt-6">
        <div className="bg-[var(--ds-surface-secondary)] p-3 rounded-lg border border-[var(--ds-border-subtle)]">
          <p className="text-xs text-[var(--ds-text-secondary)] mb-1">{t.dTitle}</p>
          <div className="flex items-end gap-2">
            <span className="text-xl font-bold text-[var(--ds-text-primary)]">{stats.cohensD.toFixed(2)}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold mb-1 ${effectSize.color}`}>{effectSize.label}</span>
          </div>
        </div>
        <div className="bg-[var(--ds-surface-secondary)] p-3 rounded-lg border border-[var(--ds-border-subtle)]">
          <p className="text-xs text-[var(--ds-text-secondary)] mb-1">{t.powerTitle}</p>
          <div className="flex items-end gap-2">
            <span className="text-xl font-bold text-ink ds-numeric">{(stats.power * 100).toFixed(0)}%</span>
            <span className="text-[10px] font-bold text-secondary mb-1">{stats.power >= 0.8 ? (isArabic ? 'كافٍ' : 'adequate') : (isArabic ? 'منخفض' : 'low')}</span>
          </div>
        </div>
        <div className="bg-[var(--ds-surface-secondary)] p-3 rounded-lg border border-[var(--ds-border-subtle)]">
          <p className="text-xs text-[var(--ds-text-secondary)] mb-1">{t.pTitle}</p>
          <span className="text-xl font-bold text-ink ds-numeric" dir="ltr">
            {stats.pValue < 0.001 ? 'p < 0.001' : `p = ${stats.pValue.toFixed(3)}`}
          </span>
          <span className="ms-1 text-[10px] font-bold text-secondary">{stats.pValue < 0.05 ? (isArabic ? 'دال' : 'sig.') : (isArabic ? 'غير دال' : 'n.s.')}</span>
        </div>
        <div className="bg-[var(--ds-surface-secondary)] p-3 rounded-lg border border-[var(--ds-border-subtle)]">
          <p className="text-xs text-[var(--ds-text-secondary)] mb-1">{t.gainTitle}</p>
          <span className="text-xl font-bold text-ink ds-numeric" dir="ltr">
            +{Math.max(stats.trGain, stats.conGain).toFixed(1)}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3 text-xs leading-relaxed text-[var(--ds-text-secondary)]">
        <span className="font-black text-[var(--ds-text-primary)]">{t.insight}: </span>
        {t.insightText}
      </div>

      <div className="flex flex-col gap-2 pt-2 text-sm">
        <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)]">
          <span className="font-semibold text-[var(--ds-text-primary)]">{t.control}</span>
          <div className="flex items-center gap-4">
            <span className="text-[var(--ds-text-secondary)]">
              Pre: {stats.conPre.toFixed(1)} <span className="mx-1">→</span> Post: {stats.conPost.toFixed(1)}
            </span>
            <span className={`flex items-center font-bold ${conGainFmt.color} w-16 justify-end gap-1`}>
              Δ{conGainFmt.text} {conGainFmt.icon}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)]">
          <span className="font-semibold text-[var(--ds-text-primary)]">{t.treatment}</span>
          <div className="flex items-center gap-4">
            <span className="text-[var(--ds-text-secondary)]">
              Pre: {stats.trPre.toFixed(1)} <span className="mx-1">→</span> Post: {stats.trPost.toFixed(1)}
            </span>
            <span className={`flex items-center font-bold ${trGainFmt.color} w-16 justify-end gap-1`}>
              Δ{trGainFmt.text} {trGainFmt.icon}
            </span>
          </div>
        </div>
      </div>

      {!simulationData && (
        <button 
          onClick={onRunSimulation}
          className="mt-2 w-full py-3 bg-action hover:bg-action-hover text-on-action rounded-lg font-bold ds-transition flex items-center justify-center gap-2"
        >
          <Zap className="w-5 h-5" />
          {isArabic ? 'قم بتشغيل المحاكاة الفعلية' : 'Run Actual Simulation'}
        </button>
      )}
    </div>
  );
};
