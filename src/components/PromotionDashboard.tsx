import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { 
  Briefcase, 
  CheckCircle2, 
  AlertTriangle, 
  FileCheck,
  Plus,
  BookOpen
} from 'lucide-react';

interface ResearchItem {
  id: string;
  title: string;
  journal: string;
  rank: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  role: 'sole' | 'first' | 'co-author';
  points: number;
}

export const PromotionDashboard: React.FC = () => {
  const { language } = useProject();
  const isAr = language === 'ar';

  const [targetRank, setTargetRank] = useState<'associate' | 'full'>('associate');
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([
    { id: '1', title: 'The Effect of a Proposed AI-Based Training Program on High Schoolers', journal: 'Journal of Educational Computing', rank: 'Q1', role: 'first', points: 15 },
    { id: '2', title: 'Critical Thinking Skills Development in Smart Classrooms', journal: 'International Journal of Pedagogy', rank: 'Q1', role: 'sole', points: 20 },
    { id: '3', title: 'Monte Carlo Simulations in Quasi-Experimental Designs', journal: 'Educational Methodology Review', rank: 'Q2', role: 'co-author', points: 7.5 },
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newJournal, setNewJournal] = useState('');
  const [newRank, setNewRank] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [newRole, setNewRole] = useState<'sole' | 'first' | 'co-author'>('first');

  const calculatePoints = (rank: 'Q1' | 'Q2' | 'Q3' | 'Q4', role: 'sole' | 'first' | 'co-author'): number => {
    let base = 10;
    if (rank === 'Q1') base = 20;
    else if (rank === 'Q2') base = 15;
    else if (rank === 'Q3') base = 10;
    else base = 5;

    if (role === 'sole') return base;
    if (role === 'first') return base * 0.75;
    return base * 0.5;
  };

  const handleAddPaper = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newJournal.trim()) return;

    const points = calculatePoints(newRank, newRole);
    const newPaper: ResearchItem = {
      id: `paper-${Date.now()}`,
      title: newTitle,
      journal: newJournal,
      rank: newRank,
      role: newRole,
      points
    };

    setResearchItems(prev => [...prev, newPaper]);
    setNewTitle('');
    setNewJournal('');
  };

  // Sum points
  const totalResearchPoints = researchItems.reduce((acc, item) => acc + item.points, 0);
  const requiredPoints = targetRank === 'associate' ? 40 : 60;
  const pointsPercentage = Math.min(100, Math.round((totalResearchPoints / requiredPoints) * 100));

  // Checklist status
  const checklist = [
    { id: '1', labelAr: 'الحد الأدنى من الأبحاث المنشورة (4 أبحاث)', labelEn: 'Minimum published papers (4 papers)', met: researchItems.length >= 4 },
    { id: '2', labelAr: 'الحصول على نقاط كافية من الإنتاج العلمي', labelEn: 'Acquire sufficient research points', met: totalResearchPoints >= requiredPoints },
    { id: '3', labelAr: 'درجة تقييم الأداء التدريسي والطلابي (>= 80%)', labelEn: 'Teaching evaluation score (>= 80%)', met: true },
    { id: '4', labelAr: 'تقرير خدمة المجتمع والعمل الإداري المعتمد', labelEn: 'Certified community service and admin report', met: false }
  ];

  const metCount = checklist.filter(c => c.met).length;
  const overallReadiness = Math.round((metCount / checklist.length) * 100);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-900/30 via-yellow-900/10 to-transparent border border-amber-500/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase size={20} className="text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
              {isAr ? 'الترقيات الأكاديمية لأعضاء التدريس' : 'Academic Faculty Promotion Hub'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">
            {isAr ? 'بصيرة للترقيات الأكاديمية' : 'Baseerah Promotion'}
          </h2>
          <p className="text-sm text-[var(--ds-text-secondary)] max-w-2xl m-0 leading-relaxed">
            {isAr
              ? 'تتبع ملف ترقيتك، واحتسب نقاط إنتاجك العلمي، وافهم بنود لائحة جامعتك وتأكد من استيفاء المتطلبات.'
              : 'Track your academic promotion portfolio, calculate research points, and ensure compliance with university bylaws.'}
          </p>
        </div>

        {/* Rank Selector buttons */}
        <div className="flex gap-2 bg-[var(--ds-surface-secondary)] p-1 rounded-xl border border-[var(--ds-border-subtle)] shrink-0">
          <button
            onClick={() => setTargetRank('associate')}
            className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer transition-all ${
              targetRank === 'associate'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)]'
            }`}
          >
            {isAr ? 'أستاذ مشارك' : 'Associate Prof'}
          </button>
          <button
            onClick={() => setTargetRank('full')}
            className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer transition-all ${
              targetRank === 'full'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)]'
            }`}
          >
            {isAr ? 'أستاذ بروفيسور' : 'Full Professor'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Stats & Checklist (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Readiness Gauge */}
            <Card className="p-6 flex flex-col items-center justify-center gap-4 text-center border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
              <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest">
                {isAr ? 'جاهزية ملف التقديم' : 'Portfolio Readiness'}
              </span>
              
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke="var(--ds-border-subtle)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke="#eab308"
                    strokeWidth="3"
                    strokeDasharray={`${overallReadiness} ${100 - overallReadiness}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-amber-500">
                    {overallReadiness}%
                  </span>
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-bold">{metCount} / {checklist.length}</span>
                </div>
              </div>
            </Card>

            {/* Points Summary */}
            <Card className="p-6 flex flex-col items-center justify-center gap-4 text-center border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
              <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest">
                {isAr ? 'نقاط الإنتاج العلمي' : 'Research Points Earned'}
              </span>
              
              <div className="space-y-1">
                <span className="text-3xl font-black text-amber-500 block">
                  {totalResearchPoints.toFixed(1)}
                </span>
                <span className="text-xs text-[var(--ds-text-secondary)] font-bold block">
                  {isAr ? `من أصل ${requiredPoints} مطلوبة` : `out of ${requiredPoints} req`}
                </span>
              </div>
              
              <div className="w-full bg-[var(--ds-surface-secondary)] rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pointsPercentage}%` }} />
              </div>
            </Card>
          </div>

          {/* Checklist */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <FileCheck className="text-amber-500" size={16} />
              <span>{isAr ? 'شروط وجاهزية ملف التقديم' : 'Promotion Criteria Checklist'}</span>
            </h3>
            
            <div className="space-y-3">
              {checklist.map(item => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl"
                >
                  <span className="text-xs font-bold text-[var(--ds-text-secondary)]">
                    {isAr ? item.labelAr : item.labelEn}
                  </span>
                  {item.met ? (
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  ) : (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                      <AlertTriangle size={12} className="shrink-0 text-rose-500" />
                      <span>{isAr ? 'مستند ناقص' : 'Missing Doc'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Research Papers & Adding form (5/12) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Scientific Production List */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <BookOpen className="text-amber-500" size={16} />
              <span>{isAr ? 'الإنتاج العلمي للباحث (الأبحاث)' : 'Scientific Publications List'}</span>
            </h3>
            
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {researchItems.map(item => (
                <div 
                  key={item.id} 
                  className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2 text-right"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-bold text-[var(--ds-text-primary)] truncate max-w-[150px]">
                      {item.title}
                    </span>
                    <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20 text-[9px] font-bold">
                      +{item.points.toFixed(1)} {isAr ? 'نقطة' : 'pts'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] text-[var(--ds-text-muted)] font-semibold">
                    <span>{item.journal} ({item.rank})</span>
                    <span className="uppercase">{item.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Add Paper Form */}
          <Card className="p-5 space-y-4">
            <h4 className="text-xs font-black text-[var(--ds-text-primary)] m-0">
              {isAr ? 'إدراج بحث علمي جديد بالملف' : 'Add New Paper to Portfolio'}
            </h4>
            
            <form onSubmit={handleAddPaper} className="space-y-3">
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                  {isAr ? 'عنوان البحث العلمي المكتوب:' : 'Research Title:'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder={isAr ? 'اكتب عنوان الورقة العلمية...' : 'Enter paper title...'}
                  className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                  {isAr ? 'المجلة أو الناشر العلمي:' : 'Journal / Publisher:'}
                </label>
                <input
                  type="text"
                  required
                  value={newJournal}
                  onChange={e => setNewJournal(e.target.value)}
                  placeholder={isAr ? 'اسم المجلة المصنفة...' : 'Enter journal name...'}
                  className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                    {isAr ? 'تصنيف المجلة (Quartile):' : 'Journal Rank (Quartile):'}
                  </label>
                  <select
                    value={newRank}
                    onChange={e => setNewRank(e.target.value as any)}
                    className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-2 text-xs font-bold text-[var(--ds-text-primary)] focus:outline-none"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                    {isAr ? 'دور الباحث بالترتيب:' : 'Author Role:'}
                  </label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as any)}
                    className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-2 text-xs font-bold text-[var(--ds-text-primary)] focus:outline-none"
                  >
                    <option value="sole">{isAr ? 'باحث منفرد' : 'Sole Author'}</option>
                    <option value="first">{isAr ? 'باحث رئيس' : 'First Author'}</option>
                    <option value="co-author">{isAr ? 'باحث مشترك' : 'Co-Author'}</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl mt-2 bg-amber-600 hover:bg-amber-700"
              >
                <Plus size={14} />
                <span>{isAr ? 'إدراج الورقة واحتساب النقاط' : 'Add Paper & Score Points'}</span>
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
