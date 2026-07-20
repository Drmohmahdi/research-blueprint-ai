import React from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspaceState } from './useWorkspaceState';
import { WorkspaceStepper } from './components/WorkspaceStepper';
import { WorkspaceStepContent } from './components/WorkspaceStepContent';
import { WorkspaceRiskPanel } from './components/WorkspaceRiskPanel';
import { WorkspaceCommentsPanel } from './components/WorkspaceCommentsPanel';
import { NEW_STUDY_DESIGN_STEPS } from '../../config/newStudyDesignSteps';
import { 
  Sparkles,
  Unlock,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';

export const NewStudyDesignWorkspace: React.FC = () => {
  const { stepId } = useParams<{ stepId?: string }>();
  const engine = useWorkspaceState(stepId);
  const {
    activeStep,
    setActiveStep,
    mode,
    setMode,
    isSidebarOpen,
    activeProject,
    language,
    isSecureMode
  } = engine;

  if (!activeProject) {
    return (
      <div className="p-12 text-center text-xs text-[var(--ds-text-muted)] italic font-semibold">
        {language === 'ar' ? 'الرجاء اختيار مشروع نشط أولاً...' : 'Please select an active project first...'}
      </div>
    );
  }

  // Stepper helper navigations
  const handlePrevStep = () => {
    const idx = NEW_STUDY_DESIGN_STEPS.findIndex(s => s.id === activeStep);
    if (idx > 0) {
      setActiveStep(NEW_STUDY_DESIGN_STEPS[idx - 1].id);
    }
  };

  const handleNextStep = () => {
    const idx = NEW_STUDY_DESIGN_STEPS.findIndex(s => s.id === activeStep);
    if (idx < NEW_STUDY_DESIGN_STEPS.length - 1) {
      setActiveStep(NEW_STUDY_DESIGN_STEPS[idx + 1].id);
    }
  };

  const totalSteps = NEW_STUDY_DESIGN_STEPS.length;
  const completedStepsCount = activeProject.completedSteps?.length || 0;
  const progressPct = Math.round((completedStepsCount / totalSteps) * 100);

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto pb-24">
      {/* ── Path Header ── */}
      <Card className="p-6 bg-gradient-to-r from-purple-900 via-indigo-950 to-zinc-950 border-[var(--ds-border-subtle)] text-white rounded-3xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Sparkles size={160} />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black bg-purple-500/25 border border-purple-400/30 text-purple-300 tracking-wider">
                {language === 'ar' ? 'مساحة تصميم الدراسة' : 'STUDY DESIGN WORKSPACE'}
              </span>
              {isSecureMode && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                  <Unlock size={10} />
                  <span>{language === 'ar' ? 'وضع آمن' : 'SECURE'}</span>
                </div>
              )}
            </div>
            <h3 className="text-xl md:text-3xl font-black m-0 leading-tight">
              {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}
            </h3>
            <p className="text-xs text-zinc-300 font-medium m-0">
              {language === 'ar' ? `المؤسسة: ${activeProject.institutionAr || 'مساحة شخصية'}` : `Institution: ${activeProject.institutionEn || 'Personal Workspace'}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            {/* Mode toggle */}
            <div className="flex bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
              <button 
                onClick={() => setMode('guided')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  mode === 'guided' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {language === 'ar' ? 'توجيه خطوة بخطوة' : 'Guided'}
              </button>
              <button 
                onClick={() => setMode('expert')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  mode === 'expert' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {language === 'ar' ? 'التحكم المتقدم' : 'Expert'}
              </button>
            </div>

            {/* Progress bar */}
            <div className="text-center lg:text-right space-y-1">
              <div className="text-xs font-black text-purple-300">{progressPct}% {language === 'ar' ? 'مكتمل' : 'Completed'}</div>
              <div className="h-2 w-32 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Path Overview Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { key: 'design', labelAr: 'اكتمال التصميم', labelEn: 'Design Progress', val: `${progressPct}%`, col: 'text-purple-600' },
          { key: 'consistency', labelAr: 'الاتساق المنهجي', labelEn: 'Consistency Index', val: (activeProject.variables?.length || 0) > 0 ? '90/100' : '50/100', col: 'text-indigo-600' },
          { key: 'sample', labelAr: 'جاهزية العينة', labelEn: 'Sample Power', val: activeProject.sampleSettings?.populationSize ? '80%' : '0%', col: 'text-emerald-600' },
          { key: 'evidence', labelAr: 'جودة الأدلة', labelEn: 'Evidence Weight', val: activeProject.pooledEffectSize ? 'A (High)' : 'N/A', col: 'text-cyan-600' },
          { key: 'risk', labelAr: 'مؤشر المخاطر', labelEn: 'Risk Index', val: activeProject.preRegistrationLockedAt ? 'LOW' : 'MEDIUM', col: 'text-rose-600' },
          { key: 'prereg', labelAr: 'التسجيل المسبق', labelEn: 'Pre-Reg Status', val: activeProject.preRegistrationLockedAt ? (language === 'ar' ? 'مؤمن' : 'LOCKED') : (language === 'ar' ? 'مسودة' : 'DRAFT'), col: 'text-amber-600' },
          { key: 'readiness', labelAr: 'جاهزية النشر', labelEn: 'Ready Score', val: activeProject.preRegistrationLockedAt ? '92%' : '64%', col: 'text-teal-600' }
        ].map((m) => (
          <Card key={m.key} className="p-3 text-center border-[var(--ds-border-subtle)] space-y-1 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-[var(--ds-text-muted)] uppercase block truncate">
              {language === 'ar' ? m.labelAr : m.labelEn}
            </span>
            <span className={`text-base font-black ${m.col} block`}>{m.val}</span>
          </Card>
        ))}
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Column: Stepper */}
        {mode === 'guided' && <WorkspaceStepper engine={engine} />}

        {/* Center Workspace Panel */}
        <div className="flex-1 w-full space-y-6">
          <WorkspaceStepContent engine={engine} />
          
          {/* Stepper Footer Navigation */}
          <Card className="p-4 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-2xl flex items-center justify-between shadow-sm">
            <Button onClick={handlePrevStep} variant="secondary" className="flex items-center gap-1 cursor-pointer">
              <ChevronLeft size={16} />
              <span>{language === 'ar' ? 'الخطوة السابقة' : 'Previous Step'}</span>
            </Button>
            <Button onClick={handleNextStep} className="flex items-center gap-1 cursor-pointer">
              <span>{language === 'ar' ? 'الخطوة التالية' : 'Next Step'}</span>
              <ChevronRight size={16} />
            </Button>
          </Card>
        </div>

        {/* Right Panel: Risks, Insights & Supervisor Comments */}
        {isSidebarOpen && (
          <aside className="w-full lg:w-[320px] space-y-6 shrink-0">
            <WorkspaceRiskPanel engine={engine} />
            <WorkspaceCommentsPanel engine={engine} />
          </aside>
        )}

      </div>
    </div>
  );
};
export default NewStudyDesignWorkspace;
