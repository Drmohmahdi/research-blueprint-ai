import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { getTranslation } from '../utils/translations';
import { useNotifications } from '../hooks/useNotifications';
import { VIEW_TO_PATH, PATH_TO_VIEW } from '../router/routes';
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
  Bell,
  Briefcase,
  ClipboardList,
  Ruler,
  BarChart3,
  Search
} from 'lucide-react';
import { GuidedFlowSidebar } from '../features/guided-flow/GuidedFlowSidebar';
import { SupervisorPanel } from '../features/comments/SupervisorPanel';

interface LayoutV2Props {
  children: React.ReactNode;
}

export const LayoutV2: React.FC<LayoutV2Props> = ({ children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Derive currentView from URL path
  const currentView = PATH_TO_VIEW[pathname] ?? 'portal';

  const setCurrentView = (viewId: string) => {
    const path = VIEW_TO_PATH[viewId] ?? '/app';
    navigate(path);
  };

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
  
  const { unreadCount, markAllAsRead } = useNotifications(user?.id || null);

  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

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
            { id: 'dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', icon: LayoutDashboard },
            { id: 'decisionCenter', labelAr: 'مركز قرارات البحث', labelEn: 'Research Decision Center', icon: GitBranch },
            { id: 'planning', labelAr: 'خطة البحث', labelEn: 'Research Plan', icon: ClipboardList },
            { id: 'pathSelector', labelAr: 'اختيار المسار', labelEn: 'Path Selector', icon: Map },
            { id: 'wizard', labelAr: 'معالج البحث', labelEn: 'Research Wizard', icon: FolderGit2 }
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
            { id: 'consistency', labelAr: 'مدقق الاتساق', labelEn: 'Consistency Checker', icon: CheckSquare }
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
            { id: 'peerReview', labelAr: 'بوابة التحكيم العلمي', labelEn: 'Peer Review Portal', icon: Award }
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
            { id: 'promotion', labelAr: 'بصيرة للترقيات', labelEn: 'Promotion Dashboard', icon: Briefcase }
          ]
        }
      ];
    }

    if (pathname.startsWith('/app/visibility')) {
      return [
        backToPortalItem,
        {
          id: 'visibilityModule',
          titleAr: 'الهوية والانتشار',
          titleEn: 'Academic Visibility',
          items: [
            { id: 'visibility', labelAr: 'لوحة الانتشار الأكاديمي', labelEn: 'Visibility Dashboard', icon: Globe }
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
          { id: 'adminCenter', labelAr: 'مركز الإعدادات', labelEn: 'Control Center', icon: Settings },
          { id: 'saasWorkspaces', labelAr: 'مساحات العمل', labelEn: 'SaaS Workspaces', icon: FolderGit2 },
          { id: 'saasBilling', labelAr: 'الاشتراكات والفوترة', labelEn: 'Plans & Billing', icon: Calculator }
        ]
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
      preReg: { ar: 'التنفيذ والبيانات', en: 'Operations' },
      fidelity: { ar: 'التنفيذ والبيانات', en: 'Operations' },
      litSynthesizer: { ar: 'الأدلة والبحوث', en: 'Literature' },
      prisma: { ar: 'الأدلة والبحوث', en: 'Literature' },
      qualitative: { ar: 'الأدلة والبحوث', en: 'Literature' },
      reviewSim: { ar: 'النشر العلمي', en: 'Publishing' },
      peerReview: { ar: 'التحكيم العلمي', en: 'Peer Review' },
      export: { ar: 'النشر العلمي', en: 'Publishing' },
      progress: { ar: 'البحث العلمي', en: 'Research' },
      assistant: { ar: 'تصميم الدراسة', en: 'Study Design' },
      promotion: { ar: 'الترقيات الأكاديمية', en: 'Promotion' },
      visibility: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      visibilityAudit: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      visibilityPlan: { ar: 'الهوية والانتشار', en: 'Academic Visibility' },
      designSystem: { ar: 'أدوات النظام', en: 'System' },
      smokeTest: { ar: 'أدوات النظام', en: 'System' },
      saasWorkspaces: { ar: 'الاشتراك والمساحات', en: 'SaaS & Workspaces' },
      saasBilling: { ar: 'الاشتراك والمساحات', en: 'SaaS & Workspaces' },
      saasAudit: { ar: 'الاشتراك والمساحات', en: 'SaaS & Workspaces' }
    };

    const titleMap: Record<string, { ar: string; en: string }> = {
      portal: { ar: 'البوابة الرئيسية', en: 'Portal Gateway' },
      dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
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
      preReg: { ar: 'التسجيل المسبق', en: 'Pre-registration' },
      fidelity: { ar: 'متابعة التنفيذ', en: 'Field Monitoring' },
      litSynthesizer: { ar: 'تحليل الدراسات السابقة', en: 'Literature' },
      prisma: { ar: 'مخطط PRISMA', en: 'PRISMA' },
      qualitative: { ar: 'الترميز النوعي', en: 'Qualitative Lab' },
      reviewSim: { ar: 'جاهزية النشر', en: 'Readiness Review' },
      peerReview: { ar: 'تحكيم الأبحاث العلمية', en: 'Peer Review' },
      export: { ar: 'تصدير التقرير المنهجي', en: 'Export Blueprint' },
      progress: { ar: 'تقدم البحث', en: 'Research Progress' },
      assistant: { ar: 'مساعد المنهجية الذكي', en: 'Methodology Assistant' },
      promotion: { ar: 'لوحة الترقيات الأكاديمية', en: 'Promotion Dashboard' },
      visibility: { ar: 'لوحة الانتشار الأكاديمي', en: 'Visibility Dashboard' },
      visibilityAudit: { ar: 'تدقيق الهوية والاسم', en: 'Identity Audit' },
      visibilityPlan: { ar: 'خطة بناء السمعة الأكاديمية', en: 'Reputation Plan' },
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
    <div className="min-h-screen flex flex-col bg-[var(--ds-background-canvas)] text-[var(--ds-text-primary)] transition-colors duration-180 antialiased">
      {/* Top Banner Warning (Ethical warning required) */}
      <div className="bg-[var(--ds-warning-soft)] border-b border-[var(--ds-warning)]/20 px-4 py-2.5 flex items-center justify-center gap-2 text-xs md:text-sm text-[var(--ds-warning)] font-bold z-50">
        <AlertTriangle size={16} className="shrink-0 text-[var(--ds-warning)]" />
        <span className="text-center">{getTranslation(language, 'ethicalAlert')}</span>
      </div>

      {/* Premium V2 Header */}
      <header className="sticky top-0 z-40 w-full h-16 border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] shadow-sm backdrop-blur-md">
        <div className="flex h-full items-center justify-between px-6">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              aria-label={language === 'ar' ? 'فتح قائمة التنقل' : 'Open navigation menu'}
              className="lg:hidden p-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]"
            >
              <Menu size={20} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ds-primary)] text-white font-extrabold text-lg shadow-sm">
              {language === 'ar' ? 'ب' : 'B'}
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[var(--ds-text-primary)] m-0 leading-none">
                {getTranslation(language, 'title')}
              </h1>
              <p className="text-[10px] text-[var(--ds-text-muted)] m-0 mt-1.5 hidden sm:block font-bold">
                {getTranslation(language, 'subtitle')}
              </p>
            </div>
          </div>

          {/* Project Selection Dropdown / Metadata */}
          {pathname !== '/app' && (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-[10px] font-bold text-[var(--ds-text-muted)] uppercase tracking-wider">
                {language === 'ar' ? 'المشروع النشط:' : 'Active Project:'}
              </span>
              <select
                value={activeProject?.id || ''}
                onChange={(e) => {
                  const found = projects.find(p => p.id === e.target.value);
                  if (found) setActiveProject(found);
                }}
                className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--ds-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
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
          <div className="flex items-center gap-3">
            {/* Secure mode indicator */}
            {isSecureMode && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-success-soft)] text-[var(--ds-success)] border border-[var(--ds-success)]/20 text-[10px] font-extrabold">
                <Unlock size={12} />
                <span>{language === 'ar' ? 'وضع آمن' : 'SECURE'}</span>
              </div>
            )}

            {/* Notifications Bell */}
            <button
              onClick={() => markAllAsRead()}
              className="relative p-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] transition-colors cursor-pointer"
              title={language === 'ar' ? 'الإشعارات' : 'Notifications'}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--ds-danger)] text-[8px] font-bold text-white ring-2 ring-[var(--ds-surface-primary)]">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="p-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] transition-colors cursor-pointer"
              title={language === 'ar' ? 'English' : 'العربية'}
            >
              <Globe size={18} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User Profile */}
            {user && (
              <div className="flex items-center gap-2 border-r border-[var(--ds-border-subtle)] pr-3 mr-1">
                <div className="h-8 w-8 rounded-full bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] flex items-center justify-center font-bold text-xs">
                  <UserIcon size={14} />
                </div>
                <div className="hidden xl:block text-start">
                  <div className="text-xs font-extrabold leading-none">{user.username}</div>
                  <div className="text-[9px] text-[var(--ds-text-muted)] font-semibold mt-0.5">{user.role}</div>
                </div>
                <button
                  onClick={logout}
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
          className={`hidden lg:flex flex-col border-l border-r border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] transition-all duration-180 shrink-0 ${
            isCollapsed ? 'w-20' : 'w-[280px]'
          }`}
        >
          {/* Collapse toggle header */}
          <div className="p-4 border-b border-[var(--ds-border-subtle)] flex items-center justify-between">
            {!isCollapsed && (
              <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest">
                {language === 'ar' ? 'التنقل البحثي' : 'Research Navigation'}
              </span>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
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
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-muted)]" />
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
          <nav className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {!isCollapsed && activeProject && pathname.startsWith('/app/research') && (
              <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-muted)]">
                  <span>{language === 'ar' ? 'المشروع النشط' : 'Active project'}</span>
                  <span>{activeProjectCompletion}%</span>
                </div>
                <p className="m-0 text-xs font-bold text-[var(--ds-text-primary)] line-clamp-2">
                  {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ds-surface-tertiary)]" aria-label={language === 'ar' ? 'اكتمال المشروع' : 'Project completion'}>
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
                    className="w-full flex items-center justify-between text-[10px] font-black text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)] uppercase tracking-wider py-1 text-start focus:outline-none"
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
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative group cursor-pointer ${
                              isActive
                                ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary-active)] dark:text-[var(--ds-primary)] border border-[var(--ds-primary)]/30 shadow-sm'
                                : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] border border-transparent'
                            }`}
                          >
                            <Icon size={16} className={`shrink-0 ${isActive ? 'text-[var(--ds-primary)]' : 'text-[var(--ds-text-muted)]'}`} />
                            {!isCollapsed && (
                              <span className="truncate">{language === 'ar' ? item.labelAr : item.labelEn}</span>
                            )}

                            {/* Collapsed Tooltip overlay */}
                            {isCollapsed && (
                              <div className="absolute right-full left-auto ml-0 mr-2 transform translate-x-[-10px] hidden group-hover:block z-50 bg-zinc-950 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-xl font-bold border border-zinc-800 whitespace-nowrap">
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
          <div className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-sm">
            <div className="w-[280px] bg-[var(--ds-surface-primary)] h-full flex flex-col animate-slide-in relative border-l border-[var(--ds-border-subtle)]">
              <div className="p-4 border-b border-[var(--ds-border-subtle)] flex justify-between items-center">
                <span className="text-xs font-black">{language === 'ar' ? 'التنقل البحثي' : 'Research Navigation'}</span>
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
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-muted)]" />
                  <input
                    value={sidebarSearch}
                    onChange={(event) => setSidebarSearch(event.target.value)}
                    placeholder={language === 'ar' ? 'ابحث في القائمة' : 'Search menu'}
                    className="w-full rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] py-2 pl-3 pr-9 text-xs font-semibold text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </label>
                {activeProject && pathname.startsWith('/app/research') && (
                  <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-muted)]">
                      <span>{language === 'ar' ? 'المشروع النشط' : 'Active project'}</span>
                      <span>{activeProjectCompletion}%</span>
                    </div>
                    <p className="m-0 text-xs font-bold text-[var(--ds-text-primary)] line-clamp-2">
                      {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ds-surface-tertiary)]" aria-label={language === 'ar' ? 'اكتمال المشروع' : 'Project completion'}>
                      <div className="h-full bg-[var(--ds-primary)]" style={{ width: `${activeProjectCompletion}%` }} />
                    </div>
                  </div>
                )}
                {filteredSidebarGroups.map((group) => (
                  <div key={group.id} className="space-y-1.5">
                    <span className="text-[9px] font-black text-[var(--ds-text-muted)] uppercase tracking-wider block">
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
                              ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary-active)] dark:text-[var(--ds-primary)] border-[var(--ds-primary)]/30'
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
        <main className="flex-1 flex flex-col overflow-y-auto px-4 md:px-8 py-6 max-w-[1500px] mx-auto w-full">
          
          {/* Breadcrumbs and Context Info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold text-[var(--ds-text-muted)] uppercase tracking-widest">
                {getBreadcrumbs()}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-[var(--ds-text-primary)] m-0">
                {activeProject ? (language === 'ar' ? activeProject.titleAr : activeProject.titleEn) : 'بصيرة'}
              </h2>
            </div>
            
            {activeProject?.activePathId && pathname.startsWith('/app/research') && (
              <div className="px-3.5 py-1.5 rounded-lg bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 text-xs font-bold text-[var(--ds-primary)] flex items-center gap-1.5 shrink-0">
                <Sparkles size={13} />
                <span>{language === 'ar' ? 'المسار:' : 'Path:'} {activeProject.activePathId}</span>
              </div>
            )}
          </div>

          {/* Research Lifecycle Stepper V2 — Only show inside Research module */}
          {pathname.startsWith('/app/research') && (
            <div className="sticky top-0 z-30 mb-6 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-4 shadow-sm backdrop-blur-sm">
              <span className="text-[9px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest block mb-3.5">
                {language === 'ar' ? 'دورة حياة البحث العلمي النشطة' : 'Active Scientific Research Lifecycle'}
              </span>
              <div className="flex items-center justify-between overflow-x-auto gap-4 py-1 no-scrollbar">
                {lifecycleStages.map((stage, idx) => {
                  const currentStage = getLifecycleStage();
                  const isPassed = idx < currentStage;
                  const isCurrent = idx === currentStage;

                  return (
                    <div key={idx} className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-black border transition-all duration-300 ${
                          isPassed 
                            ? 'bg-[var(--ds-success-soft)] text-[var(--ds-success)] border-[var(--ds-success)]/30' 
                            : isCurrent 
                              ? 'bg-[var(--ds-primary)] text-white border-[var(--ds-primary)] shadow-sm ring-4 ring-[var(--ds-primary-soft)] scale-105' 
                              : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)] border-[var(--ds-border-subtle)]'
                        }`}>
                          {idx + 1}
                        </div>
                        <span className={`text-[10px] font-bold ${
                          isPassed ? 'text-[var(--ds-success)]' : isCurrent ? 'text-[var(--ds-primary)] font-extrabold' : 'text-[var(--ds-text-muted)]'
                        }`}>
                          {language === 'ar' ? stage.labelAr : stage.labelEn}
                        </span>
                      </div>
                      {idx < lifecycleStages.length - 1 && (
                        <div className={`h-[1px] w-6 md:w-10 ${
                          idx < currentStage ? 'bg-[var(--ds-success)]/40' : 'bg-[var(--ds-border-subtle)]'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Children View Panel with optional side panels */}
          <div className="flex-1 flex gap-6">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {children}
            </div>

            {/* Right side: GuidedFlow + Comments (Only show inside Research module) */}
            {activeProject?.activePathId && pathname.startsWith('/app/research') && (
              <div className="hidden xl:flex flex-col gap-4 w-[260px] shrink-0">
                <GuidedFlowSidebar />
                <SupervisorPanel />
              </div>
            )}
          </div>
        </main>

      </div>

    </div>
  );
};
