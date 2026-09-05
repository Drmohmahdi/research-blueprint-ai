import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { legacyResearchStorageEnabled, purgeLegacyResearchStorage, researchStorage } from '../utils/researchStorage';
import type { ResearchProject, SimulationResult, SimulationParameters } from '../types/research';

// ── Typed Interfaces replacing 'any' ─────────────────────────────────────────
export interface IntelligenceProfile {
  pooledEffectSize?: number;
  lastPredictedEffectSize?: number;
  lastSimulatedPower?: number;
  predictionQualityScore?: number;
  predictionRuns?: number;
  lastUpdated?: string;
  [key: string]: unknown; // allow extension fields
}

export interface WorkflowProfilePayload {
  activePathId?: string;
  completedSteps?: string[];
  intelligenceProfile?: IntelligenceProfile;
}
import {
  apiListProjects,
  apiCreateProject,
  apiUpdateProject,
  apiDeleteProject,
  apiSimulateScores,
  apiLogin,
  apiLogout,
  apiRegister,
  apiGetMe,
  apiGetFeatureFlags,
  setApiAuthToken,
  setApiActiveOrgId,
  apiUpdateProjectWorkflowProfile
} from '../utils/api';
import { FUNNEL_EVENTS, track } from '../utils/analytics';
import { applyFeatureFlagOverrides } from '../utils/featureFlags';

export interface AuthUser {
  id?: string;
  username: string;
  role: string;
  org_id?: string | null;
  org_role?: string | null;
  permissions?: string[];
  is_global_admin?: boolean;
  account_status?: string;
  email_verified?: boolean;
}

interface ProjectContextType {
  projects: ResearchProject[];
  activeProject: ResearchProject | null;
  setActiveProject: (project: ResearchProject) => void;
  createProject: (project: Omit<ResearchProject, 'id' | 'version'>) => Promise<ResearchProject>;
  updateProject: (project: ResearchProject) => void;
  deleteProject: (id: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
  simulationResults: Record<string, SimulationResult>; // key: projectId
  runProjectSimulation: (params: SimulationParameters) => Promise<SimulationResult>;
  
  // Auth & Modes
  isSecureMode: boolean;
  setSecureMode: (mode: boolean) => void;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email: string, role: string) => Promise<boolean>;
  logout: () => void;
  updateProjectWorkflowProfile: (projectId: string, payload: WorkflowProfilePayload) => Promise<void>;
}

const defaultProject: ResearchProject = {
  id: 'demo-1',
  titleAr: 'أثر برنامج تدريبي مقترح قائم على الذكاء الاصطناعي في تنمية مهارات التفكير الناقد والتحصيل الدراسي لدى طلاب المرحلة الثانوية',
  titleEn: 'The Effect of a Proposed AI-Based Training Program on Developing Critical Thinking Skills and Academic Achievement among High School Students',
  departmentAr: 'قسم المناهج وطرق التدريس',
  departmentEn: 'Department of Curriculum and Instruction',
  institutionAr: 'جامعة الملك سعود',
  institutionEn: 'King Saud University',
  descriptionAr: 'يهدف هذا البحث إلى قياس مدى فاعلية برنامج تدريبي مصمم باستخدام تقنيات الذكاء الاصطناعي في تحسين التفكير الناقد والتحصيل العلمي للمجموعات التجريبية مقارنة بالضابطة.',
  descriptionEn: 'This research aims to measure the effectiveness of a training program designed using AI technologies in improving critical thinking and academic achievement of the experimental groups compared to the control group.',
  problemStatementAr: 'توجد فجوة في استخدام التقنيات الحديثة لتدريب الطلاب على مهارات التفكير العليا كالتفكير الناقد، وضعف الطرق التقليدية في تنمية الدافعية والتحصيل الدراسي المباشر.',
  problemStatementEn: 'There is a gap in using modern technologies to train students on higher-order thinking skills such as critical thinking, and a weakness in traditional methods to develop motivation and academic achievement.',
  studyDesign: 'quasi_experimental_pre_post',
  variables: [
    {
      id: 'v-1',
      nameAr: 'البرنامج التدريبي القائم على الذكاء الاصطناعي',
      nameEn: 'AI-Based Training Program',
      type: 'independent',
      scale: 'nominal',
      descriptionAr: 'البرنامج التدريبي المقترح الذي يتم تطبيقه على المجموعة التجريبية.',
      descriptionEn: 'The proposed training program applied to the experimental group.'
    },
    {
      id: 'v-2',
      nameAr: 'مهارات التفكير الناقد',
      nameEn: 'Critical Thinking Skills',
      type: 'dependent',
      scale: 'interval',
      maxValue: 50,
      minValue: 0,
      descriptionAr: 'الدرجة المحرزة في مقياس التفكير الناقد البعدي.',
      descriptionEn: 'Score achieved in the post critical thinking skills scale.'
    },
    {
      id: 'v-3',
      nameAr: 'التحصيل الدراسي',
      nameEn: 'Academic Achievement',
      type: 'dependent',
      scale: 'interval',
      maxValue: 100,
      minValue: 0,
      descriptionAr: 'درجة الطالب في اختبار التحصيل العلمي للمادة الدراسية.',
      descriptionEn: 'Student score in the subject academic achievement test.'
    },
    {
      id: 'v-4',
      nameAr: 'الدافعية للتعلم',
      nameEn: 'Learning Motivation',
      type: 'moderator',
      scale: 'interval',
      maxValue: 30,
      minValue: 0,
      descriptionAr: 'مقياس دافعية الطالب الذاتية نحو المادة.',
      descriptionEn: 'Scale of student intrinsic motivation towards the subject.'
    },
    {
      id: 'v-5',
      nameAr: 'التحصيل السابق',
      nameEn: 'Prior Achievement',
      type: 'control',
      scale: 'ratio',
      maxValue: 100,
      minValue: 0,
      descriptionAr: 'درجات الطلاب في العام الدراسي السابق لضبط الفروق الفردية.',
      descriptionEn: 'Students scores in the previous academic year to control individual differences.'
    }
  ],
  questions: [
    {
      id: 'q-1',
      textAr: 'هل توجد فروق ذات دلالة إحصائية بين متوسطي درجات المجموعة التجريبية والمجموعة الضابطة في التطبيق البعدي لمقياس مهارات التفكير الناقد؟',
      textEn: 'Are there statistically significant differences between the mean scores of the experimental group and the control group in the post-application of the critical thinking skills scale?',
      associatedVariables: ['v-1', 'v-2']
    },
    {
      id: 'q-2',
      textAr: 'هل توجد فروق ذات دلالة إحصائية بين متوسطي درجات المجموعة التجريبية والمجموعة الضابطة في التطبيق البعدي لاختبار التحصيل الدراسي؟',
      textEn: 'Are there statistically significant differences between the mean scores of the experimental group and the control group in the post-application of the academic achievement test?',
      associatedVariables: ['v-1', 'v-3']
    }
  ],
  hypotheses: [
    {
      id: 'h-1',
      questionId: 'q-1',
      textAr: 'توجد فروق ذات دلالة إحصائية عند مستوى (0.05) بين متوسطي درجات المجموعة التجريبية والمجموعة الضابطة في التطبيق البعدي للتفكير الناقد لصالح التجريبية.',
      textEn: 'There are statistically significant differences at the (0.05) level between the mean scores of the experimental and control groups in the post-application of critical thinking in favor of the experimental group.',
      type: 'directional',
      independentVarId: 'v-1',
      dependentVarId: 'v-2'
    },
    {
      id: 'h-2',
      questionId: 'q-2',
      textAr: 'توجد فروق ذات دلالة إحصائية عند مستوى (0.05) بين متوسطي درجات المجموعة التجريبية والمجموعة الضابطة في التطبيق البعدي لاختبار التحصيل لصالح التجريبية.',
      textEn: 'There are statistically significant differences at the (0.05) level between the mean scores of the experimental and control groups in the post-application of the achievement test in favor of the experimental group.',
      type: 'directional',
      independentVarId: 'v-1',
      dependentVarId: 'v-3'
    }
  ],
  sampleSettings: {
    populationSize: 1200,
    marginOfError: 0.05,
    confidenceLevel: 0.95,
    expectedPower: 0.80,
    expectedEffectSize: 0.5,
    expectedAttritionRate: 0.15,
    groupsCount: 2
  },
  version: 1
};

function authUserFromMe(
  me: {
    id: string;
    username: string;
    role: string;
    org_id?: string | null;
    org_role?: string | null;
    permissions?: string[];
    is_global_admin?: boolean;
    account_status?: string;
    email_verified?: boolean;
  },
  fallback?: AuthUser | null
): AuthUser {
  return {
    id: me.id,
    username: me.username,
    role: me.role,
    org_id: me.org_id ?? fallback?.org_id ?? null,
    org_role: me.org_role ?? fallback?.org_role ?? null,
    permissions: me.permissions ?? fallback?.permissions ?? [],
    is_global_admin: me.is_global_admin ?? fallback?.is_global_admin ?? false,
    account_status: me.account_status ?? fallback?.account_status ?? 'ACTIVE',
    email_verified: me.email_verified ?? fallback?.email_verified ?? false,
  };
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSecureMode, setSecureModeState] = useState<boolean>(() => {
    try {
      const hasSessionUser = Boolean(localStorage.getItem('rb_user'));
      return !legacyResearchStorageEnabled || localStorage.getItem('rb_secure_mode') === 'true' || hasSessionUser;
    } catch {
      return !legacyResearchStorageEnabled;
    }
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('rb_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [projects, setProjects] = useState<ResearchProject[]>(() => {
    if (!legacyResearchStorageEnabled || localStorage.getItem('rb_secure_mode') === 'true' || localStorage.getItem('rb_user')) {
      return [];
    }
    try {
      const saved = researchStorage.getItem('rb_projects');
      return saved ? JSON.parse(saved) : [defaultProject];
    } catch {
      return [defaultProject];
    }
  });
  
  const [activeProject, setActiveProjectState] = useState<ResearchProject | null>(null);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('rb_theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  
  const [language, setLanguageState] = useState<'ar' | 'en'>(() => {
    const saved = localStorage.getItem('rb_lang');
    return (saved as 'ar' | 'en') || 'ar';
  });
  
  const [simulationResults, setSimulationResults] = useState<Record<string, SimulationResult>>({});

  // Sync token on startup
  useEffect(() => {
    // Session credentials remain in the server-issued HttpOnly cookie.
  }, []);

  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      setActiveProjectState(projects[0]);
    }
  }, [projects, activeProject]);

  useEffect(() => {
    purgeLegacyResearchStorage();
    // SECURITY HARDENING: Never write projects data to local storage in Secure Research Mode!
    if (!isSecureMode && legacyResearchStorageEnabled) {
      researchStorage.setItem('rb_projects', JSON.stringify(projects));
    } else {
      researchStorage.removeItem('rb_projects');
    }
  }, [projects, isSecureMode]);

  useEffect(() => {
    localStorage.setItem('rb_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('rb_lang', language);
    const root = window.document.documentElement;
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
  }, [language]);

  useEffect(() => {
    if (!isSecureMode || !user) return;
    void apiGetFeatureFlags().then((flags) => {
      if (flags) applyFeatureFlagOverrides(flags);
    });
  }, [isSecureMode, user?.id]);

  // Synchronize with FastAPI backend on startup if Secure Research Mode is enabled
  useEffect(() => {
    async function syncWithBackend() {
      if (!isSecureMode || !user) return;
      const me = await apiGetMe();
      if (!me) {
        setUser(null);
        localStorage.removeItem('rb_user');
        setApiAuthToken(null);
        setApiActiveOrgId(null);
        setProjects(legacyResearchStorageEnabled ? [defaultProject] : []);
        setActiveProjectState(legacyResearchStorageEnabled ? defaultProject : null);
        return;
      }
      if (
        me.id !== user.id ||
        me.username !== user.username ||
        me.role !== user.role ||
        me.org_role !== user.org_role ||
        me.is_global_admin !== user.is_global_admin
      ) {
        const nextUser = authUserFromMe(me, user);
        setUser(nextUser);
        localStorage.setItem('rb_user', JSON.stringify(nextUser));
      }
      const backendProjects = await apiListProjects();
      if (backendProjects && backendProjects.length > 0) {
        setProjects(backendProjects);
        setActiveProjectState(prev => (
          prev && backendProjects.some(item => item.id === prev.id) ? prev : backendProjects[0]
        ));
      } else if (backendProjects) {
        setProjects([]);
        setActiveProjectState(null);
      }
    }
    syncWithBackend();
  }, [isSecureMode, user?.id]);

  const setSecureMode = (mode: boolean) => {
    const effectiveMode = legacyResearchStorageEnabled ? mode : true;
    setSecureModeState(effectiveMode);
    localStorage.setItem('rb_secure_mode', effectiveMode ? 'true' : 'false');
    if (!effectiveMode) {
      logout();
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const data = await apiLogin(username, password);
    if (data) {
      const me = await apiGetMe();
      const nextUser = me
        ? authUserFromMe(me)
        : {
            id: data.userId || 'local-id',
            username: data.username,
            role: data.role,
            permissions: [],
            is_global_admin: false,
          };
      setUser(nextUser);
      localStorage.setItem('rb_user', JSON.stringify(nextUser));
      setApiAuthToken(null);
      setSecureModeState(true);
      localStorage.setItem('rb_secure_mode', 'true');

      const backendProjects = await apiListProjects();
      if (backendProjects && backendProjects.length > 0) {
        setProjects(backendProjects);
        setActiveProjectState(backendProjects[0]);
      } else {
        setProjects([]);
        setActiveProjectState(null);
      }
      const refreshed = await apiGetMe();
      if (refreshed) {
        const withOrg = authUserFromMe(refreshed, nextUser);
        setUser(withOrg);
        localStorage.setItem('rb_user', JSON.stringify(withOrg));
      }
      return true;
    }
    return false;
  };

  const register = async (username: string, password: string, email: string, role: string): Promise<boolean> => {
    const created = await apiRegister(username, password, email, role);
    if (!created) return false;
    return login(username, password);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    localStorage.removeItem('rb_user');
    setApiAuthToken(null);
    setApiActiveOrgId(null);
    setProjects(legacyResearchStorageEnabled ? [defaultProject] : []);
    setActiveProjectState(legacyResearchStorageEnabled ? defaultProject : null);
  };

  const setActiveProject = useCallback((project: ResearchProject) => {
    setActiveProjectState(project);
  }, []);

  const createProject = useCallback(async (proj: Omit<ResearchProject, 'id' | 'version'>) => {
    if (isSecureMode && user) {
      const backendProj = await apiCreateProject(proj);
      if (!backendProj) {
        throw new Error('Could not create project on server');
      }
      setProjects(prev => {
        if (prev.length === 0) track(FUNNEL_EVENTS.createFirstProject);
        return [backendProj, ...prev.filter(item => item.id !== backendProj.id)];
      });
      setActiveProjectState(backendProj);
      return backendProj;
    }

    const tempId = `proj-${Date.now()}`;
    const newProject: ResearchProject = {
      ...proj,
      id: tempId,
      version: 1
    };
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectState(newProject);
    return newProject;
  }, [isSecureMode, user]);

  const updateProject = useCallback((proj: ResearchProject) => {
    const updated = { ...proj, version: proj.version + 1 };
    setProjects(prev => prev.map(p => p.id === proj.id ? updated : p));
    setActiveProjectState(prev => (prev?.id === proj.id ? updated : prev));

    if (isSecureMode && user) {
      void apiUpdateProject(updated);
    }
  }, [isSecureMode, user]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      setActiveProjectState(current => {
        if (current?.id !== id) return current;
        return filtered.length > 0 ? filtered[0] : null;
      });
      return filtered;
    });

    if (isSecureMode && user) {
      void apiDeleteProject(id);
    }
  }, [isSecureMode, user]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const setLanguage = useCallback((lang: 'ar' | 'en') => {
    setLanguageState(lang);
  }, []);

  const runProjectSimulation = useCallback(async (params: SimulationParameters): Promise<SimulationResult> => {
    if (!activeProject) throw new Error('No active project to simulate');
    
    const sampleSize = activeProject.sampleSettings.populationSize 
      ? Math.min(activeProject.sampleSettings.populationSize, 80)
      : 60;
      
    const result = await apiSimulateScores(sampleSize, params);
    
    setSimulationResults(prev => ({
      ...prev,
      [activeProject.id]: result
    }));
    
    return result;
  }, [activeProject]);

  const updateProjectWorkflowProfile = useCallback(async (
    projectId: string,
    payload: { activePathId?: string; completedSteps?: string[]; intelligenceProfile?: any }
  ) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          activePathId: payload.activePathId !== undefined ? payload.activePathId : p.activePathId,
          completedSteps: payload.completedSteps !== undefined ? payload.completedSteps : p.completedSteps,
          intelligenceProfile: payload.intelligenceProfile !== undefined ? payload.intelligenceProfile : p.intelligenceProfile,
          version: p.version + 1
        };
      }
      return p;
    }));

    setActiveProjectState(prev => {
      if (!prev || prev.id !== projectId) return prev;
      return {
        ...prev,
        activePathId: payload.activePathId !== undefined ? payload.activePathId : prev.activePathId,
        completedSteps: payload.completedSteps !== undefined ? payload.completedSteps : prev.completedSteps,
        intelligenceProfile: payload.intelligenceProfile !== undefined ? payload.intelligenceProfile : prev.intelligenceProfile,
        version: prev.version + 1
      };
    });

    if (isSecureMode && user) {
      await apiUpdateProjectWorkflowProfile(projectId, payload);
    }
  }, [isSecureMode, user]);

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      setActiveProject,
      createProject,
      updateProject,
      deleteProject,
      theme,
      toggleTheme,
      language,
      setLanguage,
      simulationResults,
      runProjectSimulation,
      
      // Auth details
      isSecureMode,
      setSecureMode,
      user,
      login,
      register,
      logout,
      updateProjectWorkflowProfile
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};

// oxlint-disable-next-line react/only-export-components
export const useProjectContext = useProject;
