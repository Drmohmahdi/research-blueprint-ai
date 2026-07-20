import React from 'react';
import { Card, Stepper, type StepItem } from '../../../design-system';
import type { useProjectWizardState } from '../useProjectWizardState';

interface WizardStepIndicatorProps {
  engine: ReturnType<typeof useProjectWizardState>;
}

export const WizardStepIndicator: React.FC<WizardStepIndicatorProps> = ({ engine }) => {
  const { step, setStep, language, isStepValid } = engine;

  const stepsList = [
    { id: 1, labelAr: 'البيانات الأساسية', labelEn: 'Basic Info' },
    { id: 2, labelAr: 'المشكلة', labelEn: 'Problem' },
    { id: 3, labelAr: 'الأسئلة والفروض', labelEn: 'Questions & Hypotheses' },
    { id: 4, labelAr: 'المنهج والتصميم', labelEn: 'Design' },
    { id: 5, labelAr: 'العينة والمجتمع', labelEn: 'Sample' },
    { id: 6, labelAr: 'المتغيرات والقياس', labelEn: 'Measurement' },
    { id: 7, labelAr: 'التحليلات المقترحة', labelEn: 'Analysis' }
  ];

  const canNavigateTo = (targetStep: number) =>
    targetStep <= step || stepsList
      .filter(candidate => candidate.id < targetStep)
      .every(candidate => isStepValid(candidate.id));

  const steps: StepItem[] = stepsList.map((s) => {
    let status: StepItem['status'];
    if (s.id === step) {
      status = 'current';
    } else if (!canNavigateTo(s.id)) {
      status = 'locked';
    } else if (isStepValid(s.id)) {
      status = 'completed';
    } else if (s.id < step) {
      status = 'needs-review';
    } else {
      status = 'available';
    }
    return {
      id: String(s.id),
      label: language === 'ar' ? s.labelAr : s.labelEn,
      status
    };
  });

  return (
    <Card padding="sm">
      <Stepper
        steps={steps}
        currentStepId={String(step)}
        onStepClick={(id) => {
          const targetStep = Number(id);
          if (canNavigateTo(targetStep)) setStep(targetStep);
        }}
      />
    </Card>
  );
};
