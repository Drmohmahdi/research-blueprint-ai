import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Globe, 
  ShieldAlert,
  User,
  Activity,
  CheckSquare
} from 'lucide-react';

interface Channel {
  name: string;
  url: string;
  status: 'linked' | 'missing' | 'optional';
  priority: 'critical' | 'important' | 'optional';
  desc: string;
}

export const AcademicVisibilityDashboard: React.FC = () => {
  const { language } = useProject();
  const isAr = language === 'ar';

  // State
  const [preferredNameAr, setPreferredNameAr] = useState('أ.د. أحمد محمد الغامدي');
  const [preferredNameEn, setPreferredNameEn] = useState('Ahmed M. Al-Ghamdi');
  const [nameVariants, setNameVariants] = useState('A. M. Alghamdi; Ahmed Alghamdi');
  const [discipline] = useState(isAr ? 'تقنيات التعليم والذكاء الاصطناعي' : 'Educational Technology & AI');
  
  const [channels] = useState<Channel[]>([
    { name: 'ORCID', url: 'https://orcid.org/0000-0002-1823-921X', status: 'linked', priority: 'critical', desc: isAr ? 'المعرّف الدولي الموحد للباحثين.' : 'Unified international researcher registry.' },
    { name: 'Google Scholar', url: 'https://scholar.google.com/citations?user=xyz', status: 'linked', priority: 'critical', desc: isAr ? 'حساب الاستشهادات ومتابعة مؤشر h-index.' : 'Citation index tracker and h-index calculator.' },
    { name: 'Scopus Author ID', url: '', status: 'missing', priority: 'critical', desc: isAr ? 'ملفك في قاعدة Elsevier (يوجد ملفان مكرران).' : 'Elsevier profile (detected 2 duplicate profiles).' },
    { name: 'ResearchGate', url: 'https://researchgate.net/profile/Ahmed_Al_Ghamdi', status: 'linked', priority: 'important', desc: isAr ? 'شبكة التواصل الأكاديمية ونشر الأبحاث الكاملة.' : 'Academic social network and full-text repository.' },
    { name: 'LinkedIn', url: '', status: 'optional', priority: 'important', desc: isAr ? 'التواصل المهني وبناء السمعة خارج الأكاديميا.' : 'Professional networking and industry reputation.' },
    { name: 'GitHub', url: 'https://github.com/ahmed-alghamdi', status: 'linked', priority: 'optional', desc: isAr ? 'مستودع الكود البرمجي للمحاكاة والتحليل.' : 'Code repository for simulations and statistical analyses.' },
  ]);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Bio Statements
  const shortBio = isAr 
    ? `باحث متخصص في ${discipline} يركز على الوكلاء الأذكياء وتخصيص التعلم القائم على البيانات.`
    : `Researcher in ${discipline} specializing in intelligent agents and data-driven learning personalization.`;

  const mediumBio = isAr
    ? `أستاذ متخصص في ${discipline}. تركز أبحاثه الحالية على نمذجة المتغيرات المنهجية وبناء المخططات المفاهيمية الذكية. يشرف على مشاريع محاكاة البيانات وتطبيقات التعلم التكيفي، وحائز على عدة استشهادات علمية في مجلات Q1 مفهرسة.`
    : `Professor in ${discipline}. Active research focuses on methodological variable modeling and smart conceptual blueprints. Directs data simulation initiatives and adaptive learning systems with publications in high-impact Q1 indexed journals.`;

  const keywords = isAr
    ? 'تقنيات التعليم، الذكاء الاصطناعي التوليدي، الوكلاء الأذكياء، محاكاة مونت كارلو، المنهج التجريبي التعليمي'
    : 'Educational Technology, Generative AI, Intelligent Agents, Monte Carlo Simulation, Quasi-Experimental Design';

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Rep Plan
  const [repTasks, setRepTasks] = useState([
    { id: '1', taskAr: 'دمج ملفي Scopus Author ID المكررين لتجميع الاستشهادات.', taskEn: 'Request merge of 2 duplicate Scopus Author ID profiles.', done: false, impact: 'High' },
    { id: '2', taskAr: 'تحديث حساب ORCID وربطه بـ DOI للأبحاث الثلاثة الأخيرة.', taskEn: 'Update ORCID with DOIs of the latest 3 publications.', done: true, impact: 'High' },
    { id: '3', taskAr: 'تنظيف Google Scholar من الأوراق غير التابعة لي ذات الأسماء المتشابهة.', taskEn: 'Clean Google Scholar citations from same-name author publications.', done: false, impact: 'Medium' },
    { id: '4', taskAr: 'إضافة رابط الصفحة الشخصية الجامعية إلى LinkedIn و ResearchGate.', taskEn: 'Link university homepage profile to LinkedIn and ResearchGate.', done: false, impact: 'Low' },
  ]);

  const toggleTask = (id: string) => {
    setRepTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  // Visibility calculation
  const linkedCount = channels.filter(c => c.status === 'linked').length;
  const tasksCompleted = repTasks.filter(t => t.done).length;
  
  const overallVisibilityScore = Math.round(
    ((linkedCount / channels.length) * 60) + ((tasksCompleted / repTasks.length) * 40)
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-900/10 to-transparent border border-indigo-500/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={20} className="text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {isAr ? 'الهوية الرقمية والانتشار الأكاديمي للباحثين' : 'Academic Identity & Visibility Suite'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">
            {isAr ? 'بصيرة للهوية والانتشار الأكاديمي' : 'Baseerah Academic Visibility'}
          </h2>
          <p className="text-sm text-[var(--ds-text-secondary)] max-w-2xl m-0 leading-relaxed">
            {isAr
              ? 'ابنِ حضورك الرقمي المتسق، ووحد صياغة اسمك العلمي، وراجع اتساق ملفاتك على Scopus و Google Scholar لتعظيم الاستشهادات.'
              : 'Build a consistent digital footprint, unify your academic name formats, and audit profiles on Scopus and Google Scholar to optimize citation tracking.'}
          </p>
        </div>

        {/* Global visibility Score */}
        <div className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[9px] text-[var(--ds-text-muted)] font-black block uppercase">{isAr ? 'مؤشر الانتشار الكلي' : 'Visibility Score'}</span>
            <span className="text-2xl font-black text-indigo-500 block">{overallVisibilityScore}%</span>
          </div>
          <div className="h-10 w-[1px] bg-[var(--ds-border-subtle)]" />
          <Activity size={24} className="text-indigo-500 animate-pulse" />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Name audit + Bio Generator (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Identity audit */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <User className="text-indigo-500" size={16} />
              <span>{isAr ? 'تدقيق الاتساق والاسم الأكاديمي' : 'Academic Name Consistency Audit'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">{isAr ? 'الاسم المفضّل (عربي):' : 'Preferred Name (Arabic):'}</label>
                <input
                  type="text"
                  value={preferredNameAr}
                  onChange={e => setPreferredNameAr(e.target.value)}
                  className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">{isAr ? 'الاسم المفضل (إنجليزي):' : 'Preferred Name (English):'}</label>
                <input
                  type="text"
                  value={preferredNameEn}
                  onChange={e => setPreferredNameEn(e.target.value)}
                  className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col space-y-1 sm:col-span-2">
                <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                  {isAr ? 'الصيغ البديلة المكتشفة في المجلات (Name Variants):' : 'Identified Name Variants in Journals:'}
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={nameVariants}
                    onChange={e => setNameVariants(e.target.value)}
                    className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none"
                  />
                  <div className="flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl shrink-0">
                    <ShieldAlert size={12} className="shrink-0" />
                    <span>{isAr ? 'خطر تشتت الاستشهاد' : 'Citation Split Risk'}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Unified Profile Bio Generator */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <Sparkles className="text-indigo-500" size={16} />
              <span>{isAr ? 'مولد السيرة والنبذة الأكاديمية الموحدة' : 'Unified Academic Biography Generator'}</span>
            </h3>

            <div className="space-y-4">
              
              {/* Short Bio */}
              <div className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                    {isAr ? 'النبذة المختصرة (لـ ORCID / Twitter):' : 'Short Biography (for ORCID / Twitter):'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(shortBio, 1)}
                    className="p-1 rounded hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                  >
                    <Copy size={11} />
                    <span>{copiedIndex === 1 ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}</span>
                  </button>
                </div>
                <p className="text-xs font-bold text-[var(--ds-text-secondary)] m-0 leading-relaxed">{shortBio}</p>
              </div>

              {/* Medium Bio */}
              <div className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                    {isAr ? 'السيرة المتوسطة (لـ ResearchGate / LinkedIn):' : 'Professional Biography (for ResearchGate / LinkedIn):'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(mediumBio, 2)}
                    className="p-1 rounded hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                  >
                    <Copy size={11} />
                    <span>{copiedIndex === 2 ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}</span>
                  </button>
                </div>
                <p className="text-xs font-bold text-[var(--ds-text-secondary)] m-0 leading-relaxed">{mediumBio}</p>
              </div>

              {/* Keywords */}
              <div className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                    {isAr ? 'الكلمات المفتاحية الموحدة للتخصيص المنهجي:' : 'Unified Subject Keywords & Tags:'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(keywords, 3)}
                    className="p-1 rounded hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                  >
                    <Copy size={11} />
                    <span>{copiedIndex === 3 ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}</span>
                  </button>
                </div>
                <p className="text-xs font-bold text-[var(--ds-text-secondary)] m-0 leading-relaxed font-mono">{keywords}</p>
              </div>

            </div>
          </Card>
        </div>

        {/* Right column: Channels + Reputation Plan (5/12) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Channel list */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <Globe className="text-indigo-500" size={16} />
              <span>{isAr ? 'قنوات وملفات الهوية العلمية' : 'Academic Identity Channels'}</span>
            </h3>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {channels.map((chan, idx) => (
                <div 
                  key={idx} 
                  className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[var(--ds-text-primary)]">{chan.name}</span>
                      {chan.status === 'linked' ? (
                        <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          {isAr ? 'مرتبط' : 'Linked'}
                        </span>
                      ) : chan.status === 'missing' ? (
                        <span className="text-[8px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded animate-pulse">
                          {isAr ? 'مفقود' : 'Missing'}
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold text-[var(--ds-text-muted)] bg-[var(--ds-surface-tertiary)] border border-[var(--ds-border-subtle)] px-1.5 py-0.5 rounded">
                          {isAr ? 'اختياري' : 'Optional'}
                        </span>
                      )}
                    </div>
                    {chan.url ? (
                      <a 
                        href={chan.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[9px] font-black text-indigo-500 hover:underline flex items-center gap-0.5"
                      >
                        <span>{isAr ? 'زيارة' : 'Visit'}</span>
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-[8px] font-bold text-[var(--ds-text-muted)]">{isAr ? 'لا يوجد رابط' : 'No link'}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--ds-text-muted)] font-medium leading-relaxed m-0">{chan.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Growth Reputation Plan */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <CheckSquare className="text-indigo-500" size={16} />
              <span>{isAr ? 'خطة 90 يوماً لبناء السمعة الأكاديمية' : '90-Day Academic Reputation Plan'}</span>
            </h3>

            <div className="space-y-3">
              {repTasks.map((task) => (
                <div 
                  key={task.id} 
                  onClick={() => toggleTask(task.id)}
                  className={`p-3 border rounded-xl flex items-start gap-2.5 cursor-pointer transition-all ${
                    task.done 
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-[var(--ds-text-muted)] line-through' 
                      : 'bg-[var(--ds-surface-secondary)] border-[var(--ds-border-subtle)] text-[var(--ds-text-secondary)] hover:border-indigo-500/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    readOnly
                    className="mt-0.5 shrink-0 accent-indigo-500 rounded cursor-pointer"
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-bold leading-normal m-0">
                      {isAr ? task.taskAr : task.taskEn}
                    </p>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border inline-block ${
                      task.impact === 'High' 
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                        : task.impact === 'Medium'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                    }`}>
                      {task.impact} Impact
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};

