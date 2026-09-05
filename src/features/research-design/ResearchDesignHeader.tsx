import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';

import type { ResearchProject } from '../../types/research';

interface ResearchDesignHeaderProps {
  project: ResearchProject | null;
  language: 'ar' | 'en';
  isGuidedMode: boolean;
  setIsGuidedMode: (mode: boolean) => void;
  isSaving: boolean;
  onSave: () => void;
  onBack: () => void;
  activeStepTitle: string;
}

export const ResearchDesignHeader: React.FC<ResearchDesignHeaderProps> = ({
  project,
  language,
  isGuidedMode,
  setIsGuidedMode,
  isSaving,
  onSave,
  onBack,
  activeStepTitle
}) => {
  const isAr = language === 'ar';

  return (
    <div className="bg-[var(--ds-surface-secondary)] border-b border-[var(--ds-border-subtle)] p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      {/* Title & Project Meta */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-[var(--ds-surface-tertiary)] rounded-lg transition-colors text-[var(--ds-text-secondary)] border-none bg-transparent cursor-pointer"
        >
          <ArrowLeft className={isAr ? "rotate-180" : ""} size={20} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-h2 text-[var(--ds-text-primary)]">
              {isAr ? 'تصميم دراسة جديدة' : 'New Study Design'}
            </h2>
            <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-[var(--ds-primary-soft)] text-ink">
              {activeStepTitle}
            </span>
          </div>
          <p className="text-caption text-[var(--ds-text-secondary)] mt-1">
            {project ? (isAr ? project.titleAr : project.titleEn) : ''}
          </p>
        </div>
      </div>

      {/* Mode Switcher, Saving Indicator, Save Button */}
      <div className="flex items-center flex-wrap gap-3 w-full md:w-auto justify-end">
        {/* Toggle Mode */}
        <div className="flex bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-0.5 text-xs font-semibold">
          <button
            onClick={() => setIsGuidedMode(true)}
            className={`px-3 py-1.5 rounded-md transition-all border-none cursor-pointer ${
              isGuidedMode
                ? 'bg-[var(--ds-primary-soft)] text-ink shadow-sm'
                : 'text-[var(--ds-text-secondary)] bg-transparent hover:text-[var(--ds-text-primary)]'
            }`}
          >
            {isAr ? 'المسار الموجه' : 'Guided Mode'}
          </button>
          <button
            onClick={() => setIsGuidedMode(false)}
            className={`px-3 py-1.5 rounded-md transition-all border-none cursor-pointer ${
              !isGuidedMode
                ? 'bg-[var(--ds-primary-soft)] text-ink shadow-sm'
                : 'text-[var(--ds-text-secondary)] bg-transparent hover:text-[var(--ds-text-primary)]'
            }`}
          >
            {isAr ? 'وضع الخبير' : 'Expert Mode'}
          </button>
        </div>

        {/* Save Status & Button */}
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-[var(--ds-text-secondary)] motion-safe:animate-pulse">
              {isAr ? 'جاري الحفظ...' : 'Saving...'}
            </span>
          )}
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-action hover:bg-action-hover text-on-action border-none cursor-pointer shadow-sm ds-transition"
          >
            <Save size={14} />
            <span>{isAr ? 'حفظ' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default ResearchDesignHeader;
