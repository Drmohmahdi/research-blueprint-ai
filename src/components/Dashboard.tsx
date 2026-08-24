import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { getTranslation } from '../utils/translations';
import { checkConsistency } from '../utils/ruleEngine';
import { VIEW_TO_PATH } from '../router/routes';
import { apiGetActiveOrganization } from '../utils/api';
import { researchStorage } from '../utils/researchStorage';
import { Badge, Progress, EmptyState, Alert, Button, PathPanel } from '../design-system';
import { 
  FolderGit2, 
  Sparkles, 
  CheckSquare, 
  Calculator, 
  PlayCircle, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  MessageSquareCode,
  Building2,
  CheckCircle2,
  Circle,
  Users,
  Layers,
  CreditCard,
  ShieldCheck,
  BookOpen,
  Activity
} from 'lucide-react';

import { GroupComparisonChart } from './GroupComparisonChart';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const setCurrentView = (viewId: string) => navigate(VIEW_TO_PATH[viewId] ?? '/');
  const { projects, activeProject, language, user, simulationResults } = useProject();

  const [activeOrg, setActiveOrg] = useState<any | null>(null);
  const [dbComments, setDbComments] = useState<any[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'info', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const org = await apiGetActiveOrganization();
        if (org) setActiveOrg(org);
      } catch (e) {
        console.error("Failed to load active org for dashboard", e);
      }
    };
    fetchOrg();
  }, []);

  useEffect(() => {
    if (!activeProject?.id) {
      setDbComments([]);
      return;
    }
    const saved = researchStorage.getItem('rb_comments_' + activeProject.id);
    if (!saved) {
      setDbComments([]);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setDbComments(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDbComments([]);
    }
  }, [activeProject]);

  const getRoleFromUser = (): 'RESEARCHER' | 'SUPERVISOR' | 'ADMIN' => {
    const r = user?.role;
    if (r === 'Supervisor' || r === 'Reviewer') return 'SUPERVISOR';
    if (r === 'SystemAdmin' || r === 'Developer' || r === 'admin' || r === 'superadmin') return 'ADMIN';
    return 'RESEARCHER';
  };

  const accountRole = getRoleFromUser();
  const [dashboardRole, setDashboardRole] = useState<'RESEARCHER' | 'SUPERVISOR' | 'ADMIN'>(accountRole);

  useEffect(() => {
    setDashboardRole(accountRole);
  }, [accountRole]);

  const audit = activeProject ? checkConsistency(activeProject) : { score: 100, issues: [] };
  const criticalCount = audit.issues.filter(i => i.type === 'critical').length;
  const warningCount = audit.issues.filter(i => i.type === 'warning').length;

  const projectCompletenessChecks = activeProject ? [
    activeProject.titleAr.trim().length > 0 && activeProject.titleEn.trim().length > 0,
    activeProject.problemStatementAr.trim().length > 0 || activeProject.problemStatementEn.trim().length > 0,
    activeProject.questions.length > 0 && activeProject.questions.every(question => question.textAr.trim().length > 0 || question.textEn.trim().length > 0),
    activeProject.hypotheses.length > 0 && activeProject.hypotheses.every(hypothesis => hypothesis.textAr.trim().length > 0 || hypothesis.textEn.trim().length > 0),
    activeProject.variables.length > 0 && activeProject.variables.every(variable => {
      const hasNames = variable.nameAr.trim().length > 0 && variable.nameEn.trim().length > 0;
      const hasValidRange = variable.scale !== 'interval' && variable.scale !== 'ratio'
        || (Number.isFinite(variable.minValue) && Number.isFinite(variable.maxValue) && (variable.minValue as number) < (variable.maxValue as number));
      return hasNames && hasValidRange;
    }),
    Number.isInteger(activeProject.sampleSettings.populationSize)
      && (activeProject.sampleSettings.populationSize as number) > 0
      && Number.isInteger(activeProject.sampleSettings.groupsCount)
      && activeProject.sampleSettings.groupsCount >= 1
      && activeProject.sampleSettings.marginOfError > 0
      && activeProject.sampleSettings.marginOfError <= 0.5
      && activeProject.sampleSettings.expectedPower > 0
      && activeProject.sampleSettings.expectedPower <= 1
      && activeProject.sampleSettings.expectedEffectSize > 0
  ] : [];
  const completeness = projectCompletenessChecks.length > 0
    ? Math.round((projectCompletenessChecks.filter(Boolean).length / projectCompletenessChecks.length) * 100)
    : 0;

  const checklistItems = [
    {
      label: language === 'ar' ? 'تحديد عنوان البحث العلمي' : 'Define Research Title',
      completed: !!(activeProject?.titleAr || activeProject?.titleEn),
      path: VIEW_TO_PATH.wizard
    },
    {
      label: language === 'ar' ? 'صياغة مشكلة الدراسة' : 'Formulate Problem Statement',
      completed: !!(activeProject?.problemStatementAr || activeProject?.problemStatementEn),
      path: VIEW_TO_PATH.wizard
    },
    {
      label: language === 'ar' ? 'تحديد وتوصيف متغيرات الدراسة' : 'Define Study Variables',
      completed: (activeProject?.variables.length || 0) > 0,
      path: VIEW_TO_PATH.wizard
    },
    {
      label: language === 'ar' ? 'صياغة أسئلة البحث العلمي' : 'Formulate Research Questions',
      completed: (activeProject?.questions.length || 0) > 0,
      path: VIEW_TO_PATH.wizard
    },
    {
      label: language === 'ar' ? 'صياغة الفرضيات العلمية' : 'Formulate Hypotheses',
      completed: (activeProject?.hypotheses.length || 0) > 0,
      path: VIEW_TO_PATH.wizard
    }
  ];

  const unresolvedComments = dbComments.filter(c => !c.resolved).slice(0, 3);
  const heroPanelClass = 'flex flex-col md:flex-row items-center justify-between gap-6';
  const accentPillClass = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] border border-[var(--ds-primary)]/20 mb-2';
  const primaryActionClass = 'flex items-center gap-2 px-5 py-3 rounded-lg font-bold bg-action hover:bg-action-hover text-on-action shadow-sm ds-transition cursor-pointer shrink-0';
  const dashboardCardClass = 'group relative overflow-hidden bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4 ds-transition hover:border-[var(--ds-border-default)] hover:shadow-md';
  const cardIconClass = 'h-10 w-10 rounded-lg flex items-center justify-center border shrink-0';
  const quickActionClass = 'w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-secondary)] text-sm font-semibold text-[var(--ds-text-secondary)] transition-colors text-start cursor-pointer';
  const panelCardClass = 'bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-6 shadow-sm space-y-4';
  const kpiTileClass = 'bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4';
  const statCellClass = 'rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3 min-h-[74px]';
  const kpiCards = [
    {
      label: getTranslation(language, 'projectsCount'),
      value: projects.length,
      description: language === 'ar' ? 'مشاريع مسجلة محلياً' : 'Registered projects locally',
      icon: <FolderGit2 size={18} />,
      tone: 'primary',
    },
    {
      label: getTranslation(language, 'completenessRate'),
      value: `${completeness}%`,
      description: language === 'ar' ? 'اكتمال عناصر التصميم الأساسية' : 'Core design fields completed',
      icon: <TrendingUp size={18} />,
      tone: 'success',
      progress: completeness,
    },
    {
      label: getTranslation(language, 'consistencyScore'),
      value: `${audit.score}/100`,
      description: audit.score > 80
        ? (language === 'ar' ? 'اتساق ممتاز' : 'Excellent consistency')
        : (language === 'ar' ? 'يحتاج لمراجعة الاتساق' : 'Requires consistency review'),
      icon: <CheckSquare size={18} />,
      tone: audit.score >= 80 ? 'success' : audit.score >= 50 ? 'warning' : 'danger',
      progress: audit.score,
    },
    {
      label: getTranslation(language, 'methodologicalRisks'),
      value: criticalCount + warningCount,
      description: language === 'ar'
        ? `${criticalCount} أخطاء حرجة | ${warningCount} تحذيرات`
        : `${criticalCount} Critical | ${warningCount} Warnings`,
      icon: <AlertTriangle size={18} />,
      tone: criticalCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'success',
    },
  ];

  const researchStages = [
    { label: language === 'ar' ? 'الفكرة والعنوان' : 'Idea & Title', done: !!(activeProject?.titleAr || activeProject?.titleEn), path: VIEW_TO_PATH.wizard },
    { label: language === 'ar' ? 'المشكلة والأسئلة' : 'Problem & Questions', done: !!(activeProject?.problemStatementAr || activeProject?.problemStatementEn) && (activeProject?.questions.length || 0) > 0, path: VIEW_TO_PATH.wizard },
    { label: language === 'ar' ? 'المتغيرات والنموذج' : 'Variables & Model', done: (activeProject?.variables.length || 0) > 0, path: VIEW_TO_PATH.wizard },
    { label: language === 'ar' ? 'العينة والمحاكاة' : 'Sample & Simulation', done: !!simulationResults[activeProject?.id || ''], path: VIEW_TO_PATH.simulation },
    { label: language === 'ar' ? 'المراجعة والنشر' : 'Review & Publication', done: audit.score >= 90 && completeness === 100, path: VIEW_TO_PATH.reviewSim },
  ];

  const nextStage = researchStages.find(stage => !stage.done) || researchStages[researchStages.length - 1];
  const researchMaturityScore = Math.round(((activeProject ? 1 : 0) + (activeProject?.variables.length ? 1 : 0) + (activeProject?.questions.length ? 1 : 0) + (activeProject?.hypotheses.length ? 1 : 0) + (simulationResults[activeProject?.id || ''] ? 1 : 0)) * 20);
  const decisionAlerts = [
    {
      title: language === 'ar' ? 'أولوية العمل التالية' : 'Next Priority',
      value: nextStage.label,
      tone: 'primary',
      action: language === 'ar' ? 'انتقال للمرحلة' : 'Open Stage',
      path: nextStage.path,
    },
    {
      title: language === 'ar' ? 'حالة المخاطر' : 'Risk Status',
      value: criticalCount > 0
        ? (language === 'ar' ? 'توجد أخطاء حرجة' : 'Critical issues found')
        : warningCount > 0
          ? (language === 'ar' ? 'توجد تحذيرات قابلة للعلاج' : 'Warnings need review')
          : (language === 'ar' ? 'لا توجد مخاطر ظاهرة' : 'No visible risks'),
      tone: criticalCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'success',
      action: language === 'ar' ? 'فحص الاتساق' : 'Check Consistency',
      path: VIEW_TO_PATH.consistency,
    },
    {
      title: language === 'ar' ? 'نضج ملف البحث' : 'Research Blueprint Maturity',
      value: `${researchMaturityScore}%`,
      tone: researchMaturityScore >= 80 ? 'success' : researchMaturityScore >= 50 ? 'warning' : 'primary',
      action: language === 'ar' ? 'فتح معالج البحث' : 'Open Research Wizard',
      path: VIEW_TO_PATH.wizard,
    },
  ];

  const getToneClasses = (tone: string) => {
    if (tone === 'success') {
      return {
        icon: 'bg-[var(--ds-success-soft)] text-[var(--ds-success)] border-[var(--ds-success)]/20',
        bar: 'bg-[var(--ds-success)]',
      };
    }
    if (tone === 'warning') {
      return {
        icon: 'bg-[var(--ds-warning-soft)] text-[var(--ds-warning)] border-[var(--ds-warning)]/20',
        bar: 'bg-[var(--ds-warning)]',
      };
    }
    if (tone === 'danger') {
      return {
        icon: 'bg-[var(--ds-danger-soft)] text-[var(--ds-danger)] border-[var(--ds-danger)]/20',
        bar: 'bg-[var(--ds-danger)]',
      };
    }
    return {
      icon: 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] border-[var(--ds-primary)]/20',
      bar: 'bg-[var(--ds-primary)]',
    };
  };


  // Mock Data for Role-Based Dashboards
  const supervisedStudents = [
    { id: 'stud-1', name: language === 'ar' ? 'أحمد القحطاني' : 'Ahmed Al-Qahtani', title: language === 'ar' ? 'أثر استخدام الذكاء الاصطناعي في العلوم' : 'Impact of AI in Science Education', progress: 80, consistency: 95, status: 'safe' },
    { id: 'stud-2', name: language === 'ar' ? 'سارة الدوسري' : 'Sara Al-Dossary', title: language === 'ar' ? 'أثر الفصول المقلوبة في التحصيل الإملائي' : 'Flipped Classrooms on Spelling Retention', progress: 40, consistency: 65, status: 'warning' },
    { id: 'stud-3', name: language === 'ar' ? 'خالد العنزي' : 'Khaled Al-Anazi', title: language === 'ar' ? 'فاعلية برنامج محاكاة ثلاثي الأبعاد في الهندسة' : '3D Simulation Program in Geometry', progress: 60, consistency: 82, status: 'safe' },
    { id: 'stud-4', name: language === 'ar' ? 'فاطمة الشهري' : 'Fatima Al-Shehri', title: language === 'ar' ? 'أثر ألعاب التلعيب في الاستيعاب القرائي' : 'Gamification on Reading Comprehension', progress: 20, consistency: 48, status: 'critical' },
  ];

  const flaggedStudentsCount = supervisedStudents.filter(s => s.status === 'critical').length;
  const avgDesignQuality = Math.round(
    supervisedStudents.reduce((sum, s) => sum + s.consistency, 0) / (supervisedStudents.length || 1)
  );
  const studentStatusBadgeVariant = (status: string): 'completed' | 'warning' | 'critical' =>
    status === 'safe' ? 'completed' : status === 'warning' ? 'warning' : 'critical';
  const studentStatusLabel = (status: string) =>
    status === 'safe'
      ? (language === 'ar' ? 'آمن إحصائياً' : 'Safe')
      : status === 'warning'
        ? (language === 'ar' ? 'تحذير اتساق' : 'Warning')
        : (language === 'ar' ? 'أخطاء حرجة' : 'Critical');

  const adminStats = {
    planCode: 'RESEARCH_TEAM',
    planName: language === 'ar' ? 'باقة الكليات والفرق البحثية (Pro)' : 'College Research Team (Pro)',
    expiresAt: '2027-07-01',
    membersUsed: 6,
    membersMax: 10,
    aiRequestsUsed: 1250,
    aiRequestsMax: 5000,
    predictionRunsUsed: 18,
    predictionRunsMax: 50,
    storageUsedMb: 45,
    storageMaxMb: 500,
    departments: [
      { id: 'dept-1', name: language === 'ar' ? 'قسم المناهج وطرق التدريس' : 'Dept of Curriculum & Instruction', members: 3, projects: 8 },
      { id: 'dept-2', name: language === 'ar' ? 'قسم تقنيات التعليم' : 'Dept of Educational Technology', members: 2, projects: 5 },
      { id: 'dept-3', name: language === 'ar' ? 'قسم الإدارة والتخطيط التربوي' : 'Dept of Educational Administration', members: 1, projects: 2 }
    ],
    invoices: [
      { id: 'INV-2026-07', date: '2026-07-01', amount: '250 SAR', status: 'PAID' },
      { id: 'INV-2026-06', date: '2026-06-01', amount: '250 SAR', status: 'PAID' },
    ]
  };

  return (
    <div className="space-y-8">
      {toast && (
        <Alert variant={toast.type === 'success' ? 'success' : 'info'} onClose={() => setToast(null)} className="animate-fade-in">
          {toast.message}
        </Alert>
      )}
      {dashboardRole === 'RESEARCHER' && (
        <>
          {/* Top Banner section */}
          <PathPanel accent="var(--ds-path-research)">
          <div className={heroPanelClass}>
            <div className="space-y-2">
              {activeOrg && (
                <div className={accentPillClass}>
                  <Building2 size={12} />
                  <span>{activeOrg.name}</span>
                </div>
              )}
              <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--ds-text-primary)] m-0">
                {language === 'ar' ? `مرحباً بك في لوحة تصميم البحوث` : `Welcome to the Research Design Dashboard`}
              </h2>
              <p className="text-[var(--ds-text-secondary)] text-sm max-w-2xl m-0 leading-relaxed">
                {language === 'ar' 
                  ? 'صمم نموذج دراستك المنهجي، وافحص اتساقه العلمي، وشغل محاكاة النتائج إحصائياً قبل النزول للميدان.'
                  : 'Design your methodological study model, check its consistency, and run statistical simulations before field execution.'}
              </p>
            </div>
            <button 
              onClick={() => setCurrentView('analyzer')}
              className={primaryActionClass}
            >
              <Sparkles size={18} />
              <span>{language === 'ar' ? 'تحليل عنوان الدراسة' : 'Analyze Study Title'}</span>
              <ArrowRight size={16} className={language === 'ar' ? 'rotate-180' : ''} />
            </button>
          </div>
          </PathPanel>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((card) => {
              const tone = getToneClasses(card.tone);
              return (
                <div key={card.label} className={dashboardCardClass}>
                  <div className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-black text-[var(--ds-text-muted)] uppercase tracking-wider leading-5">
                      {card.label}
                    </span>
                    <div className={`${cardIconClass} ${tone.icon}`}>
                      {card.icon}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-[var(--ds-text-primary)] m-0 tracking-tight">
                      {card.value}
                    </h3>
                    <p className="text-xs text-[var(--ds-text-secondary)] font-semibold m-0 leading-5 min-h-[20px]">
                      {card.description}
                    </p>
                    {typeof card.progress === 'number' && (
                      <Progress value={card.progress} variant={card.tone as 'primary' | 'success' | 'warning' | 'danger'} className="mt-2" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-[var(--ds-text-primary)] m-0">
                    {language === 'ar' ? 'مسار البحث العلمي' : 'Research Workflow'}
                  </h3>
                  <p className="text-xs text-[var(--ds-text-secondary)] m-0 mt-1">
                    {language === 'ar' ? 'متابعة عملية من الفكرة حتى المراجعة والنشر' : 'Operational flow from idea to review and publication'}
                  </p>
                </div>
                <span className="text-xs font-black text-[var(--ds-primary)] bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 rounded-full px-3 py-1">
                  {completeness}% {language === 'ar' ? 'اكتمال' : 'Complete'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {researchStages.map((stage, index) => (
                  <button
                    key={stage.label}
                    onClick={() => navigate(stage.path)}
                    className={`min-h-[104px] rounded-lg border p-3 text-start transition-all cursor-pointer ${
                      stage.done
                        ? 'bg-[var(--ds-success-soft)] border-[var(--ds-success)]/25 text-[var(--ds-success)]'
                        : stage === nextStage
                          ? 'bg-[var(--ds-primary-soft)] border-[var(--ds-primary)]/30 text-[var(--ds-primary)] shadow-sm'
                          : 'bg-[var(--ds-surface-secondary)] border-[var(--ds-border-subtle)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-tertiary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black">{String(index + 1).padStart(2, '0')}</span>
                      {stage.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </div>
                    <span className="block text-xs font-extrabold leading-5 mt-4">{stage.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
              {decisionAlerts.map((item) => {
                const tone = getToneClasses(item.tone);
                return (
                  <div key={item.title} className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-black text-[var(--ds-text-muted)] block">{item.title}</span>
                        <strong className="text-sm text-[var(--ds-text-primary)] block mt-1 leading-5">{item.value}</strong>
                      </div>
                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center border ${tone.icon}`}>
                        <Activity size={15} />
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(item.path)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--ds-surface-secondary)] hover:bg-[var(--ds-surface-tertiary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span>{item.action}</span>
                      <ArrowRight size={14} className={language === 'ar' ? 'rotate-180' : ''} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 cols: Project overview & Warnings */}
            <div className="lg:col-span-2 space-y-6">
              {/* Active Project details */}
              {activeProject ? (
                <div className={panelCardClass}>
                  <div className="flex justify-between items-center gap-3 border-b border-[var(--ds-border-subtle)] pb-4">
                    <div className="flex items-center gap-2">
                      <span className="h-9 w-9 rounded-lg bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] border border-[var(--ds-primary)]/20 flex items-center justify-center">
                        <FolderGit2 size={17} />
                      </span>
                      <h3 className="text-lg font-bold text-[var(--ds-text-primary)] m-0">
                      {language === 'ar' ? 'المشروع الحالي' : 'Active Project'}
                      </h3>
                    </div>
                    <span className="bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] text-xs px-2.5 py-1 rounded-full font-semibold border border-[var(--ds-primary)]/20">
                      {language === 'ar' ? 'قيد التصميم' : 'In Design'}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-md font-bold text-[var(--ds-text-primary)] m-0">
                      {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}
                    </h4>
                    <p className="text-[var(--ds-text-secondary)] text-sm leading-relaxed m-0">
                      {language === 'ar' ? activeProject.descriptionAr : activeProject.descriptionEn}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--ds-border-subtle)] text-xs">
                    <div className={statCellClass}>
                      <span className="text-[var(--ds-text-muted)] font-medium block">{language === 'ar' ? 'المؤسسة' : 'Institution'}</span>
                      <span className="text-[var(--ds-text-secondary)] font-semibold">{language === 'ar' ? activeProject.institutionAr : activeProject.institutionEn}</span>
                    </div>
                    <div className={statCellClass}>
                      <span className="text-[var(--ds-text-muted)] font-medium block">{language === 'ar' ? 'المتغيرات' : 'Variables'}</span>
                      <span className="text-[var(--ds-text-secondary)] font-semibold">{activeProject.variables.length}</span>
                    </div>
                    <div className={statCellClass}>
                      <span className="text-[var(--ds-text-muted)] font-medium block">{language === 'ar' ? 'أسئلة البحث' : 'Questions'}</span>
                      <span className="text-[var(--ds-text-secondary)] font-semibold">{activeProject.questions.length}</span>
                    </div>
                    <div className={statCellClass}>
                      <span className="text-[var(--ds-text-muted)] font-medium block">{language === 'ar' ? 'حجم المجتمع المتاح' : 'Available Population'}</span>
                      <span className="text-[var(--ds-text-secondary)] font-semibold">
                        {activeProject.sampleSettings.populationSize || (language === 'ar' ? 'غير محدد' : 'Unspecified')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Interactive Checklist */}
                  <div className="pt-4 border-t border-[var(--ds-border-subtle)] space-y-3">
                    <h4 className="text-xs font-black text-[var(--ds-text-primary)] uppercase tracking-wider block">
                      {language === 'ar' ? 'خطوات تصميم البحث المطلوبة:' : 'Required Study Design Steps:'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {checklistItems.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => navigate(item.path)}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-secondary)] text-xs font-semibold text-start transition-all duration-200 cursor-pointer w-full text-[var(--ds-text-secondary)] justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {item.completed ? (
                              <CheckCircle2 size={16} className="text-[var(--ds-success)] shrink-0" />
                            ) : (
                              <Circle size={16} className="text-[var(--ds-text-muted)] shrink-0" />
                            )}
                            <span className={item.completed ? 'line-through text-[var(--ds-text-muted)]' : ''}>
                              {item.label}
                            </span>
                          </div>
                          <ArrowRight size={14} className={`text-[var(--ds-text-muted)] ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  illustration={<FolderGit2 size={40} />}
                  title={language === 'ar' ? 'لا يوجد مشروع نشط حالياً' : 'No active project currently'}
                  description={language === 'ar'
                    ? 'ابدأ مشروعك البحثي الأول عبر معالج البحث لتظهر هنا مؤشرات التقدم والاتساق.'
                    : 'Start your first research project via the wizard to see progress and consistency metrics here.'}
                  actionButton={
                    <Button variant="primary" size="sm" onClick={() => setCurrentView('wizard')} iconAfter={<ArrowRight size={14} className={language === 'ar' ? 'rotate-180' : ''} />}>
                      {language === 'ar' ? 'إنشاء مشروع جديد' : 'Create New Project'}
                    </Button>
                  }
                />
              )}

              {/* Group Comparison Chart Card */}
              {activeProject && (
                <GroupComparisonChart
                  language={language}
                  simulationData={simulationResults[activeProject.id]}
                  activeProject={activeProject}
                  onRunSimulation={() => setCurrentView('simulation')}
                />
              )}

              {/* Key Warnings List */}
              {audit.issues.length > 0 && (
                <div className={panelCardClass}>
                  <h3 className="text-lg font-bold text-[var(--ds-danger)] flex items-center gap-2 m-0 border-b border-[var(--ds-border-subtle)] pb-3">
                    <span className="h-8 w-8 rounded-lg bg-[var(--ds-danger-soft)] border border-[var(--ds-danger)]/20 flex items-center justify-center">
                      <AlertTriangle size={16} />
                    </span>
                    <span>{language === 'ar' ? 'تنبيهات منهجية عاجلة' : 'Urgent Methodological Warnings'}</span>
                  </h3>
                  
                  <div className="divide-y divide-[var(--ds-border-subtle)] max-h-60 overflow-y-auto no-scrollbar">
                    {audit.issues.map((issue) => (
                      <div key={issue.id} className="py-3 px-2 rounded-lg hover:bg-[var(--ds-surface-secondary)] flex items-start gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${issue.type === 'critical' ? 'bg-[var(--ds-danger)]' : 'bg-[var(--ds-warning)]'}`}></span>
                        <p className="text-sm font-medium text-[var(--ds-text-secondary)] m-0">
                          {language === 'ar' ? issue.textAr : issue.textEn}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 1 col: Quick Actions & Supervisor Comments */}
            <div className="space-y-6">
              {/* Quick Actions List */}
              <div className={panelCardClass}>
                <h3 className="text-lg font-bold text-[var(--ds-text-primary)] m-0 pb-3 border-b border-[var(--ds-border-subtle)]">
                  {getTranslation(language, 'quickActions')}
                </h3>

                <div className="space-y-2">
                  <button 
                    onClick={() => setCurrentView('analyzer')}
                    className={quickActionClass}
                  >
                    <span>{getTranslation(language, 'analyzer')}</span>
                <Sparkles size={16} className="text-[var(--ds-primary)]" />
                  </button>
                  <button 
                    onClick={() => setCurrentView('consistency')}
                    className={quickActionClass}
                  >
                    <span>{getTranslation(language, 'consistency')}</span>
                    <CheckSquare size={16} className="text-[var(--ds-primary)]" />
                  </button>
                  <button 
                    onClick={() => setCurrentView('sampleCalc')}
                    className={quickActionClass}
                  >
                    <span>{getTranslation(language, 'sampleCalc')}</span>
                    <Calculator size={16} className="text-[var(--ds-success)]" />
                  </button>
                  <button 
                    onClick={() => setCurrentView('simulation')}
                    className={quickActionClass}
                  >
                    <span>{getTranslation(language, 'simulation')}</span>
                    <PlayCircle size={16} className="text-[var(--ds-danger)]" />
                  </button>
                </div>
              </div>

              {/* Supervisor comments panel */}
              <div className={panelCardClass}>
                <h3 className="text-lg font-bold text-[var(--ds-text-primary)] m-0 pb-3 border-b border-[var(--ds-border-subtle)] flex items-center gap-2">
              <MessageSquareCode size={18} className="text-[var(--ds-primary)]" />
                  <span>{language === 'ar' ? 'ملاحظات المشرف العلمي المعلقة' : 'Pending Supervisor Notes'}</span>
                </h3>

                <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                  {unresolvedComments.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[var(--ds-text-muted)] font-semibold">
                      {language === 'ar' 
                        ? 'لا توجد ملاحظات معلقة حالياً من المشرف.'
                        : 'No pending comments from the supervisor currently.'}
                    </div>
                  ) : (
                    unresolvedComments.map(c => (
                      <div key={c.id} className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-2 text-xs">
                        <div className="flex justify-between items-center font-bold text-[var(--ds-text-primary)]">
                          <span>{c.authorUsername}</span>
                          <span className="text-[var(--ds-text-muted)] font-normal">
                            {new Date(c.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                        </div>
                        <p className="text-[var(--ds-text-secondary)] m-0 leading-relaxed">
                          {language === 'ar' ? c.contentAr || c.contentEn : c.contentEn || c.contentAr}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {dashboardRole === 'SUPERVISOR' && (
        <div className="space-y-6">
          {/* Supervisor Top Banner */}
          <PathPanel accent="var(--ds-path-review)">
          <div className={heroPanelClass}>
            <div className="space-y-2">
              <div className={accentPillClass}>
                <ShieldCheck size={12} />
                <span>{language === 'ar' ? 'بوابة المشرف العلمي المعتمَد' : 'Certified Academic Advisor Portal'}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--ds-text-primary)] m-0">
                {language === 'ar' ? `مرحباً د. ${user?.username || 'المشرف'}` : `Welcome Dr. ${user?.username || 'Advisor'}`}
              </h2>
              <p className="text-[var(--ds-text-secondary)] text-sm max-w-2xl m-0 leading-relaxed">
                {language === 'ar' 
                  ? 'تابع تصاميم أبحاث طلابك، وراجع جودتها المنهجية وإحصائياتها، واطرح تعليقاتك وتوجيهاتك الأكاديمية مباشرة.'
                  : 'Track your students\' study designs, audit their methodological quality, and write academic feedback directly.'}
              </p>
            </div>
          </div>
          </PathPanel>

          {/* Supervisor KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'الطلاب الخاضعون للإشراف' : 'Supervised Students'}</span>
                <Users size={20} className="text-[var(--ds-primary)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-[var(--ds-text-primary)] m-0">{supervisedStudents.length}</h3>
                <span className="text-xs text-[var(--ds-text-muted)] font-medium">{language === 'ar' ? 'باحثين مسجلين في مسارك' : 'Active students in your track'}</span>
              </div>
            </div>
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'ملاحظات بانتظار المراجعة' : 'Notes Pending Review'}</span>
              <MessageSquareCode size={20} className="text-[var(--ds-warning)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-[var(--ds-text-primary)] m-0">3</h3>
                <span className="text-xs text-[var(--ds-text-muted)] font-medium">{language === 'ar' ? 'تعليقات غير محلولة حالياً' : 'Unresolved advisor notes'}</span>
              </div>
            </div>
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'أبحاث بها أخطاء منهجية' : 'Flagged Studies'}</span>
            <AlertTriangle size={20} className="text-[var(--ds-danger)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-[var(--ds-text-primary)] m-0">{flaggedStudentsCount}</h3>
                <span className="text-xs text-[var(--ds-text-muted)] font-medium">{language === 'ar' ? 'دراسات تتجاوز حدود الأمان' : 'Studies exceeding risk limits'}</span>
              </div>
            </div>
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'متوسط جودة التصميم' : 'Avg Design Quality'}</span>
            <TrendingUp size={20} className="text-[var(--ds-success)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-[var(--ds-text-primary)] m-0">{avgDesignQuality}%</h3>
                <span className="text-xs text-[var(--ds-text-muted)] font-medium">{language === 'ar' ? 'مؤشر جودة التصاميم الإجمالي' : 'Overall student quality score'}</span>
              </div>
            </div>
          </div>

          {/* Supervisor Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`lg:col-span-2 ${panelCardClass}`}>
              <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-3 border-b border-[var(--ds-border-subtle)]">
                {language === 'ar' ? 'متابعة تصاميم أبحاث الطلاب' : 'Student Research Pipeline'}
              </h3>
              <div className="divide-y divide-[var(--ds-border-subtle)]">
                {supervisedStudents.map((stud) => (
                  <div key={stud.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[var(--ds-text-primary)]">{stud.name}</span>
                        <Badge variant={studentStatusBadgeVariant(stud.status)}>{studentStatusLabel(stud.status)}</Badge>
                      </div>
                      <p className="text-xs text-[var(--ds-text-secondary)] m-0">{stud.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--ds-text-muted)]">
                        <span>{language === 'ar' ? `مؤشر الاتساق: ${stud.consistency}/100` : `Consistency: ${stud.consistency}/100`}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                      <div className="w-24 text-start">
                        <div className="flex justify-between text-[9px] font-bold text-[var(--ds-text-muted)] mb-1">
                          <span>{language === 'ar' ? 'التقدم' : 'Progress'}</span>
                          <span>{stud.progress}%</span>
                        </div>
                        <Progress value={stud.progress} variant="primary" />
                      </div>
                      <button
                        onClick={() => {
                          showToast('info', language === 'ar' ? `جاري تحميل نموذج الطالب ${stud.name} لمراجعته.` : `Loading research model of ${stud.name} for review.`);
                        }}
                        className="px-3.5 py-1.5 bg-action hover:bg-action-hover text-on-action rounded-lg text-[10px] font-black cursor-pointer shadow-sm ds-transition"
                      >
                        {language === 'ar' ? 'مراجعة المنهجية' : 'Review Study'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className={panelCardClass}>
                <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-3 border-b border-[var(--ds-border-subtle)]">
                  {language === 'ar' ? 'إرشادات الإشراف الأكاديمي' : 'Advisor Guidelines'}
                </h3>
                <div className="space-y-3 text-xs text-[var(--ds-text-secondary)] leading-relaxed">
                  <div className="flex items-start gap-2">
                    <BookOpen size={16} className="text-[var(--ds-primary)] shrink-0 mt-0.5" />
                    <span>{language === 'ar' ? 'تأكد من أن جميع أسئلة البحث لها فرضيات مقابلة في لوحة الاتساق.' : 'Ensure all research questions have matching hypotheses in the consistency checker.'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen size={16} className="text-[var(--ds-primary)] shrink-0 mt-0.5" />
                    <span>{language === 'ar' ? 'شجع الطلاب على عدم تجاوز حدود 15% لمعدل تسرب العينة المتوقع.' : 'Encourage students not to exceed 15% for the expected sample attrition.'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen size={16} className="text-[var(--ds-primary)] shrink-0 mt-0.5" />
                    <span>{language === 'ar' ? 'التحكيم الأكاديمي للفرضيات الموجهة يتطلب تحديد مسارات المتغيرات بدقة.' : 'Directional hypotheses review requires verifying variable paths accurately.'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {dashboardRole === 'ADMIN' && (
        <div className="space-y-6">
          {/* Admin Top Banner */}
          <PathPanel accent="var(--ds-path-identity)">
          <div className={heroPanelClass}>
            <div className="space-y-2">
              <div className={accentPillClass}>
                <Building2 size={12} />
                <span>{activeOrg ? activeOrg.name : (language === 'ar' ? 'مساحة الإدارة العامة' : 'Central Admin Console')}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--ds-text-primary)] m-0">
                {language === 'ar' ? 'إدارة المؤسسة والاشتراكات (Tenant Control)' : 'Tenant & Subscription Management'}
              </h2>
              <p className="text-[var(--ds-text-secondary)] text-sm max-w-2xl m-0 leading-relaxed">
                {language === 'ar' 
                  ? 'راقب استهلاك موارد المؤسسة للذكاء الاصطناعي، وأدر الهيكل التنظيمي للمساحات الفرعية، وتابع تفاصيل التراخيص والفوترة.'
                  : 'Monitor resource usage metrics, manage organization workspace hierarchy, and check billing history.'}
              </p>
            </div>
          </div>
          </PathPanel>

          {/* Admin KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'خطة الاشتراك النشطة' : 'Active Plan'}</span>
                <CreditCard size={20} className="text-[var(--ds-primary)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-[var(--ds-text-primary)] m-0">{adminStats.planName}</h3>
                <span className="text-[10px] text-[var(--ds-text-muted)] font-medium">
                  {language === 'ar' ? `تاريخ التجديد: ${adminStats.expiresAt}` : `Renewal Date: ${adminStats.expiresAt}`}
                </span>
              </div>
            </div>
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'أعضاء المؤسسة' : 'Invited Members'}</span>
            <Users size={20} className="text-[var(--ds-primary)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">{adminStats.membersUsed} / {adminStats.membersMax}</h3>
                <Progress value={(adminStats.membersUsed / adminStats.membersMax) * 100} variant="primary" className="mt-2" />
              </div>
            </div>
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'طلبات الذكاء الاصطناعي' : 'AI Requests'}</span>
            <Activity size={20} className="text-[var(--ds-success)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">{adminStats.aiRequestsUsed} / {adminStats.aiRequestsMax}</h3>
                <Progress value={(adminStats.aiRequestsUsed / adminStats.aiRequestsMax) * 100} variant="success" className="mt-2" />
              </div>
            </div>
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'عمليات التنبؤ المشغلة' : 'Prediction Runs'}</span>
                <Sparkles size={20} className="text-[var(--ds-primary)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">{adminStats.predictionRunsUsed} / {adminStats.predictionRunsMax}</h3>
                <Progress value={(adminStats.predictionRunsUsed / adminStats.predictionRunsMax) * 100} variant="primary" className="mt-2" />
              </div>
            </div>
            <div className={kpiTileClass}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)] uppercase tracking-wider">{language === 'ar' ? 'مساحة التخزين المستهلكة' : 'Storage Consumed'}</span>
            <Layers size={20} className="text-[var(--ds-danger)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">{adminStats.storageUsedMb}MB / {adminStats.storageMaxMb}MB</h3>
                <Progress value={(adminStats.storageUsedMb / adminStats.storageMaxMb) * 100} variant="danger" className="mt-2" />
              </div>
            </div>
          </div>

          {/* Admin Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Workspace Hierarchy Trees */}
            <div className={`lg:col-span-2 ${panelCardClass}`}>
              <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-3 border-b border-[var(--ds-border-subtle)] flex items-center justify-between">
                <span>{language === 'ar' ? 'الهيكل التنظيمي للمؤسسة ومساحات العمل الفرعية' : 'Workspace Departments & Hierarchical Tree'}</span>
                <span className="text-[9px] bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] border border-[var(--ds-primary)]/20 px-2 py-0.5 rounded font-black">
                  {language === 'ar' ? 'توريث باقة الـ SaaS مفعل' : 'Billing Inheritance Active'}
                </span>
              </h3>
              
              <div className="space-y-4">
                <div className="p-3 bg-[var(--ds-surface-secondary)] border border-dashed border-[var(--ds-border-subtle)] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-[var(--ds-primary)]" />
                    <span className="font-extrabold text-xs text-[var(--ds-text-primary)]">{activeOrg ? activeOrg.name : (language === 'ar' ? 'مساحة العمل الأب (المستودع الرئيسي)' : 'Parent root institution')}</span>
                  </div>
                  <span className="text-[10px] text-[var(--ds-primary)] font-bold bg-[var(--ds-primary-soft)] px-2 py-0.5 rounded border border-[var(--ds-primary)]/10">{language === 'ar' ? 'الكيان المالك للفوترة' : 'Billing Parent'}</span>
                </div>
                
                <div className="mr-4 pl-4 border-r border-[var(--ds-border-subtle)] space-y-3">
                  {adminStats.departments.map((dept) => (
                    <div key={dept.id} className="p-3.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-xl flex items-center justify-between hover:bg-[var(--ds-surface-secondary)] transition-all">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[var(--ds-text-muted)]" />
                        <span className="font-bold text-xs text-[var(--ds-text-secondary)]">{dept.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-semibold text-[var(--ds-text-muted)]">
                        <span>{language === 'ar' ? `الأعضاء: ${dept.members}` : `Members: ${dept.members}`}</span>
                        <span>•</span>
                        <span>{language === 'ar' ? `الأبحاث: ${dept.projects}` : `Studies: ${dept.projects}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Invoices & License panel */}
            <div className="space-y-6">
              <div className={panelCardClass}>
                <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-3 border-b border-[var(--ds-border-subtle)] flex items-center gap-2">
                  <CreditCard size={16} className="text-[var(--ds-primary)]" />
                  <span>{language === 'ar' ? 'الفواتير الأخيرة والمدفوعات' : 'Recent Invoices'}</span>
                </h3>
                <div className="space-y-3">
                  {adminStats.invoices.map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center text-xs p-3 bg-[var(--ds-surface-secondary)] rounded-xl">
                      <div className="space-y-1">
                        <span className="font-bold block text-[var(--ds-text-primary)]">{inv.id}</span>
                        <span className="text-[10px] text-[var(--ds-text-muted)]">{inv.date}</span>
                      </div>
                      <div className="text-left space-y-1">
                        <span className="font-extrabold text-[var(--ds-text-primary)] block">{inv.amount}</span>
                        <Badge variant={inv.status === 'PAID' ? 'completed' : 'warning'} className="text-[9px]">{inv.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
