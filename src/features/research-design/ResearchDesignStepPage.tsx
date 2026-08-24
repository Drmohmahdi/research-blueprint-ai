import React, { useEffect, useState } from 'react';
import type { ResearchProject } from '../../types/research';
import type { ResearchStepId } from './researchDesignConfig';
import { TitleAnalyzer } from '../../components/TitleAnalyzer';
import { ModelBuilder } from '../../components/ModelBuilder';
import { SampleSizeCalc } from '../../components/SampleSizeCalc';
import { SimulationLab } from '../../components/SimulationLab';
import { LiteratureSynthesizer } from '../../components/LiteratureSynthesizer';
import { ResearchOutcomePredictor } from '../../components/ResearchOutcomePredictor';
import { ConsistencyChecker } from '../../components/ConsistencyChecker';
import { PreRegistration } from '../../components/PreRegistration';
import { ResearchOutputsCenter } from './ResearchOutputsCenter';

interface ResearchDesignStepPageProps {
  stepId: ResearchStepId;
  project: ResearchProject | null;
  onUpdateProject: (updated: ResearchProject) => void;
  language: 'ar' | 'en';
}

export const ResearchDesignStepPage: React.FC<ResearchDesignStepPageProps> = ({
  stepId,
  project,
  onUpdateProject,
  language
}) => {
  const isAr = language === 'ar';

  // Handle local edits for conceptual steps
  const [ideaText, setIdeaText] = useState(project?.descriptionAr || '');
  const [domain, setDomain] = useState(project?.departmentAr || '');
  const [problemStatement, setProblemStatement] = useState(project?.problemStatementAr || '');

  useEffect(() => {
    setIdeaText(project?.descriptionAr || '');
    setDomain(project?.departmentAr || '');
    setProblemStatement(project?.problemStatementAr || '');
  }, [project?.id, project?.descriptionAr, project?.departmentAr, project?.problemStatementAr]);

  if (!project) {
    return (
      <div className="text-center py-10 text-[var(--ds-text-secondary)] text-sm">
        {isAr ? 'برجاء اختيار مشروع أولاً' : 'Please select a project first'}
      </div>
    );
  }

  const saveConceptualStep = () => {
    onUpdateProject({
      ...project,
      descriptionAr: ideaText,
      departmentAr: domain,
      problemStatementAr: problemStatement
    });
  };

  switch (stepId) {
    case 'IDEA_EXPLORATION':
      return (
        <div className="space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '1. استكشاف الفكرة البحثية والمجال' : '1. Idea & Domain Exploration'}
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[var(--ds-text-secondary)] mb-1">
                {isAr ? 'المجال الأكاديمي أو التخصص:' : 'Academic Domain/Dept:'}
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder={isAr ? 'مثال: مناهج وطرق تدريس' : 'e.g. Curriculum and Instruction'}
                className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--ds-text-secondary)] mb-1">
                {isAr ? 'الفكرة أو المشكلة البحثية الأولية:' : 'Initial Research Idea/Problem:'}
              </label>
              <textarea
                rows={4}
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                placeholder={isAr ? 'اكتب بالتفصيل الفكرة البحثية والمشكلة والسياق العام للدراسة...' : 'Write details about your research idea, context, and problem...'}
                className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] outline-none resize-none"
              />
            </div>
            <button
              onClick={saveConceptualStep}
              className="px-4 py-2 bg-action hover:bg-action-hover text-on-action rounded-lg font-bold border-none cursor-pointer"
            >
              {isAr ? 'حفظ البيانات' : 'Save Details'}
            </button>
          </div>
        </div>
      );

    case 'TITLE_ANALYSIS':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '2. أداة تحليل وتفكيك العنوان' : '2. Title Analysis'}
          </h3>
          <TitleAnalyzer />
        </div>
      );

    case 'PROBLEM_AND_GAP':
      return (
        <div className="space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '3. صياغة المشكلة والفجوة البحثية' : '3. Define Problem & Gap'}
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[var(--ds-text-secondary)] mb-1">
                {isAr ? 'صياغة مشكلة الدراسة وعلاقتها بالعنوان:' : 'Problem Statement Formulation:'}
              </label>
              <textarea
                rows={5}
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder={isAr ? 'وضح المشكلة البحثية والفجوة المعرفية التي تسعى الدراسة لملئها بدقة...' : 'Formulate the exact study problem and gap in literature...'}
                className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] outline-none resize-none"
              />
            </div>
            <button
              onClick={saveConceptualStep}
              className="px-4 py-2 bg-action hover:bg-action-hover text-on-action rounded-lg font-bold border-none cursor-pointer"
            >
              {isAr ? 'حفظ البيانات' : 'Save Details'}
            </button>
          </div>
        </div>
      );

    case 'OBJECTIVES':
      return (
        <div className="space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '4. تحديد أهداف الدراسة' : '4. Study Objectives'}
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[var(--ds-text-secondary)] mb-1">
                {isAr ? 'الهدف العام للدراسة:' : 'General Study Objective:'}
              </label>
              <input
                type="text"
                defaultValue={project.descriptionAr || ''}
                className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] outline-none"
                placeholder={isAr ? 'مثال: قياس أثر التدريب في تنمية المهارات...' : 'e.g. Measuring the effect of training on skill development...'}
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--ds-text-secondary)] mb-1">
                {isAr ? 'الأهداف الفرعية الإجرائية:' : 'Specific/Sub-Objectives:'}
              </label>
              <textarea
                rows={3}
                defaultValue={isAr ? '1. التعرف على المهارات الأساسية المطلوبة\n2. قياس مستوى التحصيل قبل وبعد التجربة' : '1. Identify core skills\n2. Measure achievement scores'}
                className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] outline-none resize-none"
              />
            </div>
          </div>
        </div>
      );

    case 'QUESTIONS_AND_HYPOTHESES':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '5. مصفوفة الأسئلة والفرضيات البحثية' : '5. Questions & Hypotheses'}
          </h3>
          <div className="bg-[var(--ds-surface-secondary)] p-4 rounded-xl border border-[var(--ds-border-subtle)] space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-ai mb-2">{isAr ? 'أسئلة الدراسة المفتوحة:' : 'Research Questions:'}</h4>
              <ul className="list-decimal list-inside space-y-1 text-[var(--ds-text-secondary)]">
                {project.questions?.map((q) => (
                  <li key={q.id}>{isAr ? q.textAr : q.textEn}</li>
                )) || <li>{isAr ? 'لا توجد أسئلة مسجلة' : 'No questions recorded'}</li>}
              </ul>
            </div>
            <div className="border-t border-[var(--ds-border-subtle)] pt-3">
              <h4 className="font-bold text-success mb-2">{isAr ? 'الفرضيات الإحصائية المقابلة:' : 'Corresponding Hypotheses:'}</h4>
              <ul className="list-disc list-inside space-y-1 text-[var(--ds-text-secondary)]">
                {project.hypotheses?.map((h) => (
                  <li key={h.id}>{isAr ? h.textAr : h.textEn}</li>
                )) || <li>{isAr ? 'لا توجد فرضيات مسجلة' : 'No hypotheses recorded'}</li>}
              </ul>
            </div>
          </div>
        </div>
      );

    case 'VARIABLES':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '6. محددات وتعريف المتغيرات' : '6. Variables Definition'}
          </h3>
          <ModelBuilder />
        </div>
      );

    case 'CONCEPTUAL_MODEL':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '7. تصميم النموذج المفاهيمي' : '7. Conceptual Model Builder'}
          </h3>
          <ModelBuilder />
        </div>
      );

    case 'METHODOLOGY_AND_DESIGN':
      return (
        <div className="space-y-4 max-w-2xl text-xs">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '8. اختيار المنهج والتصميم البحثي' : '8. Methodology & Research Design'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-[var(--ds-text-secondary)] mb-1">{isAr ? 'التصميم البحثي المعتمد:' : 'Research Design:'}</label>
              <select
                value={project.studyDesign}
                onChange={(e) => onUpdateProject({ ...project, studyDesign: e.target.value as any })}
                className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)]"
              >
                <option value="quasi_experimental_pre_post">{isAr ? 'شبه تجريبي (قياس قبلي وبعدي)' : 'Quasi-Experimental (Pre-Post)'}</option>
                <option value="experimental_rct">{isAr ? 'تجريبي كامل عشوائي' : 'Randomized Experimental'}</option>
                <option value="descriptive">{isAr ? 'وصفي مسحي' : 'Descriptive Survey'}</option>
                <option value="correlational">{isAr ? 'ارتباطي سببي' : 'Correlational'}</option>
              </select>

            </div>
            <div>
              <label className="block font-bold text-[var(--ds-text-secondary)] mb-1">{isAr ? 'مبررات اختيار المنهج والمخطط:' : 'Methodology Selection Rationale:'}</label>
              <textarea
                rows={3}
                defaultValue={isAr ? 'تم اختيار التصميم شبه التجريبي لملائمته لطبيعة الفصل الدراسي والتحكم بالمتغيرات الدخيلة.' : 'Selected quasi-experimental design because random assignment is not feasible in classrooms.'}
                className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] outline-none resize-none"
              />
            </div>
          </div>
        </div>
      );

    case 'POPULATION_AND_SAMPLE':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '9. مجتمع الدراسة وحاسبة العينة' : '9. Population & Sample Size Calculator'}
          </h3>
          <SampleSizeCalc />
        </div>
      );

    case 'MEASUREMENT_INSTRUMENTS':
      return (
        <div className="space-y-4 max-w-2xl text-xs">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '10. خطة أدوات القياس والاختبارات' : '10. Measurement Instruments Plan'}
          </h3>
          <div className="bg-[var(--ds-surface-secondary)] p-4 rounded-xl border border-[var(--ds-border-subtle)] space-y-3">
            <p className="text-[var(--ds-text-secondary)]">
              {isAr ? 'تأكد من صياغة مقياس أو اختبار لكل متغير تابع في الدراسة:' : 'Ensure a measurement tool is defined for each Dependent Variable:'}
            </p>
            {project.variables?.filter(v => v.type === 'dependent').map((v) => (
              <div key={v.id} className="p-2.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg">
                <span className="font-bold block mb-1 text-ai">{v.nameAr}</span>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--ds-text-secondary)]">
                  <span>{isAr ? 'نوع الأداة: اختبار تحصيلي' : 'Instrument: Test'}</span>
                  <span>{isAr ? 'طريقة الصدق: صدق المحتوى والتحكيم' : 'Validity: Content & Panel review'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'ANALYSIS_PLAN':
      return (
        <div className="space-y-4 max-w-2xl text-xs">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '11. خطة التحليل الإحصائي المقترحة' : '11. Statistical Analysis Plan'}
          </h3>
          <div className="bg-[var(--ds-surface-secondary)] p-4 rounded-xl border border-[var(--ds-border-subtle)] space-y-3">
            <p className="text-[var(--ds-text-secondary)]">
              {isAr ? 'الاختبارات الإحصائية المفترضة للتحقق من الفرضيات:' : 'Assumed statistical tests mapped to hypotheses:'}
            </p>
            {project.hypotheses?.map((h, idx) => (
              <div key={h.id} className="p-2.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg flex justify-between items-center">
                <span>{h.textAr}</span>
                <span className="px-2 py-0.5 bg-ai/10 text-ai dark:bg-ai/10 dark:text-ai rounded font-bold text-[10px]">
                  {idx === 0 ? 'ANCOVA' : 'Independent t-test'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'LITERATURE_EVIDENCE':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '12. تجميع أدلة وحجم أثر الدراسات السابقة' : '12. Literature Evidence Synthesis'}
          </h3>
          <LiteratureSynthesizer />
        </div>
      );

    case 'SIMULATION':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '13. مختبر محاكاة البيانات الاصطناعية' : '13. Simulation Lab'}
          </h3>
          <SimulationLab />
        </div>
      );

    case 'PREDICTION':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '14. محرك التنبؤ العلمي والتوقع الإحصائي' : '14. Scientific Prediction Engine'}
          </h3>
          <ResearchOutcomePredictor />
        </div>
      );

    case 'CONSISTENCY_VALIDATION':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '15. فحص الاتساق والصدق الداخلي' : '15. Consistency Checker'}
          </h3>
          <ConsistencyChecker />
        </div>
      );

    case 'ETHICS_AND_FEASIBILITY':
      return (
        <div className="space-y-4 max-w-2xl text-xs">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '16. الأخلاقيات والجدوى الإجرائية' : '16. Ethics & Feasibility'}
          </h3>
          <div className="bg-[var(--ds-surface-secondary)] p-4 rounded-xl border border-[var(--ds-border-subtle)] space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" defaultChecked />
              <label>{isAr ? 'موافقة لجنة أخلاقيات البحث العلمي بالمؤسسة (IRB)' : 'Institutional IRB Approval'}</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" defaultChecked />
              <label>{isAr ? 'حماية خصوصية بيانات الطلاب وتطبيق تشفير الهوية' : 'Anonymization and privacy protection'}</label>
            </div>
          </div>
        </div>
      );

    case 'PRE_REGISTRATION':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '17. التسجيل المسبق وتجميد التصميم' : '17. Pre-Registration'}
          </h3>
          <PreRegistration />
        </div>
      );

    case 'FINAL_RESEARCH_PLAN':
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr ? '18. خطة البحث النهائية المكتملة' : '18. Final Research Plan'}
          </h3>
          <ResearchOutputsCenter project={project} language={language} />
        </div>
      );

    default:
      return null;
  }
};
export default ResearchDesignStepPage;
