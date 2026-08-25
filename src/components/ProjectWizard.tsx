import React, { useEffect, useRef } from 'react';
import { useProjectWizardState } from '../features/guided-flow/useProjectWizardState';
import { WizardStepIndicator } from '../features/guided-flow/components/WizardStepIndicator';
import { WizardStep1To3 } from '../features/guided-flow/components/WizardStep1To3';
import { WizardStep4To5 } from '../features/guided-flow/components/WizardStep4To5';
import { WizardStep6To7 } from '../features/guided-flow/components/WizardStep6To7';
import { Save } from 'lucide-react';
import { getTranslation } from '../utils/translations';
import { Card, Button, Alert, Progress, Modal, PathPanel } from '../design-system';

export const ProjectWizard: React.FC = () => {
  const engine = useProjectWizardState();
  const {
    step,
    setStep,
    language,
    handleSave,
    isDirty,
    toast,
    stepErrors,
    isStepValid,
    completionPercent,
    pendingDelete,
    cancelDelete,
    confirmDelete
  } = engine;

  const contentRef = useRef<HTMLDivElement>(null);
  const stepValid = isStepValid(step);

  // Move focus to the step content and announce the change for screen readers
  useEffect(() => {
    contentRef.current?.focus();
  }, [step]);

  const deleteLabels: Record<string, { title: string; body: string }> = {
    question: {
      title: language === 'ar' ? 'حذف السؤال' : 'Delete Question',
      body: language === 'ar' ? 'هل أنت متأكد من حذف هذا السؤال؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this question? This action cannot be undone.'
    },
    hypothesis: {
      title: language === 'ar' ? 'حذف الفرض' : 'Delete Hypothesis',
      body: language === 'ar' ? 'هل أنت متأكد من حذف هذا الفرض؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this hypothesis? This action cannot be undone.'
    },
    variable: {
      title: language === 'ar' ? 'حذف المتغير' : 'Delete Variable',
      body: language === 'ar' ? 'هل أنت متأكد من حذف هذا المتغير؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this variable? This action cannot be undone.'
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Screen-reader announcement of the active step */}
      <span className="sr-only" role="status" aria-live="polite">
        {language === 'ar' ? `الخطوة ${step} من 7` : `Step ${step} of 7`}
      </span>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md">
            <Alert variant={toast.type === 'success' ? 'success' : 'danger'}>
              {toast.message}
            </Alert>
          </div>
        </div>
      )}

      {/* Data Completion Progress */}
      <PathPanel accent="var(--ds-path-research)">
        <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[var(--ds-text-secondary)]">
          <span>{language === 'ar' ? 'نسبة اكتمال البيانات' : 'Data Completion'}</span>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-[10px] font-bold text-[var(--ds-warning)]">
                {language === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved changes'}
              </span>
            )}
            <span className="text-ink ds-numeric" dir="ltr">{completionPercent}%</span>
          </div>
        </div>
        <Progress value={completionPercent} variant={completionPercent === 100 ? 'success' : 'primary'} />
        </div>
      </PathPanel>

      {/* Step Header Indicator */}
      <WizardStepIndicator engine={engine} />

      {/* Main Wizard Form Body */}
      <Card padding="lg" className="space-y-6">
        <div ref={contentRef} tabIndex={-1} className="focus:outline-none space-y-6">
          {step >= 1 && step <= 3 && <WizardStep1To3 engine={engine} />}
          {step >= 4 && step <= 5 && <WizardStep4To5 engine={engine} />}
          {step >= 6 && step <= 7 && <WizardStep6To7 engine={engine} />}
        </div>

        {!stepValid && (
          <div className="text-[11px] font-bold text-[var(--ds-danger)] bg-[var(--ds-danger-soft)] border border-[var(--ds-danger)]/20 rounded-lg px-3 py-2">
            {Object.values(stepErrors)[0]}
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex justify-between items-center border-t border-[var(--ds-border-subtle)] pt-4 mt-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={step === 1}
            onClick={() => setStep(prev => prev - 1)}
          >
            {getTranslation(language, 'previous')}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="success"
              size="sm"
              iconBefore={<Save size={16} />}
              onClick={() => handleSave()}
            >
              {getTranslation(language, 'save')}
            </Button>

            {step < 7 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!stepValid}
                onClick={() => setStep(prev => prev + 1)}
              >
                {getTranslation(language, 'next')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!pendingDelete}
        onClose={cancelDelete}
        title={pendingDelete ? deleteLabels[pendingDelete.kind].title : ''}
        size="sm"
        footerActions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={cancelDelete}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={confirmDelete}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </>
        }
      >
        {pendingDelete ? deleteLabels[pendingDelete.kind].body : null}
      </Modal>
    </div>
  );
};
export default ProjectWizard;
