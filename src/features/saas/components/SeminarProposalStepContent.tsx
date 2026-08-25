import React, { Suspense, lazy } from 'react';
import { Card } from '../../../design-system/components/Card';
import { Button } from '../../../design-system/components/Button';
import { SEMINAR_PROPOSAL_STEPS } from '../../../config/seminarProposalSteps';
import { Check } from 'lucide-react';
import type { useWorkspaceState } from '../useWorkspaceState';

type WorkspaceState = ReturnType<typeof useWorkspaceState>;

interface SeminarProposalStepContentProps {
  engine: WorkspaceState;
}

// Lazy load tools
const TitleAnalyzer = lazy(() => import('../../../components/TitleAnalyzer').then(m => ({ default: m.TitleAnalyzer })));
const ConsistencyChecker = lazy(() => import('../../../components/ConsistencyChecker').then(m => ({ default: m.ConsistencyChecker })));
const ModelBuilder = lazy(() => import('../../../components/ModelBuilder').then(m => ({ default: m.ModelBuilder })));
const PreRegistration = lazy(() => import('../../../components/PreRegistration').then(m => ({ default: m.PreRegistration })));

export const SeminarProposalStepContent: React.FC<SeminarProposalStepContentProps> = ({ engine }) => {
  const {
    activeStep,
    activeProject,
    language,
    handleMarkStepCompleted,
    handleMarkStepIncomplete
  } = engine;

  if (!activeProject) return null;

  const stepConfig = SEMINAR_PROPOSAL_STEPS.find(s => s.id === activeStep) || SEMINAR_PROPOSAL_STEPS[0];
  const isCompleted = activeProject.completedSteps?.includes(activeStep) || false;

  return (
    <Card className="p-6 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-2xl shadow-sm space-y-6">
      
      {/* Step Header */}
      <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-4">
        <div>
          <h4 className="text-base font-black m-0">
            {language === 'ar' ? stepConfig.titleAr : stepConfig.titleEn}
          </h4>
          <p className="text-xs text-[var(--ds-text-muted)] font-semibold mt-1 mb-0">
            {language === 'ar' ? stepConfig.descriptionAr : stepConfig.descriptionEn}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted ? (
            <Button variant="secondary" onClick={handleMarkStepIncomplete} className="px-3.5 py-1.5 text-[10px] font-black rounded-xl text-success cursor-pointer">
              <Check size={12} />
              <span>{language === 'ar' ? 'مكتملة ✓' : 'Completed ✓'}</span>
            </Button>
          ) : (
            <Button variant="primary" onClick={handleMarkStepCompleted} className="px-3.5 py-1.5 text-[10px] font-black rounded-xl cursor-pointer">
              <span>{language === 'ar' ? 'تحديد كمكتملة' : 'Mark Completed'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tools Content */}
      <div className="min-h-[300px]">
        <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--ds-text-muted)] motion-safe:animate-pulse">Loading step workspace...</div>}>
          {activeStep === 'analyzer' && <TitleAnalyzer />}
          {activeStep === 'consistency' && <ConsistencyChecker />}
          {activeStep === 'modelBuilder' && <ModelBuilder />}
          {activeStep === 'preReg' && <PreRegistration />}
        </Suspense>
      </div>
    </Card>
  );
};
