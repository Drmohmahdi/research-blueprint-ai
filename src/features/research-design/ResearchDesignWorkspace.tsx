import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { RESEARCH_STEPS_CONFIG, type ResearchStepId, type StepStatus } from './researchDesignConfig';
import { evaluateStepCompletion } from './researchCompletionRules';
import { ResearchDesignHeader } from './ResearchDesignHeader';
import { ResearchDesignStepper } from './ResearchDesignStepper';
import { ResearchDesignStepPage } from './ResearchDesignStepPage';
import { ResearchDesignOverview } from './ResearchDesignOverview';
import { ResearchNextAction } from './ResearchNextAction';
import { ResearchRiskPanel } from './ResearchRiskPanel';
import { ResearchPredictionPanel } from './ResearchPredictionPanel';
import { ResearchCommentsPanel } from './ResearchCommentsPanel';
import { SkeletonGrid } from '../../components/SkeletonCard';

export const ResearchDesignWorkspace: React.FC = () => {
  const { projectId, stepId } = useParams<{ projectId: string; stepId?: string }>();
  const navigate = useNavigate();
  const {
    activeProject,
    setActiveProject,
    projects,
    language,
    updateProject,
    updateProjectWorkflowProfile
  } = useProject();

  const [activeStepId, setActiveStepId] = useState<ResearchStepId>('IDEA_EXPLORATION');
  const [isGuidedMode, setIsGuidedMode] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [stepCommentsCounts, setStepCommentsCounts] = useState<Record<string, number>>({});

  // Sync active step with route stepId if provided
  useEffect(() => {
    if (stepId) {
      const matched = RESEARCH_STEPS_CONFIG.find(s => s.id === stepId);
      if (matched) {
        setActiveStepId(matched.id);
      }
    }
  }, [stepId]);

  // Load project if not active but exists in context
  useEffect(() => {
    if (projectId && (!activeProject || activeProject.id !== projectId)) {
      const found = projects.find((p: any) => p.id === projectId);
      if (found) {
        setActiveProject(found);
      }
    }
  }, [projectId, projects, activeProject, setActiveProject]);

  if (!activeProject) {
    return (
      <div className="p-6">
        <SkeletonGrid cards={4} />
      </div>
    );
  }


  // Evaluate step completion statuses
  const stepStatuses: Record<ResearchStepId, StepStatus> = {} as any;
  const stepProgresses: Record<ResearchStepId, number> = {} as any;
  const stepMissingInputs: Record<ResearchStepId, string[]> = {} as any;
  const stepWarnings: Record<ResearchStepId, string[]> = {} as any;

  RESEARCH_STEPS_CONFIG.forEach(step => {
    const evaluation = evaluateStepCompletion(
      step.id,
      activeProject,
      null, // simulation data
      null, // prediction data
      stepCommentsCounts[step.id] || 0
    );
    stepStatuses[step.id] = evaluation.status;
    stepProgresses[step.id] = evaluation.progressPercentage;
    stepMissingInputs[step.id] = evaluation.missingInputs;
    stepWarnings[step.id] = evaluation.warnings;
  });

  const activeStepConfig = RESEARCH_STEPS_CONFIG.find(s => s.id === activeStepId) || RESEARCH_STEPS_CONFIG[0];

  const handleSelectStep = (id: ResearchStepId) => {
    setActiveStepId(id);
    navigate(`/app/research/projects/${activeProject.id}/design/${id}`);
  };

  const handleNavigateNext = () => {
    const currentIdx = RESEARCH_STEPS_CONFIG.findIndex(s => s.id === activeStepId);
    if (currentIdx < RESEARCH_STEPS_CONFIG.length - 1) {
      const nextStep = RESEARCH_STEPS_CONFIG[currentIdx + 1];
      handleSelectStep(nextStep.id);
    }
  };

  const handleSaveWorkspace = async () => {
    setIsSaving(true);
    try {
      // Collect completed steps
      const completedList = Object.entries(stepStatuses)
        .filter(([_, status]) => status === 'COMPLETED')
        .map(([id]) => id);

      await updateProjectWorkflowProfile(activeProject.id, {
        activePathId: 'NEW_STUDY_DESIGN',
        completedSteps: completedList,
        intelligenceProfile: {
          lastUpdated: new Date().toISOString(),
          designProgress: Math.round(
            Object.values(stepProgresses).reduce((acc, curr) => acc + curr, 0) / 18
          )
        }
      });
    } catch (err) {
      console.error('Failed to save study design profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--ds-surface-primary)]">
      {/* Workspace Header */}
      <ResearchDesignHeader
        project={activeProject}
        language={language}
        isGuidedMode={isGuidedMode}
        setIsGuidedMode={setIsGuidedMode}
        isSaving={isSaving}
        onSave={handleSaveWorkspace}
        onBack={() => navigate('/')}
        activeStepTitle={language === 'ar' ? activeStepConfig.titleAr : activeStepConfig.titleEn}
      />

      <div className="flex flex-col md:flex-row flex-1">
        {/* Step Stepper Side Navigation (Expert Mode shows all 18, Guided Mode shows active) */}
        {(!isGuidedMode || activeStepId !== 'FINAL_RESEARCH_PLAN') && (
          <ResearchDesignStepper
            activeStepId={activeStepId}
            onSelectStep={handleSelectStep}
            stepStatuses={stepStatuses}
            language={language}
          />
        )}

        {/* Main Step Workspace Content Area */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
          {/* Main overview indicators shown at the top of Expert Mode workspace */}
          {!isGuidedMode && activeStepId === 'IDEA_EXPLORATION' && (
            <ResearchDesignOverview
              project={activeProject}
              stepProgresses={stepProgresses}
              language={language}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step Content Page */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl p-6 shadow-sm">
                <ResearchDesignStepPage
                  stepId={activeStepId}
                  project={activeProject}
                  onUpdateProject={(updated) => updateProject(updated)}
                  language={language}
                />
              </div>

              {/* Next Best Action Widget */}
              <ResearchNextAction
                currentStepId={activeStepId}
                missingInputs={stepMissingInputs[activeStepId] || []}
                warnings={stepWarnings[activeStepId] || []}
                onNavigateNext={handleNavigateNext}
                language={language}
              />
            </div>

            {/* Sidebar widgets panel (Risk, Prediction, Comments) */}
            <div className="space-y-6">
              {/* Methodological Risk Check */}
              <ResearchRiskPanel project={activeProject} language={language} />

              {/* Prediction Engine Widget */}
              <ResearchPredictionPanel project={activeProject} language={language} />

              {/* Supervisor Comments Panel specific to step */}
              <ResearchCommentsPanel
                projectId={activeProject.id}
                activeStepId={activeStepId}
                language={language}
                onCommentsCountChange={(count) => {
                  setStepCommentsCounts(prev => ({
                    ...prev,
                    [activeStepId]: count
                  }));
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ResearchDesignWorkspace;
