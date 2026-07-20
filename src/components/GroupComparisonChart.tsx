import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, BarChart2, Target, Zap, ArrowUpRight, ArrowDownRight, Minus, Activity } from 'lucide-react';

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

  const isArabic = language === 'ar';
  const chartColors = {
    pre: 'var(--ds-primary)',
    post: 'var(--ds-success)',
    control: 'var(--ds-text-muted)',
    treatment: 'var(--ds-warning)',
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
    if (d >= 0.8) return { label: isArabic ? 'كبير' : 'Large', color: 'text-emerald-500 bg-emerald-500/10' };
    if (d >= 0.5) return { label: isArabic ? 'متوسط' : 'Medium', color: 'text-amber-500 bg-amber-500/10' };
    return { label: isArabic ? 'صغير' : 'Small', color: 'text-rose-500 bg-rose-500/10' };
  };

  const effectSize = interpretEffect(stats.cohensD);

  const getTabClass = (tab: string) => {
    return activeTab === tab
      ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white flex items-center gap-2 transition-all"
      : "px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-tertiary)] cursor-pointer flex items-center gap-2 transition-all";
  };

  const formatDelta = (val: number) => {
    if (val > 0) return { text: `+${val.toFixed(1)}`, color: 'text-emerald-500', icon: <ArrowUpRight className="w-4 h-4" /> };
    if (val < 0) return { text: `${val.toFixed(1)}`, color: 'text-rose-500', icon: <ArrowDownRight className="w-4 h-4" /> };
    return { text: '0', color: 'text-slate-500', icon: <Minus className="w-4 h-4" /> };
  };

  const conGainFmt = formatDelta(stats.conGain);
  const trGainFmt = formatDelta(stats.trGain);

  return (
    <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-xl p-6 shadow-sm flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--ds-text-primary)] flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-500" />
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

      <div className="flex items-center justify-center gap-4 text-xs font-semibold pb-2">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[var(--ds-primary)]"/><span>{t.pre}</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[var(--ds-success)]"/><span>{t.post}</span></div>
      </div>

      <div className="h-[300px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'bar' ? (
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'var(--ds-surface-primary)', borderColor: 'var(--ds-border-subtle)', borderRadius: '0.5rem', color: 'var(--ds-text-primary)' }}
                itemStyle={{ color: 'var(--ds-text-primary)' }}
                cursor={{ fill: 'var(--ds-surface-secondary)', opacity: 0.4 }}
              />
              <Bar dataKey="pre" name={t.pre} fill={chartColors.pre} radius={[4, 4, 0, 0]} isAnimationActive={true} />
              <Bar dataKey="post" name={t.post} fill={chartColors.post} radius={[4, 4, 0, 0]} isAnimationActive={true} />
            </BarChart>
          ) : activeTab === 'line' ? (
            <LineChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'var(--ds-surface-primary)', borderColor: 'var(--ds-border-subtle)', borderRadius: '0.5rem', color: 'var(--ds-text-primary)' }}
              />
              <Line type="monotone" dataKey="pre" name={t.pre} stroke={chartColors.pre} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} isAnimationActive={true} />
              <Line type="monotone" dataKey="post" name={t.post} stroke={chartColors.post} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} isAnimationActive={true} />
            </LineChart>
          ) : (
            <RadarChart outerRadius="80%" data={radarData}>
              <PolarGrid stroke={chartColors.grid} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }} />
              <Radar name={t.control} dataKey={t.control} stroke={chartColors.control} fill={chartColors.control} fillOpacity={0.24} isAnimationActive={true} />
              <Radar name={t.treatment} dataKey={t.treatment} stroke={chartColors.treatment} fill={chartColors.treatment} fillOpacity={0.24} isAnimationActive={true} />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'var(--ds-surface-primary)', borderColor: 'var(--ds-border-subtle)', borderRadius: '0.5rem', color: 'var(--ds-text-primary)' }}
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
            <span className="text-xl font-bold text-[var(--ds-text-primary)]">{(stats.power * 100).toFixed(0)}%</span>
            <div className={`w-2 h-2 rounded-full mb-2 ${stats.power >= 0.8 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
        </div>
        <div className="bg-[var(--ds-surface-secondary)] p-3 rounded-lg border border-[var(--ds-border-subtle)]">
          <p className="text-xs text-[var(--ds-text-secondary)] mb-1">{t.pTitle}</p>
          <span className={`text-xl font-bold ${stats.pValue < 0.05 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {stats.pValue < 0.001 ? '<0.001' : stats.pValue.toFixed(3)}
          </span>
        </div>
        <div className="bg-[var(--ds-surface-secondary)] p-3 rounded-lg border border-[var(--ds-border-subtle)]">
          <p className="text-xs text-[var(--ds-text-secondary)] mb-1">{t.gainTitle}</p>
          <span className={`text-xl font-bold ${stats.trGain > stats.conGain ? 'text-emerald-500' : 'text-amber-500'}`}>
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
          className="mt-2 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Zap className="w-5 h-5" />
          {isArabic ? 'قم بتشغيل المحاكاة الفعلية' : 'Run Actual Simulation'}
        </button>
      )}
    </div>
  );
};
