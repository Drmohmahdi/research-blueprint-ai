import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { RESEARCH_PATHS_CONFIG } from '../config/researchPathsConfig';
import type { ResearchPath } from '../config/researchPathsConfig';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import { EmptyState, Progress } from '../design-system/components/Feedback';
import { 
  Sparkles, 
  Compass, 
  ChevronRight,
  ChevronLeft,
  FolderGit2,
  UserCheck,
  Brain,
  Activity,
  Database,
  BookOpen
} from 'lucide-react';
import { VIEW_TO_PATH, ROUTES } from '../router/routes';
import { PlanLimitNotice } from './PlanLimitNotice';
import { isPlanLimitError } from '../utils/api';
import type { StudyDesignType } from '../types/research';

const starterStudyDesign = (pathId: string): StudyDesignType => (
  pathId === 'SCIENTIFIC_PAPER_READING' || pathId === 'SYSTEMATIC_REVIEW'
    ? 'correlational'
    : 'quasi_experimental_pre_post'
);

const CATEGORY_LABELS = {
  all: { ar: '\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a', en: 'All Paths' },
  design: { ar: '\u0627\u0644\u062a\u062e\u0637\u064a\u0637 \u0648\u0627\u0644\u062a\u0635\u0645\u064a\u0645', en: 'Planning & Design' },
  simulation: { ar: '\u0627\u0644\u062a\u0646\u0628\u0624 \u0648\u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629', en: 'Forecasting & Simulation' },
  fieldwork: { ar: '\u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u064a\u062f\u0627\u0646\u064a \u0648\u062c\u0645\u0639 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a', en: 'Fieldwork & Collection' },
  publishing: { ar: '\u0627\u0644\u062a\u062d\u0643\u064a\u0645 \u0648\u0627\u0644\u0646\u0634\u0631 \u0627\u0644\u0639\u0644\u0645\u064a', en: 'Publishing & Peer Review' }
};

const STEP_NAMES: Record<string, { ar: string, en: string }> = {
  ideaExploration: { ar: '\u0627\u0633\u062a\u0643\u0634\u0627\u0641 \u0627\u0644\u0623\u0641\u0643\u0627\u0631 \u0627\u0644\u0628\u062d\u062b\u064a\u0629', en: 'Idea Exploration' },
  titleAnalysis: { ar: '\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0648\u0635\u064a\u0627\u063a\u062a\u0647', en: 'Title Analysis' },
  problemGap: { ar: '\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0648\u0627\u0644\u0641\u062c\u0648\u0629 \u0627\u0644\u0639\u0644\u0645\u064a\u0629', en: 'Problem Gap Statement' },
  objectives: { ar: '\u0635\u064a\u0627\u063a\u0629 \u0623\u0647\u062f\u0627\u0641 \u0627\u0644\u062f\u0631\u0627\u0633\u0629', en: 'Research Objectives' },
  questionsHypotheses: { ar: '\u0635\u064a\u0627\u063a\u0629 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0627\u0644\u0641\u0631\u0636\u064a\u0627\u062a', en: 'Questions & Hypotheses' },
  variables: { ar: '\u062a\u0648\u0635\u064a\u0641 \u0648\u062a\u0635\u0646\u064a\u0641 \u0645\u062a\u063a\u064a\u0631\u0627\u062a \u0627\u0644\u062f\u0631\u0627\u0633\u0629', en: 'Define Variables' },
  conceptualModel: { ar: '\u0628\u0646\u0627\u0621 \u0627\u0644\u0646\u0645\u0648\u0630\u062c \u0627\u0644\u0645\u0646\u0647\u062c\u064a \u0627\u0644\u0628\u0635\u0631\u064a', en: 'Build Conceptual Model' },
  methodologyDesign: { ar: '\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0646\u0647\u062c \u0648\u0623\u062f\u0648\u0627\u062a \u0627\u0644\u0642\u064a\u0627\u0633', en: 'Select Methodology Design' },
  populationSample: { ar: '\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u062c\u062a\u0645\u0639 \u0648\u062d\u062c\u0645 \u0627\u0644\u0639\u064a\u0646\u0629', en: 'Population & Sample Size' },
  measurementInstruments: { ar: '\u0628\u0646\u0627\u0621 \u0648\u062a\u062f\u0642\u064a\u0642 \u0623\u062f\u0648\u0627\u062a \u0627\u0644\u0642\u064a\u0627\u0633', en: 'Measurement Instruments' },
  analysisPlan: { ar: '\u0635\u064a\u0627\u063a\u0629 \u062e\u0637\u0629 \u0627\u0644\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0625\u062d\u0635\u0627\u0626\u064a', en: 'Statistical Analysis Plan' },
  literatureEvidence: { ar: '\u062a\u0648\u0644\u064a\u0641 \u0627\u0644\u0623\u062f\u0628\u064a\u0627\u062a \u0648\u0627\u0644\u062f\u0631\u0627\u0633\u0627\u062a \u0627\u0644\u0633\u0627\u0628\u0642\u0629', en: 'Literature Synthesis' },
  simulation: { ar: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0645\u0648\u0646\u062a \u0643\u0627\u0631\u0644\u0648 \u0644\u0644\u062f\u0631\u062c\u0627\u062a', en: 'Monte Carlo Mock Simulation' },
  prediction: { ar: '\u0627\u0644\u062a\u0646\u0628\u0624 \u0628\u0627\u062d\u062a\u0645\u0627\u0644 \u062f\u0639\u0645 \u0627\u0644\u0641\u0631\u0636\u064a\u0627\u062a', en: 'Bayesian Outcome Forecast' },
  consistencyValidation: { ar: '\u062a\u062f\u0642\u064a\u0642 \u0627\u0644\u0627\u062a\u0633\u0627\u0642 \u0627\u0644\u062f\u0627\u062e\u0644\u064a \u0648\u0627\u0644\u062e\u0627\u0631\u062c\u064a', en: 'Consistency Validation' },
  ethicsFeasibility: { ar: '\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0623\u062e\u0644\u0627\u0642\u064a\u0627\u062a \u0648\u0645\u062e\u0627\u0637\u0631 \u0627\u0644\u062a\u0637\u0628\u064a\u0642', en: 'Ethics & Feasibility Review' },
  preRegistration: { ar: '\u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0645\u0633\u0628\u0642 \u0648\u062a\u062c\u0645\u064a\u062f \u0627\u0644\u062e\u0637\u0629', en: 'Study Pre-Registration' },
  finalResearchPlan: { ar: '\u062a\u0635\u062f\u064a\u0631 \u0648\u0627\u0639\u062a\u0645\u0627\u062f \u062e\u0637\u0629 \u0627\u0644\u062f\u0631\u0627\u0633\u0629 \u0627\u0644\u0646\u0647\u0627\u0626\u064a\u0629', en: 'Final Research Plan Export' },
  fidelity: { ar: '\u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0628\u0627\u0644\u062e\u0637\u0629 \u0645\u064a\u062f\u0627\u0646\u064a\u0627', en: 'Intervention Fidelity Monitoring' },
  dataQuality: { ar: '\u0641\u062d\u0635 \u062c\u0648\u062f\u0629 \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0627\u0644\u0627\u062a\u0633\u0627\u0642', en: 'Raw Data Quality Inspection' },
  litSynthesizer: { ar: '\u062a\u0648\u0644\u064a\u0641 \u0648\u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u062f\u0631\u0627\u0633\u0627\u062a \u0627\u0644\u0633\u0627\u0628\u0642\u0629', en: 'Literature Synthesis Matrix' },
  prisma: { ar: '\u0625\u0646\u0634\u0627\u0621 \u0645\u062e\u0637\u0637 \u062a\u062f\u0641\u0642 PRISMA \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a', en: 'Interactive PRISMA Flowchart' },
  qualitative: { ar: '\u0627\u0644\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0646\u0648\u0639\u064a \u0644\u0644\u0645\u0642\u0627\u0628\u0644\u0627\u062a \u0648\u0627\u0644\u062a\u0631\u0645\u064a\u0632', en: 'Qualitative Interview Coding' },
  reviewSim: { ar: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0642\u0631\u0627\u0631\u0627\u062a \u0645\u062d\u0643\u0645\u064a \u0627\u0644\u0645\u062c\u0644\u0627\u062a', en: 'Peer Review Decisions Simulator' }
};

const STEP_ROUTE_MAP: Record<string, string> = {
  ideaExploration: ROUTES.NEW_STUDY_DESIGN,
  titleAnalysis: VIEW_TO_PATH.analyzer,
  problemGap: ROUTES.NEW_STUDY_DESIGN,
  objectives: ROUTES.NEW_STUDY_DESIGN,
  questionsHypotheses: VIEW_TO_PATH.consistency,
  variables: VIEW_TO_PATH.modelBuilder,
  conceptualModel: VIEW_TO_PATH.modelBuilder,
  methodologyDesign: VIEW_TO_PATH.modelBuilder,
  populationSample: VIEW_TO_PATH.sampleCalc,
  measurementInstruments: VIEW_TO_PATH.measurement,
  analysisPlan: VIEW_TO_PATH.analysisPlan,
  literatureEvidence: VIEW_TO_PATH.litSynthesizer,
  prediction: VIEW_TO_PATH.outcomePredictor,
  consistencyValidation: VIEW_TO_PATH.consistency,
  ethicsFeasibility: VIEW_TO_PATH.planning,
  preRegistration: VIEW_TO_PATH.preReg,
  finalResearchPlan: VIEW_TO_PATH.export,
};

const PATH_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FolderGit2,
  UserCheck,
  Brain,
  Activity,
  Database,
  BookOpen,
  Sparkles,
};

export const ResearchPathSelector: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language, updateProjectWorkflowProfile, createProject } = useProject();
  
  const [selectedPathId, setSelectedPathId] = useState<string>('NEW_STUDY_DESIGN');
  const [activeTab, setActiveTab] = useState<'all' | 'design' | 'simulation' | 'fieldwork' | 'publishing'>('all');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [planLimitHit, setPlanLimitHit] = useState(false);

  const filteredPaths = RESEARCH_PATHS_CONFIG.filter(
    path => activeTab === 'all' || path.category === activeTab
  );

  const selectedPath = RESEARCH_PATHS_CONFIG.find(path => path.id === selectedPathId);
  const activeResearchPath = activeProject?.activePathId
    ? RESEARCH_PATHS_CONFIG.find(path => path.id === activeProject.activePathId)
    : undefined;

  const getCompletedStepsCount = (path: ResearchPath) => {
    if (!activeProject) return 0;
    const completed = activeProject.completedSteps || [];
    return path.orderedSteps.filter(s => completed.includes(s)).length;
  };

  const getFirstUncompletedStep = (path: ResearchPath) => {
    if (!activeProject) return path.orderedSteps[0];
    const completed = activeProject.completedSteps || [];
    for (const step of path.orderedSteps) {
      if (!completed.includes(step)) {
        return step;
      }
    }
    return path.orderedSteps[path.orderedSteps.length - 1];
  };

  const getPathProgressPercent = (path: ResearchPath) => {
    if (!path.orderedSteps.length) return 0;
    return Math.round((getCompletedStepsCount(path) / path.orderedSteps.length) * 100);
  };

  const getStepPath = (stepKey: string, projectId?: string) => {
    const raw = VIEW_TO_PATH[stepKey] || STEP_ROUTE_MAP[stepKey];
    if (!raw) return ROUTES.LIFECYCLE;
    if (raw.includes(':projectId')) {
      const id = projectId || activeProject?.id;
      if (!id) return ROUTES.PATHS;
      return raw.replaceAll(':projectId', id);
    }
    return raw;
  };

  const handleStartPath = async (path: ResearchPath) => {
    setStartError('');
    setPlanLimitHit(false);
    setStarting(true);
    try {
      let project = activeProject;
      if (!project) {
        const studyDesign = starterStudyDesign(path.id);
        project = await createProject({
          titleAr: path.titleAr,
          titleEn: path.titleEn,
          departmentAr: '',
          departmentEn: '',
          institutionAr: '',
          institutionEn: '',
          descriptionAr: path.descriptionAr,
          descriptionEn: path.descriptionEn,
          problemStatementAr: '',
          problemStatementEn: '',
          studyDesign,
          variables: [],
          questions: [],
          hypotheses: [],
          sampleSettings: {
            marginOfError: 0.05,
            confidenceLevel: 0.95,
            expectedPower: 0.80,
            expectedEffectSize: 0.5,
            expectedAttritionRate: 0.15,
            groupsCount: 2,
          },
          activePathId: path.id,
          completedSteps: [],
        });
      }
      if (!project?.id || project.id === 'demo-1') {
        setStartError(language === 'ar'
          ? 'تعذر إنشاء مشروع على الخادم. تحقق من تسجيل الدخول ثم أعد المحاولة.'
          : 'Could not create a server project. Sign in and try again.');
        return;
      }

      await updateProjectWorkflowProfile(project.id, {
        activePathId: path.id,
        completedSteps: project.completedSteps || []
      });

      const orgId = project.organizationId || 'personal';
      if (path.id === 'COMPLETED_STUDY_ANALYSIS') {
        navigate(VIEW_TO_PATH.researchData);
      } else if (path.id === 'NEW_STUDY_DESIGN') {
        navigate(ROUTES.NEW_STUDY_DESIGN.replace(':projectId', project.id));
      } else if (path.id === 'SEMINAR_PROPOSAL_REVIEW') {
        navigate(`/organizations/${orgId}/projects/${project.id}/paths/seminar-proposal`);
      } else if (path.id === 'THESIS_DEFENSE_PREPARATION') {
        navigate(`/organizations/${orgId}/projects/${project.id}/paths/thesis-defense`);
      } else {
        const nextStep = getFirstUncompletedStep(path);
        navigate(getStepPath(nextStep, project.id) || ROUTES.LIFECYCLE);
      }
    } catch (error) {
      if (isPlanLimitError(error)) {
        setPlanLimitHit(true);
        setStartError('');
      } else {
        setStartError(language === 'ar' ? 'تعذر بدء المسار.' : 'Could not start the path.');
      }
    } finally {
      setStarting(false);
    }
  };

  const tabClass = (tab: keyof typeof CATEGORY_LABELS) =>
    `px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer border ${
      activeTab === tab
        ? 'bg-[var(--ds-primary-soft)] text-ink border-[var(--ds-primary)] shadow-sm'
        : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-tertiary)]'
    }`;

  // Helper to render inline SVGs for path cards.
  const renderPathIllustration = (name: string) => {
    switch (name) {
      case 'StudyDesignIllustration':
        return (
          <svg className="w-12 h-12 text-[var(--ds-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        );
      case 'SimulationIllustration':
        return (
          <svg className="w-12 h-12 text-path-identity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.44l-5.577 5.578 5.577 5.578m5-11.156l5.578 5.578-5.578 5.578m2.137-9.59L10.518 21.6" />
          </svg>
        );
      case 'FieldStudyIllustration':
        return (
          <svg className="w-12 h-12 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307L21.75 7.875M21.75 7.875V12M21.75 7.875H17.25" />
          </svg>
        );
      case 'DataAnalysisIllustration':
        return (
          <svg className="w-12 h-12 text-path-data" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          </svg>
        );
      case 'ReadingPaperIllustration':
        return (
          <svg className="w-12 h-12 text-path-data" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        );
      default:
        return (
          <svg className="w-12 h-12 text-[var(--ds-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.473L21 9l-3.096-3.096L9.813 15.904z" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-16">
      <PathPanel accent="var(--ds-path-research)">
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 text-xs font-bold text-[var(--ds-primary)]">
            <Sparkles size={14} />
            <span>{language === 'ar' ? '\u0645\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u0628\u062d\u062b \u0627\u0644\u0645\u0646\u0647\u062c\u064a\u0629' : 'Methodological Paths'}</span>
          </div>
          <h2 className="text-h2 m-0 text-[var(--ds-text-primary)]">
            {language === 'ar' ? '\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0623\u0646\u0633\u0628 \u0644\u062f\u0631\u0627\u0633\u0629 \u0627\u0644\u064a\u0648\u0645' : 'How can Baseerah assist your study today?'}
          </h2>
          <p className="text-body-sm md:text-base text-[var(--ds-text-secondary)] font-medium m-0">
            {language === 'ar'
              ? '\u0627\u062e\u062a\u0631 \u0645\u0633\u0627\u0631\u0627 \u0645\u0646\u0647\u062c\u064a\u0627 \u0645\u062d\u062f\u062f\u0627 \u0644\u062a\u0631\u062a\u064a\u0628 \u0623\u062f\u0648\u0627\u062a \u0627\u0644\u062a\u0635\u0645\u064a\u0645 \u0648\u0627\u0644\u062a\u062d\u0644\u064a\u0644 \u0648\u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629 \u0648\u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0648\u0641\u0642 \u0645\u0631\u062d\u0644\u0629 \u0645\u0634\u0631\u0648\u0639\u0643 \u0627\u0644\u062d\u0627\u0644\u064a\u0629.'
              : 'Select a research path to orchestrate study design validation, predictive modeling, and publishing audits.'}
          </p>
        </div>
      </PathPanel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-4 shadow-sm">
          <span className="text-[11px] font-black text-[var(--ds-text-muted)] block">{language === 'ar' ? '\u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629' : 'Available Paths'}</span>
          <strong className="text-2xl font-black text-ink ds-numeric block mt-1">{RESEARCH_PATHS_CONFIG.length}</strong>
        </div>
        <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-4 shadow-sm">
          <span className="text-[11px] font-black text-[var(--ds-text-muted)] block">{language === 'ar' ? '\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0646\u0634\u0637' : 'Active Path'}</span>
          <strong className="text-sm font-black text-[var(--ds-text-primary)] block mt-2 leading-5">
            {activeResearchPath
              ? (language === 'ar' ? activeResearchPath.titleAr : activeResearchPath.titleEn)
              : (language === 'ar' ? 'لم يتم اعتماد مسار بعد' : 'No adopted path yet')}
          </strong>
        </div>
        <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-4 shadow-sm">
          <span className="text-[11px] font-black text-[var(--ds-text-muted)] block">{language === 'ar' ? '\u0627\u0644\u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629' : 'Current Filter'}</span>
          <strong className="text-sm font-black text-ink block mt-2 leading-5">
            {language === 'ar' ? CATEGORY_LABELS[activeTab].ar : CATEGORY_LABELS[activeTab].en}
          </strong>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-[var(--ds-border-subtle)]" role="tablist" aria-label={language === 'ar' ? 'تصفية المسارات حسب الفئة' : 'Filter paths by category'}>
        {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            className={tabClass(tab)}
          >
            {language === 'ar' ? CATEGORY_LABELS[tab].ar : CATEGORY_LABELS[tab].en}
          </button>
        ))}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: List of paths cards (7/12 width) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPaths.map((path) => {
              const isActivePath = activeProject?.activePathId === path.id;
              const isSelected = selectedPathId === path.id;
              const progressPercent = getPathProgressPercent(path);

              return (
                <Card
                  key={path.id}
                  variant={isActivePath ? 'selected' : isSelected ? 'interactive' : 'default'}
                  onClick={() => setSelectedPathId(path.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPathId(path.id);
                    }
                  }}
                  className={`flex flex-col justify-between min-h-[292px] p-5 relative overflow-hidden transition-all duration-300 cursor-pointer border ${isSelected ? 'border-[var(--ds-primary)] shadow-md' : 'border-[var(--ds-border-subtle)] hover:border-[var(--ds-border-default)] hover:shadow-sm'}`}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[var(--ds-surface-secondary)] rounded-lg border border-[var(--ds-border-subtle)]">
                        {renderPathIllustration(path.illustrationName)}
                      </div>
                      <div className="flex gap-1.5">
                        {path.beta && (
                          <span className="px-2 py-0.5 rounded-md text-[8px] font-extrabold bg-warning/10 text-warning border border-warning/20">
                            BETA
                          </span>
                        )}
                        {isActivePath && (
                          <span className="px-2 py-0.5 rounded-md text-[8px] font-black bg-[var(--ds-primary-soft)] text-ink border border-[var(--ds-primary)]/20">
                            {language === 'ar' ? '\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0646\u0634\u0637' : 'ACTIVE PATH'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-h3 text-[var(--ds-text-primary)] m-0">
                        {language === 'ar' ? path.titleAr : path.titleEn}
                      </h3>
                      <p className="text-[11px] text-[var(--ds-text-secondary)] leading-relaxed m-0 h-10 overflow-hidden">
                        {language === 'ar' ? path.descriptionAr : path.descriptionEn}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--ds-border-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-[var(--ds-text-muted)] font-semibold">
                      <span>
                        {language === 'ar'
                          ? `${path.orderedSteps.length} \u0623\u062f\u0648\u0627\u062a \u0645\u0646\u0647\u062c\u064a\u0629`
                          : `${path.orderedSteps.length} tools`}
                      </span>
                      <span className={`ds-numeric ${isActivePath ? 'text-ink font-black' : 'text-[var(--ds-text-muted)]'}`}>
                        {language === 'ar' ? `\u0625\u0646\u062c\u0627\u0632 ${progressPercent}%` : `${progressPercent}% Completed`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--ds-surface-tertiary)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isActivePath ? 'bg-[var(--ds-primary)]' : 'bg-[var(--ds-border-default)]'}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Roadmap Drawer (5/12 width) */}
        <div className="lg:col-span-5">
          {selectedPath ? (
            <Card className="p-6 border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] shadow-sm space-y-6 sticky top-6">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-lg bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 flex items-center justify-center shrink-0 text-[var(--ds-primary)]">
                      {React.createElement(PATH_ICON_MAP[selectedPath.iconName] || Compass, { size: 14 })}
                    </span>
                    <h3 className="text-h3 text-[var(--ds-text-primary)] m-0">
                      {language === 'ar' ? selectedPath.titleAr : selectedPath.titleEn}
                    </h3>
                  </div>
                  <span className="text-[9px] bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] px-2 py-0.5 rounded-full font-black">
                    {language === 'ar' ? selectedPath.recommendedStageAr : selectedPath.recommendedStageEn}
                  </span>
                </div>
                <p className="text-caption text-[var(--ds-text-secondary)] m-0">
                  {language === 'ar' ? selectedPath.descriptionAr : selectedPath.descriptionEn}
                </p>
              </div>

              {/* Progress indicator */}
              {activeProject && (
                <div className="space-y-1.5 p-3 bg-[var(--ds-surface-secondary)] rounded-lg border border-[var(--ds-border-subtle)]">
                  <div className="flex justify-between text-[10px] font-black text-[var(--ds-text-muted)]">
                    <span>{language === 'ar' ? '\u0646\u0633\u0628\u0629 \u0625\u0646\u062c\u0627\u0632 \u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0645\u0633\u0627\u0631:' : 'Path Roadmap Completion:'}</span>
                    <span className="ds-numeric">{getCompletedStepsCount(selectedPath)} / {selectedPath.orderedSteps.length}</span>
                  </div>
                  <Progress value={getPathProgressPercent(selectedPath)} variant="primary" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3">
                  <span className="block text-[9px] font-black text-[var(--ds-text-muted)]">
                    {language === 'ar' ? '\u0623\u062f\u0648\u0627\u062a \u0623\u0633\u0627\u0633\u064a\u0629' : 'Primary Tools'}
                  </span>
                  <strong className="mt-1 block text-sm text-ink ds-numeric">{selectedPath.primaryTools.length}</strong>
                </div>
                <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3">
                  <span className="block text-[9px] font-black text-[var(--ds-text-muted)]">
                    {language === 'ar' ? '\u0623\u062f\u0648\u0627\u062a \u0645\u0633\u0627\u0646\u062f\u0629' : 'Supporting Tools'}
                  </span>
                  <strong className="mt-1 block text-sm text-ink ds-numeric">{selectedPath.supportingTools.length}</strong>
                </div>
                <div className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3">
                  <span className="block text-[9px] font-black text-[var(--ds-text-muted)]">
                    {language === 'ar' ? '\u0645\u062e\u0631\u062c\u0627\u062a' : 'Outputs'}
                  </span>
                  <strong className="mt-1 block text-sm text-ink ds-numeric">{selectedPath.expectedOutputs.length}</strong>
                </div>
              </div>

              {/* Steps Timeline */}
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-2 no-scrollbar">
                <h4 className="text-h4 text-[var(--ds-text-primary)] uppercase block">
                  {language === 'ar' ? '\u062e\u0627\u0631\u0637\u0629 \u0637\u0631\u064a\u0642 \u0627\u0644\u0623\u062f\u0648\u0627\u062a \u0648\u0627\u0644\u062e\u0637\u0648\u0627\u062a:' : 'Roadmap Timeline & Tools:'}
                </h4>
                
                <div className="relative border-r border-[var(--ds-border-subtle)] mr-2.5 pl-2.5 space-y-4">
                  {selectedPath.orderedSteps.map((stepKey, idx) => {
                    const stepInfo = STEP_NAMES[stepKey] || { ar: stepKey, en: stepKey };
                    const isCompleted = activeProject?.completedSteps?.includes(stepKey);
                    const isNextStep = activeProject && getFirstUncompletedStep(selectedPath) === stepKey;
                    const stepPath = getStepPath(stepKey);

                    return (
                      <div key={idx} className="relative flex items-start gap-3 text-xs">
                        {/* Timeline dot */}
                        <span className={`absolute right-[-14px] top-1 w-2.5 h-2.5 rounded-full border-2 ${isCompleted ? 'bg-action border-success' : isNextStep ? 'bg-[var(--ds-primary)] border-[var(--ds-primary)]' : 'bg-[var(--ds-surface-secondary)] border-[var(--ds-border-subtle)]'}`}></span>
                        {isNextStep && (
                          <span className="absolute right-[-14px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--ds-primary)] border-2 border-[var(--ds-primary)]"></span>
                        )}

                        <div className="flex-1 space-y-1">
                          <button
                            onClick={() => {
                              if (stepPath) navigate(stepPath);
                            }}
                            disabled={!stepPath}
                            className={`text-start w-full font-bold text-[11px] transition-colors ${
                              isCompleted
                                ? 'text-success line-through'
                                : isNextStep
                                  ? 'text-ink font-black'
                                  : 'text-[var(--ds-text-secondary)]'
                            } ${stepPath ? 'cursor-pointer hover:underline' : 'cursor-default opacity-70'}`}
                          >
                            {language === 'ar' ? stepInfo.ar : stepInfo.en}
                          </button>
                          {isNextStep && (
                            <span className="inline-flex rounded-full bg-[var(--ds-primary-soft)] px-2 py-0.5 text-[9px] font-black text-ink border border-[var(--ds-primary)]/20">
                              {language === 'ar' ? '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629' : 'NEXT STEP'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[var(--ds-border-subtle)] space-y-2">
                {!activeProject && (
                  <p className="text-[10px] text-[var(--ds-text-secondary)] font-bold m-0 text-center">
                    {language === 'ar'
                      ? 'لا يوجد مشروع بعد؛ سيُنشأ مشروع على الخادم عند اعتماد المسار.'
                      : 'No project yet; adopting this path will create a server-saved project.'}
                  </p>
                )}
                {planLimitHit && <PlanLimitNotice language={language} />}
                {startError && <p className="text-[10px] text-[var(--ds-danger)] font-bold m-0 text-center" role="alert">{startError}</p>}
                <Button
                  onClick={() => handleStartPath(selectedPath)}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  disabled={!selectedPath.available || starting}
                  loading={starting}
                >
                  <span>
                    {starting
                      ? (language === 'ar' ? 'جارٍ إنشاء المشروع...' : 'Creating project...')
                      : activeProject?.activePathId === selectedPath.id 
                      ? (language === 'ar' ? '\u0627\u0633\u062a\u0626\u0646\u0627\u0641 \u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0645\u0633\u0627\u0631' : 'Resume Research Path')
                      : (language === 'ar' ? '\u0627\u0639\u062a\u0645\u0627\u062f \u0648\u0628\u062f\u0621 \u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0646\u0647\u062c\u064a' : 'Adopt & Start Path')}
                  </span>
                  {language === 'ar' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </Button>
              </div>
            </Card>
          ) : (
            <EmptyState
              className="h-[400px] justify-center"
              illustration={<Compass size={40} />}
              title={language === 'ar' ? 'لم يتم اختيار مسار بعد' : 'No path selected yet'}
              description={language === 'ar'
                ? 'اختر مسارًا بحثيًا من القائمة لعرض خارطة الطريق.'
                : 'Select a research path from the list to display the roadmap.'}
            />
          )}
        </div>
      </div>
    </div>
  );
};
