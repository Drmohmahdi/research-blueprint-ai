import React, { Suspense, lazy } from 'react';
import { Card } from '../../../design-system/components/Card';
import { Button } from '../../../design-system/components/Button';
import { NEW_STUDY_DESIGN_STEPS } from '../../../config/newStudyDesignSteps';
import { 
  Check, 
  Save, 
  Printer 
} from 'lucide-react';
import type { useWorkspaceState } from '../useWorkspaceState';

type WorkspaceState = ReturnType<typeof useWorkspaceState>;

interface WorkspaceStepContentProps {
  engine: WorkspaceState;
}

// Standalone tools lazy imports
const TitleAnalyzer = lazy(() => import('../../../components/TitleAnalyzer').then(m => ({ default: m.TitleAnalyzer })));
const ModelBuilder = lazy(() => import('../../../components/ModelBuilder').then(m => ({ default: m.ModelBuilder })));
const SampleSizeCalc = lazy(() => import('../../../components/SampleSizeCalc').then(m => ({ default: m.SampleSizeCalc })));
const LiteratureSynthesizer = lazy(() => import('../../../components/LiteratureSynthesizer').then(m => ({ default: m.LiteratureSynthesizer })));
const SimulationLab = lazy(() => import('../../../components/SimulationLab').then(m => ({ default: m.SimulationLab })));
const ResearchOutcomePredictor = lazy(() => import('../../../components/ResearchOutcomePredictor').then(m => ({ default: m.ResearchOutcomePredictor })));
const ConsistencyChecker = lazy(() => import('../../../components/ConsistencyChecker').then(m => ({ default: m.ConsistencyChecker })));
const MeasurementInstruments = lazy(() => import('../../../components/MeasurementInstruments').then(m => ({ default: m.MeasurementInstruments })));
const AnalysisPlan = lazy(() => import('../../../components/AnalysisPlan').then(m => ({ default: m.AnalysisPlan })));
const PreRegistration = lazy(() => import('../../../components/PreRegistration').then(m => ({ default: m.PreRegistration })));

export const WorkspaceStepContent: React.FC<WorkspaceStepContentProps> = ({ engine }) => {
  const {
    activeStep,
    activeProject,
    language,
    descriptionAr,
    setDescriptionAr,
    problemStatementAr,
    setProblemStatementAr,
    objectives,
    setObjectives,
    timeline,
    setTimeline,
    ethics,
    setEthics,
    handleSaveTextChanges,
    handleMarkStepCompleted,
    handleMarkStepIncomplete,
    setSaveStatus,
    updateProject
  } = engine;

  if (!activeProject) return null;

  const stepConfig = NEW_STUDY_DESIGN_STEPS.find(s => s.id === activeStep) || NEW_STUDY_DESIGN_STEPS[0];
  const isCompleted = activeProject.completedSteps?.includes(activeStep) || false;

  return (
    <Card className="p-6 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-2xl shadow-sm space-y-6">
      
      {/* Step Header */}
      <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-4">
        <div>
          <h4 className="text-h4 m-0">
            {language === 'ar' ? stepConfig.titleAr : stepConfig.titleEn}
          </h4>
          <p className="text-caption text-[var(--ds-text-muted)] font-semibold mt-1 mb-0">
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

      {/* Step Forms / Tool Adapters */}
      <div className="min-h-[300px]">
        <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--ds-text-muted)] motion-safe:animate-pulse">Loading step workspace...</div>}>
          
          {/* 1. Idea exploration */}
          {activeStep === 'ideaExploration' && (
            <div className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'عنوان البحث بالعربية' : 'Research Title (Arabic)'}</label>
                  <input
                    type="text"
                    value={activeProject.titleAr}
                    onChange={(e) => updateProject({ ...activeProject, titleAr: e.target.value })}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'عنوان البحث بالإنجليزية' : 'Research Title (English)'}</label>
                  <input
                    type="text"
                    value={activeProject.titleEn}
                    onChange={(e) => updateProject({ ...activeProject, titleEn: e.target.value })}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'مقدمة / ملخص الفكرة البحثية (العربية)' : 'Abstract / Idea summary (Arabic)'}</label>
                  <textarea
                    rows={4}
                    value={descriptionAr}
                    onChange={(e) => { setDescriptionAr(e.target.value); setSaveStatus('dirty'); }}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
              </div>
              <Button onClick={handleSaveTextChanges} className="flex items-center gap-1 cursor-pointer">
                <Save size={14} />
                <span>{language === 'ar' ? 'حفظ البيانات' : 'Save Changes'}</span>
              </Button>
            </div>
          )}

          {/* 2. Title analysis adapter */}
          {activeStep === 'titleAnalysis' && <TitleAnalyzer />}

          {/* 3. Problem and gap */}
          {activeStep === 'problemGap' && (
            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'صياغة مشكلة البحث وتبرير فجوتها العلمية' : 'Formulate problem statement and justify the study gap'}</label>
                <textarea
                  rows={6}
                  value={problemStatementAr}
                  onChange={(e) => { setProblemStatementAr(e.target.value); setSaveStatus('dirty'); }}
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                />
              </div>
              <Button onClick={handleSaveTextChanges} className="flex items-center gap-1 cursor-pointer">
                <Save size={14} />
                <span>{language === 'ar' ? 'حفظ البيانات' : 'Save Changes'}</span>
              </Button>
            </div>
          )}

          {/* 4. Objectives */}
          {activeStep === 'objectives' && (
            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'الأهداف البحثية العامة والفرعية' : 'Define general and specific objectives'}</label>
                <textarea
                  rows={6}
                  value={objectives}
                  onChange={(e) => { setObjectives(e.target.value); setSaveStatus('dirty'); }}
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                />
              </div>
              <Button onClick={handleSaveTextChanges} className="flex items-center gap-1 cursor-pointer">
                <Save size={14} />
                <span>{language === 'ar' ? 'حفظ البيانات' : 'Save Changes'}</span>
              </Button>
            </div>
          )}

          {/* 5. Questions and hypotheses */}
          {activeStep === 'questionsHypotheses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-caption m-0 font-semibold text-[var(--ds-text-secondary)]">
                  {language === 'ar' ? 'أضف أسئلة الدراسة والفروض هنا داخل مساحة التصميم.' : 'Add research questions and hypotheses here inside the design workspace.'}
                </p>
                <Button type="button" size="sm" onClick={() => updateProject({
                  ...activeProject,
                  questions: [...(activeProject.questions || []), { id: `q-${Date.now()}`, textAr: '', textEn: '', associatedVariables: [] }]
                })}>{language === 'ar' ? 'إضافة سؤال' : 'Add question'}</Button>
              </div>
              {(activeProject.questions || []).length === 0 ? (
                <p className="text-caption text-[var(--ds-text-muted)]">{language === 'ar' ? 'لا أسئلة بعد.' : 'No questions yet.'}</p>
              ) : (activeProject.questions || []).map((question, index) => (
                <div key={question.id} className="space-y-2 rounded-xl border border-[var(--ds-border-subtle)] p-3">
                  <input
                    className="w-full rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-3 py-2 text-xs"
                    value={language === 'ar' ? question.textAr : question.textEn}
                    placeholder={language === 'ar' ? 'نص السؤال' : 'Question text'}
                    onChange={event => {
                      const questions = [...(activeProject.questions || [])];
                      questions[index] = { ...question, [language === 'ar' ? 'textAr' : 'textEn']: event.target.value };
                      updateProject({ ...activeProject, questions });
                    }}
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => updateProject({
                    ...activeProject,
                    hypotheses: [...(activeProject.hypotheses || []), {
                      id: `h-${Date.now()}`,
                      questionId: question.id,
                      textAr: '',
                      textEn: '',
                      type: 'directional',
                      independentVarId: activeProject.variables?.[0]?.id || '',
                      dependentVarId: activeProject.variables?.find(variable => variable.type === 'dependent')?.id || ''
                    }]
                  })}>{language === 'ar' ? 'إضافة فرض مرتبط' : 'Add linked hypothesis'}</Button>
                </div>
              ))}
              {(activeProject.hypotheses || []).length > 0 && (
                <div className="space-y-2">
                  <h5 className="m-0 text-xs font-black">{language === 'ar' ? 'الفروض' : 'Hypotheses'}</h5>
                  {(activeProject.hypotheses || []).map((hypothesis, index) => (
                    <input
                      key={hypothesis.id}
                      className="w-full rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-3 py-2 text-xs"
                      value={language === 'ar' ? hypothesis.textAr : hypothesis.textEn}
                      placeholder={language === 'ar' ? 'نص الفرض' : 'Hypothesis text'}
                      onChange={event => {
                        const hypotheses = [...(activeProject.hypotheses || [])];
                        hypotheses[index] = { ...hypothesis, [language === 'ar' ? 'textAr' : 'textEn']: event.target.value };
                        updateProject({ ...activeProject, hypotheses });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. Variables */}
          {activeStep === 'variables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-caption m-0 font-semibold text-[var(--ds-text-secondary)]">
                  {language === 'ar' ? 'عرّف متغيرات الدراسة داخل مساحة التصميم.' : 'Define study variables inside the design workspace.'}
                </p>
                <Button type="button" size="sm" onClick={() => updateProject({
                  ...activeProject,
                  variables: [...(activeProject.variables || []), { id: `v-${Date.now()}`, nameAr: '', nameEn: '', type: 'independent', scale: 'interval' }]
                })}>{language === 'ar' ? 'إضافة متغير' : 'Add variable'}</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(activeProject.variables || []).map((variable, index) => (
                  <Card key={variable.id} className="space-y-2 p-3 border-[var(--ds-border-subtle)] text-xs font-bold bg-[var(--ds-surface-primary)]">
                    <input
                      className="w-full rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-2 py-1.5"
                      value={language === 'ar' ? variable.nameAr : variable.nameEn}
                      placeholder={language === 'ar' ? 'اسم المتغير' : 'Variable name'}
                      onChange={event => {
                        const variables = [...(activeProject.variables || [])];
                        variables[index] = { ...variable, [language === 'ar' ? 'nameAr' : 'nameEn']: event.target.value };
                        updateProject({ ...activeProject, variables });
                      }}
                    />
                    <select
                      className="w-full rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-2 py-1.5"
                      value={variable.type}
                      onChange={event => {
                        const variables = [...(activeProject.variables || [])];
                        variables[index] = { ...variable, type: event.target.value as typeof variable.type };
                        updateProject({ ...activeProject, variables });
                      }}
                    >
                      <option value="independent">independent</option>
                      <option value="dependent">dependent</option>
                      <option value="mediator">mediator</option>
                      <option value="moderator">moderator</option>
                      <option value="control">control</option>
                    </select>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 7. Conceptual Model */}
          {activeStep === 'conceptualModel' && <ModelBuilder />}

          {/* 8. Methodology and design */}
          {activeStep === 'methodologyDesign' && (
            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'اختر تصميم الدراسة' : 'Select Study Design'}</label>
                <select
                  value={activeProject.studyDesign}
                  onChange={(e) => updateProject({ ...activeProject, studyDesign: e.target.value as any })}
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                >
                  <option value="experimental_rct">{language === 'ar' ? 'RCT - تصميم تجريبي حقيقي' : 'RCT - Randomized Controlled'}</option>
                  <option value="quasi_experimental_pre_post">{language === 'ar' ? 'شبه تجريبي - قياس قبلي بعدي' : 'Quasi-Experimental'}</option>
                  <option value="descriptive">{language === 'ar' ? 'منهج وصفي تحليلي' : 'Descriptive Design'}</option>
                </select>
              </div>
            </div>
          )}

          {/* 9. Population and sample */}
          {activeStep === 'populationSample' && <SampleSizeCalc />}

          {/* 10. Measurement instruments */}
          {activeStep === 'measurementInstruments' && <MeasurementInstruments />}

          {/* 11. Analysis plan */}
          {activeStep === 'analysisPlan' && <AnalysisPlan />}

          {/* 12. Literature Evidence */}
          {activeStep === 'literatureEvidence' && <LiteratureSynthesizer />}

          {/* 13. Simulation */}
          {activeStep === 'simulation' && <SimulationLab />}

          {/* 14. Prediction */}
          {activeStep === 'prediction' && <ResearchOutcomePredictor />}

          {/* 15. Consistency validation */}
          {activeStep === 'consistencyValidation' && <ConsistencyChecker />}

          {/* 16. Ethics and feasibility */}
          {activeStep === 'ethicsFeasibility' && (
            <div className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'الموافقات الرسمية وإجراءات سرية البيانات' : 'Official ethical approvals and privacy procedures'}</label>
                  <textarea
                    rows={3}
                    value={ethics}
                    onChange={(e) => { setEthics(e.target.value); setSaveStatus('dirty'); }}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--ds-text-secondary)] block mb-1">{language === 'ar' ? 'الجدول الزمني للتدخل وإجراءات تقليل الفاقد' : 'Timeline for intervention implementation'}</label>
                  <textarea
                    rows={3}
                    value={timeline}
                    onChange={(e) => { setTimeline(e.target.value); setSaveStatus('dirty'); }}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
              </div>
              <Button onClick={handleSaveTextChanges} className="flex items-center gap-1 cursor-pointer">
                <Save size={14} />
                <span>{language === 'ar' ? 'حفظ البيانات' : 'Save Changes'}</span>
              </Button>
            </div>
          )}

          {/* 17. Pre Registration */}
          {activeStep === 'preRegistration' && <PreRegistration />}

          {/* 18. Final research plan */}
          {activeStep === 'finalResearchPlan' && (
            <div className="space-y-6">
              <div className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl text-xs font-bold text-[var(--ds-text-secondary)]">
                {language === 'ar' ? 'خطة البحث العلمي المكتملة وجاهزة للتصدير كملف مجمع.' : 'Academic Research Blueprint compiled and ready for printing.'}
              </div>

              <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] space-y-4">
                <h5 className="text-sm font-black text-center border-b border-[var(--ds-border-subtle)] pb-2 uppercase tracking-wide m-0">
                  {language === 'ar' ? 'ملخص مخرجات تصميم البحث' : 'Research Blueprint Summary'}
                </h5>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div><strong>{language === 'ar' ? 'العنوان:' : 'Title:'}</strong> {language === 'ar' ? activeProject.titleAr : activeProject.titleEn}</div>
                  <div><strong>{language === 'ar' ? 'التصميم المنهجي:' : 'Study Design:'}</strong> {activeProject.studyDesign}</div>
                  <div><strong>{language === 'ar' ? 'عدد المتغيرات:' : 'Variables Count:'}</strong> {activeProject.variables?.length || 0}</div>
                  <div><strong>{language === 'ar' ? 'حجم العينة المطلوب:' : 'Minimum Sample:'}</strong> {activeProject.sampleSettings?.populationSize || 'N/A'}</div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button onClick={() => window.print()} className="flex items-center gap-1 cursor-pointer">
                  <Printer size={14} />
                  <span>{language === 'ar' ? 'طباعة التقرير (HTML)' : 'Print Blueprint'}</span>
                </Button>
              </div>
            </div>
          )}

        </Suspense>
      </div>
    </Card>
  );
};
