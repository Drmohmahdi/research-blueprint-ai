import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { getTranslation } from '../utils/translations';
import { VIEW_TO_PATH, viewFromPathname, ROUTES } from '../router/routes';
import { 
  LayoutDashboard, 
  Sparkles, 
  CheckSquare, 
  GitFork, 
  Calculator, 
  PlayCircle, 
  Database, 
  FileLock2, 
  Activity, 
  BookOpen, 
  UserCheck, 
  Globe, 
  Sun, 
  Moon, 
  FolderGit2, 
  GitBranch,
  AlertTriangle,
  Unlock,
  LogOut,
  User as UserIcon,
  Brain,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Map,
  ChevronLeft,
  Award,
  FileText,
  Briefcase,
  ClipboardList,
  Ruler,
  BarChart3,
  Search,
  GraduationCap
} from 'lucide-react';
import { GuidedFlowSidebar } from '../features/guided-flow/GuidedFlowSidebar';
import { SupervisorPanel } from '../features/comments/SupervisorPanel';
import { NotificationCenter } from '../features/notifications/NotificationCenter';
import { useFeatureFlag } from '../utils/featureFlags';

interface LayoutV2Props {
  children: React.ReactNode;
}

export const LayoutV2: React.FC<LayoutV2Props> = ({ children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
    const { 
    projects, 
    activeProject, 
    setActiveProject, 
    theme, 
    toggleTheme, 
    language, 
    setLanguage,
    isSecureMode,
    user,
    logout
  } = useProject();
    const canViewBilling = Boolean(user?.permissions?.includes('billing.view'));
    const canViewAudit = Boolean(user?.permissions?.includes('audit.view'));
    const isPlatformAdmin = Boolean(user?.is_global_admin);
    const showGuidedResearch = useFeatureFlag('GUIDED_RESEARCH_MODE');
    const showSupervisorComments = useFeatureFlag('SUPERVISOR_COMMENTS_IN_PATH');

  const currentView = viewFromPathname(pathname);

  const setCurrentView = (viewId: string) => {
    let path = VIEW_TO_PATH[viewId] ?? '/app';
    if (path.includes(':projectId')) {
      if (!activeProject?.id) {
        navigate(ROUTES.PATHS);
        return;
      }
      path = path.replaceAll(':projectId', activeProject.id);
    }
    if (path.includes(':organizationId')) {
      path = path.replaceAll(':organizationId', activeProject?.organizationId || 'personal');
    }
    navigate(path);
  };

  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const menu = mobileMenuRef.current;
    const trigger = mobileMenuButtonRef.current;
    const firstButton = menu?.querySelector<HTMLElement>('button');
    firstButton?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !menu) return;
      const focusable = Array.from(menu.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
    };
  }, [mobileMenuOpen]);

  // Dynamic Contextual Sidebar groups based on current URL path
  const getSidebarGroups = () => {
    const backToPortalItem = {
      id: 'backToPortal',
      titleAr: 'المنظومة الأكاديمية',
      titleEn: 'Baseerah Portal',
      items: [
        { id: 'portal', labelAr: 'البوابة الرئيسية', labelEn: 'Portal Gateway', icon: LayoutDashboard }
      ]
    };

    if (pathname === '/app') {
      return [
        {
          id: 'portalMain',
          titleAr: 'بوابة بصيرة الأكاديمية',
          titleEn: 'Academic Portal',
          items: [
            { id: 'portal', labelAr: 'البوابة الرئيسية', labelEn: 'Portal Gateway', icon: LayoutDashboard }
          ]
        }
      ];
    }

    if (pathname.startsWith('/app/research')) {
      return [
        backToPortalItem,
        {
          id: 'workspace',
          titleAr: 'البحث العلمي',
          titleEn: 'Scientific Research',
          items: [
            { id: 'lifecycle', labelAr: 'مركز قيادة المشروع', labelEn: 'Project Command Center', icon: GitBranch },
            { id: 'newStudyDesign', labelAr: 'مساحة تصميم الدراسة', labelEn: 'Study design workspace', icon: FolderGit2 },
            { id: 'researchOffice', labelAr: 'عمليات مكتب البحث', labelEn: 'Research office', icon: Briefcase },
            { id: 'thesisOperations', labelAr: 'تشغيل الرسالة العلمية', labelEn: 'Thesis operations', icon: GraduationCap },
            { id: 'graduateStudies', labelAr: 'عمليات الدراسات العليا', labelEn: 'Graduate Studies', icon: ClipboardList },
            { id: 'planning', labelAr: 'خطة البحث', labelEn: 'Research Plan', icon: ClipboardList },
            { id: 'pathSelector', labelAr: 'اختيار المسار', labelEn: 'Path Selector', icon: Map }
          ]
        },
        {
          id: 'studyDesign',
          titleAr: 'تصميم الدراسة',
          titleEn: 'Study Design',
          items: [
            { id: 'analyzer', labelAr: 'محلل العنوان', labelEn: 'Title Analyzer', icon: Sparkles },
            { id: 'assistant', labelAr: 'مساعد المنهجية', labelEn: 'Methodology Assistant', icon: Brain },
            { id: 'modelBuilder', labelAr: 'النموذج المفاهيمي', labelEn: 'Conceptual Model', icon: GitFork },
            { id: 'sampleCalc', labelAr: 'حاسبة حجم العينة', labelEn: 'Sample Size Calculator', icon: Calculator },
            { id: 'measurement', labelAr: 'أدوات القياس والصدق والثبات', labelEn: 'Measurement and Reliability', icon: Ruler },
            { id: 'analysisPlan', labelAr: 'خطة التحليل الإحصائي', labelEn: 'Statistical Analysis Plan', icon: BarChart3 },
            { id: 'consistency', labelAr: 'مدقق الاتساق', labelEn: 'Consistency Checker', icon: CheckSquare },
            { id: 'decisionCenter', labelAr: 'مركز قرارات البحث', labelEn: 'Research Decision Center', icon: GitBranch }
          ]
        },
        {
          id: 'prediction',
          titleAr: 'المحاكاة والتنبؤ',
          titleEn: 'Simulation & Forecast',
          items: [
            { id: 'simulation', labelAr: 'مختبر المحاكاة', labelEn: 'Simulation Lab', icon: PlayCircle },
            { id: 'outcomePredictor', labelAr: 'محرك التنبؤ', labelEn: 'Outcome Predictor', icon: Brain }
          ]
        },
        {
          id: 'execution',
          titleAr: 'التنفيذ والبيانات',
          titleEn: 'Field Operations',
          items: [
            { id: 'preReg', labelAr: 'التسجيل المسبق', labelEn: 'Pre-registration', icon: FileLock2 },
            { id: 'dataQuality', labelAr: 'جودة البيانات', labelEn: 'Data Inspector', icon: Database },
            { id: 'researchData', labelAr: 'البيانات والتحليل', labelEn: 'Data & Analysis Studio', icon: BarChart3 },
            { id: 'fidelity', labelAr: 'متابعة التنفيذ', labelEn: 'Field Monitoring', icon: Activity }
          ]
        },
        {
          id: 'literature',
          titleAr: 'الأدلة والبحوث',
          titleEn: 'Literature & Research',
          items: [
            { id: 'litSynthesizer', labelAr: 'تحليل الدراسات السابقة', labelEn: 'Literature Synthesizer', icon: BookOpen },
            { id: 'prisma', labelAr: 'مخطط PRISMA', labelEn: 'PRISMA Builder', icon: BookOpen },
            { id: 'qualitative', labelAr: 'الترميز النوعي', labelEn: 'Qualitative Lab', icon: Sparkles }
          ]
        }
      ];
    }

    if (pathname.startsWith('/app/publishing')) {
      return [
        backToPortalItem,
        {
          id: 'publishingModule',
          titleAr: 'النشر العلمي',
          titleEn: 'Scientific Publishing',
          items: [
            { id: 'publishing', labelAr: 'مركز ذكاء النشر', labelEn: 'Publication intelligence', icon: BookOpen },
            { id: 'reviewSim', labelAr: 'جاهزية النشر', labelEn: 'Publication Reviewer', icon: UserCheck },
            { id: 'export', labelAr: 'تصدير التقرير المنهجي', labelEn: 'Export Blueprint', icon: FileText }
          ]
        },
        {
          id: 'publishingLit',
          titleAr: 'الأدلة والنطاق',
          titleEn: 'Literature & Scope',
          items: [
            { id: 'litSynthesizer', labelAr: 'تحليل الدراسات السابقة', labelEn: 'Literature Synthesizer', icon: BookOpen },
            { id: 'prisma', labelAr: 'مخطط PRISMA', labelEn: 'PRISMA Builder', icon: BookOpen }
          ]
        }
      ];
    }

    if (pathname.startsWith('/app/peer-review')) {
      return [
        backToPortalItem,
        {
          id: 'peerReviewModule',
          titleAr: 'تحكيم البحث العلمي',
          titleEn: 'Scientific Peer Review',
          items: [
            { id: 'peerReview', labelAr: 'بوابة التحكيم العلمي', labelEn: 'Peer Review Portal', icon: Award },
            { id: 'peerReviewAssignments', labelAr: 'تعييناتي كمُحكّم', labelEn: 'My reviewer assignments', icon: ClipboardList }
          ]
        }
      ];
    }

    if (pathname.startsWith('/app/promotion')) {
      return [
        backToPortalItem,
        {
          id: 'promotionModule',
          titleAr: 'الترقيات الأكاديمية',
          titleEn: 'Academic Promotion',
          items: [
            { id: 'promotion', labelAr: 'بصيرة للترقيات', labelEn: 'Promotion Dashboard', icon: Briefcase },
            { id: 'promotionRegulations', labelAr: 'اللوائح المرجعية', labelEn: 'Promotion regulations', icon: BookOpen }
          ]
        }
      ];
    }

    if (pathname.startsWith('/app/visibility') || pathname.startsWith('/app/assets') || pathname.startsWith('/app/profile') || pathname.startsWith('/app/search')) {
      return [
        backToPortalItem,
        {
          id: 'visibilityModule',
          titleAr: 'الهوية والانتشار',
          titleEn: 'Academic Visibility',
          items: [
            { id: 'profile', labelAr: 'الملف الأكاديمي', labelEn: 'Academic profile', icon: UserIcon },
            { id: 'visibility', labelAr: 'لوحة الانتشار الأكاديمي', labelEn: 'Visibility Dashboard', icon: Globe },
            { id: 'assets', labelAr: 'الأصول العلمية', labelEn: 'Scholarly Assets', icon: FolderGit2 },
            { id: 'visibilityReports', labelAr: 'التقارير', labelEn: 'Reports', icon: CheckSquare },
            { id: 'search', labelAr: 'البحث الأكاديمي', labelEn: 'Academic search', icon: Search }
          ]
        }
      ];
    }

    return [
      backToPortalItem,
      {
        id: 'admin',
        titleAr: 'التحكم والإدارة',
        titleEn: 'Administration Center',
        items: [
          ...(isPlatformAdmin ? [{ id: 'adminCenter', labelAr: 'مركز الإعدادات', labelEn: 'Control Center', icon: Settings }] : []),
          { id: 'saasWorkspaces', labelAr: 'مساحات العمل', labelEn: 'SaaS Workspaces', icon: FolderGit2 },
          ...(canViewBilling ? [{ id: 'saasBilling', labelAr: 'الاشتراكات والفوترة', labelEn: 'Plans & Billing', icon: Calculator }] : []),
          ...(canViewAudit ? [{ id: 'saasAudit', labelAr: 'سجل الرقابة', labelEn: 'Audit logs', icon: FileLock2 }] : []),
        ].filter(Boolean)
      }
    ];
  };

  const visibleSidebarGroups = getSidebarGroups();
  const normalizedSidebarSearch = sidebarSearch.trim().toLowerCase();
  const filteredSidebarGroups = normalizedSidebarSearch
    ? visibleSidebarGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => {
            const haystack = `${group.titleAr} ${group.titleEn} ${item.labelAr} ${item.labelEn}`.toLowerCase();
            return haystack.includes(normalizedSidebarSearch);
          })
        }))
        .filter(group => group.items.length > 0)
    : visibleSidebarGroups;

  const activeProjectCompletion = activeProject
    ? Math.round(([
        activeProject.titleAr,
        activeProject.titleEn,
        activeProject.problemStatementAr,
        activeProject.questions.length > 0,
        activeProject.hypotheses.length > 0,
        activeProject.variables.length > 0
      ].filter(Boolean).length / 6) * 100)
    : 0;

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Derive Lifecycle Stepper stage from URL path
  const getLifecycleStage = () => {
    if (pathname.includes('/wizard') || pathname.includes('/analyzer')) return 1;
    if (pathname.includes('/consistency')) return 2;
    if (pathname.includes('/simulation/lab')) return 4;
    if (pathname.includes('/pre-registration')) return 5;
    if (pathname.includes('/monitoring')) return 6;
    if (pathname.includes('/field') || pathname.includes('/literature')) return 7;
    if (pathname.includes('/publishing') || pathname.includes('/review')) return 8;
    if (pathname.includes('/predictor')) return 9;
    return 0;
  };

  const lifecycleStages = [
    { labelAr: 'فكرة', labelEn: 'Idea' },
    { labelAr: 'خطة', labelEn: 'Plan' },
    { labelAr: 'تصميم', labelEn: 'Design' },
    { labelAr: 'تحقق', labelEn: 'Verify' },
    { labelAr: 'محاكاة', labelEn: 'Simulate' },
    { labelAr: 'تسجيل مسبق', labelEn: 'Pre-Reg' },
    { labelAr: 'تنفيذ', labelEn: 'Execute' },
    { labelAr: 'تحليل', labelEn: 'Analyze' },
    { labelAr: 'كتابة', labelEn: 'Write' },
    { labelAr: 'نشر', labelEn: 'Publish' }
  ];

  // Derive Breadcrumbs
  const getBreadcrumbs = () => {
    const parentMap: Record<string, { ar: string; en: string }> = {
      portal: { ar: 'بصيرة الأكاديمية', en: 'Baseerah Suite' },
      dashboard: { ar: 'البحث العلمي', en: 'Research' },
      lifecycle: { ar: 'دورة حياة البحث', en: 'Research Lifecycle' },
      decisionCenter: { ar: 'البحث العلمي', en: 'Research' },
      planning: { ar: 'البحث العلمي', en: 'Research' },
      pathSelector: { ar: 'البحث العلمي', en: 'Research' },
      wizard: { ar: 'البحث العلمي', en: 'Research' },
      analyzer: { ar: 'تصميم الدراسة', en: 'Study Design' },
      consistency: { ar: 'تصميم الدراسة', en: 'Study Design' },
      modelBuilder: { ar: 'تصميم الدراسة', en: 'Study Design' },
      sampleCalc: { ar: 'تصميم الدراسة', en: 'Study Design' },
      measurement: { ar: 'تصميم الدراسة', en: 'Study Design' },
      analysisPlan: { ar: 'تصميم الدراسة', en: 'Study Design' },
      simulation: { ar: 'المحاكاة والتنبؤ', en: 'Simulation' },
      outcomePredictor: { ar: 'المحاكاة والتنبؤ', en: 'Simulation' },
      dataQuality: { ar: 'التنفيذ والبيانات', en: 'Operations' },
      researchData: { ar: 'التنفيذ والبيانات', en: 'Operations' },
      preReg: { ar: 'التنفيذ والبيانات', en: 'Operations' },
      fidelity: { ar: 'التنفيذ والبيانات', en: 'Operations' },
      litSynthesizer: { ar: 'الأدلة والبحوث', en: 'Literature' },
      prisma: { ar: 'الأدلة والبحوث', en: 'Literature' },
      qualitative: { ar: 'الأدلة والبحوث', en: 'Literature' },
      reviewSim: { ar: 'النشر العلمي', en: 'Publishing' },
      publishing: { ar: 'النشر العلمي', en: 'Publishing' },
      newStudyDesign: { ar: 'تصميم الدراسة', en: 'Study Design' },
      researchCommandCenter: { ar: 'البحث العلمي', en: 'Research' },
      researchOffice: { ar: 'البحث العلمي', en: 'Research' },
      peerReview: { ar: 'التحكيم العلمي', en: 'Peer Review' },
      export: { ar: 'النشر العلمي', en: 'Publishing' },
      progress: { ar: 'البحث العلمي', en: 'Research' },
      assistant: { ar: 'تصميم الدراسة', en: 'Study Design' },
      promotion: { ar: 'الترقيات الأكاديمية', en: 'Promotion' },
      visibility: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      visibilityAudit: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      visibilityPlan: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      visibilityReports: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      assets: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      designSystem: { ar: 'أدوات النظام', en: 'System' },
      smokeTest: { ar: 'أدوات النظام', en: 'System' },
      saasWorkspaces: { ar: 'الاشتراك والمساحات', en: 'SaaS & Workspaces' },
      saasBilling: { ar: 'الاشتراك والمساحات', en: 'SaaS & Workspaces' },
      saasAudit: { ar: 'الاشتراك والمساحات', en: 'SaaS & Workspaces' }
    };

    const titleMap: Record<string, { ar: string; en: string }> = {
      portal: { ar: 'البوابة الرئيسية', en: 'Portal Gateway' },
      dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
      lifecycle: { ar: 'مركز قيادة المشروع', en: 'Project Command Center' },
      thesisOperations: { ar: 'تشغيل الرسالة العلمية', en: 'Thesis operations' },
      graduateStudies: { ar: 'عمليات الدراسات العليا', en: 'Graduate Studies' },
      decisionCenter: { ar: 'مركز قرارات البحث', en: 'Research Decision Center' },
      planning: { ar: 'خطة البحث', en: 'Research Plan' },
      pathSelector: { ar: 'اختيار المسار', en: 'Path Selector' },
      wizard: { ar: 'معالج البحث', en: 'Research Wizard' },
      analyzer: { ar: 'محلل العنوان', en: 'Title Analyzer' },
      consistency: { ar: 'مدقق الاتساق', en: 'Consistency' },
      modelBuilder: { ar: 'النموذج المفاهيمي', en: 'Conceptual Model' },
      sampleCalc: { ar: 'حاسبة حجم العينة', en: 'Sample Calc' },
      measurement: { ar: 'أدوات القياس والصدق والثبات', en: 'Measurement and Reliability' },
      analysisPlan: { ar: 'خطة التحليل الإحصائي', en: 'Statistical Analysis Plan' },
      simulation: { ar: 'مختبر المحاكاة', en: 'Simulation Lab' },
      outcomePredictor: { ar: 'محرك التنبؤ بالنتائج', en: 'Prediction Engine' },
      dataQuality: { ar: 'جودة البيانات', en: 'Data Quality' },
      researchData: { ar: 'البيانات والتحليل', en: 'Data & Analysis' },
      preReg: { ar: 'التسجيل المسبق', en: 'Pre-registration' },
      fidelity: { ar: 'متابعة التنفيذ', en: 'Field Monitoring' },
      litSynthesizer: { ar: 'تحليل الدراسات السابقة', en: 'Literature' },
      prisma: { ar: 'مخطط PRISMA', en: 'PRISMA' },
      qualitative: { ar: 'الترميز النوعي', en: 'Qualitative Lab' },
      reviewSim: { ar: 'جاهزية النشر', en: 'Readiness Review' },
      publishing: { ar: 'مركز ذكاء النشر', en: 'Publication Intelligence' },
      newStudyDesign: { ar: 'مساحة تصميم الدراسة', en: 'Study Design Workspace' },
      researchCommandCenter: { ar: 'مركز قيادة التصميم', en: 'Design Command Center' },
      researchOffice: { ar: 'عمليات مكتب البحث', en: 'Research Office' },
      peerReview: { ar: 'تحكيم الأبحاث العلمية', en: 'Peer Review' },
      export: { ar: 'تصدير التقرير المنهجي', en: 'Export Blueprint' },
      progress: { ar: 'تقدم البحث', en: 'Research Progress' },
      assistant: { ar: 'مساعد المنهجية الذكي', en: 'Methodology Assistant' },
      promotion: { ar: 'لوحة الترقيات الأكاديمية', en: 'Promotion Dashboard' },
      visibility: { ar: 'لوحة الانتشار الأكاديمي', en: 'Visibility Dashboard' },
      visibilityAudit: { ar: 'تدقيق الهوية والاسم', en: 'Identity Audit' },
      visibilityPlan: { ar: 'خطة بناء السمعة الأكاديمية', en: 'Reputation Plan' },
      visibilityReports: { ar: 'تقارير الانتشار الأكاديمي', en: 'Visibility Reports' },
      assets: { ar: 'الأصول العلمية', en: 'Scholarly Assets' },
      designSystem: { ar: 'Design Showcase', en: 'Design V2' },
      smokeTest: { ar: 'Smoke Tests', en: 'Smoke Dashboard' },
      saasWorkspaces: { ar: 'مساحات العمل المشتركة', en: 'Shared Workspaces' },
      saasBilling: { ar: 'الباقات والفوترة', en: 'Plans & Billing' },
      saasAudit: { ar: 'سجل الرقابة والأمان', en: 'Security Audit Logs' }
    };

    const parent = parentMap[currentView] || { ar: 'المنصة', en: 'Platform' };
    const title = titleMap[currentView] || { ar: 'الرئيسية', en: 'Main' };

    return language === 'ar'
      ? `الرئيسية / ${parent.ar} / ${title.ar}`
      : `Home / ${parent.en} / ${title.en}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--ds-background-canvas)] text-[var(--ds-text-primary)] ds-transition antialiased">
      <a className="ds-skip-link" href="#main-content">
        {language === 'ar' ? 'تخطَّ إلى المحتوى الرئيسي' : 'Skip to main content'}
      </a>
      {/* Top Banner Warning (Ethical warning required) */}
      <div className="bg-[var(--ds-accent-gold-soft)] border-b border-[var(--ds-accent-gold)]/25 px-4 py-2 flex items-center justify-center gap-2 text-xs md:text-sm text-[var(--ds-text-primary)] font-bold z-50">
        <AlertTriangle size={16} className="shrink-0 text-[var(--ds-accent-gold-hover)] dark:text-[var(--ds-accent-gold)]" />
        <span className="text-center">{getTranslation(language, 'ethicalAlert')}</span>
      </div>

      {/* Premium V2 Header */}
      <header className="baseerah-glass sticky top-0 z-40 w-full h-[4.5rem] border-b border-[var(--ds-border-subtle)] shadow-[var(--ds-shadow-layered)]">
        <div className="ds-app-shell flex h-full w-full min-w-0 items-center justify-between gap-1.5 px-2 min-[380px]:px-3 sm:gap-2 sm:px-6 2xl:px-12 min-[2560px]:px-16">
          
          {/* Logo & Platform Info */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button 
              ref={mobileMenuButtonRef}
              onClick={() => setMobileMenuOpen(true)}
              aria-label={language === 'ar' ? 'فتح قائمة التنقل' : 'Open navigation menu'}
              className="lg:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]"
            >
              <Menu size={20} />
            </button>
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--ds-action-fill)] text-on-action font-bold shadow-[var(--ds-shadow-glow)] ring-1 ring-[var(--ds-accent-gold)]/25 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-lg">
              {language === 'ar' ? 'ب' : 'B'}
            </div>
            <div className="min-w-0">
              <div className="max-w-[128px] truncate text-xs font-bold leading-tight tracking-tight text-[var(--ds-text-primary)] min-[380px]:max-w-[160px] sm:max-w-[220px] lg:max-w-xl xl:max-w-2xl sm:text-base">
                {getTranslation(language, 'title')}
              </div>
              <p className="text-caption text-[var(--ds-text-muted)] m-0 mt-1 hidden sm:block font-semibold">
                {getTranslation(language, 'subtitle')}
              </p>
            </div>
          </div>

          {/* Project Selection Dropdown / Metadata */}
          {pathname !== '/app' && (
            <div className="hidden md:flex min-w-0 max-w-[34vw] items-center gap-3">
              <span className="text-caption font-semibold text-[var(--ds-text-muted)] uppercase tracking-wider">
                {language === 'ar' ? 'المشروع النشط:' : 'Active Project:'}
              </span>
              <select
                value={activeProject?.id || ''}
                onChange={(e) => {
                  const found = projects.find(p => p.id === e.target.value);
                  if (found) setActiveProject(found);
                }}
                aria-label={language === 'ar' ? 'اختيار المشروع النشط' : 'Select active project'}
                className="min-w-0 max-w-[28vw] truncate bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--ds-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {language === 'ar' ? p.titleAr : p.titleEn}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons (Theme, Language, Auth) */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2 lg:gap-3">
            {/* Global search button */}
            <button
              onClick={() => navigate('/app/search')}
              aria-label={language === 'ar' ? 'فتح البحث الأكاديمي الموحد' : 'Open unified academic search'}
              className="hidden min-[420px]:inline-flex p-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] transition-colors cursor-pointer"
              title={language === 'ar' ? 'بحث أكاديمي موحد' : 'Unified Search'}
            >
              <Search size={18} />
            </button>

            {/* Secure mode indicator */}
            {isSecureMode && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-success-soft)] text-[var(--ds-success)] border border-[var(--ds-success)]/20 text-caption font-bold">
                <Unlock size={12} />
                <span>{language === 'ar' ? 'وضع آمن' : 'SECURE'}</span>
              </div>
            )}

            {/* Notifications Center */}
            <NotificationCenter
              language={language}
              onNavigate={(view) => setCurrentView(view)}
            />

            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              aria-label={language === 'ar' ? 'تغيير اللغة إلى الإنجليزية' : 'Change language to Arabic'}
              className="p-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] transition-colors cursor-pointer"
              title={language === 'ar' ? 'English' : 'العربية'}
            >
              <Globe size={18} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? (language === 'ar' ? 'تفعيل الوضع الفاتح' : 'Use light theme') : (language === 'ar' ? 'تفعيل الوضع الداكن' : 'Use dark theme')}
              className="inline-flex p-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User Profile */}
            {user && (
              <div className="flex items-center gap-1 sm:gap-2 sm:border-r border-[var(--ds-border-subtle)] sm:pr-3 sm:mr-1">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.PROFILE)}
                  aria-label={language === 'ar' ? 'فتح الملف الأكاديمي' : 'Open academic profile'}
                  className="flex items-center gap-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] px-1 py-1 cursor-pointer"
                >
                  <div className="hidden sm:flex h-8 w-8 rounded-full bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] items-center justify-center font-bold text-xs">
                    <UserIcon size={14} />
                  </div>
                  <div className="hidden xl:block text-start">
                    <div className="text-caption font-bold leading-none">{user.username}</div>
                    <div className="text-caption text-[var(--ds-text-muted)] font-medium mt-0.5">{user.org_role || user.role}</div>
                  </div>
                </button>
                <button
                  onClick={logout}
                  aria-label={language === 'ar' ? 'تسجيل الخروج' : 'Log out'}
                  className="p-2 rounded-xl hover:bg-[var(--ds-danger-soft)] text-[var(--ds-danger)] transition-colors cursor-pointer"
                  title={language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex flex-1 relative min-h-0">
        
        {/* Intelligent Sidebar V2 (Desktop Only) */}
        <aside 
          aria-label={language === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}
          className={`hidden lg:flex flex-col border-l border-r border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] shadow-[var(--ds-shadow-layered)] transition-all duration-200 shrink-0 ${
            isCollapsed ? 'w-20' : 'w-[280px]'
          }`}
        >
          {/* Collapse toggle header */}
          <div className="p-4 border-b border-[var(--ds-border-subtle)] flex items-center justify-between">
            {!isCollapsed && (
              <span className="text-caption font-bold text-[var(--ds-text-muted)] uppercase tracking-wider">
                {language === 'ar' ? 'التنقل البحثي' : 'Research Navigation'}
              </span>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? (language === 'ar' ? 'توسيع شريط التنقل' : 'Expand navigation') : (language === 'ar' ? 'طي شريط التنقل' : 'Collapse navigation')}
              aria-expanded={!isCollapsed}
              className="p-1.5 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] mx-auto cursor-pointer"
            >
              {language === 'ar' 
                ? (isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
                : (isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
              }
            </button>
          </div>

          {!isCollapsed && (
            <div className="px-4 pt-4">
              <label className="relative block">
                <Search size={14} className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-muted)]" />
                <input
                  value={sidebarSearch}
                  onChange={(event) => setSidebarSearch(event.target.value)}
                  placeholder={language === 'ar' ? 'ابحث في أدوات المنصة' : 'Search platform tools'}
                  className="w-full rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] py-2 pl-3 pr-9 text-xs font-semibold text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                />
              </label>
            </div>
          )}

          {/* Navigation links groups (Scrollable) */}
          <nav aria-label={language === 'ar' ? 'أقسام المنصة' : 'Platform sections'} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {!isCollapsed && activeProject && pathname.startsWith('/app/research') && (
              <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-caption font-bold uppercase tracking-wider text-[var(--ds-text-muted)]">
                  <span>{language === 'ar' ? 'المشروع النشط' : 'Active project'}</span>
                  <span>{activeProjectCompletion}%</span>
                </div>
                <p className="text-caption m-0 font-bold text-[var(--ds-text-primary)] line-clamp-2">
                  {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ds-surface-tertiary)]" role="progressbar" aria-label={language === 'ar' ? 'اكتمال المشروع' : 'Project completion'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={activeProjectCompletion}>
                  <div className="h-full bg-[var(--ds-primary)]" style={{ width: `${activeProjectCompletion}%` }} />
                </div>
              </div>
            )}
            {filteredSidebarGroups.map((group) => {
              const isGroupCollapsed = collapsedGroups[group.id];

              return (
                <div key={group.id} className="space-y-1">
                  {/* Collapsible header */}
                  {!isCollapsed && (
                    <button
                      onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between text-caption font-bold text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)] uppercase tracking-wider py-1 text-start focus:outline-none"
                    >
                      <span>{language === 'ar' ? group.titleAr : group.titleEn}</span>
                      {isGroupCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                    </button>
                  )}

                  {/* List of items */}
                  {(!isGroupCollapsed || isCollapsed) && (
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            aria-label={language === 'ar' ? item.labelAr : item.labelEn}
                            aria-current={isActive ? 'page' : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold ds-transition relative group cursor-pointer ${
                              isActive
                                ? 'bg-[var(--ds-primary-soft)] text-ink border border-[var(--ds-primary)]/25'
                                : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] border border-transparent'
                            }`}
                          >
                            {isActive && (
                              <span className="absolute start-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--ds-primary)]" />
                            )}
                            <Icon size={16} className={`shrink-0 ${isActive ? 'text-[var(--ds-primary)]' : 'text-[var(--ds-text-muted)]'}`} />
                            {!isCollapsed && (
                              <span className="truncate">{language === 'ar' ? item.labelAr : item.labelEn}</span>
                            )}

                            {/* Collapsed Tooltip overlay */}
                            {isCollapsed && (
                              <div className="absolute inset-inline-end-full me-2 hidden group-hover:block z-50 bg-[var(--ds-navy)] text-white text-caption py-1.5 px-3 rounded-lg shadow-xl font-semibold border border-white/10 whitespace-nowrap">
                                {language === 'ar' ? item.labelAr : item.labelEn}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden bg-[var(--ds-surface-overlay)]" role="dialog" aria-modal="true" aria-label={language === 'ar' ? 'قائمة التنقل' : 'Navigation menu'}>
            <div ref={mobileMenuRef} className="w-[min(88vw,320px)] bg-[var(--ds-surface-primary)] h-full flex flex-col animate-slide-in relative border-inline-start border-[var(--ds-border-subtle)]">
              <div className="p-4 border-b border-[var(--ds-border-subtle)] flex justify-between items-center">
                <span className="text-caption font-bold">{language === 'ar' ? 'التنقل البحثي' : 'Research Navigation'}</span>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={language === 'ar' ? 'إغلاق قائمة التنقل' : 'Close navigation menu'}
                  className="p-1.5 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                <label className="relative block">
                  <Search size={14} className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-muted)]" />
                  <input
                    value={sidebarSearch}
                    onChange={(event) => setSidebarSearch(event.target.value)}
                    placeholder={language === 'ar' ? 'ابحث في القائمة' : 'Search menu'}
                    className="w-full rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] py-2 pl-3 pr-9 text-xs font-semibold text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </label>
                {activeProject && pathname.startsWith('/app/research') && (
                  <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-caption font-bold uppercase tracking-wider text-[var(--ds-text-muted)]">
                      <span>{language === 'ar' ? 'المشروع النشط' : 'Active project'}</span>
                      <span>{activeProjectCompletion}%</span>
                    </div>
                    <select
                      value={activeProject.id}
                      onChange={(e) => {
                        const found = projects.find(p => p.id === e.target.value);
                        if (found) setActiveProject(found);
                      }}
                      aria-label={language === 'ar' ? 'اختيار المشروع النشط' : 'Select active project'}
                      className="w-full truncate rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] px-2 py-1.5 text-xs font-bold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {language === 'ar' ? p.titleAr : p.titleEn}
                        </option>
                      ))}
                    </select>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ds-surface-tertiary)]" role="progressbar" aria-label={language === 'ar' ? 'اكتمال المشروع' : 'Project completion'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={activeProjectCompletion}>
                      <div className="h-full bg-[var(--ds-primary)]" style={{ width: `${activeProjectCompletion}%` }} />
                    </div>
                  </div>
                )}
                {filteredSidebarGroups.map((group) => (
                  <div key={group.id} className="space-y-1.5">
                    <span className="text-caption font-bold text-[var(--ds-text-muted)] uppercase tracking-wider block">
                      {language === 'ar' ? group.titleAr : group.titleEn}
                    </span>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setCurrentView(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold border ${
                            isActive
                              ? 'bg-[var(--ds-primary-soft)] text-ink border-[var(--ds-primary)]/30'
                              : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] border-transparent'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{language === 'ar' ? item.labelAr : item.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 h-full" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Content Workspace */}
        <main id="main-content" tabIndex={-1} className="ds-app-shell min-w-0 flex-1 flex flex-col overflow-y-auto px-3 min-[380px]:px-4 md:px-8 2xl:px-12 min-[2560px]:px-16 py-4 sm:py-6 w-full">
          
          {/* Breadcrumbs and Context Info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 min-w-0">
            <div className="min-w-0 space-y-1">
              <div className="text-caption font-bold text-[var(--ds-text-muted)] uppercase tracking-wider">
                {getBreadcrumbs()}
              </div>
              <h1 className="text-h1 break-words text-[var(--ds-text-primary)] m-0">
                {activeProject ? (language === 'ar' ? activeProject.titleAr : activeProject.titleEn) : 'بصيرة'}
              </h1>
            </div>
            
            {activeProject?.activePathId && pathname.startsWith('/app/research') && (
              <div className="px-3.5 py-1.5 rounded-lg bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 text-xs font-bold text-ink flex items-center gap-1.5 shrink-0">
                <Sparkles size={13} className="text-[var(--ds-primary)]" />
                <span>{language === 'ar' ? 'المسار:' : 'Path:'} {activeProject.activePathId}</span>
              </div>
            )}
          </div>

          {/* Research Lifecycle Stepper V2 — Only show inside Research module */}
          {pathname.startsWith('/app/research') && (
            <div className="sticky top-0 z-30 mb-6 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-4 shadow-[var(--ds-shadow-layered)]">
              <span className="text-caption font-bold text-[var(--ds-text-muted)] uppercase tracking-wider block mb-3.5">
                {language === 'ar' ? 'دورة حياة البحث العلمي النشطة' : 'Active Scientific Research Lifecycle'}
              </span>
              <div
                className="flex items-center justify-between overflow-x-auto gap-4 py-1 no-scrollbar ds-edge-fade-x"
                role="region"
                aria-label="مراحل سير العمل البحثي"
                tabIndex={0}
              >
                {lifecycleStages.map((stage, idx) => {
                  const currentStage = getLifecycleStage();
                  const isPassed = idx < currentStage;
                  const isCurrent = idx === currentStage;

                  return (
                    <div key={idx} className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-caption font-bold border ds-transition ${
                          isPassed 
                            ? 'bg-[var(--ds-success-soft)] text-[var(--ds-success)] border-[var(--ds-success)]/30' 
                            : isCurrent 
                              ? 'bg-[var(--ds-primary-soft)] text-ink border-[var(--ds-primary)]/30 ring-4 ring-[var(--ds-primary-soft)]'
                              : 'bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-muted)] border-[var(--ds-border-default)]'
                        }`}>
                          {idx + 1}
                        </div>
                        <span className={`text-caption font-semibold ${
                          isPassed ? 'text-[var(--ds-success)]' : isCurrent ? 'text-ink font-bold' : 'text-[var(--ds-text-muted)]'
                        }`}>
                          {language === 'ar' ? stage.labelAr : stage.labelEn}
                        </span>
                      </div>
                      {idx < lifecycleStages.length - 1 && (
                        <div className={`h-px w-8 md:w-12 rounded-full ${
                          idx < currentStage ? 'bg-[var(--ds-success)]/50' : 'bg-[var(--ds-border-subtle)]'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Children View Panel with optional side panels */}
          <div className="flex-1 flex min-w-0 gap-4 2xl:gap-6">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {children}
            </div>

            {/* Right side: GuidedFlow + Comments (Only show inside Research module) */}
            {activeProject?.activePathId && pathname.startsWith('/app/research') && (showGuidedResearch || showSupervisorComments) && (
              <div className="hidden 2xl:flex flex-col gap-4 w-[280px] shrink-0">
                {showGuidedResearch && <GuidedFlowSidebar />}
                {showSupervisorComments && <SupervisorPanel />}
              </div>
            )}
          </div>
        </main>

      </div>

      <footer className="border-t border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] px-4 py-5 text-[var(--ds-text-secondary)] md:px-8 min-[2560px]:px-16">
        <div className="ds-app-shell flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-start">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ds-action-fill)] text-sm font-bold text-on-action shadow-[var(--ds-shadow-glow)]">
              {language === 'ar' ? 'ب' : 'B'}
            </div>
            <div>
              <p className="text-caption m-0 font-bold text-[var(--ds-text-primary)]">{getTranslation(language, 'title')}</p>
              <p className="m-0 mt-0.5 text-caption text-[var(--ds-text-muted)]">{language === 'ar' ? 'بيئة أكاديمية موثوقة لصناعة بحث أفضل' : 'A trusted academic environment for better research'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-caption font-semibold text-[var(--ds-text-muted)]">
            <span>{language === 'ar' ? 'الخصوصية أولًا' : 'Privacy first'}</span>
            <span className="text-[var(--ds-border-strong)]">•</span>
            <span>{language === 'ar' ? 'قرارات أكاديمية بمراجعة بشرية' : 'Human-reviewed academic decisions'}</span>
            <span className="text-[var(--ds-border-strong)]">•</span>
            <span>© {new Date().getFullYear()} Baseerah</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
